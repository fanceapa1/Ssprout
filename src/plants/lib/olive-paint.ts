/**
 * Painting helpers for the olive (species/olive.ts): the fluted, twisted trunk, the crown's
 * small narrow leaves in three tones, the cream flower sprays and the olives. New helpers only;
 * the shared tree helpers are imported, never edited.
 */
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { blob, bounds, dabOutline, padRect, ribbon, smoothPath, type Pt } from '../../paint/geometry';
import { mix, type Pigment } from '../../paint/pigments';
import type { DryOptions } from '../../paint/wet';
import { softRes, stableLayer } from './tree-paint';
import { branchProgress, partialPath, pointAt, ramp, widthAt, type Branch, type TreeView, viewPt } from './tree-structure';

/** The trunk's character, fixed per seed: its fluting, swellings, hollows and knots. */
export interface OliveTrunk {
  /** full-grown width at the waist (species units) */
  width: number;
  /** how far the foot flares, as a fraction of the half width */
  flare: number;
  /** radians the ridges turn round the trunk from foot to fork, when old */
  twist: number;
  /** angle of each ridge round the trunk at the foot (0 faces the viewer, − is the lit left) */
  ridges: number[];
  /** phases of the swellings on the left and right flanks */
  swell: [number, number, number, number];
  hollows: { t: number; theta: number; w: number; h: number }[];
  knots: { t: number; theta: number; r: number }[];
  /** buttress roots at the foot: side, reach as a fraction of the half width, height */
  roots: { side: number; reach: number; h: number }[];
}

export interface OliveLeaf {
  x: number;
  y: number;
  angle: number;
  length: number;
  /** 0 shaded, 1 mid grey-green, 2 silver underside turned up */
  tone: 0 | 1 | 2;
  asym: number;
  curve: number;
  /** arrival delay 0..1 within the foliage window */
  delay: number;
}

export interface TrunkColours {
  bark: Pigment;
  young: Pigment;
  shade: Pigment;
  groove: Pigment;
  lit: Pigment;
}

const SAMPLES = 34;

/** The trunk's centreline and flank offsets in view units at a growth (pure; the test reads it). */
export function trunkOutline(trunk: Branch, t: OliveTrunk, view: TreeView, f: number, age: number): { c: Pt[]; left: number[]; right: number[] } {
  const c: Pt[] = [];
  const left: number[] = [];
  const right: number[] = [];
  const k = view.scale * (0.13 + 0.87 * age ** 1.1);
  const [a, b, c2, d] = t.swell;
  for (let i = 0; i <= SAMPLES; i++) {
    const s = i / SAMPLES;
    const u = s * f;
    c.push(viewPt(view, pointAt(trunk, u)));
    let hw = (t.width / 2) * k;
    // a waist above the flared foot, and the crotch swelling where the limbs part
    hw *= 1 - 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.2));
    hw *= 1 + 0.12 * age * ramp(u, 0.6, 0.85) - 0.45 * ramp(u, 0.75, 1);
    const foot = Math.max(0, 1 - u / 0.2) ** 2;
    hw *= 1 + t.flare * age * foot;
    if (f < 1) hw *= 1 - 0.5 * ramp(s, 0.7, 1);
    const lump = age * 0.13;
    left.push(hw * (1 + lump * (Math.sin(u * 11 + a) * 0.6 + Math.sin(u * 23 + b) * 0.4)));
    right.push(hw * (1 + lump * (Math.sin(u * 13 + c2) * 0.6 + Math.sin(u * 19 + d) * 0.4)));
  }
  return { c, left, right };
}

/** A point on the trunk's surface at height fraction `i` of the outline and angle `theta` round it. */
function onTrunk(o: ReturnType<typeof trunkOutline>, i: number, theta: number): Pt {
  const c = o.c[i]!;
  const s = Math.sin(theta);
  return { x: c.x + s * (s < 0 ? o.left[i]! : o.right[i]!), y: c.y };
}

/**
 * The trunk: a grey-brown body with its shaded right flank, buttress roots at the foot, dark
 * grooves and pale lit ridges that wind round it as it ages, hollows with a lit lip, and knots.
 * Young, it is a smooth grey stem.
 */
