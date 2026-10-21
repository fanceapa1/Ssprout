import { describe, expect, it } from 'vitest';
import { DRY_DEFAULTS, boxBlur, dryPixels, edgeBlur, flatGrain, layerResolution, resolveDry, shapeAlpha } from './wet';

/** w×h RGBA buffer with a filled square of coverage `a` (0..255) in the middle. */
function square(w: number, h: number, inset: number, a = 230): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = inset; y < h - inset; y++)
    for (let x = inset; x < w - inset; x++) {
      const i = (y * w + x) * 4;
      d[i] = 120;
      d[i + 1] = 140;
      d[i + 2] = 100;
      d[i + 3] = a;
    }
  return d;
}

const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3]!;

describe('defaults', () => {
  it('resolveDry merges over defaults and ignores undefined', () => {
    const o = resolveDry({ edge: 0.9, opacity: undefined });
    expect(o.edge).toBe(0.9);
    expect(o.opacity).toBe(DRY_DEFAULTS.opacity);
    expect(o.blend).toBe('multiply');
  });

  it('layer resolution follows quality', () => {
    expect(layerResolution('draft', 100)).toBe(0.5);
    expect(layerResolution('high', 1e8)).toBe(1);
    expect(layerResolution('normal', 1000)).toBe(1);
    expect(layerResolution('normal', 1e7)).toBeLessThan(1);
  });
});

describe('shapeAlpha', () => {
  it('fades stray low coverage, keeps the body', () => {
    expect(shapeAlpha(0, 1)).toBe(0);
    expect(shapeAlpha(0.05, 1)).toBeLessThan(0.02);
    expect(shapeAlpha(0.9, 1)).toBeGreaterThan(0.9);
    expect(shapeAlpha(0.3, 0)).toBe(0.3);
  });
});

describe('blurs', () => {
  it('boxBlur preserves a constant field away from borders', () => {
    const w = 20;
    const src = new Float32Array(w * w).fill(1);
    const b = boxBlur(src, w, w, 2);
    expect(b[10 * w + 10]).toBeCloseTo(1, 5);
    expect(b[0]).toBeLessThan(1); // outside counts as 0
  });

  it('edgeBlur (half resolution) approximates boxBlur', () => {
    const w = 64;
    const src = new Float32Array(w * w);
    for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) src[y * w + x] = 1;
    const a = boxBlur(src, w, w, 4);
    const b = edgeBlur(src, w, w, 4);
    let err = 0;
    for (let i = 0; i < a.length; i++) err = Math.max(err, Math.abs(a[i]! - b[i]!));
    expect(err).toBeLessThan(0.15);
  });
});

describe('dryPixels', () => {
  const w = 60;
  const run = (opts = {}) => {
    const d = square(w, w, 10);
    dryPixels(d, w, w, resolveDry({ flow: 0, granulation: 0, ...opts }), 4, flatGrain(w, w), null);
    return d;
  };

  it('pools pigment at the rim: edge pixels are denser than the centre', () => {
    const d = run({ edge: 0.6, centreLift: 0.3 });
    expect(alphaAt(d, w, 11, 30)).toBeGreaterThan(alphaAt(d, w, 30, 30) + 20);
  });

  it('without edge or lift the body is flat', () => {
    const d = run({ edge: 0, centreLift: 0 });
    expect(Math.abs(alphaAt(d, w, 12, 30) - alphaAt(d, w, 30, 30))).toBeLessThan(4);
  });

  it('leaves empty pixels empty and scales by opacity', () => {
    const full = run({ opacity: 1, edge: 0, centreLift: 0 });
    const half = run({ opacity: 0.5, edge: 0, centreLift: 0 });
    expect(alphaAt(full, w, 2, 2)).toBe(0);
    expect(alphaAt(half, w, 30, 30)).toBeCloseTo(alphaAt(full, w, 30, 30) / 2, -1);
  });

  it('darkens the rim colour', () => {
    const d = run({ edge: 0.6, darken: 0.5 });
    expect(d[(30 * w + 11) * 4]!).toBeLessThan(d[(30 * w + 30) * 4]!);
  });

  it('dry brush removes pigment where the paper is low', () => {
    const d = square(w, w, 10);
    const grain = { data: new Float32Array([0.05, 0.95]), cols: Int32Array.from({ length: w }, (_, x) => x % 2), rows: new Int32Array(w) };
    dryPixels(d, w, w, resolveDry({ flow: 0, granulation: 0, dry: 0.5 }), 4, grain, null);
    expect(alphaAt(d, w, 30, 30)).toBeLessThan(10);
    expect(alphaAt(d, w, 31, 30)).toBeGreaterThan(100);
  });

  it('is deterministic', () => {
    expect(run({ edge: 0.5 })).toEqual(run({ edge: 0.5 }));
  });
});
