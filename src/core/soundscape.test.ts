import { describe, expect, it } from 'vitest';
import { exportState, importState, validateState } from './persistence';
import { copySoundscape, defaultSoundscape, isSoundscape, levelsWith, readSoundscape, SCENERIES, sceneryMix, selectedMix, SOUND_LAYERS, SOUND_PRESETS, STANDARD_LAYERS } from './soundscape';
import { createDefaultState, mergeSettings, STATE_VERSION } from './state';

describe('sound collections', () => {
  it('keeps a Standard mix across sceneries and restores each scenery’s own mix', () => {
    const s = defaultSoundscape();
    s.standard = levelsWith({ cafe: 45, lofi: 30 });
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ water: 80, rain: 20 }) };
    s.sceneries.coast = { mode: 'custom', levels: levelsWith({ sea: 60 }) };
    expect(selectedMix(s, 'pond').levels.water).toBe(80);
    expect(selectedMix(s, 'coast').levels.sea).toBe(60);
    s.collection = 'standard';
    expect(selectedMix(s, 'pond')).toEqual(selectedMix(s, 'coast'));
    expect(selectedMix(s, 'pond').levels.cafe).toBe(45);
    s.collection = 'scenery';
    expect(selectedMix(s, 'pond').levels.water).toBe(80);
  });

  it('follows the garden by default, with a distinct coastal profile', () => {
    const s = defaultSoundscape();
    expect(sceneryMix(s, 'pond').mode).toBe('garden');
    expect(sceneryMix(s, 'coast').levels.sea).toBeGreaterThan(0);
    const copy = copySoundscape(s);
    copy.standard.rain = 1;
    expect(s.standard.rain).toBe(55);
  });

  it('the waterfall has its own palette with the falls, and a saved mix from before it reads the falls as off', () => {
    const s = defaultSoundscape();
    expect(sceneryMix(s, 'waterfall')).toEqual({ mode: 'garden', levels: levelsWith({ falls: 70, wind: 30, birds: 40 }) });
    expect(SCENERIES.waterfall.layers).toContain('falls');
    expect(SCENERIES.waterfall.layers).not.toContain('water');
    expect(SCENERIES.pond.layers).not.toContain('falls');
    expect(STANDARD_LAYERS).not.toContain('falls');
    const { falls: _f, ...before } = levelsWith({ water: 60 });
    const read = readSoundscape({ ...s, sceneries: { pond: { mode: 'custom', levels: before } } })!;
    expect(read.sceneries.pond!.levels.falls).toBe(0);
    expect(SOUND_PRESETS.filter((p) => p.scenery === 'waterfall').every((p) => p.levels.falls > 0)).toBe(true);
  });

  it('the oasis has its own palette, the seguia and the palms, and its own two presets (ADR 0303)', () => {
    const s = defaultSoundscape();
    expect(sceneryMix(s, 'oasis')).toEqual({ mode: 'garden', levels: levelsWith({ seguia: 60, palms: 45, birds: 40 }) });
    expect(SCENERIES.oasis.layers).toEqual(['seguia', 'palms', 'birds', 'crickets', 'rain']);
    for (const id of ['pond', 'coast', 'waterfall'] as const) {
      expect(SCENERIES[id].layers).not.toContain('seguia');
      expect(SCENERIES[id].layers).not.toContain('palms');
    }
    expect(STANDARD_LAYERS).not.toContain('seguia');
    expect(STANDARD_LAYERS).not.toContain('palms');
    const presets = SOUND_PRESETS.filter((p) => p.scenery === 'oasis');
    expect(presets).toHaveLength(2);
    for (const p of presets) expect(p.levels.seguia).toBeGreaterThan(0);
  });

  it('a mix saved before the oasis loads: no oasis entry, no seguia or palms levels (no schema change)', () => {
    const { seguia: _s, palms: _p, ...before } = levelsWith({ falls: 70, wind: 30 });
    const saved = { collection: 'scenery', volume: 80, standard: before, sceneries: { waterfall: { mode: 'custom', levels: before } } };
    const read = readSoundscape(saved)!;
    expect(read).not.toBeNull();
    expect(read.sceneries.oasis).toBeUndefined();
    expect(read.sceneries.waterfall!.levels).toEqual(levelsWith({ falls: 70, wind: 30 }));
    expect(read.standard.seguia + read.standard.palms).toBe(0);
    // the oasis then follows the garden until its own mix is made
    expect(selectedMix(read, 'oasis').mode).toBe('garden');
    const state = createDefaultState(1234);
    const doc = JSON.parse(exportState(state, 1234)) as { state: { settings: Record<string, unknown> } };
    doc.state.settings.soundscape = saved;
    const imported = importState(JSON.stringify(doc));
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.state.settings.soundscape).toEqual(read);
  });

  it('an oasis mix round-trips through a garden export', () => {
    const state = createDefaultState(1234);
    state.settings.soundscape = defaultSoundscape();
    state.settings.soundscape.sceneries.oasis = { mode: 'custom', levels: levelsWith({ seguia: 72, palms: 31, crickets: 12 }) };
    const result = importState(exportState(state, 1234));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.settings.soundscape).toEqual(state.settings.soundscape);
    expect(isSoundscape(state.settings.soundscape)).toBe(true);
  });

  it('the coast has its own palette, the sea and the cicadas, and its own two presets (ADR 0376)', () => {
    const s = defaultSoundscape();
    expect(sceneryMix(s, 'coast')).toEqual({ mode: 'garden', levels: levelsWith({ sea: 70, wind: 35, cicadas: 30, birds: 35, crickets: 30 }) });
    expect(SCENERIES.coast.layers).toEqual(['sea', 'wind', 'cicadas', 'birds', 'crickets', 'rain']);
    for (const id of ['pond', 'waterfall', 'oasis'] as const) {
      expect(SCENERIES[id].layers).not.toContain('sea');
      expect(SCENERIES[id].layers).not.toContain('cicadas');
    }
    expect(STANDARD_LAYERS).not.toContain('sea');
    expect(STANDARD_LAYERS).not.toContain('cicadas');
    const presets = SOUND_PRESETS.filter((p) => p.scenery === 'coast');
    expect(presets.map((p) => p.name)).toEqual(['Along the shore', 'A still night on the cove']);
    for (const p of presets) expect(p.levels.sea).toBeGreaterThan(0);
  });

  it('a coast mix saved before its sound bed loads with the sea and cicadas off (no schema change)', () => {
    const { sea: _s, cicadas: _c, ...before } = levelsWith({ waves: 63, wind: 40, birds: 25 });
    const saved = { collection: 'scenery', volume: 90, standard: before, sceneries: { coast: { mode: 'custom', levels: before } } };
    const read = readSoundscape(saved)!;
    expect(read).not.toBeNull();
    expect(read.sceneries.coast!.levels).toEqual(levelsWith({ waves: 63, wind: 40, birds: 25 }));
    expect(read.standard.sea + read.standard.cicadas).toBe(0);
    const state = createDefaultState(1234);
    const doc = JSON.parse(exportState(state, 1234)) as { state: { settings: Record<string, unknown> } };
    doc.state.settings.soundscape = saved;
    const imported = importState(JSON.stringify(doc));
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.state.settings.soundscape).toEqual(read);
  });

  it('rejects invalid levels, collections, incomplete mixes and unknown scenery keys', () => {
    const s = defaultSoundscape();
    for (const value of [-1, 101, NaN, Infinity, '50', null]) {
      expect(isSoundscape({ ...s, volume: value })).toBe(false);
      expect(isSoundscape({ ...s, standard: { ...s.standard, lofi: value } })).toBe(false);
    }
    expect(isSoundscape({ ...s, collection: 'unknown' })).toBe(false);
    expect(isSoundscape({ ...s, standard: { rain: 50 } })).toBe(false);
    expect(isSoundscape({ ...s, sceneries: { unknown: { mode: 'custom', levels: s.standard } } })).toBe(false);
    expect(isSoundscape({ ...s, sceneries: { pond: null } })).toBe(false);
    expect(isSoundscape(s)).toBe(true);
  });

  it('merges only valid changes and owns nested preferences', () => {
    const current = createDefaultState(0).settings;
    const s = defaultSoundscape();
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ birds: 35 }) };
    const changed = mergeSettings(current, { soundscape: s });
    expect(changed.soundscape).toEqual(s);
    expect(mergeSettings(changed, { soundscape: copySoundscape(s) })).toBe(changed);
    s.sceneries.pond.levels.birds = 99;
    expect(changed.soundscape!.sceneries.pond!.levels.birds).toBe(35);
    expect(mergeSettings(changed, { soundscape: { ...s, volume: -1 } })).toBe(changed);
  });

  it('round-trips mixes in garden exports and accepts gardens without sound preferences', () => {
    const state = createDefaultState(1234);
    expect(validateState(state).ok).toBe(true);
    state.settings.soundscape = defaultSoundscape();
    state.settings.soundscape.sceneries.coast = { mode: 'custom', levels: levelsWith({ sea: 68, cicadas: 12 }) };
    const result = importState(exportState(state, 1234));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.settings.soundscape).toEqual(state.settings.soundscape);
    expect(validateState({ ...state, version: STATE_VERSION, settings: { ...state.settings, soundscape: { volume: 500 } } }).ok).toBe(false);
  });

  it('reads a mix missing a layer with that layer at 0, as an owned copy (ADR 0240)', () => {
    const s = defaultSoundscape();
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ water: 80 }) };
    const { brown: _b, ...partial } = s.standard;
    const read = readSoundscape({ ...s, standard: partial })!;
    expect(read).toEqual(s);
    expect(read.standard).not.toBe(s.standard);
    expect(Object.keys(read.sceneries.pond!.levels)).toEqual([...SOUND_LAYERS]);
    expect(readSoundscape({ ...s, standard: { ...partial, brown: 101 } })).toBeNull();
    expect(readSoundscape({ ...s, sceneries: { gorge: s.sceneries.pond } })).toBeNull(); // not an audio scenery
    expect(readSoundscape({ ...s, sceneries: { waterfall: s.sceneries.pond } })!.sceneries.waterfall).toEqual(s.sceneries.pond);
    expect(readSoundscape([])).toBeNull();
    // a patch missing a layer merges as the complete mix
    const merged = mergeSettings(createDefaultState(0).settings, { soundscape: { ...s, standard: partial } as never });
    expect(merged.soundscape).toEqual(s);
  });
});
