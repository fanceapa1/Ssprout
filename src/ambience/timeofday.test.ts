import { describe, expect, it } from 'vitest';
import { bracket, gradeAt, gradeDistance, KEYFRAMES, localHour, NAMED_HOURS, parseTimeOverride, timeName, wrapHour } from './timeofday';

const lum = (rgb: readonly number[]) => 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
/** luminance a white pixel ends up with after the multiply wash */
const washed = (hour: number) => {
  const g = gradeAt(hour);
  return 255 * (1 - g.amount) + lum(g.tint) * g.amount;
};

describe('keyframes', () => {
  it('are sorted and inside one day', () => {
    for (let i = 1; i < KEYFRAMES.length; i++) expect(KEYFRAMES[i]!.hour).toBeGreaterThan(KEYFRAMES[i - 1]!.hour);
    expect(KEYFRAMES[0]!.hour).toBeGreaterThanOrEqual(0);
    expect(KEYFRAMES.at(-1)!.hour).toBeLessThan(24);
  });

  it('each named hour sits exactly on its keyframe', () => {
    for (const [name, hour] of Object.entries(NAMED_HOURS)) {
      expect(timeName(hour)).toBe(name);
      const kf = KEYFRAMES.find((k) => k.name === name)!;
      expect(gradeDistance(gradeAt(hour), kf.grade)).toBeLessThan(1e-9);
    }
  });
});

describe('gradeAt', () => {
  it('is exactly the keyframe at a keyframe hour', () => {
    for (const k of KEYFRAMES) expect(gradeDistance(gradeAt(k.hour), k.grade)).toBeLessThan(1e-12);
  });

  it('interpolates smoothly (no jumps minute to minute, across midnight too)', () => {
    let prev = gradeAt(0);
    for (let m = 1; m <= 24 * 60; m++) {
      const g = gradeAt(m / 60);
      expect(gradeDistance(g, prev)).toBeLessThan(0.002);
      prev = g;
    }
  });

  it('eases in and out of keyframes (smoothstep): slower near the keyframe than mid-way', () => {
    const near = gradeDistance(gradeAt(17.75), gradeAt(17.8));
    const mid = gradeDistance(gradeAt(18.6), gradeAt(18.65));
    expect(near).toBeLessThan(mid);
  });

  it('noon is neutral; night is the darkest but plants stay readable', () => {
    expect(gradeAt(13).amount).toBeLessThan(0.05);
    const night = washed(23);
    expect(night).toBeLessThan(washed(19.5));
    expect(night).toBeLessThan(washed(8));
    expect(night).toBeGreaterThan(255 * 0.42); // readable: still well above half-dark
    expect(gradeAt(23).ground).toBeLessThan(1); // foreground kept lighter than the sky
  });

  it('evening is warm, dusk and night are blue, morning is cool', () => {
    const warmth = (h: number) => gradeAt(h).tint[0] - gradeAt(h).tint[2];
    expect(warmth(17.75)).toBeGreaterThan(60);
    expect(warmth(19.5)).toBeLessThan(-40);
    expect(warmth(23)).toBeLessThan(-40);
    expect(warmth(8)).toBeLessThan(0);
  });

  it('the lantern is lit at dusk and night, not by day', () => {
    expect(gradeAt(23).lantern).toBe(1);
    expect(gradeAt(19.5).lantern).toBeGreaterThan(0.4);
    expect(gradeAt(13).lantern).toBe(0);
    expect(gradeAt(9).lantern).toBe(0);
  });
});

describe('helpers', () => {
  it('wrapHour', () => {
    expect(wrapHour(25)).toBe(1);
    expect(wrapHour(-1)).toBe(23);
    expect(wrapHour(Number.NaN)).toBe(12);
  });

  it('bracket wraps around midnight', () => {
    const b = bracket(2);
    expect(b.a.name).toBe('night');
    expect(b.b.name).toBe('night');
    expect(b.t).toBeGreaterThan(0);
    expect(b.t).toBeLessThan(1);
  });

  it('localHour reads the local clock of a timestamp', () => {
    const d = new Date(2026, 9, 22, 18, 30, 0);
    expect(localHour(d.getTime())).toBeCloseTo(18.5, 6);
  });

  it('parseTimeOverride accepts names, hours and null; rejects junk', () => {
    expect(parseTimeOverride('night')).toBe(NAMED_HOURS.night);
    expect(parseTimeOverride('dusk')).toBe(19.5);
    expect(parseTimeOverride(30)).toBe(6);
    expect(parseTimeOverride(null)).toBeNull();
    expect(() => parseTimeOverride('teatime')).toThrow(TypeError);
    expect(() => parseTimeOverride(Number.NaN)).toThrow(TypeError);
  });
});
