/** Hermann's tortoise: the coast's slow walker, plodding along one terrace and grazing by the scrub and the flower mats. Side view, facing right.
 * docs/devlog/193-hermanns-tortoise.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { makeCanvas, mix, PIGMENTS, smoothPolygon, type AnyCanvas, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { clamp, dist, easeInOut, lerp, pointInPolygon, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import type { GroundSpot } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import { blockerOn, GROUND_ROOM, groundBodies } from './lib/ground';
import type { CreatureDef } from './lib/def';

/** Drawn a little larger than life (a 16 cm shell would be about 14 units) so the dome reads at the overview. */
export const TORTOISE_K = 1.2;

export const TORTOISE_TUNING = {
  /** world units / s at perspective 1 while plodding (about 0.2 body lengths a second) */
  walk: 4.2,
  /** body travel per gait cycle (world units at perspective 1) */
  stride: 7 * TORTOISE_K,
  /** a plod: this many body lengths of route */
  plod: [1.5, 3.5] as const,
  bodyLength: 24 * TORTOISE_K,
  /** seconds standing still after a plod; grazing; basking after it comes out */
  pause: [30, 90] as const,
  graze: [14, 32] as const,
  bask: [70, 150] as const,
  /** active seconds before the heat sends it into the scrub's shade, and how long it dozes there */
  active: [300, 520] as const,
  shade: [180, 360] as const,
  /** seconds it stays in its shell after a threat has gone */
  hide: [6, 14] as const,
  /** seconds of a turn round (through the front view) */
  turn: 2.6,
  /** its body keeps this far from a planting slot; where it stops, this far to the side of a slot in front */
  clear: 22,
  beside: 30,
  /** greenery within this reach is grazed: the scrub's edge, a flower beside it */
  reach: 56,
};

/** Who sends it into its shell, from how near (world units); the cat only while it moves, birds only once landed. */
export const TORTOISE_THREATS: Readonly<Record<string, number>> = {
  cat: 70,
  heron: 130,
  gull: 80,
  stork: 130,
  goat: 60,
};

// ---------------------------------------------------------------------------------------------
// art

const P = (x: number, y: number): Pt => ({ x, y });
const pts = (a: readonly (readonly [number, number])[]): Pt[] => a.map(([x, y]) => P(x, y));

const INK = PIGMENTS.sumi;
const BLOTCH = '#3b2f24';
const STRAW = '#e9d08c';
const SKIN = '#7f7a5a';
const SKIN_LIGHT = '#c6b77a';
const CLAW = '#5c5046';

/** The shell's side, facing +x, ground at y 0: the lower edge B and the crest T, a scute grid between. */
function lowerEdge(u: number): Pt {
  return P(lerp(-11.2, 11.0, u), -2.9 - 0.9 * Math.max(0, (u - 0.8) / 0.2) ** 2 - 0.3 * Math.max(0, (0.15 - u) / 0.15) ** 2);
}
function crest(u: number): Pt {
  return P(lerp(-5.6, 5.0, u), -15.4 + 1.5 * (2 * u - 0.9) ** 2);
}
export function shellPoint(u: number, v: number): Pt {
  const b = lowerEdge(u);
  const t = crest(u);
  const side = Math.sign(u - 0.5) * Math.abs(2 * u - 1) ** 1.3 * Math.sin(Math.PI * v) ** 0.65 * 3.6;
  return P(lerp(b.x, t.x, v) + side, lerp(b.y, t.y, v));
}

/** A cell of the grid as a polygon, inset toward its middle so the seams stay pale. */
function cell(map: (u: number, v: number) => Pt, u0: number, u1: number, v0: (u: number) => number, v1: (u: number) => number, inset: number): Pt[] {
  const out: Pt[] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) out.push(map(lerp(u0, u1, i / n), v0(lerp(u0, u1, i / n))));
  for (let i = 0; i <= 3; i++) out.push(map(u1, lerp(v0(u1), v1(u1), i / 3)));
  for (let i = n; i >= 0; i--) out.push(map(lerp(u0, u1, i / n), v1(lerp(u0, u1, i / n))));
  for (let i = 3; i >= 0; i--) out.push(map(u0, lerp(v0(u0), v1(u0), i / 3)));
  const c = centroid(out);
  return out.map((q) => {
    const d = Math.hypot(c.x - q.x, c.y - q.y) || 1;
    const k = Math.min(inset, d * 0.4) / d;
    return P(q.x + (c.x - q.x) * k, q.y + (c.y - q.y) * k);
  });
}

function centroid(a: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const q of a) {
    x += q.x;
    y += q.y;
  }
  return P(x / a.length, y / a.length);
}

interface Scute {
  shape: Pt[];
  /** where the growth rings close round (the areola) and the dark blotch sits */
  core: Pt;
  blotch: number;
  /** growth rings drawn (the marginals are too small for them) */
  rings: boolean;
}

/** One scute: a small wet wash, its blotch dropped in wet, growth rings round its core. */
function paintScute(p: Painter, s: Scute, rng: Rng, shade: number): void {
  const smooth = smoothPolygon(s.shape, 1);
  const base = mix(mix('#e0c25c', '#cfa246', rng.next()), '#a88a5c', shade * 0.25);
  p.wash(smooth, base, {
    rng,
    opacity: 0.9,
    layers: 5,
    deform: 0.12,
    spread: 0.08,
    edge: 0.3,
    edgeWidth: 0.3,
    sharpness: 0.3,
    centreLift: 0.1,
    granulation: 0.3,
    flow: 0.5,
    flowScale: 4,
    blooms: rng.chance(0.25) ? 1 : 0,
    bloomSize: 0.3,
    drops: s.blotch > 0 ? [{ pigment: BLOTCH, at: s.core, size: s.blotch * 1.25, alpha: 0.4 }, { pigment: BLOTCH, at: P(s.core.x + rng.range(-0.6, 0.6), s.core.y + rng.range(-0.4, 0.4)), size: s.blotch * 0.6, alpha: 0.45 }] : [],
  });
  // a growth ring, broken, round the core
  if (s.rings) {
    const ring = s.shape.map((q) => P(s.core.x + (q.x - s.core.x) * 0.72, s.core.y + (q.y - s.core.y) * 0.72));
    p.inkLine([...ring, ring[0]!], { rng, width: 0.1, opacity: 0.16, breaks: 0.7, wobble: 0.2, pigment: mix(BLOTCH, base, 0.4), taper: [0.2, 0.2] });
  }
}

/** The grid with its seams fanning in toward the crest, as a dome's do. */
const fan = (u: number, v: number) => shellPoint(0.5 + (u - 0.5) * (1 - 0.22 * Math.max(0, v - 0.2)), v);

/** The side scutes: marginals along the lower edge and up the ends, four costals, five vertebrals at the crest. */
function sideScutes(rng: Rng): Scute[] {
  const out: Scute[] = [];
  const vm = (u: number) => 0.2 + 0.2 * Math.max(0, (Math.abs(2 * u - 1) - 0.72) / 0.28) ** 1.5;
  const vc = () => 0.76;
  const jit = (a: readonly number[], j: number) => a.map((x, i) => (i === 0 || i === a.length - 1 ? x : x + rng.range(-j, j)));
  const marg = jit(
    Array.from({ length: 12 }, (_, i) => i / 11),
    0.012,
  );
  for (let i = 0; i < marg.length - 1; i++) {
    const u0 = marg[i]!;
    const u1 = marg[i + 1]!;
    // Hermann's: a dark wedge on the front part of each marginal
    out.push({ shape: cell(fan, u0, u1, () => 0, vm, 0.14), core: fan(lerp(u0, u1, 0.62), vm(u0) * 0.55), blotch: rng.range(0.5, 0.7), rings: false });
  }
  const cost = jit([0, 0.25, 0.48, 0.73, 1], 0.02);
  for (let i = 0; i < cost.length - 1; i++) {
    const u0 = cost[i]!;
    const u1 = cost[i + 1]!;
    out.push({ shape: cell(fan, u0, u1, vm, vc, 0.16), core: fan(lerp(u0, u1, rng.range(0.35, 0.6)), rng.range(0.38, 0.52)), blotch: rng.range(0.7, 0.9), rings: true });
  }
  const vert = jit([0.04, 0.2, 0.39, 0.6, 0.8, 0.96], 0.015);
  for (let i = 0; i < vert.length - 1; i++) {
    const u0 = vert[i]!;
    const u1 = vert[i + 1]!;
    out.push({ shape: cell(fan, u0, u1, vc, () => 1, 0.15), core: fan(lerp(u0, u1, 0.5), 0.85), blotch: rng.range(0.35, 0.5), rings: false });
  }
  return out;
}

