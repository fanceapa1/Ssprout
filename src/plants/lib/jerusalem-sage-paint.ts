/**
 * Painting helpers for the Jerusalem sage (docs/systems/plants-species-a.md): a broken grey-green
 * wash, felted wrinkled leaves with pale undersides, pale woolly stems and whorls of hooded
 * golden-yellow flowers. Used by that species only.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, ribbon, smoothPath, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// leaves

export interface LeafGeom {
  outline: Pt[];
  shade: Pt[];
  mid: Pt[];
  veins: Pt[][];
}

/** An ovate-lanceolate leaf, widest low down, with a softly wrinkled edge, in screen space. */
export function leafGeometry(base: Pt, angle: number, len: number, wid: number, wave: number, phase: number, shadeSide: 1 | -1): LeafGeom {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const to = (u: number, v: number): Pt => ({ x: base.x + u * len * ca - v * sa, y: base.y + u * len * sa + v * ca });
  const hw = (u: number) => (wid / 2) * Math.sin(Math.PI * u ** 0.58) ** 0.5 * (1 + wave * Math.sin(u * 23 + phase));
  const steps = [0.04, 0.12, 0.24, 0.38, 0.52, 0.66, 0.79, 0.9, 0.96];
  const a = steps.map((u) => to(u, hw(u)));
  const b = steps.map((u) => to(u, -hw(u)));
  const mid = [to(0.02, 0), to(0.4, 0), to(0.8, 0), to(0.97, 0)];
  const tip = to(1, 0);
  const veins = [0.3, 0.55].flatMap((u) => [1, -1].map((s) => [to(u, 0), to(u + 0.16, s * hw(u + 0.16) * 0.8)]));
  return { outline: [to(0, 0), ...a, tip, ...[...b].reverse()], shade: [...(shadeSide === 1 ? a : b), tip, ...[...mid].reverse()], mid, veins };
}

export interface LeafMark {
  geom: LeafGeom;
  pigment: Pigment;
  deep: Pigment;
  /** how much of the cooler shaded half shows (an underside shows little) */
  shade: number;
  seed: number;
  alpha: number;
}

export interface Reserve {
  at: Pt;
  rx: number;
  ry: number;
  amount: number;
}

function disc(r: Reserve, k = 1, n = 12): Pt[] {
  return Array.from({ length: n }, (_, i) => ({ x: r.at.x + Math.cos((i / n) * TAU) * r.rx * k, y: r.at.y + Math.sin((i / n) * TAU) * r.ry * k }));
}

/** Felted leaves: a grey-green wash, a cooler shaded half, midrib and wrinkle veins lifted. */
export function paintLeaves(p: Painter, marks: readonly LeafMark[], reserves: readonly Reserve[]): void {
  const live = marks.filter((m) => m.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => m.geom.outline)), 3));
  for (const m of live) {
    const rng = createRng(m.seed);
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.05 }), jitter(m.pigment, rng, 0.025), 0.46 * m.alpha);
    L.fill(deformPolygon(m.geom.shade, rng, { depth: 1, variance: 0.05 }), m.deep, 0.22 * m.shade * m.alpha);
  }
  for (const m of live) {
    if (m.alpha < 0.8) continue;
    L.lift(ribbon(smoothPath(m.geom.mid, 1.2), (t) => 0.32 * (1 - 0.6 * t)), 0.2);
    for (const v of m.geom.veins) L.lift(ribbon(v, () => 0.2), 0.12);
  }
  for (const r of reserves) L.lift(disc(r, 1), r.amount);
  L.dry({ opacity: 0.9, edge: 0.3, edgeWidth: 0.9, sharpness: 0.45, centreLift: 0.1, granulation: 0.6, flow: 0.35, flowScale: 7, dry: 0.1, darken: 0.08 });
}

// ---------------------------------------------------------------------------------------------
// the broken wash behind the leaves

export interface MassMark {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  seed: number;
  alpha: number;
  pigment: Pigment;
}

function lump(m: MassMark, n = 16): Pt[] {
  const rng = createRng(m.seed);
  const ph = rng.range(0, TAU);
  const a = rng.range(0.05, 0.12);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    const r = 1 + a * Math.sin(3 * t + ph) + 0.05 * Math.sin(5 * t + ph * 2);
    return { x: m.cx + Math.cos(t) * m.rx * r, y: m.cy + Math.sin(t) * m.ry * r };
  });
}

