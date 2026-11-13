/**
 * Painting helpers for the Aleppo pine (species/aleppo-pine.ts): the two-toned bark, the crown's
 * soft needle clouds with dry needle strokes at their edges, and the cones. New helpers only; the
 * shared tree helpers are imported, never edited. Coordinates are in view units from the caller.
 */
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { blob, bounds, dabOutline, padRect, ribbon, type Pt } from '../../paint/geometry';
import type { Pigment } from '../../paint/pigments';
import type { DryOptions } from '../../paint/wet';
import { softRes, stableLayer } from './tree-paint';
import { ramp } from './tree-structure';

/** A tuft of needles at a twig's end: where it sits, which way it points, how lit it is. */
export interface PineTuft {
  x: number;
  y: number;
  /** the tuft's reach (species units) */
  r: number;
  /** heading of the twig it ends, radians */
  angle: number;
  /** -1 shaded … 1 lit */
  lit: number;
  /** arrival delay 0..1 */
  delay: number;
  id: number;
}

export interface PineCone {
  x: number;
  y: number;
  /** points back along the branch, radians */
  angle: number;
  length: number;
  /** an old grey cone kept from earlier years */
  old: boolean;
  delay: number;
  id: number;
}

export interface PineColours {
  /** the silver-grey upper stem and branches */
  silver: Pigment;
  /** the reddish-brown, fissured lower trunk */
  red: Pigment;
  fissure: Pigment;
  plate: Pigment;
  /** cloud washes: lit, mid, shade */
  wash: [Pigment, Pigment, Pigment];
  /** needle strokes: lit, mid, shade */
  needle: [Pigment, Pigment, Pigment];
  cone: Pigment;
  oldCone: Pigment;
}

export const toneOf = (lit: number): 0 | 1 | 2 => (lit > 0.3 ? 0 : lit < -0.25 ? 2 : 1);

/**
 * The cloud body: one soft blot per tuft, lit ones pale yellow-green and shaded ones grey-green,
 * dried as one wet layer so the tufts run together into clouds with sky between them.
 */
export function paintPineWash(p: Painter, tufts: readonly { t: PineTuft; at: Pt; k: number }[], scale: number, col: PineColours, rng: Rng, opacity = 0.72): void {
  const live = tufts.filter((x) => x.k > 0.03);
  if (!live.length) return;
  const W = stableLayer(p, padRect(bounds(live.map((x) => x.at)), 16 * scale + 4), rng, softRes(p));
  for (const { t, at, k } of live) {
    const r = rng.fork(`w-${t.id}`);
    const rad = t.r * 1.3 * scale * (0.45 + 0.55 * k);
    const cx = at.x + Math.cos(t.angle) * rad * 0.3;
    const cy = at.y + Math.sin(t.angle) * rad * 0.3;
    W.fill(blob(cx, cy, rad, rad * 0.62, r, { points: 9, irregularity: 0.35, rotation: r.range(-0.4, 0.4) }), col.wash[toneOf(t.lit)], 0.38 * Math.min(1, k * 2));
  }
  W.dry({ opacity, edge: 0.18, edgeWidth: 2, sharpness: 0.3, centreLift: 0.2, granulation: 0.22, flow: 0.55, flowScale: 12 });
}

/**
 * The needles: each tuft is a fan of fine strokes from the twig's end, spreading out and up, so
 * the clouds' edges break into needles. `only` limits the pass to one tone (a layer per tone).
 */
export function paintPineNeedles(p: Painter, tufts: readonly { t: PineTuft; at: Pt; k: number }[], scale: number, pigment: (t: PineTuft) => Pigment, rng: Rng, dry: DryOptions): void {
  const live = tufts.filter((x) => x.k > 0.04);
  if (!live.length) return;
  const L = stableLayer(p, padRect(bounds(live.map((x) => x.at)), 16 * scale + 4), rng);
  for (const { t, at, k } of live) {
    const r = rng.fork(`n-${t.id}`);
    const n = 7 + (t.id % 3);
    const reach = t.r * scale * (0.4 + 0.6 * k);
    // the twig: needles leave it along its last few units, brushing forward and out
    const dx = Math.cos(t.angle);
    const dy = Math.sin(t.angle);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5;
      const along = r.range(-0.35, 0.15) * reach;
      const a = t.angle + u * 1.5 + r.gaussian(0, 0.12);
      const len = reach * r.range(0.65, 1);
      L.fill(dabOutline(at.x + dx * along, at.y + dy * along, { angle: a, length: len, width: Math.max(0.45, len * 0.06), variant: 'needle', curve: u * 0.3 + r.range(-0.08, 0.08) }, 5), pigment(t), 0.4 + 0.35 * k);
    }
  }
  L.dry(dry);
}

