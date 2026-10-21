import { describe, expect, it } from 'vitest';
import { createWind, wind, windBoost } from './wind';

describe('wind', () => {
  it('is deterministic for the same inputs and seed', () => {
    const a = createWind(7);
    const b = createWind(7);
    for (const [t, x, y] of [[0, 0, 0], [12.5, 800, 560], [300, 1500, 900]] as const) {
      expect(a(t, x, y)).toEqual(b(t, x, y));
      expect(wind(t, x, y)).toEqual(wind(t, x, y));
    }
  });

  it('differs between seeds', () => {
    expect(createWind(1)(10, 400, 400)).not.toEqual(createWind(2)(10, 400, 400));
  });

  it('stays within bounds everywhere, with and without boost', () => {
    let minS = 0;
    let maxS = 0;
    let maxG = 0;
    for (let t = 0; t < 2000; t += 3.7) {
      for (let x = -200; x <= 1800; x += 230) {
        for (const boost of [0, 0.5, 1, 5, -3]) {
          const { sway, gust } = wind(t, x, 500 + (x % 300), boost);
          expect(sway).toBeGreaterThanOrEqual(-1);
          expect(sway).toBeLessThanOrEqual(1);
          expect(gust).toBeGreaterThanOrEqual(0);
          expect(gust).toBeLessThanOrEqual(1);
          minS = Math.min(minS, sway);
          maxS = Math.max(maxS, sway);
          maxG = Math.max(maxG, gust);
        }
      }
    }
    // it actually moves both ways and gusts do happen
    expect(minS).toBeLessThan(-0.2);
    expect(maxS).toBeGreaterThan(0.4);
    expect(maxG).toBeGreaterThan(0.5);
  });

  it('is finite for non-finite input', () => {
    const s = wind(Number.NaN, Infinity, -Infinity, Number.NaN);
    expect(Number.isFinite(s.sway)).toBe(true);
    expect(Number.isFinite(s.gust)).toBe(true);
  });

  it('changes slowly (no jumps between frames)', () => {
    let prev = wind(0, 600, 500).sway;
    for (let t = 1 / 60; t < 120; t += 1 / 60) {
      const s = wind(t, 600, 500).sway;
      expect(Math.abs(s - prev)).toBeLessThan(0.03);
      prev = s;
    }
  });

  it('is a touch stronger during a session', () => {
    let calm = 0;
    let session = 0;
    for (let t = 0; t < 600; t += 1.3) {
      calm += Math.abs(wind(t, 700, 600, 0).sway);
      session += Math.abs(wind(t, 700, 600, 1).sway);
    }
    expect(session).toBeGreaterThan(calm * 1.15);
    expect(session).toBeLessThan(calm * 1.6);
  });

  it('gust fronts travel toward +x', () => {
    // the gust seen at x = 0 is seen later further right
    const at = (t: number, x: number) => wind(t, x, 500).gust;
    let best = 0;
    let bestLag = 0;
    const lags = [0, 1, 2, 3, 4];
    for (const lag of lags) {
      let corr = 0;
      for (let t = 0; t < 400; t += 0.5) corr += at(t, 0) * at(t + lag, 280);
      if (corr > best) {
        best = corr;
        bestLag = lag;
      }
    }
    expect(bestLag).toBe(2); // 280 units at 140 units/s
  });

  it('windBoost maps phases', () => {
    expect(windBoost('focus')).toBe(1);
    expect(windBoost('break')).toBe(0.5);
    expect(windBoost('paused')).toBe(0);
    expect(windBoost('idle')).toBe(0);
  });
});
