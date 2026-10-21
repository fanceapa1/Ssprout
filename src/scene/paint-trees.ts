/**
 * Trees and shrubs: thin ink-and-wash trunks forking into limbs, airy cloud-pad foliage
 * (several merged clumps per tree), and rounded shrubs. Far trees are paler and cooler.
 */
import type { Rng } from '../core/rng';
import { PIGMENTS, lighten, mix, shade, type FoliagePigments, type Painter } from '../paint';
import type { Pt } from '../render/viewport';
import type { ShrubSpec, TreeSpec } from './layout';
import { atmos } from './paint-land';

export const BARK = mix(PIGMENTS.wood, PIGMENTS.sumi, 0.3);

/** Spring-pale foliage greens pushed back by `distance`. */
export function foliageFor(distance: number): FoliagePigments {
  return {
    light: atmos(lighten(PIGMENTS.sageLight, 0.04), distance),
    mid: atmos(mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.35), distance),
    shadow: atmos(mix(PIGMENTS.sage, PIGMENTS.sap, 0.4), distance),
    dark: atmos(mix(PIGMENTS.olive, PIGMENTS.sage, 0.5), distance),
  };
}

/** Pressure that thins a stroke toward its end (limbs taper toward the pads). */
const thinning = (from: number, to: number) => (t: number) => from + (to - from) * t;

export function paintTree(p: Painter, rng: Rng, tree: TreeSpec): void {
  const d = tree.distance;
  const bark = atmos(BARK, d * 0.9);
  const w = tree.width;
  // a faint ground glaze where the tree stands
  p.glaze({ cx: tree.base.x + 6, cy: tree.base.y + 2, rx: 40 + w * 4, ry: 6 + w * 0.6 }, atmos(PIGMENTS.sage, d), {
    rng,
    opacity: 0.22,
    fade: { angle: -Math.PI / 2, start: 0.3, amount: 0.8 },
  });
  // stems: brush strokes with a little pressure flare at the root
  for (const [i, stem] of tree.stems.entries()) {
    const sw = i === 0 ? w : w * 0.72;
    p.stroke(stem, { rng, pigment: bark, width: sw, wetness: 0.25, wobble: 0.25, taper: [0, 0.35], pressure: thinning(1.25, 0.55), opacity: 0.85 });
  }
  // limbs: thinner strokes, then fine ink twigs that reach into the pads
  for (const limb of tree.limbs) {
    p.stroke(limb, { rng, pigment: bark, width: w * 0.5, wetness: 0.3, wobble: 0.3, taper: [0, 0.6], pressure: thinning(1, 0.4), opacity: 0.8 });
  }
  for (const [x, y, r] of tree.pads) {
    const from = nearestPoint([...tree.stems.flat(), ...tree.limbs.flat()], { x, y: y + r * 0.3 });
    const end = { x: x + rng.range(-0.2, 0.2) * r, y: y + r * 0.12 };
    if (Math.hypot(end.x - from.x, end.y - from.y) > 6) {
      const mid = { x: (from.x + end.x) / 2 + rng.range(-4, 4), y: (from.y + end.y) / 2 + rng.range(-3, 5) };
      p.inkLine([from, mid, end], { rng, width: Math.max(0.9, w * 0.22), pigment: bark, pressure: [1.1, 0.7, 0.3], opacity: 0.75 - d * 0.3 });
    }
    for (let k = 0; k < 2; k++) {
      const tx = end.x + rng.range(-0.55, 0.55) * r;
      p.inkLine([end, { x: (end.x + tx) / 2, y: end.y - r * 0.1 }, { x: tx, y: end.y - r * rng.range(0.15, 0.3) }], {
        rng,
        width: Math.max(0.7, w * 0.13),
        pigment: bark,
        pressure: [1, 0.35],
        opacity: 0.55 - d * 0.25,
      });
    }
  }
  // foliage: big pads first (back), smaller pads over them
  const pig = foliageFor(d);
  const pads = [...tree.pads].sort((a, b) => b[2] - a[2]);
  for (const [x, y, r] of pads) {
    p.foliageClump({ x, y }, r, pig, { rng, flatness: rng.range(0.5, 0.6), shadow: 0.45, opacity: 0.8 - d * 0.2, gaps: 0.25, density: 1 });
  }
  // shadow side of the main trunk: a broken ink accent
  const main = tree.stems[0]!;
  p.inkLine(
    main.map((q) => ({ x: q.x + w * 0.35, y: q.y })),
    { rng, width: Math.max(0.8, w * 0.22), pigment: shade(bark, 0.15), opacity: 0.55 - d * 0.3, breaks: 0.45 },
  );
}

function nearestPoint(pts: Pt[], q: Pt): Pt {
  let best = pts[0]!;
  let bd = Infinity;
  for (const pt of pts) {
    const dd = (pt.x - q.x) ** 2 + (pt.y - q.y) ** 2;
    if (dd < bd) {
      bd = dd;
      best = pt;
    }
  }
  return best;
}

/** A rounded shrub sitting on the ground with a cool shadow under it. */
export function paintShrub(p: Painter, rng: Rng, s: ShrubSpec): void {
  const d = s.distance;
  p.glaze({ cx: s.x + s.r * 0.1, cy: s.y + 2, rx: s.r * 1.15, ry: s.r * 0.16 }, atmos(mix(PIGMENTS.olive, PIGMENTS.sage, 0.5), d), {
    rng,
    opacity: 0.3,
    fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.8 },
  });
  const pig: FoliagePigments = {
    light: atmos(mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.6), d),
    mid: atmos(mix(PIGMENTS.sap, PIGMENTS.sage, 0.3), d),
    shadow: atmos(PIGMENTS.sage, d),
    dark: atmos(mix(PIGMENTS.olive, PIGMENTS.sage, 0.5), d),
  };
  p.foliageClump({ x: s.x, y: s.y - s.r * 0.42 }, s.r, pig, { rng, flatness: 0.6, shadow: 0.5, opacity: 0.7, gaps: 0.15, density: 1.1, dabSize: 0.26 });
  // a couple of stems peeking out at the base
  for (let k = 0; k < 2; k++) {
    const x0 = s.x + rng.range(-0.3, 0.3) * s.r;
    p.inkLine([{ x: x0, y: s.y }, { x: x0 + rng.range(-6, 6), y: s.y - s.r * 0.35 }], { rng, width: 1, pigment: atmos(BARK, d), opacity: 0.4 });
  }
}
