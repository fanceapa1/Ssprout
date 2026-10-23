import { describe, expect, it } from 'vitest';
import { exportState, importState, validateState } from './persistence';
import { copySoundscape, defaultSoundscape, isSoundscape, levelsWith, sceneryMix, selectedMix } from './soundscape';
import { createDefaultState, mergeSettings, STATE_VERSION } from './state';

describe('sound collections', () => {
  it('keeps a Standard mix across sceneries and restores each scenery’s own mix', () => {
    const s = defaultSoundscape();
    s.standard = levelsWith({ cafe: 45, lofi: 30 });
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ water: 80, rain: 20 }) };
    s.sceneries.coast = { mode: 'custom', levels: levelsWith({ waves: 60 }) };
    expect(selectedMix(s, 'pond').levels.water).toBe(80);
    expect(selectedMix(s, 'coast').levels.waves).toBe(60);
    s.collection = 'standard';
    expect(selectedMix(s, 'pond')).toEqual(selectedMix(s, 'coast'));
    expect(selectedMix(s, 'pond').levels.cafe).toBe(45);
    s.collection = 'scenery';
    expect(selectedMix(s, 'pond').levels.water).toBe(80);
  });

  it('follows the garden by default, with a distinct coastal profile', () => {
    const s = defaultSoundscape();
    expect(sceneryMix(s, 'pond').mode).toBe('garden');
    expect(sceneryMix(s, 'coast').levels.waves).toBeGreaterThan(0);
    const copy = copySoundscape(s);
    copy.standard.rain = 1;
    expect(s.standard.rain).toBe(55);
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
    state.settings.soundscape.sceneries.coast = { mode: 'custom', levels: levelsWith({ waves: 68 }) };
    const result = importState(exportState(state, 1234));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.settings.soundscape).toEqual(state.settings.soundscape);
    expect(validateState({ ...state, version: STATE_VERSION, settings: { ...state.settings, soundscape: { volume: 500 } } }).ok).toBe(false);
  });
});
