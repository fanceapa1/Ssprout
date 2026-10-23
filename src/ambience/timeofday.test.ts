import { describe, expect, it } from 'vitest';
import { blendWeights, only, PHASES } from './daylight';
import { gradeAt, gradeDistance, gradeFor, localHour, NAMED_HOURS, PHASE_GRADES, TYPICAL_DAY, weightsAtHour, wrapHour } from './timeofday';

const lum = (rgb: readonly number[]) => 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
/** luminance a white pixel ends up with after the multiply wash */
const washed = (g: ReturnType<typeof gradeFor>) => 255 * (1 - g.amount) + lum(g.tint) * g.amount;
const warmth = (g: ReturnType<typeof gradeFor>) => g.tint[0] - g.tint[2];

describe('phase grades', () => {
  it('midday is almost bare paper: the painting at its most saturated and crisp', () => {
    expect(PHASE_GRADES.midday.amount).toBeLessThan(0.05);
    expect(PHASE_GRADES.midday.lantern).toBe(0);
  });

  it('night is the darkest but plants stay readable, lighter over the garden than the sky', () => {
    const night = washed(PHASE_GRADES.night);
    for (const p of ['sunrise', 'midday', 'sunset'] as const) expect(night).toBeLessThan(washed(PHASE_GRADES[p]));
    expect(night).toBeGreaterThan(255 * 0.42);
    const g = PHASE_GRADES.night;
    expect(g.sky).toBeGreaterThan(0);
    // the near ground is glazed deeper than the middle distance (thin paint, ADR 0206) …
    expect(g.ground).toBeGreaterThan(1);
    // … but the wash at the bottom edge stays lighter than at the top of the sky
    expect(g.amount * g.ground).toBeLessThan(g.amount + g.sky - 0.05);
  });

  it('sunset is warm, sunrise cool with a warm glow on the right, night blue', () => {
    expect(warmth(PHASE_GRADES.sunset)).toBeGreaterThan(80);
    expect(warmth(PHASE_GRADES.night)).toBeLessThan(-60);
    expect(warmth(PHASE_GRADES.sunrise)).toBeLessThan(0);
    expect(PHASE_GRADES.sunrise.glowX).toBeGreaterThan(0.5); // the sun rises on the right
    expect(PHASE_GRADES.sunset.glowX).toBeLessThan(0.5); // and sets on the left
  });

  it('the lantern is lit at night, coming on at sunset, dark by day', () => {
    expect(PHASE_GRADES.night.lantern).toBe(1);
    expect(PHASE_GRADES.sunset.lantern).toBeGreaterThan(0.2);
    expect(PHASE_GRADES.midday.lantern).toBe(0);
  });
});

describe('gradeFor', () => {
  it('is exactly the phase grade for a pure phase', () => {
    for (const p of PHASES) expect(gradeDistance(gradeFor(only(p)), PHASE_GRADES[p])).toBeLessThan(1e-12);
  });

  it('blends linearly between two phases', () => {
    const mid = gradeFor(blendWeights('sunset', 'night', 0.5));
    expect(mid.amount).toBeCloseTo((PHASE_GRADES.sunset.amount + PHASE_GRADES.night.amount) / 2, 9);
    expect(mid.lantern).toBeCloseTo((PHASE_GRADES.sunset.lantern + PHASE_GRADES.night.lantern) / 2, 9);
  });
});

describe('the typical day (hour-based callers)', () => {
  it('has the four phases in order', () => {
    expect(TYPICAL_DAY.map((b) => b.to)).toEqual(['sunrise', 'midday', 'sunset', 'night']);
  });

  it('gradeAt changes smoothly minute to minute, across midnight too', () => {
    let prev = gradeAt(0);
    for (let m = 1; m <= 24 * 60; m++) {
      const g = gradeAt(m / 60);
      expect(gradeDistance(g, prev)).toBeLessThan(0.003);
      prev = g;
    }
  });

  it('the named hours land in their phases', () => {
    expect(weightsAtHour(NAMED_HOURS.noon).midday).toBe(1);
    expect(weightsAtHour(NAMED_HOURS.night).night).toBe(1);
    expect(weightsAtHour(NAMED_HOURS.morning).sunrise).toBe(1);
    expect(weightsAtHour(NAMED_HOURS.evening).sunset).toBe(1);
    expect(weightsAtHour(NAMED_HOURS.dusk).night).toBeCloseTo(0.5, 6);
  });
});

describe('helpers', () => {
  it('wrapHour', () => {
    expect(wrapHour(25)).toBe(1);
    expect(wrapHour(-1)).toBe(23);
    expect(wrapHour(Number.NaN)).toBe(12);
  });

  it('localHour reads the local clock of a timestamp', () => {
    const d = new Date(2026, 9, 22, 18, 30, 0);
    expect(localHour(d.getTime())).toBeCloseTo(18.5, 6);
  });
});
