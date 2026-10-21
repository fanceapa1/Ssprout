import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { STAGES, ease, easeOut, phase, smooth, smoother, stagger, swell, visible } from './small-growth';
import { bendProfile, lerpAngle, makeStem, pathLen, petalPose, petalRing, pointAt, projectDir, stemPoints, subPath } from './small-structure';

describe('growth staging', () => {
  it('stages tile 0..1 in order', () => {
    expect(STAGES.seed[0]).toBe(0);
    expect(STAGES.seed[1]).toBe(STAGES.stem[0]);
    expect(STAGES.stem[1]).toBe(STAGES.bud[0]);
    expect(STAGES.bud[1]).toBe(STAGES.open[0]);
    expect(STAGES.open[1]).toBe(1);
  });

  it('phase and eases are clamped, monotonic and rest at both ends', () => {
    expect(phase(-1, 0.2, 0.4)).toBe(0);
    expect(phase(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    expect(phase(2, 0.2, 0.4)).toBe(1);
    expect(phase(0.5, 0.4, 0.4)).toBe(1);
    for (const f of [smooth, smoother, easeOut]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
      let prev = -1;
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const v = f(t);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
    // smoothstep starts with zero slope: no visible jump right after an element appears
    expect(ease(0.201, 0.2, 0.4) - ease(0.2, 0.2, 0.4)).toBeLessThan(1e-4);
  });

  it('stagger spreads windows across a span with overlap', () => {
    const w = [0, 1, 2, 3].map((i) => stagger(i, 4, [0.2, 0.6], 0.5));
    expect(w[0]![0]).toBeCloseTo(0.2);
    expect(w[3]![1]).toBeCloseTo(0.6);
    for (const [a, b] of w) expect(b - a).toBeCloseTo(0.2);
    expect(stagger(0, 1, [0.2, 0.6], 0.5)).toEqual([0.2, 0.4]);
  });

  it('swell rises then settles to rest', () => {
    expect(swell(0, [0.1, 0.2], [0.5, 0.6], 0.3)).toBe(0);
    expect(swell(0.3, [0.1, 0.2], [0.5, 0.6], 0.3)).toBe(1);
    expect(swell(1, [0.1, 0.2], [0.5, 0.6], 0.3)).toBeCloseTo(0.3);
  });

  it('visible gates near-zero elements', () => {
    expect(visible(0)).toBe(false);
    expect(visible(0.5)).toBe(true);
  });
});

describe('plant structure', () => {
  it('makeStem / bendProfile are deterministic and growth-independent', () => {
    const a = makeStem(createRng(3), { length: 30, angle: -1.5, bend: 0.8, segments: 6 });
    const b = makeStem(createRng(3), { length: 30, angle: -1.5, bend: 0.8, segments: 6 });
    expect(a).toEqual(b);
    const bends = bendProfile(createRng(1), 10, 1, 1, 0);
    expect(bends.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    expect(bends[9]!).toBeGreaterThan(bends[0]!);
  });

  it('stemPoints grows continuously from the base', () => {
    const s = makeStem(createRng(5), { length: 40, angle: -Math.PI / 2, bend: 0.5 });
    expect(pathLen(stemPoints(s, 0))).toBe(0);
    expect(pathLen(stemPoints(s, 1))).toBeCloseTo(40);
    expect(pathLen(stemPoints(s, 0.5))).toBeCloseTo(20);
    const p1 = stemPoints(s, 0.5);
    const p2 = stemPoints(s, 0.501);
    expect(Math.hypot(p1.at(-1)!.x - p2.at(-1)!.x, p1.at(-1)!.y - p2.at(-1)!.y)).toBeLessThan(0.1);
    expect(stemPoints(s, 1).length).toBe(s.bends.length + 1);
  });

  it('pointAt and subPath follow arc length', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(pointAt(pts, 0.25)).toMatchObject({ x: 5, y: 0, angle: 0 });
    expect(pointAt(pts, 0.75)).toMatchObject({ x: 10, y: 5 });
    expect(pathLen(subPath(pts, 0.75))).toBeCloseTo(15);
    expect(pointAt([{ x: 1, y: 2 }], 0.5)).toMatchObject({ x: 1, y: 2 });
  });

  it('lerpAngle takes the short way round', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('petal rings are irregular but deterministic', () => {
    const a = petalRing(createRng(9), 5);
    expect(a).toEqual(petalRing(createRng(9), 5));
    expect(new Set(a.map((p) => p.len.toFixed(4))).size).toBe(5);
  });

  it('flower projection foreshortens and closed petals gather along the face', () => {
    const face = { tilt: 1, roll: -Math.PI / 2 };
    const side = { tilt: 0.3, roll: -Math.PI / 2 };
    expect(Math.hypot(projectDir(0.7, face).x, projectDir(0.7, face).y)).toBeCloseTo(1);
    const d = projectDir(Math.PI / 2, side);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(0.3);
    const closed = petalPose(0, side, 0);
    expect(closed.angle).toBeCloseTo(-Math.PI / 2 + 0.35);
    const open = petalPose(0, side, 1);
    expect(open.angle).toBeCloseTo(0);
    // halfway the petal swings, it does not collapse through the centre
    expect(petalPose(0, side, 0.5).len).toBeGreaterThan(0.4);
  });
});
