/**
 * Painting helpers for the iwakagami ("rock mirror", docs/systems/plants-species-a.md): a round,
 * leathery, bronze-rimmed leaf with a crisp lifted shine, and a nodding fringed bell.
 */
import type { Rng } from '../../core/rng';
import { dabProfile, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth } from './small-growth';
import { LIGHT, dabAxis, shadowSide } from './small-paint';

export interface MirrorStyle {
  pigment: Pigment;
  /** the toothed rim and the old leaves' flush */
  rim: Pigment;
  /** the shaded half of the convex blade and the midrib */
  deep: Pigment;
  /** the lifted shine, near paper */
  gloss: Pigment;
  teeth: number;
  opacity?: number;
  /** 0..1, how far the shine and teeth have come in (a young leaf is soft and matt) */
  detail: number;
  /** 0..1, size of the shine (leaves that face the sky catch more) */
  shine: number;
}

/**
 * A round leathery leaf seen at `angle`, `length` × `width` on screen: bronze rim and teeth under
 * a green body in one wet layer, a darker shaded half, then a sharp-edged pale shine on the lit
 * side (source-over), the "mirror".
 */
export function mirrorLeaf(p: Painter, rng: Rng, at: Pt, pose: { angle: number; length: number; width: number; curve?: number }, s: MirrorStyle): void {
  if (pose.length < 0.4 || pose.width < 0.3) return;
  // replay the rim dab's own jitter (dabShape's draws) so the teeth sit on its real margin
  const probe = rng.fork('rim');
  const length = pose.length * probe.range(0.92, 1.08);
  const width = pose.width * probe.range(0.9, 1.1);
  const angle = pose.angle + probe.gaussian(0, 0.04);
  const curve = (pose.curve ?? 0) + probe.gaussian(0, 0.04);
  const detail = clamp01(s.detail);
  const side = shadowSide(angle);
  const r = length * 1.2 + width;
  const L = p.layer({ x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 });
  p.dabInto(L, at, s.rim, { rng: rng.fork('rim'), variant: 'round', angle: pose.angle, length: pose.length, width: pose.width, curve: pose.curve ?? 0, asym: 0, pool: 0.3, poolSide: side, basePool: 0.2, layers: 3 });
  const N = 24;
  const axis = dabAxis(at, angle, length, curve, N);
  const dirAt = (t: number) => {
    const i = Math.min(N - 1, Math.round(t * N));
    return Math.atan2(axis[i + 1]!.y - axis[i]!.y, axis[i + 1]!.x - axis[i]!.x);
  };
  // shallow forward teeth round the margin, each tipped bronze
  const tooth = Math.min(length, width) * 0.04 * detail;
  for (let i = 0; i < s.teeth && tooth > 0.05; i++) {
    const t = 0.16 + (0.8 * (i + 0.5)) / s.teeth;
    const q = axis[Math.round(t * N)]!;
    const ta = dirAt(t);
    const hw = dabProfile('round', t) * width;
    for (const sgn of [-1, 1]) {
      const tr = rng.fork(`tj-${i}-${sgn}`);
      const tl = tooth * tr.range(0.7, 1.3);
      const nx = -Math.sin(ta) * sgn;
      const ny = Math.cos(ta) * sgn;
      p.dabInto(L, { x: q.x + nx * (hw - tl * 0.5), y: q.y + ny * (hw - tl * 0.5) }, s.rim, {
        rng: rng.fork(`t-${i}-${sgn}`),
        variant: 'leaf',
        angle: ta + sgn * tr.range(0.55, 0.85),
        length: tl * 1.5,
        width: tl * 1.1,
        asym: 0,
        pool: 0,
        basePool: 0,
        layers: 2,
      });
    }
  }
  const inset = Math.min(length, width) * 0.05;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const body = { x: at.x + ux * inset, y: at.y + uy * inset };
  // an uneven rim: the bronze shows wider on one flank, as on a real leaf
  const lean = rng.fork('lean').range(-0.35, 0.35);
  p.dabInto(L, body, s.pigment, { rng: rng.fork('body'), variant: 'round', angle, length: length - inset * 2, width: width - inset * 2, curve, asym: lean, pool: 0.5, poolSide: side, basePool: 0.3, layers: 4 });
  // the convex blade: its shaded half sinks into a deep olive, wet in wet
  const nx = -Math.sin(angle) * side;
  const ny = Math.cos(angle) * side;
  const sh = width * 0.26;
  p.dabInto(L, { x: body.x + nx * sh, y: body.y + ny * sh }, s.deep, { rng: rng.fork('shade'), variant: 'round', angle, length: (length - inset * 2) * 0.8, width: width * 0.4, curve, asym: 0.6 * side, pool: 0.2, poolSide: side, basePool: 0.1, layers: 1 });
  p.dabInto(L, body, s.deep, { rng: rng.fork('mid'), variant: 'blade', angle, length: length * 0.78, width: Math.max(0.28, width * 0.045), curve, pool: 0, basePool: 0.4, layers: 2 });
  L.dry({
    opacity: (s.opacity ?? 0.94) * smooth(length / 3),
    edge: 0.6,
    edgeWidth: Math.max(0.25, Math.min(1.4, width * 0.06)),
    sharpness: 0.8,
    centreLift: 0.06,
    granulation: 0.12,
    flow: 0.4,
    flowScale: Math.max(3, length * 0.5),
    darken: 0.4,
    // leathery and opaque: a nearer leaf covers the one behind instead of glazing over it
    blend: 'source-over',
  });
  if (detail < 0.02 || length < 3) return;
  // the mirror: a crisp crescent of reserved light on the lit side, and a small second glint
  const G = p.layer({ x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 });
  const c = axis[Math.round(N * 0.5)]!;
  const m = Math.min(length, width);
  const lx = Math.cos(LIGHT);
  const ly = Math.sin(LIGHT);
  const g = rng.fork('gloss');
  const off = m * g.range(0.1, 0.28);
  const hc = { x: c.x + lx * off, y: c.y + ly * off };
  const perp = LIGHT + Math.PI / 2;
  const hl = m * lerp(0.48, 0.68, s.shine) * g.range(0.9, 1.1);
  const start = { x: hc.x - Math.cos(perp) * hl * 0.5, y: hc.y - Math.sin(perp) * hl * 0.5 };
  p.dabInto(G, start, s.gloss, { rng: g.fork('crescent'), variant: 'leaf', angle: perp + g.gaussian(0, 0.3) + Math.cos(angle) * 0.35, length: hl, width: m * lerp(0.11, 0.19, s.shine) * g.range(0.85, 1.15), curve: -g.range(0.12, 0.45), asym: g.range(0, 0.5), pool: 0, basePool: 0, layers: 2 });
  const gl = { x: c.x + lx * off * 0.15 + Math.cos(perp) * m * 0.14, y: c.y + ly * off * 0.15 + Math.sin(perp) * m * 0.14 };
  p.dabInto(G, gl, s.gloss, { rng: g.fork('glint'), variant: 'round', angle: perp + 0.3, length: m * 0.12 * (0.6 + s.shine * 0.6), width: m * 0.07, asym: 0, pool: 0, basePool: 0, layers: 2 });
  G.dry({ opacity: lerp(0.55, 0.85, s.shine) * detail, edge: 0.15, edgeWidth: 0.25, sharpness: 0.9, centreLift: 0, granulation: 0.04, flow: 0.2, flowScale: 3, darken: 0.02, blend: 'source-over' });
}