/** The whole side outline, smooth: the lower edge, up the front, the crest back, down the rear. */
export function shellOutline(): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= 16; i++) out.push(shellPoint(i / 16, 0));
  for (let i = 1; i <= 8; i++) out.push(shellPoint(1, i / 8));
  for (let i = 15; i >= 0; i--) out.push(shellPoint(i / 16, 1));
  for (let i = 7; i >= 1; i--) out.push(shellPoint(0, i / 8));
  return out;
}

/** The light comes from world left: on a sprite facing +x that is its rear (`light` −1), flipped its head (+1). */
function paintShellSide(p: Painter, light: -1 | 1): void {
  const rng = p.rng;
  const outline = smoothPolygon(shellOutline(), 1);
  // the bridge of the plastron under the edge, between the legs
  const bridge: Pt[] = [];
  for (let i = 0; i <= 8; i++) bridge.push(P(lerp(-5.5, 6, i / 8), lowerEdge(lerp(0.25, 0.77, i / 8)).y - 0.4));
  for (let i = 8; i >= 0; i--) bridge.push(P(lerp(-5.5, 6, i / 8), lowerEdge(lerp(0.25, 0.77, i / 8)).y + 1.0 - 0.3 * Math.abs(i / 4 - 1) ** 2));
  p.wash(smoothPolygon(bridge, 1), '#d8c48e', { rng, opacity: 0.9, layers: 4, deform: 0.08, spread: 0.05, edge: 0.4, edgeWidth: 0.3, blend: 'source-over' });
  p.inkLine([P(-1.2, -2.6), P(-1.1, -1.95)], { rng, width: 0.15, opacity: 0.4, pigment: BLOTCH });
  // pale straw under everything: the seams between the scutes
  p.wash(outline, STRAW, { rng, opacity: 0.96, layers: 6, deform: 0.05, spread: 0.04, edge: 0.3, edgeWidth: 0.4, sharpness: 0.4, centreLift: 0.05, granulation: 0.15, blend: 'source-over' });
  for (const s of sideScutes(rng)) {
    const away = clamp(0.5 - (light * (s.core.x + 1)) / 22, 0, 1);
    paintScute(p, s, rng, away);
  }
  // the dome turns away from the light: a cool glaze lost toward the upper left (or right)
  p.glaze(outline, mix(PIGMENTS.shadow, '#6a5a46', 0.35), { rng, opacity: 0.42, edge: 0.06, darken: 0, deform: 0.06, spread: 0.04, fade: { angle: Math.atan2(-1, 0.75 * light), start: 0.2, amount: 1, ragged: 0.6 } });
  // a warm bounce off the ground along the lower marginals
  const low: Pt[] = [];
  for (let i = 0; i <= 10; i++) low.push(shellPoint(i / 10, 0));
  for (let i = 10; i >= 0; i--) low.push(shellPoint(i / 10, 0.14));
  p.glaze(smoothPolygon(low, 1), '#b07a3a', { rng, opacity: 0.18, edge: 0, darken: 0, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.6 } });
  // lost edges: ink only where the shell turns away
  const edge: Pt[] = [];
  for (let i = 0; i <= 12; i++) edge.push(shellPoint(i / 12, 0));
  p.inkLine(edge, { rng, width: 0.24, opacity: 0.38, breaks: 0.4, wobble: 0.2, pigment: mix(INK, BLOTCH, 0.5), taper: [0.3, 0.4] });
  const far = light < 0 ? 1 : 0;
  const end: Pt[] = [];
  for (let i = 0; i <= 6; i++) end.push(shellPoint(far, i / 6));
  p.inkLine(end, { rng, width: 0.2, opacity: 0.3, breaks: 0.5, wobble: 0.2, pigment: mix(INK, BLOTCH, 0.5), taper: [0.3, 0.6] });
}

/** Scaly skin: a grey-olive wash with ochre in it, a pale underside, a few scale dabs. */
function skin(p: Painter, shape: Pt[], far: boolean, scales: readonly Pt[], under: number): void {
  const rng = p.rng;
  const c = far ? mix(SKIN, PIGMENTS.shadow, 0.45) : SKIN;
  p.wash(shape, c, { rng, opacity: 0.95, layers: 5, deform: 0.06, spread: 0.05, edge: 0.4, edgeWidth: 0.3, sharpness: 0.45, centreLift: 0.12, granulation: 0.3, flow: 0.5, flowScale: 3, blend: 'source-over' });
  if (under) p.glaze(shape, SKIN_LIGHT, { rng, opacity: 0.4 * under, edge: 0, darken: 0, deform: 0.08, fade: { angle: -Math.PI / 2, start: 0.35, amount: 1, ragged: 0.6 } });
  for (const q of scales) p.dab(q, far ? mix(SKIN_LIGHT, PIGMENTS.shadow, 0.35) : SKIN_LIGHT, { rng, variant: 'round', angle: rng.range(0, 3), length: 1.0, width: 0.75, opacity: 0.55, layers: 2, edge: 0.4 });
}

function paintHead(p: Painter, sleep: boolean): void {
  const rng = p.rng;
  const head = smoothPolygon(pts([[0, -1.6], [1.4, -2.05], [3.0, -1.95], [4.1, -1.35], [4.65, -0.4], [4.5, 0.5], [3.8, 1.1], [2.4, 1.45], [0.8, 1.45], [0, 1.05]]), 1);
  skin(p, head, false, [], 0.6);
  // the crown darker, the pale cheek patch behind the eye
  p.glaze(head, mix(SKIN, BLOTCH, 0.35), { rng, opacity: 0.45, edge: 0, darken: 0, deform: 0.08, fade: { angle: Math.PI / 2, start: 0.25, amount: 1, ragged: 0.5 } });
  p.dab(P(1.55, 0.35), '#e6d488', { rng, variant: 'round', angle: 0.2, length: 1.8, width: 1.1, opacity: 0.75, layers: 3, edge: 0.3 });
  // the horny jaw and the mouth line, a nostril
  p.inkLine([P(4.55, 0.35), P(3.9, 0.85), P(2.7, 0.95)], { rng, width: 0.17, opacity: 0.6, breaks: 0.1, pigment: INK, taper: [0.2, 0.6] });
  p.dab(P(4.35, -0.55), INK, { rng, variant: 'round', angle: 0, length: 0.3, width: 0.25, opacity: 0.6, layers: 1, edge: 0.2 });
  const eye = P(3.05, -0.55);
  if (sleep) {
    p.inkLine([P(eye.x - 0.55, eye.y - 0.05), P(eye.x, eye.y + 0.25), P(eye.x + 0.5, eye.y)], { rng, width: 0.16, opacity: 0.7, breaks: 0, pigment: INK, taper: [0.3, 0.3] });
  } else {
    p.dab(eye, '#3a3026', { rng, variant: 'leaf', angle: 0.1, length: 0.8, width: 0.55, opacity: 0.85, layers: 2, edge: 0.5 });
  }
  // the heavy upper lid
  p.inkLine([P(eye.x - 0.8, eye.y - 0.2), P(eye.x - 0.1, eye.y - 0.7), P(eye.x + 0.6, eye.y - 0.4)], { rng, width: 0.13, opacity: 0.45, breaks: 0.2, pigment: INK, taper: [0.3, 0.3] });
}