export function paintOliveTrunk(p: Painter, trunk: Branch, t: OliveTrunk, view: TreeView, f: number, age: number, rng: Rng, col: TrunkColours, limbs: readonly Branch[] = []): void {
  if (f <= 0.002) return;
  const o = trunkOutline(trunk, t, view, f, age);
  const n = o.c.length;
  const edgeL = o.c.map((q, i) => ({ x: q.x - o.left[i]!, y: q.y }));
  const edgeR = o.c.map((q, i) => ({ x: q.x + o.right[i]!, y: q.y }));
  const sole = o.c[0]!.y + 2.5 * age;
  const body = [{ x: edgeL[0]!.x, y: sole }, ...edgeL, ...edgeR.slice().reverse(), { x: edgeR[0]!.x, y: sole }];
  const foot = o.c[0]!;
  const hw0 = (o.left[0]! + o.right[0]!) / 2;
  const roots = t.roots.map((r) => {
    const reach = hw0 * (1 + r.reach * age);
    const h = r.h * view.scale * (0.3 + 0.7 * age);
    const x0 = foot.x + r.side * hw0 * 0.4;
    // a buttress swelling out of the foot in a concave curve
    const pts: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      pts.push({ x: x0 + r.side * (reach - hw0 * 0.4) * u ** 1.6, y: foot.y - h * (1 - u) ** 2 + 1.5 * u });
    }
    pts.push({ x: x0, y: foot.y + 2 });
    return pts;
  });
  // the limbs' roots: each limb swells into the crotch, so the trunk parts instead of ending
  const top = o.c[n - 1]!;
  const topHw = (o.left[n - 1]! + o.right[n - 1]!) / 2;
  const scaffold = limbs.flatMap((l) => {
    const lf = branchProgress(l, view.tau);
    if (lf <= 0.01) return [];
    const from = { x: top.x + (viewPt(view, l.pts[0]!).x - top.x) * 0.5, y: top.y + topHw * 1.1 };
    const path = smoothPath([from, ...partialPath(l, lf).map((q) => viewPt(view, q))], 3);
    const hw = (u: number) => {
      const w = widthAt(l, u * lf) * view.scale * view.thick * (0.45 + 0.55 * age) * 0.5 * (lf < 1 ? 1 - 0.55 * ramp(u, 0.6, 1) : 1);
      const root = (1 - ramp(u, 0, 0.22)) ** 1.5;
      return Math.max(0.3, topHw * 0.8 * root + w * (1 - root));
    };
    return [{ path, hw }];
  });
  const crotch = scaffold.map((sc) => ribbon(sc.path, sc.hw));
  const area = padRect(bounds([...body, ...roots.flat(), ...crotch.flat()]), 6);
  const barkTone = mix(col.young, col.bark, age);
  const bark = padRect(bounds(body), 6);
  const B = stableLayer(p, area, rng.fork('trunk-body'));
  B.fill(body, barkTone, 0.9);
  if (age > 0.05) for (const r of roots) B.fill(r, barkTone, 0.9 * age);
  for (const c of crotch) B.fill(c, barkTone, 0.9);
  // laid over the limbs' feet, so the crotch reads as one piece of wood
  B.dry({ opacity: 0.94, edge: 0.4, edgeWidth: 1.2, sharpness: 0.75, centreLift: 0.25, granulation: 0.35, flow: 0.45, flowScale: 14, darken: 0.2, blend: 'source-over' });

  // the shaded right flank, its boundary wandering with the fluting
  const S = stableLayer(p, area, rng.fork('trunk-shade'), softRes(p));
  const mid = o.c.map((q, i) => ({ x: q.x + o.right[i]! * (0.05 + 0.25 * Math.sin(i * 0.5 + t.swell[0]) * age), y: q.y }));
  S.fill([...mid, ...edgeR.slice().reverse()], col.shade, 0.55);
  // and the underside of each scaffold limb
  for (const sc of scaffold) S.fill(ribbon(sc.path, (u) => sc.hw(u) * 0.5 * ramp(u, 0.1, 0.3), (u) => -sc.hw(u) * 0.5), col.shade, 0.5);
  S.dry({ opacity: 0.55 + 0.2 * age, edge: 0.15, edgeWidth: 2, sharpness: 0.4, centreLift: 0.1, granulation: 0.3, flow: 0.5, flowScale: 18 });

  if (age < 0.08) return;
  // grooves between the ridges and the ridges themselves, wound round the trunk
  const G = stableLayer(p, bark, rng.fork('trunk-grooves'));
  const R = stableLayer(p, bark, rng.fork('trunk-ridges'));
  const step = (Math.PI * 2) / t.ridges.length;
  const twist = t.twist * age;
  let ri = 0;
  const run = (theta0: number, into: typeof G, pigment: Pigment, width: number, alpha: number, lit: boolean) => {
    let seg: { q: Pt; w: number }[] = [];
    const flush = () => {
      if (seg.length >= 3) into.fill(ribbon(seg.map((s) => s.q), (u, i) => seg[i]!.w * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.04)) ** 0.5), pigment, alpha);
      seg = [];
    };
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const th = theta0 + twist * s * (1 + 0.3 * Math.sin(ri * 2.3 + t.swell[1])) + 0.25 * age * Math.sin(s * 5 + ri);
      const front = Math.cos(th);
      const hw = (o.left[i]! + o.right[i]!) / 2;
      const show = lit ? front > 0.05 && Math.sin(th) < 0.45 : front > 0.12;
      if (!show) {
        flush();
        continue;
      }
      seg.push({ q: onTrunk(o, i, th), w: hw * width * (0.35 + 0.65 * front) });
    }
    flush();
  };
  t.ridges.forEach((th, i) => {
    ri = i;
    run(th + step / 2, G, col.groove, 0.03 + 0.025 * ((i * 7) % 3), 0.42 * age, false);
    run(th, R, col.lit, 0.045, 0.5 * age, true);
  });
  // hollows: a dark pocket with its lit upper lip
  for (const h of t.hollows) {
    const k = ramp(age, 0.45, 0.95);
    if (k < 0.03) continue;
    const i = Math.round(h.t * (n - 1));
    const at = onTrunk(o, i, h.theta);
    const hw = (o.left[i]! + o.right[i]!) / 2;
    const rx = hw * h.w * k * Math.max(0.4, Math.cos(h.theta));
    const ry = h.h * view.scale * k;
    const hr = rng.fork(`hollow-${h.t.toFixed(3)}`);
    G.fill(blob(at.x, at.y, rx, ry, hr, { points: 16, irregularity: 0.25 }), col.groove, 0.7);
    R.fill(ribbon([{ x: at.x - rx * 1.1, y: at.y }, { x: at.x - rx * 0.4, y: at.y - ry * 1.05 }, { x: at.x + rx * 0.6, y: at.y - ry * 1.08 }], (u) => Math.sin(Math.PI * u) * Math.max(0.6, rx * 0.22)), col.lit, 0.7);
  }
  for (const kn of t.knots) {
    const i = Math.round(kn.t * (n - 1));
    const at = onTrunk(o, i, kn.theta);
    const r = kn.r * view.scale * age;
    if (r < 0.6) continue;
    const kr = rng.fork(`knot-${kn.t.toFixed(3)}`);
    G.fill(blob(at.x, at.y, r, r * 0.75, kr, { points: 10, irregularity: 0.3 }), col.groove, 0.22);
    R.fill(blob(at.x - r * 0.35, at.y - r * 0.4, r * 0.45, r * 0.3, kr, { points: 8, irregularity: 0.3 }), col.lit, 0.55);
  }
  G.dry({ opacity: 0.75, edge: 0.35, edgeWidth: 0.9, sharpness: 0.7, centreLift: 0.15, granulation: 0.3, flow: 0.4, flowScale: 10, darken: 0.2 });
  R.dry({ opacity: 0.55, edge: 0.15, edgeWidth: 0.8, sharpness: 0.65, centreLift: 0.1, granulation: 0.45, flow: 0.4, flowScale: 10, blend: 'source-over' });
}

