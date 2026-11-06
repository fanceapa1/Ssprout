import type { Rng } from '../../core/rng';
import { PIGMENTS, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { paintPetal } from './small-paint';
import { UP, petalPose, type FlowerView } from './small-structure';

/**
 * Painting helpers for the white water lily (Nymphaea lotus), used by that species only:
 * a floating pad with a sharply toothed rim and a narrow sinus, and a many-petalled white star
 * held above the water round a crown of golden stamens.
 */

export interface ToothedPad {
  x: number;
  y: number;
  r: number;
  /** vertical squash of the disc as seen from the bank */
  flat: number;
  notch: number;
  notchWidth: number;
  teeth: number;
  /** tooth depth as a fraction of the radius */
  depth: number;
  tone: Pigment;
  flush: Pigment;
  spots: { a: number; d: number; s: number }[];
  veins: number[];
}

/** The pad's rim: a squashed disc whose edge is a saw of forward-raked teeth, cut by its sinus. */
export function toothedOutline(p: ToothedPad, k: number, s = 1): Pt[] {
  const rx = p.r * s;
  const ry = p.r * s * p.flat * lerp(0.25, 1, k);
  const half = (p.notchWidth / 2) * k;
  const span = Math.PI * 2 - 2 * half;
  const depth = p.depth * smooth((k - 0.3) / 0.7);
  const pts: Pt[] = [];
  const at = (t: number, rr: number) => pts.push({ x: p.x + Math.cos(t) * rx * rr, y: p.y + Math.sin(t) * ry * rr });
  for (let i = 0; i < p.teeth; i++) {
    const t0 = p.notch + half + (span * i) / p.teeth;
    const step = span / p.teeth;
    at(t0, 1 - depth * 0.35);
    at(t0 + step * 0.72, 1 + depth);
  }
  at(p.notch + half + span, 1 + depth * 0.6);
  // the sinus runs in almost to the centre
  at(p.notch, 0.1);
  return pts;
}

export function paintToothedPad(p: Painter, rng: Rng, pad: ToothedPad, k: number, s: number): void {
  const op = smooth(k * 3);
  const outline = toothedOutline(pad, k, s);
  const rx = pad.r * s;
  const ry = pad.r * s * pad.flat;
  // its cool shadow on the water just below, so the dark disc sits on the surface
  p.glaze({ cx: pad.x + 1, cy: pad.y + ry * 0.22, rx: rx * 1.02, ry: ry * 0.9 }, PIGMENTS.celadonDeep, { rng: rng.fork('shadow'), opacity: 0.2 * op });
  p.wetInWet(outline, lighten(pad.tone, 0.1), mix(shade(pad.tone, 0.2), pad.flush, 0.35), {
    rng: rng.fork('pad'),
    angle: UP,
    split: 0.55,
    deform: 0.025,
    spread: 0.06,
    softness: 0.4,
    opacity: 0.9 * op,
    edge: 0.65,
    centreLift: 0.22,
    granulation: 0.25,
  });
  // the bronze-purple flush bleeds in from the far rim
  p.glaze(outline, pad.flush, { rng: rng.fork('flush'), opacity: 0.3 * smooth((k - 0.35) / 0.65), fade: { angle: -UP, start: 0.05, amount: 0.85 } });
  const mk = smooth((k - 0.5) / 0.5);
  if (visible(mk)) {
    pad.spots.forEach((sp, i) => {
      const cx = pad.x + Math.cos(sp.a) * rx * sp.d;
      const cy = pad.y + Math.sin(sp.a) * ry * sp.d;
      p.glaze({ cx, cy, rx: sp.s * s * mk, ry: sp.s * s * pad.flat * 1.3 * mk }, mix(pad.flush, PIGMENTS.sumi, 0.25), { rng: rng.fork(`spot-${i}`), opacity: 0.32 * mk });
    });
    pad.veins.forEach((a, i) => {
      if (Math.abs(((a - pad.notch + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < pad.notchWidth) return;
      p.inkLine(
        [
          { x: pad.x + Math.cos(a) * rx * 0.12, y: pad.y + Math.sin(a) * ry * 0.12 },
          { x: pad.x + Math.cos(a) * rx * 0.85, y: pad.y + Math.sin(a) * ry * 0.85 },
        ],
        { rng: rng.fork(`vein-${i}`), width: 0.3, pigment: lighten(pad.tone, 0.35), opacity: 0.22 * mk, breaks: 0.25, taper: [0.2, 0.5], wobble: 0.15 },
      );
    });
  }
  // the saw: forward-raked teeth in one wet layer, so the wash's soft rim gets its points back
  const ek = smooth((k - 0.4) / 0.6);
  if (visible(ek)) {
    const half = (pad.notchWidth / 2) * k;
    const span = Math.PI * 2 - 2 * half;
    const L = p.layer({ x: pad.x - rx * 1.3, y: pad.y - ry * 1.6 - 2, w: rx * 2.6, h: ry * 3.2 + 4 });
    for (let i = 0; i < pad.teeth; i++) {
      const t = pad.notch + half + (span * (i + 0.5)) / pad.teeth;
      const base = { x: pad.x + Math.cos(t) * rx, y: pad.y + Math.sin(t) * ry };
      const a = t + 0.9;
      const len = rx * pad.depth * 1.25 * ek;
      const dir = { x: Math.cos(a), y: Math.sin(a) * pad.flat };
      const near = Math.sin(t) > 0;
      p.dabInto(L, base, near ? shade(pad.tone, 0.1) : mix(pad.tone, pad.flush, 0.4), { rng: rng.fork(`tooth-${i}`), variant: 'needle', angle: Math.atan2(dir.y, dir.x), length: Math.max(len * 0.45, len * Math.hypot(dir.x, dir.y)), width: len * 0.42, pool: 0.1, basePool: 0, layers: 2 });
    }
    L.dry({ opacity: 0.7 * ek, edge: 0.5, edgeWidth: 0.25, sharpness: 0.85, centreLift: 0.05, granulation: 0.1, flow: 0.2, flowScale: 3, darken: 0.25 });
  }
}

export interface StarPetal {
  a: number;
  len: number;
  wid: number;
}

export interface StarFlower {
  c: Pt;
  size: number;
  view: FlowerView;
  sepals: StarPetal[];
  outer: StarPetal[];
  inner: StarPetal[];
}

export interface StarPaint {
  petal: Pigment;
  blush: Pigment;
  shade: Pigment;
  sepal: Pigment;
  gold: Pigment;
  goldDeep: Pigment;
}

/** The open flower: green-backed sepals, two rows of narrow pointed petals, the stamen crown. */
export function paintStarFlower(p: Painter, rng: Rng, f: StarFlower, open: number, opacity: number, c: StarPaint): void {
  if (!visible(open)) return;
  const row = (list: StarPetal[], o: number, len: number, wid: number, label: string, style: (pl: StarPetal) => Parameters<typeof paintPetal>[4], filter?: (depth: number) => boolean) => {
    list
      .map((pl, i) => ({ pl, i, pose: petalPose(pl.a, f.view, o, 0.55) }))
      .filter(({ pose }) => !filter || filter(pose.depth))
      .sort((a, b) => a.pose.depth - b.pose.depth)
      .forEach(({ pl, i, pose }) => {
        paintPetal(p, rng.fork(`${label}-${i}`), f.c, { angle: pose.angle, length: f.size * len * pl.len * lerp(0.35, 1, pose.len), width: f.size * wid * pl.wid * lerp(0.6, 1, open), curve: 0 }, style(pl));
      });
  };
  const white = (inner: number) => () => ({ pigment: c.petal, inner: c.blush, innerReach: inner, innerWidth: 0.7, tip: mix(c.petal, c.shade, 0.35), variant: 'leaf' as const, white: true, opacity, edge: 0.5 });
  row(f.sepals, open * 1.05, 0.95, 0.3, 'sepal', () => ({ pigment: c.sepal, inner: shade(c.sepal, 0.2), innerReach: 0.5, tip: mix(c.sepal, c.petal, 0.35), variant: 'leaf', opacity: opacity * 0.9, edge: 0.5 }));
  row(f.outer, open, 1, 0.26, 'outer', white(0.42));
  row(f.inner, open * 0.62, 0.82, 0.22, 'inner', white(0.5), (d) => d < 0);
  // the crown: a ring of incurved golden stamens round a pale disc
  const k = smooth((open - 0.25) / 0.75);
  if (visible(k)) {
    const s = f.size;
    const ring = { x: f.c.x, y: f.c.y - s * 0.08 };
    p.dab(ring, c.goldDeep, { rng: rng.fork('disc'), variant: 'round', angle: 0, length: s * 0.42 * k, width: s * 0.42 * f.view.tilt * k, opacity: 0.45 * opacity * k, blend: 'source-over', edge: 0.4 });
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const base = { x: ring.x + Math.cos(a) * s * 0.2, y: ring.y + Math.sin(a) * s * 0.2 * f.view.tilt };
      const tip = { x: base.x - Math.cos(a) * s * 0.04, y: base.y - s * lerp(0.05, 0.15, k) * (0.8 + 0.2 * Math.sin(a)) };
      p.stroke([base, tip], { rng: rng.fork(`stamen-${i}`), pigment: Math.sin(a) > 0 ? c.gold : mix(c.gold, c.goldDeep, 0.4), width: s * 0.045, taper: [0.1, 0.5], wobble: 0.1, wetness: 0.3, opacity: 0.9 * opacity * k, edge: 0.35 });
    }
  }
  row(f.inner, open * 0.62, 0.82, 0.22, 'inner', white(0.5), (d) => d >= 0);
}

/** A pointed green bud on its stalk, a slim ovoid drawn as two leaf dabs in one wet layer. */
export function paintPointedBud(p: Painter, rng: Rng, at: Pt, o: { angle: number; length: number; width: number; green: Pigment; white: Pigment; opacity: number; open: number }): void {
  if (o.length < 0.3) return;
  const L = p.layer({ x: at.x - o.length * 1.4, y: at.y - o.length * 1.4, w: o.length * 2.8, h: o.length * 2.8 });
  p.dabInto(L, at, o.green, { rng: rng.fork('body'), variant: 'leaf', angle: o.angle, length: o.length, width: o.width, curve: 0, pool: 0.4, basePool: 0.3, layers: 3 });
  // the white petals show between the sepals as it loosens
  const w = clamp01(o.open);
  if (w > 0.02) p.dabInto(L, { x: at.x + Math.cos(o.angle) * o.length * 0.2, y: at.y + Math.sin(o.angle) * o.length * 0.2 }, o.white, { rng: rng.fork('slit'), variant: 'leaf', angle: o.angle, length: o.length * 0.75 * w, width: o.width * 0.35 * w, curve: 0, pool: 0, basePool: 0, layers: 2 });
  L.dry({ opacity: o.opacity, edge: 0.55, edgeWidth: Math.max(0.25, o.width * 0.1), sharpness: 0.7, centreLift: 0.25, granulation: 0.08, flow: 0.3, flowScale: Math.max(2, o.length * 0.7) });
}