function paintNeck(p: Painter): void {
  const rng = p.rng;
  const neck = smoothPolygon(pts([[-6.2, -1.5], [-3, -1.45], [0.4, -1.25], [0.6, 1.2], [-3, 1.4], [-6.2, 1.45]]), 1);
  skin(p, neck, false, [P(-1.5, -0.8), P(-3.6, -0.7), P(-5, -0.9)], 0.8);
  // the wrinkles across it
  for (const x of [-0.8, -1.9, -3.1, -4.4]) {
    p.inkLine([P(x + 0.25, -1.2), P(x - 0.15, 0), P(x + 0.2, 1.1)], { rng, width: 0.11, opacity: 0.38, breaks: 0.35, wobble: 0.3, pigment: mix(INK, SKIN, 0.3), taper: [0.3, 0.3] });
  }
}

/** A stout scaly leg hanging from its joint (y 0) to the sole (y `len`), claws forward. */
function paintLeg(p: Painter, fore: boolean, far: boolean, len: number): void {
  const rng = p.rng;
  const w = fore ? 1.35 : 1.7;
  const shape = smoothPolygon(
    fore
      ? pts([[-w, -1.2], [w, -1.2], [w + 0.2, len * 0.45], [w + 0.1, len * 0.8], [w + 0.9, len * 0.92], [w + 1.1, len], [-w - 0.1, len], [-w - 0.2, len * 0.7], [-w - 0.25, len * 0.3]])
      : pts([[-w, -1.2], [w, -1.2], [w - 0.1, len * 0.5], [w + 0.15, len * 0.85], [w + 0.35, len], [-w - 0.35, len], [-w - 0.1, len * 0.8], [-w - 0.2, len * 0.4]]),
    1,
  );
  // forelegs carry big yellowish scales down their front
  const scales = fore ? [P(w - 0.4, len * 0.2), P(w - 0.3, len * 0.45), P(w - 0.2, len * 0.7), P(0, len * 0.35)] : [P(0.4, len * 0.3), P(-0.6, len * 0.55)];
  skin(p, shape, far, scales, 0);
  // in the shell's shadow at the top, the rear edge darker
  p.glaze(shape, mix(PIGMENTS.shadow, BLOTCH, 0.3), { rng, opacity: 0.5, edge: 0, darken: 0, deform: 0.08, fade: { angle: Math.PI / 2, start: 0.15, amount: 1, ragged: 0.5 } });
  p.inkLine([P(-w - 0.15, len * 0.15), P(-w - 0.25, len * 0.6), P(-w - 0.3, len * 0.95)], { rng, width: 0.16, opacity: 0.35, breaks: 0.4, wobble: 0.2, pigment: INK, taper: [0.3, 0.3] });
  // stout claws
  const n = fore ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const x = (fore ? w + 0.9 : w) - i * 0.7;
    p.inkLine([P(x - 0.2, len - 0.35), P(x + 0.4, len - 0.05)], { rng, width: 0.3, opacity: far ? 0.45 : 0.7, breaks: 0, pigment: CLAW, taper: [0.1, 0.8] });
  }
}

/** The front view (only seen in a turn): the dome, the head between the forelegs. */
function paintFront(p: Painter): void {
  const rng = p.rng;
  const map = (u: number, v: number): Pt => {
    const a = Math.PI * (1 - u);
    const r = 1 - v * 0.82;
    return P(9.6 * r * Math.cos(a), -3 - 11.2 * r * Math.sin(a) ** 0.85 - v * 0.6);
  };
  // the forelegs splayed either side, under the rim
  for (const s of [-1, 1]) {
    const leg = smoothPolygon(pts([[s * 5.2, -3.5], [s * 7.6, -3.5], [s * 8.3, -0.2], [s * 7.9, 0], [s * 5.3, 0], [s * 5.4, -1.6]]), 1);
    skin(p, leg, false, [P(s * 7.2, -2.4), P(s * 6.3, -1.4)], 0);
    for (let i = 0; i < 3; i++) p.inkLine([P(s * (5.8 + i * 0.8), -0.4), P(s * (5.9 + i * 0.8), 0.05)], { rng, width: 0.28, opacity: 0.6, breaks: 0, pigment: CLAW, taper: [0.1, 0.8] });
  }
  const outline: Pt[] = [];
  for (let i = 0; i <= 18; i++) outline.push(map(i / 18, 0));
  p.wash(smoothPolygon(outline, 1), STRAW, { rng, opacity: 0.96, layers: 6, deform: 0.05, spread: 0.04, edge: 0.3, edgeWidth: 0.4, sharpness: 0.4, centreLift: 0.05, granulation: 0.15, blend: 'source-over' });
  const scutes: Scute[] = [];
  const marg = Array.from({ length: 10 }, (_, i) => i / 9);
  for (let i = 0; i < marg.length - 1; i++) scutes.push({ shape: cell(map, marg[i]!, marg[i + 1]!, () => 0, () => 0.2, 0.22), core: map((marg[i]! + marg[i + 1]!) / 2, 0.12), blotch: 0.45, rings: false });
  for (const [u0, u1] of [
    [0, 0.34],
    [0.34, 0.66],
    [0.66, 1],
  ] as const)
    scutes.push({ shape: cell(map, u0, u1, () => 0.2, () => 0.7, 0.26), core: map((u0 + u1) / 2, 0.45), blotch: 0.7, rings: true });
  for (const s of scutes) paintScute(p, s, rng, clamp(centroid(s.shape).x / 18 + 0.4, 0, 1));
  p.glaze(smoothPolygon(outline, 1), mix(PIGMENTS.shadow, '#6a5a46', 0.35), { rng, opacity: 0.38, edge: 0.06, darken: 0, deform: 0.06, fade: { angle: Math.atan2(-1, -0.75), start: 0.2, amount: 1, ragged: 0.6 } });
  // the shadowed opening under the rim, the head looking out of it
  const hole: Pt[] = [];
  for (let i = 0; i <= 10; i++) hole.push(map(i / 10, 0.7));
  p.wash(smoothPolygon(hole, 1), mix(mix(SKIN, BLOTCH, 0.4), PIGMENTS.shadow, 0.35), { rng, opacity: 0.85, layers: 4, deform: 0.08, edge: 0.3, edgeWidth: 0.3 });
  const head = smoothPolygon(pts([[-1.7, -3.3], [-1.6, -5.3], [0, -6.0], [1.6, -5.3], [1.7, -3.3], [0, -2.6]]), 1);
  skin(p, head, false, [], 0);
  p.glaze(head, mix(SKIN, BLOTCH, 0.35), { rng, opacity: 0.4, edge: 0, darken: 0, deform: 0.08, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.5 } });
  // the eyes at the sides of the blunt head, the pale cheek patches under them, the beak's tip
  for (const s of [-1, 1]) {
    p.dab(P(s * 1.35, -4.7), '#3a3026', { rng, variant: 'leaf', angle: s * 0.3, length: 0.55, width: 0.38, opacity: 0.8, layers: 2, edge: 0.4 });
    p.dab(P(s * 1.3, -3.7), '#e6d488', { rng, variant: 'round', angle: 0, length: 0.7, width: 0.45, opacity: 0.45, layers: 2, edge: 0.3 });
  }
  p.inkLine([P(-0.35, -3.0), P(0, -2.75), P(0.35, -3.0)], { rng, width: 0.14, opacity: 0.35, breaks: 0.3, pigment: INK });
}

export interface TortoiseParts {
  /** the shell lit from its rear (facing right in the world) and from its head (facing left) */
  shellRear: Sprite;
  shellHead: Sprite;
  head: Sprite;
  headSleep: Sprite;
  neck: Sprite;
  foreNear: Sprite;
  foreFar: Sprite;
  hindNear: Sprite;
  hindFar: Sprite;
  tail: Sprite;
  shadow: Sprite;
  front: Sprite;
}

