import { describe, expect, it } from 'vitest';
import { OCHRE, WITHER_SECONDS, witherPixels, witherState } from './wither';

describe('wither timeline', () => {
  it('takes ~3 s from living to gone', () => {
    expect(WITHER_SECONDS).toBe(3);
    expect(witherState(0)).toMatchObject({ tint: 0, droop: 0, squash: 1, sink: 0, alpha: 1, done: false });
    const end = witherState(1);
    expect(end.alpha).toBe(0);
    expect(end.done).toBe(true);
    expect(end.tint).toBe(1);
    expect(end.squash).toBeLessThan(0.7);
  });

  it('drains colour first, droops, then fades into the soil — monotonically', () => {
    let prev = witherState(0);
    for (let u = 0.01; u <= 1; u += 0.01) {
      const s = witherState(u);
      expect(s.tint).toBeGreaterThanOrEqual(prev.tint);
      expect(s.droop).toBeGreaterThanOrEqual(prev.droop);
      expect(s.squash).toBeLessThanOrEqual(prev.squash);
      expect(s.sink).toBeGreaterThanOrEqual(prev.sink);
      expect(s.alpha).toBeLessThanOrEqual(prev.alpha);
      prev = s;
    }
    const half = witherState(0.5);
    expect(half.tint).toBe(1);
    expect(half.alpha).toBe(1);
    expect(witherState(Number.NaN).alpha).toBe(1);
  });
});

describe('wither pixels', () => {
  it('moves colour toward dry ochre and keeps alpha', () => {
    const px = [80, 140, 60, 200, 120, 100, 200, 90];
    witherPixels(px, 1);
    // ochre hue: r > g > b
    expect(px[0]!).toBeGreaterThan(px[1]!);
    expect(px[1]!).toBeGreaterThan(px[2]!);
    expect(px[4]!).toBeGreaterThan(px[6]!);
    expect(px[3]).toBe(200);
    expect(px[7]).toBe(90);
    const ratio = px[0]! / px[2]!;
    expect(ratio).toBeCloseTo(OCHRE.r / OCHRE.b, 1);
  });

  it('is partial for amounts below one and a no-op at zero', () => {
    const a = [80, 140, 60, 255];
    witherPixels(a, 0);
    expect(a).toEqual([80, 140, 60, 255]);
    const b = [80, 140, 60, 255];
    const c = [80, 140, 60, 255];
    witherPixels(b, 0.5);
    witherPixels(c, 1);
    expect(b[1]!).toBeLessThan(140);
    expect(b[1]!).toBeGreaterThan(c[1]!);
  });
});
