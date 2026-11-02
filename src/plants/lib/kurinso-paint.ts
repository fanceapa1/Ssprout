/**
 * Painting helpers for the kurinsō (species/kurinso.ts): the long, crinkled spoon leaf of the
 * basal rosette, and the flat five-lobed primroses of a whorl, painted together in one wash.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, easeOut, lerp, smooth, visible } from './small-growth';
import { dabAxis, shadowSide } from './small-paint';
import { lerpAngle, projectDir, type FlowerView } from './small-structure';

export interface SpoonPose {
  angle: number;
  length: number;
  width: number;
  curve: number;
  /** unfurl 0..1: grows, starts rolled narrow */
  k: number;
}

export interface SpoonStyle {
  pigment: Pigment;
  /** cooler, deeper green pooled in the furrows and the shaded flank */
  deep: Pigment;
  /** side veins each side (the furrows between the crinkles) */
  veins: number;
  /** -1..1: one flank fuller than the other */
  asym: number;
  opacity?: number;
}

/**
 * A spoon-shaped leaf in one wet layer dried source-over (a front leaf covers the one behind):
 * a narrow winged base widening to a round tip, a pale lifted midrib and short furrows.
 */
export function spoonLeaf(p: Painter, rng: Rng, at: Pt, pose: SpoonPose, s: SpoonStyle): void {
  const k = clamp01(pose.k);
  if (!visible(k)) return;
  const length = pose.length * easeOut(k);
  if (length < 0.4) return;
  const width = pose.width * easeOut(k) * lerp(0.3, 1, smooth(k));
  const curve = pose.curve * lerp(0.4, 1, k);
  const angle = pose.angle;
  const ext = length * 1.2 + width;
  const L = p.layer({ x: at.x - ext, y: at.y - ext, w: ext * 2, h: ext * 2 });
  const side = shadowSide(angle);
  p.dabInto(L, at, s.pigment, { rng: rng.fork('blade'), variant: 'petal', angle, length, width, curve, asym: s.asym, pool: 0.55, poolSide: side, basePool: 0.25, layers: 4 });
  // a second, offset pass gives the margin its uneven, wavy edge
  p.dabInto(L, at, mix(s.pigment, s.deep, 0.15), { rng: rng.fork('wave'), variant: 'petal', angle: angle + side * 0.04, length: length * 0.97, width: width * 0.94, curve: curve * 1.1, asym: -s.asym * 0.6, pool: 0.2, poolSide: side, basePool: 0, layers: 2 });
  const axis = dabAxis(at, angle, length, curve, 20);
  // furrows between the bullate swellings: side veins angled forward from the midrib
  const vk = smooth((length - 6) / 10) * smooth(k * 1.5 - 0.3);
  if (visible(vk)) {
    for (let i = 0; i < s.veins; i++) {
      const t = 0.3 + (0.58 * (i + 0.5)) / s.veins;
      const q = axis[Math.round(t * 20)]!;
      const q2 = axis[Math.min(20, Math.round(t * 20) + 1)]!;
      const ta = Math.atan2(q2.y - q.y, q2.x - q.x);
      const hw = width * 0.5 * lerp(0.45, 1, t);
      for (const sgn of [-1, 1]) {
        p.dabInto(L, q, s.deep, { rng: rng.fork(`v-${i}-${sgn}`), variant: 'needle', angle: ta + sgn * 0.8, length: hw * 0.85 * vk, width: Math.max(0.3, width * 0.06), curve: sgn * 0.15, pool: 0, basePool: 0.3, layers: 2 });
      }
    }
  }
  L.dry({
    opacity: (s.opacity ?? 0.9) * smooth(length / 3),
    edge: 0.5,
    edgeWidth: Math.max(0.25, Math.min(1.4, width * 0.08)),
    sharpness: 0.7,
    centreLift: 0.3,
    granulation: 0.12,
    flow: 0.45,
    flowScale: Math.max(3, length * 0.4),
    darken: 0.3,
    blend: 'source-over',
  });
  // the pale, broad midrib, lifted out as a wet brush would
  if (length > 5) {
    p.stroke(dabAxis(at, angle, length, curve, 8, 0.82), {
      rng: rng.fork('midrib'),
      pigment: mix(s.pigment, PIGMENTS.petalWhite, 0.5),
      width: Math.max(0.35, width * 0.09),
      taper: [0.05, 0.7],
      wobble: 0.15,
      wetness: 0.3,
      opacity: 0.5 * smooth((length - 5) / 8),
      edge: 0.2,
      blend: 'source-over',
    });
  }
}

export interface Primrose {
  c: Pt;
  view: FlowerView;
  /** radius at full opening (world units) */
  size: number;
  open: number;
  /** lobe angles in the flower's plane */
  lobes: readonly number[];
  /** 1 = seen face-on from the front, 0 = we see its back */
  face: number;
}

export interface PrimroseStyle {
  pigment: Pigment;
  light: Pigment;
  eye: Pigment;
  throat?: Pigment;
  /** opaque pale petals (the white form) */
  white?: boolean;
}

const lobeLen = (f: Primrose) => f.size * lerp(0.2, 1, smooth(clamp01(f.open)));

