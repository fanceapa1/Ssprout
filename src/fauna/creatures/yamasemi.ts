/**
 * Yamasemi (crested kingfisher, Megaceryle lugubris): the waterfall's rare last visitor. A big
 * black-and-white barred kingfisher with a shaggy crest and a dagger bill, painted as sumi dabs on
 * reserved white. Comes in fast and low along the stream, watches the pool from a high rock or a
 * shelf overhanging it, raising its crest and bobbing, hovers and plunges, leaves down the stream.
 * Side view, facing right. docs/systems/fauna.md › Creatures and behaviour.
 */
import type { Rng } from '../../core/rng';
import { blob, lighten, mix, PIGMENTS, ribbon, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { approach, clamp, closestOnPolygon, dist, easeInOut, insideWithMargin, isOffscreen, lerp, offscreenPoint, pointInPolygon, polygonCentroid, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Bill tip to tail tip at perspective 1 (world units): pigeon-sized, nearly twice the dipper. */
export const YAMASEMI_SIZE = 44;
const U = YAMASEMI_SIZE / 40;

export const YAMASEMI_TUNING = {
  /** world units / s at perspective 1, fast and direct */
  flight: 250,
  /** height over the water on the way in and out (world units at perspective 1) */
  low: 10,
  /** seconds watching from the perch between hunts; the first spell is longer */
  perch: [9, 26] as const,
  firstPerch: [16, 32] as const,
  /** seconds hovering over the spot before the plunge */
  hover: [0.9, 2.2] as const,
  /** hover height over the water (world units at perspective 1) */
  hoverHeight: [46, 72] as const,
  /** seconds under after the plunge */
  under: [0.45, 0.8] as const,
  /** chance it comes up with a fish, and that it gives up a hover and goes back */
  catch: 0.45,
  abort: 0.18,
  /** how far from its perch it fishes (world units) */
  reach: [40, 230] as const,
  /** plunge spots keep this far inside the still water (so off the foam and the shore) */
  margin: 16,
  /** seconds between crest moves, and between bouts of head bobs */
  crestGap: [1.8, 6.5] as const,
  bobGap: [2.4, 7.5] as const,
};

// ---------------------------------------------------------------------------------------------
// art

interface Colours {
  ink: Pigment;
  cool: Pigment;
  pale: Pigment;
  white: Pigment;
  shade: Pigment;
  rust: Pigment;
  bill: Pigment;
  tip: Pigment;
}

function colours(): Colours {
  return {
    ink: PIGMENTS.sumi,
    cool: mix(PIGMENTS.sumi, PIGMENTS.indigo, 0.25),
    pale: lighten(mix(PIGMENTS.sumi, PIGMENTS.shadow, 0.45), 0.22),
    white: PIGMENTS.petalWhite,
    shade: mix(PIGMENTS.shadow, PIGMENTS.stone, 0.35),
    rust: mix(PIGMENTS.vermilion, PIGMENTS.wood, 0.55),
    bill: mix(PIGMENTS.sumi, PIGMENTS.indigo, 0.12),
    tip: mix(PIGMENTS.stone, PIGMENTS.petalWhite, 0.3),
  };
}

const P = (x: number, y: number): Pt => ({ x: x * U, y: y * U });

/** Fine broken bars across `region`: rows of short ink touches along `angle`, `gap` apart, bowed by `bend` to follow the form. */
function bars(
  p: Painter,
  rng: Rng,
  region: Pt[],
  o: { angle: number; gap: number; width: number; dash: [number, number]; skip: [number, number]; opacity: [number, number]; pigments: Pigment[]; bend?: number; blend?: GlobalCompositeOperation },
): void {
  const xs = region.map((q) => q.x);
  const ys = region.map((q) => q.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 1;
  const ax = Math.cos(o.angle);
  const ay = Math.sin(o.angle);
  const step = 0.3 * U;
  // every touch in one wet layer, dried once: thin marks keep their shape and the pass is cheap
  const L = p.layer({ x: cx - R - 2, y: cy - R - 2, w: 2 * R + 4, h: 2 * R + 4 });
  const seed = rng.range(0, 100);
  for (let n = -R + rng.range(0, o.gap); n <= R; n += o.gap * rng.range(0.85, 1.15)) {
    let run: Pt[] = [];
    let left = rng.range(0, o.dash[1]);
    let gap = 0;
    const flush = () => {
      if (run.length >= 2) {
        // a brush touch: swells in the middle, tapers at both ends, its weight varies along the bar
        const wd = (o.width / 2) * rng.range(0.7, 1.3);
        const lean = rng.range(-0.25, 0.25) * o.width;
        const poly = ribbon(run, (t) => wd * Math.max(0.15, Math.sin(Math.PI * t) ** 0.6) * (0.8 + 0.4 * Math.sin(seed + t * 3)), (t) => lean * Math.sin(Math.PI * t));
        L.fill(poly, rng.pick(o.pigments), rng.range(o.opacity[0], o.opacity[1]));
      }
      run = [];
    };
    for (let s = -R; s <= R; s += step) {
      const bow = (o.bend ?? 0) * (s / R) ** 2 * R;
      const q = { x: cx + ax * s - ay * (n + bow), y: cy + ay * s + ax * (n + bow) };
      if (gap > 0) {
        gap -= step;
        continue;
      }
      if (!pointInPolygon(q, region)) {
        flush();
        continue;
      }
      run.push(q);
      left -= step;
      if (left <= 0) {
        flush();
        left = rng.range(o.dash[0], o.dash[1]);
        gap = rng.range(o.skip[0], o.skip[1]);
      }
    }
    flush();
  }
  const white = o.pigments.every((q) => q === PIGMENTS.petalWhite);
  L.dry({ opacity: 1, edge: white ? 0 : 0.35, edgeWidth: 0.3, darken: white ? 0 : 0.3, sharpness: 0.8, centreLift: 0.1, granulation: white ? 0 : 0.15, flow: 0.3, flowScale: 3, ...(o.blend ? { blend: o.blend } : {}) });
}

/** Specks of reserved white picked out of a dark mass. */
function specks(p: Painter, rng: Rng, region: Pt[], n: number, size: number, c: Colours, opacity = 0.85): void {
  const xs = region.map((q) => q.x);
  const ys = region.map((q) => q.y);
  for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
    const q = { x: rng.range(Math.min(...xs), Math.max(...xs)), y: rng.range(Math.min(...ys), Math.max(...ys)) };
    if (!pointInPolygon(q, region)) continue;
    i++;
    const l = size * rng.range(0.6, 1.3);
    p.dab(q, c.white, { rng, variant: rng.chance(0.5) ? 'round' : 'leaf', angle: rng.range(-0.4, 0.4), length: l * 1.4, width: l * rng.range(0.45, 0.8), opacity: opacity * rng.range(0.7, 1), layers: 2, blend: 'source-over', edge: 0 });
  }
}

/** The white ground of a part: opaque paper-white with a soft edge and no rim (it is reserved paper). */
function ground(p: Painter, shape: Pt[], c: Colours, rng: Rng): void {
  p.wash(shape, c.white, { rng, opacity: 1, edge: 0, darken: 0, sharpness: 0.4, centreLift: 0, granulation: 0, flow: 0, deform: 0.06, spread: 0.05, layers: 6, blend: 'source-over' });
}

// perched (feet at the origin): the body leans forward, the tail hangs down behind the feet
const BODY = [P(6.0, -17.4), P(7.9, -13.0), P(7.1, -7.6), P(4.4, -3.2), P(1.0, -1.4), P(-2.6, -2.4), P(-5.8, -5.2), P(-7.8, -9.6), P(-7.4, -14.0), P(-5.2, -17.6), P(-1.0, -19.4), P(3.0, -19.2)];
const NECK = P(1.2, -17.6);
const TAIL = [P(-2.4, -4.8), P(-5.6, -3.0), P(-10.6, 7.0), P(-9.6, 8.8), P(-7.0, 9.0), P(-6.4, 7.8), P(-1.6, -1.8)];
const WING = [P(0.2, -18.6), P(-3.0, -18.8), P(-5.8, -17.0), P(-7.9, -13.4), P(-8.2, -8.8), P(-7.0, -4.4), P(-6.0, -0.2), P(-4.2, -1.2), P(-1.4, -5.2), P(0.8, -9.8), P(1.6, -14.4)];

function paintTail(p: Painter, c: Colours, rng: Rng, shape: Pt[], axis: number): void {
  ground(p, shape, c, rng);
  // black with white bars, about even
  bars(p, rng, shape, { angle: axis + Math.PI / 2, gap: 1.25 * U, width: 0.7 * U, dash: [2.5 * U, 5 * U], skip: [0.2 * U, 0.6 * U], opacity: [0.65, 0.95], pigments: [c.ink, c.cool], bend: 0.1 });
  p.glaze(shape, c.ink, { rng, opacity: 0.2, edge: 0.3, deform: 0.06, fade: { angle: axis + Math.PI, start: 0.45 } });
}

function paintPerchBody(p: Painter, c: Colours): void {
  const rng = p.rng;
  paintTail(p, c, rng, smoothPolygon(TAIL, 1), Math.atan2(12, -4.6));
  const body = smoothPolygon(BODY, 2);
  ground(p, body, c, rng);
  // the round form: a cool shade low under the belly, lost toward the lit breast
  p.glaze(body, c.shade, { rng, opacity: 0.2, edge: 0, darken: 0, deform: 0.08, fade: { angle: -Math.PI / 2 + 0.7, start: 0.15, amount: 1, ragged: 0.7 } });
  // breast band: fine grey scallops, a rusty touch among them (the male's)
  const band = smoothPolygon([P(7.0, -16.2), P(3.4, -17.6), P(1.2, -15.0), P(1.6, -11.2), P(5.2, -10.0), P(7.9, -11.8)], 1);
  p.glaze(band, c.pale, { rng, opacity: 0.28, edge: 0.1, deform: 0.2, fade: { angle: Math.PI / 2, start: 0.55 } });
  bars(p, rng, band, { angle: 0.12, gap: 0.85 * U, width: 0.42 * U, dash: [1.2 * U, 3.2 * U], skip: [0.3 * U, 0.9 * U], opacity: [0.5, 0.9], pigments: [c.ink, c.ink, c.cool, c.rust], bend: 0.12 });
  // flanks under the wing: sparse fine bars fading into the white belly
  const flank = smoothPolygon([P(5.4, -9.8), P(1.0, -9.0), P(-1.8, -3.8), P(1.4, -2.0), P(4.8, -4.6), P(6.8, -7.8)], 1);
  bars(p, rng, flank, { angle: 0.2, gap: 1.1 * U, width: 0.32 * U, dash: [0.8 * U, 2.2 * U], skip: [1.0 * U, 3.0 * U], opacity: [0.25, 0.5], pigments: [c.pale, c.ink], bend: 0.1 });
  // folded wing: a slate ink wash, then close fine bars, darkest along the primaries
  const wing = smoothPolygon(WING, 2);
  p.wetInWet(wing, mix(c.pale, c.ink, 0.45), c.ink, { rng, angle: Math.PI / 2 + 0.25, split: 0.45, softness: 0.5, fingers: 0.6, opacity: 0.9, edge: 0.45, edgeWidth: 0.45, deform: 0.12, granulation: 0.3, flow: 0.5, flowScale: 5 * U });
  bars(p, rng, wing, { angle: 0.3, gap: 0.95 * U, width: 0.3 * U, dash: [0.9 * U, 2.6 * U], skip: [0.4 * U, 1.3 * U], opacity: [0.55, 0.9], pigments: [c.white], bend: -0.12, blend: 'source-over' });
  const primaries = smoothPolygon([P(-2.4, -8.0), P(-7.8, -7.0), P(-6.0, -0.2), P(-4.2, -1.2)], 1);
  p.glaze(primaries, c.ink, { rng, opacity: 0.5, edge: 0.4, deform: 0.12, fade: { angle: -Math.PI / 2, start: 0.35 } });
  specks(p, rng, wing, 10, 0.45 * U, c, 0.75);
  // a few broken touches of pale ink round the belly: the brush lifts off, no outline
  p.inkLine([P(7.8, -12.4), P(7.4, -8.4), P(5.2, -4.6), P(2.8, -2.4)], { rng, width: 0.3 * U, opacity: 0.25, breaks: 0.8, wobble: 0.3, pigment: c.pale, taper: [0.3, 0.5] });
  // small dark feet gripping the perch
  for (const [x, a] of [
    [-0.8, 0.3],
    [1.4, -0.2],
  ] as const) {
    p.dab(P(x, -0.6), c.ink, { rng, variant: 'leaf', angle: a, length: 2.0 * U, width: 0.7 * U, opacity: 0.85, layers: 3 });
  }
}

/** Head and bill, anchored at the neck (the head's centre is up and a little forward). */
function paintHead(p: Painter, c: Colours): void {
  const rng = p.rng;
  const head = smoothPolygon([P(6.8, -7.8), P(5.0, -10.6), P(1.6, -11.8), P(-2.2, -11.2), P(-5.0, -8.6), P(-5.6, -4.8), P(-4.4, -1.4), P(-1.4, 0.8), P(2.6, 0.8), P(5.6, -1.6), P(7.0, -4.6)], 2);
  ground(p, head, c, rng);
  // the dark cap down over the eye, broken by the dry brush where it meets the white cheek
  const cap = smoothPolygon([P(7.0, -7.0), P(5.0, -10.9), P(1.6, -12.0), P(-2.2, -11.4), P(-5.2, -8.6), P(-5.7, -5.6), P(-3.4, -6.0), P(0.2, -5.4), P(3.2, -5.6), P(5.6, -5.6)], 1);
  p.wetInWet(cap, mix(c.ink, c.cool, 0.4), c.ink, { rng, angle: Math.PI / 2 + 0.4, split: 0.4, softness: 0.45, fingers: 0.7, opacity: 0.97, edge: 0.5, edgeWidth: 0.4, deform: 0.24, spread: 0.12, granulation: 0.3, flow: 0.45, flowScale: 3 * U, dry: 0.1 });
  p.glaze(cap, c.ink, { rng, opacity: 0.4, edge: 0.3, deform: 0.2, fade: { angle: Math.PI / 2, start: 0.6, ragged: 0.9 } });
  for (let i = 0; i < 7; i++) {
    const q = P(rng.range(-4.4, 4.4), rng.range(-10.4, -6.6));
    if (pointInPolygon(q, cap)) p.dab(q, c.ink, { rng, variant: 'leaf', angle: Math.PI + rng.range(-0.3, 0.3), length: rng.range(1.8, 3.0) * U, width: 0.6 * U, opacity: 0.55, layers: 2 });
  }
  specks(p, rng, smoothPolygon([P(4.6, -10.0), P(1.6, -11.2), P(-2.2, -10.6), P(-4.8, -8.2), P(-4.8, -6.6), P(0, -6.6), P(2.4, -7.6)], 1), 16, 0.45 * U, c);
  // the malar stripe: speckled black from the bill's base down to the breast band
  const malar = smoothPolygon([P(6.8, -4.8), P(4.8, -4.8), P(2.0, -2.4), P(-0.2, 0.9), P(2.4, 1.0), P(4.6, -1.6), P(6.9, -3.6)], 1);
  p.glaze(malar, c.pale, { rng, opacity: 0.35, edge: 0.15, deform: 0.18 });
  bars(p, rng, malar, { angle: 0.7, gap: 0.75 * U, width: 0.42 * U, dash: [1.0 * U, 2.4 * U], skip: [0.2 * U, 0.6 * U], opacity: [0.6, 0.95], pigments: [c.ink, c.cool] });
  // the hindneck: slate, barred white, behind the white half-collar
  const nape = smoothPolygon([P(-5.8, -6.2), P(-3.6, -6.2), P(-3.0, -3.6), P(-3.6, 0.2), P(-5.0, -1.2), P(-5.8, -3.8)], 1);
  p.wetInWet(nape, mix(c.pale, c.ink, 0.45), c.ink, { rng, angle: Math.PI, split: 0.4, opacity: 0.85, edge: 0.35, deform: 0.2, granulation: 0.3, fade: { angle: 0, start: 0.55, ragged: 0.8 } });
  bars(p, rng, nape, { angle: 0.3, gap: 0.95 * U, width: 0.3 * U, dash: [0.8 * U, 2.0 * U], skip: [0.4 * U, 1.2 * U], opacity: [0.5, 0.85], pigments: [c.white], blend: 'source-over' });
  // the heavy dagger bill: dark, its tip paler, the gape a fine dark line
  const bill = smoothPolygon([P(5.8, -8.0), P(10.8, -7.0), P(15.0, -5.4), P(18.4, -3.7), P(14.8, -3.3), P(10.6, -3.2), P(6.0, -3.2)], 1);
  p.wetInWet(bill, c.bill, c.tip, { rng, angle: 0.18, split: 0.8, softness: 0.25, fingers: 0.2, opacity: 0.97, edge: 0.5, edgeWidth: 0.35, deform: 0.03, spread: 0.03, blend: 'source-over' });
  p.glaze(smoothPolygon([P(5.8, -8.0), P(13.0, -6.2), P(13.0, -5.2), P(6.2, -5.8)], 1), c.ink, { rng, opacity: 0.5, edge: 0.2, deform: 0.05 });
  p.inkLine([P(6.6, -4.8), P(11.5, -4.3), P(15.5, -3.8)], { rng, width: 0.26 * U, opacity: 0.6, breaks: 0.15, pigment: c.ink, taper: [0.1, 0.6] });
  // the eye in the cap's lower edge: dark on dark, only a glint shows it
  p.dab(P(3.9, -6.5), PIGMENTS.sumi, { rng, variant: 'round', angle: 0, length: 1.5 * U, width: 1.5 * U, opacity: 0.95, layers: 3 });
  p.dab(P(4.2, -6.8), c.white, { rng, variant: 'round', angle: 0, length: 0.35 * U, width: 0.35 * U, opacity: 0.5, blend: 'source-over', layers: 2 });
}

/** Seconds the splash stands, and its rings spread. */
const SPLASH_LIFE = 1.1;
const RING_LIFE = 3.2;

/** Head anchor → crest root (back of the crown). */
const CREST_ROOT = P(-1.4, -10.2);

/** The shaggy crest, anchored at its root on the back of the crown, swept back and up. */
function paintCrest(p: Painter, c: Colours): void {
  const rng = p.rng;
  // a small wet core at the root, then the feathers flung back from it: tapering strokes, ragged tips
  const core = smoothPolygon([P(2.4, 0.6), P(1.2, -2.6), P(-2.0, -4.4), P(-5.4, -3.6), P(-6.0, -0.8), P(-2.6, 1.0)], 1);
  p.wetInWet(core, c.cool, c.ink, { rng, angle: Math.PI, split: 0.5, opacity: 0.85, edge: 0.4, edgeWidth: 0.4, deform: 0.25, spread: 0.12, granulation: 0.35, dry: 0.15 });
  for (let i = 0; i < 28; i++) {
    const k = rng.next();
    // most lie back over the nape, a few stand up: a mop, not a fan
    const a = Math.PI + lerp(-0.08, 1.05, k * k) + rng.range(-0.08, 0.08);
    const len = lerp(11.5, 7.0, k) * U * rng.range(0.7, 1.15);
    const at = { x: rng.range(-3.0, 1.8) * U, y: rng.range(-2.0, 0.8) * U };
    p.dab(at, rng.chance(0.35) ? c.cool : c.ink, { rng, variant: 'blade', angle: a, length: len, width: rng.range(1.3, 2.4) * U, curve: rng.range(-0.25, 0.05), opacity: rng.range(0.4, 0.8), layers: 2, pool: 0.5, edge: 0.45 });
  }
  // white spots down the crest feathers
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + rng.range(0.1, 1.2);
    const d = rng.range(2.0, 7.5) * U;
    p.dab({ x: Math.cos(a) * d, y: Math.sin(a) * d }, c.white, { rng, variant: 'leaf', angle: a, length: rng.range(0.6, 1.1) * U, width: 0.4 * U, opacity: 0.75, blend: 'source-over', layers: 2, edge: 0 });
  }
}

/** In flight (body centre at the origin, level): white below, barred above, tail straight back. */
const FLY_BODY = [P(8.8, -2.8), P(5.0, -4.6), P(-1.0, -4.8), P(-6.2, -3.4), P(-8.8, -1.0), P(-7.6, 1.8), P(-3.0, 3.9), P(3.0, 4.4), P(7.4, 3.2), P(9.4, 0.4)];
/** Where the head (its neck anchor) and the wing's shoulder sit on the flying body. */
const FLY_NECK = P(8.6, 3.4);
const SHOULDER = P(2.0, -2.8);

function paintFlyBody(p: Painter, c: Colours): void {
  const rng = p.rng;
  paintTail(p, c, rng, smoothPolygon([P(-6.6, -1.8), P(-18.6, -1.6), P(-19.4, 1.6), P(-6.6, 2.4)], 1), Math.PI);
  const body = smoothPolygon(FLY_BODY, 2);
  ground(p, body, c, rng);
  p.glaze(body, c.shade, { rng, opacity: 0.2, edge: 0, darken: 0, deform: 0.08, fade: { angle: -Math.PI / 2, start: 0.3 } });
  const back = smoothPolygon([P(8.4, -2.4), P(5.0, -4.8), P(-1.0, -5.0), P(-6.2, -3.6), P(-8.8, -1.0), P(-4.0, -0.6), P(2.0, -1.2), P(7.0, -0.6)], 1);
  p.wetInWet(back, mix(c.pale, c.ink, 0.45), c.ink, { rng, angle: -Math.PI / 2, split: 0.5, opacity: 0.9, edge: 0.35, deform: 0.14, granulation: 0.3 });
  bars(p, rng, back, { angle: Math.PI / 2 + 0.15, gap: 0.95 * U, width: 0.3 * U, dash: [0.9 * U, 2.4 * U], skip: [0.4 * U, 1.3 * U], opacity: [0.55, 0.9], pigments: [c.white], blend: 'source-over' });
  const band = smoothPolygon([P(9.0, -0.6), P(6.0, -0.6), P(5.2, 2.6), P(8.0, 2.8)], 1);
  bars(p, rng, band, { angle: Math.PI / 2, gap: 0.85 * U, width: 0.42 * U, dash: [1.0 * U, 2.6 * U], skip: [0.3 * U, 0.9 * U], opacity: [0.5, 0.85], pigments: [c.ink, c.cool, c.rust] });
  bars(p, rng, smoothPolygon([P(4.0, 0.6), P(-5.0, 0.2), P(-3.0, 3.0), P(3.0, 3.6)], 1), { angle: Math.PI / 2, gap: 1.1 * U, width: 0.3 * U, dash: [0.8 * U, 2 * U], skip: [1.2 * U, 3 * U], opacity: [0.2, 0.45], pigments: [c.pale] });
}

/** One wing, raised: barred coverts at the shoulder, a fan of long spotted flight feathers. */
function paintWing(p: Painter, c: Colours): void {
  const rng = p.rng;
  // flight feathers first, the outermost (longest, most upright) last so it lies on top
  for (let k = 6; k >= 0; k--) {
    const t = k / 6;
    const at = P(lerp(0.8, -6.4, t), lerp(-3.2, -1.6, t));
    const a = -Math.PI / 2 - lerp(0.18, 1.05, t) + rng.range(-0.04, 0.04);
    const len = lerp(15.5, 8.0, t) * U;
    const wd = lerp(2.5, 3.0, t) * U;
    p.dab(at, c.white, { rng, variant: 'petal', angle: a, length: len, width: wd, curve: -0.06, opacity: 1, blend: 'source-over', layers: 3, edge: 0 });
    p.dab(at, mix(c.ink, c.cool, rng.next()), { rng, variant: 'petal', angle: a, length: len * 0.98, width: wd * 0.85, curve: -0.06, opacity: lerp(0.88, 0.7, t), layers: 3, pool: 0.5, edge: 0.45, granulation: 0.25 });
    // white spots in bars across each feather
    for (let s = 0.38; s < 0.9; s += 0.16) {
      const q = { x: at.x + Math.cos(a) * len * s, y: at.y + Math.sin(a) * len * s };
      p.dab(q, c.white, { rng, variant: 'round', angle: a + Math.PI / 2, length: wd * 0.42, width: wd * 0.3, opacity: 0.82, blend: 'source-over', layers: 2 });
    }
  }
  const coverts = smoothPolygon([P(2.0, 0.6), P(2.4, -4.0), P(0.6, -7.6), P(-3.6, -7.2), P(-7.0, -4.6), P(-6.6, 0.6)], 1);
  ground(p, coverts, c, rng);
  p.wetInWet(coverts, mix(c.pale, c.ink, 0.45), c.ink, { rng, angle: -Math.PI / 2, split: 0.5, opacity: 0.88, edge: 0.4, deform: 0.14, granulation: 0.3 });
  bars(p, rng, coverts, { angle: 0, gap: 0.95 * U, width: 0.3 * U, dash: [0.9 * U, 2.4 * U], skip: [0.4 * U, 1.3 * U], opacity: [0.55, 0.9], pigments: [c.white], blend: 'source-over' });
}

function paintFish(p: Painter): void {
  const rng = p.rng;
  const silver = mix(PIGMENTS.stone, PIGMENTS.celadonMid, 0.35);
  p.dab(P(0.6, 0), silver, { rng, variant: 'leaf', angle: 0, length: 6.4 * U, width: 1.7 * U, opacity: 0.95, blend: 'source-over', layers: 4 });
  p.dab(P(0.6, -0.35), mix(PIGMENTS.sumi, PIGMENTS.olive, 0.5), { rng, variant: 'leaf', angle: 0, length: 5.4 * U, width: 0.7 * U, opacity: 0.5, layers: 2 });
  p.dab(P(-2.4, 0), silver, { rng, variant: 'petal', angle: Math.PI, length: 1.8 * U, width: 1.5 * U, opacity: 0.85, layers: 2 });
  p.dab(P(3.4, -0.1), PIGMENTS.sumi, { rng, variant: 'round', angle: 0, length: 0.45 * U, width: 0.45 * U, opacity: 0.8, layers: 2 });
}

/** The plunge's splash: a broken column of white water thrown up, edged on one side with the pool's green. */
function paintSplash(p: Painter, c0: Colours): void {
  const rng = p.rng;
  const c = { ...c0, white: mix(PIGMENTS.petalWhite, PIGMENTS.celadon, 0.12) };
  const edge = PIGMENTS.celadonDeep;
  p.wash(blob(0, 0, 8 * U, 2.2 * U, rng), c.white, { rng, opacity: 0.95, edge: 0, darken: 0, deform: 0.3, layers: 5, blend: 'source-over' });
  const jets = [0, 0.1, ...Array.from({ length: 12 }, () => rng.range(-1, 1))];
  for (const k of jets) {
    const a = -Math.PI / 2 + k * 1.1 + rng.range(-0.12, 0.12);
    const len = (Math.abs(k) < 0.15 ? rng.range(10, 13) : rng.range(2.5, 8.5) * (1 - Math.abs(k) * 0.4)) * U;
    const at = { x: k * 3.5 * U + rng.range(-0.8, 0.8) * U, y: rng.range(-0.5, 0.3) * U };
    const wd = (Math.abs(k) < 0.15 ? 2.0 : rng.range(0.6, 1.3)) * U;
    p.dab(at, c.white, { rng, variant: 'blade', angle: a, length: len, width: wd, curve: rng.range(-0.15, 0.15), opacity: 0.95, blend: 'source-over', layers: 3, edge: 0 });
    if (rng.chance(0.3)) p.dab({ x: at.x + 0.3 * U * Math.sign(k || 1), y: at.y }, edge, { rng, variant: 'blade', angle: a + 0.05, length: len * 0.6, width: wd * 0.25, opacity: 0.12, layers: 2, edge: 0.3 });
  }
  for (let i = 0; i < 22; i++) {
    const a = -Math.PI / 2 + rng.range(-1.2, 1.2);
    const d = rng.range(4, 15) * U;
    const s = rng.range(0.3, 1.0) * U;
    const q = { x: Math.cos(a) * d * 0.9, y: Math.sin(a) * d };
    p.dab(q, c.white, { rng, variant: 'round', angle: 0, length: s, width: s, opacity: 0.95, blend: 'source-over', layers: 2 });
  }
  p.inkLine([P(-8, 0.8), P(-3, 1.8), P(3, 1.7), P(8, 0.6)], { rng, width: 0.32 * U, opacity: 0.32, breaks: 0.55, pigment: edge });
}

export interface YamasemiParts {
  body: Sprite; // perched body, wing and tail, anchored at the feet
  head: Sprite; // head and bill, anchored at the neck
  crest: Sprite; // anchored at its root on the crown
  flyBody: Sprite; // level body and tail, anchored at the body centre
  wing: Sprite; // one raised wing, anchored at the shoulder
  fish: Sprite;
  splash: Sprite; // anchored at the water
  rings: Sprite; // the plunge's rings, anchored at their centre
}

export function paintYamasemi(res: number, seed: number): YamasemiParts {
  const c = colours();
  return {
    body: paintSprite(res, { w: 21 * U, h: 33 * U, ox: 12 * U, oy: 23 * U }, seed, (p) => paintPerchBody(p, c)),
    head: paintSprite(res, { w: 26 * U, h: 15.5 * U, ox: 6.6 * U, oy: 13 * U }, seed + 1, (p) => paintHead(p, c)),
    crest: paintSprite(res, { w: 16 * U, h: 14 * U, ox: 12.8 * U, oy: 11.6 * U }, seed + 2, (p) => paintCrest(p, c)),
    flyBody: paintSprite(res, { w: 31 * U, h: 12 * U, ox: 20.5 * U, oy: 6 * U }, seed + 3, (p) => paintFlyBody(p, c)),
    wing: paintSprite(res, { w: 21 * U, h: 20 * U, ox: 14 * U, oy: 18.8 * U }, seed + 4, (p) => paintWing(p, c)),
    fish: paintSprite(res, { w: 9 * U, h: 3 * U, ox: 4.2 * U, oy: 1.5 * U }, seed + 5, (p) => paintFish(p)),
    splash: paintSprite(res, { w: 24 * U, h: 19 * U, ox: 12 * U, oy: 16 * U }, seed + 6, (p) => paintSplash(p, c)),
    rings: paintSprite(res, { w: 64 * U, h: 18 * U, ox: 32 * U, oy: 9 * U }, seed + 7, (p, rng) =>
      p.ripple({ x: 0, y: 0 }, { rng, width: 60 * U, count: 3, squash: 0.24, opacity: 0.9, light: 1, lineWidth: 1.1 * U, pigment: mix(PIGMENTS.celadonDeep, PIGMENTS.sumi, 0.45) }),
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** How far a perch stands over the still water below it (world units), or null when none is under it. */
function dropToWater(p: Perch, pond: readonly Pt[]): number | null {
  for (let d = 0; d <= 90; d += 3) if (pointInPolygon({ x: p.x, y: p.y + d }, pond)) return d;
  return null;
}

/** Shelves nearer the falls' sheet than this (world units) are in the falls, not over the pool. */
export const FALLS_CLEAR = 120;

/**
 * Its perches: rocks by the still water, and shelves that overhang it (still water within 90 units
 * straight below). High ones likelier; the ones at the falls' foot, in the spray, much less.
 */
export function yamasemiPerches(w: Pick<FaunaWorld, 'perches' | 'pond' | 'scene'>): { perch: Perch; weight: number }[] {
  const pond = w.pond.world;
  if (pond.length < 3) return [];
  const foot = w.scene.falls?.foot ?? null;
  const out: { perch: Perch; weight: number }[] = [];
  for (const p of w.perches) {
    if (p.kind === 'stone') continue;
    const drop = dropToWater(p, pond);
    let height: number;
    if (p.kind === 'ledge') {
      // a shelf overhanging the pool, never one in the falls' face
      const sheet = w.scene.falls?.outline;
      if (drop === null || (sheet && (pointInPolygon(p, sheet) || closestOnPolygon(p, sheet).d < FALLS_CLEAR))) continue;
      height = drop;
    } else {
      const base = { x: p.x, y: p.depth };
      const near = pointInPolygon(base, pond) ? 0 : closestOnPolygon(base, pond).d;
      if (near > 30) continue;
      height = p.depth - p.y;
    }
    const spray = foot ? clamp(dist(p, foot) / 160, 0.2, 1) ** 2 : 1;
    out.push({ perch: p, weight: (0.5 + clamp(height, 0, 80) / 30) * spray });
  }
  return out;
}

export function choosePerch(w: Pick<FaunaWorld, 'perches' | 'pond' | 'scene' | 'view'>, rng: Rng, taken: readonly Pt[], not: Perch | null = null): Perch | null {
  const free = yamasemiPerches(w).filter((c) => c.perch !== not && taken.every((t) => dist(t, c.perch) >= 30));
  // where it can be seen (a phone shows only part of the gorge), when any such perch is free
  const v = w.view;
  const seen = free.filter(({ perch: p }) => p.x > v.x + 40 && p.x < v.x + v.w - 40 && p.y > v.y + 40 && p.depth < v.y + v.h - 10);
  const all = seen.length > 0 ? seen : free;
  if (all.length === 0) return null;
  let x = rng.next() * all.reduce((a, b) => a + b.weight, 0);
  for (const c of all) {
    x -= c.weight;
    if (x < 0) return c.perch;
  }
  return all[all.length - 1]!.perch;
}

/** Where its feet rest on a perch: a rock's painted top sits a little below the perch line. */
export function standOn(p: Perch, x: number): Pt {
  return { x, y: perchY(p, x) + (p.kind === 'rock' ? p.dome * 0.35 : 0) };
}

/** A spot to plunge at: in the still water `margin` from its edge (so never in the foam), within reach. */
/** On (or just behind) a boulder standing in the water: no place to dive. */
export function onRock(q: Pt, rocks: readonly { x: number; y: number; w: number; h: number }[], pad = 12): boolean {
  return rocks.some((r) => Math.abs(q.x - r.x) < r.w / 2 + pad && q.y > r.y - r.h - pad && q.y < r.y + pad);
}

export function plungeSpot(w: Pick<FaunaWorld, 'pond' | 'view' | 'scene'>, from: Pt, rng: Rng, facing = 0): Pt | null {
  const pond = w.pond.world;
  const [r0, r1] = YAMASEMI_TUNING.reach;
  // the side it faces first (by default the pool's), then anywhere; distances in the pool's plane
  const prefer = facing || Math.sign(w.pond.centre.x - from.x) || 1;
  for (let i = 0; i < 64; i++) {
    const side = i < 40 ? prefer : rng.chance(0.5) ? 1 : -1;
    const a = rng.range(-1.3, 1.3);
    const d = rng.range(r0, r1);
    const q = { x: from.x + side * Math.cos(a) * d, y: from.y + Math.sin(a) * d * w.pond.squash };
    if (!insideWithMargin(q, pond, YAMASEMI_TUNING.margin) || onRock(q, w.scene.rocks)) continue;
    if (q.y - 90 < w.view.y || q.x < w.view.x + 20 || q.x > w.view.x + w.view.w - 20) continue;
    return q;
  }
  return null;
}

/** A point along a route: where the bird is, and the ground (water) under it for its scale. */
export interface RoutePt extends Pt {
  g: number;
}

/** A smoothed polyline walked by distance. */
export class Route {
  readonly pts: RoutePt[];
  readonly cum: number[];
  readonly len: number;

  constructor(raw: readonly RoutePt[]) {
    let pts = raw.map((q) => ({ ...q }));
    for (let it = 0; it < 3 && pts.length > 2; it++) {
      const next: RoutePt[] = [pts[0]!];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        next.push({ x: lerp(a.x, b.x, 0.25), y: lerp(a.y, b.y, 0.25), g: lerp(a.g, b.g, 0.25) }, { x: lerp(a.x, b.x, 0.75), y: lerp(a.y, b.y, 0.75), g: lerp(a.g, b.g, 0.75) });
      }
      next.push(pts[pts.length - 1]!);
      pts = next;
    }
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
    this.len = Math.max(1e-6, this.cum[this.cum.length - 1]!);
  }

  at(d: number): RoutePt & { a: number } {
    const s = clamp(d, 0, this.len);
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i]! < s) i++;
    const a = this.pts[i - 1]!;
    const b = this.pts[i] ?? a;
    const seg = this.cum[i]! - this.cum[i - 1]! || 1;
    const k = clamp((s - this.cum[i - 1]!) / seg, 0, 1);
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), g: lerp(a.g, b.g, k), a: Math.atan2(b.y - a.y, b.x - a.x) };
  }
}

