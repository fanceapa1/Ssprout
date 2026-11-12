/**
 * The coast's water (G3): the sea from deep ultramarine-teal through turquoise to the pale glassy
 * shallows, its seabed, reflections and light; the pebble beach and its waterline; the rock pools'
 * water. On white, in world units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Coast › Water.
 */
import type { Rng } from '../../core/rng';
import { PAPER_WHITE, blob, bounds, lighten, mix, rgba, ribbon, type DryOptions, type Painter, type Pigment, type WetLayer } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { dryBrushDry, dryBrushInto } from '../oasis/paint-batch';
import { BEACH, HORIZON, POOLS, VILLAGE, WATERLINE_EDGE } from './layout';
import {
  CLIFF_FOOT, CLIFF_REFLECTION, DEPTH, FOAM_LINE, HILL_REFLECTION, REFLECTION_SQUEEZE, SAND_WINDOWS, SEA_RECT, SEABED_ROCKS, SEAGRASS,
  WRACK_LINE, seaward, shoreContour,
} from './sea';

/** The sea's palette: far ultramarine-teal, turquoise, glassy aquamarine; the seabed's darks. */
export const SEA = {
  ultra: '#24508f',
  deep: '#1f5f8e',
  deepTeal: '#1d7891',
  turquoise: '#19a5ad',
  aqua: '#8fd8cc',
  aquaPale: '#c2ece2',
  seagrass: '#2c6457',
  seabed: '#56677a',
  cliff: '#d6cdbd',
  cliffDark: '#1f4560',
  hill: '#8c88a0',
} satisfies Record<string, Pigment>;

/** The beach's shingle and sand, wet to dry, its pebbles, weed and shells. */
export const SAND = {
  wet: '#b9a17e',
  wetDark: '#7f6c56',
  dry: '#ead9b6',
  warm: '#d8bd92',
  pebble: '#a49c92',
  pebbleWarm: '#c2a283',
  pebbleDark: '#6e675f',
  wrack: '#57502f',
  shell: '#efcfbd',
} satisfies Record<string, Pigment>;

const rect = (r: Rect): Pt[] => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];

function trace(p: Painter, shapes: readonly (readonly Pt[])[]): void {
  p.ctx.beginPath();
  for (const shape of shapes) {
    shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.closePath();
  }
}

/** Paper over `shape`, so nothing painted earlier shows through it. */
function fillPaper(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  trace(p, [shape]);
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

/** Clip what follows to `shapes` until `p.ctx.restore()`. */
function clipTo(p: Painter, shapes: readonly (readonly Pt[])[]): void {
  p.ctx.save();
  trace(p, shapes);
  p.ctx.clip();
}

/** A lift's drying: paper laid back over the paint (as `lift`), batched in one layer. */
const LIFT_DRY: DryOptions = { edge: 0.05, sharpness: 0.35, centreLift: 0, granulation: 0, flow: 0.3, blend: 'source-over' };

/** A soft patch: a few nested, wandering blobs laid into one layer, so it dries with a soft edge. */
function patchInto(L: WetLayer, rng: Rng, c: { x: number; y: number; rx: number; ry: number }, pigment: Pigment, alpha: number, n = 5): void {
  for (let k = 0; k < n; k++) {
    const s = 1 - k * 0.14;
    L.fill(blob(c.x + rng.range(-0.15, 0.15) * c.rx, c.y + rng.range(-0.2, 0.2) * c.ry, c.rx * s, c.ry * s, rng, { irregularity: 0.4, points: 22 }), pigment, alpha);
  }
}

/** A thin tapered streak from `a` to `b` bowed by `bow`, half-width `w`. */
function streak(a: Pt, b: Pt, w: number, bow = 0): Pt[] {
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + bow };
  const path: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    path.push({ x: u * u * a.x + 2 * u * t * m.x + t * t * b.x, y: u * u * a.y + 2 * u * t * m.y + t * t * b.y });
  }
  return ribbon(path, (t) => w * Math.sin(Math.PI * Math.min(1, Math.max(0.04, t))) ** 0.7);
}

/** A point along a polyline at fraction `t` of its points. */
function along(path: readonly Pt[], t: number): Pt {
  const f = Math.max(0, Math.min(1, t)) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const k = f - i;
  return { x: path[i]!.x + (path[i + 1]!.x - path[i]!.x) * k, y: path[i]!.y + (path[i + 1]!.y - path[i]!.y) * k };
}

