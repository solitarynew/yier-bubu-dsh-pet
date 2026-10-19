/** Coordinates two independent renderer processes; no filesystem or Electron dependencies. */
export const ROUTINES = [
  { label: '比心回应', clips: { yier: '比心', bubu: '撒花' }, duration: 4000 },
  { label: '想你啦', clips: { yier: '围巾舞', bubu: '看一二照片' }, duration: 3600 },
  { label: '一起跳绳', clips: { yier: '跳绳', bubu: '跳绳' }, duration: 4500 },
];
export class InteractionCoordinator {
  constructor() { this.reset(); this.serial = 0; this.routine = 0; }
  reset() {
    this.peers = new Map(); this.session = null; this.nearSince = null;
    this.farSince = null; this.armed = true; this.cooldownUntil = 0;
  }
  configure(enabled, mode) {
    if (this.enabled !== enabled || this.mode !== mode) this.reset();
    this.enabled = enabled; this.mode = mode;
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
        const routine = ROUTINES[this.routine++ % ROUTINES.length];
        const startAt = now + 600;
        this.session = { id: `${now}-${++this.serial}`, label: routine.label,
          clips: routine.clips, startAt, endAt: startAt + routine.duration,
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
