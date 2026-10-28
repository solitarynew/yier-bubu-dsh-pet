'use strict';
(function () {
  const bridge = window.yierMenuBridge;
  const enabled = () => ['keyboard-pair', 'keyboard-yier', 'keyboard-bubu'].includes(bridge.state().mode);
  function initialize(sprite) {
    if (sprite._yierKeyboard || !enabled()) return sprite._yierKeyboard;
    sprite.stopMove(); sprite.stopThrow(); sprite.pet.fixedEnabled = true;
    sprite.anim = '键盘同步';
    sprite.stage.classList.add('is-keyboard');
    for (const video of [sprite.videoA, sprite.videoB]) { video.pause(); video.style.display = 'none'; }
    const scene = window.YierKeyboardScene.mount(sprite.stage, { pet: sprite.pet.id,
      effects: bridge.state().settings.keyboardEffects !== false });
    sprite._yierKeyboard = scene;
    sprite._yierKeyboardOff = bridge.onKeyboard(frame => { sprite._yierKeyboardView = frame; scene.receive(frame); });
    return scene;
  }
  const originalIdle = PetSprite.prototype.playIdle;
  PetSprite.prototype.playIdle = function () {
    if (initialize(this)) return;
    return originalIdle.call(this);
  };
  for (const method of ['playOnce', 'handleEnded']) {
    const original = PetSprite.prototype[method];
    PetSprite.prototype[method] = function (...args) {
      if (this._yierKeyboard) return;
      return original.apply(this, args);
    };
  }
  const originalClick = PetSprite.prototype.onClick;
  PetSprite.prototype.onClick = function (...args) {
    if (!this._yierKeyboard) return originalClick.apply(this, args);
    if (!this.dragState.active && !this.dragState.dragging && !this.justDragged) {
      this.stopThrow(); this.stopMove(); this._yierKeyboard.poke();
    }
  };
  const originalDispose = PetSprite.prototype.dispose;
  PetSprite.prototype.dispose = function () {
    this._yierKeyboardOff?.(); this._yierKeyboard?.dispose();
    this._yierKeyboard = null; this._yierKeyboardOff = null;
    return originalDispose.call(this);
  };
})();