// ── the sea ───────────────────────────────────────────────────────────────────────────────

/**
 * The sea, light to dark: glassy aquamarine everywhere, turquoise past the shallows' edge, the deep
 * from the horizon, the seabed's meadows and rocks with sand between, the cliff and the far hill
 * mirrored, the bright horizon, wind lanes, ripples and a few sparkles.
 */
export function* paintSea(p: Painter, rng: Rng): Strokes {
  const R = SEA_RECT;
  clipTo(p, [rect({ x: R.x - 20, y: HORIZON, w: R.w + 40, h: R.h + 20 })]);
  yield* p.parts.wash(rect({ x: R.x, y: R.y - 40, w: R.w, h: R.h + 40 }), SEA.aqua, {
    rng, opacity: 0.6, layers: 6, deform: 0.01, spread: 0.02, edge: 0.03, centreLift: 0.04, granulation: 0.15, flow: 0.5, flowScale: 140,
  });
  yield;
  // turquoise past the shallows' edge, lost upward into the deep and softly toward the sand
  yield* p.parts.wash(seaward(shoreContour(DEPTH.shallows * 0.6, 0.6, 'glass')), lighten(SEA.turquoise, 0.35), {
    rng, opacity: 0.4, layers: 8, deform: 0.06, spread: 0.3, edge: 0.02, sharpness: 0.08, granulation: 0.15, flow: 0.5, flowScale: 70,
  });
  yield;
  yield* p.parts.wash(seaward(shoreContour(DEPTH.shallows, 0.3, 'shallows')), SEA.turquoise, {
    rng, opacity: 0.8, layers: 10, deform: 0.03, spread: 0.06, edge: 0.12, edgeWidth: 4, sharpness: 0.25, granulation: 0.25, flow: 0.55, flowScale: 90,
  });
  yield;
  yield* p.parts.wetInWet(seaward(shoreContour(DEPTH.turquoise, 0.25, 'turquoise')), SEA.ultra, SEA.deepTeal, {
    rng, angle: Math.PI / 2, split: 0.55, softness: 0.7, fingers: 0.3, opacity: 0.62, layers: 12, deform: 0.03, spread: 0.08, edge: 0.04, sharpness: 0.2,
    granulation: 0.3, granules: 0.06, flow: 0.5, flowScale: 120, fade: { angle: Math.PI / 2, start: 0.45, amount: 1, ragged: 0.2 },
  });
  yield;
  yield* p.parts.glaze(seaward(shoreContour(DEPTH.deep, 0.2, 'deep')), SEA.ultra, {
    rng, opacity: 0.35, deform: 0.06, spread: 0.15, granulation: 0.25, fade: { angle: Math.PI / 2, start: 0.35, amount: 1, ragged: 0.6 },
  });
  yield;
  yield* paintSeabed(p, rng.fork('seabed'));
  yield* paintReflections(p, rng.fork('reflections'));
  yield* paintSurface(p, rng.fork('surface'));
  p.ctx.restore();
}

/** Seagrass meadows and rock under the water, sandy windows between them. */
function* paintSeabed(p: Painter, rng: Rng): Strokes {
  const area = { x: -40, y: 440, w: 860, h: 320 };
  const grass = p.layer(area);
  for (const c of SEAGRASS) patchInto(grass, rng, c, mix(SEA.seagrass, SEA.turquoise, rng.range(0, 0.25)), 0.2);
  grass.flush();
  yield;
  yield* grass.dryParts({ opacity: 0.7, edge: 0.15, edgeWidth: 3, sharpness: 0.25, centreLift: 0.1, granulation: 0.5, granules: 0.15, flow: 0.6, flowScale: 30 });
  yield;
  const rock = p.layer(area);
  for (const c of SEABED_ROCKS) patchInto(rock, rng, c, mix(SEA.seabed, SEA.deepTeal, rng.range(0.1, 0.4)), 0.15);
  rock.flush();
  yield;
  yield* rock.dryParts({ opacity: 0.5, edge: 0.2, edgeWidth: 2.5, sharpness: 0.35, centreLift: 0.15, granulation: 0.7, granules: 0.3, flow: 0.6, flowScale: 20 });
  yield;
  const sand = p.layer(area);
  for (const c of SAND_WINDOWS) patchInto(sand, rng, c, PAPER_WHITE, 0.2, 4);
  sand.flush();
  yield;
  yield* sand.dryParts({ ...LIFT_DRY, opacity: 0.5 });
  yield;
}

