'use strict';
(function () {
  const { KEYS, BY_ID, MATRIX, project, pawPose, Scene } = window.YierKeyboardModel;
  const ART = window.YierKeyboardArt;
  const scriptURL = document.currentScript.src;
  const isSourcePreview = /\/desktop\/keyboard-scene\.js$/.test(new URL(scriptURL).pathname);
  const artBase = new URL(isSourcePreview ? (location.protocol === 'file:' ? '../.runtime/keyboard-reference/' : '../keyboard-assets/') : 'keyboard-art/', scriptURL).href;
  const imageTag = file => `<image href="${new URL(file, artBase).href}" width="${ART.width}" height="${ART.height}"/>`;
  let sequence = 0;
  const NS = 'http://www.w3.org/2000/svg';
  const heart = 'M0 4C-13-5-10-14-3-11L0-8 3-11C10-14 13-5 0 4Z';
  const labels = { starting: '连接键盘中…', paused: '休息一下 ♡', error: '右键重新连接', unavailable: '需要 Windows', idle: '同步已关闭' };
  function mount(container, { pet = 'yier', effects = true } = {}) {
    const brown = pet === 'bubu';
    const fur = brown ? '#e9b797' : '#fffefe';
    const ink = '#4e2b1d';
    const art = ART[pet], prefix = 'kb-' + (++sequence);
    const patchedCorner = brown ? `<path d="M800 320 L848 330 C857 359 840 411 817 473 C797 513 749 540 709 545 L680 530 C763 505 792 450 800 320 Z" fill="#e8b696"/><path d="M848 330 C855 365 845 413 827 448 C806 491 761 531 709 545" fill="none" stroke="#4e260f" stroke-width="13"/>` : '';
    const chin = brown ? `<path d="M355 489 C455 529 565 571 680 554 C740 549 786 522 818 488" fill="none" stroke="#4e260f" stroke-width="11" stroke-linecap="round"/>` : '';
    const root = document.createElement('div');
    root.className = 'kb-scene';
    root.style.cssText = brown
      ? '--key:#fffcf0;--key-stroke:#d9bd94;--accent:#c3ded0;--accent-edge:#76a995'
      : '--key:#fffbfc;--key-stroke:#e8bdc6;--accent:#f8bdcc;--accent-edge:#db8caa';
    root.innerHTML = `<svg viewBox="0 0 640 360" role="img" aria-label="${brown ? '布布' : '一二'}的同步小键盘">
      <defs><clipPath id="${prefix}-body"><path d="${art.outline}"/></clipPath><clipPath id="${prefix}-source"><path d="${art.sourceClip || art.outline}"/></clipPath><clipPath id="${prefix}-eyes">${art.eyes.map(([x,y,w,h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}"/>`).join('')}</clipPath></defs>
      <g class="kb-composition">
      <ellipse cx="313" cy="316" rx="128" ry="7" fill="#765242" opacity=".08"/>
      <g class="kb-arms" fill="none" stroke-linecap="round"><path data-arm="left" stroke="${ink}" stroke-width="19"/><path data-arm="left" stroke="${fur}" stroke-width="14"/><path data-arm="right" stroke="${ink}" stroke-width="19"/><path data-arm="right" stroke="${fur}" stroke-width="14"/></g>
      <path d="M271 187 Q326 212 386 215 Q398 226 399 246 L253 198 Q259 190 271 187 Z" fill="${fur}" stroke="${ink}" stroke-width="2.8" stroke-linejoin="round"/>
      <g class="kb-head"><g transform="${art.transform}"><g clip-path="url(#${prefix}-body)">${patchedCorner}<g clip-path="url(#${prefix}-source)">${imageTag('compact-cleanplate.png')}</g>${chin}<g class="kb-open-eyes" clip-path="url(#${prefix}-eyes)">${imageTag('compact-scene.png')}</g></g></g></g>
      <g class="kb-zzz" fill="#a393bd" font-size="17" font-weight="700"><text x="405" y="86">z</text><text x="421" y="68" font-size="13">z</text></g>
      <g class="kb-love" transform="translate(415 106) scale(.85)"><path d="${heart}" fill="#e9a0b5"/></g>
      <rect x="234" y="2" width="172" height="24" rx="12" fill="#fffcf6" stroke="#e8d8cc" stroke-width="1" opacity=".96"/>
      <text class="kb-message" x="320" y="18"></text>
      <g class="kb-board" transform="matrix(${MATRIX.join(' ')})">
      <rect x="132" y="215" width="376" height="126" rx="16" fill="#e7d5c2" stroke="${ink}" stroke-width="4"/>
      <rect x="132" y="205" width="376" height="126" rx="16" fill="#fff5e7" stroke="${ink}" stroke-width="4"/>
      <g class="kb-keys">${KEYS.map(k => `<g class="kb-key" data-key="${k.id}"><rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="5"/><text x="${k.x + k.w / 2}" y="${k.y + k.h / 2 + .6}"${k.id === 'Space' ? ' style="font-size:8px;letter-spacing:3px"' : ''}>${k.label}</text></g>`).join('')}</g>
      <text class="kb-hint" x="320" y="328">${brown ? 'BUBU · 布布' : 'YIER · 一二'}</text>
      </g>
      ${['left', 'right'].map((hand, index) => `<g data-paw="${hand}"><svg class="kb-art" x="-20" y="-16" width="40" height="30" viewBox="${art.paws[index].join(' ')}" preserveAspectRatio="none">${imageTag('compact-paws.png')}</svg></g>`).join('')}
      <g class="kb-particles"></g>
      </g>
    </svg>`;
    container.appendChild(root);
    const scene = new Scene();
    const message = root.querySelector('.kb-message');
    const openEyes = root.querySelector('.kb-open-eyes');
    const blinkStart = Date.now();
    const particles = root.querySelector('.kb-particles');
    const keyNodes = new Map([...root.querySelectorAll('.kb-key')].map(el => [el.dataset.key, el]));
    const paws = Object.fromEntries(['left', 'right'].map(hand => [hand, root.querySelector(`[data-paw="${hand}"]`)]));
    const arms = Object.fromEntries(['left', 'right'].map(hand => [hand, [...root.querySelectorAll(`[data-arm="${hand}"]`)]]));
    let frame = { status: 'starting', mask: 0 }, disposed = false, releaseTimer;
    const flashes = new Map();
    let lastBurst = 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    function draw(hand, pos) {
      const { start, control, end, contact } = pawPose(hand, pos, pet);
      paws[hand].setAttribute('transform', `translate(${end.x.toFixed(2)} ${end.y.toFixed(2)})`);
      paws[hand].dataset.contact = `${contact.x},${contact.y}`;
      const d = `M${start.x} ${start.y}Q${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
      for (const arm of arms[hand]) arm.setAttribute('d', d);
    }
    function move() {
      if (disposed) return;
      for (const hand of ['left', 'right']) {
        draw(hand, scene.paw(hand));
      }
    }
    function burst(id, celebrate = false) {
      if (!effects || reduced || disposed) return;
      const key = BY_ID[id] || BY_ID.Enter;
      const now = Date.now();
      if (!celebrate && now - lastBurst < 65) return;
      lastBurst = now;
      for (let i = 0; i < (celebrate ? 5 : 1); i++) {
        while (particles.childElementCount >= 16) particles.firstElementChild.remove();
        const anchor = document.createElementNS(NS, 'g'), shape = document.createElementNS(NS, 'path');
        const contact = project(key.x + key.w / 2, key.y);
        anchor.setAttribute('transform', `translate(${contact.x} ${contact.y})`);
        shape.setAttribute('d', celebrate ? heart : 'M0-6L2-2 6 0 2 2 0 6-2 2-6 0-2-2Z');
        shape.setAttribute('fill', brown ? '#e8bd70' : '#e9a0b5'); anchor.appendChild(shape); particles.appendChild(anchor);
        const animation = shape.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 1 },
          { transform: `translate(${(i - 2) * (celebrate ? 18 : 3)}px,${celebrate ? -65 - i % 2 * 12 : -28}px) scale(${celebrate ? .7 : .4})`, opacity: 0 }],
          { duration: celebrate ? 900 : 550, easing: 'ease-out' });
        animation.finished.then(() => anchor.remove(), () => anchor.remove());
      }
    }
    function updateMood() {
      if (disposed) return;
      const mood = frame.status === 'listening' ? scene.mood(Date.now()) : 'idle';
      const blinking = effects && !reduced && (Date.now() - blinkStart) % 5700 < 140;
      openEyes.style.display = effects && !reduced && (mood === 'joy' || mood === 'love' || mood === 'sleep' || blinking) ? 'none' : '';
      root.className = 'kb-scene mood-' + mood + (effects && !reduced ? '' : ' no-effects') + (frame.status === 'paused' ? ' is-paused' : '');
      const text = labels[frame.status] || (mood === 'love' ? '给你一颗小爱心 ♡' : mood === 'joy' ? '敲敲敲，一起加油！' : mood === 'sleep' ? '等你回来…' : mood === 'think' ? '慢慢来，没关系' : '陪你敲敲 ♡');
      if (message.textContent !== text) message.textContent = text;
    }
    function receive(next) {
      if (disposed || !next || !Number.isInteger(next.mask) || next.mask < 0 || next.mask > 0xffffffff) return;
      frame = next; effects = next.effects !== false;
      const added = scene.update(next.status === 'listening' ? next.mask : 0, Date.now());
      if (next.status !== 'listening') { scene.clear(); for (const timer of flashes.values()) clearTimeout(timer); flashes.clear(); }
      for (const id of added) {
        clearTimeout(flashes.get(id));
        flashes.set(id, setTimeout(() => { flashes.delete(id); if (!scene.active.includes(id)) keyNodes.get(id).classList.remove('is-down'); }, 110));
      }
      for (const [id, el] of keyNodes) el.classList.toggle('is-down', scene.active.includes(id) || flashes.has(id));
      if (!effects) particles.replaceChildren();
      for (const id of added) burst(id, id === 'Enter');
      move(); updateMood(); clearTimeout(releaseTimer); releaseTimer = setTimeout(move, 115);
    }
    const idleTimer = setInterval(updateMood, 100);
    move(); updateMood();
    return { receive, poke() { burst('Enter', true); scene.reaction = 'love'; scene.reactionUntil = Date.now() + 1200; updateMood(); },
      dispose() { disposed = true; clearInterval(idleTimer); clearTimeout(releaseTimer); for (const timer of flashes.values()) clearTimeout(timer); root.remove(); } };
  }
  window.YierKeyboardScene = { mount };
})();
