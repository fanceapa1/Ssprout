import { describe, expect, it } from 'vitest';
import {
  approach,
  ARROW_STEP,
  clampScroll,
  easeBreath,
  glideAt,
  glideDuration,
  keyScroll,
  LINE_PX,
  scrollForThumb,
  thumbGeometry,
  wheelPixels,
} from './scroll-math';

describe('approach (wheel and arrow smoothing)', () => {
  it('moves part of the way each frame and never overshoots', () => {
    let y = 0;
    const seen: number[] = [];
    for (let i = 0; i < 12; i++) {
      y = approach(y, 500, 16);
      seen.push(y);
    }
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(500 * 0.2);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]!);
    expect(Math.max(...seen)).toBeLessThanOrEqual(500);
  });

  it('does not depend on the frame rate', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 30; i++) a = approach(a, 800, 16);
    for (let i = 0; i < 60; i++) b = approach(b, 800, 8);
    expect(Math.abs(a - b)).toBeLessThan(1);
  });

  it('settles exactly on the target within about a second', () => {
    let y = 0;
    let t = 0;
    while (y !== 1200 && t < 5000) {
      y = approach(y, 1200, 16);
      t += 16;
    }
    expect(y).toBe(1200);
    expect(t).toBeLessThan(1200);
  });

  it('jumps when smoothing is off (tau 0) and holds still for dt 0', () => {
    expect(approach(10, 300, 16, 0)).toBe(300);
    expect(approach(10, 300, 0)).toBe(10);
  });
});

describe('glides (page keys, jumps to a section)', () => {
  it('eases in and out between its ends', () => {
    expect(easeBreath(0)).toBe(0);
    expect(easeBreath(1)).toBe(1);
    expect(easeBreath(0.5)).toBeCloseTo(0.5, 5);
    expect(easeBreath(0.1)).toBeLessThan(0.1); // slow start
    expect(easeBreath(0.9)).toBeGreaterThan(0.9); // slow finish
    expect(glideAt(100, 700, 0, 600)).toBe(100);
    expect(glideAt(100, 700, 600, 600)).toBe(700);
    expect(glideAt(100, 700, 900, 600)).toBe(700);
    expect(glideAt(100, 700, 10, 0)).toBe(700);
  });

  it('takes longer for longer trips, within calm bounds', () => {
    expect(glideDuration(10)).toBeGreaterThanOrEqual(420);
    expect(glideDuration(2000)).toBeGreaterThan(glideDuration(200));
    expect(glideDuration(1e6)).toBeLessThanOrEqual(1100);
    expect(glideDuration(-800)).toBe(glideDuration(800));
  });
});

describe('wheel and keys', () => {
  it('reads wheel deltas in pixels, lines and pages', () => {
    expect(wheelPixels({ deltaY: 120, deltaMode: 0 }, 800)).toBe(120);
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800)).toBe(3 * LINE_PX);
    expect(wheelPixels({ deltaY: -1, deltaMode: 2 }, 800)).toBeCloseTo(-680);
    expect(wheelPixels({ deltaY: NaN, deltaMode: 0 }, 800)).toBe(0);
  });

  it('maps scrolling keys to targets inside the document', () => {
    expect(keyScroll('ArrowDown', false, 100, 1000, 800)).toEqual({ target: 100 + ARROW_STEP, kind: 'step' });
    expect(keyScroll('ArrowUp', false, 10, 1000, 800)).toEqual({ target: 0, kind: 'step' });
    expect(keyScroll('PageDown', false, 0, 1000, 800)).toEqual({ target: 680, kind: 'page' });
    expect(keyScroll('PageUp', false, 900, 1000, 800)).toEqual({ target: 220, kind: 'page' });
    expect(keyScroll(' ', false, 0, 1000, 800)?.target).toBe(680);
    expect(keyScroll(' ', true, 700, 1000, 800)?.target).toBe(20);
    expect(keyScroll('End', false, 0, 1000, 800)).toEqual({ target: 1000, kind: 'edge' });
    expect(keyScroll('Home', false, 640, 1000, 800)).toEqual({ target: 0, kind: 'edge' });
    expect(keyScroll('PageDown', false, 900, 1000, 800)?.target).toBe(1000);
    expect(keyScroll('a', false, 0, 1000, 800)).toBeNull();
    expect(keyScroll('Enter', false, 0, 1000, 800)).toBeNull();
  });

  it('clamps scroll positions to the document', () => {
    expect(clampScroll(-5, 100)).toBe(0);
    expect(clampScroll(150, 100)).toBe(100);
    expect(clampScroll(50, -10)).toBe(0);
    expect(clampScroll(NaN, 100)).toBe(0);
  });
});

describe('scrollbar thumb', () => {
  it('is as long as the share of the page in view, and never too short to grab', () => {
    // a page twice the viewport: the thumb is half the track
    expect(thumbGeometry(0, 800, 800, 600).size).toBeCloseTo(300);
    // a very long page: the minimum
    expect(thumbGeometry(0, 100_000, 800, 600, 44).size).toBe(44);
    // nothing to scroll: the whole track
    expect(thumbGeometry(0, 0, 800, 600)).toEqual({ size: 600, offset: 0 });
  });

  it('shows the position: top at 0, bottom at max, proportional between', () => {
    const top = thumbGeometry(0, 1000, 800, 600);
    const mid = thumbGeometry(500, 1000, 800, 600);
    const end = thumbGeometry(1000, 1000, 800, 600);
    expect(top.offset).toBe(0);
    expect(end.offset + end.size).toBeCloseTo(600);
    expect(mid.offset).toBeCloseTo((600 - mid.size) / 2);
  });

  it('maps a dragged thumb back to a scroll position (round trip)', () => {
    for (const y of [0, 123, 500, 999, 1000]) {
      const g = thumbGeometry(y, 1000, 800, 600);
      expect(scrollForThumb(g.offset, g.size, 600, 1000)).toBeCloseTo(y, 6);
    }
    expect(scrollForThumb(-50, 100, 600, 1000)).toBe(0);
    expect(scrollForThumb(9999, 100, 600, 1000)).toBe(1000);
    expect(scrollForThumb(10, 600, 600, 1000)).toBe(0);
  });
});