export interface FringedBell {
  /** screen direction from the pedicel tip to the mouth (≈ down: the bell nods) */
  axis: number;
  /** bell length and mouth width at full opening */
  length: number;
  width: number;
  /** bud swelling 0..1 */
  bud: number;
  /** 0 = closed bud … 1 = open, flared bell */
  open: number;
  /** 0 = green bud … 1 = bloom colour */
  colour: number;
  pigment: Pigment;
  deep: Pigment;
  pale: Pigment;
  green: Pigment;
  calyx: Pigment;
  /** fringe strokes per lobe (lobe directions are the bell's own: −0.3, 0, 0.3 round the axis) */
  lobes: { turn: number; len: number; wid: number; fringe: number[] }[];
}

/**
 * A nodding bell in one wet layer: a pointed bud that colours as it swells, then three flaring
 * lobes (the side view of five) whose mouths break into a fine fringe, deep at the top, paler
 * toward the mouth; a small calyx where it hangs.
 */
export function fringedBell(p: Painter, rng: Rng, c: Pt, b: FringedBell): void {
  const bud = clamp01(b.bud);
  if (bud < 0.02 || b.length < 0.3) return;
  const open = clamp01(b.open);
  const r = b.length * 1.5 + 1;
  const L = p.layer({ x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 });
  const body = mix(b.green, b.deep, clamp01(b.colour));
  const bl = b.length * 0.62 * lerp(0.3, 1, bud) * (1 - 0.45 * smooth(open * 1.5));
  if (bl > 0.15) {
    p.dabInto(L, c, body, { rng: rng.fork('bud'), variant: 'leaf', angle: b.axis, length: bl, width: bl * 0.62, asym: 0, pool: 0.35, basePool: 0.45, layers: 3 });
  }
  const grow = lerp(0.55, 1, open) * smooth(open * 3);
  if (grow > 0.01) {
    const tone = mix(b.pigment, b.pale, 0.15);
    // the fused cup the lobes flare from, deepest where it hangs
    p.dabInto(L, c, b.pigment, { rng: rng.fork('cup'), variant: 'petal', angle: b.axis, length: b.length * 0.82 * grow, width: b.width * 0.7 * grow, asym: 0, pool: 0.3, poolSide: shadowSide(b.axis), basePool: 0.55, layers: 3 });
    b.lobes.forEach((lb, i) => {
      const a = b.axis + lb.turn * lerp(0.3, 1, open);
      const len = b.length * lb.len * grow;
      const wid = b.width * lb.wid * grow * lerp(0.6, 1, open);
      p.dabInto(L, c, i === 1 ? tone : b.pigment, { rng: rng.fork(`lobe-${i}`), variant: 'petal', angle: a, length: len, width: wid, curve: lb.turn * 0.4, asym: 0, pool: 0.4, poolSide: shadowSide(a), basePool: 0.65, layers: 3 });
      // the fringe: fine strokes splaying from the lobe's mouth
      const k = smooth((open - 0.35) / 0.65);
      if (k < 0.01) return;
      const tip = { x: c.x + Math.cos(a) * len * 0.9, y: c.y + Math.sin(a) * len * 0.9 };
      const n = lb.fringe.length;
      lb.fringe.forEach((f, j) => {
        const u = n === 1 ? 0 : j / (n - 1) - 0.5;
        const px = -Math.sin(a) * u * wid * 0.85;
        const py = Math.cos(a) * u * wid * 0.85;
        p.dabInto(L, { x: tip.x + px, y: tip.y + py }, mix(b.pigment, b.deep, 0.35), {
          rng: rng.fork(`fr-${i}-${j}`),
          variant: 'blade',
          angle: a + u * 1.1 + lb.turn * 0.6,
          length: b.length * 0.13 * f * k,
          width: Math.max(0.16, b.width * 0.038) * k,
          asym: 0,
          pool: 0,
          basePool: 0.2,
          layers: 2,
        });
      });
    });
    // a few deeper veins run down the cup and give it its roundness
    for (let v = 0; v < 3; v++) {
      const a = b.axis + (v - 1) * 0.16;
      p.dabInto(L, c, mix(b.deep, b.pigment, 0.4), { rng: rng.fork(`vein-${v}`), variant: 'blade', angle: a, length: b.length * 0.7 * grow, width: Math.max(0.2, b.width * 0.06) * grow, curve: (v - 1) * 0.12, asym: 0, pool: 0, basePool: 0.6, layers: 2 });
    }
  }
  // the calyx: a little dark cup where the bell hangs
  const cl = b.length * 0.16 * smooth(bud * 2);
  if (cl > 0.1) p.dabInto(L, c, b.calyx, { rng: rng.fork('calyx'), variant: 'leaf', angle: b.axis, length: cl, width: cl * 1.2, asym: 0, pool: 0.2, basePool: 0.2, layers: 2 });
  L.dry({
    opacity: 0.92 * smooth(bud * 2.5),
    edge: 0.55,
    edgeWidth: Math.max(0.2, b.width * 0.07),
    sharpness: 0.75,
    centreLift: 0.28,
    granulation: 0.05,
    flow: 0.3,
    flowScale: Math.max(2, b.length),
    darken: 0.3,
  });
}
