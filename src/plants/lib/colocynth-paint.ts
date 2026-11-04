/**
 * Painting helpers for the colocynth (docs/devlog/120-colocynth.md): the flat ground view it lies
 * in, its deeply lobed leaves batched per runner, coiled tendrils, the small five-lobed flowers
 * and the striped gourds that ripen to gold. New helpers, so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { shadowSide } from './small-paint';
import { petalPose, type FlowerView } from './small-structure';

/** The garden is seen from about 25° up: ground depth shrinks by SIN_E on screen, heights by COS_E. */
export const SIN_E = 0.42;
export const COS_E = Math.sqrt(1 - SIN_E * SIN_E);
export const toScreen = (g: Pt): Pt => ({ x: g.x, y: g.y * SIN_E });

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

const circle = (c: Pt, rx: number, ry = rx, n = 28): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry };
  });

/** A lobe in the leaf's own frame (units of blade length): base, direction from the midrib, size. */
export interface Lobe {
  bx: number;
  by: number;
  a: number;
  len: number;
  wid: number;
  curve: number;
}

export interface LobedLeaf {
  key: string;
  /** blade base on screen */
  base: Pt;
  /** ground direction of the midrib */
  yaw: number;
  length: number;
  /** how much the blade's depth shrinks on screen (it is held up a little toward us) */
  tilt: number;
  lobes: readonly Lobe[];
  tone: Pigment;
}

/** Leaf frame (along, across) → screen offset. */
function leafVec(l: LobedLeaf, along: number, across: number): Pt {
  const c = Math.cos(l.yaw);
  const s = Math.sin(l.yaw);
  return { x: along * c - across * s, y: (along * s + across * c) * l.tilt };
}

/**
 * The leaves of one runner in one wet layer: each a fan of narrow rounded lobes (the deep
 * watermelon cut) that merge at the base, rough with granulation, a thin deep midrib per lobe.
 */
export function lobedLeaves(p: Painter, rng: Rng, leaves: readonly LobedLeaf[], o: { deep: Pigment; opacity: number }): void {
  const live = leaves.filter((l) => l.length > 0.3);
  if (!live.length) return;
  const reach = Math.max(...live.map((l) => l.length)) + 1;
  const L = p.layer(bounds(live.map((l) => l.base), reach));
  for (const l of live) {
    const r = rng.fork(l.key);
    l.lobes.forEach((lb, i) => {
      const b0 = leafVec(l, lb.bx * l.length, lb.by * l.length);
      const at = { x: l.base.x + b0.x, y: l.base.y + b0.y };
      const d = leafVec(l, Math.cos(lb.a) * lb.len * l.length, Math.sin(lb.a) * lb.len * l.length);
      const n = leafVec(l, -Math.sin(lb.a), Math.cos(lb.a));
      const angle = Math.atan2(d.y, d.x);
      const length = Math.hypot(d.x, d.y);
      const width = lb.wid * l.length * Math.max(0.45, Math.hypot(n.x, n.y));
      if (length < 0.12) return;
      p.dabInto(L, at, l.tone, { rng: r.fork(`lobe-${i}`), variant: 'petal', angle, length, width, curve: lb.curve, asym: 0, pool: 0.55, poolSide: shadowSide(angle), basePool: 0.35, layers: 3 });
      const vk = smooth((length - 1.6) / 2);
      if (visible(vk) && lb.len > 0.3) {
        p.dabInto(L, at, o.deep, { rng: r.fork(`rib-${i}`), variant: 'needle', angle, length: length * 0.7 * vk, width: Math.max(0.16, width * 0.08), curve: lb.curve, pool: 0, basePool: 0.2, layers: 1 });
      }
    });
  }
  L.dry({ opacity: o.opacity, edge: 0.55, edgeWidth: 0.3, sharpness: 0.75, centreLift: 0.22, granulation: 0.32, flow: 0.55, flowScale: 2.4, darken: 0.32 });
}

export interface Tendril {
  key: string;
  at: Pt;
  /** screen direction it leaves the node */
  angle: number;
  length: number;
  turns: number;
  r: number;
  hand: 1 | -1;
  /** 0..1 drawn so far */
  k: number;
}

