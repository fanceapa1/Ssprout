import { describe, expect, it } from 'vitest';
import { createViewport, DEFAULT_FOCUS, MIN_VISIBLE_W, WORLD_H, WORLD_W } from './viewport';

describe('createViewport', () => {
  it('maps the whole world exactly when the aspect matches', () => {
    const v = createViewport(800, 500, 1);
    expect(v.scale).toBe(0.5);
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(0);
    expect(v.worldToScreen({ x: WORLD_W, y: WORLD_H })).toEqual({ x: 800, y: 500 });
  });

  it('covers a wide screen by cropping top/bottom around the focus', () => {
    const v = createViewport(1920, 1080, 1);
    expect(v.scale).toBeCloseTo(1.2);
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBeLessThan(0);
    // the whole width is visible, the focus stays as central as possible
    expect(v.visible.x).toBeCloseTo(0);
    expect(v.visible.w).toBeCloseTo(WORLD_W);
    expect(v.visible.y).toBeGreaterThanOrEqual(0);
    expect(v.visible.y + v.visible.h).toBeLessThanOrEqual(WORLD_H + 1e-9);
  });

  it('crops the sides on portrait screens and keeps the focus centred', () => {
    // a tablet in portrait: plain cover, the full height, the sides cropped
    const t = createViewport(1024, 1366, 2);
    expect(t.scale).toBeCloseTo(1366 / WORLD_H);
    expect(t.offsetY).toBe(0);
    expect(t.worldToScreen(DEFAULT_FOCUS).x).toBeCloseTo(512);
    expect(t.visible.w).toBeLessThan(WORLD_W);
  });

  it('shows tall phones at least MIN_VISIBLE_W of the world, with paper above and below', () => {
    const v = createViewport(390, 844, 3);
    expect(v.visible.w).toBeCloseTo(MIN_VISIBLE_W);
    expect(v.scale).toBeCloseTo(390 / MIN_VISIBLE_W);
    expect(v.worldToScreen(DEFAULT_FOCUS).x).toBeCloseTo(195);
    // the painting sits in the middle: equal paper above and below
    expect(v.offsetY).toBeGreaterThan(0);
    expect(v.visible.y).toBeLessThan(0);
    expect(v.visible.y + v.visible.h - WORLD_H).toBeCloseTo(-v.visible.y);
  });

  it('clamps the focus so the world edge is never passed', () => {
    const v = createViewport(390, 844, 1, { x: 0, y: 500 });
    expect(v.offsetX).toBe(0);
    const r = createViewport(390, 844, 1, { x: WORLD_W, y: 500 });
    expect(r.visible.x + r.visible.w).toBeCloseTo(WORLD_W);
  });

  it('worldToScreen and screenToWorld are inverse', () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
      [1920, 1080],
      [1024, 1366],
    ] as const) {
      const v = createViewport(w, h, 2);
      const p = { x: 321.5, y: 777.25 };
      const back = v.screenToWorld(v.worldToScreen(p));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it('caps the device pixel ratio at 2 and sizes the backing store', () => {
    const v = createViewport(390, 844, 3);
    expect(v.dpr).toBe(2);
    expect(v.pixelW).toBe(780);
    expect(v.pixelH).toBe(1688);
    expect(v.pixelScale).toBeCloseTo(v.scale * 2);
    expect(createViewport(100, 100, 0).dpr).toBe(1);
    expect(createViewport(100, 100, Number.NaN).dpr).toBe(1);
  });

  it('survives zero-sized canvases', () => {
    const v = createViewport(0, 0, 1);
    expect(Number.isFinite(v.scale)).toBe(true);
    expect(v.scale).toBeGreaterThan(0);
  });

  it('applyTo sets a world-unit transform', () => {
    const v = createViewport(1600, 1000, 2);
    const calls: number[][] = [];
    const ctx = { setTransform: (...a: number[]) => calls.push(a) } as unknown as CanvasRenderingContext2D;
    v.applyTo(ctx);
    expect(calls[0]).toEqual([2, 0, 0, 2, 0, 0]);
  });
});
