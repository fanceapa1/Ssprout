/**
 * The caique's pose on its mooring (G6): a gentle bob, roll and surge as a pure function of the
 * motion's time. The motion writes it into the caique's carrier (ADR 0373) each frame, so what
 * rides the boat (a gull on its mast) follows it. Eager data, readable without the motion's chunk. docs/systems/scenery.md › Coast › Motion.
 */
import type { Pt } from '../../render/viewport';
import { CAIQUE } from './layout';

/** An offset (world units) and a clockwise tilt (radians) about the hull's waterline centre `CAIQUE`. */
export interface CaiquePose {
  dx: number;
  dy: number;
  angle: number;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** The largest offsets and tilt `caiquePose` reaches (each the sum of its terms' amplitudes). */
export const CAIQUE_SWING = { dx: 0.9, dy: 1.15, angle: 1.9 * DEG } as const;

/**
 * Where the boat sits at time `t` (seconds): two bobs and two rolls with long, unrelated periods,
 * and a slow surge on the mooring. Continuous and bounded by `CAIQUE_SWING`; writes into `out`.
 */
export function caiquePose(t: number, out: CaiquePose = { dx: 0, dy: 0, angle: 0 }): CaiquePose {
  out.dy = 0.8 * Math.sin((TAU * t) / 6.7 + 0.6) + 0.35 * Math.sin((TAU * t) / 3.9 + 2.1);
  out.angle = (1.3 * Math.sin((TAU * t) / 8.3 + 1.4) + 0.6 * Math.sin((TAU * t) / 4.7 + 0.3)) * DEG;
  out.dx = 0.9 * Math.sin((TAU * t) / 23.3 + 1.1);
  return out;
}

/** A point of the boat at rest (world units), where `pose` carries it. */
export function posePoint(q: Pt, pose: CaiquePose, out: Pt = { x: 0, y: 0 }): Pt {
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  const x = q.x - CAIQUE.x;
  const y = q.y - CAIQUE.y;
  out.x = CAIQUE.x + pose.dx + x * c - y * s;
  out.y = CAIQUE.y + pose.dy + x * s + y * c;
  return out;
}