export const FORE_LEN = 4.6;
export const HIND_LEN = 4.4;

export function paintTortoise(res: number, seed: number): TortoiseParts {
  const S = (box: { w: number; h: number; ox: number; oy: number }, k: number, f: (p: Painter) => void) => paintSprite(res, box, seed + k, (p) => f(p));
  const shellBox = { w: 28, h: 18, ox: 14, oy: 16.5 };
  const leg = (fore: boolean, far: boolean, k: number) => S({ w: 7, h: (fore ? FORE_LEN : HIND_LEN) + 2.6, ox: 3, oy: 1.6 }, k, (p) => paintLeg(p, fore, far, fore ? FORE_LEN : HIND_LEN));
  return {
    shellRear: S(shellBox, 1, (p) => paintShellSide(p, -1)),
    shellHead: S(shellBox, 1, (p) => paintShellSide(p, 1)),
    head: S({ w: 6.4, h: 4.8, ox: 0.9, oy: 2.6 }, 2, (p) => paintHead(p, false)),
    headSleep: S({ w: 6.4, h: 4.8, ox: 0.9, oy: 2.6 }, 2, (p) => paintHead(p, true)),
    neck: S({ w: 8, h: 4.2, ox: 7, oy: 2.1 }, 3, paintNeck),
    foreNear: leg(true, false, 4),
    foreFar: leg(true, true, 5),
    hindNear: leg(false, false, 6),
    hindFar: leg(false, true, 7),
    tail: S({ w: 5, h: 3, ox: 3.6, oy: 1.2 }, 8, (p) => skin(p, smoothPolygon(pts([[0.4, -0.8], [-1.6, -0.55], [-3.0, 0.4], [-1.4, 0.8], [0.4, 0.75]]), 1), false, [], 0.3)),
    shadow: S({ w: 32, h: 6, ox: 16, oy: 3 }, 9, (p) =>
      p.wash(smoothPolygon(pts([[-14, 0], [-8, -1.5], [6, -1.7], [14, -0.3], [7, 1.6], [-8, 1.5]]), 1), PIGMENTS.shadow, { rng: p.rng, opacity: 0.4, edge: 0, darken: 0, deform: 0.2, spread: 0.15, layers: 5 }),
    ),
    front: S({ w: 22, h: 18, ox: 11, oy: 16.2 }, 10, paintFront),
  };
}

// ---------------------------------------------------------------------------------------------
// drawing (pure: the studio draws poses with it)

export interface TortoisePose {
  /** 0 in its shell, 1 out, 1.5 stretched (grazing, basking) */
  neck: number;
  /** neck slope (+ down) and the head's own pitch on it (rad) */
  neckAngle: number;
  head: number;
  /** 0 drawn in, 1 standing, 1.3 splayed out (basking) */
  legs: number;
  /** gait phase (cycles) and how much of the gait shows (0 standing … 1 walking) */
  walk: number;
  gait: number;
  /** shell lowered toward the ground (units) */
  drop: number;
  sleep: boolean;
  shadow: number;
}

/** The box (sprite units, facing +x) a composed pose is drawn into: the stretched neck, the tail, the shadow. */
const COMPOSITE = { x: -17, y: -18, w: 40, h: 22 };

export const STAND_POSE: TortoisePose = { neck: 1, neckAngle: 0.12, head: 0.05, legs: 1, walk: 0, gait: 0, drop: 0, sleep: false, shadow: 1 };

const SHOULDER = P(6.0, -4.6);
const HIP = P(-6.4, -4.4);
const NECK_ROOT = P(6.2, -5.4);
const NECK_REACH = 4.6;
const TAIL_ROOT = P(-10.2, -3.5);
/** the diagonal gait: the near fore with the far hind, then the other pair; feet on the ground 72 % of a cycle */
const GAIT = { nearFore: 0, farHind: 0.06, farFore: 0.5, nearHind: 0.56, duty: 0.72 };

const img = (ctx: Ctx, s: Sprite) => ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);

function at(ctx: Ctx, s: Sprite, x: number, y: number, rot = 0, sx = 1, sy = 1): void {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  img(ctx, s);
  ctx.restore();
}

/** Where a foot is relative to its joint's neutral point, in a gait cycle: planted and sweeping back, then lifted forward. */
export function footAt(ph: number, stride = TORTOISE_TUNING.stride / TORTOISE_K): { x: number; lift: number } {
  const s = ((ph % 1) + 1) % 1;
  const half = (stride * GAIT.duty) / 2;
  if (s < GAIT.duty) return { x: lerp(half, -half, s / GAIT.duty), lift: 0 };
  const k = (s - GAIT.duty) / (1 - GAIT.duty);
  return { x: lerp(-half, half, easeInOut(k)), lift: Math.sin(k * Math.PI) };
}

/** The shell's rock in the gait: a slight pitch and lift as each diagonal pair takes the weight. */
export function shellRock(ph: number): { pitch: number; bob: number } {
  return { pitch: 0.022 * Math.sin(ph * TAU * 2 + 0.4), bob: 0.2 * (1 - Math.cos(ph * TAU * 2)) * 0.5 };
}

/** The tortoise at the origin (ground under its shell), side view facing +x, in world units at perspective 1. */
export function drawTortoise(ctx: Ctx, parts: TortoiseParts, q: TortoisePose, lightFromRear = true): void {
  if (q.shadow > 0) {
    ctx.save();
    ctx.globalAlpha *= q.shadow;
    ctx.translate(-0.4, 0.3);
    img(ctx, parts.shadow);
    ctx.restore();
  }
  const rock = shellRock(q.walk);
  const pitch = rock.pitch * q.gait;
  const lift = -q.drop + rock.bob * q.gait;
  const out = clamp(q.legs, 0, 1);
  const splay = Math.max(0, q.legs - 1);
  const leg = (s: Sprite, joint: Pt, len: number, ph: number, fore: boolean) => {
    const f = footAt(q.walk + ph);
    const jx = joint.x;
    const jy = joint.y - lift - (1 - out) * 3.2;
    const fx = jx + (fore ? 0.3 : -0.3) + f.x * q.gait + (fore ? 1.8 : -2.2) * splay;
    const fy = -f.lift * 1.1 * q.gait;
    const dx = fx - jx;
    const dy = Math.max(0.6, fy - jy - (1 - out) * 0.5);
    const l = Math.hypot(dx, dy);
    at(ctx, s, jx, jy, -Math.atan2(dx, dy), 1, (l / len) * (0.35 + 0.65 * out));
  };
  leg(parts.hindFar, HIP, HIND_LEN, GAIT.farHind, false);
  leg(parts.foreFar, SHOULDER, FORE_LEN, GAIT.farFore, true);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.rotate(pitch);
  at(ctx, parts.tail, TAIL_ROOT.x + (1 - out) * 1.2, TAIL_ROOT.y, -0.25 * out);
  // the neck slides out from under the shell's front; the head rides at its end
  const reach = NECK_REACH * q.neck - NECK_REACH;
  const jx = NECK_ROOT.x + NECK_REACH + reach * Math.cos(q.neckAngle);
  const jy = NECK_ROOT.y + reach * Math.sin(q.neckAngle) + NECK_REACH * Math.sin(q.neckAngle);
  at(ctx, parts.neck, jx, jy, q.neckAngle);
  at(ctx, q.sleep ? parts.headSleep : parts.head, jx, jy, q.neckAngle + q.head);
  ctx.restore();
  leg(parts.hindNear, HIP, HIND_LEN, GAIT.nearHind, false);
  leg(parts.foreNear, SHOULDER, FORE_LEN, GAIT.nearFore, true);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.rotate(pitch);
  img(ctx, lightFromRear ? parts.shellRear : parts.shellHead);
  ctx.restore();
}