/** The pale cliff and the far hill mirrored, the dark water under the cliff, the bright horizon. */
function* paintReflections(p: Painter, rng: Rng): Strokes {
  // the horizon's haze: a pale band lost downward
  const haze = p.layer({ x: SEA_RECT.x, y: HORIZON - 4, w: SEA_RECT.w, h: 34 });
  for (let k = 0; k < 5; k++) haze.fill(rect({ x: SEA_RECT.x, y: HORIZON - 4, w: SEA_RECT.w, h: 5 + k * 5 + rng.range(0, 3) }), PAPER_WHITE, 0.2);
  yield* haze.dryParts({ ...LIFT_DRY, opacity: 0.8 });
  yield;
  // the far hill: its violet-grey squeezed under it, with the village's white walls as flecks
  yield* p.parts.glaze([...HILL_REFLECTION], mix(SEA.hill, SEA.deep, 0.35), { rng, opacity: 0.4, deform: 0.05, spread: 0.12, fade: { angle: Math.PI / 2, start: 0.35, amount: 1, ragged: 0.8 } });
  yield;
  const walls = p.layer({ x: 80, y: HORIZON, w: 320, h: 30 });
  for (const h of VILLAGE) {
    const top = HORIZON + (HORIZON - (h.y + h.h)) * REFLECTION_SQUEEZE * 0.7;
    const len = Math.max(2, h.h * REFLECTION_SQUEEZE * 0.7);
    for (let k = 0; k < 2; k++) walls.fill(rect({ x: h.x + rng.range(0, 3), y: top + k * len * 0.6, w: h.w * rng.range(0.5, 0.8), h: len * 0.45 }), PAPER_WHITE, 0.5);
  }
  yield* walls.dryParts({ ...LIFT_DRY, opacity: 0.55 });
  yield;
  // the cliff: the teal lifted where the pale limestone lies on the water, then its warm grey
  yield* p.parts.lift([...CLIFF_REFLECTION], { rng, amount: 0.5, deform: 0.06, spread: 0.12, layers: 6, fade: { angle: Math.PI / 2, start: 0.5, amount: 0.8, ragged: 0.8 } });
  yield;
  yield* p.parts.glaze([...CLIFF_REFLECTION], mix(SEA.cliff, SEA.turquoise, 0.2), { rng, opacity: 0.45, deform: 0.06, spread: 0.15, fade: { angle: Math.PI / 2, start: 0.45, amount: 1, ragged: 0.8 } });
  yield;
  // the dark water at the cliff's foot, a line lost downward
  const foot = CLIFF_FOOT.map((q) => ({ x: q.x, y: q.y + 1 }));
  yield* p.parts.glaze(ribbon(foot, (t) => 3 + 2.5 * t, () => 2.5), SEA.cliffDark, { rng, opacity: 0.6, layers: 8, deform: 0.08, spread: 0.12, edge: 0.15, sharpness: 0.5 });
  yield;
  // level breaks across both reflections, so they read as water
  const breaks = p.layer({ x: SEA_RECT.x, y: HORIZON, w: SEA_RECT.w, h: 110 });
  for (let i = 0; i < 16; i++) {
    const cliff = i % 2 === 0;
    const x = cliff ? rng.range(640, 900) : rng.range(-20, 500);
    const y = cliff ? rng.range(430, 500) : rng.range(HORIZON + 3, HORIZON + 24);
    const w = rng.range(18, 60);
    breaks.fill(streak({ x: x - w, y }, { x: x + w, y: y + rng.range(-0.5, 0.5) }, rng.range(0.5, 1.1)), PAPER_WHITE, 0.6);
  }
  yield* breaks.dryParts({ ...LIFT_DRY, opacity: 0.5 });
  yield;
}

/**
 * The surface: wind lanes as broken pale streaks in a few uneven bands, short dark ripples in the
 * turquoise, and a few dry-brush sparkles on the lit (left) side.
 */
