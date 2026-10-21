import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { PHASES, ramp, stagger } from './shrub-growth';
import { headFlorets } from './shrub-heads';
import {
  domeLeaves,
  domeScatter,
  growOutward,
  growSkeleton,
  leafSpray,
  partialPath,
  petalVector,
  pointAt,
  polyLength,
  terminalBranches,
} from './shrub-structure';

const SKELETON = { stems: [3, 5] as [number, number], height: 90, spread: 1.2, levels: 2, branches: [1, 2] as [number, number], window: [0.05, 0.42] as [number, number] };

describe('shrub growth timing', () => {
  it('phases tile 0..1 in order', () => {
    expect(PHASES.seed[0]).toBe(0);
    expect(PHASES.seed[1]).toBe(PHASES.stems[0]);
    expect(PHASES.stems[1]).toBe(PHASES.buds[0]);
    expect(PHASES.buds[1]).toBe(PHASES.bloom[0]);
    expect(PHASES.bloom[1]).toBe(1);
  });

  it('ramp is smooth, clamped and monotonic', () => {
    expect(ramp(0.1, 0.2, 0.4)).toBe(0);
    expect(ramp(0.5, 0.2, 0.4)).toBe(1);
    expect(ramp(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    let prev = -1;
    for (let g = 0; g <= 1; g += 0.01) {
      const v = ramp(g, 0.2, 0.7);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(ramp(0.5, 0.5, 0.5)).toBe(1); // empty window is a step
  });

  it('stagger spreads windows across the span', () => {
    const w = [0, 1, 2, 3].map((i) => stagger(i, 4, 0.75, 1, 0.5));
    expect(w[0]![0]).toBe(0.75);
    expect(w[3]![1]).toBeCloseTo(1);
    for (const [a, b] of w) expect(b - a).toBeCloseTo(0.125);
    expect(stagger(0, 1, 0.2, 0.6, 0.5)).toEqual([0.2, 0.4]);
  });
});

describe('polylines', () => {
  const path = [{ x: 0, y: 0 }, { x: 0, y: -10 }, { x: 10, y: -10 }];

  it('partialPath cuts by arc length', () => {
    const half = partialPath(path, 0.5);
    expect(polyLength(half)).toBeCloseTo(10);
    expect(half[half.length - 1]).toEqual({ x: 0, y: -10 });
    expect(partialPath(path, 1)).toEqual(path);
    expect(partialPath(path, 0).length).toBeGreaterThanOrEqual(2);
  });

  it('pointAt interpolates along the path', () => {
    expect(pointAt(path, 0.75)).toEqual({ x: 5, y: -10 });
  });
});

describe('structure generators are deterministic', () => {
  it('growSkeleton: same seed, same plant; children start when the parent passes the fork', () => {
    const a = growSkeleton(createRng(7), SKELETON);
    const b = growSkeleton(createRng(7), SKELETON);
    expect(a).toEqual(b);
    expect(growSkeleton(createRng(8), SKELETON)).not.toEqual(a);
    for (const br of a) {
      expect(br.t1).toBeGreaterThan(br.t0);
      expect(br.t1).toBeLessThanOrEqual(0.42 + 1e-9);
      if (br.parent >= 0) {
        const parent = a[br.parent]!;
        expect(br.t0).toBeGreaterThanOrEqual(parent.t0);
        expect(br.t0).toBeLessThanOrEqual(parent.t1);
        expect(br.depth).toBe(parent.depth + 1);
      }
    }
    expect(terminalBranches(a).length).toBeGreaterThan(0);
    expect(a.filter((x) => x.depth === 0).length).toBeGreaterThanOrEqual(3);
  });

  it('domeScatter keeps points on the dome, apart, sorted back to front', () => {
    const pts = domeScatter(createRng(3), 20, { rx: 60, ry: 50, spacing: 10 });
    expect(pts).toEqual(domeScatter(createRng(3), 20, { rx: 60, ry: 50, spacing: 10 }));
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i]!;
      expect(q.y).toBeLessThanOrEqual(0);
      expect((q.x / 60) ** 2 + (q.y / 50) ** 2).toBeLessThanOrEqual(1 + 1e-9);
      if (i > 0) expect(q.z).toBeGreaterThanOrEqual(pts[i - 1]!.z);
      for (let j = 0; j < i; j++) expect(Math.hypot(q.x - pts[j]!.x, q.y - pts[j]!.y)).toBeGreaterThanOrEqual(10);
    }
  });

  it('leafSpray and domeLeaves', () => {
    const s = leafSpray(createRng(1), { x: 0, y: 0 }, -1.2, 20, '#8d9a6c', 0.2, { leaflets: [3, 3], lobes: [2, 2], petiole: 0.3 });
    expect(s.length).toBe(6);
    expect(s).toEqual(leafSpray(createRng(1), { x: 0, y: 0 }, -1.2, 20, '#8d9a6c', 0.2, { leaflets: [3, 3], lobes: [2, 2], petiole: 0.3 }));
    for (const l of s) {
      expect(l.t0).toBeGreaterThanOrEqual(0.2);
      expect(l.t1).toBeCloseTo(0.33);
    }
    const opts = { rx: 60, ry: 70, sprays: 12, size: [16, 20] as [number, number], window: [0.15, 0.5] as [number, number], pigments: { light: '#c3c79d', mid: '#a9b386', shadow: '#8d9a6c' } };
    const d = domeLeaves(createRng(5), opts);
    expect(d).toEqual(domeLeaves(createRng(5), opts));
    for (const l of d) {
      expect(l.t0).toBeGreaterThanOrEqual(0.15);
      expect(l.t1).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('growOutward times the heart first', () => {
    const items = [{ x: 0, y: -10, t0: 0, t1: 0 }, { x: 50, y: -10, t0: 0, t1: 0 }, { x: 0, y: -60, t0: 0, t1: 0 }];
    growOutward(items, { cx: 0, rx: 60, ry: 60, window: [0.2, 0.6], len: 0.2 });
    expect(items[0]!.t0).toBeLessThan(items[1]!.t0);
    expect(items[0]!.t0).toBeLessThan(items[2]!.t0);
    for (const it of items) expect(it.t1).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  it('headFlorets are deterministic and inside the head', () => {
    const f = headFlorets(createRng(9), 40, 0.2);
    expect(f).toEqual(headFlorets(createRng(9), 40, 0.2));
    expect(f.length).toBeGreaterThan(25);
    for (const q of f) expect(Math.hypot(q.u, q.v)).toBeLessThanOrEqual(1.0001);
  });
});

describe('petalVector', () => {
  it('a flat flower seen face-on shows petals at full length in their own direction', () => {
    const v = petalVector(0, Math.PI / 2, Math.PI / 2);
    expect(v.scale).toBeCloseTo(1);
    expect(v.angle).toBeCloseTo(0);
  });

  it('a closed bud points up the screen, foreshortened by the view', () => {
    const v = petalVector(1.3, 0, 0.6);
    expect(v.angle).toBeCloseTo(-Math.PI / 2);
    expect(v.scale).toBeCloseTo(Math.cos(0.6));
  });

  it('petals toward the viewer are in front', () => {
    expect(petalVector(Math.PI / 2, 1, 0.5).front).toBeGreaterThan(petalVector(-Math.PI / 2, 1, 0.5).front);
  });
});
