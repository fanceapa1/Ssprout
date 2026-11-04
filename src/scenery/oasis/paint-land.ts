/**
 * The oasis's land (O4): the lilac far ranges and golden dunes, the sand and its ripples, the
 * terraces' worked soil, the pisé walls that hold them, the near plots and their bund, the
 * footpath, and the near foreground. Lit from the upper right (ADR 0300), painted on white in
 * world units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Oasis › Land.
 */
import type { Rng } from '../../core/rng';
import { blob, closedResample, createSimplex2D, lighten, mix, resample, ribbon, smoothPath, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { perspectiveScale } from '../../scene/slots';
import { BLUFF, BUNDS, copingAt, DUNE_BASE, DUNE_CRESTS, FAR_RANGE, FOOTPATH, NEAR_PLOTS, OUED, PATH_HALF_WIDTH, SEGUIA_RUNS, WALLS, WET_SAND_HALF_WIDTH, type Wall } from './layout';
import { EARTH } from './paint-rocks';

/** The land's palette: gold sand, worked soil, pisé, and the lilac of the far ranges. */
export const LAND = {
  sand: '#ebcb8b',
  sandLight: '#f4dfb0',
  sandShade: '#c99a72',
  sandWet: '#b08868',
  soil: '#c48a5c',
  soilDamp: '#946650',
  soilDark: '#6e4c3e',
  sprout: '#9fae5c',
  pise: '#d6a072',
  piseLit: '#efc492',
  piseShade: '#a7705a',
  piseDamp: '#7f5a4a',
  lilac: '#b9a8cc',
  lilacDeep: '#9a88b2',
  rose: '#c9a0aa',
  straw: '#d6bf86',
  strawDark: '#a88c56',
  pot: '#c47a4e',
} satisfies Record<string, Pigment>;

const LIGHT = -0.8;
const poly = (pts: readonly Pt[]): Pt[] => pts.map((q) => ({ x: q.x, y: q.y }));

/** A line closed down to `bottom`. */
function belowLine(line: readonly Pt[], bottom: number): Pt[] {
  return [...line, { x: line[line.length - 1]!.x, y: bottom }, { x: line[0]!.x, y: bottom }];
}

/** Height of a polyline at x (linear, clamped at its ends). */
function yAt(line: readonly Pt[], x: number): number {
  if (x <= line[0]!.x) return line[0]!.y;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    if (x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / Math.max(1e-6, b.x - a.x);
  }
  return line[line.length - 1]!.y;
}

/** A soft, hand-drawn outline round a polygon. */
function softOutline(pts: readonly Pt[], rng: Rng, amp = 4): Pt[] {
  const noise = createSimplex2D(rng.fork('outline'));
  return closedResample(poly(pts), 10).map((q) => ({ x: q.x + noise(q.x / 60, q.y / 60) * amp, y: q.y + noise(q.y / 60 + 9, q.x / 60) * amp * 0.6 }));
}

// ── far ───────────────────────────────────────────────────────────────────────────────────

/** The far flat-topped ranges: lilac and rose, low contrast, lost into the haze at their foot. */
export function* paintRanges(p: Painter, rng: Rng): Strokes {
  const range = smoothPath(poly(FAR_RANGE), 10);
  yield* p.parts.wetInWet(belowLine(range, 430), lighten(LAND.lilac, 0.06), mix(LAND.lilac, LAND.rose, 0.45), { rng, angle: Math.PI / 2, split: 0.35, softness: 0.7, opacity: 0.42, deform: 0.03, spread: 0.04, edge: 0.22, edgeWidth: 2, sharpness: 0.55, granulation: 0.2, flow: 0.5, flowScale: 140, fade: { angle: Math.PI / 2, start: 0.3, amount: 0.9, ragged: 0.5 } });
  // the mesas' flat caps catch the light; their gullies a shade deeper
  for (let x = 800; x < 1620; x += rng.range(26, 50)) {
    const y = yAt(range, x);
    p.dryBrush([{ x, y: y + 3 }, { x: x + rng.range(-3, 3), y: y + rng.range(12, 22) }], { rng, pigment: LAND.lilacDeep, width: rng.range(4, 8), opacity: 0.16, dryness: 0.6 });
  }
  yield;
  const near = range.map((q) => ({ x: q.x, y: q.y + 18 + Math.sin(q.x / 90) * 5 }));
  yield* p.parts.glaze(belowLine(near, 430), mix(LAND.lilacDeep, LAND.rose, 0.3), { rng, opacity: 0.22, deform: 0.05, spread: 0.08, edge: 0.15, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.5 } });
}

