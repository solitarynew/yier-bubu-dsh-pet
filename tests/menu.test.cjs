const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../desktop/menu-model.js');
const tree = [{ label: '动作', children: [{ label: '开心', children: [
  { label: '比心', anim: '比心' }, { label: '撒花', anim: '撒花' },
] }] }];

test('exactly one mode is marked and its instance count is explicit', () => {
  for (const mode of ['pair', 'duo']) {
    const menu = model.build({ mode, pinned: null, anim: '比心', roam: true, actionTree: tree });
    const checked = menu[0].children.filter(item => item.label.startsWith('✓ '));
    assert.equal(checked.length, 1);
    assert.equal(checked[0].action, 'yier-mode-'+mode);
    assert.match(checked[0].label, mode === 'pair' ? /两个独立实例/ : /一个同框实例/);
  }
});

test('only the selected animation is marked without marking categories or mutating the tree', () => {
  const before = JSON.stringify(tree);
  const menu = model.build({ mode: 'pair', pinned: '比心', anim: '撒花', roam: false, actionTree: tree });
  const actions = menu.find(item => item.label.startsWith('动作'));
  assert.equal(actions.label, '动作 · 已选：比心');
  assert.equal(actions.children[0].label, '开心');
  assert.equal(actions.children[0].children[0].label, '✓ 比心');
  assert.equal(JSON.stringify(tree), before);
  assert.equal(menu[1].label.startsWith('✓ '), false);
});

function fake(preferences = {}) {
  class Sprite {
    constructor() {
      this.pet = { id: 'yier' }; this.anim = '待机'; this.menuOpen = false;
      this.dragState = { active: false }; this.played = []; this.originalEnded = 0;
      this.animations = { idle: ['待机'], turn: [], drag: [], clicks: ['比心'], categories: [], moves: { actions: [{name:'走路'}] } }; this.moveRef = 123;
    }
    handleEnded() { this.originalEnded++; }
    playIdle() { this.played.push('random'); }
    playOnce(name) { this.anim = name; this.played.push(name); }
    stopMove() { this.moveRef = null; }
    tryMove(name) { if (this.moveRef !== null) return true; this.anim = name; this.played.push(name); return name; }
  }
  const saved = [];
  const context = { PetSprite: Sprite, console, window: { YierMenuModel: model,
    yierMenuBridge: { state: () => ({ mode: 'pair', settings: { yier: preferences } }),
      saveSettings: async (pet, settings) => saved.push({ pet, settings }),
      setMode: async () => {}, quit: async () => {} } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../desktop/menu-addon.js'), 'utf8'), context);
  return { sprite: new Sprite(), addon: context.window.YierMenu, saved };
}

test('old pinned settings are ignored and upstream random playback is preserved', () => {
  const { sprite } = fake({ pinned: '比心', roam: false });
  sprite.playIdle();
  assert.equal(sprite._yierPinned, null);
  assert.equal(sprite.played.at(-1), 'random');
  sprite.handleEnded();
  assert.equal(sprite.originalEnded, 1);
});

test('menu selection stops old movement and delegates one-shot playback to upstream', () => {
  const { sprite, addon, saved } = fake();
  assert.equal(addon.handle(sprite, { anim: '走路' }), false);
  assert.equal(sprite.moveRef, null);
  assert.equal(sprite._yierPinned, null);
  assert.equal(saved.length, 0);
  sprite.handleEnded();
  assert.equal(sprite.originalEnded, 1);
});

test('actual duo config lists each of its 11 clips once with only one checked leaf', () => {
  const { animations } = require('../packs/duo-config.json');
  const menu = model.build({ mode: 'duo', pinned: '面对面', anim: '抱抱', roam: true, animations });
  const root = menu.find(item => item.label.startsWith('动作'));
  const leaves = root.children.flatMap(group => group.children);
  assert.equal(leaves.length, 11);
  assert.equal(new Set(leaves.map(item => item.anim)).size, 11);
  assert.equal(leaves.filter(item => item.label.startsWith('✓ ')).length, 1);
  assert.equal(root.children.some(group => /余额|工作状态|转向/.test(group.label)), false);
});


test('interaction toggle reflects enabled state and is present only for independent pair mode', () => {
  for (const enabled of [true, false]) {
    const menu = model.build({ mode: 'pair', interactionEnabled: enabled, anim: '比心', roam: true, actionTree: tree });
    assert.equal(menu.find(item => item.action === 'yier-interaction').label.startsWith('✓ '), enabled);
  }
  const menu = model.build({ mode: 'duo', anim: '比心', roam: true, actionTree: tree });
  assert.equal(menu.some(item => item.action === 'yier-interaction'), false);
});
