/**
 * The shoreline's runs that face the viewer and those that face away (G2b), the wave-cut shelf at
 * the promontory's foot and the stones on the shelf and the painting's foot (GA1). The platform's
 * faces and rims are `platform.ts` (ADR 0388). docs/systems/scenery.md › Coast › Rock.
 */
import { createRng } from '../../core/rng';
import { resample } from '../../paint/geometry';
import type { Pt } from '../../render/viewport';
import { SHORE_EDGE } from './layout';
import { CLIFF_FOOT } from './sea';
import { boulderShape, type RockShape } from './shapes';

/** A shoreline's runs that face the viewer (a rock face shows under the edge) and those that face away (a lip shows). */
export function shoreRuns(edge: readonly Pt[]): { face: Pt[][]; lip: Pt[][] } {
  const face: Pt[][] = [];
  const lip: Pt[][] = [];
  let run: Pt[] = [edge[0]!];
  let facing = edge[1]!.x > edge[0]!.x;
  for (let i = 1; i < edge.length; i++) {
    const q = edge[i]!;
    const f = q.x > edge[i - 1]!.x;
    if (f !== facing) {
      (facing ? face : lip).push(run);
      run = [edge[i - 1]!];
      facing = f;
    }
    run.push(q);
  }
  (facing ? face : lip).push(run);
  return { face, lip };
}

export const SHORE_RUNS = shoreRuns(SHORE_EDGE);

/** A stretch of a rock edge at one height: samples i0..i1, standing `out` from the line. */
export interface LipBlock {
  i0: number;
  i1: number;
  out: number;
}

/**
 * The wave-cut shelf along the cliff's foot on the sea (GA1): per sample of `CLIFF_FOOT` how far
 * below the foot its front stands (0 where the face drops straight into the water), in blocks, so
 * the foot is not one ruled line. Low slabs awash, a lit top over a wet front.
 */
export const FOOT_SHELF = (() => {
  const foot = resample(CLIFF_FOOT, 3);
  const n = foot.length;
  const depth = new Array<number>(n).fill(0);
  const rise = new Array<number>(n).fill(0);
  const blocks: LipBlock[] = [];
  const rng = createRng('coast-foot-shelf');
  // long low slabs, short tall blocks, and gaps where the face drops straight in: never a row
  let kind: 'gap' | 'slab' | 'block' = 'slab';
  for (let i = 2; i < n - 2; ) {
    const len = Math.min(n - 2 - i, kind === 'slab' ? rng.int(6, 15) : kind === 'block' ? rng.int(2, 5) : rng.int(2, 10));
    const d = kind === 'slab' ? rng.range(2.5, 5) : kind === 'block' ? rng.range(5.5, 9) : 0;
    const sharp = kind === 'slab' ? 0.2 : 0.45;
    blocks.push({ i0: i, i1: i + len - 1, out: d });
    for (let k = i; k < i + len && d > 0; k++) {
      const t = (k - i + 0.5) / len;
      const end = Math.min(1, (k - 1) / 4, (n - 2 - k) / 4);
      const lump = Math.sin(Math.PI * t);
      depth[k] = Math.max(depth[k]!, d * lump ** sharp * rng.range(0.8, 1.1) * end);
      rise[k] = Math.max(rise[k]!, ((0.6 + d * (kind === 'slab' ? 0.15 : 0.4)) * lump ** 0.6 + rng.range(-0.4, 0.4)) * end);
    }
    const next = rng.next();
    kind = kind === 'gap' ? (next < 0.55 ? 'slab' : 'block') : next < 0.4 ? 'gap' : next < 0.7 ? 'block' : 'slab';
    // a block overlaps the slab before it a little
    i += kind === 'block' && len > 4 ? len - 1 : len;
  }
  const front: Pt[] = foot.map((q, i) => ({ x: q.x, y: q.y + depth[i]! }));
  return { foot, depth, rise, blocks, front };
})();

/** The cliff's foot as the water meets it: the shelf's front where it stands, else the foot. */
export const FOOT_FRONT: readonly Pt[] = FOOT_SHELF.front;

/** Blocks fallen from the cliff, in the water in front of its foot (fractions along it). */
const FOOT_BOULDERS: RockShape[] = [
  { f: 0.18, w: 12, d: 4 },
  { f: 0.3, w: 22, d: 6 },
  { f: 0.34, w: 11, d: 9 },
  { f: 0.62, w: 14, d: 5 },
  { f: 0.73, w: 24, d: 8 },
].map((b, k) => {
  const pts = FOOT_SHELF.front;
  const q = pts[Math.round((pts.length - 1) * b.f)]!;
  const rng = createRng(`coast-foot-boulder-${k}`);
  const y = q.y + b.d;
  return { ...boulderShape(q.x, y, b.w, y - b.w * rng.range(0.22, 0.32), rng, rng.range(-0.5, 0.5)), ground: false };
});

/** The boulders the cliff's foot adds: wet, foam at their feet (their broad dry top as the shore's). */
export const FOOT_BOULDER_SHAPES: readonly RockShape[] = FOOT_BOULDERS;

/**
 * Stones on the rock shelf round the pools and on the painting's foot below the lowest wall
 * (GA1): limestone lumps on the ground, clear of the pools' rims, the slots, the path and the jar.
 */
export const FOOT_STONES: readonly RockShape[] = [
  [60, 900, 14], [128, 884, 10], [150, 950, 15], [318, 908, 16], [300, 942, 11], [482, 902, 12], [522, 918, 9], [640, 892, 13],
  [758, 906, 22], [836, 930, 14], [1182, 916, 18], [1262, 936, 12], [1452, 906, 20], [1522, 930, 13], [992, 962, 16],
].map(([x, y, w], i) => {
  const rng = createRng(`coast-foot-stone-${i}`);
  return { ...boulderShape(x!, y!, w!, y! - w! * rng.range(0.15, 0.25), rng, rng.range(-0.5, 0.5)), ground: true };
});
