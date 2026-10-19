'use strict';
(function () {
  const bridge = window.yierMenuBridge;
  const ACTIONS = {
    yier:{working:'打电脑',waiting:'歪头发呆',success:'比心',error:'气鼓鼓'},
    bubu:{working:'喝咖啡打电脑',waiting:'委屈巴巴',success:'撒花',error:'大哭'},
    duo:{working:'一起躺着玩手机',waiting:'面对面',success:'抱抱',error:'背后抱'},
  };
  const available = s => !s.dragState.active && !s.menuOpen && s.throwRef === null &&
    !s._yierInteraction && Date.now() >= (s._yierManualUntil || 0);
  function badge(sprite, text) {
    if (!sprite._yierStatusBadge) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:50%;top:12px;transform:translateX(-50%);padding:4px 9px;border-radius:10px;background:rgba(255,255,255,.93);color:#333;font:12px sans-serif;white-space:nowrap;pointer-events:none;z-index:8';
      sprite.el.appendChild(el); sprite._yierStatusBadge=el;
    }
    sprite._yierStatusBadge.textContent=text;
    sprite._yierStatusBadge.style.display=text?'block':'none';
  }
  function play(sprite) {
    const state=sprite._yierSyncDisplay;
    if(!state||!available(sprite))return false;
    const name=ACTIONS[sprite.pet.id]?.[state.state];
    if(!name)return false;
    sprite.stopMove(); sprite.playOnce(name); badge(sprite,state.label); return true;
  }
  async function poll(sprite) {
    if(sprite._yierStatusDisposed)return;
    try {
      const data=await bridge.pollStatus();
      if(sprite._yierStatusDisposed)return;
      const previous=sprite._yierSyncDisplay;
      sprite._yierSyncView=data.sources; sprite._yierSyncDisplay=data.display;
      if(!data.display) {
        badge(sprite,'');
        if(previous&&available(sprite))sprite.playIdle();
      } else if(available(sprite)) {
        badge(sprite,data.display.label);
        if(previous?.key!==data.display.key || sprite.anim!==ACTIONS[sprite.pet.id]?.[data.display.state])play(sprite);
      } else badge(sprite,'');
    } catch { const previous=sprite._yierSyncDisplay; sprite._yierSyncDisplay=null; badge(sprite,''); if(previous&&available(sprite))sprite.playIdle(); }
    finally {if(!sprite._yierStatusDisposed)sprite._yierStatusTimer=setTimeout(()=>poll(sprite),750);}
  }
  const originalIdle=PetSprite.prototype.playIdle;
  PetSprite.prototype.playIdle=function(){
    if(!this._yierStatusReady){this._yierStatusReady=true;this._yierStatusTimer=setTimeout(()=>poll(this),150);}
    if(play(this))return; return originalIdle.call(this);
  };
  const originalEnded=PetSprite.prototype.handleEnded;
  PetSprite.prototype.handleEnded=function(){if(play(this))return;return originalEnded.call(this);};
  const originalDispose=PetSprite.prototype.dispose;
  PetSprite.prototype.dispose=function(){this._yierStatusDisposed=true;clearTimeout(this._yierStatusTimer);this._yierStatusBadge?.remove();return originalDispose.call(this);};
})();
