/**
 * Painting helpers for the spearmint (docs/devlog/111-spearmint.md): the crinkled, toothed lance
 * leaves of one stem batched in a wet layer, and the slender spike of lilac whorls. New helpers,
 * so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { dabAxis, shadowSide } from './small-paint';

function bounds(pts: readonly Pt[], pad: number): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

export interface MintLeaf {
  key: string;
  at: Pt;
  angle: number;
  length: number;
  width: number;
  curve: number;
  tone: Pigment;
  /** teeth per margin and sunken veins per side, fixed by the plan */
  teeth: number;
  veins: number;
}

/**
 * The leaves of one stem in one wet layer: a lance blade, small forward teeth on both margins,
 * a sunken midrib and side veins in the deep green, dried with a fine mottle for the crinkle.
 */
export function mintLeaves(p: Painter, rng: Rng, leaves: readonly MintLeaf[], o: { deep: Pigment; opacity: number }): void {
  const live = leaves.filter((l) => l.length > 0.3);
  if (!live.length) return;
  const reach = Math.max(...live.map((l) => l.length)) + 1;
  const L = p.layer(bounds(live.map((l) => l.at), reach));
  for (const l of live) {
    const r = rng.fork(l.key);
    const side = shadowSide(l.angle);
    p.dabInto(L, l.at, l.tone, { rng: r.fork('blade'), variant: 'leaf', angle: l.angle, length: l.length, width: l.width, curve: l.curve, asym: 0, pool: 0.55, poolSide: side, basePool: 0.2, layers: 3 });
    const axis = dabAxis(l.at, l.angle, l.length, l.curve, 16);
    const tk = smooth((l.length - 1.2) / 3);
    for (let i = 0; i < l.teeth; i++) {
      const t = 0.3 + (0.6 * (i + 0.5)) / l.teeth;
      const q = axis[Math.round(t * 16)]!;
      const q2 = axis[Math.min(16, Math.round(t * 16) + 1)]!;
      const ta = Math.atan2(q2.y - q.y, q2.x - q.x);
      const hw = l.width * 0.5 * Math.sin(Math.PI * t ** 0.8) ** 0.9;
      const tl = Math.min(l.length * 0.12, l.width * 0.34) * (1 - t * 0.35) * tk;
      if (tl < 0.08) continue;
      for (const sgn of [-1, 1]) {
        const nx = -Math.sin(ta) * sgn;
        const ny = Math.cos(ta) * sgn;
        p.dabInto(L, { x: q.x + nx * hw * 0.68, y: q.y + ny * hw * 0.68 }, l.tone, { rng: r.fork(`t-${i}-${sgn}`), variant: 'leaf', angle: ta + sgn * 0.9, length: tl, width: tl * 0.7, pool: 0, basePool: 0, layers: 1 });
      }
    }
    const vk = smooth((l.length - 2.5) / 4);
    if (!visible(vk)) continue;
    p.dabInto(L, l.at, o.deep, { rng: r.fork('mid'), variant: 'blade', angle: l.angle, length: l.length * 0.85 * vk, width: Math.max(0.2, l.width * 0.07), curve: l.curve, pool: 0, basePool: 0.3, layers: 1 });
    for (let i = 0; i < l.veins; i++) {
      const t = 0.22 + (0.56 * (i + 0.5)) / l.veins;
      const q = axis[Math.round(t * 16)]!;
      const q2 = axis[Math.min(16, Math.round(t * 16) + 1)]!;
      const ta = Math.atan2(q2.y - q.y, q2.x - q.x);
      const hw = l.width * 0.5 * Math.sin(Math.PI * t ** 0.8) ** 0.9;
      for (const sgn of [-1, 1]) {
        p.dabInto(L, q, mix(o.deep, l.tone, 0.2), { rng: r.fork(`v-${i}-${sgn}`), variant: 'needle', angle: ta + sgn * 0.62, length: hw * 0.85 * vk, width: Math.max(0.18, l.width * 0.05), curve: -sgn * 0.3, pool: 0, basePool: 0.2, layers: 1 });
      }
    }
  }
  L.dry({ opacity: o.opacity, edge: 0.5, edgeWidth: 0.3, sharpness: 0.75, centreLift: 0.35, granulation: 0.12, flow: 0.7, flowScale: 2.2, darken: 0.32, blend: 'source-over' });
}