/** The golden dunes behind the grove: soft crests, their lee (west) flanks in rose shade, faint ripples. */
export function* paintDunes(p: Painter, rng: Rng): Strokes {
  const crest = smoothPath(poly(DUNE_CRESTS), 8);
  yield* p.parts.wetInWet(belowLine(crest, DUNE_BASE), lighten(LAND.sand, 0.1), LAND.sand, { rng, angle: Math.PI / 2, split: 0.4, softness: 0.7, opacity: 0.6, deform: 0.04, spread: 0.05, edge: 0.2, edgeWidth: 2, sharpness: 0.6, granulation: 0.3, granules: 0.1, flow: 0.4, flowScale: 120 });
  for (let i = 1; i < DUNE_CRESTS.length; i++) {
    const c = DUNE_CRESTS[i]!;
    const w = (c.x - DUNE_CRESTS[i - 1]!.x) * 0.65;
    const top: Pt[] = [];
    const low: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const x = c.x - w + (w * k) / 10;
      const y = yAt(crest, x);
      top.push({ x, y: y + 1 });
      low.push({ x: x + 8, y: y + Math.sin((Math.PI * k) / 10) ** 0.7 * 40 + 4 });
    }
    yield* p.parts.wash([...top, ...low.reverse()], mix(LAND.sandShade, LAND.rose, 0.3), { rng, opacity: 0.3, deform: 0.06, spread: 0.08, edge: 0.25, sharpness: 0.6, granulation: 0.4, fade: { angle: Math.PI / 2 + 0.3, start: 0.25, amount: 0.95, ragged: 0.5 } });
  }
  for (let i = 0; i < 18; i++) {
    const x = rng.range(820, 1600);
    const y = yAt(crest, x) + rng.range(16, 50);
    if (y > DUNE_BASE - 16) continue;
    p.dryBrush([{ x: x - 26, y: y + 3 }, { x, y }, { x: x + 30, y: y + 4 }], { rng, pigment: LAND.sandShade, width: 1.4, opacity: 0.22, dryness: 0.5 });
  }
  yield;
}

// ── ground ────────────────────────────────────────────────────────────────────────────────

/** The bank line of the oued: left (outer) and right, upstream first. */
const OUED_LEFT = smoothPath(OUED.slice(0, 8), 6);
const OUED_RIGHT = smoothPath(OUED.slice(8).reverse(), 6);

/** Is a point on open sand (off the plots, the water, the walls' terraces and the bluff)? */
function openSand(q: Pt): boolean {
  if (q.y < 640) return false;
  const inPlot = NEAR_PLOTS.some((pl) => inside(q, pl));
  return !inPlot && !inside(q, OUED);
}