/** Down the stream, low over the water: from just off the view to the pool's outflow (or the reverse). */
export function streamWay(w: Pick<FaunaWorld, 'pond' | 'water' | 'view'>, rng: Rng, low: number): RoutePt[] {
  const stream = w.water.moving.find((s) => s.length >= 3);
  const c = w.pond.centre;
  if (!stream) {
    const side = rng.chance(0.5) ? -1 : 1;
    const y = w.pond.bounds.y + w.pond.bounds.h * 0.5;
    const off = offscreenPoint(w.view, side, y - low, 80);
    return [{ ...off, g: y }];
  }
  const byNear = [...stream].sort((a, b) => dist(a, c) - dist(b, c));
  const mid = (pts: Pt[]) => ({ x: pts.reduce((s, q) => s + q.x, 0) / pts.length, y: pts.reduce((s, q) => s + q.y, 0) / pts.length });
  const centre = polygonCentroid(stream);
  // the ends' middles lie on the stream's end edges: step them in a little
  const inset = (q: Pt, k: number) => ({ x: lerp(q.x, centre.x, k), y: lerp(q.y, centre.y, k) });
  const near = inset(mid(byNear.slice(0, 2)), 0.12);
  const far = inset(mid(byNear.slice(-2)), 0.08);
  const along = [far, ...(pointInPolygon(centre, stream) ? [centre] : []), near];
  // carry on past the far end until off the view
  const dx = far.x - (along[1] ?? near).x;
  const dy = far.y - (along[1] ?? near).y;
  const dl = Math.hypot(dx, dy) || 1;
  const mouth = { x: far.x, y: far.y };
  for (let i = 0; i < 80 && !isOffscreen(mouth, w.view, 60); i++) {
    mouth.x += (dx / dl) * 20;
    mouth.y += (dy / dl) * 20;
  }
  return [mouth, ...along].map((q) => ({ x: q.x, y: q.y - low, g: q.y }));
}