function* paintSurface(p: Painter, rng: Rng): Strokes {
  const area = { x: SEA_RECT.x, y: HORIZON, w: SEA_RECT.w, h: 360 };
  const lanes = p.layer(area);
  // a few lanes at uneven depths, each broken into streaks longer and thinner far out
  const ys = [HORIZON + 22, HORIZON + 58, HORIZON + 104, HORIZON + 170].map((y) => y + rng.range(-6, 6));
  for (const y0 of ys) {
    const far = 1 - (y0 - HORIZON) / 360;
    let x = rng.range(-60, 120);
    const end = rng.range(560, 900);
    while (x < end) {
      const len = rng.range(30, 110) * (0.6 + far * 0.6);
      const y = y0 + rng.range(-3, 3) + (x - 300) * rng.range(-0.01, 0.02);
      if (rng.chance(0.6)) lanes.fill(streak({ x, y }, { x: x + len, y: y + rng.range(-1, 1) }, rng.range(0.5, 1.2) * (1.4 - far * 0.6), rng.range(-1, 1)), PAPER_WHITE, 0.55);
      x += len + rng.range(8, 70);
    }
  }
  lanes.flush();
  yield;
  yield* lanes.dryParts({ ...LIFT_DRY, opacity: 0.55, flow: 0.4, flowScale: 30 });
  yield;
  const ripples = p.layer(area);
  for (let i = 0; i < 26; i++) {
    const y = HORIZON + 60 + rng.next() ** 0.8 * 260;
    const x = rng.range(-20, 820);
    const near = (y - HORIZON) / 360;
    const len = rng.range(6, 20) * (0.5 + near);
    ripples.fill(streak({ x, y }, { x: x + len, y: y + rng.range(-0.6, 0.6) }, 0.5 + near * 0.7, rng.range(-1.2, 0.4)), mix(SEA.deepTeal, SEA.deep, rng.next()), 0.6);
    if (rng.chance(0.4)) ripples.fill(streak({ x: x + len * 0.3, y: y + 2 + near * 2 }, { x: x + len * 1.1, y: y + 2 + near * 2 }, 0.4 + near * 0.5, 0.6), SEA.deepTeal, 0.45);
  }
  ripples.flush();
  yield;
  yield* ripples.dryParts({ opacity: 0.3, edge: 0.3, edgeWidth: 1, sharpness: 0.6, centreLift: 0.1, granulation: 0.2, flow: 0.3 });
  yield;
  // sparkles where the light comes over the sea from the left
  const glitter = p.layer({ x: 0, y: HORIZON + 30, w: 460, h: 170 });
  for (let i = 0; i < 22; i++) {
    const y = HORIZON + 40 + rng.next() ** 1.2 * 150;
    const x = rng.range(20, 420) + (y - HORIZON) * 0.3;
    const len = rng.range(4, 14) * (0.6 + (y - HORIZON) / 200);
    dryBrushInto(glitter, p, [{ x, y }, { x: x + len, y: y + rng.range(-0.5, 0.5) }], { rng, pigment: PAPER_WHITE, width: rng.range(1.4, 2.6), dryness: 0.75 });
  }
  glitter.flush();
  yield;
  yield* glitter.dryParts(dryBrushDry({ width: 2, opacity: 0.9, blend: 'source-over' }));
  yield;
}

// ── the beach ─────────────────────────────────────────────────────────────────────────────

/** The beach's back, where the rock shelf begins, right to left. */
const BACK: readonly Pt[] = BEACH.slice(WATERLINE_EDGE.length);

/** The beach's back at x (linear between its points). */
function backAt(x: number): number {
  for (let i = 1; i < BACK.length; i++) {
    const a = BACK[i - 1]!;
    const b = BACK[i]!;
    if (b.x <= x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
  }
  return BACK[BACK.length - 1]!.y;
}

/** The beach's sand from the waterline (moved by `dy`) to its back (moved by `under`), past both ends. */
export function beachBody(dy: number, under = 0): Pt[] {
  const end = BACK[BACK.length - 1]!;
  return [
    ...FOAM_LINE.map((q) => ({ x: q.x, y: q.y + dy })),
    { x: 700, y: 818 + dy },
    { x: 700, y: BACK[0]!.y + under },
    ...BACK.map((q) => ({ x: q.x, y: q.y + under })),
    { x: -60, y: end.y + under },
  ];
}

/**
 * The pebble beach: wet dark sand at the water graded to pale dry shingle, the water thinning over
 * it, a broken lacy foam line, scattered pebbles by spatter, the wrack line and a few shells.
 */
export function* paintBeach(p: Painter, rng: Rng): Strokes {
  const box = bounds(beachBody(0, 8));
  fillPaper(p, beachBody(-6));
  yield* p.parts.wetInWet(beachBody(3, 8), SAND.wet, SAND.dry, {
    rng, angle: Math.PI / 2, split: 0.3, softness: 0.5, fingers: 0.6, opacity: 0.6, layers: 10, deform: 0.02, spread: 0.04, edge: 0.08, granulation: 0.65, granules: 0.35, flow: 0.5, flowScale: 50,
  });
  yield;
  yield* p.parts.glaze(beachBody(20, 4), SAND.warm, { rng, opacity: 0.15, deform: 0.2, spread: 0.3, granulation: 0.5, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.8 } });
  yield;
  yield* paintShingle(p, rng.fork('shingle'), box);
  yield* paintWaterline(p, rng.fork('waterline'));
}

