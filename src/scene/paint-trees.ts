/**
 * Trees and shrubs: thin ink-and-wash trunks forking into limbs, airy cloud-pad foliage
 * (several merged clumps per tree), and rounded shrubs. Far trees are paler and cooler.
 */
import type { Rng } from '../core/rng';
import { PIGMENTS, lighten, mix, shade, type FoliagePigments, type Painter } from '../paint';
import type { Pt } from '../render/viewport';
import type { ShrubSpec, TreeSpec } from './layout';
import { atmos, type Strokes } from './paint-land';

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

export function* paintTree(p: Painter, rng: Rng, tree: TreeSpec): Strokes {
  const d = tree.distance;
  const bark = atmos(BARK, d * 0.9);
  const w = tree.width;
  // a faint ground glaze where the tree stands
  p.glaze({ cx: tree.base.x + 6, cy: tree.base.y + 2, rx: 40 + w * 4, ry: 6 + w * 0.6 }, atmos(PIGMENTS.sage, d), {
    rng,
    opacity: 0.22,
    fade: { angle: -Math.PI / 2, start: 0.3, amount: 0.8 },
  });
  yield;
  // stems: brush strokes with a little pressure flare at the root
  for (const [i, stem] of tree.stems.entries()) {
    const sw = i === 0 ? w : w * 0.72;
    p.stroke(stem, { rng, pigment: bark, width: sw, wetness: 0.25, wobble: 0.25, taper: [0, 0.03], pressure: thinning(1.25, 0.5), opacity: 0.85 });
    yield;
  }
  // limbs: thinner strokes, then fine ink twigs that reach into the pads; the stems keep their
  // width almost to the top and each limb starts rounded, so a joint never shows a square-cut end
  // close up
  for (const limb of tree.limbs) {
    p.stroke(limb, { rng, pigment: bark, width: w * 0.5, wetness: 0.3, wobble: 0.3, taper: [0, 0.6], pressure: thinning(1, 0.4), opacity: 0.8 });
    yield;
    // the fork itself: a small rounded node where the limb leaves the stem
    const j = limb[0]!;
    p.glaze({ cx: j.x, cy: j.y + w * 0.1, rx: w * 0.34, ry: w * 0.42 }, bark, { rng, opacity: 0.28, deform: 0.2, layers: 5 });
    yield;
  }
  // bark: the modelling a close look finds (ADR 0186), painted from the tree's own rng fork so
  // the rest of the tree is untouched — a cool shadow side bled into the wet trunk, broken
  // dry-brush striations along the grain, a knot or two
  yield* barkDetail(p, rng.fork('bark'), tree, bark);
  for (const [x, y, r] of tree.pads) {
    const from = nearestPoint([...tree.stems.flat(), ...tree.limbs.flat()], { x, y: y + r * 0.3 });
    const end = { x: x + rng.range(-0.2, 0.2) * r, y: y + r * 0.12 };
    if (Math.hypot(end.x - from.x, end.y - from.y) > 6) {
      const mid = { x: (from.x + end.x) / 2 + rng.range(-4, 4), y: (from.y + end.y) / 2 + rng.range(-3, 5) };
      p.inkLine([from, mid, end], { rng, width: Math.max(0.9, w * 0.22), pigment: bark, pressure: [1.1, 0.7, 0.3], opacity: 0.75 - d * 0.3 });
      yield;
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
      yield;
    }
  }
  // foliage: big pads first (back), smaller pads over them
  const pig = foliageFor(d);
  const pads = [...tree.pads].sort((a, b) => b[2] - a[2]);
  for (const [x, y, r] of pads) {
    yield* p.parts.foliageClump({ x, y }, r, pig, { rng, flatness: rng.range(0.5, 0.6), shadow: 0.45, opacity: 0.8 - d * 0.2, gaps: 0.25, density: 1 });
    yield;
  }
  // shadow side of the main trunk: a broken ink accent
  const main = tree.stems[0]!;
  p.inkLine(
    main.map((q, i) => ({ x: q.x + w * 0.3 * (1 - (i / Math.max(1, main.length - 1)) * 0.5), y: q.y })),
    { rng, width: Math.max(0.8, w * 0.22), pigment: shade(bark, 0.15), opacity: 0.55 - d * 0.3, breaks: 0.45 },
  );
}

/** The part of a polyline between fractions `t0` and `t1` of its length. */
function subPath(pts: readonly Pt[], t0: number, t1: number): Pt[] {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
    segs.push(d);
    total += d;
  }
  const at = (t: number): Pt => {
    let d = t * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i]! || i === segs.length - 1) {
        const k = segs[i]! > 0 ? Math.min(1, d / segs[i]!) : 0;
        return { x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * k, y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * k };
      }
      d -= segs[i]!;
    }
    return pts[pts.length - 1]!;
  };
  const out: Pt[] = [];
  const n = 5;
  for (let k = 0; k <= n; k++) out.push(at(t0 + ((t1 - t0) * k) / n));
  return out;
}

