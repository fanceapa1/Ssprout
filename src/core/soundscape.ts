/** Shared sound catalogue and browser-local mixes; no audio or DOM dependencies. */
export const SOUND_LAYERS = ['water', 'wind', 'birds', 'crickets', 'rain', 'waves', 'fire', 'cafe', 'lofi', 'white', 'brown'] as const;
export type SoundLayer = (typeof SOUND_LAYERS)[number];
export type SoundLevels = Record<SoundLayer, number>;
export const silentLevels = (): SoundLevels => Object.fromEntries(SOUND_LAYERS.map((id) => [id, 0])) as SoundLevels;
export const levelsWith = (levels: Partial<SoundLevels>): SoundLevels => ({ ...silentLevels(), ...levels });
export interface SceneryMix {
  mode: 'garden' | 'custom';
  levels: SoundLevels;
}
export interface SoundscapeSettings {
  collection: 'standard' | 'scenery';
  volume: number;
  standard: SoundLevels;
  sceneries: Partial<Record<SceneryId, SceneryMix>>;
}
export const STANDARD_LAYERS: readonly SoundLayer[] = ['rain', 'waves', 'wind', 'birds', 'fire', 'cafe', 'lofi', 'white', 'brown'];
/** Coast is a sound profile ready for a future scene, not an unlocked garden. */
export const SCENERIES = {
  pond: { name: 'The pond garden', layers: ['water', 'wind', 'birds', 'crickets', 'rain'], levels: levelsWith({ water: 70, wind: 45, birds: 40 }) },
  coast: { name: 'The seaside garden', layers: ['waves', 'wind', 'birds', 'rain'], levels: levelsWith({ waves: 75, wind: 45, birds: 25 }) },
} as const satisfies Record<string, { name: string; layers: readonly SoundLayer[]; levels: SoundLevels }>;
export type SceneryId = keyof typeof SCENERIES;
export function defaultSoundscape(): SoundscapeSettings {
  return { collection: 'scenery', volume: 100, standard: levelsWith({ rain: 55 }), sceneries: {} };
}
export function sceneryMix(s: SoundscapeSettings, id: SceneryId): SceneryMix {
  return s.sceneries[id] ?? { mode: 'garden', levels: { ...SCENERIES[id].levels } };
}
export function selectedMix(s: SoundscapeSettings, id: SceneryId): SceneryMix {
  return s.collection === 'standard' ? { mode: 'custom', levels: s.standard } : sceneryMix(s, id);
}
const percent = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
function isLevels(v: unknown): v is SoundLevels {
  return !!v && typeof v === 'object' && SOUND_LAYERS.every((id) => percent((v as SoundLevels)[id]));
}
export function isSoundscape(value: unknown): value is SoundscapeSettings {
  if (!value || typeof value !== 'object') return false;
  const s = value as SoundscapeSettings;
  return (s.collection === 'standard' || s.collection === 'scenery') && percent(s.volume) && isLevels(s.standard) &&
    !!s.sceneries && typeof s.sceneries === 'object' && !Array.isArray(s.sceneries) &&
    Object.entries(s.sceneries).every(([id, mix]) => Object.hasOwn(SCENERIES, id) && !!mix &&
      (mix.mode === 'garden' || mix.mode === 'custom') && isLevels(mix.levels));
}
export function copySoundscape(s: SoundscapeSettings): SoundscapeSettings {
  return { collection: s.collection, volume: s.volume, standard: { ...s.standard }, sceneries:
    Object.fromEntries(Object.entries(s.sceneries).map(([id, mix]) => [id, { mode: mix!.mode, levels: { ...mix!.levels } }])) };
}
export function sameSoundscape(a: SoundscapeSettings | undefined, b: SoundscapeSettings): boolean {
  return !!a && a.collection === b.collection && a.volume === b.volume &&
    SOUND_LAYERS.every((id) => a.standard[id] === b.standard[id]) &&
    (Object.keys(SCENERIES) as SceneryId[]).every((id) => {
      const x = a.sceneries[id], y = b.sceneries[id];
      return x === y || (!!x && !!y && x.mode === y.mode && SOUND_LAYERS.every((key) => x.levels[key] === y.levels[key]));
    });
}
export const SOUND_PRESETS = [
  { id: 'pond', name: 'By the pond', scenery: 'pond', levels: levelsWith({ water: 85, wind: 35, birds: 40 }) },
  { id: 'rain', name: 'Rain on the eaves', scenery: 'pond', levels: levelsWith({ water: 35, wind: 20, rain: 80 }) },
  { id: 'night', name: 'After dusk', scenery: 'pond', levels: levelsWith({ water: 50, wind: 20, crickets: 65 }) },
  { id: 'shore', name: 'Along the shore', scenery: 'coast', levels: levelsWith({ waves: 80, wind: 40, birds: 25 }) },
] as const;
