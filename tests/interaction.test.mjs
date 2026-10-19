import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { InteractionCoordinator, ROUTINES, validReport } from '../scripts/interaction.mjs';
const peer = (pet, x = 0, busy = false, instance = pet) => ({ pet, x, y: 300, size: 490, busy, instance });
function send(c, t, x = 220, busy = false) {
  c.report(peer('yier'), t);
  return c.report(peer('bubu', x, busy), t);
}
function ready() { const c = new InteractionCoordinator(); c.configure(true, 'pair'); return c; }
test('nearby dwell creates one shared session, using only real character clips', () => {
  const c = ready();
  assert.equal(send(c, 1000).session, null);
  assert.equal(send(c, 1700).session, null);
  const { session } = send(c, 1850);
  assert.ok(session);
  assert.equal(session.facing.yier, 'right'); assert.equal(session.facing.bubu, 'left');
  assert.equal(c.report(peer('yier'), 1900).session.id, session.id);
  assert.ok(session.startAt > 1900);
  for (const routine of ROUTINES) for (const [pack, name] of Object.entries(routine.clips)) {
    assert.ok(fs.existsSync(new URL(`../packs/${pack}-animation/${name}.webm`, import.meta.url)));
  }
});
test('remaining close does not retrigger; departure and cooldown are both required', () => {
  const c = ready(); send(c, 1000); const first = send(c, 1900).session;
  for (let t = 2000; t < 40000; t += 500) send(c, t);
  assert.equal(c.session, null);
  send(c, 40000, 600); send(c, 41100, 600);
  send(c, 42000); const second = send(c, 42900).session;
  assert.ok(second); assert.notEqual(first.id, second.id);
});
test('dragging, menu use, stale reports and vertical distance prevent interaction', () => {
  for (const type of ['busy', 'stale', 'vertical']) {
    const c = ready();
    for (let t = 1000; t < 4000; t += 250) {
      if (type === 'stale' && t === 1000) c.report(peer('yier'), t - 2000);
      else if (type !== 'stale') c.report(peer('yier'), t);
      c.report({ ...peer('bubu', 220, type === 'busy'), y: type === 'vertical' ? 800 : 300 }, t);
      assert.equal(c.session, null);
    }
  }
});
test('switching off, switching mode or taking control cancels an active session', () => {
  for (const type of ['off', 'duo', 'manual']) {
    const c = ready(); send(c, 1000); assert.ok(send(c, 1900).session);
    if (type === 'manual') c.report(peer('yier', 0, true), 2000);
    else c.configure(type !== 'off', type === 'duo' ? 'duo' : 'pair');
    assert.equal(c.session, null);
  }
});
test('new helper instances cannot reuse a previous helper session', () => {
  const c = ready(); send(c, 1000); assert.ok(send(c, 1900).session);
  assert.equal(c.report(peer('yier', 0, false, 'replacement'), 2000).session, null);
});
test('report validation rejects invalid coordinates and unrelated pets', () => {
  assert.equal(validReport(peer('yier')), true);
  for (const change of [{pet:'duo'}, {x:NaN}, {x:Infinity}, {busy:'false'}, {size:-1}, {instance:''}]) {
    assert.equal(validReport({...peer('yier'), ...change}), false);
  }
});
