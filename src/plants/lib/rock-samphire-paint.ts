/**
 * Painting helpers for the rock samphire (docs/systems/plants-species-a.md): fat, smooth,
 * forked leaf fingers with a lit side, stout umbel stalks and flat plates of tiny flowers.
 * Used by that species only.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, padRect, ribbon, smoothPath, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;
const LIGHT_DIR = -2.3;

// ---------------------------------------------------------------------------------------------
// the fat finger (a leaf segment)

export interface FingerSpec {
  base: Pt;
  angle: number;
  len: number;
  /** full width at the fattest point */
  wid: number;
  bend: number;
}

export interface FingerGeom {
  outline: Pt[];
  /** the flank away from the light, down to the midline */
  shade: Pt[];
  /** the lit stripe, lifted to paper */
  gloss: Pt[];
  tip: Pt;
}

const profile = (u: number): number => (1 - Math.abs(2 * u - 1) ** 3.2) ** 0.5 * (0.72 + 0.3 * u);

/** A smooth blunt cylinder, a little fatter towards its tip, in screen space. */
export function fingerGeometry(s: FingerSpec): FingerGeom {
  const ca = Math.cos(s.angle);
  const sa = Math.sin(s.angle);
  const to = (u: number, v: number): Pt => {
    const x = u * s.len;
    const y = v + s.bend * s.len * u * u;
    return { x: s.base.x + x * ca - y * sa, y: s.base.y + x * sa + y * ca };
  };
  const n = 9;
  const hw = (u: number) => (s.wid / 2) * profile(u);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    left.push(to(u, -hw(u)));
    right.push(to(u, hw(u)));
  }
  const mid = Array.from({ length: n + 1 }, (_, i) => to(i / n, 0));
  const nx = -sa;
  const ny = ca;
  const litSign = nx * Math.cos(LIGHT_DIR) + ny * Math.sin(LIGHT_DIR) > 0 ? 1 : -1;
  const shadeSide = litSign === 1 ? left : right;
  const us = Array.from({ length: 7 }, (_, i) => 0.14 + (0.72 * i) / 6);
  const gloss = [...us.map((u) => to(u, litSign * hw(u) * 0.7)), ...[...us].reverse().map((u) => to(u, litSign * hw(u) * 0.42))];
  return {
    outline: [...left, ...[...right].reverse()],
    shade: [...shadeSide, ...[...mid].reverse()],
    gloss,
    tip: to(1, 0),
  };
}

export interface FingerMark {
  geom: FingerGeom;
  pigment: Pigment;
  deep: Pigment;
  /** a tint over the tip (yellow or red-purple), with its strength */
  tint: Pigment;
  tintK: number;
  seed: number;
  alpha: number;
}

/** Leaf fingers: two wet washes, the shaded flank, a tint at the tip, and a lifted gloss stripe. */
export function paintFingers(p: Painter, marks: readonly FingerMark[], opacity = 0.93): void {
  const live = marks.filter((m) => m.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => m.geom.outline)), 3));
  for (const m of live) {
    const rng = createRng(m.seed);
    const a = m.alpha;
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.025 }), jitter(m.pigment, rng, 0.02), 0.6 * a);
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.03 }), jitter(m.pigment, rng, 0.02), 0.3 * a);
    L.fill(deformPolygon(m.geom.shade, rng, { depth: 1, variance: 0.03 }), m.deep, 0.44 * a);
    if (m.tintK > 0.02) {
      const o = m.geom.outline;
      const tipHalf = o.filter((_, i) => i >= o.length * 0.32 && i <= o.length * 0.68);
      L.fill(deformPolygon(tipHalf, rng, { depth: 1, variance: 0.04 }), m.tint, 0.55 * m.tintK * a);
    }
  }
  for (const m of live) {
    if (m.alpha < 0.4) continue;
    L.lift(m.geom.gloss, 0.4 * Math.min(1, m.alpha));
  }
  L.dry({ opacity, edge: 0.5, edgeWidth: 0.8, sharpness: 0.66, centreLift: 0.06, granulation: 0.26, flow: 0.3, flowScale: 8, dry: 0.02, darken: 0.2 });
}

// ---------------------------------------------------------------------------------------------
// stalks

export interface StalkMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
}

