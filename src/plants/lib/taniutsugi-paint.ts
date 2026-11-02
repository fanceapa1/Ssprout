/**
 * Painting helpers for the taniutsugi (docs/systems/plants-species-b.md): finely toothed oval
 * leaves in shared wet layers, woody wands, and funnel-shaped trumpets seen from the side or into
 * the mouth. Each mark carries its own seed, so only its size, angle and opacity change with growth.
 */
import { createRng, type Rng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, ribbon, shade, smoothPath, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// leaves

export interface OvalLeaf {
  at: Pt;
  angle: number;
  length: number;
  width: number;
  /** axis bend, signed fraction of the length */
  curve: number;
  /** teeth per margin */
  teeth: number;
  pigment: Pigment;
  /** the paler, greyer underside, flooded into the shaded half */
  under: Pigment;
  alpha: number;
  shade: 1 | -1;
  seed: number;
}

export interface OvalBlade {
  outline: Pt[];
  shadow: Pt[];
  axis: Pt[];
  veins: Pt[][];
}

/** Half-width profile: a rounded base, widest a little below the middle, a short drawn-out tip. */
function ovalProfile(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.42) return Math.sin(((t / 0.42) * Math.PI) / 2) ** 0.55;
  return Math.cos((((t - 0.42) / 0.58) * Math.PI) / 2) ** 1.5;
}

/** The outline of an oval, pointed, finely toothed leaf (pure). `rng` jitters the teeth. */
export function ovalBlade(b: Pick<OvalLeaf, 'at' | 'angle' | 'length' | 'width' | 'curve' | 'teeth'>, rng: Rng, shadeSide: 1 | -1): OvalBlade {
  const { at, angle, length: L, width: W, curve } = b;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const axisAt = (t: number): Pt => {
    const bend = curve * L * (t * t * 0.8 + Math.sin(Math.PI * t) * 0.12);
    return { x: at.x + ux * L * t + nx * bend, y: at.y + uy * L * t + ny * bend };
  };
  const margin = (t: number, side: number, off: number): Pt => {
    const a = axisAt(t);
    const hw = (W / 2) * ovalProfile(t) + off;
    return { x: a.x + nx * hw * side, y: a.y + ny * hw * side };
  };
  const n = b.teeth;
  const t0 = 0.16;
  const t1 = 0.94;
  const dt = (t1 - t0) / n;
  const amps = Array.from({ length: n * 2 }, () => rng.range(0.7, 1.25));
  const side = (s: 1 | -1): Pt[] => {
    const pts: Pt[] = [margin(0.04, s, 0), margin(0.1, s, 0)];
    for (let i = 0; i < n; i++) {
      const ta = t0 + i * dt;
      const amp = W * 0.032 * amps[i * 2 + (s > 0 ? 0 : 1)]!;
      pts.push(margin(ta, s, -amp * 0.4));
      pts.push(margin(ta + dt * 0.75, s, amp * 0.6));
    }
    return pts;
  };
  const right = side(1);
  const left = side(-1);
  const base = axisAt(0);
  const tip = axisAt(1);
  const outline = [base, ...right, tip, ...[...left].reverse()];
  const axis = Array.from({ length: 9 }, (_, i) => axisAt(i / 8));
  const shadow = [base, ...(shadeSide > 0 ? right : left), tip, ...[...axis].reverse()];
  const veins: Pt[][] = [];
  for (let j = 0; j < 4; j++) {
    const t = 0.18 + (j / 4) * 0.56;
    for (const s of [1, -1]) {
      const a = axisAt(t);
      const m = margin(t + 0.16, s, -(W / 2) * ovalProfile(t + 0.16) * 0.2);
      veins.push([a, { x: a.x * 0.5 + m.x * 0.5 + nx * s * W * 0.04, y: a.y * 0.5 + m.y * 0.5 + ny * s * W * 0.04 }, m]);
    }
  }
  return { outline, shadow, axis, veins };
}