/**
 * The flowers of one half-whorl in a single wet layer, so neighbours merge as a ring instead of
 * stacking into dark overlaps. Each lobe is two round dabs splayed so the tip keeps its notch.
 */
export function primroseRing(p: Painter, rng: Rng, flowers: readonly (Primrose & { key: string })[], s: PrimroseStyle, opacity: number): void {
  const live = flowers.filter((f) => visible(f.open) && f.size > 0.2);
  if (!live.length) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const f of live) {
    const e = f.size * 1.4 + 1;
    x0 = Math.min(x0, f.c.x - e);
    y0 = Math.min(y0, f.c.y - e);
    x1 = Math.max(x1, f.c.x + e);
    y1 = Math.max(y1, f.c.y + e);
  }
  const L = p.layer({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  for (const f of live) {
    const so = smooth(clamp01(f.open));
    const r = lobeLen(f);
    const back = 1 - f.face;
    const fr = rng.fork(f.key);
    f.lobes.forEach((a, i) => {
      const d = projectDir(a, f.view);
      // closed: lobes huddle round the face direction
      const ang = lerpAngle(f.view.roll + Math.cos(a) * 0.4, Math.atan2(d.y, d.x), so);
      const len = r * lerp(0.6, Math.max(0.3, Math.hypot(d.x, d.y)), so);
      const wid = r * 0.66 * lerp(0.5, 1, so);
      for (const sgn of [-1, 1]) {
        p.dabInto(L, f.c, mix(s.light, s.pigment, 0.3 + back * 0.35), { rng: fr.fork(`l-${i}-${sgn}`), variant: 'round', angle: ang + sgn * 0.16 * so, length: len, width: wid * 0.62, pool: 0.35, poolSide: sgn, basePool: 0, layers: 2 });
      }
      p.dabInto(L, f.c, s.pigment, { rng: fr.fork(`in-${i}`), variant: 'petal', angle: ang, length: len * 0.62, width: wid * 0.5, pool: 0, basePool: 0.35, layers: 2 });
    });
  }
  L.dry({
    opacity,
    edge: 0.45,
    edgeWidth: 0.35,
    sharpness: 0.72,
    centreLift: 0.3,
    granulation: 0.05,
    flow: 0.35,
    flowScale: 6,
    darken: s.white ? 0.15 : 0.25,
    blend: s.white ? 'source-over' : 'multiply',
  });
}

/** The eye of an open flower that faces us: a soft dark ring round a small pale throat. */
export function primroseEye(p: Painter, rng: Rng, f: Primrose, s: PrimroseStyle): void {
  const ek = smooth((f.open - 0.35) / 0.5) * smooth((f.face - 0.25) / 0.5);
  if (!visible(ek)) return;
  const r = lobeLen(f);
  // a round dab grows from its base: centre it by stepping back half its length
  const across = f.view.roll + Math.PI / 2;
  const centred = (len: number): Pt => ({ x: f.c.x - Math.cos(across) * len * 0.5, y: f.c.y - Math.sin(across) * len * 0.5 });
  const eyeLen = r * 0.5;
  p.dab(centred(eyeLen), s.eye, { rng: rng.fork('eye'), variant: 'round', angle: across, length: eyeLen, width: eyeLen * lerp(0.55, 0.95, f.view.tilt), pool: 0.3, basePool: 0, opacity: 0.55 * ek, edge: 0.55, sharpness: 0.5 });
  const thLen = r * 0.2;
  p.dab(centred(thLen), s.throat ?? mix(PIGMENTS.gold, PIGMENTS.sap, 0.5), { rng: rng.fork('throat'), variant: 'round', angle: across, length: thLen, width: thLen * lerp(0.6, 1, f.view.tilt), opacity: 0.7 * ek, edge: 0.2, blend: 'source-over' });
}

/** A primrose bud: a slim calyx-cupped point, green turning to the bloom colour as it swells. */
export function primroseBud(p: Painter, rng: Rng, at: Pt, o: { angle: number; length: number; k: number; colour: number; pigment: Pigment; green: Pigment; opacity: number }): void {
  const k = clamp01(o.k);
  if (!visible(k) || !visible(o.opacity)) return;
  const len = o.length * easeOut(k);
  if (len < 0.3) return;
  const L = p.layer({ x: at.x - len * 1.3, y: at.y - len * 1.3, w: len * 2.6, h: len * 2.6 });
  p.dabInto(L, at, mix(o.green, o.pigment, clamp01(o.colour)), { rng: rng.fork('body'), variant: 'petal', angle: o.angle, length: len, width: len * 0.5, pool: 0.4, poolSide: shadowSide(o.angle), basePool: 0, layers: 3 });
  p.dabInto(L, at, shade(o.green, 0.1), { rng: rng.fork('calyx'), variant: 'leaf', angle: o.angle, length: len * 0.5, width: len * 0.52, pool: 0.2, basePool: 0.2, layers: 2 });
  L.dry({ opacity: o.opacity * lerp(0.6, 1, k), edge: 0.5, edgeWidth: Math.max(0.15, len * 0.08), sharpness: 0.7, centreLift: 0.2, granulation: 0.05, flow: 0.3, flowScale: Math.max(2, len) });
}
