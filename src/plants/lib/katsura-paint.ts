/**
 * Katsura painting helpers: round heart-shaped leaves (cordate, crenate, a small blunt tip) in
 * pairs, painted as single fills in shared wet layers, and the grey shaggy bark of its stems.
 * docs/devlog/88-katsura.md.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { blob, bounds, deformPolygon, padRect, ribbon, type Pt } from '../../paint/geometry';
import { lighten, mix, shade, type Pigment } from '../../paint/pigments';
import type { DryOptions } from '../../paint/wet';
import { stableLayer, type visibleBranches } from './tree-paint';
import { ramp, viewPt, type TreeView } from './tree-structure';

type Visible = ReturnType<typeof visibleBranches>[number];

export interface Heart {
  x: number;
  y: number;
  /** base → tip direction */
  angle: number;
  length: number;
  /** 0 light … 1 deep */
  tone: number;
  delay: number;
  id: number;
  /** the pad (or other group) the leaf belongs to, for its colour */
  group: number;
}

/**
 * A round heart leaf: base at (x, y), tip along `angle`. The sinus is a dent at the base, the
 * margin softly crenate, the tip a small blunt point. Pure.
 */
export function heartOutline(x: number, y: number, angle: number, length: number, wobble = 0, samples = 18): Pt[] {
  const R = length * 0.5;
  const cx = x + Math.cos(angle) * R;
  const cy = y + Math.sin(angle) * R;
  const out: Pt[] = [];
  for (let i = 0; i < samples; i++) {
    const psi = (i / samples) * Math.PI * 2 - Math.PI;
    const back = Math.abs(Math.abs(psi) - Math.PI);
    const notch = 0.42 * Math.exp(-((back / 0.42) ** 2));
    const tip = 0.12 * Math.exp(-((psi / 0.32) ** 2));
    const wide = 1.04 - 0.06 * Math.cos(2 * psi);
    const r = R * wide * (1 - notch + tip + 0.035 * Math.sin(9 * psi + wobble));
    const a = angle + psi;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/**
 * Many hearts in one wet layer. `size(h)` is the arrival 0..1: a leaf grows from nothing, so no
 * leaf ever appears at full size. `colour(h)` picks its pigment.
 */
export function paintHearts(
  p: Painter,
  hearts: readonly Heart[],
  view: TreeView,
  rng: Rng,
  size: (h: Heart) => number,
  colour: (h: Heart) => Pigment,
  dry: DryOptions = {},
): void {
  const live = hearts.map((h) => ({ h, k: size(h) })).filter((x) => x.k > 0.02);
  if (!live.length) return;
  const at = live.map(({ h }) => viewPt(view, h));
  const maxL = live.reduce((m, x) => Math.max(m, x.h.length), 1);
  const L = stableLayer(p, padRect(bounds(at), maxL * 1.4 + 3), rng.fork('hearts-dry'));
  const sc = 0.55 + 0.45 * view.scale;
  live.forEach(({ h, k }, i) => {
    const len = h.length * k * sc;
    if (len < 0.4) return;
    L.fill(heartOutline(at[i]!.x, at[i]!.y, h.angle, len, h.id * 1.7), colour(h), 0.5 + 0.4 * Math.min(1, k * 1.5));
  });
  L.dry({ opacity: 0.86, edge: 0.55, edgeWidth: 0.55, sharpness: 0.78, centreLift: 0.32, granulation: 0.1, flow: 0.3, flowScale: 10, darken: 0.22, ...dry });
}

/**
 * Pairs of young hearts at the growing tips of the skeleton (the sapling and while limbs
 * extend). A tip's pair grows with its branch and the whole set fades out as `amount` → 0.
 */
export function paintTipHearts(p: Painter, vis: readonly Visible[], view: TreeView, amount: number, rng: Rng, pigment: Pigment, size = 5.5): void {
  if (amount <= 0.01) return;
  const hearts: Heart[] = [];
  const hasKids = new Set<number>();
  for (const v of vis) if (v.b.parent >= 0 && v.f > 0.2) hasKids.add(v.b.parent);
  for (const v of vis) {
    if (hasKids.has(v.b.id) && v.b.order === 0 && view.tau > 0.3) continue;
    const n = v.path.length;
    const tip = v.path[n - 1]!;
    const prev = v.path[Math.max(0, n - 4)]!;
    const a = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const r = rng.fork(`tiph-${v.b.id}`);
    const k = ramp(v.f, 0, 0.35);
    // tip in model units: inverse of viewPt, so paintHearts maps it back
    const m = { x: view.base.x + (tip.x - view.base.x) / view.scale, y: view.base.y + (tip.y - view.base.y) / view.scale };
    for (let s = -1; s <= 1; s += 2) hearts.push({ ...m, angle: a + s * r.range(0.55, 0.95), length: size * r.range(0.85, 1.1) * k, tone: r.range(0, 1), delay: 0, id: v.b.id * 2 + (s > 0 ? 1 : 0), group: 0 });
  }
  const light = lighten(pigment, 0.1);
  paintHearts(p, hearts, view, rng.fork('tip-hearts'), () => 1, (h) => mix(light, pigment, h.tone), { opacity: 0.8 * amount });
}

/**
 * Grey, slightly shaggy bark on the stems: long vertical dry-brush furrows and short darker
 * curls where strips lift. Strips fade in with the stem's width, so they never pop in.
 */
export function paintShaggyBark(p: Painter, vis: readonly Visible[], rng: Rng, bark: Pigment, amount = 1): void {
  const dark = shade(bark, 0.35);
  const pale = mix(bark, '#f4efe2', 0.68);
  const stems = vis.filter((v) => v.b.order === 0 && v.hw(0.1) * 2 >= 2.4);
  if (!stems.length || amount <= 0.02) return;
  const pts: Pt[] = [];
  for (const v of stems) for (const q of v.path) pts.push(q);
  const area = padRect(bounds(pts), 8);
  const D = stableLayer(p, area, rng.fork('shag-dark-dry'));
  const P = stableLayer(p, area, rng.fork('shag-pale-dry'));
  let any = false;
  for (const v of stems) {
    const w0 = v.hw(0.1) * 2;
    const fade = ramp(w0, 2.4, 5.5) * amount;
    const r = rng.fork(`shag-${v.b.id}`);
    const n = v.path.length;
    for (let s = 0; s < 12; s++) {
      const t0 = r.range(0.02, 0.6);
      const t1 = Math.min(0.92, t0 + r.range(0.06, 0.22));
      const side = r.range(-0.6, 0.6);
      const isDark = r.chance(0.55);
      const wk = r.range(0.8, 1.2);
      const i0 = Math.floor(t0 * (n - 1));
      const i1 = Math.min(n - 1, Math.max(i0 + 2, Math.floor(t1 * (n - 1))));
      const seg: Pt[] = [];
      for (let i = i0; i <= i1; i++) seg.push({ x: v.path[i]!.x + side * v.hw(i / (n - 1)), y: v.path[i]!.y });
      if (seg.length < 2) continue;
      // a strip tapers at both ends and ripples a little, like a lifted flake
      const hw = (t: number) => w0 * (isDark ? 0.06 : 0.14) * wk * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      const off = (t: number) => w0 * 0.05 * Math.sin(t * 9 + s);
      (isDark ? D : P).fill(ribbon(seg, hw, off), isDark ? dark : pale, (isDark ? 0.75 : 0.95) * fade);
      // a lifted flake casts a hairline of shadow along its lower edge
      if (!isDark) D.fill(ribbon(seg, (t) => hw(t) * 0.35, (t) => off(t) + hw(t) * 1.1), dark, 0.6 * fade);
      any = true;
    }
  }
  if (!any) {
    D.discard();
    P.discard();
    return;
  }
  D.dry({ opacity: 0.7, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.1, granulation: 0.3, flowScale: 8 });
  P.dry({ opacity: 0.85, edge: 0.3, edgeWidth: 0.5, sharpness: 0.75, centreLift: 0.1, granulation: 0.4, flowScale: 8, blend: 'source-over' });
}

export interface Blot {
  x: number;
  y: number;
  r: number;
  alpha: number;
  pigment: Pigment;
  id: number;
}

/**
 * Soft scalloped blots in one wet layer (view units), with `holes` lifted out: the crown's body
 * wash and its lobe shade. A high `flood` merges overlaps into one wash. Each blot keeps its own
 * seed, so only its size and opacity change.
 */
export function paintBlots(p: Painter, blots: readonly Blot[], rng: Rng, holes: readonly { x: number; y: number; r: number }[], dry: DryOptions, res?: number, squash = 0.82, flood = 0.6): void {
  const live = blots.filter((b) => b.alpha > 0.02 && b.r > 0.8);
  if (!live.length) return;
  const maxR = live.reduce((m, b) => Math.max(m, b.r), 1);
  const L = stableLayer(p, padRect(bounds(live), maxR * 1.2 + 4), rng.fork('blots-dry'), res);
  for (const b of live) {
    const r = createRng(b.id * 131 + 17);
    const poly = blob(b.x, b.y, b.r, b.r * squash * r.range(0.9, 1.05), r, { points: 16, irregularity: 0.22, scallop: 0.5, scallops: r.int(5, 8), rotation: r.range(-0.4, 0.4) });
    L.fill(poly, b.pigment, b.alpha * flood);
    L.fill(deformPolygon(poly, r, { depth: 1, variance: 0.08, cap: b.r * 0.1 }), b.pigment, b.alpha * 0.45 * (1 - flood / 2));
  }
  holes.forEach((h, i) => {
    const r = createRng(i * 59 + 3);
    if (h.r > 0.8) L.lift(blob(h.x, h.y, h.r * 1.25, h.r * 0.6, r, { points: 12, irregularity: 0.45, rotation: r.range(-0.6, 0.6) }), 1);
  });
  L.dry(dry);
}
