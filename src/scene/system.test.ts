import { describe, expect, it } from 'vitest';
import { createViewport } from '../render/viewport';
import { canReuse, paintViewFor } from './system';

describe('scene paint view', () => {
  it('paints the whole world on a landscape screen, at the device scale', () => {
    const v = paintViewFor(createViewport(1440, 900, 1), 1.5, 60);
    expect(v.rect).toEqual({ x: 0, y: 0, w: 1600, h: 1000 });
    expect(v.scale).toBeCloseTo(0.9);
  });

  it('caps the paint scale (the bitmap is upscaled beyond it)', () => {
    expect(paintViewFor(createViewport(1440, 900, 2), 1.5, 60).scale).toBe(1.5);
    expect(paintViewFor(createViewport(1920, 1080, 2), 1.5, 60).scale).toBe(1.5);
  });

  it('paints only the visible strip (+ margin) on a portrait phone', () => {
    const vp = createViewport(390, 844, 3);
    const v = paintViewFor(vp, 1.5, 60);
    expect(v.rect.x).toBeLessThanOrEqual(vp.visible.x - 59);
    expect(v.rect.x + v.rect.w).toBeGreaterThanOrEqual(vp.visible.x + vp.visible.w + 59);
    expect(v.rect.w).toBeLessThan(800); // MIN_VISIBLE_W (600) + margins
    expect(v.rect.h).toBe(1000);
  });
});

describe('scene repaint rule', () => {
  const base = paintViewFor(createViewport(1440, 900, 1), 4, 60);

  it('rescales the cached painting when the scale changes by 10 % or less', () => {
    const smaller = paintViewFor(createViewport(1440 * 0.92, 900 * 0.92, 1), 4, 0);
    expect(canReuse(base, smaller, 0.1)).toBe(true);
  });

  it('repaints when the scale changes by more than 10 %', () => {
    const bigger = paintViewFor(createViewport(1440 * 1.15, 900 * 1.15, 1), 4, 0);
    expect(canReuse(base, bigger, 0.1)).toBe(false);
  });

  it('repaints when the view leaves the painted area', () => {
    const phone = paintViewFor(createViewport(1024, 1366, 1), 4, 60);
    const wider = paintViewFor(createViewport(1300, 1366, 1), 4, 0);
    expect(wider.scale / phone.scale).toBeCloseTo(1);
    expect(canReuse(phone, wider, 0.1)).toBe(false);
  });
});
