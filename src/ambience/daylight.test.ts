import { describe, expect, it } from 'vitest';
import {
  BLEND_MS,
  GOLDEN_MS,
  PHASES,
  atLocalHour,
  blendWeights,
  boundariesAround,
  dayBoundaries,
  dayKind,
  daylightAt,
  daylightFor,
  only,
  parseTimeOverride,
  phaseAt,
  pinnedState,
  weightDistance,
  type Boundary,
} from './daylight';
import { sunTimes, type SunTimes } from './solar';

const MIN = 60_000;
const LONDON = { lat: 51.51, lon: -0.13 };
const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
const day = Date.parse('2024-06-21T12:00:00Z');

describe('phase windows (a normal day)', () => {
  const t = sunTimes(day, LONDON);
  const b = dayBoundaries(t);

  it('night → sunrise at civil dawn, → midday 60 min after sunrise, → sunset 60 min before sunset, → night at civil dusk', () => {
    expect(dayKind(t)).toBe('normal');
    expect(b.map((x) => `${x.from}>${x.to}`)).toEqual(['night>sunrise', 'sunrise>midday', 'midday>sunset', 'sunset>night']);
    expect(b[0]!.at).toBe(t.dawn);
    expect(b[1]!.at).toBe(t.sunrise! + GOLDEN_MS);
    expect(b[2]!.at).toBe(t.sunset! - GOLDEN_MS);
    expect(b[3]!.at).toBe(t.dusk);
  });

  it('each change is a 40-minute blend centred on its boundary', () => {
    const { boundaries } = boundariesAround(day, LONDON);
    for (const x of b) {
      expect(phaseAt(x.at - BLEND_MS / 2 - MIN, boundaries, 'night').weights[x.from]).toBe(1);
      const mid = phaseAt(x.at, boundaries, 'night');
      expect(mid.weights[x.from]).toBeCloseTo(0.5, 6);
      expect(mid.weights[x.to]).toBeCloseTo(0.5, 6);
      expect(mid.blend).toMatchObject({ from: x.from, to: x.to });
      expect(phaseAt(x.at + BLEND_MS / 2 + MIN, boundaries, 'night').weights[x.to]).toBe(1);
      // eased: a quarter of the way in, less than a quarter has changed
      expect(phaseAt(x.at - BLEND_MS / 4, boundaries, 'night').weights[x.to]).toBeLessThan(0.25);
    }
  });

  it('weights always sum to 1 and change smoothly minute by minute through the day', () => {
    let prev = daylightAt(day - 12 * 60 * MIN, LONDON).weights;
    for (let m = -12 * 60; m <= 12 * 60; m++) {
      const w = daylightAt(day + m * MIN, LONDON).weights;
      expect(sum(w)).toBeCloseTo(1, 9);
      expect(weightDistance(w, prev)).toBeLessThan(0.01);
      prev = w;
    }
  });

  it('London midsummer: 03:30 BST night→sunrise blend, 05:00 sunrise, noon midday, 21:00 sunset, 23:00 night', () => {
    const at = (iso: string) => daylightAt(Date.parse(iso), LONDON);
    expect(at('2024-06-21T02:56Z').blend).toMatchObject({ from: 'night', to: 'sunrise' });
    expect(at('2024-06-21T04:00Z').phase).toBe('sunrise');
    expect(at('2024-06-21T12:00Z').phase).toBe('midday');
    expect(at('2024-06-21T20:00Z').phase).toBe('sunset');
    expect(at('2024-06-21T22:00Z').phase).toBe('night');
  });
});

describe('unusual days', () => {
  const fake = (o: Partial<SunTimes>): SunTimes => ({
    noon: 12 * 60 * MIN,
    midnight: 0,
    dawn: null,
    sunrise: null,
    sunset: null,
    dusk: null,
    noonAltitude: 10,
    midnightAltitude: -30,
    ...o,
  });

  it('a short winter day keeps midday around solar noon', () => {
    const t = fake({ dawn: 9 * 60 * MIN, sunrise: 10 * 60 * MIN, sunset: 14 * 60 * MIN, dusk: 15 * 60 * MIN });
    const b = dayBoundaries(t);
    expect(b[1]!.at).toBeLessThanOrEqual(t.noon - BLEND_MS / 2);
    expect(b[2]!.at).toBeGreaterThanOrEqual(t.noon + BLEND_MS / 2);
    expect(phaseAt(t.noon, b, 'night').weights.midday).toBe(1);
  });

  it('white nights: no civil dusk, so sunset blends into sunrise at solar midnight', () => {
    const t = fake({ sunrise: 3 * 60 * MIN, sunset: 22 * 60 * MIN, midnightAltitude: -4 });
    expect(dayKind(t)).toBe('white-nights');
    const b = dayBoundaries(t);
    expect(b[0]).toEqual({ at: t.midnight, from: 'sunset', to: 'sunrise' });
    expect(b.some((x) => x.to === 'night')).toBe(false);
  });

  it('polar day is midday all day, polar night is night all day', () => {
    expect(dayBoundaries(fake({ noonAltitude: 40, midnightAltitude: 5 }))).toEqual([]);
    expect(dayKind(fake({ noonAltitude: 40, midnightAltitude: 5 }))).toBe('polar-day');
    expect(dayKind(fake({ noonAltitude: -12 }))).toBe('polar-night');
    const tromsoSummer = daylightAt(Date.parse('2024-06-21T23:00:00Z'), { lat: 69.65, lon: 18.96 });
    expect(tromsoSummer.weights.midday).toBe(1);
    const svalbardWinter = daylightAt(Date.parse('2024-12-21T11:00:00Z'), { lat: 78.22, lon: 15.63 });
    expect(svalbardWinter.weights.night).toBe(1);
  });

  it('a polar night with twilight runs sunrise into sunset at noon', () => {
    const t = fake({ dawn: 10 * 60 * MIN, dusk: 14 * 60 * MIN, noonAltitude: -3 });
    expect(dayKind(t)).toBe('polar-twilight');
    expect(dayBoundaries(t).map((x) => `${x.from}>${x.to}`)).toEqual(['night>sunrise', 'sunrise>sunset', 'sunset>night']);
    const tromsoWinter = daylightAt(Date.parse('2024-12-21T11:40:00Z'), { lat: 69.65, lon: 18.96 });
    expect(tromsoWinter.weights.midday).toBe(0);
    expect(tromsoWinter.weights.sunrise + tromsoWinter.weights.sunset).toBeGreaterThan(0.9);
  });

  it('blends never overlap: close boundaries narrow each other', () => {
    const b: Boundary[] = [
      { at: 0, from: 'night', to: 'sunrise' },
      { at: 10 * MIN, from: 'sunrise', to: 'midday' },
    ];
    for (let m = -30; m <= 40; m++) expect(sum(phaseAt(m * MIN, b, 'night').weights)).toBeCloseTo(1, 9);
    expect(phaseAt(5 * MIN, b, 'night').weights.sunrise).toBe(1);
  });
});