/** Shadow side, striations and knots on a tree's stems (and its thicker limbs). */
function* barkDetail(p: Painter, rng: Rng, tree: TreeSpec, bark: string): Strokes {
  const d = tree.distance;
  const w = tree.width;
  const fade = 1 - d * 0.8;
  const dark = shade(bark, 0.3);
  // light from the upper left: the shadow lies along each stem's right flank
  const flank = (path: readonly Pt[], k: number) => path.map((q, i) => ({ x: q.x + k * (1 - (i / Math.max(1, path.length - 1)) * 0.45), y: q.y }));
  for (const [i, stem] of tree.stems.entries()) {
    const sw = i === 0 ? w : w * 0.72;
    p.stroke(flank(stem, sw * 0.14), {
      rng,
      pigment: mix(dark, PIGMENTS.ultramarine, 0.12),
      width: sw * 0.5,
      wetness: 0.8,
      wobble: 0.2,
      taper: [0.02, 0.45],
      pressure: thinning(1.2, 0.5),
      opacity: 0.42 * fade,
      edge: 0.3,
    });
    yield;
    if (d > 0.6 || sw < 3.5) continue;
    // striations: short broken strokes following the grain, mostly on the shadow half
    const marks = Math.round(3 + sw * 0.6);
    for (let m = 0; m < marks; m++) {
      const t0 = rng.range(0, 0.75);
      const seg = subPath(stem, t0, Math.min(1, t0 + rng.range(0.08, 0.2)));
      const off = rng.range(-0.1, 0.32) * sw * (1 - t0 * 0.4);
      p.dryBrush(
        seg.map((q) => ({ x: q.x + off, y: q.y })),
        { rng, pigment: dark, width: Math.max(0.7, sw * rng.range(0.1, 0.2)), opacity: rng.range(0.35, 0.6) * fade, dryness: 0.5, wobble: 0.3 },
      );
      yield;
    }
    // a knot or two: a small dark crescent with a lighter centre left as it was
    const knots = sw > 6 ? 2 : 1;
    for (let k = 0; k < knots; k++) {
      const c = subPath(stem, rng.range(0.15, 0.6), 1)[0]!;
      const r = sw * rng.range(0.14, 0.22);
      const a0 = rng.range(-0.4, 0.4);
      p.inkLine(
        [
          { x: c.x - r, y: c.y + Math.sin(a0) * r * 0.3 },
          { x: c.x, y: c.y + r * 0.55 },
          { x: c.x + r, y: c.y - Math.sin(a0) * r * 0.3 },
        ],
        { rng, width: Math.max(0.6, sw * 0.07), pigment: dark, opacity: 0.5 * fade, breaks: 0.2, pressure: [0.4, 1, 0.3] },
      );
      yield;
    }
  }
  // thicker limbs get a shadow flank too
  for (const limb of tree.limbs) {
    if (w * 0.5 < 2.6) continue;
    p.stroke(flank(limb, w * 0.12), { rng, pigment: dark, width: w * 0.24, wetness: 0.8, wobble: 0.25, taper: [0.1, 0.6], opacity: 0.25 * fade, edge: 0.2 });
    yield;
  }
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
export function* paintShrub(p: Painter, rng: Rng, s: ShrubSpec): Strokes {
  const d = s.distance;
  p.glaze({ cx: s.x + s.r * 0.1, cy: s.y + 2, rx: s.r * 1.15, ry: s.r * 0.16 }, atmos(mix(PIGMENTS.olive, PIGMENTS.sage, 0.5), d), {
    rng,
    opacity: 0.3,
    fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.8 },
  });
  yield;
  const pig: FoliagePigments = {
    light: atmos(mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.6), d),
    mid: atmos(mix(PIGMENTS.sap, PIGMENTS.sage, 0.3), d),
    shadow: atmos(PIGMENTS.sage, d),
    dark: atmos(mix(PIGMENTS.olive, PIGMENTS.sage, 0.5), d),
  };
  yield* p.parts.foliageClump({ x: s.x, y: s.y - s.r * 0.42 }, s.r, pig, { rng, flatness: 0.6, shadow: 0.5, opacity: 0.7, gaps: 0.15, density: 1.1, dabSize: 0.26 });
  yield;
  // a couple of stems peeking out at the base
  for (let k = 0; k < 2; k++) {
    const x0 = s.x + rng.range(-0.3, 0.3) * s.r;
    p.inkLine([{ x: x0, y: s.y }, { x: x0 + rng.range(-6, 6), y: s.y - s.r * 0.35 }], { rng, width: 1, pigment: atmos(BARK, d), opacity: 0.4 });
    yield;
  }
}
