'use strict';
(function () {
  const bridge = window.yierMenuBridge;
  function initialize(sprite) {
    if (sprite._yierMenuReady) return;
    const pref = bridge.state().settings[sprite.pet.id] || {};
    sprite._yierPinned = null; // Original one-shot menu semantics; ignore older pinned settings.
    sprite._yierRoam = pref.roam !== false;
    sprite.pet.fixedEnabled = bridge.state().mode.startsWith('keyboard-') || !sprite._yierRoam;
    sprite._yierMenuReady = true;
  }
  function fail(sprite, error) {
    console.error('[一二布布菜单]', error);
    if (typeof sprite.showWhisper === 'function') {
      sprite.showWhisper('操作失败：' + error.message);
    }
  }
  function save(sprite) {
    return bridge.saveSettings(sprite.pet.id, { pinned: sprite._yierPinned, roam: sprite._yierRoam })
      .catch(error => fail(sprite, error));
  }
  window.YierMenu = {
    decorate(root) {
      for (const item of root.querySelectorAll('.dsh-pet-menu-item')) {
        item.setAttribute('role', 'menuitem');
        item.setAttribute('aria-label', item.firstElementChild.textContent.trim());
        if (item.classList.contains('dsh-pet-menu-branch')) {
          item.setAttribute('aria-haspopup', 'menu');
          item.addEventListener('click', () => item.dispatchEvent(new MouseEvent('mouseenter')));
        }
      }
    },
    build(sprite, actionTree) {
      initialize(sprite);
      const settings=bridge.state().settings;
      const syncView=sprite._yierSyncView || Object.fromEntries([['codex','syncCodex'],['dsh','syncDsh']].map(([source,key])=>
        [source,{enabled:settings[key]===true,label:settings[key]===true?'等待连接':'已关闭'}]));
      return window.YierMenuModel.build({ mode: bridge.state().mode, pinned: sprite._yierPinned,
        platform: bridge.state().platform, keyboard: { paused: settings.keyboardPaused === true, effects: settings.keyboardEffects !== false, status: sprite._yierKeyboardView?.status },
        interactionStyle: bridge.state().settings.interactionStyle || 'mixed', interactionEnabled: bridge.state().settings.interactionEnabled !== false, statusSync: syncView, size: sprite.size, anim: sprite.anim, roam: sprite._yierRoam, animations: sprite.animations, actionTree });
    },
    handle(sprite, leaf) {
      initialize(sprite);
      if (leaf.anim) {
        sprite.stopMove(); // A new movement selection must not be swallowed by an old move.
        return false; // Upstream plays the chosen clip once, then resumes its normal state machine.
      }
      if (leaf.action?.startsWith('yier-mode-')) {
        bridge.setMode(leaf.action.slice('yier-mode-'.length)).catch(error => fail(sprite, error));
      } else if (leaf.action === 'yier-keyboard-retry') {
        bridge.retryKeyboard();
      } else if (leaf.action === 'yier-keyboard-pause' || leaf.action === 'yier-keyboard-effects') {
        const paused = leaf.action === 'yier-keyboard-pause';
        const settings = bridge.state().settings;
        bridge.setKeyboardSetting(paused ? 'paused' : 'effects', paused ? settings.keyboardPaused !== true : settings.keyboardEffects === false)
          .catch(error => fail(sprite, error));
      } else if (leaf.action === 'yier-sync-settings') {
        bridge.openSyncSettings();
      } else if (leaf.action === 'yier-sync-codex' || leaf.action === 'yier-sync-dsh') {
        const source=leaf.action.slice('yier-sync-'.length);
        const enabled=bridge.state().settings[source==='codex'?'syncCodex':'syncDsh'] !== true;
        bridge.setStatusSync(source,enabled).then(data=>{sprite._yierSyncView=data.sources;}).catch(error=>fail(sprite,error));
      } else if (leaf.action?.startsWith('yier-size-')) {
        bridge.setSize(Number(leaf.action.slice('yier-size-'.length))).catch(error => fail(sprite, error));
      } else if (leaf.action?.startsWith('yier-style-')) {
        bridge.setInteractionStyle(leaf.action.slice('yier-style-'.length)).catch(error => fail(sprite, error));
      } else if (leaf.action === 'yier-interaction') {
        const enabled = bridge.state().settings.interactionEnabled === false;
        bridge.setInteraction(enabled).catch(error => fail(sprite, error));
      } else if (leaf.action === 'yier-roam') {
        sprite._yierRoam = !sprite._yierRoam;
        sprite.pet.fixedEnabled = !sprite._yierRoam;
        if (!sprite._yierRoam) sprite.stopMove();
        save(sprite);
      } else if (leaf.action === 'yier-quit') {
        bridge.quit().catch(error => fail(sprite, error));
      } else return false;
      return true;
    },
  };
  const originalIdle = PetSprite.prototype.playIdle;
  PetSprite.prototype.playIdle = function () {
    initialize(this);
    return originalIdle.call(this);
  };
})();