export function paintStalks(p: Painter, stalks: readonly StalkMark[], opacity = 0.9): void {
  const live = stalks.filter((s) => s.pts.length >= 2 && s.width > 0.15);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), 3));
  for (const s of live) {
    const rng = createRng(s.seed);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.04, 0.12], endWidth: 0.8, fills: 2, coverage: 0.9 });
    ribbonInto(L, s.pts, s.width * 0.4, s.deep, rng, { taper: [0.1, 0.3], endWidth: 0.7, fills: 1, offset: s.width * 0.2 });
  }
  L.dry({ opacity, edge: 0.4, edgeWidth: 0.7, sharpness: 0.6, centreLift: 0.05, granulation: 0.2, flow: 0.25, flowScale: 8, dry: 0.03 });
}

// ---------------------------------------------------------------------------------------------
// umbels

export interface UmbelMark {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  alpha: number;
  /** how far the flowers have opened, 0 a tight green bud … 1 */
  open: number;
  pigment: Pigment;
  deep: Pigment;
  ray: Pigment;
  /** 0 fresh … 1 ripening seed */
  age: number;
  /** where the flower clusters sit: radius fraction, angle */
  clusters: [number, number][];
  seed: number;
}

function ellipse(u: UmbelMark, k = 1, n = 20): Pt[] {
  const c = Math.cos(u.rot);
  const s = Math.sin(u.rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * u.rx * k;
    const y = Math.sin(a) * u.ry * k;
    return { x: u.at.x + x * c - y * s, y: u.at.y + x * s + y * c };
  });
}

const place = (u: UmbelMark, r: number, a: number): Pt => {
  const c = Math.cos(u.rot);
  const s = Math.sin(u.rot);
  const x = Math.cos(a) * r * u.rx;
  const y = Math.sin(a) * r * u.ry;
  return { x: u.at.x + x * c - y * s, y: u.at.y + x * s + y * c };
};

const blob = (c: Pt, r: number, n = 7): Pt[] => Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos((i / n) * TAU) * r, y: c.y + Math.sin((i / n) * TAU) * r * 0.85 }));

/** Umbels: a soft plate, thin rays to rounded clusters of tiny flowers, pale pips lifted out. */
export function paintUmbels(p: Painter, umbels: readonly UmbelMark[]): void {
  const live = umbels.filter((u) => u.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((u) => ellipse(u, 1.3))), 3));
  for (const u of live) {
    const rng = createRng(u.seed);
    const a = u.alpha;
    L.fill(deformPolygon(ellipse(u, 1.02), rng, { depth: 1, variance: 0.06 }), jitter(u.pigment, rng, 0.02), 0.5 * a);
    const rayN = u.clusters.length;
    for (let i = 0; i < rayN; i++) {
      const [r, ang] = u.clusters[i]!;
      const tipPt = place(u, r * u.open, ang);
      const rayPts = [u.at, { x: (u.at.x + tipPt.x) / 2, y: (u.at.y + tipPt.y) / 2 - 0.3 }, tipPt];
      if (u.open > 0.15) L.fill(ribbon(smoothPath(rayPts, 1.2), (t) => 0.2 * (1 - 0.4 * t)), u.ray, 0.6 * a);
    }
    for (let i = 0; i < rayN; i++) {
      const [r, ang] = u.clusters[i]!;
      const c = place(u, r * u.open, ang);
      const cr = (0.8 + 0.5 * ((i * 7) % 3) / 2) * u.rx * 0.2 * (0.35 + 0.65 * u.open);
      L.fill(deformPolygon(blob(c, cr * 1.15), rng, { depth: 1, variance: 0.1 }), jitter(u.pigment, rng, 0.025), 0.72 * a);
      L.fill(deformPolygon(blob({ x: c.x + cr * 0.2, y: c.y + cr * 0.3 }, cr * 0.7), rng, { depth: 1, variance: 0.1 }), jitter(u.deep, rng, 0.02), 0.34 * a);
      if (u.open > 0.6) {
        for (let k = 0; k < 3; k++) {
          const q = { x: c.x + Math.cos(k * 2.1 + i) * cr * 0.55, y: c.y + Math.sin(k * 2.1 + i) * cr * 0.45 - cr * 0.1 };
          L.lift(blob(q, cr * 0.2, 5), 0.55 * a);
        }
      }
    }
    L.fill(deformPolygon(ellipse({ ...u, at: { x: u.at.x + u.rx * 0.1, y: u.at.y + u.ry * 0.45 } }, 0.8), rng, { depth: 1, variance: 0.06 }), u.deep, 0.16 * a * (0.4 + 0.6 * u.open));
  }
  L.dry({ opacity: 0.94, edge: 0.4, edgeWidth: 0.7, sharpness: 0.55, centreLift: 0.04, granulation: 0.4, flow: 0.3, flowScale: 6, darken: 0.2 });
}