/** The front view at the origin (only in a turn). */
export function drawTortoiseFront(ctx: Ctx, parts: TortoiseParts, shadow = 1): void {
  if (shadow > 0) {
    ctx.save();
    ctx.globalAlpha *= shadow;
    ctx.scale(0.7, 1);
    img(ctx, parts.shadow);
    ctx.restore();
  }
  img(ctx, parts.front);
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** A place on its map: a point on a terrace walk or the path, or a scrub clump it shelters in. */
export interface TortoiseNode {
  id: string;
  x: number;
  y: number;
  /** 0 the top terrace, 1 the middle, 2 the lower */
  level: number;
  kind: 'walk' | 'path' | 'scrub';
  /** clear to the side of any slot in front of it: it may stand here for a while */
  rest: boolean;
}

export interface TortoiseMap {
  nodes: TortoiseNode[];
  edges: { to: number; len: number }[][];
}

const LEVELS = ['top', 'middle', 'lower'];

/** The terrace level of a walk or a level stretch of the path, read from its name; null for any other place. */
export function levelOf(id: string): number | null {
  const m = /^walk-(top|middle|lower)-/.exec(id);
  if (m) return LEVELS.indexOf(m[1]!);
  if (id === 'path-middle') return 1;
  if (id === 'path-lower') return 2;
  return null;
}

type MapWorld = Pick<FaunaWorld, 'perches' | 'ground' | 'regions' | 'walls' | 'scene'>;

/** Clear of the planting slots, the jars and the trees' trunks. */
export function clearOf(w: MapWorld, q: Pt, gap = TORTOISE_TUNING.clear): boolean {
  for (const s of w.scene.slots) if (Math.abs(s.x - q.x) < gap && Math.abs(s.y - q.y) < gap && Math.hypot(s.x - q.x, s.y - q.y) < gap) return false;
  for (const p of w.perches) if (p.kind === 'jar' && Math.hypot(p.x - q.x, p.depth - q.y) < 16) return false;
  for (const r of w.regions) if (r.kind === 'bark' && pointInPolygon(q, r.outline)) return false;
  return true;
}

/** Not behind a slot in front of it: a plant there would stand over it. */
export function besideOf(w: MapWorld, q: Pt): boolean {
  for (const s of w.scene.slots) if (s.y > q.y - 6 && s.y - q.y < 55 && Math.abs(s.x - q.x) < TORTOISE_TUNING.beside) return false;
  return true;
}

/** A terrace wall's face lies on the way: it cannot climb. */
export function crossesWall(w: Pick<FaunaWorld, 'walls'>, a: Pt, b: Pt): boolean {
  const n = Math.max(2, Math.ceil(dist(a, b) / 3));
  for (const f of w.walls) {
    if (!f.id.startsWith('wall-')) continue;
    for (let i = 0; i <= n; i++) if (pointInPolygon(P(lerp(a.x, b.x, i / n), lerp(a.y, b.y, i / n)), f.outline)) return true;
  }
  return false;
}

function clearLine(w: MapWorld, a: Pt, b: Pt): boolean {
  const n = Math.max(2, Math.ceil(dist(a, b) / 4));
  for (let i = 1; i < n; i++) if (!clearOf(w, P(lerp(a.x, b.x, i / n), lerp(a.y, b.y, i / n)))) return false;
  return !crossesWall(w, a, b);
}

/** Side-on: a way may climb or drop in the picture only gently, so it never walks straight at the viewer. */
export const sideOn = (a: Pt, b: Pt, k = 0.5, slack = 3) => Math.abs(b.y - a.y) <= Math.abs(b.x - a.x) * k + slack;

const maps = new WeakMap<readonly GroundSpot[], TortoiseMap>();

/** Its places and the ways between them: along each terrace's walk and level path, and into the scrub at its ends. */
export function tortoiseMap(w: MapWorld): TortoiseMap {
  const cached = maps.get(w.ground);
  if (cached) return cached;
  const nodes: TortoiseNode[] = [];
  for (const g of w.ground) {
    const level = levelOf(g.id);
    if (level === null) continue;
    const path = g.id.startsWith('path-');
    const n = path ? 1 : Math.max(1, Math.round((g.rx * 1.8) / 22) + 1);
    for (let i = 0; i < n; i++) {
      const q = P(n === 1 ? g.x : g.x + (i / (n - 1) - 0.5) * g.rx * 1.8, g.y);
      if (clearOf(w, q)) nodes.push({ id: n === 1 ? g.id : `${g.id}-${i + 1}`, x: q.x, y: q.y, level, kind: path ? 'path' : 'walk', rest: besideOf(w, q) && clearOf(w, q, TORTOISE_TUNING.clear + 4) });
    }
  }
  const edges: TortoiseMap['edges'] = nodes.map(() => []);
  const link = (i: number, j: number) => {
    const len = dist(nodes[i]!, nodes[j]!) + Math.abs(nodes[i]!.y - nodes[j]!.y);
    edges[i]!.push({ to: j, len });
    edges[j]!.push({ to: i, len });
  };
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (a.level === b.level && dist(a, b) <= 130 && sideOn(a, b) && clearLine(w, a, b)) link(i, j);
    }
  }
  // the scrub: the level of the nearest walk it joins, side-on and over no wall
  const walks = nodes.length;
  for (const g of w.ground) {
    if (!g.id.startsWith('scrub-')) continue;
    const q = P(g.x, g.y);
    let best = -1;
    for (let i = 0; i < walks; i++) {
      const a = nodes[i]!;
      if (dist(a, q) <= 100 && sideOn(a, q, 0.65, 6) && clearLine(w, a, q) && (best < 0 || dist(a, q) < dist(nodes[best]!, q))) best = i;
    }
    if (best < 0) continue;
    const level = nodes[best]!.level;
    const k = nodes.length;
    nodes.push({ id: g.id, x: q.x, y: q.y, level, kind: 'scrub', rest: true });
    edges.push([]);
    for (let i = 0; i < walks; i++) {
      const a = nodes[i]!;
      if (a.level === level && dist(a, q) <= 100 && sideOn(a, q, 0.65, 6) && clearLine(w, a, q)) link(i, k);
    }
  }
  const map = { nodes, edges };
  maps.set(w.ground, map);
  return map;
}

/** Route lengths from `from` to every node (Dijkstra) and the step before each. */
export function routes(map: TortoiseMap, from: number): { cost: number[]; prev: number[] } {
  const n = map.nodes.length;
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  cost[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && cost[i]! < Infinity && (u < 0 || cost[i]! < cost[u]!)) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const e of map.edges[u]!) {
      const c = cost[u]! + e.len;
      if (c < cost[e.to]!) {
        cost[e.to] = c;
        prev[e.to] = u;
      }
    }
  }
  return { cost, prev };
}

/** The nodes from `from` to `to`, both included. */
export function pathTo(prev: readonly number[], from: number, to: number): number[] {
  const out = [to];
  while (out[0] !== from) {
    const p = prev[out[0]!]!;
    if (p < 0) return [];
    out.unshift(p);
  }
  return out;
}

/** The scrubs it can come out of: enough walk reachable from them to plod along (at least four places to stand). */
export function homeScrubs(map: TortoiseMap): number[] {
  return map.nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => {
      if (n.kind !== 'scrub') return false;
      const { cost } = routes(map, i);
      return map.nodes.filter((m, k) => m.kind !== 'scrub' && m.rest && cost[k]! < Infinity).length >= 4;
    })
    .map(({ i }) => i);
}

/** The levels it can spend a visit on: those with a home scrub. */
export function levelsOf(map: TortoiseMap): number[] {
  return [...new Set(homeScrubs(map).map((i) => map.nodes[i]!.level))].sort();
}

