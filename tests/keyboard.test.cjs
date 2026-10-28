const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { KeyboardInput } = require('../desktop/keyboard-input.cjs');
const { IDS, KEYS, BY_ID, PAW_TIPS, project, keyPoint, pawPose, pressed, Scene } = require('../desktop/keyboard-model.js');
const menu = require('../desktop/menu-model.js');
const mask = (...ids) => ids.reduce((n, id) => n + 2 ** IDS.indexOf(id), 0);

test('the compact keyboard includes every letter and six useful keys, with matching physical positions', () => {
  assert.equal(KEYS.length, 32);
  assert.deepEqual(new Set(KEYS.map(k => k.id)), new Set(IDS));
  assert.equal(pressed(0xffffffff).length, 32);
  assert.deepEqual(pressed(0x80000000), ['Space']);
  for (const k of KEYS) {
    assert.ok(k.x >= 128 && k.x + k.w <= 512 && k.y + k.h <= 335, k.id);
    assert.equal(k.hand, k.id === 'Space' ? 'both' : k.x + k.w / 2 < 320 ? 'left' : 'right');
  }
});

test('each paw lands on its key; chords, held keys and releases preserve the other hand', () => {
  const scene = new Scene(0);
  assert.deepEqual(scene.update(mask('Q', 'P'), 100), ['P', 'Q']);
  assert.equal(scene.paw('left').x, keyPoint('Q', 'left').x);
  assert.equal(scene.paw('right').x, keyPoint('P', 'right').x);
  assert.deepEqual(scene.update(mask('Q', 'P'), 200), []);
  scene.update(mask('Q'), 300);
  assert.equal(scene.paw('left').down, true);
  assert.equal(scene.paw('right').down, false);
  scene.update(0, 400);
  assert.equal(scene.paw('left').down, false);
});

test('space alternates paws, Enter celebrates, idle sleeps and pause clears held keys', () => {
  const scene = new Scene(0);
  scene.update(mask('Space'), 100);
  assert.ok(scene.paw('left').x < scene.paw('right').x + 50);
  scene.update(0, 200); scene.update(mask('Space'), 300);
  assert.deepEqual({x:scene.paw('right').x,y:scene.paw('right').y},keyPoint('Space','right'));
  scene.update(mask('Enter'), 500);
  assert.equal(scene.mood(501), 'love');
  scene.update(0, 600);
  assert.equal(scene.mood(16000), 'sleep');
  scene.update(mask('A'), 17000); scene.clear();
  assert.deepEqual(scene.active, []);
});

test('paw fingertips contact the interior of every key on the same perspective plane', () => {
  for (const pet of ['yier', 'bubu']) for (const key of KEYS) for (const hand of key.hand === 'both' ? ['left', 'right'] : [key.hand]) {
    const point = keyPoint(key.id, hand), pose = pawPose(hand, point, pet), tip = PAW_TIPS[pet][hand];
    const edge1 = project(key.x, key.y + key.h / 2), edge2 = project(key.x + key.w, key.y + key.h / 2);
    assert.ok(point.x > edge1.x && point.x < edge2.x, key.id);
    assert.ok(Math.hypot(pose.end.x - pose.start.x, pose.end.y - pose.start.y) < 92, key.id + '/' + hand);
    assert.ok(Math.hypot((pose.end.x + tip.x) - point.x, (pose.end.y + tip.y) - point.y) < .001);
  }
});

test('very short physical taps stay visible briefly, then release without a stuck paw', () => {
  const scene = new Scene(0);
  scene.update(mask('Q'), 100); scene.update(0, 108);
  assert.equal(scene.paw('left', 125).down, true);
  assert.equal(scene.paw('left', 220).down, false);
  scene.update(mask('P'), 300); scene.clear();
  assert.equal(scene.paw('right', 305).down, false);
});

function fixture() {
  const frames = [], children = [], timers = new Map(); let next = 0, now = 0;
  function spawn(_exe, args, options) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
    child.stderr = { resume() {} }; child.killed = 0; child.kill = () => { child.killed++; };
    child.args = args; child.options = options; children.push(child); return child;
  }
  const input = new KeyboardInput(frame => frames.push(frame), { platform: 'win32', spawn, clock: () => now,
    setInterval: fn => { timers.set(++next, fn); return next; }, clearInterval: id => timers.delete(id) });
  return { input, children, frames, timers, time: value => { now = value; }, tick: () => [...timers.values()].forEach(fn => fn()) };
}