export interface Whorl {
  /** 0 = the spike's base … 1 = its tip */
  t: number;
  /** flower dabs round the whorl: offset across the spike (−1..1) and up (−1..1) */
  florets: { u: number; v: number; size: number }[];
}

export interface MintSpike {
  base: Pt;
  angle: number;
  /** current length (grows) and the half-width of the lowest whorl */
  length: number;
  width: number;
  whorls: readonly Whorl[];
  /** 0..1 per whorl: green calyx bud → open lilac flowers */
  open: (t: number) => number;
}

/**
 * A slender, tapering spike of whorls: green calyces first, then tiny lilac flowers that open
 * from the base up, all in one wet layer so a whorl reads as one soft lilac ring.
 */
export function mintSpike(p: Painter, rng: Rng, s: MintSpike, o: { calyx: Pigment; bloom: Pigment; pale: Pigment; opacity: number }): void {
  if (s.length < 0.4) return;
  const ca = Math.cos(s.angle);
  const sa = Math.sin(s.angle);
  const along = (t: number): Pt => ({ x: s.base.x + ca * s.length * t, y: s.base.y + sa * s.length * t });
  const L = p.layer(bounds([s.base, along(1)], s.width * 1.6 + 1));
  // the thin axis the whorls sit on
  p.dabInto(L, s.base, o.calyx, { rng: rng.fork('axis'), variant: 'blade', angle: s.angle, length: s.length, width: Math.max(0.2, s.width * 0.22), pool: 0, basePool: 0.2, layers: 1 });
  const nx = -sa;
  const ny = ca;
  for (const [i, w] of s.whorls.entries()) {
    const c = along(w.t);
    const half = s.width * lerp(1, 0.35, w.t) * clamp01(s.length / 4);
    const ok = clamp01(s.open(w.t));
    w.florets.forEach((f, j) => {
      const at = { x: c.x + nx * f.u * half + ca * f.v * half * 0.45, y: c.y + ny * f.u * half + sa * f.v * half * 0.45 };
      const size = half * f.size * lerp(0.7, 1.05, ok);
      if (size < 0.08) return;
      const pig = ok < 0.5 ? mix(o.calyx, o.bloom, ok * 1.3) : mix(o.bloom, o.pale, (ok - 0.5) * (f.u * f.u < 0.3 ? 0.7 : 0.25));
      p.dabInto(L, at, pig, { rng: rng.fork(`f-${i}-${j}`), variant: 'round', angle: s.angle + f.u * 1.2, length: size * 1.15, width: size * 0.95, pool: 0.3, poolSide: shadowSide(s.angle), basePool: 0, layers: 1 });
    });
  }
  L.dry({ opacity: o.opacity, edge: 0.45, edgeWidth: 0.22, sharpness: 0.6, centreLift: 0.2, granulation: 0.05, flow: 0.4, flowScale: 1.6, darken: 0.28 });
}

/** Faint wet earth along the channel: the patch's footing, there from the start. */
export function dampSoil(p: Painter, rng: Rng, o: { rx: number; k: number }): void {
  p.wash({ cx: 0, cy: 0.4, rx: o.rx, ry: o.rx * 0.16 }, mix(PIGMENTS.stoneWarm, PIGMENTS.shadow, 0.45), {
    rng: rng.fork('soil'),
    opacity: 0.22 * lerp(0.6, 1, o.k),
    edge: 0.25,
    centreLift: 0.3,
    granulation: 0.45,
    fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.7 },
  });
}