/** All leaves in one wet layer: blade twice, the shaded half flooded grey-green, veins lifted. */
export function paintOvalLeaves(p: Painter, leaves: readonly OvalLeaf[], dry: DryOptions = {}): void {
  const live = leaves.filter((l) => l.length > 0.6 && l.alpha > 0.02);
  if (!live.length) return;
  const blades = live.map((l) => {
    const rng = createRng(l.seed);
    return { l, rng, blade: ovalBlade(l, rng, l.shade) };
  });
  const L = p.layer(padRect(bounds(blades.flatMap((b) => b.blade.outline)), 4));
  let len = 0;
  for (const { l, rng, blade } of blades) {
    const a = 0.7 * l.alpha;
    L.fill(blade.outline, jitter(l.pigment, rng, 0.03), a);
    L.fill(deformPolygon(blade.outline, rng, { depth: 1, variance: 0.05 }), jitter(l.pigment, rng, 0.03), a * 0.65);
    L.fill(deformPolygon(blade.shadow, rng, { depth: 1, variance: 0.05 }), shade(l.under, 0.28), a * 0.55);
    if (l.length > 6) {
      const vw = Math.max(0.12, l.width * 0.03);
      L.lift(ribbon(blade.axis.slice(0, 8), (t) => vw * (1 - t * 0.7)), 0.34 * l.alpha);
      for (const v of blade.veins) L.lift(ribbon(v, (t) => vw * 0.75 * (1 - t * 0.8)), 0.2 * l.alpha);
    }
    len += l.length;
  }
  const mean = len / blades.length;
  L.dry({ opacity: 0.86, edge: 0.55, edgeWidth: Math.max(0.3, Math.min(1.1, mean * 0.05)), sharpness: 0.78, centreLift: 0.24, granulation: 0.08, flow: 0.35, flowScale: Math.max(4, mean * 0.7), ...dry });
}

// ---------------------------------------------------------------------------------------------
// wands

export interface WandMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
  taper?: number;
}

/** Woody wands in one wet layer, with a broken darker line along one side. */
export function paintWands(p: Painter, wands: readonly WandMark[], o: { opacity?: number; accent?: Pigment; accentOpacity?: number } = {}): void {
  const live = wands.filter((c) => c.pts.length >= 2 && c.width > 0.08);
  if (!live.length) return;
  const maxW = Math.max(...live.map((c) => c.width));
  const area = padRect(bounds(live.flatMap((c) => c.pts)), maxW * 2 + 3);
  const L = p.layer(area);
  for (const c of live) ribbonInto(L, c.pts, c.width, c.pigment, createRng(c.seed), { taper: [0.02, c.taper ?? 0.7], pressure: (t) => 1.15 - t * 0.55 });
  L.dry({ opacity: o.opacity ?? 0.9, edge: 0.5, edgeWidth: Math.max(0.35, maxW * 0.25), sharpness: 0.75, centreLift: 0.18, granulation: 0.16, flow: 0.3, flowScale: 10 });
  if (!o.accent) return;
  const A = p.layer(area);
  let any = false;
  for (const c of live) {
    if (c.pts.length < 4) continue;
    const r = createRng(c.seed + 1);
    const sp = smoothPath(c.pts, 2);
    const pieces = r.int(2, 4);
    for (let k = 0; k < pieces; k++) {
      const a = Math.floor(sp.length * (k / pieces + r.range(0.02, 0.08)));
      const b = Math.floor(sp.length * ((k + 1) / pieces - r.range(0.05, 0.2)));
      const seg = sp.slice(a, b).map((q) => ({ x: q.x + c.width * 0.3, y: q.y }));
      if (seg.length < 2) continue;
      ribbonInto(A, seg, Math.max(0.25, c.width * 0.36), o.accent, r, { taper: [0.25, 0.35], fills: 1 });
      any = true;
    }
  }
  if (any) A.dry({ opacity: o.accentOpacity ?? 0.5, edge: 0.3, edgeWidth: 0.4, sharpness: 0.8, flowScale: 8 });
  else A.discard();
}

// ---------------------------------------------------------------------------------------------
// trumpets

export interface Trumpet {
  /** the base of the tube, at the calyx */
  at: Pt;
  /** direction of the tube in the picture */
  angle: number;
  length: number;
  /** mouth radius when open */
  mouth: number;
  /** how far the mouth turns toward the viewer (radians, 0 = side-on) */
  tilt: number;
  roll: number;
  /** 0 a closed bud … 1 open */
  open: number;
  alpha: number;
  shade: 1 | -1;
  seed: number;
}

