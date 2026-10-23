import { describe, expect, it } from 'vitest';
import {
  canPose,
  canVisibility,
  dropletsAt,
  ease,
  fitRigToCanvas,
  gardenWetness,
  pourTarget,
  rosePoint,
  WATERING_SECONDS,
  WET_LINGER_SECONDS,
  wateringTimeline,
  type WateringRig,
} from './watering';

const rig: WateringRig = { baseX: 300, baseY: 400, top: 300, halfWidth: 30, size: 40 };

describe('watering timeline', () => {
  it('lasts 2.5 s and eases without jumps', () => {
    expect(WATERING_SECONDS).toBe(2.5);
    expect(ease(0, 1, 0)).toBe(0);
    expect(ease(0, 1, 1)).toBe(1);
    expect(ease(0, 1, 0.5)).toBeCloseTo(0.5, 9);
    let prev = wateringTimeline(0);
    for (let u = 0.005; u <= 1; u += 0.005) {
      const ph = wateringTimeline(u);
      for (const k of Object.keys(ph) as Array<keyof typeof ph>) expect(Math.abs(ph[k] - prev[k])).toBeLessThan(0.11);
      prev = ph;
    }
  });

  it('starts and ends at rest: no can, no flow, no lift, dry soil', () => {
    for (const u of [0, 1]) {
      const ph = wateringTimeline(u);
      expect(ph.alpha).toBe(0);
      expect(ph.pour).toBe(0);
      expect(ph.lift).toBe(0);
      expect(ph.wet).toBe(0);
      expect(ph.tilt).toBe(0);
    }
  });

  it('runs in order: glide in → tilt → pour → soil darkens → leaves lift → lift away', () => {
    const first = (k: keyof ReturnType<typeof wateringTimeline>) => {
      for (let u = 0; u <= 1; u += 0.001) if (wateringTimeline(u)[k] > 0.05) return u;
      return 2;
    };
    expect(first('enter')).toBeLessThan(first('tilt'));
    expect(first('tilt')).toBeLessThan(first('pour'));
    expect(first('pour')).toBeLessThan(first('wet'));
    expect(first('wet')).toBeLessThan(first('lift'));
    expect(first('lift')).toBeLessThan(first('leave'));
    const mid = wateringTimeline(0.55);
    expect(mid.pour).toBe(1);
    expect(mid.tilt).toBe(1);
    expect(wateringTimeline(0.65).lift).toBeGreaterThan(0.9);
  });

  it('keeps the garden soil damp a while after the can has gone', () => {
    expect(gardenWetness(0)).toBe(0);
    expect(gardenWetness(WATERING_SECONDS)).toBeCloseTo(1, 3);
    expect(gardenWetness(WATERING_SECONDS + 3)).toBeGreaterThan(0.3);
    expect(gardenWetness(WATERING_SECONDS * 0.9 + WET_LINGER_SECONDS)).toBe(0);
    expect(gardenWetness(-1)).toBe(0);
  });
});

describe('the can in a small frame', () => {
  it('is fully in the frame while it pours and mostly outside as it glides in (no stray sliver is drawn)', () => {
    const W = 300;
    const H = 300;
    const fitted = fitRigToCanvas({ baseX: 150, baseY: 290, top: 200, halfWidth: 40, size: 60, side: 1 }, W, H);
    expect(canVisibility(fitted, 0.55, W, H)).toBeGreaterThan(0.95);
    // as it glides in it is only partly inside: the view fades it by this share
    expect(canVisibility(fitted, 0.02, W, H)).toBeLessThan(canVisibility(fitted, 0.55, W, H));
    expect(canVisibility(fitted, 0.02, W, H)).toBeLessThan(0.6);
  });
});

describe('the can', () => {
  it('puts the rose on the pour target at full tilt, above the plant on the can’s side', () => {
    const t = pourTarget(rig);
    const r = rosePoint(rig, 0.55);
    expect(r.p.x).toBeCloseTo(t.x, 6);
    expect(r.p.y).toBeCloseTo(t.y, 6);
    expect(t.y).toBeLessThan(rig.top);
    expect(t.x).toBeGreaterThan(rig.baseX);
    // tilted: the spout points down and toward the plant
    expect(r.dir.x).toBeLessThan(0);
    expect(r.dir.y).toBeGreaterThan(0);
  });

  it('comes from the side and leaves upward', () => {
    const enter = canPose(rig, 0.02);
    const pour = canPose(rig, 0.55);
    const leave = canPose(rig, 0.98);
    expect(enter.x).toBeGreaterThan(pour.x + rig.size);
    expect(leave.y).toBeLessThan(pour.y - rig.size * 0.5);
    expect(pour.alpha).toBe(1);
  });

  it('mirrors for a can coming from the left', () => {
    const left = { ...rig, side: -1 as const };
    expect(pourTarget(left).x).toBeLessThan(rig.baseX);
    expect(canPose(left, 0.02).x).toBeLessThan(canPose(left, 0.55).x);
    expect(rosePoint(left, 0.55).dir.x).toBeGreaterThan(0);
  });

  it('fits inside a small canvas (the widget) without leaving it', () => {
    const W = 200;
    const H = 160;
    const fitted = fitRigToCanvas({ baseX: 100, baseY: 155, top: 20, halfWidth: 60, size: 30 }, W, H);
    const p = canPose(fitted, 0.55);
    expect(p.x + 0.62 * 30).toBeLessThanOrEqual(W);
    expect(p.y - 0.6 * 30).toBeGreaterThanOrEqual(0);
  });
});

describe('droplets', () => {
  it('fall only while pouring, and are deterministic for a seed', () => {
    expect(dropletsAt(rig, 0.2, 1)).toEqual([]);
    const a = dropletsAt(rig, 0.5, 7);
    expect(a.length).toBeGreaterThan(20);
    expect(dropletsAt(rig, 0.5, 7)).toEqual(a);
    expect(dropletsAt(rig, 0.5, 8)).not.toEqual(a);
    expect(dropletsAt(rig, 0.995, 7).filter((d) => d.kind === 'drop')).toEqual([]);
  });

  it('arc from the rose down onto the plant and the soil, with splashes and a few catching light', () => {
    const rose = rosePoint(rig, 0.5).p;
    const all: ReturnType<typeof dropletsAt> = [];
    for (let u = 0.32; u < 0.95; u += 0.02) all.push(...dropletsAt(rig, u, 3));
    const drops = all.filter((d) => d.kind === 'drop');
    for (const d of drops) {
      expect(d.y).toBeGreaterThanOrEqual(rose.y - rig.size * 0.6);
      expect(d.y).toBeLessThanOrEqual(rig.baseY + rig.size * 0.1);
      expect(d.x).toBeLessThanOrEqual(rose.x + rig.size * 0.2);
    }
    // falling: directions point downward on average
    expect(drops.reduce((s, d) => s + Math.sin(d.angle), 0) / drops.length).toBeGreaterThan(0.2);
    expect(drops.some((d) => d.light)).toBe(true);
    expect(drops.some((d) => !d.light)).toBe(true);
    expect(all.some((d) => d.kind === 'splash')).toBe(true);
    expect(all.some((d) => d.kind === 'crown')).toBe(true);
    for (const d of all) expect(d.alpha).toBeLessThanOrEqual(1);
  });
});