// ---------------------------------------------------------------------------------------------

type Pose = 'fly' | 'glide' | 'hover' | 'dive' | 'rise';

export class Yamasemi extends BaseCreature {
  readonly kind = 'yamasemi' as const;
  readonly visitor = true;
  perch: Perch | null = null;
  /** the plunge spot on the water while it hunts */
  target: Pt | null = null;
  /** dives and catches this visit (tests) */
  plunges = 0;
  catches = 0;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  private scale = 1;
  private route: Route | null = null;
  private u = 0;
  private then: 'perch' | 'hover' | 'gone' = 'perch';
  private perchFor = 0;
  private hoverAt: Pt = { x: 0, y: 0 };
  private hoverFor = 0;
  private underFor = 0;
  private age = 0;
  private flap = 0;
  private pitch = 0;
  private crest = 0.3;
  private crestTo = 0.3;
  private crestGap = 2;
  private bobT = -1;
  private bobs = 0;
  private bobGap = 2;
  private peer = 0;
  private fish = false;
  private fishFor = 0;
  private splashT = -1;
  private splashAt: Pt = { x: 0, y: 0 };
  private echo = -1;
  private first = true;
  private scaleAtSpot = 1;
  private ringScale = 1;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    readonly stay: number,
  ) {
    super();
    this.perch = choosePerch(w, rng, takenSpots(w, this));
    if (!this.perch) {
      this.done = true;
      return;
    }
    this.crestGap = rng.range(1, 3);
    this.bobGap = rng.range(1, 3);
    const stand = standOn(this.perch, this.perch.x + rng.range(-0.4, 0.4) * this.perch.spread);
    const way = streamWay(w, rng, YAMASEMI_TUNING.low);
    const under = { x: stand.x + (way[way.length - 1]!.x > stand.x ? 36 : -36), y: this.perch.depth - YAMASEMI_TUNING.low * 2, g: this.perch.depth };
    this.pos = { x: way[0]!.x, y: way[0]!.y };
    this.scale = w.perspective(way[0]!.g, way[0]!.x);
    this.fly([...way, under, { ...stand, g: this.perch.depth }], 'perch', 'enter');
    this.sync();
  }

  /** Where it sits or is about to (so others keep off its perch). */
  spot(): Pt | null {
    return this.perch && (this.state === 'perch' || this.then === 'perch') ? { x: this.perch.x, y: this.perch.y } : null;
  }

  private fly(pts: RoutePt[], then: Yamasemi['then'], state = then === 'gone' ? 'leave' : then === 'hover' ? 'launch' : 'fly'): void {
    this.route = new Route([{ x: this.pos.x, y: this.pos.y, g: pts[0]?.g ?? this.pos.y }, ...pts]);
    this.u = 0;
    this.then = then;
    this.layer = 'air';
    const end = pts[pts.length - 1]!;
    if (Math.abs(end.x - this.pos.x) > 2) this.facing = Math.sign(end.x - this.pos.x);
    this.go(state);
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const sf = w.speed;
    const rng = this.rng;
    this.timer += dt;
    this.age += dt;
    if (this.age > this.stay) this.leaving = true;
    this.crestStep(dt, sf);
    if (this.splashT >= 0) this.splashT += dt * sf;
    if (this.echo >= 0) {
      this.echo -= dt * sf;
      if (this.echo < 0) w.ripple(this.splashAt.x, this.splashAt.y, 40 * this.scale, 0.6);
    }
    switch (this.state) {
      case 'enter':
      case 'fly':
      case 'launch':
      case 'return':
      case 'leave':
        this.flyStep(dt, w);
        break;
      case 'perch':
        this.perchStep(dt, w);
        break;
      case 'hover': {
        const k = this.timer * sf;
        this.flap += dt * sf * 13;
        this.pos = { x: this.hoverAt.x + Math.sin(k * 1.7) * 1.2, y: this.hoverAt.y + Math.sin(k * 5.3) * 1.4 * this.scale };
        this.pitch = approach(this.pitch, -0.8, 4, dt);
        if (this.timer > this.hoverFor) {
          if (rng.chance(YAMASEMI_TUNING.abort) || this.leaving) this.back(w);
          else this.go('plunge');
        }
        break;
      }
      case 'plunge': {
        // wings folded, bill first, gathering speed
        const T = 0.42 / sf;
        const k = clamp(this.timer / T, 0, 1);
        const s = this.target!;
        this.pos = { x: lerp(this.hoverAt.x, s.x, k * k), y: lerp(this.hoverAt.y, s.y + 4 * this.scale, k * k) };
        this.pitch = lerp(-0.6, 1.4, easeInOut(Math.min(1, k * 2.2)));
        if (k >= 1) {
          this.plunges++;
          this.splashAt = { ...s };
          this.splashT = 0;
          this.ringScale = this.scale;
          this.echo = 0.28;
          w.ripple(s.x, s.y, 66 * this.scale, 1);
          this.underFor = rangeOf(rng, [...YAMASEMI_TUNING.under]) / sf;
          this.go('under');
        }
        break;
      }
      case 'under':
        if (this.timer > this.underFor) {
          this.fish = rng.chance(YAMASEMI_TUNING.catch);
          if (this.fish) this.catches++;
          w.ripple(this.target!.x, this.target!.y, 30 * this.scale, 0.7);
          this.go('emerge');
        }
        break;
      case 'emerge': {
        const T = 0.5 / sf;
        const k = clamp(this.timer / T, 0, 1);
        const s = this.target!;
        this.flap += dt * sf * 10;
        this.pitch = lerp(-1.1, -0.4, k);
        this.pos = { x: s.x - this.facing * 4 * k, y: s.y + 6 * this.scale - 22 * this.scale * easeInOut(k) };
        if (k >= 1) this.back(w);
        break;
      }
    }
    this.sync();
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const r = this.route!;
    const sf = w.speed;
    const left = r.len - this.u;
    // fast all the way, braking only for the last stretch to a perch or a hover
    const brake = this.then === 'gone' ? 1 : clamp(left / 50, 0.3, 1);
    const kind = this.state === 'launch' ? 0.7 : 1;
    this.u = Math.min(r.len, this.u + YAMASEMI_TUNING.flight * sf * kind * brake * dt * Math.max(0.6, this.scale));
    const q = r.at(this.u);
    if (Math.abs(q.x - this.pos.x) > 0.05) this.facing = Math.sign(q.x - this.pos.x);
    this.pos = { x: q.x, y: q.y };
    this.scale = w.perspective(q.g, q.x);
    this.pitch = approach(this.pitch, clamp(Math.atan2(Math.sin(q.a), Math.abs(Math.cos(q.a))) * 0.6, -0.45, 0.45), 5, dt);
    this.flap += dt * sf * (left < 40 && this.then === 'perch' ? 4 : 8);
    if (this.then === 'gone' && isOffscreen(this.pos, w.view, 30) && left < 30) this.done = true;
    if (this.u < r.len) return;
    this.route = null;
    if (this.then === 'gone') this.done = true;
    else if (this.then === 'hover') {
      this.hoverAt = { ...this.pos };
      this.hoverFor = rangeOf(this.rng, [...YAMASEMI_TUNING.hover]) / sf;
      // over the water it draws among the entities at the spot's depth
      this.layer = 'entities';
      this.go('hover');
    } else this.land(w);
  }

  private land(w: FaunaWorld): void {
    const p = this.perch!;
    this.layer = 'entities';
    this.scale = w.perspective(p.depth, p.x);
    this.pitch = 0;
    // it watches the water: faces the pool
    const c = w.pond.centre;
    if (Math.abs(c.x - this.pos.x) > 10) this.facing = Math.sign(c.x - this.pos.x);
    const span = this.first ? YAMASEMI_TUNING.firstPerch : YAMASEMI_TUNING.perch;
    this.first = false;
    this.perchFor = rangeOf(this.rng, [...span]) / w.speed / (w.mode.reduced ? 0.7 : 1);
    if (this.fish) this.fishFor = 3.2;
    this.crestTo = 1;
    this.bobGap = 0.4;
    this.go('perch');
  }

  private perchStep(dt: number, w: FaunaWorld): void {
    const rng = this.rng;
    const sf = w.speed;
    this.bobStep(dt, sf);
    if (this.fish) {
      // beats the fish on the perch, then swallows it head first
      this.fishFor -= dt * sf;
      if (this.fishFor <= 0) {
        this.fish = false;
        this.bobGap = 0.6;
      }
      return;
    }
    if (rng.chance((dt * sf) / 40)) this.facing = -this.facing;
    if (this.leaving && this.timer > 1.5) {
      this.depart(w);
      return;
    }
    const lean = this.perchFor - this.timer;
    this.peer = approach(this.peer, lean < 1.2 ? 1 : 0, 2.5, dt);
    if (this.timer < this.perchFor) return;
    const from = { x: this.pos.x, y: this.perch!.depth };
    const s = plungeSpot(w, from, rng, this.facing);
    if (!s) {
      this.perchFor = this.timer + rangeOf(rng, [...YAMASEMI_TUNING.perch]) / sf;
      return;
    }
    this.target = s;
    this.scaleAtSpot = w.perspective(s.y, s.x);
    const h = rangeOf(rng, [...YAMASEMI_TUNING.hoverHeight]) * this.scaleAtSpot;
    const hover = { x: s.x - Math.sign(s.x - this.pos.x) * 6, y: s.y - h, g: s.y };
    const mid = { x: lerp(this.pos.x, hover.x, 0.5), y: Math.max(this.pos.y, hover.y) + 6, g: lerp(this.perch!.depth, s.y, 0.5) };
    this.peer = 0;
    this.fly([mid, hover], 'hover');
  }

  /** Back to the perch from the water (or another perch if someone took it). */
  private back(w: FaunaWorld): void {
    let p = this.perch;
    if (!p || takenSpots(w, this).some((t) => dist(t, p!) < 30)) p = choosePerch(w, this.rng, takenSpots(w, this));
    if (!p || this.leaving) {
      this.depart(w);
      return;
    }
    this.perch = p;
    const stand = standOn(p, p.x + this.rng.range(-0.3, 0.3) * p.spread);
    const mid = { x: lerp(this.pos.x, stand.x, 0.55), y: Math.max(this.pos.y, stand.y) + 4, g: lerp(this.target?.y ?? p.depth, p.depth, 0.55) };
    this.fly([mid, { ...stand, g: p.depth }], 'perch', 'return');
  }

  /** Off fast and low down the stream. */
  private depart(w: FaunaWorld): void {
    const way = streamWay(w, this.rng, YAMASEMI_TUNING.low).reverse();
    const first = way[0]!;
    const drop = { x: lerp(this.pos.x, first.x, 0.3), y: Math.max(this.pos.y + 10, first.y), g: lerp(this.perch?.depth ?? first.g, first.g, 0.3) };
    this.perch = null;
    this.fly([drop, ...way], 'gone');
  }

  override leave(): void {
    this.leaving = true;
  }

  private crestStep(dt: number, sf: number): void {
    this.crest = approach(this.crest, this.crestTo, 2.2 * sf, dt);
    this.crestGap -= dt * sf;
    if (this.crestGap > 0) return;
    this.crestGap = rangeOf(this.rng, [...YAMASEMI_TUNING.crestGap]);
    this.crestTo = this.crestTo > 0.5 ? this.rng.range(0, 0.35) : this.rng.range(0.7, 1);
  }

  private bobStep(dt: number, sf: number): void {
    if (this.bobT >= 0) {
      this.bobT += dt * sf;
      if (this.bobT >= 0.38) this.bobT = -1;
      return;
    }
    this.bobGap -= dt * sf;
    if (this.bobGap > 0) return;
    this.bobT = 0;
    if (this.bobs > 0) this.bobs--;
    else {
      this.bobs = this.rng.int(1, 4);
      // a bout of bobs often comes with the crest going up
      if (this.rng.chance(0.6)) this.crestTo = this.rng.range(0.75, 1);
    }
    this.bobGap = this.bobs > 0 ? this.rng.range(0.45, 0.7) : rangeOf(this.rng, [...YAMASEMI_TUNING.bobGap]);
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    switch (this.state) {
      case 'perch':
        return this.perch ? this.perch.depth + 1 : this.y;
      case 'hover':
      case 'plunge':
      case 'under':
      case 'emerge':
        return this.target ? this.target.y : this.y;
      default:
        return null;
    }
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const parts = w.art.get('yamasemi', (res) => paintYamasemi(res, 2300));
    if (layer === 'waterSurface') {
      this.drawRings(ctx, parts);
      return;
    }
    const onWater = this.state === 'hover' || this.state === 'plunge' || this.state === 'under' || this.state === 'emerge';
    if (this.state === 'perch') {
      if (layer === 'entities') this.drawPerched(ctx, parts);
      return;
    }
    if (onWater) {
      if (layer !== 'entities') return;
      const s = this.target!;
      if (this.state !== 'under') {
        ctx.save();
        if (this.state !== 'hover') {
          // what is under the surface is out of sight
          ctx.beginPath();
          ctx.rect(s.x - 80, s.y - 200, 160, 200 + 0.5);
          ctx.clip();
        }
        this.drawFlying(ctx, parts, this.state === 'hover' ? 'hover' : this.state === 'plunge' ? 'dive' : 'rise');
        ctx.restore();
      }
      this.drawSplash(ctx, parts);
      return;
    }
    if (layer === 'air') this.drawFlying(ctx, parts, this.route && this.route.len - this.u < 30 && this.then === 'perch' ? 'glide' : 'fly');
  }

  private drawPerched(ctx: Ctx, parts: YamasemiParts): void {
    const s = this.scale;
    const bob = this.bobT < 0 ? 0 : Math.sin((this.bobT / 0.38) * Math.PI);
    const beat = this.fish ? Math.max(0, Math.sin((3.2 - this.fishFor) * 6)) * (this.fishFor > 0.8 ? 1 : 0) : 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s * this.facing, s);
    ctx.rotate(0.12 * this.peer + 0.05 * bob);
    const b = parts.body;
    ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    // head: dips with each bob, leans to peer at the water, swings to beat a fish
    ctx.translate(NECK.x + 0.6 * U * this.peer, NECK.y + 1.6 * U * bob + 0.8 * U * this.peer);
    ctx.rotate(0.22 * bob + 0.38 * this.peer - 0.5 * beat);
    this.drawHead(ctx, parts, this.crest);
    ctx.restore();
  }

  /** Head at its neck anchor (already placed), crest raised by `c` (0 flat … 1 up), the fish if any. */
  private drawHead(ctx: Ctx, parts: YamasemiParts, c: number): void {
    const cr = parts.crest;
    // a kingfisher's big head
    ctx.scale(1.12, 1.12);
    ctx.save();
    ctx.translate(CREST_ROOT.x, CREST_ROOT.y);
    // lowered it lies back over the nape; raised it lifts into a shaggy mop
    ctx.rotate(lerp(-0.32, 0.22, c));
    ctx.scale(lerp(1.1, 1.0, c), lerp(0.55, 1.08, c));
    ctx.drawImage(cr.img as CanvasImageSource, -cr.ox, -cr.oy, cr.w, cr.h);
    ctx.restore();
    const h = parts.head;
    ctx.drawImage(h.img as CanvasImageSource, -h.ox, -h.oy, h.w, h.h);
    if (this.fish) {
      const f = parts.fish;
      ctx.save();
      ctx.translate(13.6 * U, -4.4 * U);
      ctx.rotate(Math.PI / 2 - 0.35);
      ctx.drawImage(f.img as CanvasImageSource, -f.ox, -f.oy, f.w, f.h);
      ctx.restore();
    }
  }

  private drawFlying(ctx: Ctx, parts: YamasemiParts, pose: Pose): void {
    const s = this.scale;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s * this.facing, s);
    ctx.rotate(this.pitch);
    // the beat: the wing foreshortens through edge-on, quick and deep
    const ph = Math.cos(this.flap * TAU);
    const wy = pose === 'glide' ? 0.55 : pose === 'dive' ? 0.3 : pose === 'hover' ? 0.15 + 0.85 * ph : 0.2 + 0.8 * ph;
    const wr = pose === 'dive' ? -1.25 : pose === 'hover' ? -0.15 : 0;
    const wing = (alpha: number, dx: number, sy = wy) => {
      const g = parts.wing;
      ctx.save();
      ctx.translate(SHOULDER.x + dx, SHOULDER.y);
      ctx.rotate(wr);
      ctx.scale(1, sy);
      ctx.globalAlpha *= alpha;
      ctx.drawImage(g.img as CanvasImageSource, -g.ox, -g.oy, g.w, g.h);
      ctx.restore();
    };
    wing(0.75, 1.2 * U);
    if (pose === 'hover') {
      // a beat too quick to see: the wing's whole sweep as a haze
      wing(0.3, 0, 1);
      wing(0.3, 0, -0.7);
    }
    const b = parts.flyBody;
    ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    ctx.save();
    ctx.translate(FLY_NECK.x, FLY_NECK.y);
    // hovering, it looks straight down at the water; diving, bill first
    if (pose === 'hover') ctx.rotate(1.2);
    else if (pose === 'rise') ctx.rotate(0.5);
    this.drawHead(ctx, parts, pose === 'hover' ? this.crest * 0.6 : 0);
    ctx.restore();
    wing(1, 0);
    ctx.restore();
  }

  /** The plunge's big ring spreading on the pool, after the bird has gone too. */
  private drawRings(ctx: Ctx, parts: YamasemiParts): void {
    if (this.splashT < 0 || this.splashT > RING_LIFE) return;
    const k = this.splashT / RING_LIFE;
    const r = parts.rings;
    const s = this.ringScale * lerp(0.45, 1.9, 1 - (1 - k) ** 2.2);
    ctx.save();
    ctx.translate(this.splashAt.x, this.splashAt.y);
    ctx.scale(s, s);
    ctx.globalAlpha *= (1 - k) ** 1.3;
    ctx.drawImage(r.img as CanvasImageSource, -r.ox, -r.oy, r.w, r.h);
    ctx.restore();
  }

  private drawSplash(ctx: Ctx, parts: YamasemiParts): void {
    if (this.splashT < 0 || this.splashT > SPLASH_LIFE) return;
    const k = this.splashT / SPLASH_LIFE;
    const sp = parts.splash;
    // thrown up at once, then settling back and spreading as it falls
    const up = Math.sin(Math.min(1, k * 2.2) * Math.PI * 0.5);
    const s = this.ringScale * lerp(1.4, 2.2, Math.sqrt(k));
    ctx.save();
    ctx.translate(this.splashAt.x, this.splashAt.y);
    ctx.scale(s, s * lerp(0.55, 1.25, up) * (1 - 0.35 * Math.max(0, k - 0.45)));
    ctx.globalAlpha *= k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
    ctx.drawImage(sp.img as CanvasImageSource, -sp.ox, -sp.oy, sp.w, sp.h);
    ctx.restore();
  }
}