/** Shingle by spatter: small stones everywhere, denser up the beach, a few larger ones lit from the left. */
function* paintShingle(p: Painter, rng: Rng, box: Rect): Strokes {
  const inBeach = (x: number, y: number) => {
    const t = (x + 60) / 760;
    const water = along(FOAM_LINE, t).y;
    return y > water + 4 && y < backAt(x) - 2;
  };
  const small = p.layer(box);
  // the shingle lies in drifts: most stones round a few centres, the rest scattered
  const drifts = Array.from({ length: 16 }, () => ({ x: rng.range(-40, 680), y: rng.range(box.y + 10, 860) }));
  for (let i = 0; i < 520; i++) {
    const c = rng.chance(0.65) ? rng.pick(drifts) : null;
    const x = c ? c.x + rng.gaussian(0, 26) : rng.range(-50, 690);
    const y = c ? c.y + rng.gaussian(0, 9) : rng.range(box.y, 856);
    if (!inBeach(x, y)) continue;
    const r = rng.range(0.7, 2.3);
    const pig = rng.pick([SAND.pebble, SAND.pebbleWarm, SAND.pebbleDark, SAND.wet]);
    small.fill(blob(x, y, r * 1.3, r, rng, { points: 7, irregularity: 0.3 }), pig, rng.range(0.35, 0.7));
  }
  small.flush();
  yield;
  yield* small.dryParts({ opacity: 0.6, edge: 0.4, edgeWidth: 0.8, sharpness: 0.7, centreLift: 0.2, granulation: 0.4, flow: 0.4 });
  yield;
  const stones: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-40, 680);
    const y = rng.range(box.y, 856);
    if (inBeach(x, y - 6)) stones.push({ x, y, r: rng.range(2.4, 5.2) * (0.8 + (y - 740) / 300) });
  }
  const body = p.layer(box);
  for (const s of stones) body.fill(blob(s.x, s.y, s.r * 1.35, s.r * 0.8, rng, { points: 10, irregularity: 0.25 }), mix(rng.pick([SAND.pebble, SAND.pebbleWarm, lighten(SAND.pebble, 0.2)]), SAND.dry, 0.1), 0.55);
  yield* body.dryParts({ opacity: 0.6, edge: 0.45, edgeWidth: 1, sharpness: 0.75, centreLift: 0.25, granulation: 0.5, flow: 0.3 });
  yield;
  const dark = p.layer(box);
  for (const s of stones) dark.fill(blob(s.x + s.r * 0.35, s.y + s.r * 0.35, s.r * 1.0, s.r * 0.45, rng, { points: 9, irregularity: 0.3 }), SAND.pebbleDark, 0.5);
  yield* dark.dryParts({ opacity: 0.45, edge: 0.3, edgeWidth: 0.8, sharpness: 0.6, centreLift: 0.1, granulation: 0.3, flow: 0.3 });
  yield;
  // the wrack line: broken dark weed along the last high water, with shells
  const wrack = p.layer({ x: -60, y: 760, w: 720, h: 110 });
  for (let t = rng.range(0, 0.04); t < 1; ) {
    const len = rng.range(0.02, 0.07);
    const a = along(WRACK_LINE, t);
    const b = along(WRACK_LINE, Math.min(1, t + len));
    dryBrushInto(wrack, p, [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + rng.range(-1.5, 1.5) }, b], { rng, pigment: mix(SAND.wrack, SAND.wetDark, rng.next()), width: rng.range(1.6, 3.4), dryness: 0.65 });
    t += len + rng.range(0.01, 0.06);
  }
  for (let i = 0; i < 30; i++) {
    const q = along(WRACK_LINE, rng.next());
    wrack.fill(blob(q.x + rng.range(-8, 8), q.y + rng.range(-4, 4), rng.range(0.6, 1.6), rng.range(0.5, 1.1), rng, { points: 6 }), SAND.wrack, 0.7);
  }
  wrack.flush();
  yield;
  yield* wrack.dryParts(dryBrushDry({ width: 2.5, opacity: 0.75 }));
  yield;
  const shells = p.layer({ x: -60, y: 760, w: 720, h: 110 });
  const lit = p.layer({ x: -60, y: 760, w: 720, h: 110 });
  for (let i = 0; i < 9; i++) {
    const q = along(WRACK_LINE, rng.range(0.05, 0.95));
    const c = { x: q.x + rng.range(-14, 14), y: q.y + rng.range(-5, 10) };
    const s = blob(c.x, c.y, rng.range(1.6, 2.6), rng.range(1.1, 1.7), rng, { points: 9, irregularity: 0.15, rotation: rng.range(-0.6, 0.6) });
    lit.fill(s, PAPER_WHITE, 0.95);
    shells.fill(blob(c.x + 0.6, c.y + 0.6, 1.4, 0.8, rng, { points: 7 }), mix(SAND.shell, SAND.wetDark, 0.35), 0.6);
  }
  yield* lit.dryParts({ ...LIFT_DRY, opacity: 0.9, sharpness: 0.8 });
  yield* shells.dryParts({ opacity: 0.6, edge: 0.3, edgeWidth: 0.6, sharpness: 0.7, granulation: 0.2 });
  yield;
}

