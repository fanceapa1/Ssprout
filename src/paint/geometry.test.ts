import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  area,
  blob,
  bounds,
  closedResample,
  dabOutline,
  dabProfile,
  deformPolygon,
  insetPolygon,
  organicOutline,
  outlineLayer,
  pathLength,
  pointInPolygon,
  resample,
  ribbon,
  smoothPath,
  smoothPolygon,
  stoneShape,
  type Pt,
} from './geometry';

const square: Pt[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('deformPolygon', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    const a = deformPolygon(square, createRng(7), { depth: 3 });
    expect(deformPolygon(square, createRng(7), { depth: 3 })).toEqual(a);
    expect(deformPolygon(square, createRng(8), { depth: 3 })).not.toEqual(a);
  });

  it('doubles the vertex count per level and keeps original vertices', () => {
    const d = deformPolygon(square, createRng(1), { depth: 3 });
    expect(d).toHaveLength(4 * 8);
    expect(d[0]).toEqual(square[0]);
    expect(d[8]).toEqual(square[1]);
  });

  it('depth 0 returns a copy', () => {
    expect(deformPolygon(square, createRng(1), { depth: 0 })).toEqual(square);
  });

  it('cap bounds the displacement', () => {
    const d = deformPolygon(square, createRng(3), { depth: 1, variance: 5, cap: 2 });
    // midpoints of the top edge stay within a few s.d. of y = 0
    expect(Math.abs(d[1]!.y)).toBeLessThan(2 * 2 * 3.1);
  });

  it('roughly preserves area with modest variance', () => {
    const d = deformPolygon(square, createRng(5), { depth: 4, variance: 0.2 });
    expect(Math.abs(area(d))).toBeGreaterThan(7000);
    expect(Math.abs(area(d))).toBeLessThan(13000);
  });
});

describe('insetPolygon', () => {
  it('moves vertices inward for either orientation', () => {
    for (const poly of [square, square.slice().reverse()]) {
      const b = bounds(insetPolygon(poly, 5));
      expect(b.x).toBeGreaterThan(3); // corners move along the diagonal
      expect(b.x).toBeLessThan(6);
      expect(b.w).toBeLessThan(100);
    }
  });
});

describe('organic outlines', () => {
  it('are deterministic and layers differ from each other', () => {
    const o1 = organicOutline(square, createRng(2));
    const o2 = organicOutline(square, createRng(2));
    expect(o1.base).toEqual(o2.base);
    const rng = createRng(3);
    expect(outlineLayer(o1, rng, 0.2)).not.toEqual(outlineLayer(o1, rng, 0.2));
  });

  it('keep long thin shapes free of large spikes', () => {
    const strip: Pt[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 40 },
      { x: 0, y: 40 },
    ];
    const o = organicOutline(strip, createRng(4));
    const b = bounds(outlineLayer(o, createRng(5), 0.2));
    expect(b.h).toBeLessThan(40 * 1.6);
    expect(b.w).toBeLessThan(1000 * 1.05);
  });
});

describe('blob / stoneShape', () => {
  it('blob stays near its radii', () => {
    const b = bounds(blob(50, 50, 40, 20, createRng(1), { irregularity: 0.1 }));
    expect(b.w).toBeGreaterThan(60);
    expect(b.w).toBeLessThan(100);
    expect(b.h).toBeLessThan(50);
  });

  it('stoneShape sits on its base point', () => {
    const s = stoneShape(200, 300, 120, 60, createRng(2));
    const b = bounds(s);
    expect(b.y + b.h).toBeCloseTo(300, 5);
    expect(b.h).toBeCloseTo(60, 5);
    expect(pointInPolygon({ x: 200, y: 270 }, s)).toBe(true);
  });
});

describe('paths', () => {
  it('resample keeps end points and spacing', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const r = resample(line, 10);
    expect(r[0]).toEqual(line[0]);
    expect(r[r.length - 1]).toEqual(line[1]);
    expect(r).toHaveLength(11);
  });

  it('closedResample spaces a loop evenly', () => {
    const r = closedResample(square, 25);
    expect(r).toHaveLength(16);
  });

  it('smoothPath passes through end points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ];
    const s = smoothPath(pts, 2);
    expect(s[0]).toEqual(pts[0]);
    expect(s[s.length - 1]).toEqual(pts[2]);
    expect(pathLength(s)).toBeGreaterThan(128);
  });

  it('smoothPolygon doubles vertices and stays inside the hull', () => {
    const s = smoothPolygon(square, 2);
    expect(s).toHaveLength(16);
    for (const p of s) expect(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100).toBe(true);
  });

  it('ribbon has both sides at the requested half width', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const r = ribbon(path, () => 5);
    expect(r).toHaveLength(4);
    expect(Math.abs(r[0]!.y)).toBeCloseTo(5);
    expect(Math.abs(r[3]!.y)).toBeCloseTo(5);
  });
});

describe('dabs', () => {
  it('profiles taper to zero at both ends and peak at 0.5', () => {
    for (const v of ['leaf', 'petal', 'blade', 'needle', 'round'] as const) {
      expect(dabProfile(v, 0)).toBeCloseTo(0, 6);
      expect(dabProfile(v, 1)).toBeCloseTo(0, 6);
      const max = Math.max(...Array.from({ length: 101 }, (_, i) => dabProfile(v, i / 100)));
      expect(max).toBeCloseTo(0.5, 2);
    }
  });

  it('petals are widest nearer the tip than leaves, blades near the base', () => {
    const peak = (v: 'leaf' | 'petal' | 'blade') => {
      let best = 0;
      for (let i = 0; i <= 100; i++) if (dabProfile(v, i / 100) > dabProfile(v, best / 100)) best = i;
      return best / 100;
    };
    expect(peak('petal')).toBeGreaterThan(peak('leaf'));
    expect(peak('blade')).toBeLessThan(peak('leaf'));
  });

  it('outline points from the base toward the angle with the requested length', () => {
    const o = dabOutline(0, 0, { angle: -Math.PI / 2, length: 40, width: 10 });
    const b = bounds(o);
    expect(b.y).toBeCloseTo(-40, 0);
    expect(b.y + b.h).toBeCloseTo(0, 0);
    expect(b.w).toBeLessThanOrEqual(10.01);
  });

  it('asymmetry makes one flank fuller', () => {
    const o = dabOutline(0, 0, { angle: -Math.PI / 2, length: 40, width: 10, asym: 0.5 });
    const b = bounds(o);
    expect(Math.abs(b.x + b.w)).not.toBeCloseTo(Math.abs(b.x), 1);
  });
});