/** What other creatures hold or are making for (their `spot()` / `perchPoint()`). */
function takenSpots(w: Pick<FaunaWorld, 'creatures'>, self: unknown): Pt[] {
  const out: Pt[] = [];
  for (const c of w.creatures) {
    if (c === self || c.done) continue;
    const o = c as { spot?: () => Pt | null; perchPoint?: () => Pt | null };
    const s = o.perchPoint?.() ?? o.spot?.();
    if (s) out.push(s);
  }
  return out;
}

const yamasemi: CreatureDef = {
  kind: 'yamasemi',
  title: 'crested kingfisher (yamasemi)',
  role: 'visitor',
  // rare: the heron's long gaps and longer
  visit: { gap: [1100, 2200], first: [150, 420], stay: [150, 300], group: [1, 1], max: 1, diurnal: true, visitor: true },
  needs: (w) => w.water.moving.length > 0 && yamasemiPerches(w).length > 0,
  spawn(w, s) {
    if (w.water.moving.length === 0) return [];
    const rng = w.rng.fork(`yamasemi:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const b = new Yamasemi(w, rng, (s.stay || 200) * rng.range(0.9, 1.1));
    return b.done ? [] : [b];
  },
  sheet: {
    w: 720,
    h: 170,
    make(res, seed) {
      const a = paintYamasemi(res, seed);
      return [a.body, a.head, a.crest, a.flyBody, a.wing, a.fish, a.splash, a.rings];
    },
  },
  show: { stage: 'falls', spec: { w: 420, h: 265 }, w: 640, h: 404, order: 26 },
};
export default yamasemi;
