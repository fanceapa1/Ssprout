import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import {
  branchProgress,
  fitTree,
  growChildren,
  growLimb,
  headingAt,
  normalise,
  partialPath,
  pointAt,
  stagger,
  startTree,
  steer,
  treeBounds,
  treeView,
  widthAt,
  wrapAngle,
  type LevelSpec,
} from './tree-structure';

const LEVELS: LevelSpec[] = [
  { count: [2, 4], span: [0.4, 1], angle: [0.3, 0.9], length: [0.5, 0.8] },
  { count: [1, 3], span: [0.2, 1], angle: [0.2, 0.7], length: [0.4, 0.7], limb: { gravity: 0.1 } },
];

function build(seed: number) {
  const rng = createRng(seed);
  const tree = startTree(rng, { x: 100, y: 200 }, { angle: -Math.PI / 2, length: 100, width: 10, tipWidth: 3 });
  growChildren(tree, tree.branches[0]!, LEVELS, rng);
  return normalise(tree);
}

describe('tree structure', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    expect(build(7)).toEqual(build(7));
    expect(JSON.stringify(build(7))).not.toEqual(JSON.stringify(build(8)));
  });

  it('growLimb consumes a fixed amount of randomness regardless of floor clipping', () => {
    const a = createRng(3);
    const b = createRng(3);
    growLimb(a, { x: 0, y: 0 }, Math.PI / 2, 100, { segments: 8 });
    growLimb(b, { x: 0, y: 0 }, Math.PI / 2, 100, { segments: 8, floor: 20 });
    expect(a.next()).toBe(b.next());
  });

  it('floor stops a limb from dipping below it', () => {
    const pts = growLimb(createRng(1), { x: 0, y: 0 }, Math.PI / 2, 100, { segments: 10, floor: 30 });
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts.slice(0, -1).every((p) => p.y <= 30)).toBe(true);
  });

  it('children start where their parent has grown to, and windows end by τ = 1', () => {
    const tree = build(11);
    const ends = tree.branches.map((b) => b.t1);
    expect(Math.max(...ends)).toBeCloseTo(1, 9);
    for (const b of tree.branches) {
      expect(b.t1).toBeGreaterThan(b.t0);
      if (b.parent < 0) continue;
      const p = tree.branches[b.parent]!;
      expect(b.t0).toBeGreaterThanOrEqual(p.t0 + (p.t1 - p.t0) * b.attach - 1e-9);
      expect(b.order).toBe(p.order + 1);
      const at = pointAt(p, b.attach);
      expect(b.pts[0]!.x).toBeCloseTo(at.x, 6);
      expect(b.pts[0]!.y).toBeCloseTo(at.y, 6);
    }
  });

  it('branch progress is monotonic in τ and complete at 1', () => {
    const tree = build(5);
    for (const b of tree.branches) {
      let prev = -1;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const f = branchProgress(b, t);
        expect(f).toBeGreaterThanOrEqual(prev);
        prev = f;
      }
      expect(branchProgress(b, 1)).toBe(1);
      expect(branchProgress(b, 0)).toBe(0);
    }
  });

  it('partial paths are prefixes of the centreline', () => {
    const b = build(2).branches[0]!;
    const half = partialPath(b, 0.5);
    expect(half[0]).toEqual(b.pts[0]);
    const end = half[half.length - 1]!;
    const mid = pointAt(b, 0.5);
    expect(end.x).toBeCloseTo(mid.x, 9);
    expect(partialPath(b, 1)).toEqual(b.pts);
    expect(widthAt(b, 0)).toBe(b.w0);
    expect(widthAt(b, 1)).toBeCloseTo(b.w1, 9);
    expect(Number.isFinite(headingAt(b, 0.3))).toBe(true);
  });

  it('treeView is smooth and monotonic in growth', () => {
    const base = { x: 0, y: 0 };
    let prev = treeView(0, base);
    expect(prev.tau).toBe(0);
    for (let g = 0.01; g <= 1.0001; g += 0.01) {
      const v = treeView(g, base);
      expect(v.tau).toBeGreaterThanOrEqual(prev.tau);
      expect(v.scale).toBeGreaterThanOrEqual(prev.scale);
      expect(v.tau - prev.tau).toBeLessThan(0.06);
      expect(v.scale - prev.scale).toBeLessThan(0.05);
      prev = v;
    }
    expect(treeView(0.5, base).tau).toBeCloseTo(1, 9);
    expect(treeView(1, base).scale).toBeCloseTo(1, 9);
  });

  it('stagger ramps each element in within its window', () => {
    expect(stagger(0.5, 0.5, 0.8, 0, 0.1)).toBe(0);
    expect(stagger(0.6, 0.5, 0.8, 0, 0.1)).toBe(1);
    expect(stagger(0.69, 0.5, 0.8, 1, 0.1)).toBe(0);
    expect(stagger(0.8, 0.5, 0.8, 1, 0.1)).toBe(1);
  });

  it('fitTree keeps every point inside the box', () => {
    const rng = createRng(4);
    const tree = startTree(rng, { x: 50, y: 95 }, { angle: -Math.PI / 2, length: 150, width: 6, tipWidth: 2 });
    growChildren(tree, tree.branches[0]!, LEVELS, rng);
    fitTree(tree, { w: 100, h: 100 }, 5);
    const b = treeBounds(tree);
    expect(b.x).toBeGreaterThanOrEqual(5 - 1e-6);
    expect(b.x + b.w).toBeLessThanOrEqual(95 + 1e-6);
    expect(b.y).toBeGreaterThanOrEqual(5 - 1e-6);
  });

  it('angle helpers wrap and steer along the short way', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(steer(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 9);
    expect(steer(3, -3, 1)).toBeCloseTo(3 + (2 * Math.PI - 6), 9);
  });
});