/** Which way to the greenery it can graze at a node: the scrub's edge, or a flower in the bed beside it (−1, 1; 0 none). */
export function greeneryAt(map: TortoiseMap, flowers: FaunaWorld['flowers'], i: number): number {
  const n = map.nodes[i]!;
  if (n.kind === 'scrub' || !n.rest) return 0;
  let best = Infinity;
  let dir = 0;
  for (const s of map.nodes) {
    if (s.kind !== 'scrub' || s.level !== n.level) continue;
    const dx = s.x - n.x;
    if (Math.abs(dx) >= 14 && Math.abs(dx) < TORTOISE_TUNING.reach && Math.abs(s.y - n.y) < 30 && Math.abs(dx) < best) {
      best = Math.abs(dx);
      dir = Math.sign(dx);
    }
  }
  for (const f of flowers) {
    const dx = f.x - n.x;
    if (f.baseY < n.y - 4 || f.baseY - n.y > 55) continue;
    if (Math.abs(dx) >= 18 && Math.abs(dx) < f.r + 26 && Math.abs(dx) < best) {
      best = Math.abs(dx);
      dir = Math.sign(dx);
    }
  }
  return dir;
}

const inView = (v: Rect, q: Pt, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

/** Where the next plod goes: a few body lengths along its terrace, greenery and ahead likelier, in view first, clear of other creatures. */
export function choosePlod(map: TortoiseMap, rng: Rng, view: Rect, from: number, facing: number, flowers: FaunaWorld['flowers'], held: readonly Pt[], scale = 1): number | null {
  const { cost } = routes(map, from);
  const len = TORTOISE_TUNING.bodyLength * scale;
  const ok = (i: number) => {
    const n = map.nodes[i]!;
    return i !== from && n.kind !== 'scrub' && n.rest && cost[i]! >= TORTOISE_TUNING.plod[0] * len && cost[i]! <= TORTOISE_TUNING.plod[1] * len && held.every((h) => dist(h, n) > 26);
  };
  const all = map.nodes.map((_, i) => i).filter(ok);
  const seen = all.filter((i) => inView(view, map.nodes[i]!, 30));
  let pool = seen.length > 0 ? seen : all;
  if (pool.length === 0) {
    // nothing that far: the nearest free places on its terrace it can reach
    const free = map.nodes.map((_, i) => i).filter((i) => i !== from && map.nodes[i]!.kind !== 'scrub' && map.nodes[i]!.rest && cost[i]! < Infinity && held.every((h) => dist(h, map.nodes[i]!) > 26));
    if (free.length === 0) return null;
    const least = Math.min(...free.map((i) => cost[i]!));
    pool = free.filter((i) => cost[i]! <= least * 1.5 + 10);
  }
  const here = map.nodes[from]!;
  const wt = (i: number) => (greeneryAt(map, flowers, i) !== 0 ? 3 : 1) * (Math.sign(map.nodes[i]!.x - here.x) === facing ? 3 : 1);
  let r = rng.next() * pool.reduce((s, i) => s + wt(i), 0);
  for (const i of pool) {
    r -= wt(i);
    if (r < 0) return i;
  }
  return pool[pool.length - 1]!;
}

/** The nearest scrub on its terrace by route, null when none is reachable. */
export function nearestScrub(map: TortoiseMap, from: number): number | null {
  if (map.nodes[from]!.kind === 'scrub') return from;
  const { cost } = routes(map, from);
  let best: number | null = null;
  map.nodes.forEach((n, i) => {
    if (n.kind === 'scrub' && cost[i]! < Infinity && (best === null || cost[i]! < cost[best]!)) best = i;
  });
  return best;
}

// ---------------------------------------------------------------------------------------------

export type TortoiseMode = 'emerge' | 'bask' | 'pause' | 'graze' | 'plod' | 'turn' | 'withdraw' | 'peek' | 'doze' | 'tuck';

/** What it is going to the scrub for: the midday shade, or away for the night (or the end of its visit). */
type Errand = 'shade' | 'away' | null;

export class Tortoise extends BaseCreature {
  readonly kind = 'tortoise' as const;
  readonly visitor = false;
  readonly level: number;
  /** for tests */
  plods = 0;
  grazes = 0;
  basks = 0;
  hides = 0;
  shades = 0;
  turns = 0;
  node: number;
  facing = 1;
  scale = 1;
  private mode: TortoiseMode = 'emerge';
  private modeT = 0;
  private modeFor = 1;
  private route: number[] = [];
  private walkPh = 0;
  private errand: Errand = null;
  private stayLeft: number;
  private activeLeft: number;
  private dozed = false;
  private graze = 0;
  private threat = false;
  private calmFor = 0;
  /** the pose's live values, eased toward each mode's targets */
  private q: TortoisePose = { ...STAND_POSE, neck: 0, legs: 0.2, drop: 1.2 };
  private target: Pt | null = null;
  private blink = -1;
  private blinkIn = 5;
  private seed: number;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    level: number,
    scrub: number,
    stay: number,
  ) {
    super();
    this.level = level;
    this.node = scrub;
    const n = tortoiseMap(w).nodes[scrub]!;
    this.x = n.x;
    this.y = n.y;
    this.scale = w.perspective(n.y, n.x);
    this.layer = 'entities';
    this.stayLeft = stay;
    this.activeLeft = rangeOf(rng, TORTOISE_TUNING.active);
    this.alpha = 0;
    this.seed = rng.int(0, 9999);
    // out of the scrub toward the open walk
    const walk = tortoiseMap(w).edges[scrub]!.map((e) => tortoiseMap(w).nodes[e.to]!);
    if (walk.length) this.facing = Math.sign(walk.reduce((s, m) => s + m.x, 0) / walk.length - n.x) || 1;
    this.setMode('emerge', 6 / w.speed);
  }

  /** Where it is, or where its plod ends (others keep off). */
  spot(): Pt | null {
    if (this.mode === 'tuck') return null;
    return this.route.length && this.target ? { ...this.target } : { x: this.x, y: this.y };
  }

  doing(): TortoiseMode {
    return this.mode;
  }

  /** Its head and legs are drawn in (tests, studio). */
  withdrawn(): boolean {
    return this.q.neck < 0.2 && this.q.legs < 0.2;
  }

  private setMode(m: TortoiseMode, t: number): void {
    this.mode = m;
    this.modeT = 0;
    this.modeFor = t;
    this.state = m;
  }

  override leave(): void {
    this.leaving = true;
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const sf = w.speed;
    const map = tortoiseMap(w);
    this.timer += dt;
    this.modeT += dt;
    this.stayLeft -= dt;
    if (this.mode !== 'doze' && this.mode !== 'emerge' && this.mode !== 'bask') this.activeLeft -= dt * sf;
    if (w.mode.night || this.stayLeft <= 0) this.leaving = true;
    this.blinks(dt * sf);
    this.watch(w);
    this.think(w, map, dt);
    this.ease(dt * sf);
  }

  private blinks(dt: number): void {
    if (this.blink >= 0) {
      this.blink += dt;
      if (this.blink > 0.5) this.blink = -1;
    } else if ((this.blinkIn -= dt) < 0) {
      this.blink = 0;
      this.blinkIn = this.rng.range(4, 12);
    }
  }

  /** A cat strolling close or a big bird landing near: into its shell. */
  threatened(w: Pick<FaunaWorld, 'creatures'>): boolean {
    for (const c of w.creatures) {
      const r = TORTOISE_THREATS[c.kind];
      if (r === undefined || c.done) continue;
      if (c.kind === 'cat' ? !['walk', 'crouch', 'leap', 'land'].includes(c.state) : c.layer !== 'entities') continue;
      if (Math.hypot(c.x - this.x, c.y - this.y) < r * this.scale) return true;
    }
    return false;
  }

  private watch(w: FaunaWorld): void {
    if (this.mode === 'emerge' || this.mode === 'tuck') return;
    this.threat = this.threatened(w);
    if (!this.threat) return;
    if (this.mode !== 'withdraw') {
      this.hides++;
      this.route = [];
      this.setMode('withdraw', 0);
    }
    this.calmFor = rangeOf(this.rng, TORTOISE_TUNING.hide) / w.speed;
  }

  private think(w: FaunaWorld, map: TortoiseMap, dt: number): void {
    const sf = w.speed;
    const rng = this.rng;
    switch (this.mode) {
      case 'emerge':
        this.alpha = clamp(this.modeT / (3 / sf), 0, 1);
        if (this.modeT >= this.modeFor) {
          // the first sun warms it before it moves
          this.basks++;
          this.setMode('bask', rangeOf(rng, TORTOISE_TUNING.bask) / sf);
        }
        return;
      case 'withdraw':
        if (this.threat) return;
        this.calmFor -= dt;
        if (this.calmFor <= 0) this.setMode('peek', 3.2 / sf);
        return;
      case 'tuck':
        this.alpha = clamp(1 - this.modeT / this.modeFor, 0, 1);
        if (this.modeT >= this.modeFor) this.done = true;
        return;
      case 'turn':
        if (this.modeT >= this.modeFor) {
          this.facing = -this.facing;
          this.turns++;
          this.afterTurn(w);
        }
        return;
      case 'plod':
        this.plod(w, map, dt);
        return;
      default:
    }
    if (this.leaving && this.errand !== 'away' && this.mode !== 'doze') {
      this.goTo(w, map, 'away');
      return;
    }
    if (this.leaving && this.mode === 'doze' && map.nodes[this.node]?.kind === 'scrub') {
      this.setMode('tuck', 5 / sf);
      return;
    }
    if (this.modeT < this.modeFor) return;
    switch (this.mode) {
      case 'bask':
      case 'peek':
      case 'doze':
        if (this.mode === 'doze') this.activeLeft = rangeOf(rng, TORTOISE_TUNING.active);
        this.setMode('pause', rangeOf(rng, [8, 20]) / sf);
        return;
      case 'pause':
      case 'graze': {
        if (this.errand) {
          this.goTo(w, map, this.errand);
          return;
        }
        if (this.activeLeft <= 0 && !this.dozed) {
          this.goTo(w, map, 'shade');
          return;
        }
        const g = greeneryAt(map, w.flowers, this.node);
        if (g !== 0 && rng.chance(this.mode === 'graze' ? 0.3 : 0.45)) {
          this.startGraze(w, g);
          return;
        }
        this.nextPlod(w, map);
        return;
      }
      default:
        this.setMode('pause', rangeOf(rng, TORTOISE_TUNING.pause) / sf);
    }
  }

  private startGraze(w: FaunaWorld, dir: number): void {
    this.graze = dir;
    if (dir !== this.facing) {
      this.setMode('turn', TORTOISE_TUNING.turn / w.speed);
      return;
    }
    this.grazes++;
    this.setMode('graze', rangeOf(this.rng, TORTOISE_TUNING.graze) / w.speed);
  }

  private afterTurn(w: FaunaWorld): void {
    if (this.route.length) {
      this.setMode('plod', 0);
      return;
    }
    if (this.graze !== 0 && this.graze === this.facing) {
      this.grazes++;
      this.setMode('graze', rangeOf(this.rng, TORTOISE_TUNING.graze) / w.speed);
      return;
    }
    this.setMode('pause', rangeOf(this.rng, TORTOISE_TUNING.pause) / w.speed);
  }

  private nextPlod(w: FaunaWorld, map: TortoiseMap): void {
    const bodies = groundBodies(w, this);
    const held = [...heldSpots(w).filter((h) => dist(h, this) > 1), ...bodies.map((g) => g.at)];
    const to = choosePlod(map, this.rng, w.view, this.node, this.facing, w.flowers, held, this.scale);
    // a cat or another creature on the way: it stays put for now (lib/ground)
    if (to === null || blockerOn(this, map.nodes[to]!, GROUND_ROOM.tortoise! * 0.5 * this.scale, bodies)) {
      this.setMode('pause', rangeOf(this.rng, TORTOISE_TUNING.pause) / w.speed);
      return;
    }
    const { prev } = routes(map, this.node);
    this.walkRoute(w, map, pathTo(prev, this.node, to).slice(1));
  }

  /** Into the scrub on its terrace: for the shade or for the night. */
  private goTo(w: FaunaWorld, map: TortoiseMap, why: Errand): void {
    this.errand = why;
    const s = nearestScrub(map, this.node);
    if (s === null) {
      this.setMode('tuck', 5 / w.speed);
      return;
    }
    if (s === this.node) {
      this.arriveScrub(w);
      return;
    }
    const { prev } = routes(map, this.node);
    this.walkRoute(w, map, pathTo(prev, this.node, s).slice(1));
  }

  private walkRoute(w: FaunaWorld, map: TortoiseMap, route: number[]): void {
    if (!route.length) {
      this.setMode('pause', rangeOf(this.rng, TORTOISE_TUNING.pause) / w.speed);
      return;
    }
    this.route = this.errand ? route.slice(0, 4) : route;
    const end = map.nodes[this.route[this.route.length - 1]!]!;
    this.target = { x: end.x, y: end.y };
    this.graze = 0;
    this.plods++;
    const to = map.nodes[route[0]!]!;
    if (Math.abs(to.x - this.x) > 2 && Math.sign(to.x - this.x) !== this.facing) this.setMode('turn', TORTOISE_TUNING.turn / w.speed);
    else this.setMode('plod', 0);
  }

  private plod(w: FaunaWorld, map: TortoiseMap, dt: number): void {
    const sf = w.speed;
    const to = map.nodes[this.route[0]!]!;
    const surge = 0.7 + 0.6 * Math.max(0, Math.sin(this.walkPh * TAU * 2));
    const v = TORTOISE_TUNING.walk * sf * this.scale * surge;
    const d = Math.hypot(to.x - this.x, to.y - this.y);
    const step = Math.min(d, v * dt);
    if (d > 1e-6) {
      this.x += ((to.x - this.x) / d) * step;
      this.y += ((to.y - this.y) / d) * step;
    }
    this.walkPh += step / (TORTOISE_TUNING.stride * this.scale);
    this.scale = w.perspective(this.y, this.x);
    if (d - step > 0.05) return;
    this.node = this.route.shift()!;
    if (this.route.length) {
      const next = map.nodes[this.route[0]!]!;
      if (Math.abs(next.x - this.x) > 2 && Math.sign(next.x - this.x) !== this.facing) this.setMode('turn', TORTOISE_TUNING.turn / sf);
      return;
    }
    if (map.nodes[this.node]!.kind === 'scrub') {
      this.arriveScrub(w);
      return;
    }
    if (this.errand) {
      // on its way to the scrub: a short stop, then on
      this.setMode('pause', rangeOf(this.rng, [4, 10]) / sf);
      return;
    }
    const g = greeneryAt(map, w.flowers, this.node);
    if (g !== 0 && this.rng.chance(0.75)) this.startGraze(w, g);
    else this.setMode('pause', rangeOf(this.rng, TORTOISE_TUNING.pause) / sf);
  }

  private arriveScrub(w: FaunaWorld): void {
    const sf = w.speed;
    if (this.errand === 'away' || this.leaving) {
      this.setMode('tuck', 5 / sf);
      return;
    }
    this.errand = null;
    this.dozed = true;
    this.shades++;
    this.setMode('doze', rangeOf(this.rng, TORTOISE_TUNING.shade) / sf);
  }

  /** Ease the pose toward what the mode wants. */
  private ease(dt: number): void {
    const t = this.timer;
    const n = (k: number) => Math.sin(t * k + this.seed) * 0.5 + Math.sin(t * k * 0.37 + this.seed * 1.7) * 0.5;
    let want: Partial<TortoisePose> & { rate?: number } = {};
    switch (this.mode) {
      case 'emerge':
        want = this.modeT < 2.5 ? { neck: 0, legs: 0.2, drop: 1.2, rate: 1 } : { neck: 0.9, legs: 1, drop: 0.3, neckAngle: 0.05, head: 0, rate: 0.5 };
        break;
      case 'bask':
        want = { neck: 1.5, neckAngle: -0.14 + 0.03 * n(0.2), head: -0.05, legs: 1.3, drop: 1.1, rate: 0.35 };
        break;
      case 'graze': {
        const bite = Math.max(0, Math.sin(this.modeT * 4.2)) ** 2;
        want = { neck: 1.4 - 0.08 * bite, neckAngle: 0.45, head: 0.22 + 0.16 * bite, legs: 1, drop: 0.25, rate: 0.8 };
        break;
      }
      case 'plod':
        want = { neck: 1.12, neckAngle: 0.1 + 0.03 * Math.sin(this.walkPh * TAU * 2), head: 0.05, legs: 1, drop: 0, rate: 1.2 };
        break;
      case 'withdraw':
        want = { neck: 0, legs: 0, drop: 1.4, neckAngle: 0.1, head: 0.1, rate: 5 };
        break;
      case 'peek':
        want = this.modeT < 1.6 ? { neck: 0.55, neckAngle: 0, head: -0.05, legs: 0.25, drop: 1.3, rate: 0.6 } : { neck: 0.9, legs: 1, drop: 0.2, rate: 0.6 };
        break;
      case 'doze':
        want = { neck: 0.38, neckAngle: 0.28, head: 0.15, legs: 0.55, drop: 1.25, rate: 0.4 };
        break;
      case 'tuck':
        want = { neck: 0.2, legs: 0.4, drop: 1, rate: 0.6 };
        break;
      default:
        // standing: the head lifts and lowers now and then, the neck breathes
        want = { neck: 1 + 0.06 * n(0.5), neckAngle: 0.1 + 0.14 * n(0.11), head: 0.08 * n(0.23), legs: 1, drop: 0.05, rate: 0.8 };
    }
    const q = this.q;
    const r = want.rate ?? 1;
    const go = (k: 'neck' | 'neckAngle' | 'head' | 'legs' | 'drop') => {
      const target = want[k];
      if (target === undefined) return;
      const diff = target - q[k];
      const s = r * dt * (k === 'neckAngle' || k === 'head' ? 1.2 : 1);
      q[k] += clamp(diff, -s, s);
    };
    for (const k of ['neck', 'neckAngle', 'head', 'legs', 'drop'] as const) go(k);
    q.gait = clamp(q.gait + (this.mode === 'plod' ? 1 : -1) * dt * 2.2, 0, 1);
    q.walk = this.walkPh;
    q.sleep = this.mode === 'doze' || (this.mode === 'bask' && n(0.07) > -0.4) || (this.blink >= 0 && this.blink < 0.35);
  }

  /** The pose now (reads the state only). */
  pose(): TortoisePose {
    return { ...this.q };
  }

  override depth(): number | null {
    return this.y + 0.5;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities' || this.alpha <= 0) return;
    const parts = w.art.get('tortoise', (res) => paintTortoise(res, 5300));
    ctx.save();
    ctx.globalAlpha *= this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale * TORTOISE_K, this.scale * TORTOISE_K);
    if (this.mode === 'turn') drawTurn(ctx, parts, this.pose(), this.facing, clamp(this.modeT / this.modeFor, 0, 1));
    else {
      ctx.scale(this.facing, 1);
      const c = this.composed(parts, Math.round(w.art.res * this.scale * TORTOISE_K * 10) / 10);
      ctx.drawImage(c as CanvasImageSource, COMPOSITE.x, COMPOSITE.y, COMPOSITE.w, COMPOSITE.h);
    }
    ctx.restore();
  }

  private comp: { canvas: AnyCanvas; key: string } | null = null;

  /** The pose composed once into its own canvas: it changes only every few frames, even plodding. */
  private composed(parts: TortoiseParts, res: number): AnyCanvas {
    const q = this.q;
    const key = `${this.facing},${res},${[q.neck, q.neckAngle, q.head, q.legs, q.drop, q.gait, q.walk % 1].map((v) => Math.round(v * 40)).join(',')},${q.sleep}`;
    if (this.comp?.key === key) return this.comp.canvas;
    const pw = Math.ceil(COMPOSITE.w * res);
    const ph = Math.ceil(COMPOSITE.h * res);
    let canvas = this.comp?.canvas;
    if (!canvas || canvas.width !== pw || canvas.height !== ph) canvas = makeCanvas(pw, ph);
    const c = canvas.getContext('2d') as CanvasRenderingContext2D;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, pw, ph);
    c.setTransform(pw / COMPOSITE.w, 0, 0, ph / COMPOSITE.h, -COMPOSITE.x * (pw / COMPOSITE.w), -COMPOSITE.y * (ph / COMPOSITE.h));
    drawTortoise(c, parts, this.pose(), this.facing > 0);
    this.comp = { canvas, key };
    return canvas;
  }
}

