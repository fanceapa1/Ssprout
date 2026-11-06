/**
 * Painting helpers for the alfalfa (docs/devlog/125-alfalfa.md): leaves of three narrow leaflets
 * toothed at the tip, short dense racemes of pea flowers, and the coiled seed pod. New helpers,
 * so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { dabAxis, shadowSide } from './small-paint';
import { add } from './small-structure';

/** One fixed wet-layer area for the whole design box, so no layer grows in jumps. */
export const ALFALFA_AREA = { x: -36, y: -63, w: 72, h: 73 };

export interface Trefoil {
  key: string;
  /** the node on the stem, and the petiole's direction from it */
  at: Pt;
  angle: number;
  petiole: number;
  /** leaflet length and width at full size */
  size: number;
  width: number;
  /** angle of the side leaflets off the middle one, fully open */
  spread: number;
  tone: Pigment;
  /** 0 folded bud … 1 open */
  open: number;
}

/**
 * Leaves of three in one wet layer: a thin petiole, a middle leaflet on a short stalk and two
 * side leaflets, each an oblong blade widest near its blunt tip, with a few small teeth there.
 */
export function trefoils(p: Painter, rng: Rng, leaves: readonly Trefoil[], o: { deep: Pigment; stalk: Pigment; opacity: number }): void {
  const live = leaves.filter((l) => l.open * l.size > 0.3);
  if (!live.length) return;
  const L = p.layer(ALFALFA_AREA);
  for (const l of live) {
    const r = rng.fork(l.key);
    const k = l.open;
    const pet = l.petiole * k;
    if (pet > 0.3) p.dabInto(L, l.at, o.stalk, { rng: r.fork('pet'), variant: 'blade', angle: l.angle, length: pet, width: 0.32, pool: 0, basePool: 0.2, layers: 1 });
    const tip = add(l.at, l.angle, pet);
    const spread = lerp(0.12, l.spread, smooth(k));
    const size = l.size * k;
    const width = l.width * k * lerp(0.6, 1, k);
    const parts: [string, Pt, number, number][] = [
      ['a', tip, l.angle - spread, 0.86],
      ['b', tip, l.angle + spread, 0.86],
      ['m', add(tip, l.angle, size * 0.14), l.angle, 1],
    ];
    for (const [name, at, angle, scale] of parts) {
      const len = size * scale;
      const wid = width * scale;
      if (len < 0.4) continue;
      const side = shadowSide(angle);
      p.dabInto(L, at, l.tone, { rng: r.fork(`l-${name}`), variant: 'petal', angle, length: len, width: wid, curve: 0, asym: 0, pool: 0.55, poolSide: side, basePool: 0.15, layers: 2 });
      // the teeth: three small points across the blunt tip
      const tk = smooth((len - 1.6) / 2);
      if (visible(tk)) {
        const axis = dabAxis(at, angle, len, 0, 10);
        const q = axis[9]!;
        for (const u of [-1, 0, 1]) {
          const nx = -Math.sin(angle) * u * wid * 0.3;
          const ny = Math.cos(angle) * u * wid * 0.3;
          p.dabInto(L, { x: q.x + nx, y: q.y + ny }, l.tone, { rng: r.fork(`t-${name}-${u}`), variant: 'leaf', angle: angle + u * 0.35, length: len * 0.2 * tk, width: len * 0.1 * tk, pool: 0, basePool: 0, layers: 1 });
        }
      }
      const vk = smooth((len - 2.4) / 2);
      if (visible(vk)) p.dabInto(L, at, o.deep, { rng: r.fork(`v-${name}`), variant: 'blade', angle, length: len * 0.8 * vk, width: Math.max(0.16, wid * 0.08), pool: 0, basePool: 0.2, layers: 1 });
    }
  }
  L.dry({ opacity: o.opacity, edge: 0.55, edgeWidth: 0.28, sharpness: 0.75, centreLift: 0.22, granulation: 0.1, flow: 0.6, flowScale: 2, darken: 0.3, blend: 'source-over' });
}

export interface Floret {
  /** 0 = the raceme's base … 1 = its tip; −1..1 across it */
  v: number;
  u: number;
  size: number;
  /** 0..1: how far this floret leans to the pale lilac */
  pale: number;
}

export interface Raceme {
  key: string;
  base: Pt;
  angle: number;
  /** current length and the half-width at its base */
  length: number;
  width: number;
  florets: readonly Floret[];
  /** 0 fresh violet … 1 an older cluster gone bluish */
  age: number;
  /** 0..1 per position along the raceme: green bud → open flower */
  open: (v: number) => number;
}