/** Small reddish-brown cones in ones and twos pointing back along the branch, a few old grey ones. */
export function paintPineCones(p: Painter, cones: readonly { c: PineCone; at: Pt; k: number }[], scale: number, col: PineColours, rng: Rng): void {
  const live = cones.filter((x) => x.k > 0.03);
  if (!live.length) return;
  const L = stableLayer(p, padRect(bounds(live.map((x) => x.at)), 8 * scale + 3), rng);
  for (const { c, at, k } of live) {
    const len = c.length * scale * (0.3 + 0.7 * k);
    const poly = dabOutline(at.x, at.y, { angle: c.angle, length: len, width: len * 0.55, variant: 'leaf', curve: 0 }, 7);
    L.fill(poly, c.old ? col.oldCone : col.cone, 0.85 * Math.min(1, k * 2));
    // the scales: two dark bands across the cone
    for (const f of [0.38, 0.66]) {
      const q = { x: at.x + Math.cos(c.angle) * len * f, y: at.y + Math.sin(c.angle) * len * f };
      const n = { x: -Math.sin(c.angle), y: Math.cos(c.angle) };
      const w = len * 0.22;
      L.fill(ribbon([{ x: q.x - n.x * w, y: q.y - n.y * w }, { x: q.x + n.x * w, y: q.y + n.y * w }], () => Math.max(0.25, len * 0.045)), col.fissure, 0.45 * k);
    }
  }
  L.dry({ opacity: 0.9, edge: 0.45, edgeWidth: 0.6, sharpness: 0.8, centreLift: 0.25, granulation: 0.2, flow: 0.3, flowScale: 8, darken: 0.25 });
}

/**
 * The lower trunk's reddish-brown, fissured bark over the silver skeleton: a wash fading up the
 * stem, then long dark fissures between lit plates. `path` and `hw` are the trunk as painted.
 */
export function paintPineBark(p: Painter, path: readonly Pt[], hw: (t: number) => number, age: number, col: PineColours, rng: Rng, reach = 0.6): void {
  if (age < 0.03 || path.length < 3) return;
  const n = path.length;
  const top = Math.max(3, Math.round((n - 1) * reach));
  const low = path.slice(0, top + 1);
  const fade = (i: number) => 1 - ramp(i / top, 0.3, 0.9);
  const area = padRect(bounds(low), hw(0) * 2 + 4);
  const B = stableLayer(p, area, rng.fork('bark-red'));
  // overlapping washes from the foot to staggered heights, so the red fades up into the silver stem
  const washes = 7;
  const br = rng.fork('bark-reach');
  for (let b = 0; b < washes; b++) {
    const end = Math.max(2, Math.round(top * (0.35 + 0.65 * ((b + br.range(0, 0.8)) / washes))));
    const seg = low.slice(0, end + 1);
    const wk = br.range(0.85, 1);
    B.fill(ribbon(seg, (u) => hw((u * end) / (n - 1)) * wk * (1 - 0.4 * ramp(u, 0.8, 1))), col.red, 0.2 * age);
  }
  B.dry({ opacity: 0.9, edge: 0.08, edgeWidth: 1, sharpness: 0.35, centreLift: 0.15, granulation: 0.35, flow: 0.4, flowScale: 10, darken: 0.15 });
  if (age < 0.2) return;
  const F = stableLayer(p, area, rng.fork('bark-fissures'));
  const fr = rng.fork('fissures');
  const lines = 4;
  for (let l = 0; l < lines; l++) {
    const side = (l / (lines - 1)) * 1.4 - 0.7 + fr.range(-0.1, 0.1);
    let i = fr.int(0, 3);
    while (i < top - 3) {
      const len = fr.int(4, 9);
      const j = Math.min(top, i + len);
      const seg = low.slice(i, j + 1).map((q, k) => {
        const t = (i + k) / (n - 1);
        return { x: q.x + hw(t) * (side + 0.12 * Math.sin(k * 1.7 + l)), y: q.y };
      });
      const k = age * fade((i + j) / 2);
      if (seg.length >= 2 && k > 0.05) {
        F.fill(ribbon(seg, (u) => Math.max(0.3, hw((i + u * (j - i)) / (n - 1)) * 0.09) * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)) ** 0.5), col.fissure, 0.6 * k);
        // the plate's lit edge beside it, on the left
        if (side < 0.2) F.fill(ribbon(seg.map((q) => ({ x: q.x - hw(0) * 0.12, y: q.y })), () => Math.max(0.3, hw(0) * 0.06)), col.plate, 0.35 * k);
      }
      i = j + fr.int(1, 3);
    }
  }
  F.dry({ opacity: 0.8, edge: 0.35, edgeWidth: 0.7, sharpness: 0.75, centreLift: 0.1, granulation: 0.35, flow: 0.4, flowScale: 8, darken: 0.2 });
}
