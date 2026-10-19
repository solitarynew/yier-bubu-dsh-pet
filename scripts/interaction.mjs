/** Coordinates two independent renderer processes; no filesystem or Electron dependencies. */
export const SYNC_ROUTINES = [
  ['跳绳', 4500], ['收拾行李', 5000], ['躺着玩手机', 5100],
  ['玩具车', 5000], ['好累呀', 4700], ['坐着发呆', 5900],
].map(([name, duration]) => ({ kind: 'sync', label: '一起' + name,
  clips: { yier: name, bubu: name }, duration }));
export const DUO_ROUTINES = [
  ['抱抱', 5200], ['亲亲', 5200], ['一起自拍', 4700], ['背后抱', 4200],
].map(([name, duration]) => ({ kind: 'duo', label: name, duoAnim: name, duration }));
// Default: an obvious merged scene first, then a same-action scene; repeat with new clips.
export const ROUTINES = DUO_ROUTINES.flatMap((scene, index) => [scene, SYNC_ROUTINES[index]]);
export const INTERACTION_STYLES = ['mixed', 'duo', 'sync'];
export class InteractionCoordinator {
  constructor() { this.reset(); this.serial = 0; this.routine = 0; }
  reset() {
    this.peers = new Map(); this.session = null; this.nearSince = null;
    this.farSince = null; this.armed = true; this.cooldownUntil = 0;
  }
  configure(enabled, mode, style = 'mixed') {
    if (this.enabled !== enabled || this.mode !== mode || this.style !== style) { this.reset(); this.routine = 0; }
    this.enabled = enabled; this.mode = mode; this.style = style;
  }
  report(data, now = Date.now()) {
    if (!this.enabled || this.mode !== 'pair') return { enabled: this.enabled, session: null };
    const old = this.peers.get(data.pet);
    if (old && old.instance !== data.instance) this.reset(); // Helper reload: discard old windows.
    this.peers.set(data.pet, { ...data, seen: now });
    const a = this.peers.get('yier'), b = this.peers.get('bubu');
    const fresh = a && b && now - a.seen < 1500 && now - b.seen < 1500;
    if (!fresh) { this.session = null; this.nearSince = null; return this.result(); }
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    const size = Math.min(a.size, b.size);
    const near = dx <= size * 0.55 && dy <= size * 0.28;
    const far = dx > size * 0.8 || dy > size * 0.45;
    if (far) {
      this.farSince ??= now;
      if (now - this.farSince >= 1000) this.armed = true;
    } else this.farSince = null;
    if (this.session && (a.busy || b.busy || far || now >= this.session.endAt)) this.session = null;
    if (!near || a.busy || b.busy) this.nearSince = null;
    else if (!this.session && this.armed && now >= this.cooldownUntil) {
      this.nearSince ??= now;
      if (now - this.nearSince >= 800) {
        const pool = this.style === 'sync' ? SYNC_ROUTINES : this.style === 'duo' ? DUO_ROUTINES : ROUTINES;
        const routine = pool[this.routine++ % pool.length];
        const startAt = now + 600;
        this.session = { id: `${now}-${++this.serial}`, label: routine.label,
          kind: routine.kind, clips: routine.clips, duoAnim: routine.duoAnim,
          anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, startAt, endAt: startAt + routine.duration,
          facing: { yier: a.x < b.x ? 'right' : 'left', bubu: a.x < b.x ? 'left' : 'right' } };
        this.armed = false; this.cooldownUntil = startAt + routine.duration + 18000;
        this.nearSince = null;
      }
    }
    return this.result();
  }
  result() { return { enabled: this.enabled, session: this.session }; }
}
export function validReport(data) {
  return ['yier', 'bubu'].includes(data.pet) && typeof data.instance === 'string' &&
    data.instance.length > 0 && data.instance.length <= 80 && typeof data.busy === 'boolean' &&
    ['x', 'y', 'size'].every(key => typeof data[key] === 'number' && Number.isFinite(data[key])) &&
    Math.abs(data.x) <= 100000 && Math.abs(data.y) <= 100000 && data.size >= 32 && data.size <= 4096;
}