export function paintMass(p: Painter, marks: readonly MassMark[], reserves: readonly Reserve[]): void {
  const live = marks.filter((m) => m.alpha > 0.02 && m.rx > 0.5);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => lump(m, 8))), 4));
  for (const m of live) {
    const rng = createRng(m.seed + 7);
    L.fill(deformPolygon(lump(m), rng, { depth: 2, variance: 0.1 }), jitter(m.pigment, rng, 0.02), 0.3 * m.alpha);
  }
  for (const r of reserves) L.lift(disc(r, 1.05), r.amount * 0.9);
  L.dry({ opacity: 0.72, edge: 0.12, edgeWidth: 1.6, sharpness: 0.3, centreLift: 0.1, granulation: 0.5, flow: 0.5, flowScale: 9, dry: 0.2, darken: 0.05 });
}

// ---------------------------------------------------------------------------------------------
// stems

export interface StemMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
}

export function paintStems(p: Painter, stems: readonly StemMark[]): void {
  const live = stems.filter((s) => s.pts.length >= 2 && s.width > 0.15);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), 3));
  for (const s of live) {
    const rng = createRng(s.seed);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.15, 0.12], endWidth: 0.6, fills: 2, coverage: 0.55 });
    ribbonInto(L, s.pts, s.width * 0.45, s.deep, rng, { taper: [0.2, 0.2], endWidth: 0.5, fills: 1, coverage: 0.2, offset: s.width * 0.25 });
  }
  L.dry({ opacity: 0.9, edge: 0.35, edgeWidth: 0.7, sharpness: 0.55, centreLift: 0.05, granulation: 0.35, flow: 0.25, flowScale: 8, dry: 0.08 });
}

// ---------------------------------------------------------------------------------------------
// whorls of hooded flowers

export interface WhorlFlower {
  /** angle round the stem (sin > 0 faces the viewer) */
  phi: number;
  /** length as a fraction of the whorl's radius */
  len: number;
  arch: number;
  tone: number;
  /** how far behind the whorl's opening this flower is (0 … 0.3) */
  lag: number;
  seed: number;
}

export interface WhorlMark {
  at: Pt;
  /** the whorl's radius now */
  R: number;
  /** 0 a ball of green calyces … 1 every flower open */
  open: number;
  alpha: number;
  flowers: WhorlFlower[];
  seed: number;
}

const YELLOW = '#e6c040';
const YELLOW_LIGHT = '#f2d66a';
const OCHRE = '#c48f2a';
const MOUTH = '#9a6a2c';
const BUD = '#b9b45e';
const CALYX = '#8f9a6a';
const CALYX_DEEP = '#66724f';
const FLAT = 0.7;

const flowerOpen = (m: WhorlMark, f: WhorlFlower) => Math.min(1, Math.max(0, m.open * 1.3 - f.lag));

interface Hood {
  hood: Pt[];
  shade: Pt[];
  lip: Pt[];
  crest: Pt[];
  mouth: Pt;
  len: number;
}

/** One two-lipped flower: an arched hood pointing out from the stem, a lower lip under its tip. */
function hoodGeometry(m: WhorlMark, f: WhorlFlower): Hood {
  const fo = flowerOpen(m, f);
  const vx = Math.cos(f.phi);
  const vy = Math.sin(f.phi) * FLAT;
  const vl = Math.hypot(vx, vy);
  const ang = Math.atan2(vy, vx);
  const L = f.len * m.R * (0.45 + 0.55 * fo);
  const Ls = L * Math.max(0.6, vl);
  const base = { x: m.at.x + vx * m.R * 0.26, y: m.at.y + vy * m.R * 0.26 };
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  let nx = -sa;
  let ny = ca;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const lift = f.arch * L * 0.32 * fo;
  const axis = (u: number): Pt => ({ x: base.x + ca * u * Ls, y: base.y + sa * u * Ls - lift * Math.sin(u * Math.PI * 0.8) - u * L * 0.22 });
  const hw = (u: number) => L * (0.09 + 0.13 * Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.62)));
  const us = [0, 0.2, 0.4, 0.6, 0.78, 0.92, 1];
  const up = us.map((u) => {
    const a = axis(u);
    return { x: a.x + nx * hw(u), y: a.y + ny * hw(u) };
  });
  const down = us.map((u) => {
    const a = axis(u);
    return { x: a.x - nx * hw(u) * 0.55, y: a.y - ny * hw(u) * 0.55 };
  });
  const end = axis(1);
  const tip = { x: end.x + ca * L * 0.08 * Math.max(0.4, vl), y: end.y + sa * L * 0.08 };
  const lipC = axis(0.74);
  const lipAt = { x: lipC.x - nx * hw(0.74) * 1.15, y: lipC.y - ny * hw(0.74) * 1.15 + L * 0.06 };
  const lip = ellipse(lipAt, L * 0.22 * Math.max(0.6, vl), L * 0.11, ang + 0.15 * Math.sign(vx || 1));
  const mouth = axis(0.86);
  return {
    hood: [...up, tip, ...[...down].reverse()],
    shade: [...down, tip, ...us.map(axis).reverse()],
    lip,
    crest: up.slice(2).concat(tip),
    mouth: { x: mouth.x - nx * hw(0.86) * 0.4, y: mouth.y - ny * hw(0.86) * 0.4 },
    len: L,
  };
}