describe('the daylight state', () => {
  it('the moon crosses the sky from dusk (0) to dawn (1)', () => {
    const t = sunTimes(day, LONDON);
    expect(daylightAt(t.dusk! + MIN, LONDON).moonProgress).toBeLessThan(0.05);
    expect(daylightAt(t.dusk! + 3 * 60 * MIN, LONDON).moonProgress).toBeGreaterThan(0.3);
    expect(daylightAt(t.dawn! - MIN + 24 * 60 * MIN, LONDON).moonProgress).toBeGreaterThan(0.95);
  });

  it('knows whether the sun is rising or setting', () => {
    expect(daylightAt(Date.parse('2024-06-21T05:00Z'), LONDON).sunRising).toBe(true);
    expect(daylightAt(Date.parse('2024-06-21T19:00Z'), LONDON).sunRising).toBe(false);
  });

  it('pinned phases have a typical sky: a low sun at sunrise/sunset, the moon up at night', () => {
    expect(pinnedState(only('sunrise'))).toMatchObject({ phase: 'sunrise', sunRising: true });
    expect(pinnedState(only('sunrise')).sunAltitude).toBeLessThan(8);
    expect(pinnedState(only('sunset'))).toMatchObject({ phase: 'sunset', sunRising: false });
    expect(pinnedState(only('midday')).sunAltitude).toBeGreaterThan(40);
    expect(pinnedState(only('night')).sunAltitude).toBeLessThan(-6);
    expect(pinnedState(only('night')).night).toBe(1);
    expect(pinnedState(blendWeights('sunset', 'night', 0.5)).sunAltitude).toBeLessThan(0);
  });
});

describe('setTime overrides', () => {
  it('accepts the four phases', () => {
    for (const p of PHASES) expect(parseTimeOverride(p)).toMatchObject({ kind: 'pinned', weights: only(p) });
  });

  it('keeps the v1 names as aliases', () => {
    expect(parseTimeOverride('noon')).toMatchObject({ weights: only('midday') });
    expect(parseTimeOverride('morning')).toMatchObject({ weights: only('sunrise') });
    expect(parseTimeOverride('evening')).toMatchObject({ weights: only('sunset') });
    expect(parseTimeOverride('dusk')).toMatchObject({ weights: blendWeights('sunset', 'night', 0.5), blend: { from: 'sunset', to: 'night' } });
    expect(parseTimeOverride('dawn')).toMatchObject({ weights: blendWeights('night', 'sunrise', 0.5) });
  });

  it('accepts a blend, an hour and null; rejects junk', () => {
    expect(parseTimeOverride({ from: 'midday', to: 'sunset', t: 0.25 })).toMatchObject({ weights: blendWeights('midday', 'sunset', 0.25) });
    expect(parseTimeOverride({ from: 'midday', to: 'sunset', t: 3 })).toMatchObject({ weights: only('sunset'), blend: null });
    expect(parseTimeOverride(30)).toEqual({ kind: 'hour', hour: 6, label: '6h' });
    expect(parseTimeOverride(null)).toBeNull();
    expect(() => parseTimeOverride('teatime')).toThrow(/setTime/);
    expect(() => parseTimeOverride(Number.NaN)).toThrow(TypeError);
    expect(() => parseTimeOverride({ from: 'noon', to: 'night', t: 0.5 })).toThrow(TypeError);
  });

  it('an hour runs through the real sun times of that day', () => {
    const now = Date.parse('2024-06-21T12:00:00Z');
    const s = daylightFor(now, LONDON, parseTimeOverride(13));
    expect(s.times).not.toBeNull();
    expect(atLocalHour(now, 13) - atLocalHour(now, 12)).toBe(60 * MIN);
    expect(daylightFor(now, LONDON, parseTimeOverride('night')).weights.night).toBe(1);
  });
});