function inside(q: Pt, shape: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[i]!;
    const b = shape[j]!;
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/**
 * The sand everywhere under the far range: gold, warmer and paler round the basin, damp and dark
 * along the oued and the seguia, with soft wind ripples on the open sand.
 */
export function* paintGround(p: Painter, rng: Rng): Strokes {
  const ground: Pt[] = [{ x: -40, y: 400 }, { x: 1640, y: 420 }, { x: 1640, y: 1040 }, { x: -40, y: 1040 }];
  yield* p.parts.wetInWet(ground, mix(LAND.sand, LAND.soil, 0.3), lighten(LAND.sand, 0.04), { rng, angle: Math.PI / 2, split: 0.3, softness: 0.6, opacity: 0.6, deform: 0.02, spread: 0.02, edge: 0, granulation: 0.45, granules: 0.15, flow: 0.55, flowScale: 160 });
  // warm and cool passages across the sand, so it is never one flat tone
  const noise = createSimplex2D(rng.fork('patches'));
  for (let i = 0; i < 9; i++) {
    const cx = 80 + i * 190 + noise(i, 0.3) * 60;
    const cy = 760 + noise(i, 2.1) * 140;
    yield* p.parts.glaze(blob(cx, cy, rng.range(120, 220), rng.range(40, 80), rng, { irregularity: 0.35 }), i % 2 ? mix(LAND.sandShade, LAND.rose, 0.25) : mix(LAND.sand, LAND.soil, 0.4), { rng, opacity: 0.16, deform: 0.4, spread: 0.4, edge: 0.04, granulation: 0.4, flow: 0.6, flowScale: 90 });
  }
  // the basin terrace round the basin: pale, trodden
  yield* p.parts.glaze(blob(820, 690, 380, 60, rng, { irregularity: 0.25 }), LAND.sandLight, { rng, opacity: 0.4, deform: 0.3, spread: 0.3, edge: 0, granulation: 0.3, blend: 'source-over' });
  // damp sand along the seguia's last run, wider toward the viewer
  const run = smoothPath(poly(SEGUIA_RUNS[2]!), 8);
  const wet = ribbon(run, (t) => WET_SAND_HALF_WIDTH.far + (WET_SAND_HALF_WIDTH.near - WET_SAND_HALF_WIDTH.far) * t);
  yield* p.parts.wash(wet, mix(LAND.sandWet, LAND.soilDamp, 0.3), { rng, opacity: 0.32, deform: 0.25, spread: 0.3, edge: 0.04, granulation: 0.5, fade: { angle: Math.PI / 2, start: 0.7, amount: 0.3, ragged: 0.8 } });
  // the oued's banks: a dark damp band hugging each, a lit cut-bank lip beyond it with its shadow
  for (const bank of [OUED_LEFT, OUED_RIGHT]) {
    const damp = ribbon(bank, (t) => 10 + 20 * t, (t) => 6 + 12 * t);
    yield* p.parts.wash(damp, mix(LAND.sandWet, LAND.soilDamp, 0.45), { rng, opacity: 0.45, deform: 0.2, spread: 0.25, edge: 0.15, granulation: 0.5, granules: 0.15 });
    const lip = ribbon(bank, (t) => 2 + 3 * t, (t) => 26 + 30 * t);
    yield* p.parts.wash(lip, mix(LAND.sandShade, EARTH.shade, 0.3), { rng, opacity: 0.35, deform: 0.2, spread: 0.2, edge: 0.3, sharpness: 0.6, granulation: 0.4 });
    p.dryBrush(bank.map((q, i) => ({ x: q.x + (bank === OUED_LEFT ? -1 : 1) * (32 + 30 * (i / bank.length)), y: q.y - 2 })), { rng, pigment: LAND.sandLight, width: 4, opacity: 0.55, dryness: 0.5, blend: 'source-over' });
  }
  yield;
  yield* paintRipples(p, rng.fork('ripples'));
}

/** Wind ripples: sets of sinuous lines, a shaded trough under a lit crest, wider apart near the viewer. */
function* paintRipples(p: Painter, rng: Rng): Strokes {
  const sets = [
    { x: 560, y: 720 }, { x: 990, y: 704 }, { x: 1150, y: 720 }, { x: 80, y: 720 }, { x: 880, y: 860 }, { x: 900, y: 970 },
    { x: 300, y: 690 }, { x: 1180, y: 660 }, { x: 640, y: 1000 }, { x: 1590, y: 980 }, { x: 1600, y: 760 },
  ];
  for (const c of sets) {
    const s = perspectiveScale(c.y);
    const n = rng.int(3, 5);
    for (let i = 0; i < n; i++) {
      const y0 = c.y + (i - n / 2) * 11 * s;
      const w = rng.range(50, 110) * s;
      const x0 = c.x + rng.range(-20, 20) * s - w / 2;
      const line: Pt[] = [];
      for (let k = 0; k <= 8; k++) line.push({ x: x0 + (w * k) / 8, y: y0 + Math.sin(k * 0.9 + i) * 2.4 * s + (k - 4) * 0.6 * s });
      if (!line.every(openSand)) continue;
      p.dryBrush(line.map((q) => ({ x: q.x, y: q.y + 1.6 * s })), { rng, pigment: mix(LAND.sandShade, EARTH.shade, 0.2), width: 3 * s, opacity: 0.36, dryness: 0.4 });
      p.dryBrush(line, { rng, pigment: LAND.sandLight, width: 2.2 * s, opacity: 0.6, dryness: 0.45, blend: 'source-over' });
    }
    yield;
  }
}

/** A terrace's surface between the foot of the wall above (or the bluff) and the coping below. */
function terraceLine(upper: (x: number) => number, lower: Wall, s: number, x: number): number {
  const low = copingAt(lower, Math.min(lower.edge[lower.edge.length - 1]!.x, Math.max(lower.edge[0]!.x, x)))!;
  return upper(x) + (low - upper(x)) * s;
}

/**
 * The terraces under the bluff: worked soil following the walls' curves, furrows along the
 * contours, small cross-bunds between plots, greener where the seguia waters them.
 */
export function* paintTerraces(p: Painter, rng: Rng): Strokes {
  const bluffFoot = (x: number) => Math.min(480, yAt(BLUFF.slice(BLUFF.findIndex((q) => q.y === 478) + 1).reverse(), x) - 6);
  const terraces = [
    { upper: bluffFoot, lower: WALLS[1]!, x1: 470 },
    { upper: (x: number) => copingAt(WALLS[1]!, Math.min(500, Math.max(-20, x)))! + WALLS[1]!.h + 2, lower: WALLS[2]!, x1: 490 },
  ];
  for (const [i, t] of terraces.entries()) {
    const top: Pt[] = [];
    const bottom: Pt[] = [];
    for (let x = -30; x <= t.x1 + 20; x += 20) {
      top.push({ x, y: terraceLine(t.upper, t.lower, 0.02, x) });
      bottom.push({ x, y: terraceLine(t.upper, t.lower, 1, x) + 2 });
    }
    const surface = [...top, ...bottom.reverse()];
    yield* p.parts.wetInWet(surface, mix(LAND.soil, LAND.sand, 0.45), mix(LAND.soil, LAND.soilDamp, 0.3), { rng, angle: Math.PI / 2, split: 0.5, softness: 0.6, opacity: 0.4, deform: 0.08, spread: 0.1, edge: 0.06, granulation: 0.5, granules: 0.15, fade: { angle: 0, start: 0.8, amount: 0.9, ragged: 0.7 } });
    // watered strips: greener toward the seguia's end of each terrace
    yield* p.parts.glaze(blob(300 + i * 60, terraceLine(t.upper, t.lower, 0.55, 300), 150, 12 + i * 4, rng, { irregularity: 0.3 }), mix(LAND.sprout, LAND.soil, 0.25), { rng, opacity: 0.3, deform: 0.35, spread: 0.35, edge: 0.05, granulation: 0.35 });
    // furrows along the contour, and the cross-bunds that split the terrace into plots
    for (let s = 0.22; s < 0.95; s += 0.17 + rng.range(-0.03, 0.03)) {
      for (let x0 = -20; x0 < t.x1; ) {
        const len = rng.range(70, 160);
        const line: Pt[] = [];
        for (let x = x0; x <= Math.min(t.x1, x0 + len); x += 12) line.push({ x, y: terraceLine(t.upper, t.lower, s, x) + Math.sin(x / 40 + s * 7) * 1.6 });
        if (line.length > 1) p.dryBrush(line, { rng, pigment: LAND.soilDamp, width: 1.6 + i * 0.4, opacity: 0.22, dryness: 0.65 });
        x0 += len + rng.range(14, 34);
      }
    }
    for (let x = 40 + rng.range(0, 40); x < t.x1 - 30; x += rng.range(110, 170)) {
      const a = { x, y: terraceLine(t.upper, t.lower, 0.1, x) };
      const b = { x: x - 6, y: terraceLine(t.upper, t.lower, 0.95, x - 6) };
      p.stroke([a, b], { rng, pigment: mix(LAND.soilDamp, EARTH.shade, 0.3), width: 3, opacity: 0.16, wetness: 0.4, taper: [0.3, 0.3] });
      p.dryBrush([{ x: a.x + 2, y: a.y }, { x: b.x + 2, y: b.y }], { rng, pigment: LAND.piseLit, width: 2, opacity: 0.45, dryness: 0.5, blend: 'source-over' });
    }
    yield;
  }
}

/** Soft furrows over a plot toward a vanishing point on the horizon, and rows of seedlings in some. */
export function* paintPlots(p: Painter, rng: Rng): Strokes {
  const vp = { x: 820, y: 360 };
  for (const [i, plot] of NEAR_PLOTS.entries()) {
    const shape = softOutline(plot, rng.fork(`plot-${i}`), 14);
    const ys = plot.map((q) => q.y);
    const xs = plot.map((q) => q.x);
    const [y0, y1, x0, x1] = [Math.min(...ys), Math.max(...ys), Math.min(...xs), Math.max(...xs)];
    yield* p.parts.wetInWet(shape, mix(LAND.soil, LAND.sand, 0.45), mix(LAND.soil, LAND.soilDamp, 0.3), { rng, angle: Math.PI / 2, split: 0.45, softness: 0.7, opacity: 0.3, deform: 0.3, spread: 0.3, edge: 0.02, edgeWidth: 6, granulation: 0.55, granules: 0.2, fade: { angle: Math.PI / 2, start: 0.55, amount: 0.7, ragged: 0.9 } });
    // greener where the seguia waters it (the plots beside it)
    const wetSide = i === 2 ? { x: x1 - 60, y: (y0 + y1) / 2 } : i === 0 ? { x: x1 - 70, y: y0 + 90 } : { x: x0 + 90, y: y0 + 80 };
    yield* p.parts.glaze(blob(wetSide.x, wetSide.y, 110, 60, rng, { irregularity: 0.35 }), mix(LAND.sprout, LAND.soil, 0.3), { rng, opacity: 0.26, deform: 0.4, spread: 0.4, edge: 0.04, granulation: 0.35 });
    const clip = () => {
      p.ctx.save();
      p.ctx.beginPath();
      shape.forEach((q, k) => (k ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
      p.ctx.closePath();
      p.ctx.clip();
    };
    clip();
    // furrows run away from the viewer: lines toward the vanishing point, spaced by perspective
    const seedlings = i !== 1;
    for (let x = x0 - 120, n = 0; x < x1 + 120; x += 22, n++) {
      if (n > 0) {
        p.ctx.restore();
        yield;
        clip();
      }
      const foot = { x, y: y1 + 20 };
      const dir = { x: vp.x - foot.x, y: vp.y - foot.y };
      const len = (y1 - y0 + 40) / -dir.y;
      const line: Pt[] = [];
      for (let k = 0; k <= 6; k++) line.push({ x: foot.x + dir.x * len * (k / 6) + Math.sin(k + x) * 1.2, y: foot.y + dir.y * len * (k / 6) });
      p.dryBrush(line, { rng, pigment: LAND.soilDamp, width: 3.2, taper: [0.4, 0], opacity: 0.2, dryness: 0.65 });
      p.dryBrush(line.map((q) => ({ x: q.x + 4, y: q.y })), { rng, pigment: LAND.sandLight, width: 2, opacity: 0.35, dryness: 0.6, blend: 'source-over' });
      if (seedlings && rng.chance(0.55)) {
        for (let k = 1; k <= 6; k++) {
          const q = line[k]!;
          const s = perspectiveScale(q.y);
          if (rng.chance(0.35)) continue;
          p.dab({ x: q.x + 2 * s, y: q.y }, mix(LAND.sprout, '#7f9268', rng.range(0, 0.6)), { rng, variant: 'blade', angle: -Math.PI / 2 + rng.range(-0.5, 0.5), length: 7 * s, width: 2.2 * s, opacity: 0.55, layers: 2 });
        }
      }
    }
    p.ctx.restore();
    yield;
  }
}

/** The footpath: a pale, trodden band with scuffed edges and footprints, wider toward the viewer. */
export function* paintFootpath(p: Painter, rng: Rng): Strokes {
  const walk = smoothPath(poly(FOOTPATH).reverse(), 6);
  const half = (t: number) => PATH_HALF_WIDTH.far + (PATH_HALF_WIDTH.near - PATH_HALF_WIDTH.far) * t;
  const band = ribbon(walk, half);
  yield* p.parts.lift(band, { rng, amount: 0.2, deform: 0.35, spread: 0.4, layers: 6, edge: 0 });
  yield* p.parts.glaze(band, LAND.sandLight, { rng, opacity: 0.45, deform: 0.3, spread: 0.35, edge: 0, granulation: 0.25, blend: 'source-over', fade: { angle: -Math.PI / 2, start: 0.6, amount: 0.6, ragged: 0.8 } });
  for (const side of [-1, 1]) {
    const edge = walk.map((q, i) => ({ x: q.x + side * half(i / (walk.length - 1)) * 0.95, y: q.y }));
    p.dryBrush(edge, { rng, pigment: mix(LAND.sandShade, EARTH.shade, 0.25), width: 5, opacity: 0.28, dryness: 0.65 });
  }
  yield;
  // footprints: two walkers' worth, alternating feet, smaller toward the basin
  for (const lane of [-0.35, 0.3]) {
    let foot = 0;
    for (let t = 0.04; t < 0.98; ) {
      const k = Math.min(walk.length - 1, Math.round(t * (walk.length - 1)));
      const q = walk[k]!;
      const s = perspectiveScale(q.y);
      foot++;
      const x = q.x + half(t) * lane + (foot % 2 ? -1 : 1) * 4 * s;
      if (rng.chance(0.4)) {
        const print = blob(x, q.y, 3.4 * s, 2 * s, rng, { irregularity: 0.2, points: 10 });
        p.wash(print, mix(LAND.sandShade, EARTH.shade, 0.3), { rng, opacity: 0.2 * rng.range(0.5, 1), layers: 3, deform: 0.1, edge: 0.4, sharpness: 0.5 });
        p.dryBrush([{ x: x - 2 * s, y: q.y - 1.6 * s }, { x: x + 2 * s, y: q.y - 1.8 * s }], { rng, pigment: LAND.sandLight, width: 1.2 * s, opacity: 0.6, blend: 'source-over' });
      }
      t += (rng.range(11, 17) * s) / 330;
    }
    yield;
  }
  for (const [x, y, w] of [[792, 980, 26], [874, 900, 14], [880, 724, 10]] as const) {
    yield* p.parts.stone({ x, y, w, h: w * 0.5 }, { rng, pigment: mix('#c9ae8a', EARTH.lit, 0.3), warm: 0.6, moss: 0, ink: 0.1, light: LIGHT });
  }
}

// ── walls ─────────────────────────────────────────────────────────────────────────────────

/** A wall's coping line, extended past its ends by `ext` (so it tucks under the basin or the margins). */
function copingLine(w: Wall, ext: readonly [number, number]): Pt[] {
  const e = poly(w.edge);
  const a = e[0]!;
  const b = e[1]!;
  const y = e[e.length - 1]!;
  const z = e[e.length - 2]!;
  const pre = { x: a.x - ext[0], y: a.y - ((b.y - a.y) / (b.x - a.x)) * ext[0] };
  const post = { x: y.x + ext[1], y: y.y + ((y.y - z.y) / (y.x - z.x)) * ext[1] };
  return resample(smoothPath([...(ext[0] > 0 ? [pre] : []), ...e, ...(ext[1] > 0 ? [post] : [])], 8), 6);
}

/** The pisé walls' faces, for daylight (O5): each a closed outline, coping first. */
export const WALL_FACES: readonly Pt[][] = WALLS.map((w, i) => {
  const top = copingLine(w, i === 0 ? [44, 0] : [0, 18]);
  return [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + w.h }))];
});

