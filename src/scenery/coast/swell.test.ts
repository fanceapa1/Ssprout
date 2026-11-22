/**
 * The coast's swell (GS1): one schedule of crests, pure in t, that the bands, the shore break, the
 * rocks and the caique share; and the run up the shingle kept short of the beach's plants.
 */
import { describe, expect, it } from 'vitest';
import { COAST_SLOTS } from './slots';
import { arrival, CREST_LIFE, crestDepth, crestSpeed, delayAt, foamY, latest, shoaling, strength, SWASH_MAX, swashLimit, SWELL, swellAt, travel } from './swell';

describe('the coast’s swell (GS1)', () => {
  it('sends crests in order, about a period apart, in sets of strong and weak ones', () => {
    const gaps: number[] = [];
    for (let n = -50; n < 400; n++) {
      const gap = arrival(n + 1) - arrival(n);
      expect(gap).toBeGreaterThan(SWELL.period - SWELL.jitter);
      expect(gap).toBeLessThan(SWELL.period + SWELL.jitter);
      gaps.push(gap);
      expect(strength(n)).toBeGreaterThanOrEqual(0.35);
      expect(strength(n)).toBeLessThanOrEqual(1);
    }
    // uneven: the gaps do not repeat as a loop would
    expect(new Set(gaps.map((g) => g.toFixed(3))).size).toBeGreaterThan(80);
    const s = Array.from({ length: 70 }, (_, n) => strength(n));
    expect(Math.max(...s) - Math.min(...s)).toBeGreaterThan(0.4);
  });

  it('finds the latest crest for any time', () => {
    for (let m = -100; m < 2000; m += 0.77) {
      const n = latest(m);
      expect(arrival(n)).toBeLessThanOrEqual(m);
      expect(arrival(n + 1)).toBeGreaterThan(m);
    }
  });

  it('runs a crest in from the horizon to the break, slower far out, over a minute and more', () => {
    expect(crestDepth(0)).toBeCloseTo(SWELL.breaks, 6);
    expect(crestDepth(-CREST_LIFE)).toBeCloseTo(SWELL.born, 4);
    expect(CREST_LIFE).toBeGreaterThan(60);
    for (const d of [10, 60, 150, 300]) expect(crestDepth(travel(d))).toBeCloseTo(d, 4);
    const speed = (tau: number) => (crestDepth(tau - 0.5) - crestDepth(tau + 0.5)) / 1;
    expect(speed(-1)).toBeGreaterThan(2 * speed(-CREST_LIFE + 1));
    expect(speed(-1)).toBeLessThan(8);
    // continuous in time, and pure
    for (let tau = -CREST_LIFE; tau < 0; tau += 0.37) expect(Math.abs(crestDepth(tau + 0.05) - crestDepth(tau))).toBeLessThan(0.5);
  });

  it('slows the crests over the turquoise shelf, so they bunch before the beach (GS2)', () => {
    expect(shoaling(SWELL.shelf + 50)).toBe(1);
    expect(shoaling(0)).toBeCloseTo(SWELL.slow, 6);
    // off the shelf a crest gathers speed as it comes in; on it, it stops gathering
    expect(crestSpeed(200)).toBeGreaterThan(crestSpeed(300));
    expect(crestSpeed(10)).toBeLessThan(crestSpeed(140) * 1.06);
    expect((SWELL.speed + SWELL.growth * (SWELL.born - 10)) / (SWELL.speed + SWELL.growth * (SWELL.born - 140))).toBeGreaterThan(1.1);
    // the gap between crests by the beach is less than the plain run in would give
    const gap = (d: number) => crestSpeed(d) * SWELL.period;
    expect(gap(10)).toBeLessThan((SWELL.speed + SWELL.growth * (SWELL.born - 10)) * SWELL.period * 0.8);
    expect(gap(10)).toBeGreaterThan(30);
  });

  it('reaches the beach’s left end first and peels to the right', () => {
    expect(delayAt(-60)).toBe(0);
    expect(delayAt(700)).toBeCloseTo(SWELL.peel, 6);
    expect(delayAt(300)).toBeGreaterThan(delayAt(100));
  });

  it('lifts the water smoothly: bounded, continuous in t, highest as a crest passes', () => {
    for (const [d, x] of [[40, 200], [150, 400], [300, 100]] as const) {
      let prev = swellAt(d, x, 0).lift;
      let top = -1;
      for (let t = 0.05; t < 300; t += 0.05) {
        const s = swellAt(d, x, t);
        expect(Math.abs(s.lift)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.lift - prev), `${d} ${t}`).toBeLessThan(0.08);
        if (s.since < 0.05) top = Math.max(top, s.lift);
        prev = s.lift;
      }
      expect(top).toBeGreaterThan(0.6);
    }
    expect(swellAt(80, 300, 41.3)).toEqual(swellAt(80, 300, 41.3));
  });

  it('never runs a wave up to a plant on the beach', () => {
    const beach = COAST_SLOTS.filter((s) => s.id.startsWith('beach-'));
    expect(beach.length).toBeGreaterThan(3);
    for (const s of beach) {
      for (let x = s.x - 40; x <= s.x + 40; x += 4) expect(foamY(s.x) + swashLimit(x)).toBeLessThanOrEqual(s.y - 12 + 1e-9);
    }
    for (let x = -60; x < 700; x += 10) expect(swashLimit(x)).toBeLessThanOrEqual(SWASH_MAX);
  });
});
