/**
 * The shoreline's ledge as data (G2b, GA1): its runs that face the viewer and those that face away,
 * and the worn lip along the latter. Where a run faces away, the rock's edge wanders out into the
 * water in slabs and back in notches, in blocks of their own length, with boulders fallen at its
 * foot. The line itself (`SHORE_EDGE`) stays the place the motion, the slots and the wildlife read;
 * the lip is painted over and along it. docs/systems/scenery.md › Coast › Rock.
 */
import { createRng } from '../../core/rng';
import { resample } from '../../paint/geometry';
import type { Pt } from '../../render/viewport';
import { SHORE_EDGE } from './layout';
import { CLIFF_FOOT } from './sea';
import { BEACH_FLIGHT_BOX, boulderShape, type RockShape } from './shapes';

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
/** The ledge runs down the shoreline to the head of the beach flight, where the rock yields to the steps. */
export const LEDGE_EDGE: readonly Pt[] = SHORE_EDGE.slice(0, SHORE_EDGE.findIndex((q) => q.y >= BEACH_FLIGHT_BOX.y) + 1);
export const LEDGE_RUNS = shoreRuns(LEDGE_EDGE);

/** The ledge's edge every 3 units, as the painter walks it. */
export const LEDGE_SAMPLES: readonly Pt[] = resample(LEDGE_EDGE, 3);

/** A stretch of the lip at one height: samples i0..i1 of `LEDGE_SAMPLES`, standing `out` into the water (in: a notch). */
export interface LipBlock {
  i0: number;
  i1: number;
  out: number;
}

/** Below this y the lip stays low: `shallows-3` lies in the water just past the bastion's foot. */
const LOW_LIP_Y = 712;

/**
 * The lip: per sample its outward normal (toward the water) and how far its edge stands out from
 * the line (0 on the runs that face the viewer and at each run's ends), the blocks, and the edge.
 */
export const LIP = (() => {
  const E = LEDGE_SAMPLES;
  const n = E.length;
  const normal: Pt[] = E.map((q, i) => {
    const a = E[Math.max(0, i - 1)]!;
    const b = E[Math.min(n - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  });
  // the stretches of samples whose segments run down to the left: the runs that face away
  const ranges: [number, number][] = [];
  for (let i = 0; i < n - 1; ) {
    if (E[i + 1]!.x >= E[i]!.x) {
      i++;
      continue;
    }
    let j = i;
    while (j < n - 1 && E[j + 1]!.x < E[j]!.x) j++;
    if (j - i >= 4) ranges.push([i, j]);
    i = j + 1;
  }
  const out = new Array<number>(n).fill(0);
  const blocks: LipBlock[] = [];
  const rng = createRng('coast-lip');
  for (const [a, b] of ranges) {
    // a slow wander out and back, then blocks stepping up or down from it, now and then a notch
    const p1 = rng.range(0, 6);
    const p2 = rng.range(0, 6);
    const wander = (i: number) => 4 + 3.2 * Math.sin(i / 6.5 + p1) + 1.6 * Math.sin(i / 2.7 + p2);
    const mine: LipBlock[] = [];
    let prev = 0;
    for (let i = a + 1; i < b; ) {
      const len = Math.min(b - i, rng.int(2, 9));
      let step = rng.range(-2.5, 3.5);
      if (Math.abs(step - prev) < 1.2) step = prev + (rng.chance(0.5) ? -1.6 : 1.6);
      const notch = len <= 5 && rng.chance(0.18);
      mine.push({ i0: i, i1: i + len - 1, out: notch ? -rng.range(3, 5.5) : step });
      prev = step;
      i += len;
    }
    for (const k of mine) {
      const notch = k.out < -2.9;
      for (let i = k.i0; i <= k.i1; i++) {
        // the run's ends join the corners; a little jag along each block
        const end = Math.min(1, (i - a) / 3, (b - i) / 3);
        let o = (notch ? k.out : Math.max(0.5, wander(i) + k.out)) * end + rng.range(-0.6, 0.6) * end;
        if (E[i]!.y > LOW_LIP_Y) o = Math.min(o, 2.5);
        out[i] = o;
      }
      blocks.push({ ...k, out: out[Math.round((k.i0 + k.i1) / 2)]! });
    }
  }
  const edge: Pt[] = E.map((q, i) => ({ x: q.x + normal[i]!.x * out[i]!, y: q.y + normal[i]!.y * out[i]! }));
  return { normal, out, blocks, ranges, edge };
})();

/** The lip's edge along each run that faces away, where the water meets it (the motion's laps). */
export const LIP_EDGES: readonly (readonly Pt[])[] = LIP.ranges.map(([a, b]) => LIP.edge.slice(a, b + 1));

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

/** Boulders fallen at the lip's foot, out in the water in front of its slabs. */
const LIP_BOULDERS: RockShape[] = [
  { i: 0.07, w: 13, d: 4 },
  { i: 0.74, w: 10, d: 6 },
  { i: 0.42, w: 12, d: 4, r: 1 },
].map((b, k) => {
  const [a, e] = LIP.ranges[b.r ?? 0]!;
  const i = Math.round(a + (e - a) * b.i);
  const q = LIP.edge[i]!;
  const nn = LIP.normal[i]!;
  const rng = createRng(`coast-lip-boulder-${k}`);
  const x = q.x + nn.x * (b.d + b.w * 0.35);
  const y = q.y + nn.y * (b.d + b.w * 0.2) + b.w * 0.3;
  return { ...boulderShape(x, y, b.w, y - b.w * rng.range(0.22, 0.32), rng, rng.range(-0.5, 0.5)), ground: false };
});

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

/** The boulders the worn lip and the cliff's foot add: wet, foam at their feet (their broad dry top as the shore's). */
export const LIP_BOULDER_SHAPES: readonly RockShape[] = [...LIP_BOULDERS, ...FOOT_BOULDERS];