/**
 * The pisé terrace walls: warm rammed earth following the contour, its formwork courses, a lit,
 * crumbled cap with notches and fallen lumps, a dark damp foot and the shade it casts below.
 */
export function* paintWalls(p: Painter, rng: Rng): Strokes {
  for (const [i, w] of WALLS.entries()) {
    const r = rng.fork(`wall-${i}`);
    const noise = createSimplex2D(r.fork('crumble'));
    const top = copingLine(w, i === 0 ? [44, 0] : [0, 18]).map((q) => ({ x: q.x, y: q.y + Math.max(0, noise(q.x / 30, i) * 2.4) }));
    const h = (q: Pt) => w.h * (1 + 0.06 * noise(q.x / 80, 5 + i));
    const foot = top.map((q) => ({ x: q.x, y: q.y + h(q) }));
    const face = [...top, ...foot.slice().reverse()];
    // the shade cast on the terrace below, soft and lost downward
    yield* p.parts.glaze([...foot, ...foot.slice().reverse().map((q) => ({ x: q.x - 6, y: q.y + 12 + w.h * 0.25 }))], mix(EARTH.shade, LAND.soilDamp, 0.4), { rng: r, opacity: 0.32, deform: 0.15, spread: 0.2, edge: 0.04, fade: { angle: Math.PI / 2, start: 0.25, amount: 1, ragged: 0.6 } });
    yield* p.parts.wetInWet(face, mix(LAND.pise, LAND.piseLit, 0.35), mix(LAND.pise, LAND.piseShade, 0.5), { rng: r, angle: Math.PI / 2, split: 0.5, softness: 0.6, opacity: 0.72, deform: 0.03, spread: 0.03, edge: 0.25, edgeWidth: 1.5, sharpness: 0.7, granulation: 0.55, granules: 0.2, flow: 0.4, flowScale: 30 });
    // the damp foot, where the seguia's water seeps
    const damp = [...foot.map((q) => ({ x: q.x, y: q.y - h(q) * 0.38 })), ...foot.slice().reverse()];
    yield* p.parts.glaze(damp, mix(LAND.piseDamp, LAND.soilDamp, 0.4), { rng: r, opacity: 0.4, deform: 0.15, spread: 0.2, edge: 0.06, granulation: 0.5, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.8 } });
    // formwork courses: faint lines along the curve, and a few rain streaks and cracks
    for (const f of [0.36, 0.68]) {
      for (let k = 0; k < top.length - 1; ) {
        const len = r.int(6, 16);
        const seg = top.slice(k, k + len).map((q) => ({ x: q.x, y: q.y + h(q) * f + r.range(-0.5, 0.5) }));
        if (seg.length > 1) p.dryBrush(seg, { rng: r, pigment: LAND.piseShade, width: 1.5, opacity: 0.32, dryness: 0.6 });
        k += len + r.int(1, 5);
      }
    }
    for (let k = 0; k < Math.round(top.length / 6); k++) {
      const q = top[r.int(0, top.length - 1)]!;
      p.dryBrush([{ x: q.x, y: q.y + 3 }, { x: q.x + r.range(-2, 2), y: q.y + h(q) * r.range(0.4, 0.9) }], { rng: r, pigment: LAND.piseShade, width: r.range(1.4, 2.6), opacity: 0.3, dryness: 0.6 });
    }
    yield;
    // the crumbled cap: a lit lip broken by notches, a shade line under it, lumps fallen at the foot
    for (let k = 0; k < top.length - 1; ) {
      const len = r.int(4, 12);
      const seg = top.slice(k, k + len).map((q) => ({ x: q.x, y: q.y + 1.2 }));
      if (seg.length > 1) {
        p.stroke(seg, { rng: r, pigment: LAND.piseLit, width: 3.4, opacity: 0.75, wetness: 0.2, dryness: 0.35, taper: [0.1, 0.1], blend: 'source-over' });
        p.dryBrush(seg.map((q) => ({ x: q.x, y: q.y + 3.5 })), { rng: r, pigment: LAND.piseShade, width: 1.8, opacity: 0.35, dryness: 0.5 });
      }
      k += len + r.int(1, 3);
    }
    for (let k = 0; k < 5; k++) {
      const q = foot[r.int(2, foot.length - 3)]!;
      p.dab({ x: q.x + r.range(-6, 6), y: q.y + r.range(1, 5) }, mix(LAND.pise, LAND.piseShade, 0.4), { rng: r, variant: 'round', length: r.range(4, 9), width: r.range(3, 6), opacity: 0.6, layers: 2 });
    }
    yield;
  }
}