test('native stream handles split lines, high unsigned bits and rejects malformed frames', () => {
  const f = fixture(); f.input.configure({ enabled: true });
  const child = f.children[0];
  assert.equal(child.options.windowsHide, true);
  assert.deepEqual(child.options.stdio, ['ignore', 'pipe', 'pipe']);
  child.stdout.emit('data', '214748'); child.stdout.emit('data', '3648\r\ninvalid\n4294967296\n-1\n');
  assert.equal(f.input.frame.mask, 0x80000000);
  assert.equal(f.input.frame.status, 'listening');
  child.stdout.emit('data', '0\n'); assert.equal(f.input.frame.mask, 0);
  f.input.stop(); assert.equal(f.timers.size, 0);
});

test('pause kills the listener and clears keys; resume shares one process and effects do not restart it', () => {
  const f = fixture(); f.input.configure({ enabled: true }); f.input.configure({ enabled: true });
  assert.equal(f.children.length, 1);
  f.children[0].stdout.emit('data', '1\n');
  f.input.configure({ enabled: true, paused: true });
  assert.equal(f.children[0].killed, 1); assert.equal(f.input.frame.mask, 0);
  assert.equal(f.input.frame.status, 'paused');
  f.input.configure({ enabled: true });
  assert.equal(f.children.length, 2);
  f.input.configure({ enabled: true, effects: false });
  assert.equal(f.children.length, 2); assert.equal(f.input.frame.effects, false);
  f.input.configure({ enabled: false });
  assert.equal(f.children[1].killed, 1); assert.equal(f.input.frame.status, 'idle');
  f.children[1].stdout.emit('data', '1\n'); assert.equal(f.input.frame.mask, 0);
});

test('a dead helper clears keys, stops retrying, and can explicitly reconnect', () => {
  const f = fixture(); f.input.configure({ enabled: true });
  f.children[0].stdout.emit('data', '1\n'); f.time(6000); f.tick();
  assert.equal(f.input.frame.status, 'error'); assert.equal(f.input.frame.mask, 0);
  f.input.configure({ enabled: true }); assert.equal(f.children.length, 1);
  f.input.retry(); f.input.configure({ enabled: true }); assert.equal(f.children.length, 2);
  f.input.stop();
});

test('keyboard menu offers three checked role selections and hides roaming/actions during typing', () => {
  for (const role of ['pair', 'yier', 'bubu']) {
    const tree = menu.build({ mode: 'keyboard-' + role, keyboard: { paused: true, effects: false } });
    const roles = tree[0].children.find(item => item.children).children;
    assert.equal(roles.filter(item => item.label.startsWith('✓ ')).length, 1);
    assert.equal(roles.find(item => item.label.startsWith('✓ ')).action, 'yier-mode-keyboard-' + role);
    assert.equal(tree.find(item => item.action === 'yier-keyboard-pause').label, '继续键盘同步');
    assert.ok(!tree.some(item => item.action === 'yier-roam' || item.label.startsWith('动作')));
  }
  assert.ok(!menu.build({ mode: 'pair', platform: 'darwin' })[0].children.some(item => item.children));
});

test('all new mode definitions use only the requested role and mark keyboard modes explicitly', async () => {
  const { MODES } = await import('../scripts/runtime.mjs');
  assert.deepEqual(MODES['keyboard-pair'].pets, ['yier', 'bubu']);
  assert.deepEqual(MODES['keyboard-yier'].pets, ['yier']);
  assert.deepEqual(MODES['keyboard-bubu'].pets, ['bubu']);
  for (const name of ['keyboard-pair', 'keyboard-yier', 'keyboard-bubu']) assert.equal(MODES[name].keyboard, true);
});

test('reference sprite viewports stay within the pinned release image dimensions', () => {
  const art = require('../desktop/keyboard-art.js');
  for (const name of ['yier', 'bubu']) {
    for (const [x, y, w, h] of [...art[name].eyes, ...art[name].paws]) assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= art.width && y + h <= art.height);
  }
});
