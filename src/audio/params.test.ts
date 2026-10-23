import { describe, expect, it } from 'vitest';
import { defaultSoundscape, levelsWith, silentLevels } from '../core/soundscape';
import {
  BIRD_CURVE,
  CRICKET_CURVE,
  localHour,
  mixParams,
  sameMix,
  sampleCurve,
  wrapHour,
  type MixInput,
} from './params';

const base: MixInput = {
  hour: 12,
  weather: null,
  activity: { sessionActive: false, paused: false },
  fauna: new Set(),
};
const at = (patch: Partial<MixInput>) => mixParams({ ...base, ...patch });

describe('time-of-day curves', () => {
  it('wraps hours into [0, 24)', () => {
    expect(wrapHour(25)).toBe(1);
    expect(wrapHour(-1)).toBe(23);
    expect(wrapHour(Number.NaN)).toBe(12);
  });

  it('interpolates linearly between points and wraps midnight', () => {
    expect(sampleCurve([[0, 0], [10, 1], [24, 0]], 5)).toBeCloseTo(0.5);
    expect(sampleCurve(BIRD_CURVE, 24 + 6.5)).toBeCloseTo(sampleCurve(BIRD_CURVE, 6.5));
  });

  it('every curve stays within [0, 1] and is continuous across midnight', () => {
    for (const curve of [BIRD_CURVE, CRICKET_CURVE]) {
      expect(curve[0]![1]).toBeCloseTo(curve[curve.length - 1]![1]);
      for (let h = 0; h < 24; h += 0.25) {
        const v = sampleCurve(curve, h);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reads the local hour from an epoch instant', () => {
    const d = new Date(2026, 3, 1, 7, 30, 0);
    expect(localHour(d.getTime())).toBeCloseTo(7.5);
  });
});

describe('mixParams', () => {
  it('has more birds in the morning than at noon, and almost none at night', () => {
    const morning = at({ hour: 7 }).rates.chirp;
    const noon = at({ hour: 13 }).rates.chirp;
    const night = at({ hour: 1 }).rates.chirp;
    expect(morning).toBeGreaterThan(noon);
    expect(noon).toBeGreaterThan(night * 5);
  });

  it('sings the bush warbler mostly in the morning', () => {
    expect(at({ hour: 6.5 }).rates.warbler).toBeGreaterThan(at({ hour: 15 }).rates.warbler * 3);
    expect(at({ hour: 22 }).rates.warbler).toBe(0);
  });

  it('has crickets at night only', () => {
    expect(at({ hour: 23 }).rates.cricket).toBeGreaterThan(0);
    expect(at({ hour: 12 }).rates.cricket).toBe(0);
  });

  it('adds birds as fauna unlocks', () => {
    const none = at({ hour: 8 });
    const small = at({ hour: 8, fauna: new Set(['small-birds']) });
    expect(small.rates.chirp).toBeGreaterThan(none.rates.chirp * 2);
    expect(none.rates.swallow).toBe(0);
    expect(at({ hour: 10, fauna: new Set(['swallows']) }).rates.swallow).toBeGreaterThan(0);
    expect(at({ hour: 1, fauna: new Set(['swallows']) }).rates.swallow).toBe(0);
  });

  it('rain brings patter and drips, quietens birds; no rain otherwise', () => {
    const rain = at({ weather: 'rain' });
    expect(rain.rain).toBeGreaterThan(0);
    expect(rain.rates.drip).toBeGreaterThan(0);
    expect(rain.rates.chirp).toBeLessThan(at({}).rates.chirp);
    expect(at({ weather: 'sun' }).rain).toBe(0);
    expect(at({}).rates.drip).toBe(0);
  });

  it('mist muffles everything with a low-pass', () => {
    expect(at({ weather: 'mist' }).airHz).toBeLessThan(at({ weather: 'sun' }).airHz / 4);
  });

  it('a running session is slightly fuller and warmer; paused thins the bed', () => {
    const idle = at({});
    const running = at({ activity: { sessionActive: true, paused: false } });
    const paused = at({ activity: { sessionActive: true, paused: true } });
    expect(running.bed).toBeGreaterThan(idle.bed);
    expect(running.bed).toBeLessThan(idle.bed * 1.25); // "very slightly"
    expect(running.warmthDb).toBeGreaterThan(0);
    expect(paused.bed).toBeLessThan(idle.bed);
    expect(paused.rates.plip).toBeLessThan(idle.rates.plip);
  });

  it('keeps every level low (the whole mix sits quietly)', () => {
    for (const weather of [null, 'sun', 'rain', 'mist'] as const) {
      for (let hour = 0; hour < 24; hour += 3) {
        const m = at({ hour, weather, activity: { sessionActive: true, paused: false } });
        expect(m.water + m.wind + m.rain).toBeLessThan(0.2);
      }
    }
  });
});

describe('sameMix', () => {
  it('notices changes to individual channel gains and Standard beds', () => {
    const s = defaultSoundscape();
    s.collection = 'standard';
    s.standard = levelsWith({ cafe: 45, birds: 20 });
    const a = at({ soundscape: s });
    expect(sameMix(a, at({ soundscape: { ...s, standard: { ...s.standard, cafe: 60 } } }))).toBe(false);
    expect(sameMix(a, at({ soundscape: { ...s, standard: { ...s.standard, birds: 30 } } }))).toBe(false);
  });
  it('ignores sub-percent changes and notices real ones', () => {
    const a = at({ hour: 12 });
    expect(sameMix(null, a)).toBe(false);
    expect(sameMix(a, at({ hour: 12.01 }))).toBe(true);
    expect(sameMix(a, at({ weather: 'mist' }))).toBe(false);
    expect(sameMix(a, at({ fauna: new Set(['small-birds']) }))).toBe(false); // rates only
  });
});

describe('personal mixes', () => {
  it('lets rain, birds and crickets play independently of weather, hour and fauna', () => {
    const s = defaultSoundscape();
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ rain: 80, birds: 40, crickets: 50 }) };
    const a = at({ hour: 12, weather: 'sun', soundscape: s });
    const b = at({ hour: 0, weather: 'mist', soundscape: s });
    expect(a).toEqual(b);
    expect(a.rain).toBeGreaterThan(0);
    expect(a.rates.cricket).toBeGreaterThan(0);
    expect(a.rates.chirp).toBeGreaterThan(0);
    expect(a.rates.plip).toBe(0);
    expect(a.water).toBe(0);
  });
  it('silences all ambience when every layer is zero', () => {
    const s = defaultSoundscape();
    s.collection = 'standard'; s.standard = silentLevels();
    const m = at({ weather: 'rain', soundscape: s });
    expect(m.water + m.wind + m.rain).toBe(0);
    expect(Object.values(m.rates).every((v) => v === 0)).toBe(true);
    expect(Object.values(m.extra).every((v) => v === 0)).toBe(true);
  });
  it('uses the active scenery and excludes sounds from another scenery', () => {
    const s = defaultSoundscape();
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ water: 90, cafe: 100 }) };
    s.sceneries.coast = { mode: 'custom', levels: levelsWith({ waves: 80, water: 100 }) };
    expect(at({ soundscape: s }).extra.cafe).toBe(0);
    const coast = at({ soundscape: s, scenery: 'coast' });
    expect(coast.extra.waves).toBe(80);
    expect(coast.water).toBe(0);
    const automatic = at({ scenery: 'coast' });
    expect(automatic.extra.waves).toBeGreaterThan(0);
    expect(automatic.rates.plip).toBe(0);
  });
});
