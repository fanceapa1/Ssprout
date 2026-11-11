/**
 * Painting helpers for the alfalfa (docs/devlog/125-alfalfa.md): leaves of three narrow leaflets
 * toothed at the tip, short dense racemes of pea flowers, and the coiled seed pod. New helpers,
 * so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, deformPolygon, jitter, layerAlpha, layersFor, mix, ribbon, rgba, type Painter, type Pigment, type Pt, type WetLayer } from '../../paint';
import { strokeGeometry } from '../../paint/primitives';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { dabAxis, shadowSide } from './small-paint';
import { add, pathLen } from './small-structure';

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

export interface StemMark {
  rng: Rng;
  pts: readonly Pt[];
  width: number;
  pigment: Pigment;
  /** the strength `paintStem` would dry it at */
  opacity: number;
}

/**
 * `paintStem`'s stroke (no ink) laid into an open layer at `alpha` of its strength, so a band's
 * stems dry with its leaves instead of one layer each (devlog 151).
 */
function stemInto(p: Painter, L: WetLayer, s: StemMark, alpha: number): void {
  const len = pathLen(s.pts);
  if (s.pts.length < 2 || len < Math.max(0.4, s.width * 0.8)) return;
  const width = s.width * clamp01(0.45 + len / (s.width * 30));
  const rng = s.rng.fork('stroke');
  // the recording painter in the species tests has no env
  const g = strokeGeometry(s.pts, { width, taper: [0.04, 0.3], pressure: [1, 0.85, 0.7], wobble: 0.2 }, p.env?.flowNoise ?? (() => 0), rng);
  const n = p.env ? layersFor(p.env, 3) : 3;
  const a = layerAlpha(n, 0.88) * Math.min(1, alpha * smooth(len / (s.width * 10)));
  for (let k = 0; k < n; k++) {
    const wk = 1 + rng.gaussian(0, 0.05);
    L.fill(deformPolygon(ribbon(g.path, (t) => g.hw(t) * wk, g.off), rng, { depth: 1, variance: 0.05 }), jitter(s.pigment, rng, 0.02), a);
  }
}

/**
 * Leaves of three in one wet layer: a thin petiole, a middle leaflet on a short stalk and two
 * side leaflets, each an oblong blade widest near its blunt tip, with a few small teeth there.
 */
export function trefoils(p: Painter, rng: Rng, leaves: readonly Trefoil[], o: { deep: Pigment; stalk: Pigment; opacity: number; stems?: readonly StemMark[] }): void {
  const live = leaves.filter((l) => l.open * l.size > 0.3);
  const stems = o.stems ?? [];
  if (!live.length && !stems.length) return;
  const L = p.layer(ALFALFA_AREA);
  for (const s of stems) stemInto(p, L, s, (1.3 * s.opacity) / o.opacity);
  for (const l of live) {
    const r = rng.fork(l.key);
    const k = l.open;
    const pet = l.petiole * k;
    if (pet > 0.3) fillAll(L, [spindle(l.at, l.angle, pet, 0.32, 0.3)], jitter(o.stalk, r.fork('pet'), 0.03), MARK_ALPHA);
    const tip = add(l.at, l.angle, pet);
    const spread = lerp(0.12, l.spread, smooth(k));
    const size = l.size * k;
    const width = l.width * k * lerp(0.6, 1, k);
    const teeth: Pt[][] = [];
    const veins: Pt[][] = [];
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
      p.dabInto(L, at, l.tone, { rng: r.fork(`l-${name}`), variant: 'petal', angle, length: len, width: wid, curve: 0, asym: 0, pool: 0.55, poolSide: side, basePool: 0, layers: 1 });
      // the teeth: three small points across the blunt tip, and the midrib (plain fills, one per leaf)
      const tk = smooth((len - 1.6) / 2);
      if (visible(tk)) {
        const axis = dabAxis(at, angle, len, 0, 10);
        const q = axis[9]!;
        for (const u of [-1, 0, 1]) {
          const nx = -Math.sin(angle) * u * wid * 0.3;
          const ny = Math.cos(angle) * u * wid * 0.3;
          teeth.push(spindle({ x: q.x + nx, y: q.y + ny }, angle + u * 0.35, len * 0.2 * tk, len * 0.1 * tk, 0.4));
        }
      }
      const vk = smooth((len - 2.4) / 2);
      if (visible(vk)) veins.push(spindle(at, angle, len * 0.8 * vk, Math.max(0.16, wid * 0.08), 0.25));
    }
    fillAll(L, teeth, jitter(l.tone, r.fork('teeth'), 0.03), MARK_ALPHA);
    fillAll(L, veins, jitter(o.deep, r.fork('veins'), 0.03), MARK_ALPHA);
  }
  L.dry({ opacity: o.opacity, edge: 0.55, edgeWidth: 0.28, sharpness: 0.75, centreLift: 0.22, granulation: 0.1, flow: 0.6, flowScale: 2, darken: 0.3, blend: 'source-over' });
}

const MARK_ALPHA = layerAlpha(1, 0.88);

/** A four-point spindle from `at` along `angle`, widest (`width`) at `waist` of its length. */
function spindle(at: Pt, angle: number, length: number, width: number, waist: number): Pt[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const mx = at.x + c * length * waist;
  const my = at.y + s * length * waist;
  const hx = -s * width * 0.5;
  const hy = c * width * 0.5;
  return [at, { x: mx + hx, y: my + hy }, { x: at.x + c * length, y: at.y + s * length }, { x: mx - hx, y: my - hy }];
}

/** Fill several small polygons as one path (one canvas fill). */
function fillAll(L: WetLayer, polys: readonly Pt[][], pigment: Pigment, alpha: number): void {
  if (!polys.length) return;
  const c = L.ctx;
  c.beginPath();
  for (const poly of polys) {
    c.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) c.lineTo(poly[i]!.x, poly[i]!.y);
    c.closePath();
  }
  c.fillStyle = rgba(pigment, alpha);
  c.fill();
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
  /** its own rng (else forked from the layer's by `key`) and its strength in the shared layer */
  rng?: Rng;
  alpha?: number;
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
    const r = rc.rng ?? rng.fork(rc.key);
    L.ctx.globalAlpha = rc.alpha ?? 1;
    const ca = Math.cos(rc.angle);
    const sa = Math.sin(rc.angle);
    const nx = -sa;
    const ny = ca;
    const grown = clamp01(rc.length / 3);
    const bloom = mix(o.bloom, o.old, rc.age);
    const keel = mix(o.keel, bloom, 0.15);
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
        const kl = size * 0.7 * kk;
        const kc = add(c, a, kl * 0.5 - size * 0.1);
        L.ctx.beginPath();
        L.ctx.ellipse(kc.x, kc.y, kl * 0.5, size * 0.21 * kk, a, 0, Math.PI * 2);
        L.ctx.fillStyle = rgba(jitter(keel, r.fork(`k-${j}`), 0.03), MARK_ALPHA);
        L.ctx.fill();
      }
    });
  }
  L.ctx.globalAlpha = 1;
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
    layers: 6,
    opacity: 0.1 * lerp(0.6, 1, o.k),
    edge: 0.25,
    centreLift: 0.3,
    granulation: 0.5,
    fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.7 },
  });
}