/**
 * Short, dense racemes in one wet layer: tiny pea flowers crowded round a short axis, each a
 * rounded standard over a darker keel, opening from the base of the cluster to its tip.
 */
export function racemes(p: Painter, rng: Rng, list: readonly Raceme[], o: { bud: Pigment; bloom: Pigment; pale: Pigment; old: Pigment; keel: Pigment; opacity: number }): void {
  const live = list.filter((rc) => rc.length > 0.4);
  if (!live.length) return;
  const L = p.layer(ALFALFA_AREA);
  for (const rc of live) {
    const r = rng.fork(rc.key);
    const ca = Math.cos(rc.angle);
    const sa = Math.sin(rc.angle);
    const nx = -sa;
    const ny = ca;
    const grown = clamp01(rc.length / 3);
    const bloom = mix(o.bloom, o.old, rc.age);
    // a soft body under the florets, so the cluster reads as one compact head
    const mid = clamp01(rc.open(0.5));
    p.dabInto(L, rc.base, mix(o.bud, mix(bloom, o.pale, 0.6), mid), { rng: r.fork('body'), variant: 'petal', angle: rc.angle, length: rc.length * 1.02, width: rc.width * 1.7 * grown, pool: 0.3, poolSide: shadowSide(rc.angle), basePool: 0.2, layers: 1 });
    rc.florets.forEach((f, j) => {
      const half = rc.width * lerp(1, 0.5, f.v) * grown;
      const c = { x: rc.base.x + ca * rc.length * f.v + nx * f.u * half, y: rc.base.y + sa * rc.length * f.v + ny * f.u * half };
      const ok = clamp01(rc.open(f.v));
      const size = f.size * lerp(0.55, 1, ok) * lerp(0.4, 1, grown);
      if (size < 0.1) return;
      // a floret faces out from the axis and a little up the raceme
      const a = rc.angle + Math.sign(f.u || 1) * lerp(0.35, 1.25, Math.abs(f.u));
      const pig = ok < 0.5 ? mix(o.bud, bloom, ok * 1.2) : mix(bloom, o.pale, f.pale * (ok - 0.5) * 2);
      p.dabInto(L, c, pig, { rng: r.fork(`f-${j}`), variant: 'petal', angle: a, length: size * 1.35, width: size * 1.05, pool: 0.35, poolSide: shadowSide(a), basePool: 0.25, layers: 1 });
      if (ok > 0.4) {
        const kk = smooth((ok - 0.4) / 0.6);
        p.dabInto(L, add(c, a, -size * 0.1), mix(o.keel, bloom, 0.15), { rng: r.fork(`k-${j}`), variant: 'round', angle: a, length: size * 0.7 * kk, width: size * 0.42 * kk, pool: 0, basePool: 0, layers: 1 });
      }
    });
  }
  L.dry({ opacity: o.opacity, edge: 0.5, edgeWidth: 0.22, sharpness: 0.65, centreLift: 0.18, granulation: 0.06, flow: 0.4, flowScale: 1.6, darken: 0.3 });
}

/** A seed pod coiled like a tiny snail shell: a straw disc with a darker spiral drawn on it. */
export function coiledPod(p: Painter, rng: Rng, c: Pt, o: { r: number; turns: number; rot: number; k: number; pigment: Pigment; line: Pigment }): void {
  if (!visible(o.k) || o.r * o.k < 0.25) return;
  const r = o.r * o.k;
  p.dab(c, o.pigment, { rng: rng.fork('disc'), variant: 'round', angle: o.rot, length: r * 2.1, width: r * 1.85, opacity: 0.85 * smooth(o.k * 2), pool: 0.5, poolSide: 1, basePool: 0, layers: 2 });
  const pts: Pt[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = o.rot + s * o.turns * Math.PI * 2;
    const rr = r * lerp(0.15, 0.95, s);
    pts.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * 0.9 });
  }
  p.inkLine(pts, { rng: rng.fork('coil'), width: Math.max(0.18, r * 0.16), pigment: o.line, opacity: 0.55 * smooth(o.k * 1.5), breaks: 0.1, wobble: 0.15, taper: [0.2, 0.2] });
}

/** Turned, watered earth of a plot under the clump, there from the start. */
export function plotSoil(p: Painter, rng: Rng, o: { rx: number; k: number }): void {
  p.wash({ cx: 0, cy: 0.5, rx: o.rx, ry: o.rx * 0.13 }, mix(PIGMENTS.stoneWarm, PIGMENTS.wood, 0.4), {
    rng: rng.fork('soil'),
    opacity: 0.1 * lerp(0.6, 1, o.k),
    edge: 0.25,
    centreLift: 0.3,
    granulation: 0.5,
    fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.7 },
  });
}