/** A turn round: the side view narrows into the front view and opens out the other way (`k` 0..1). */
export function drawTurn(ctx: Ctx, parts: TortoiseParts, q: TortoisePose, from: number, k: number): void {
  const a = ctx.globalAlpha;
  const side = (facing: number, s: number, alpha: number) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * alpha;
    ctx.scale(facing * (1 - 0.5 * s), 1);
    drawTortoise(ctx, parts, { ...q, gait: 0 }, facing > 0);
    ctx.restore();
  };
  const front = (alpha: number, s: number) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * alpha;
    ctx.scale(0.75 + 0.25 * s, 1);
    drawTortoiseFront(ctx, parts);
    ctx.restore();
  };
  const e = easeInOut(k);
  if (e < 0.5) {
    const s = e * 2;
    side(from, s, 1 - s);
    front(s, s);
  } else {
    const s = (1 - e) * 2;
    front(s, s);
    side(-from, s, 1 - s);
  }
  ctx.globalAlpha = a;
}

const homes = new WeakMap<readonly GroundSpot[], boolean>();

const tortoise: CreatureDef = {
  kind: 'tortoise',
  title: "Hermann's tortoise",
  role: 'drifter',
  // a long visit by day, now and then a pair (group 1–1.2 rounds to two about one visit in four)
  visit: { gap: [300, 700], first: [20, 60], stay: [700, 1300], group: [1, 1.2], max: 2, diurnal: true, visitor: false },
  // the coast's terrace walks and its scrub (cached: the scheduler asks often)
  needs: (w) => {
    let v = homes.get(w.ground);
    if (v === undefined) {
      v = w.ground.some((g) => g.id.startsWith('walk-')) && w.ground.some((g) => g.id.startsWith('scrub-')) && levelsOf(tortoiseMap(w)).length > 0;
      homes.set(w.ground, v);
    }
    return v;
  },
  spawn(w, s) {
    if (!tortoise.needs!(w)) return [];
    const map = tortoiseMap(w);
    const rng = w.rng.fork(`tortoise:${s.seed}:${w.t.toFixed(3)}:${w.creatures.length}`);
    // one terrace for the whole visit, from its seed: one with a scrub in view first
    const homes = homeScrubs(map);
    const seen = homes.filter((i) => inView(w.view, map.nodes[i]!, 20));
    const level = rng.pick([...new Set((seen.length ? seen : homes).map((i) => map.nodes[i]!.level))].sort());
    const scrubs = (seen.length ? seen : homes).filter((i) => map.nodes[i]!.level === level).map((i) => ({ n: map.nodes[i]!, i }));
    const pool = rng.shuffle(scrubs);
    const stay = s.stay || rangeOf(rng, [700, 1300]);
    const out: Tortoise[] = [];
    for (let k = 0; k < Math.max(1, s.count); k++) {
      const from = pool[k % pool.length]!;
      out.push(new Tortoise(w, rng.fork(`t${k}`), level, from.i, stay * (k ? rng.range(0.8, 1) : 1)));
    }
    return out;
  },
  sheet: {
    w: 520,
    h: 120,
    make(res, seed) {
      const a = paintTortoise(res, seed);
      return [a.shellRear, a.shellHead, a.front, a.head, a.headSleep, a.neck, a.foreNear, a.foreFar, a.hindNear, a.hindFar, a.tail];
    },
  },
  show: { stage: 'coast', spec: { x: 960, y: 700, w: 420, h: 150 }, w: 840, h: 300, order: 41 },
};
export default tortoise;
