'use strict';
(function () {
  const { KEYS, BY_ID, MATRIX, project, REFERENCE_MATRIX, referenceProject, referenceKeyPoint, pawPose, Scene } = window.YierKeyboardModel;
  const ART = window.YierKeyboardArt, scriptURL = document.currentScript.src;
  const sourcePreview = /\/desktop\/keyboard-scene\.js$/.test(new URL(scriptURL).pathname);
  const artBase = new URL(sourcePreview ? (location.protocol === 'file:' ? '../.runtime/keyboard-reference/' : '../keyboard-assets/') : 'keyboard-art/', scriptURL).href;
  const cutoutBase = new URL('keyboard-art/', scriptURL).href;
  const imageTag = (file, base = artBase) => `<image href="${new URL(file, base).href}" width="1536" height="1024"/>`;
  const NS = 'http://www.w3.org/2000/svg', heart = 'M0 4C-13-5-10-14-3-11L0-8 3-11C10-14 13-5 0 4Z';
  const labels = { starting: '连接键盘中…', paused: '休息一下 ♡', error: '右键重新连接', unavailable: '需要 Windows', idle: '同步已关闭' };
  let serial = 0;
  function keyMarkup() {
    return KEYS.map(k => `<g class="kb-key" data-key="${k.id}"><rect x="${k.x}" y="${k.y+3}" width="${k.w}" height="${k.h}" rx="5" class="kb-key-side"/><rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="5"/><text x="${k.x+k.w/2}" y="${k.y+k.h/2+.6}"${k.id === 'Space' ? ' style="font-size:8px;letter-spacing:3px"' : ''}>${k.label}</text></g>`).join('');
  }
  function pawSprite(pet, hand, width = 40, height = 30) {
    return `<svg class="kb-art" x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" viewBox="${ART[pet].paws[hand === 'left' ? 0 : 1].join(' ')}" preserveAspectRatio="none">${imageTag('compact-paws.png')}</svg>`;
  }
  function mount(container, { pet = 'pair', effects = true } = {}) {
    const pair = pet === 'pair', brown = pet === 'bubu', prefix = 'kb-' + (++serial);
    const root = document.createElement('div');
    root.className = 'kb-scene' + (pair ? ' kb-reference' : '');
    root.dataset.characters = pair ? '2' : '1';
    root.style.cssText = '--key:#fffbf2;--key-stroke:#b8987e;--accent:#ffd5b3;--accent-edge:#bb7e5a';
    const eyesClip = ART.eyes.map(([x,y,w,h]) => `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}"/>`).join('');
    const commonDefs = `<filter id="${prefix}-alpha" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="linear" slope="8" intercept="-6.5"/></feComponentTransfer></filter>`;
    const pairMarkup = pair ? `<defs>${commonDefs}<clipPath id="${prefix}-eyes">${eyesClip}</clipPath>${Object.entries(ART.silhouettes).map(([name,d]) => `<clipPath id="${prefix}-${name}"><path d="${d}"/></clipPath>`).join('')}</defs>
      <g class="kb-head">${imageTag('compact-cleanplate.png')}<g class="kb-open-eyes" clip-path="url(#${prefix}-eyes)">${imageTag('compact-scene.png')}</g></g>
      <g class="kb-board" transform="matrix(${REFERENCE_MATRIX.join(' ')})">${keyMarkup()}</g>
      <g class="kb-mouse-paw" clip-path="url(#${prefix}-mouse)">${imageTag('compact-scene.png')}</g>
      ${['left','right'].map(hand => `<g data-idle-paw="${hand}" clip-path="url(#${prefix}-${hand})">${imageTag('compact-scene.png')}</g><g data-paw="${hand}">${pawSprite('yier',hand,144,94)}</g>`).join('')}
      <g class="kb-love" transform="translate(1400 150) scale(3)"><path d="${heart}" fill="#e9a0b5"/></g>
      <rect x="1015" y="35" width="420" height="55" rx="27" fill="#fffcf6" stroke="#e8d8cc"/>
      <text class="kb-message" x="1225" y="70"></text>` : '';
    const soloMarkup = pair ? '' : `<defs>${commonDefs}</defs><ellipse cx="313" cy="316" rx="128" ry="7" fill="#765242" opacity=".08"/>
      <g class="kb-head"><svg class="kb-art" x="225" y="35" width="242" height="240" viewBox="${ART[pet].portrait.join(' ')}"><g filter="url(#${prefix}-alpha)">${imageTag(ART.cutouts.file,cutoutBase)}</g></svg></g>
      <g class="kb-board" transform="matrix(${MATRIX.join(' ')})"><rect x="132" y="215" width="376" height="126" rx="16" fill="#e7d5c2" stroke="#4e2b1d" stroke-width="4"/><rect x="132" y="205" width="376" height="126" rx="16" fill="#fff5e7" stroke="#4e2b1d" stroke-width="4"/>${keyMarkup()}</g>
      ${['left','right'].map(hand => `<g data-paw="${hand}">${pawSprite(pet,hand)}</g>`).join('')}
      <g class="kb-love" transform="translate(445 80)"><path d="${heart}" fill="#e9a0b5"/></g>
      <rect x="234" y="2" width="172" height="24" rx="12" fill="#fffcf6" stroke="#e8d8cc"/>
      <text class="kb-message" x="320" y="18"></text>`;
    root.innerHTML = `<svg viewBox="${pair ? '0 0 1536 1024' : '0 0 640 360'}" role="img" aria-label="${pair ? '原图同框的一二和布布' : brown ? '布布' : '一二'}的同步键盘"><g class="kb-composition">${pair ? pairMarkup : soloMarkup}<g class="kb-particles"></g></g></svg>`;
    container.appendChild(root);
    const scene = new Scene(), message = root.querySelector('.kb-message'), openEyes = root.querySelector('.kb-open-eyes');
    const particles = root.querySelector('.kb-particles'), blinkStart = Date.now();
    const keyNodes = new Map([...root.querySelectorAll('.kb-key')].map(el => [el.dataset.key,el]));
    const paws = Object.fromEntries(['left','right'].map(hand => [hand,root.querySelector(`[data-paw="${hand}"]`)]));
    const flashes = new Map(), reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    let frame = { status:'starting', mask:0 }, disposed = false, releaseTimer, lastBurst = 0;
    function move() {
      if (disposed) return;
      if (pair) root.querySelector('.kb-mouse-paw').setAttribute('transform', effects && ['left','right'].some(hand=>scene.paw(hand).down) ? 'translate(0 4)' : '');
      for (const hand of ['left','right']) {
        const pos = scene.paw(hand);
        if (pair) {
          const idle = root.querySelector(`[data-idle-paw="${hand}"]`);
          idle.style.display = pos.down ? 'none' : '';
          paws[hand].style.display = pos.down ? '' : 'none';
          if (!pos.down) continue;
          const contact = referenceKeyPoint(pos.id,hand), tip = hand === 'left' ? {x:5.5,y:41.2} : {x:10.3,y:38.1};
          paws[hand].setAttribute('transform',`translate(${contact.x-tip.x} ${contact.y-tip.y})`);
          paws[hand].dataset.contact = `${contact.x},${contact.y}`;
        } else {
          const {end,contact} = pawPose(hand,pos,pet);
          // Sprite height is 30px; its viewport origin matches the measured original fingertips.
          paws[hand].setAttribute('transform',`translate(${end.x} ${end.y-1})`);
          paws[hand].dataset.contact = `${contact.x},${contact.y}`;
        }
      }
    }
    function burst(id,celebrate = false) {
      if (!effects || reduced || disposed) return;
      const now = Date.now(); if (!celebrate && now-lastBurst<65) return; lastBurst=now;
      const key=BY_ID[id]||BY_ID.Enter, contact=(pair?referenceProject:project)(key.x+key.w/2,key.y), scale=pair?3:1;
      for(let i=0;i<(celebrate?5:1);i++) {
        while(particles.childElementCount>=16)particles.firstElementChild.remove();
        const anchor=document.createElementNS(NS,'g'),shape=document.createElementNS(NS,'path');
        anchor.setAttribute('transform',`translate(${contact.x} ${contact.y}) scale(${scale})`);
        shape.setAttribute('d',celebrate?heart:'M0-6L2-2 6 0 2 2 0 6-2 2-6 0-2-2Z');shape.setAttribute('fill','#e9a0b5');anchor.appendChild(shape);particles.appendChild(anchor);
        const animation=shape.animate([{transform:'translate(0,0) scale(.6)',opacity:1},{transform:`translate(${(i-2)*(celebrate?18:3)}px,${celebrate?-65-i%2*12:-28}px) scale(.6)`,opacity:0}],{duration:celebrate?900:550,easing:'ease-out'});
        animation.finished.then(()=>anchor.remove(),()=>anchor.remove());
      }
    }
    function updateMood() {
      if(disposed)return;
      const mood=frame.status==='listening'?scene.mood(Date.now()):'idle', blinking=(Date.now()-blinkStart)%5700<140;
      if(openEyes)openEyes.style.display=effects&&!reduced&&(mood==='joy'||mood==='love'||mood==='sleep'||blinking)?'none':'';
      root.className='kb-scene'+(pair?' kb-reference':'')+' mood-'+mood+(effects&&!reduced?'':' no-effects')+(frame.status==='paused'?' is-paused':'');
      message.textContent=labels[frame.status]||(mood==='love'?'给你一颗小爱心 ♡':mood==='sleep'?'等你回来…':'陪你敲敲 ♡');
    }
    function receive(next) {
      if(disposed||!next||!Number.isInteger(next.mask)||next.mask<0||next.mask>0xffffffff)return;
      frame=next;effects=next.effects!==false;
      const added=scene.update(next.status==='listening'?next.mask:0,Date.now());
      if(next.status!=='listening'){scene.clear();for(const timer of flashes.values())clearTimeout(timer);flashes.clear();}
      for(const id of added){clearTimeout(flashes.get(id));flashes.set(id,setTimeout(()=>{flashes.delete(id);if(!scene.active.includes(id))keyNodes.get(id).classList.remove('is-down');},110));}
      for(const[id,el]of keyNodes)el.classList.toggle('is-down',scene.active.includes(id)||flashes.has(id));
      if(!effects)particles.replaceChildren();
      for(const id of added)burst(id,id==='Enter');
      move();updateMood();clearTimeout(releaseTimer);releaseTimer=setTimeout(move,115);
    }
    const idleTimer=setInterval(updateMood,100);move();updateMood();
    return{receive,poke(){burst('Enter',true);scene.reaction='love';scene.reactionUntil=Date.now()+1200;updateMood();},dispose(){disposed=true;clearInterval(idleTimer);clearTimeout(releaseTimer);for(const timer of flashes.values())clearTimeout(timer);root.remove();}};
  }
  window.YierKeyboardScene={mount};
})();
