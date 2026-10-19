/** One size for both independent roles and the combined role. */
export const SIZE_PRESETS = [380, 490, 600];
export function sharedSize(preferences = {}, defaults = {}) {
  const size = preferences.sharedSize ?? defaults.size ?? 490;
  if (!Number.isFinite(size) || size < 240 || size > 900) throw Error('共享大小需要在 240–900 之间');
  return Math.round(size);
}
