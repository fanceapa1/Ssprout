/**
 * Katsura painting helpers: round heart-shaped leaves (cordate, crenate, a small blunt tip) in
 * pairs, painted as single fills in shared wet layers, and the grey shaggy bark of its stems.
 * docs/devlog/88-katsura.md.
 */
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { bounds, padRect, type Pt } from '../../paint/geometry';
import { lighten, mix, shade, type Pigment } from '../../paint/pigments';
import { dryBrush, stroke } from '../../paint/primitives';
import type { DryOptions } from '../../paint/wet';
import { stableLayer, stableTarget, type visibleBranches } from './tree-paint';
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
  for (const v of vis) {
    if (v.b.order !== 0) continue;
    const w0 = v.hw(0.1) * 2;
    const fade = ramp(w0, 2.4, 5.5) * amount;
    if (fade <= 0.02) continue;
    const r = rng.fork(`shag-${v.b.id}`);
    const t = stableTarget(p, r);
    const n = v.path.length;
    const strips = 7;
    for (let s = 0; s < strips; s++) {
      const t0 = r.range(0.02, 0.55);
      const t1 = Math.min(0.92, t0 + r.range(0.12, 0.3));
      const side = r.range(-0.6, 0.6);
      const dark1 = r.chance(0.55);
      const i0 = Math.floor(t0 * (n - 1));
      const i1 = Math.max(i0 + 2, Math.floor(t1 * (n - 1)));
      if (i1 >= n) continue;
      const seg: Pt[] = [];
      for (let i = i0; i <= i1; i += 3) {
        const q = v.path[i]!;
        const tt = i / (n - 1);
        seg.push({ x: q.x + side * v.hw(tt), y: q.y });
      }
      if (seg.length < 2) continue;
      if (dark1) {
        stroke(t, seg, { rng: r, pigment: dark, width: Math.max(0.5, w0 * 0.1), taper: [0.3, 0.4], wobble: 0.3, wetness: 0.3, opacity: 0.5 * fade, edge: 0.4 });
      } else {
        dryBrush(t, seg, { rng: r, pigment: mix(bark, '#ffffff', 0.18), width: w0 * 0.22, dryness: 0.8, opacity: 0.45 * fade, blend: 'source-over' });
      }
    }
  }
}