/** The waterline: the water thinning over the sand, a wet dark band, the lacy broken foam. */
function* paintWaterline(p: Painter, rng: Rng): Strokes {
  const line = FOAM_LINE;
  const film = ribbon(line, () => 8, () => 2);
  yield* p.parts.glaze(film, SEA.aqua, { rng, opacity: 0.35, layers: 8, deform: 0.1, spread: 0.2, fade: { angle: Math.PI / 2, start: 0.4, amount: 1, ragged: 0.8 } });
  yield;
  const box: Rect = { x: -60, y: 720, w: 760, h: 110 };
  // each wave's reach is a run of shallow scallops; the foam lies along them, not along one line
  const reach = (t: number, lobes: number, depth: number, phase: number) => {
    const q = along(line, t);
    return { x: q.x, y: q.y - depth * Math.abs(Math.sin(t * Math.PI * lobes + phase)) ** 0.6 };
  };
  const wet = p.layer(box);
  for (let t = 0; t < 1; ) {
    const len = rng.range(0.02, 0.08);
    const a = along(line, t);
    const b = along(line, Math.min(1, t + len));
    wet.fill(streak({ x: a.x, y: a.y + rng.range(5, 11) }, { x: b.x, y: b.y + rng.range(5, 11) }, rng.range(1.5, 4), rng.range(-2, 2)), SAND.wetDark, 0.3);
    t += len + rng.range(0.02, 0.09);
  }
  yield* wet.dryParts({ opacity: 0.28, edge: 0.05, edgeWidth: 2, sharpness: 0.15, centreLift: 0.1, granulation: 0.5, flow: 0.5 });
  yield;
  // the foam: the last wave's lace in scallops, an older fainter reach above it, bubbles
  const foam = p.layer(box);
  for (const [lobes, depth, w, gap, a] of [[34, 4, 2.4, 0.02, 1], [22, 11, 1.1, 0.06, 0.6]] as const) {
    const phase = rng.range(0, Math.PI);
    for (let t = rng.range(0, 0.02); t < 1; ) {
      const len = rng.range(0.006, 0.03);
      const q0 = reach(t, lobes, depth, phase);
      const q1 = reach(Math.min(1, t + len), lobes, depth, phase);
      foam.fill(streak(q0, { x: q1.x, y: q1.y + rng.range(-0.6, 0.6) }, w * rng.range(0.4, 1.2), rng.range(-0.8, 0.8)), PAPER_WHITE, a);
      t += len + rng.range(0.001, gap);
    }
  }
  for (let i = 0; i < 240; i++) {
    const t = rng.next();
    const q = reach(t, 34, rng.range(2, 12), 0);
    const r = rng.range(0.4, 1.3);
    foam.fill(blob(q.x + rng.range(-3, 3), q.y + rng.range(-3, 3), r * 1.5, r, rng, { points: 6 }), PAPER_WHITE, 0.85);
  }
  foam.flush();
  yield;
  yield* foam.dryParts({ ...LIFT_DRY, opacity: 0.92, sharpness: 0.7, edgeWidth: 0.6, flow: 0.4, flowScale: 12 });
  yield;
}

