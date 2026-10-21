import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { brownNoise, impulseResponse, makeLoopable, normalise, pinkNoise, whiteNoise } from './noise';

const peak = (d: Float32Array) => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = (d: Float32Array, from = 0, to = d.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += d[i]! ** 2;
  return Math.sqrt(s / (to - from));
};
/** mean absolute difference between neighbours: high for bright noise, low for dark noise */
const roughness = (d: Float32Array) => {
  let s = 0;
  for (let i = 1; i < d.length; i++) s += Math.abs(d[i]! - d[i - 1]!);
  return s / (d.length - 1) / (rms(d) || 1);
};

describe('noise generators', () => {
  it('are deterministic and bounded', () => {
    for (const gen of [whiteNoise, pinkNoise, brownNoise]) {
      const a = gen(createRng(1), 4000);
      expect(a).toEqual(gen(createRng(1), 4000));
      expect(peak(a)).toBeLessThanOrEqual(1);
      expect(a.every(Number.isFinite)).toBe(true);
    }
  });

  it('get darker from white to pink to brown', () => {
    const w = roughness(whiteNoise(createRng(2), 20000));
    const p = roughness(pinkNoise(createRng(2), 20000));
    const b = roughness(brownNoise(createRng(2), 20000));
    expect(w).toBeGreaterThan(p);
    expect(p).toBeGreaterThan(b);
  });

  it('normalise scales to the requested peak (and leaves silence alone)', () => {
    expect(peak(normalise(new Float32Array([0.1, -0.2, 0.05]), 0.8))).toBeCloseTo(0.8);
    expect(normalise(new Float32Array(3))).toEqual(new Float32Array(3));
  });

  it('makeLoopable makes the wrap-around continuous', () => {
    const src = brownNoise(createRng(3), 10000);
    const loop = makeLoopable(src, 500);
    expect(loop.length).toBe(9500);
    // the sample after the end (loop[0]) continues the last one like any neighbour pair
    const jump = Math.abs(loop[0]! - loop[loop.length - 1]!);
    expect(jump).toBeLessThan(0.05);
  });
});

describe('impulseResponse', () => {
  it('is stereo, decorrelated and decays', () => {
    const [l, r] = impulseResponse(createRng(4), 8000, 2);
    expect(l.length).toBe(16000);
    expect(l).not.toEqual(r);
    expect(rms(l, 0, 2000)).toBeGreaterThan(rms(l, 12000, 16000) * 10);
    expect(peak(l)).toBeCloseTo(0.5);
  });

  it('starts with a short pre-delay of silence', () => {
    const [l] = impulseResponse(createRng(5), 8000, 1, 0.01);
    expect(l.slice(0, 80).every((v) => v === 0)).toBe(true);
  });
});