export interface TrumpetShape {
  outline: Pt[];
  shadow: Pt[];
  /** the narrow lower part of the tube */
  tube: Pt[];
  /** the opening, painted pale: we see the inside */
  mouth: Pt[];
  throat: Pt[];
  /** lines from the throat to the notches between lobes */
  lines: Pt[][];
  /** the mouth centre and the projected radius */
  centre: Pt;
  radius: number;
}

/** Half-width along the tube: a slender spindle as a bud, a narrow tube flaring to a funnel open. */
function tubeWidth(s: number, open: number): number {
  const bud = 0.1 + 0.27 * Math.sin(Math.PI * Math.min(1, s ** 1.3));
  const funnel = 0.15 + 0.85 * smooth01((s - 0.22) / 0.78) ** 1.25;
  return bud + (funnel - bud) * open;
}

/** The trumpet's outline, opening and throat (pure). */
export function trumpetShape(t: Trumpet): TrumpetShape {
  const ux = Math.cos(t.angle);
  const uy = Math.sin(t.angle);
  const nx = -uy;
  const ny = ux;
  const sin = Math.sin(t.tilt);
  const R = t.mouth;
  const along = t.length * Math.cos(t.tilt * 0.85);
  const c = (s: number): Pt => ({ x: t.at.x + ux * along * s, y: t.at.y + uy * along * s });
  const N = 10;
  const sideOf = (sgn: number) =>
    Array.from({ length: N + 1 }, (_, i) => {
      const s = i / N;
      const q = c(s);
      const hw = R * tubeWidth(s, t.open);
      return { x: q.x + nx * hw * sgn, y: q.y + ny * hw * sgn };
    });
  const right = sideOf(1);
  const left = sideOf(-1);
  const mc = c(1);
  const rEnd = R * tubeWidth(1, t.open) * (1 + 0.2 * t.open);
  // five rounded lobes with notches between them
  const lobe = (th: number) => 1 + (0.84 + 0.22 * Math.abs(Math.cos(2.5 * (th + t.roll))) ** 0.7 - 1) * t.open;
  const rim = (th: number): Pt => {
    const r = rEnd * lobe(th);
    return { x: mc.x + nx * r * Math.cos(th) + ux * r * Math.sin(th) * sin, y: mc.y + ny * r * Math.cos(th) + uy * r * Math.sin(th) * sin };
  };
  const M = 30;
  const front = Array.from({ length: M + 1 }, (_, i) => rim((i / M) * Math.PI));
  const r0 = R * tubeWidth(0, t.open);
  const back = Array.from({ length: 5 }, (_, i) => {
    const phi = Math.PI * (1 - (i + 1) / 6);
    return { x: t.at.x + nx * r0 * Math.cos(phi) - ux * r0 * 0.6 * Math.sin(phi), y: t.at.y + ny * r0 * Math.cos(phi) - uy * r0 * 0.6 * Math.sin(phi) };
  });
  const outline = [...right, ...front, ...[...left].reverse(), ...back];
  const axis = Array.from({ length: N + 1 }, (_, i) => c(i / N));
  const shadow = t.shade > 0 ? [...right, mc, ...[...axis].reverse()] : [...left, mc, ...[...axis].reverse()];
  const mouth = Array.from({ length: M * 2 }, (_, i) => rim((i / (M * 2)) * Math.PI * 2));
  const tr = rEnd * 0.42;
  const tc = { x: mc.x - ux * rEnd * sin * 0.3, y: mc.y - uy * rEnd * sin * 0.3 };
  const throat = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return { x: tc.x + nx * tr * Math.cos(a) + ux * tr * Math.sin(a) * sin, y: tc.y + ny * tr * Math.cos(a) + uy * tr * Math.sin(a) * sin };
  });
  const lines: Pt[][] = [];
  for (let k = 0; k < 5; k++) {
    const th = (Math.PI / 2.5) * k + Math.PI / 5 - t.roll;
    const end = rim(th);
    lines.push([tc, { x: tc.x * 0.4 + end.x * 0.6, y: tc.y * 0.4 + end.y * 0.6 }, { x: tc.x * 0.12 + end.x * 0.88, y: tc.y * 0.12 + end.y * 0.88 }]);
  }
  const tube = [...right.slice(0, 8), ...left.slice(0, 8).reverse(), ...back];
  return { outline, shadow, tube, mouth, throat, lines, centre: mc, radius: rEnd };
}

