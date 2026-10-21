// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import * as paint from './index';
import { breakPath, dabShape, layerAlpha, layersFor, strokeGeometry } from './primitives';
import { foliageLayout } from './recipes';

describe('engine import', () => {
  it('is safe without a canvas implementation (jsdom)', () => {
    expect(typeof paint.createPainter).toBe('function');
    expect(paint.PIGMENTS.washi).toBe('#f3ecd9');
    // jsdom has no 2D context: creating a painter fails loudly, not at import time
    expect(() => paint.createPainter(document.createElement('canvas'))).toThrow(/2D canvas context/);
  });

  it('makeCanvas falls back to a DOM canvas', () => {
    const c = paint.makeCanvas(10.2, 3);
    expect(c.width).toBe(11);
    expect(c.height).toBe(3);
  });
});

describe('parameter defaults', () => {
  it('match the documented values', () => {
    expect(paint.DRY_DEFAULTS).toMatchObject({ opacity: 0.85, edge: 0.5, sharpness: 0.6, granulation: 0.2, blend: 'multiply' });
    expect(paint.WASH_DEFAULTS).toMatchObject({ layers: 16, deform: 0.3, spread: 0.15, blooms: 0 });
    expect(paint.DAB_DEFAULTS).toMatchObject({ angle: -Math.PI / 2, length: 22, variant: 'leaf', layers: 4 });
    expect(paint.INK_DEFAULTS.width).toBe(1.6);
    expect(paint.STROKE_DEFAULTS.dryness).toBe(0);
    expect(paint.GLAZE_DEFAULTS.opacity).toBeLessThan(paint.DRY_DEFAULTS.opacity);
  });

  it('quality scales layer counts', () => {
    const env = (quality: paint.Quality) => ({ ...paint.createEnv({ quality }) });
    expect(layersFor(env('draft'), 16)).toBe(8);
    expect(layersFor(env('normal'), 16)).toBe(16);
    expect(layersFor(env('high'), 16)).toBeGreaterThan(16);
    expect(layersFor(env('draft'), 1)).toBe(1);
  });

  it('layerAlpha reaches the requested coverage', () => {
    for (const n of [1, 4, 16]) {
      const a = layerAlpha(n, 0.9);
      expect(1 - (1 - a) ** n).toBeCloseTo(0.9, 6);
    }
  });
});

describe('pure brush geometry', () => {
  it('dabShape is deterministic per seed', () => {
    const a = dabShape({ x: 10, y: 10 }, { length: 30, variant: 'petal' }, createRng(3));
    const b = dabShape({ x: 10, y: 10 }, { length: 30, variant: 'petal' }, createRng(3));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(30 * 0.9);
    expect(a.length).toBeLessThan(30 * 1.1);
  });

  it('breakPath splits long lines and never breaks near the ends', () => {
    const path = Array.from({ length: 400 }, (_, i) => ({ x: i, y: 0 }));
    const pieces = breakPath(path, 1, 1, createRng(1));
    expect(pieces.length).toBeGreaterThan(2);
    expect(pieces[0]![0]).toBe(path[0]);
    expect(pieces[pieces.length - 1]!.at(-1)).toBe(path[399]);
    expect(breakPath(path, 1, 0, createRng(1))).toHaveLength(1);
  });

  it('strokeGeometry tapers to nothing at the ends', () => {
    const env = paint.createEnv();
    const g = strokeGeometry([{ x: 0, y: 0 }, { x: 100, y: 0 }], { width: 10, taper: [0.2, 0.2] }, env.flowNoise, createRng(1));
    expect(g.hw(0)).toBeCloseTo(0, 6);
    expect(g.hw(1)).toBeCloseTo(0, 6);
    expect(g.hw(0.5)).toBeGreaterThan(3);
  });

  it('foliageLayout is seeded, lit on the light side', () => {
    const a = foliageLayout({ x: 0, y: 0 }, 60, createRng(4));
    expect(foliageLayout({ x: 0, y: 0 }, 60, createRng(4))).toEqual(a);
    expect(a.length).toBeGreaterThan(20);
    const top = a.filter((d) => d.y < -15);
    const bottom = a.filter((d) => d.y > 15);
    const mean = (xs: { lit: number }[]) => xs.reduce((s, d) => s + d.lit, 0) / xs.length;
    expect(mean(top)).toBeGreaterThan(mean(bottom));
  });
});
