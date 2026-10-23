import { describe, expect, it } from 'vitest';
import { brushOutline, CLEARANCE, layoutPath, pointsInBoxes, stonePath, type PathPlan } from './wayfinding-path';

/** The guiding path's maths (ADR 0202). */
const desktop: PathPlan = {
  start: { x: 700, y: 20 },
  lane: 210,
  contentLeft: 244,
  clearTop: 200,
  stops: [
    { id: 'session', y: 215 },
    { id: 'plant', y: 900 },
    { id: 'calendar', y: 1500 },
    { id: 'tools', y: 2300 },
  ],
  tail: 80,
  sway: 12,
  seed: 1,
};

describe('layoutPath', () => {
  it('starts at the stones and passes every stop in order, on the lane', () => {
    const l = layoutPath(desktop);
    expect(l.points[0]).toMatchObject({ x: 700, y: 20 });
    expect(l.stops.map((s) => s.id)).toEqual(['session', 'plant', 'calendar', 'tools']);
    for (const s of l.stops) expect(s.x).toBe(desktop.lane);
    expect(l.stops.map((s) => s.y)).toEqual([215, 900, 1500, 2300]);
    // arc positions increase, and every stop lies on the sampled line
    for (let i = 1; i < l.stops.length; i++) expect(l.stops[i]!.s).toBeGreaterThan(l.stops[i - 1]!.s);
    for (const s of l.stops) expect(l.points.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < 3)).toBe(true);
    // it ends a tail below the last stop
    const end = l.points[l.points.length - 1]!;
    expect(end.y).toBeCloseTo(2380, 0);
  });

  it('only ever goes down, evenly sampled', () => {
    const l = layoutPath(desktop);
    for (let i = 1; i < l.points.length; i++) {
      const a = l.points[i - 1]!;
      const b = l.points[i]!;
      expect(b.y).toBeGreaterThanOrEqual(a.y - 1e-6);
      if (i < l.points.length - 1) expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(4, 0);
    }
    expect(l.length).toBeGreaterThan(2300);
  });

  it('crosses to the lane above the first heading and never leaves the lane below it', () => {
    const l = layoutPath(desktop);
    for (const p of l.points) {
      if (p.y >= desktop.clearTop - CLEARANCE) {
        expect(Math.abs(p.x - desktop.lane)).toBeLessThanOrEqual(desktop.sway + 1e-6);
        expect(p.x).toBeLessThan(desktop.contentLeft);
      }
    }
  });

  it('never crosses a heading or helper line beside it (text boxes right of the content edge)', () => {
    const l = layoutPath(desktop);
    const text = desktop.stops.flatMap((s) => [
      { left: desktop.contentLeft, top: s.y - 16, right: desktop.contentLeft + 160, bottom: s.y + 16 },
      { left: desktop.contentLeft, top: s.y + 20, right: desktop.contentLeft + 600, bottom: s.y + 48 },
    ]);
    expect(pointsInBoxes(l.points, text, 2)).toEqual([]);
  });

  it('on a phone the lane is a gutter: no sway, a straight line beside the stacked headings', () => {
    const phone: PathPlan = { ...desktop, start: { x: 190, y: -4 }, lane: 19, contentLeft: 38, clearTop: 64, stops: [{ id: 'session', y: 80 }, { id: 'plant', y: 1200 }], sway: 0 };
    const l = layoutPath(phone);
    for (const p of l.points) if (p.y >= phone.clearTop - CLEARANCE) expect(p.x).toBeCloseTo(19, 6);
    expect(l.stops.map((s) => s.id)).toEqual(['session', 'plant']);
  });

  it('keeps a start left of the lane, or too low, on the lane and above the first heading', () => {
    const l = layoutPath({ ...desktop, start: { x: 40, y: 400 } });
    expect(l.points[0]!.x).toBe(desktop.lane);
    expect(l.points[0]!.y).toBeLessThan(desktop.clearTop - CLEARANCE);
  });

  it('re-lays out when a section appears or goes: the stops follow the headings', () => {
    const without = layoutPath({ ...desktop, stops: desktop.stops.filter((s) => s.id !== 'calendar') });
    expect(without.stops.map((s) => s.id)).toEqual(['session', 'plant', 'tools']);
    const moved = layoutPath({ ...desktop, stops: desktop.stops.map((s) => (s.id === 'tools' ? { ...s, y: 2600 } : s)) });
    expect(moved.stops.find((s) => s.id === 'tools')!.y).toBe(2600);
  });

  it('is deterministic per seed', () => {
    expect(layoutPath(desktop)).toEqual(layoutPath(desktop));
    expect(brushOutline(layoutPath(desktop), { width: 2.6, stopRadius: 12, fadeIn: 90, liftOff: 70, seed: 1 })).toBe(
      brushOutline(layoutPath(desktop), { width: 2.6, stopRadius: 12, fadeIn: 90, liftOff: 70, seed: 1 }),
    );
  });
});

describe('brushOutline and stones', () => {
  it('breaks at each stone: one run before the first stop, one between each pair, one after', () => {
    const l = layoutPath(desktop);
    const d = brushOutline(l, { width: 2.6, stopRadius: 12, fadeIn: 90, liftOff: 70, seed: 1 });
    const runs = d.split('M').length - 1;
    // 5 runs around 4 stones, plus at most one dry break on each long stretch between stones
    expect(runs).toBeGreaterThanOrEqual(5);
    expect(runs).toBeLessThanOrEqual(5 + 3);
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it('a stone is a closed, flat, uneven shape about its centre', () => {
    const d = stonePath('session', 11, 6.5);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
    expect(stonePath('session', 11, 6.5)).toBe(d);
    expect(stonePath('plant', 11, 6.5)).not.toBe(d);
  });
});
