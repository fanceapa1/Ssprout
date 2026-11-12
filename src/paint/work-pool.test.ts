/**
 * The wet layers' work-canvas pool gives its memory back after a quiet period (devlog 158): the
 * pooled canvases shrink to 1×1 once no layer was released for `WORK_QUIET_MS`, and grow again on demand.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaintRecorder } from '../scene/paint-record';
import { WORK_QUIET_MS, acquireWork, releaseWork, trimWork, workPixels } from './canvas';

describe('work-canvas pool trim', () => {
  let uninstall: () => void = () => {};
  beforeEach(() => {
    uninstall = new PaintRecorder({ hash: false }).install();
  });
  afterEach(() => {
    vi.useRealTimers();
    uninstall();
  });

  it('shrinks the pooled canvases once a whole quiet period passes without a wet layer', () => {
    vi.useFakeTimers();
    releaseWork(acquireWork(300, 200));
    expect(workPixels()).toBe(300 * 200);
    vi.advanceTimersByTime(WORK_QUIET_MS - 1);
    // a layer released just before the period ends keeps the canvases for another period
    releaseWork(acquireWork(300, 200));
    vi.advanceTimersByTime(WORK_QUIET_MS);
    expect(workPixels()).toBe(300 * 200);
    vi.advanceTimersByTime(WORK_QUIET_MS);
    expect(workPixels()).toBe(1);
  });

  it('sizes a trimmed canvas again when a layer borrows it', () => {
    const a = acquireWork(120, 80);
    const b = acquireWork(64, 64);
    releaseWork(a);
    releaseWork(b);
    expect(trimWork()).toBe(120 * 80 + 64 * 64 - 2);
    expect(workPixels()).toBe(2);
    const c = acquireWork(50, 40);
    expect([c.canvas.width, c.canvas.height]).toEqual([50, 40]);
    releaseWork(c);
  });
});
