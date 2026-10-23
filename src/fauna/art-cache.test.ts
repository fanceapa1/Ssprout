import { describe, expect, it } from 'vitest';
import { createViewport } from '../render/viewport';
import type { CameraView } from '../render/camera';
import { ArtCache } from './sprite';
import { faunaResolution } from './system';

const part = (res: number) => ({ res });

describe('fauna art cache across resolutions (ADR 0188)', () => {
  it('paints a part at once the first time it is needed', () => {
    const c = new ArtCache();
    c.setRes(2);
    expect(c.get('bee', part)).toEqual({ res: 2 });
    expect(c.painted).toBe(1);
    expect(c.pending).toBe(0);
  });

  it('keeps drawing the old part when the resolution rises, and paints the sharp one in idle time', () => {
    const c = new ArtCache();
    c.setRes(2);
    c.get('bee', part);
    c.setRes(5.4);
    expect(c.get('bee', part)).toEqual({ res: 2 }); // no stall: the old copy draws this frame
    expect(c.pending).toBe(1);
    expect(c.paintPending(10)).toBe(0);
    expect(c.get('bee', part)).toEqual({ res: 5.5 });
    expect(c.painted).toBe(2);
  });

  it('returns to the overview without repainting, and keeps at most two resolutions', () => {
    const c = new ArtCache();
    c.setRes(2);
    c.get('bee', part);
    c.setRes(5);
    c.paintPending(10, () => 0);
    c.get('bee', part);
    c.paintPending(10);
    c.setRes(2);
    expect(c.get('bee', part)).toEqual({ res: 2 });
    expect(c.pending).toBe(0);
    c.setRes(4);
    c.setRes(3);
    // only the current and the previous resolution are kept: 2 and 5 are gone, so it paints anew
    expect(c.get('bee', part)).toEqual({ res: 3 });
  });

  it('paints within a time budget', () => {
    const c = new ArtCache();
    c.setRes(2);
    for (let i = 0; i < 5; i++) c.get(`p${i}`, part);
    c.setRes(4);
    for (let i = 0; i < 5; i++) c.get(`p${i}`, part);
    let t = 0;
    const left = c.paintPending(2, () => (t += 1));
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(5);
  });
});

describe('fauna resolution follows a resting camera', () => {
  const overview = createViewport(1440, 900, 2);
  const cam = (zoom: number, overviewPose: boolean): CameraView => {
    const v = { ...overview, pixelScale: overview.pixelScale * zoom };
    return { view: () => v, detailView: () => v, detailVersion: 1, moving: () => false, isOverview: () => overviewPose };
  };

  it('uses the overview scale at the overview and the close view scale when zoomed', () => {
    expect(faunaResolution(overview, null)).toBe(overview.pixelScale);
    expect(faunaResolution(overview, cam(1, true))).toBe(overview.pixelScale);
    expect(faunaResolution(overview, cam(3, false))).toBeCloseTo(overview.pixelScale * 3);
  });
});