export interface TrumpetStyle {
  /** the outside of the tube */
  outer: Pigment;
  /** a bud, and the shaded side of the tube */
  deep: Pigment;
  /** the inside of the mouth */
  inner: Pigment;
  calyx: Pigment;
  alpha?: number;
}

/**
 * Trumpets, bud to open, painted over the leaves: the deeper rose outside, shaded on one side;
 * the pale pink mouth where it turns toward us, a rosier throat with faint lines; a green calyx.
 */
export function paintTrumpets(p: Painter, items: readonly Trumpet[], o: TrumpetStyle): void {
  const live = items.filter((t) => t.length > 0.5 && t.alpha > 0.02);
  if (!live.length) return;
  const alpha = o.alpha ?? 1;
  const shapes = live.map((t) => ({ t, s: trumpetShape(t), r: createRng(t.seed) }));
  for (const gi of [0, 1]) {
    const set = shapes.filter((_, i) => i % 2 === gi);
    if (!set.length) continue;
    const L = p.layer(padRect(bounds(set.flatMap((x) => x.s.outline)), 3));
    for (const { t, s, r } of set) {
      const body = mix(o.deep, o.outer, smooth01(t.open * 1.3));
      L.fill(deformPolygon(s.outline, r, { depth: 1, variance: 0.04 }), jitter(body, r, 0.03), 0.62 * t.alpha);
      L.fill(s.outline, body, 0.38 * t.alpha);
      L.fill(s.shadow, o.deep, 0.42 * t.alpha);
      // the narrow tube stays deeper than the flaring lobes
      L.fill(s.tube, o.deep, 0.5 * t.alpha);
    }
    const mean = set.reduce((a, x) => a + x.t.length, 0) / set.length;
    L.dry({ opacity: 0.94 * alpha, blend: 'source-over', edge: 0.45, edgeWidth: Math.max(0.3, mean * 0.05), darken: 0.18, sharpness: 0.75, centreLift: 0.06, granulation: 0.05, flow: 0.25, flowScale: 6 });
  }
  const open = shapes.filter((x) => x.t.open > 0.15);
  if (open.length) {
    const M = p.layer(padRect(bounds(open.flatMap((x) => x.s.mouth)), 3));
    for (const { t, s, r } of open) {
      const k = smooth01((t.open - 0.15) / 0.6) * t.alpha;
      M.fill(deformPolygon(s.mouth, r, { depth: 1, variance: 0.03 }), jitter(o.inner, r, 0.02), 0.95 * k);
      M.fill(s.throat, mix(o.inner, o.deep, 0.5), 0.6 * k);
      if (s.radius > 2.2) for (const ln of s.lines) M.fill(ribbon(ln, (u) => Math.max(0.12, s.radius * 0.05) * (1 - u * 0.8)), mix(o.inner, o.deep, 0.5), 0.35 * k);
    }
    M.dry({ opacity: 0.95 * alpha, blend: 'source-over', edge: 0.3, edgeWidth: 0.35, darken: 0.12, sharpness: 0.7, centreLift: 0.12, granulation: 0.03, flow: 0.2, flowScale: 5 });
  }
  // the calyx: a few narrow green sepals clasping the tube's base
  const C = p.layer(padRect(bounds(shapes.map((x) => x.t.at)), 8));
  for (const { t, r } of shapes) {
    const ux = Math.cos(t.angle);
    const uy = Math.sin(t.angle);
    const len = t.length * 0.24;
    const wid = t.mouth * 0.13;
    for (const side of [-1, 0, 1]) {
      const a = t.angle + side * 0.35 + r.range(-0.1, 0.1);
      const tip = { x: t.at.x + Math.cos(a) * len, y: t.at.y + Math.sin(a) * len };
      const back = { x: t.at.x - ux * len * 0.15, y: t.at.y - uy * len * 0.15 };
      C.fill(ribbon([back, tip], (u) => wid * (1 - u * 0.85)), o.calyx, 0.7 * t.alpha);
    }
  }
  C.dry({ opacity: 0.85 * alpha, blend: 'source-over', edge: 0.4, edgeWidth: 0.3, sharpness: 0.8, flowScale: 4 });
}
