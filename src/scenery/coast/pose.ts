/**
 * The caique's pose on its mooring (G6): a gentle bob, roll and surge as a pure function of the
 * motion's time. The motion writes it into the caique's carrier (ADR 0373) each frame, so what
 * rides the boat (a gull on its mast) follows it. Eager data, readable without the motion's chunk. docs/systems/scenery.md › Coast › Motion.
 */
import type { Pt } from '../../render/viewport';
import { CAIQUE } from './layout';
import { depthOf, swellAt, type SwellPhase } from './swell';

/** An offset (world units) and a clockwise tilt (radians) about the hull's waterline centre `CAIQUE`. */
export interface CaiquePose {
  dx: number;
  dy: number;
  angle: number;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** The largest offsets and tilt `caiquePose` reaches (each the sum of its terms' amplitudes). */
export const CAIQUE_SWING = { dx: 0.9, dy: 1.25, angle: 1.9 * DEG } as const;

/** How far out the caique lies (world units of depth): where it meets each swell crest. */
export const CAIQUE_DEPTH = depthOf(CAIQUE);
const swell: SwellPhase = { n: 0, since: 0, gap: 1, lift: 0, strength: 0 };

/**
 * Where the boat sits at time `t` (seconds): the swell's crests lifting it (GS1), a chop and two
 * rolls with long, unrelated periods, and a slow surge on the mooring. Continuous and bounded by
 * `CAIQUE_SWING`; writes into `out`.
 */
export function caiquePose(t: number, out: CaiquePose = { dx: 0, dy: 0, angle: 0 }): CaiquePose {
  // the crest reaches the bow (left) a moment before the stern: a little pitch with the heave
  const lift = swellAt(CAIQUE_DEPTH, CAIQUE.x, t, swell).lift;
  const ahead = swellAt(CAIQUE_DEPTH, CAIQUE.x, t + 0.9, swell).lift;
  out.dy = -0.65 * lift + 0.4 * Math.sin((TAU * t) / 6.7 + 0.6) + 0.2 * Math.sin((TAU * t) / 3.9 + 2.1);
  out.angle = (0.35 * (lift - ahead) + 1.0 * Math.sin((TAU * t) / 8.3 + 1.4) + 0.5 * Math.sin((TAU * t) / 4.7 + 0.3)) * DEG;
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