function ellipse(c: Pt, rx: number, ry: number, rot: number, n = 10): Pt[] {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs };
  });
}

/** Every point a whorl paints. */
export function whorlReach(m: WhorlMark): Pt[] {
  return m.flowers.flatMap((f) => {
    const h = hoodGeometry(m, f);
    return [...h.hood, ...h.lip];
  });
}

/** Back flowers, then the calyx ball, then front flowers, then the dark mouths under the hoods. */
export function paintWhorls(p: Painter, whorls: readonly WhorlMark[]): void {
  const live = whorls.filter((w) => w.alpha > 0.02 && w.R > 0.4);
  if (!live.length) return;
  const area = padRect(bounds(live.flatMap((w) => ellipse(w.at, w.R * 1.5, w.R * 1.5, 0, 8))), 3);
  const dry = { opacity: 0.92, edge: 0.5, edgeWidth: 0.7, sharpness: 0.55, centreLift: 0.05, granulation: 0.25, flow: 0.35, flowScale: 6, dry: 0.04, darken: 0.1 };

  const flowers = (front: boolean) => {
    const L = p.layer(area);
    for (const w of live) {
      for (const f of w.flowers) {
        if (Math.sin(f.phi) > 0 !== front) continue;
        const fo = flowerOpen(w, f);
        const a = w.alpha;
        const rng = createRng(f.seed);
        const h = hoodGeometry(w, f);
        const back = front ? 0 : 0.35 + 0.3 * -Math.sin(f.phi);
        const body = jitter(mix(mix(BUD, mix(YELLOW, YELLOW_LIGHT, f.tone * 0.6), Math.min(1, fo * 1.4)), OCHRE, back), rng, 0.02);
        L.fill(deformPolygon(h.hood, rng, { depth: 1, variance: 0.06 }), body, 0.6 * a);
        L.fill(deformPolygon(h.shade, rng, { depth: 1, variance: 0.06 }), mix(OCHRE, BUD, 1 - fo), 0.28 * a);
        if (fo > 0.25) L.fill(deformPolygon(h.lip, rng, { depth: 1, variance: 0.08 }), mix(YELLOW_LIGHT, OCHRE, back * 0.6), 0.5 * a * Math.min(1, (fo - 0.25) * 3));
        if (front && fo > 0.4) L.lift(ribbon(smoothPath(h.crest, 0.6), () => Math.max(0.3, h.len * 0.06)), 0.4 * a);
      }
    }
    L.dry(dry);
  };

  flowers(false);
  const K = p.layer(area);
  for (const w of live) {
    const rng = createRng(w.seed);
    const k = 1 - 0.3 * w.open;
    K.fill(deformPolygon(ellipse({ x: w.at.x, y: w.at.y + w.R * 0.12 }, w.R * 0.52 * k, w.R * 0.46 * k, 0, 12), rng, { depth: 2, variance: 0.12 }), jitter(CALYX, rng, 0.02), 0.55 * w.alpha * (1 - 0.5 * w.open));
    K.fill(ellipse({ x: w.at.x + w.R * 0.12 * k, y: w.at.y + w.R * 0.18 * k }, w.R * 0.32 * k, w.R * 0.22 * k, 0, 10), CALYX_DEEP, 0.3 * w.alpha * (1 - 0.6 * w.open));
    for (let i = 0; i < 7; i++) {
      const t = (i / 7) * TAU + rng.range(-0.2, 0.2);
      const at = { x: w.at.x + Math.cos(t) * w.R * 0.46 * k, y: w.at.y + Math.sin(t) * w.R * 0.38 * k };
      K.fill(ellipse(at, w.R * 0.1, w.R * 0.1, 0, 6), CALYX_DEEP, 0.35 * w.alpha * (1 - w.open * 0.6));
    }
  }
  K.dry({ ...dry, granulation: 0.4 });
  flowers(true);

  const M = p.layer(area);
  for (const w of live) {
    for (const f of w.flowers) {
      const fo = flowerOpen(w, f);
      if (fo < 0.3) continue;
      const h = hoodGeometry(w, f);
      M.fill(ellipse(h.mouth, h.len * 0.12, h.len * 0.07, 0, 6), MOUTH, 0.45 * w.alpha * Math.min(1, (fo - 0.3) * 3));
    }
  }
  M.dry({ opacity: 0.9, edge: 0.3, edgeWidth: 0.5, sharpness: 0.5, centreLift: 0.02, granulation: 0.1, flow: 0.1, flowScale: 6 });
}
