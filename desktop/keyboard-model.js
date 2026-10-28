(function (root) {
  'use strict';
  const IDS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Backspace', 'Tab', 'Enter', 'Shift', 'Escape', 'Space'];
  const rows = [
    [...'QWERTYUIOP', ['Backspace', '⌫', 44]],
    [['Tab', '⇥', 30], ...'ASDFGHJKL', ['Enter', '↵', 40]],
    [['Shift', '⇧', 44], ...'ZXCVBNM', ['Escape', 'esc', 44]],
    [['Space', 'SPACE', 194]],
  ];
  const KEYS = rows.flatMap((row, r) => {
    const items = row.map(k => typeof k === 'string' ? [k, k, 28] : k);
    const width = items.reduce((sum, k) => sum + k[2], 0) + (items.length - 1) * 3;
    let x = (640 - width) / 2;
    return items.map(([id, label, w]) => { const key = { id, label, x, y: 216 + r * 29, w, h: 24, hand: id === 'Space' ? 'both' : x + w / 2 < 320 ? 'left' : 'right' }; x += w + 3; return key; });
  });
  const BY_ID = Object.fromEntries(KEYS.map(k => [k.id, k]));
  // One plane shared by keycaps and paw contacts, matching the reference's down-right view.
  const MATRIX = [195 / 376, 55 / 376, -46 / 126, 44 / 126,
    235 - 132 * 195 / 376 + 205 * 46 / 126, 218 - 132 * 55 / 376 - 205 * 44 / 126];
  const project = (x, y) => ({ x: MATRIX[0] * x + MATRIX[2] * y + MATRIX[4], y: MATRIX[1] * x + MATRIX[3] * y + MATRIX[5] });
  const SHOULDERS = { left: { x: 287, y: 199 }, right: { x: 377, y: 229 } };
  function keyPoint(id, hand) {
    const key = BY_ID[id];
    // Both sides of the wide space bar are valid contacts, within each short arm's reach.
    const x = id === 'Space' ? key.x + key.w * (hand === 'left' ? .2 : .8) : key.x + key.w / 2;
    return project(x, key.y + key.h / 2);
  }
  const PAW_TIPS = { yier: { left: { x: 1.5, y: 12.2 }, right: { x: 2.9, y: 11.2 } }, bubu: { left: { x: -3, y: 12.1 }, right: { x: -3, y: 12.1 } } };
  function pawPose(hand, contact, pet = 'yier') {
    // The bottom of the mitten touches the key, rather than putting its centre on the key.
    const tip = PAW_TIPS[pet][hand];
    const end = { x: contact.x - tip.x, y: contact.y - tip.y };
    const start = SHOULDERS[hand];
    const control = { x: (start.x + end.x) / 2 + (hand === 'left' ? -5 : 5), y: (start.y + end.y) / 2 - 3 };
    return { start, control, end, contact };
  }
  const pressed = mask => IDS.filter((_id, index) => ((mask >>> index) & 1) === 1);
  class Scene {
    constructor(now = Date.now()) {
      this.active = []; this.lastAt = now - 5000; this.startedAt = now;
      this.recent = []; this.reaction = ''; this.reactionUntil = 0; this.spaceHand = 'right';
      this.latched = {};
    }
    update(mask, now) {
      const next = pressed(mask);
      const added = next.filter(id => !this.active.includes(id));
      this.active = this.active.filter(id => next.includes(id)).concat(added);
      if (added.length) {
        this.lastAt = now;
        this.recent = this.recent.filter(at => now - at < 1200).concat(added.map(() => now));
        if (added.includes('Space')) this.spaceHand = this.spaceHand === 'left' ? 'right' : 'left';
        for (const id of added) {
          const key = BY_ID[id], hand = id === 'Space' ? this.spaceHand : key.hand;
          this.latched[hand] = { ...keyPoint(id, hand), down: true, until: now + 110 };
        }
        this.reaction = added.includes('Enter') ? 'love' : added.includes('Backspace') ? 'think' : this.recent.length >= 7 ? 'joy' : 'focus';
        this.reactionUntil = now + (this.reaction === 'love' ? 1200 : 800);
      }
      return added;
    }
    paw(hand, now = Date.now()) {
      const id = [...this.active].reverse().find(id => BY_ID[id].hand === hand || (id === 'Space' && this.spaceHand === hand));
      const key = BY_ID[id];
      return key ? { ...keyPoint(id, hand), down: true }
        : this.latched[hand]?.until > now ? this.latched[hand] : { ...keyPoint(hand === 'left' ? 'F' : 'J', hand), down: false };
    }
    mood(now) {
      if (this.active.length) return this.reactionUntil > now ? this.reaction : 'focus';
      if (now - this.lastAt > 15000) return 'sleep';
      return this.reactionUntil > now ? this.reaction : 'idle';
    }
    clear() { this.active = []; this.latched = {}; this.recent = []; this.reactionUntil = 0; }
  }
  const api = { IDS, KEYS, BY_ID, MATRIX, project, SHOULDERS, PAW_TIPS, keyPoint, pawPose, pressed, Scene };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YierKeyboardModel = api;
})(typeof window === 'undefined' ? globalThis : window);
