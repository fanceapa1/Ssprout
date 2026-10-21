import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { placeholderScene } from '../scene/geometry';
import {
  angleDiff,
  approach,
  arrive,
  closestOnPolygon,
  containPoint,
  cubic,
  cubicLength,
  inHours,
  insideWithMargin,
  isOffscreen,
  offscreenPoint,
  pointInPolygon,
  polygonCentroid,
  randomPointInside,
  springStep,
  toPlane,
  toWorld,
  turnToward,
} from './math';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('angles', () => {
  it('angleDiff takes the short way round', () => {
    expect(angleDiff(0, 0.5)).toBeCloseTo(0.5);
    expect(angleDiff(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDiff(-3, 3)).toBeCloseTo(6 - 2 * Math.PI);
  });

  it('turnToward is rate-limited and lands exactly', () => {
    expect(turnToward(0, 1, 0.5, 1)).toBeCloseTo(0.5);
    expect(turnToward(0, 0.2, 0.5, 1)).toBe(0.2);
    expect(turnToward(3, -3, 0.1, 1)).toBeCloseTo(3.1); // through π, not back through 0
  });
});

describe('easing motion', () => {
  it('approach converges independent of frame rate', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = approach(a, 10, 2, 1 / 60);
    let b = 0;
    for (let i = 0; i < 10; i++) b = approach(b, 10, 2, 1 / 10);
    expect(a).toBeCloseTo(b, 5);
  });

  it('springStep settles on the target without overshooting much', () => {
    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    let maxX = 0;
    for (let i = 0; i < 240; i++) {
      springStep(pos, vel, { x: 50, y: -20 }, 8, 1 / 60);
      maxX = Math.max(maxX, pos.x);
    }
    expect(pos.x).toBeCloseTo(50, 1);
    expect(pos.y).toBeCloseTo(-20, 1);
    expect(maxX).toBeLessThan(51);
  });

  it('arrive respects max speed and slows down near the target', () => {
    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    let top = 0;
    for (let i = 0; i < 600; i++) {
      arrive(pos, vel, { x: 200, y: 0 }, 40, 80, 30, 1 / 60);
      top = Math.max(top, Math.hypot(vel.x, vel.y));
    }
    expect(top).toBeLessThanOrEqual(40.001);
    expect(pos.x).toBeCloseTo(200, 0);
    expect(Math.hypot(vel.x, vel.y)).toBeLessThan(1);
  });
});

describe('polygons', () => {
  it('pointInPolygon and margins', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
    expect(insideWithMargin({ x: 5, y: 50 }, square, 10)).toBe(false);
    expect(insideWithMargin({ x: 15, y: 50 }, square, 10)).toBe(true);
    expect(closestOnPolygon({ x: 50, y: -10 }, square).pt).toEqual({ x: 50, y: 0 });
  });

  it('randomPointInside stays inside the pond with a margin (seeded)', () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      const p = randomPointInside(placeholderScene.pond, rng, 20);
      expect(insideWithMargin(p, placeholderScene.pond, 20)).toBe(true);
    }
  });

  it('containPoint pulls an escaped point back inside', () => {
    const p = containPoint({ x: 140, y: 50 }, square, 10);
    expect(insideWithMargin(p, square, 9.99)).toBe(true);
    expect(containPoint({ x: 50, y: 50 }, square, 10)).toEqual({ x: 50, y: 50 });
  });

  it('centroid of a square', () => {
    expect(polygonCentroid(square)).toEqual({ x: 50, y: 50 });
  });

  it('plane ↔ world round-trips', () => {
    const w = { x: 10, y: 600 };
    const p = toPlane(w, 560, 0.4);
    expect(p.y).toBeCloseTo(660);
    expect(toWorld(p, 560, 0.4).y).toBeCloseTo(600);
  });
});

describe('paths and screen', () => {
  it('cubic passes through its ends and has a sensible length', () => {
    const a = { x: 0, y: 0 };
    const d = { x: 100, y: 0 };
    expect(cubic(a, a, d, d, 0)).toEqual(a);
    expect(cubic(a, a, d, d, 1)).toEqual(d);
    expect(cubicLength(a, a, d, d)).toBeCloseTo(100, 0);
  });

  it('offscreen points are outside the view', () => {
    const view = { x: 100, y: 0, w: 800, h: 600 };
    expect(isOffscreen(offscreenPoint(view, -1, 300, 40), view, 30)).toBe(true);
    expect(isOffscreen(offscreenPoint(view, 1, 300, 40), view, 30)).toBe(true);
    expect(isOffscreen({ x: 500, y: 300 }, view, 0)).toBe(false);
  });

  it('inHours wraps midnight', () => {
    expect(inHours(23, [20, 5])).toBe(true);
    expect(inHours(3, [20, 5])).toBe(true);
    expect(inHours(12, [20, 5])).toBe(false);
    expect(inHours(9, [8, 17])).toBe(true);
  });
});