/** Fine coiled tendrils: a short reach, then a tightening spring; drawn out from the node. */
export function tendrils(p: Painter, rng: Rng, ts: readonly Tendril[], pigment: Pigment): void {
  for (const t of ts) {
    if (!visible(t.k)) continue;
    const pts: Pt[] = [t.at];
    const n = 22;
    const steps = Math.max(2, Math.round(n * t.k));
    let x = t.at.x;
    let y = t.at.y;
    let a = t.angle;
    const seg = (t.length + t.turns * Math.PI * 2 * t.r * 0.7) / n;
    for (let i = 1; i <= steps; i++) {
      const u = i / n;
      // straight for the first 40 %, then curling ever tighter
      if (u > 0.4) a += t.hand * (seg / (t.r * lerp(1.2, 0.5, (u - 0.4) / 0.6)));
      x += Math.cos(a) * seg;
      y += Math.sin(a) * seg * 0.8;
      pts.push({ x, y });
    }
    p.inkLine(pts, { rng: rng.fork(t.key), width: 0.32, pigment, opacity: 0.75 * smooth(t.k * 3), breaks: 0.05, wobble: 0.15, pressureVar: 0.2, taper: [0.05, 0.5] });
  }
}

export interface GourdNow {
  key: string;
  /** screen centre and radius */
  c: Pt;
  r: number;
  /** ground direction of the stalk-to-blossom axis */
  yaw: number;
  /** 0 green and striped … 1 gold */
  ripe: number;
  stripes: readonly { lon: number; w: number }[];
  mottles: readonly { u: number; lon: number; s: number }[];
}

export interface GourdColours {
  green: Pigment;
  pale: Pigment;
  gold: Pigment;
  goldDeep: Pigment;
}

/** Screen offset of the sphere point at (u along the axis 0..π, longitude lon), and if it faces us. */
function spherePt(g: GourdNow, u: number, lon: number): { p: Pt; front: number } {
  const ax = Math.cos(g.yaw);
  const az = Math.sin(g.yaw);
  const su = Math.sin(u);
  const cu = Math.cos(u);
  // axis a = (ax, 0, az), e1 = up, e2 = (−az, 0, ax)
  const X = g.r * (ax * cu + -az * Math.sin(lon) * su);
  const Y = g.r * (Math.cos(lon) * su);
  const Z = g.r * (az * cu + ax * Math.sin(lon) * su);
  return { p: { x: g.c.x + X, y: g.c.y - Y * COS_E + Z * SIN_E }, front: Y * SIN_E + Z * COS_E };
}

/**
 * A gourd lying on the sand: a cool cast shadow, then the ball in one wet layer laid over what is
 * under it: the ground colour, its stripes wrapped round the sphere (green fading as it ripens),
 * a shaded flank away from the light and a soft reserved light.
 */
export function gourd(p: Painter, rng: Rng, g: GourdNow, c: GourdColours): void {
  if (g.r < 0.15) return;
  const ripe = clamp01(g.ripe);
  const ground = { x: g.c.x, y: g.c.y + g.r * COS_E };
  p.glaze({ cx: ground.x + g.r * 0.45, cy: ground.y - g.r * 0.05, rx: g.r * 1.25, ry: g.r * 0.42 }, PIGMENTS.shadow, {
    rng: rng.fork('cast'),
    opacity: 0.34,
    edge: 0.15,
    sharpness: 0.4,
    fade: { angle: 0.25, start: 0.45, amount: 0.8 },
  });
  const base = mix(mix(c.pale, c.gold, ripe), c.green, (1 - ripe) ** 1.5 * 0.45);
  const L = p.layer(bounds([g.c], g.r + 1.5));
  // the ball: a few slightly wandering round fills, so its rim is a wet edge and not a circle
  const br = rng.fork('ball');
  for (let k = 0; k < 4; k++) {
    const ph = br.range(0, Math.PI * 2);
    const amp = br.range(0.015, 0.035);
    const ring = Array.from({ length: 30 }, (_, i) => {
      const a = (i / 30) * Math.PI * 2;
      const rr = g.r * (1 + amp * Math.sin(a * 3 + ph) + br.gaussian(0, 0.008));
      return { x: g.c.x + Math.cos(a) * rr, y: g.c.y + Math.sin(a) * rr * 0.97 };
    });
    L.fill(ring, base, 0.32);
  }
  L.ctx.save();
  L.clip(circle(g.c, g.r * 0.97));
  const stripe = mix(c.green, c.goldDeep, ripe);
  const sa = lerp(0.85, 0.18, ripe ** 1.6);
  for (const s of g.stripes) {
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = lerp(0.1, 0.9, i / 10) * Math.PI;
      // the stripe narrows to the poles
      const w = s.w * lerp(0.35, 1, Math.sin(u));
      const a = spherePt(g, u, s.lon - w);
      const b = spherePt(g, u, s.lon + w);
      if (a.front < -0.05 * g.r || b.front < -0.05 * g.r) continue;
      left.push(a.p);
      right.push(b.p);
    }
    if (left.length > 1) L.fill([...left, ...right.reverse()], stripe, sa);
  }
  for (const m of g.mottles) {
    const q = spherePt(g, m.u, m.lon);
    if (q.front < 0) continue;
    L.fill(circle(q.p, m.s * g.r, m.s * g.r * 0.7, 10), stripe, sa * 0.7);
  }
  // the flank away from the light, stepped soft, then the light reserved on the near shoulder
  const shade = mix(mix(c.goldDeep, c.green, (1 - ripe) * 0.6), PIGMENTS.shadow, 0.35);
  for (let k = 0; k < 3; k++) L.fill(circle({ x: g.c.x + g.r * (0.5 + k * 0.18), y: g.c.y + g.r * (0.45 + k * 0.16) }, g.r * 0.95), shade, 0.2);
  L.fill(circle({ x: g.c.x - g.r * 0.36, y: g.c.y - g.r * 0.4 }, g.r * 0.3, g.r * 0.22, 14), mix(PIGMENTS.petalWhite, c.pale, 0.25), 0.5);
  L.ctx.restore();
  L.dry({ opacity: 0.96, edge: 0.45, edgeWidth: 0.4, sharpness: 0.82, centreLift: 0.08, granulation: 0.16, flow: 0.4, flowScale: 2.5, darken: 0.32, blend: 'source-over' });
}