// ── the rock pools ────────────────────────────────────────────────────────────────────────

/**
 * The rock pools' still water: clear aquamarine over a hinted bottom, darker in the middle, the far
 * rim's shade and its pale reflection under it, a sky glint. Their stone rims (the rock task) go over the edge.
 */
export function* paintPools(p: Painter, rng: Rng): Strokes {
  for (const [i, pool] of POOLS.entries()) {
    const r = rng.fork(`pool-${i}`);
    const water = blob(pool.cx, pool.cy, pool.rx + 2, pool.ry + 1.5, r, { irregularity: 0.1, points: 30 });
    fillPaper(p, blob(pool.cx, pool.cy, pool.rx - 1, pool.ry - 1, r, { irregularity: 0.08, points: 30 }));
    yield* p.parts.wash(water, SEA.aqua, { rng: r, opacity: 0.7, layers: 8, deform: 0.04, spread: 0.04, edge: 0.55, edgeWidth: 2, sharpness: 0.7, granulation: 0.3 });
    yield;
    clipTo(p, [water]);
    const bed = p.layer({ x: pool.cx - pool.rx - 4, y: pool.cy - pool.ry - 4, w: pool.rx * 2 + 8, h: pool.ry * 2 + 8 });
    for (let k = 0; k < 7; k++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(0.2, 0.8);
      patchInto(bed, r, { x: pool.cx + Math.cos(a) * pool.rx * d, y: pool.cy + Math.sin(a) * pool.ry * d, rx: r.range(3, 8), ry: r.range(1.5, 3) }, r.pick([SEA.seabed, SEA.seagrass, SAND.pebbleWarm]), 0.25, 3);
    }
    yield* bed.dryParts({ opacity: 0.4, edge: 0.3, edgeWidth: 0.8, sharpness: 0.4, centreLift: 0.1, granulation: 0.6, flow: 0.5 });
    yield;
    yield* p.parts.glaze(blob(pool.cx + pool.rx * 0.08, pool.cy + pool.ry * 0.1, pool.rx * 0.62, pool.ry * 0.55, r, { irregularity: 0.2 }), mix(SEA.deepTeal, SEA.turquoise, 0.4), {
      rng: r, opacity: 0.35, layers: 10, deform: 0.25, spread: 0.6, edge: 0, sharpness: 0.05, centreLift: 0, fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.7, ragged: 0.6 },
    });
    yield;
    // the far rim's shade on the water, the rim mirrored pale under it, a glint
    const arc = (inset: number, from: number, to: number): Pt[] =>
      Array.from({ length: 13 }, (_, k) => {
        const a = from + ((to - from) * k) / 12;
        return { x: pool.cx + Math.cos(a) * (pool.rx - inset), y: pool.cy + Math.sin(a) * (pool.ry - inset * 0.4) };
      });
    yield* p.parts.glaze(ribbon(arc(1.5, Math.PI * 1.08, Math.PI * 1.92), (t) => 1.6 * Math.sin(Math.PI * t) + 0.3), SEA.cliffDark, { rng: r, opacity: 0.45, layers: 6, deform: 0.1, spread: 0.15 });
    yield* p.parts.lift(ribbon(arc(4.5, Math.PI * 1.12, Math.PI * 1.85), (t) => 1.8 * Math.sin(Math.PI * t) + 0.2), { rng: r, amount: 0.6, layers: 5, deform: 0.1, spread: 0.15 });
    yield* p.parts.lift({ cx: pool.cx - pool.rx * 0.25, cy: pool.cy + pool.ry * 0.35, rx: pool.rx * 0.28, ry: 0.9 }, { rng: r, amount: 0.7, layers: 4, deform: 0.2, spread: 0.2 });
    p.ctx.restore();
    yield;
  }
}