// ── the near foreground ───────────────────────────────────────────────────────────────────

/** Where the bund meets the seguia: a small stone-lined channel letting water into the left plot. */
const CULVERT = { from: { x: 372, y: 794 }, to: { x: 324, y: 808 } };

/** Pale dry grass (halfa): tufts along the bund, the plots' edges and the sheet's bottom. */
const TUFTS: readonly [number, number, number][] = [
  [30, 770, 46], [236, 764, 34], [470, 802, 30], [700, 790, 32], [1000, 768, 30], [1180, 772, 36],
  [60, 960, 70], [270, 1000, 60], [610, 1004, 52], [1010, 1006, 56], [1236, 690, 30], [990, 660, 24], [560, 668, 22],
];

/**
 * The near ground's structure: the low bund curving across (a lit earth ridge with its shade),
 * the stone channel at the seguia, dry grass tufts, a broken water jar and a few stones.
 */
export function* paintForeground(p: Painter, rng: Rng): Strokes {
  for (const b of BUNDS) {
    const line = smoothPath(poly(b), 6).map((q, i, all) => ({ x: q.x, y: q.y + Math.sin((Math.PI * i) / (all.length - 1)) * 4 }));
    const s = (q: Pt) => perspectiveScale(q.y);
    const body = ribbon(line, (_, i) => 9 * s(line[i]!), (_, i) => 1 * s(line[i]!));
    yield* p.parts.wash(body, mix(LAND.soil, LAND.sand, 0.3), { rng, opacity: 0.32, deform: 0.3, spread: 0.3, edge: 0.06, granulation: 0.5, fade: { angle: 0, start: 0.85, amount: 0.7, ragged: 0.8 } });
    p.dryBrush(line.map((q) => ({ x: q.x, y: q.y + 7 * s(q) })), { rng, pigment: mix(LAND.soilDamp, EARTH.shade, 0.35), width: 6, opacity: 0.22, dryness: 0.5 });
    p.dryBrush(line.map((q) => ({ x: q.x, y: q.y - 3 * s(q) })), { rng, pigment: LAND.piseLit, width: 5, opacity: 0.55, dryness: 0.55, blend: 'source-over' });
  }
  yield;
  // the stone channel: a wet clay cut with flat stones either side
  const cut = [CULVERT.from, { x: (CULVERT.from.x + CULVERT.to.x) / 2, y: CULVERT.from.y + 6 }, CULVERT.to];
  yield* p.parts.wash(ribbon(cut, () => 6), mix(LAND.soilDamp, '#5f7d6e', 0.25), { rng, opacity: 0.55, deform: 0.1, spread: 0.1, edge: 0.3, sharpness: 0.6 });
  for (const [k, side] of [[0, -1], [0.5, -1], [1, -1], [0, 1], [0.5, 1], [1, 1]] as const) {
    const q = { x: CULVERT.from.x + (CULVERT.to.x - CULVERT.from.x) * k, y: CULVERT.from.y + (CULVERT.to.y - CULVERT.from.y) * k + side * 9 + (k === 0.5 ? 6 : 0) };
    yield* p.parts.stone({ x: q.x, y: q.y, w: rng.range(14, 20), h: rng.range(7, 10) }, { rng, pigment: mix('#c9ae8a', '#a79a90', 0.4), warm: 0.5, moss: 0, ink: 0.15, light: LIGHT });
  }
  // earth fallen from the middle wall's end into the basin's near-left corner
  yield* p.parts.wash([{ x: 486, y: 612 }, { x: 510, y: 610 }, { x: 518, y: 646 }, { x: 512, y: 666 }, { x: 480, y: 664 }, { x: 474, y: 636 }], mix(LAND.pise, LAND.soil, 0.4), { rng, opacity: 0.6, deform: 0.15, spread: 0.2, edge: 0.15, granulation: 0.5 });
  for (const [x, y, w] of [[500, 652, 12], [488, 640, 9], [509, 628, 8]] as const) yield* p.parts.stone({ x, y, w, h: w * 0.6 }, { rng, pigment: mix(LAND.pise, '#c9ae8a', 0.5), warm: 0.6, moss: 0, ink: 0.1, light: LIGHT });
  yield* paintJar(p, rng.fork('jar'), { x: 655, y: 900 });
  for (const [x, y, w] of [[40, 1000, 64], [1160, 1004, 46], [470, 680, 22], [1000, 990, 22], [1230, 740, 18]] as const) {
    yield* p.parts.stone({ x, y, w, h: w * 0.52 }, { rng, pigment: mix('#c9ae8a', EARTH.lit, 0.3), warm: 0.6, moss: 0, ink: 0.12, light: LIGHT });
  }
  for (const [x, y, h] of TUFTS) {
    p.grassTuft({ x, y }, { rng, height: h, blades: rng.int(9, 15), spread: h * 0.7, lean: rng.range(-0.2, 0.25), pigments: [lighten(LAND.straw, 0.08), LAND.straw, LAND.strawDark, mix(LAND.strawDark, '#7f9268', 0.4)], ground: false, opacity: 0.72 });
    yield;
  }
}