export interface FlowerNow {
  key: string;
  c: Pt;
  size: number;
  rot: number;
  open: number;
  /** 0 fresh … 1 gone (the female flower shrivelling on its gourd) */
  wither: number;
  view: FlowerView;
}

/** The small five-lobed pale yellow flowers, all in one wet layer, laid over the leaves. */
export function flowers(p: Painter, rng: Rng, fs: readonly FlowerNow[], c: { petal: Pigment; deep: Pigment; dry: Pigment }): void {
  const live = fs.filter((f) => f.size * (1 - f.wither) > 0.05 && visible(f.open));
  if (!live.length) return;
  const L = p.layer(bounds(live.map((f) => f.c), Math.max(...live.map((f) => f.size)) * 1.5 + 1));
  for (const f of live) {
    const r = rng.fork(f.key);
    const size = f.size * (1 - f.wither) * lerp(0.5, 1, smooth(f.open));
    const tone = mix(c.petal, c.dry, smooth(f.wither * 1.4));
    const petals = [0, 1, 2, 3, 4].map((i) => ({ i, a: f.rot + (i / 5) * Math.PI * 2 })).map((q) => ({ ...q, pose: petalPose(q.a, f.view, f.open, 0.5) }));
    petals.sort((a, b) => a.pose.depth - b.pose.depth);
    for (const q of petals) {
      p.dabInto(L, f.c, tone, { rng: r.fork(`p-${q.i}`), variant: 'petal', angle: q.pose.angle, length: size * q.pose.len, width: size * 0.78, asym: 0, pool: 0.45, poolSide: shadowSide(q.pose.angle), basePool: 0.25, layers: 2 });
    }
    p.dabInto(L, { x: f.c.x, y: f.c.y + size * 0.12 }, c.deep, { rng: r.fork('eye'), variant: 'round', angle: -Math.PI / 2, length: size * 0.42, width: size * 0.42, pool: 0.3, basePool: 0, layers: 1 });
  }
  L.dry({ opacity: 0.93, edge: 0.5, edgeWidth: 0.25, sharpness: 0.72, centreLift: 0.2, granulation: 0.05, flow: 0.3, flowScale: 2, darken: 0.3, blend: 'source-over' });
}

/** The sand it lies in: a small dimple of disturbed sand, the seed in it, then the root crown. */
export function sandBed(p: Painter, rng: Rng, o: { rx: number; k: number; seed: number; crown: number; sand: Pigment; crownTone: Pigment }): void {
  p.wash({ cx: 0, cy: 0.5, rx: o.rx * lerp(0.4, 1, o.k), ry: o.rx * SIN_E * 0.55 * lerp(0.4, 1, o.k) }, o.sand, {
    rng: rng.fork('sand'),
    opacity: 0.18,
    edge: 0.2,
    centreLift: 0.35,
    granulation: 0.55,
    fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.75 },
  });
  if (visible(o.seed)) {
    p.dab({ x: 0.4, y: -0.3 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.3), { rng: rng.fork('seed'), variant: 'round', angle: -0.3, length: 1.5, width: 1.0, opacity: 0.85 * o.seed });
  }
  if (visible(o.crown)) {
    p.dab({ x: 0, y: 0.6 }, o.crownTone, { rng: rng.fork('crown'), variant: 'round', angle: -Math.PI / 2, length: 1.4 * o.crown, width: 2.6 * o.crown, opacity: 0.6, pool: 0.4, basePool: 0.2 });
  }
}
