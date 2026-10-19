'use strict';
(function () {
  const bridge = window.yierMenuBridge;
  const instance = Math.random().toString(36).slice(2) + '-' + Date.now();
  const busy = sprite => sprite.dragState.active || sprite.menuOpen || sprite.throwRef !== null ||
    Date.now() < (sprite._yierManualUntil || 0);
  function finish(sprite, resume, preservePosition = false) {
    const had = Boolean(sprite._yierInteraction);
    clearTimeout(sprite._yierStartTimer); clearTimeout(sprite._yierEndTimer);
    sprite._yierInteraction = null;
    const scene = sprite._yierScene;
    sprite._yierScene = null;
    if (scene) {
      sprite.assetBase = scene.assetBase;
      sprite.facing = scene.facing;
      sprite.el.style.visibility = scene.visibility;
      if (scene.hidden) bridge.setCompanionHidden(false);
      if (!sprite._yierDisposed) {
        if (!preservePosition) {
          sprite.customPos = scene.customPos;
          sprite.sendBounds(scene.pos.x, scene.pos.y);
        } else sprite.customPos = { rx: (sprite.pos.x + sprite.halfW) / VIEW.w,
          ry: (sprite.pos.y + sprite.halfH) / VIEW.h };
        // Restore the independent character even when a menu/drag interrupts a merged scene.
        sprite.playOnce(scene.anim);
      }
    }
    if (had && resume && !sprite._yierDisposed && !busy(sprite)) sprite.playIdle();
  }
  function interrupt(sprite) {
    sprite._yierManualUntil = Date.now() + 8000;
    finish(sprite, false, true);
  }
  function start(sprite, session) {
    // Preserve the live position; currentCenterX can still refer to a previous move's origin.
    sprite.customPos = { rx: (sprite.pos.x + sprite.halfW) / VIEW.w,
      ry: (sprite.pos.y + sprite.halfH) / VIEW.h };
    sprite.stopMove(); sprite.stopThrow();
    if (session.kind === 'duo') {
      const hidden = sprite.pet.id === 'bubu';
      sprite._yierScene = { hidden, assetBase: sprite.assetBase, facing: sprite.facing,
        visibility: sprite.el.style.visibility || '', anim: sprite.anim,
        customPos: { ...sprite.customPos }, pos: { ...sprite.pos } };
      if (hidden) {
        sprite.el.style.visibility = 'hidden';
        sprite.setInteractive(false);
        // Hiding the actual companion window also removes its invisible mouse hit area.
        bridge.setCompanionHidden(true, session.endAt - Date.now() + 1000);
      } else {
        sprite.assetBase = BASE + '/thumb/duo/';
        sprite.facing = 'left';
        sprite.customPos = { rx: (toLocal(session.anchor.x) - VIEW.x) / VIEW.w,
          ry: (toLocal(session.anchor.y) - VIEW.y) / VIEW.h };
        sprite.sendBounds(toLocal(session.anchor.x) - VIEW.x - sprite.halfW,
          toLocal(session.anchor.y) - VIEW.y - sprite.halfH);
        sprite.playOnce(session.duoAnim);
      }
    } else {
      sprite.facing = session.facing[sprite.pet.id];
      sprite.playOnce(session.clips[sprite.pet.id]);
    }
    sprite._yierEndTimer = setTimeout(() => finish(sprite, true), Math.max(0, session.endAt - Date.now()));
  }
  async function tick(sprite) {
    if (sprite._yierDisposed) return;
    try {
      const report = { pet: sprite.pet.id, instance, busy: busy(sprite), anim: sprite.anim,
        scene: sprite._yierInteraction?.kind || null, hidden: Boolean(sprite._yierScene?.hidden),
        x: toScreen(sprite.pos.x + sprite.halfW + VIEW.x),
        y: toScreen(sprite.pos.y + sprite.halfH + VIEW.y), size: toScreen(sprite.size) };
      const result = await bridge.reportInteraction(report);
      if (sprite._yierDisposed) return;
      sprite._yierInteractionEnabled = result.enabled;
      const session = result.session;
      if (!session || busy(sprite)) finish(sprite, true);
      else if (sprite._yierSeenSession !== session.id) {
        finish(sprite, false);
        sprite._yierSeenSession = session.id;
        sprite._yierInteraction = session;
        sprite._yierStartTimer = setTimeout(() => {
          if (busy(sprite) || sprite._yierDisposed || Date.now() >= session.endAt) {
            finish(sprite, true); return;
          }
          start(sprite, session);
        }, Math.max(0, session.startAt - Date.now()));
      }
    } catch (error) {
      // Local service unavailable: preserve normal desktop behavior and release any interaction.
      finish(sprite, true);
      if (!sprite._yierReportFailed) console.warn('[一二布布互动]', error.message);
      sprite._yierReportFailed = true;
    } finally {
      if (!sprite._yierDisposed) sprite._yierPoll = setTimeout(() => tick(sprite), 250);
    }
  }
  function initialize(sprite) {
    if (sprite._yierInteractionReady || !['yier', 'bubu'].includes(sprite.pet.id)) return;
    sprite._yierInteractionReady = true;
    sprite._yierInteractionEnabled = bridge.state().settings.interactionEnabled !== false;
    sprite._yierPoll = setTimeout(() => tick(sprite), 250);
  }
  window.YierInteraction = { interrupt, finish };
  const originalIdle = PetSprite.prototype.playIdle;
  PetSprite.prototype.playIdle = function () {
    initialize(this);
    if (this._yierInteraction && !busy(this)) return;
    return originalIdle.call(this);
  };
  const originalEnded = PetSprite.prototype.handleEnded;
  PetSprite.prototype.handleEnded = function () {
    if (this._yierInteraction && !busy(this)) return;
    return originalEnded.call(this);
  };
  // Explicit user actions always take priority, including a right-click action or dragging mid-scene.
  for (const method of ['onPointerDown', 'onContextMenu', 'onMenuAction']) {
    const original = PetSprite.prototype[method];
    PetSprite.prototype[method] = function (...args) { interrupt(this); return original.apply(this, args); };
  }
  const originalDispose = PetSprite.prototype.dispose;
  PetSprite.prototype.dispose = function () {
    this._yierDisposed = true; clearTimeout(this._yierPoll); finish(this, false);
    return originalDispose.call(this);
  };
})();
