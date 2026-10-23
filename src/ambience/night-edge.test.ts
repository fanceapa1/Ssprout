import { describe, expect, it } from 'vitest';
import { fadeHeight, featherWidth } from '../ui/stage-edge';
import { blendWeights, only, pinnedState } from './daylight';
import { edgeBand, edgeStrength, nightEdgeFields } from './night-edge';

describe('night edge (ADR 0184)', () => {
  it('uses the same bands as the stage mask it sits inside', () => {
    for (const [w, h] of [
      [1412, 790],
      [1892, 950],
      [374, 742],
      [800, 300],
    ]) {
      expect(edgeBand(w!, h!)).toEqual({ feather: featherWidth(w!, h!), fade: fadeHeight(h!) });
    }
  });

  it('holds the edge back in dark light only: nothing at midday, all of it at night', () => {
    expect(edgeStrength(pinnedState(only('midday')))).toBe(0);
    expect(edgeStrength(pinnedState(only('night')))).toBe(1);
    const dusk = edgeStrength(pinnedState(blendWeights('sunset', 'night', 0.5)));
    expect(dusk).toBeGreaterThan(edgeStrength(pinnedState(only('sunset'))));
    expect(dusk).toBeLessThan(1);
  });

  it('lifts the margin to paper and leaves the garden alone, with a short broken edge (not a haze)', () => {
    const w = 600;
    const h = 400;
    const f = nightEdgeFields({ w, h, cssPerPx: 1, seed: 3 });
    const at = (a: Float32Array, x: number, y: number) => a[y * w + x]!;
    // the middle untouched, the very margins fully paper
    expect(at(f.lift, 300, 200)).toBe(0);
    for (const [x, y] of [
      [1, 200],
      [598, 200],
      [300, 1],
    ]) {
      expect(at(f.lift, x!, y!)).toBeGreaterThan(0.95);
    }
    // the bottom thins out more slowly (the stage's own dissolve finishes it)
    expect(at(f.lift, 300, 398)).toBeGreaterThan(0.5);
    // along a row from the left: from no lift to full lift within a few tens of CSS px
    const row = 180;
    let first = -1;
    let full = -1;
    for (let x = 120; x >= 0; x--) {
      const l = at(f.lift, x, row);
      if (first < 0 && l > 0.05) first = x;
      if (full < 0 && l > 0.95) full = x;
    }
    expect(first).toBeGreaterThan(0);
    expect(full).toBeGreaterThanOrEqual(0);
    expect(first - full).toBeLessThan(45);
    // a pooled rim just inside the line, and none deep inside
    let rim = 0;
    for (let x = first; x < first + 12; x++) rim = Math.max(rim, at(f.rim, x, row));
    expect(rim).toBeGreaterThan(0.3);
    expect(at(f.rim, 300, 200)).toBe(0);
  });

  it('is deterministic per seed', () => {
    const a = nightEdgeFields({ w: 120, h: 80, cssPerPx: 2, seed: 'x' });
    const b = nightEdgeFields({ w: 120, h: 80, cssPerPx: 2, seed: 'x' });
    expect(a.lift).toEqual(b.lift);
  });
});