/** A broken water jar on its side: its belly lit on the right, a dark mouth, a broken lip and shards. */
function* paintJar(p: Painter, rng: Rng, at: Pt): Strokes {
  const s = perspectiveScale(at.y);
  const body = blob(at.x, at.y, 19 * s, 12 * s, rng, { irregularity: 0.06, points: 20 });
  yield* p.parts.glaze(blob(at.x - 10 * s, at.y + 9 * s, 26 * s, 5 * s, rng), mix(EARTH.shade, LAND.soilDamp, 0.4), { rng, opacity: 0.35, deform: 0.2, edge: 0.05 });
  yield* p.parts.wetInWet(body, lighten(LAND.pot, 0.15), mix(LAND.pot, EARTH.deep, 0.45), { rng, angle: Math.PI - 0.6, split: 0.5, opacity: 0.8, deform: 0.02, spread: 0.02, edge: 0.35, sharpness: 0.8, granulation: 0.35 });
  // the broken mouth on the left, and a jagged break on its upper side
  const mouth = blob(at.x - 15 * s, at.y - 1 * s, 5 * s, 8 * s, rng, { irregularity: 0.2, points: 12 });
  p.wash(mouth, mix(EARTH.dark, LAND.soilDark, 0.4), { rng, opacity: 0.75, layers: 4, edge: 0.3, sharpness: 0.7 });
  const brk: Pt[] = [{ x: at.x - 4 * s, y: at.y - 11 * s }, { x: at.x + 2 * s, y: at.y - 6 * s }, { x: at.x + 6 * s, y: at.y - 9 * s }, { x: at.x + 9 * s, y: at.y - 4 * s }, { x: at.x + 12 * s, y: at.y - 9 * s }, { x: at.x + 6 * s, y: at.y - 13 * s }];
  p.wash(brk, mix(EARTH.deep, EARTH.dark, 0.3), { rng, opacity: 0.6, layers: 3, edge: 0.4, sharpness: 0.8 });
  p.dryBrush([{ x: at.x + 6 * s, y: at.y - 8 * s }, { x: at.x + 15 * s, y: at.y }], { rng, pigment: EARTH.lit, width: 2.4 * s, opacity: 0.7, blend: 'source-over' });
  for (const [dx, dy, r] of [[24, 6, 5], [30, -2, 3.5], [-26, 8, 4]] as const) {
    p.wash(blob(at.x + dx * s, at.y + dy * s, r * s, r * 0.55 * s, rng, { irregularity: 0.4, points: 7 }), mix(LAND.pot, EARTH.deep, 0.25), { rng, opacity: 0.7, layers: 3, edge: 0.4, sharpness: 0.8 });
  }
  yield;
}