export interface Bead {
  id: number;
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  pigment: Pigment;
  alpha: number;
}

/**
 * Many small narrow leaves in one wet layer, each at its arrival `k` (view units come from the
 * caller), with small round marks (olives, flowers) laid in under or over them in the same layer.
 */
export function paintOliveLeaves(p: Painter, leaves: readonly { at: Pt; l: OliveLeaf; k: number }[], view: TreeView, pigment: (l: OliveLeaf) => Pigment, rng: Rng, dry: DryOptions, under: readonly Bead[] = [], over: readonly Bead[] = []): void {
  const live = leaves.filter((x) => x.k > 0.04);
  const below = under.filter((b) => b.alpha > 0.03 && b.rx > 0.25);
  const above = over.filter((b) => b.alpha > 0.03 && b.rx > 0.25);
  if (!live.length && !below.length && !above.length) return;
  const L = stableLayer(p, padRect(bounds([...live.map((x) => x.at), ...below.map((b) => b.at), ...above.map((b) => b.at)]), 12), rng);
  const bead = (b: Bead) => L.fill(blob(b.at.x, b.at.y, b.rx, b.ry, rng.fork(`bead-${b.id}`), { points: 9, irregularity: 0.12, rotation: b.rot }), b.pigment, b.alpha);
  below.forEach(bead);
  for (const { at, l, k } of live) {
    const len = l.length * view.scale * (0.4 + 0.6 * k);
    L.fill(dabOutline(at.x, at.y, { angle: l.angle, length: len, width: len * 0.24, variant: 'leaf', asym: l.asym, curve: l.curve }, 5), pigment(l), 0.5 + 0.45 * k);
  }
  above.forEach(bead);
  L.dry(dry);
}
