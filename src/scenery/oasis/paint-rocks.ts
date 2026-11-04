/**
 * The oasis's rock (O2): the red-ochre bluff of conglomerate and sandstone, and the ksar of pisé
 * growing out of it in the same golden-red earth. Lit from the upper right (ADR 0300), painted on
 * white in world units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Oasis › Rock.
 */
import type { Rng } from '../../core/rng';
import { PAPER_WHITE, bounds, closedResample, createSimplex2D, lighten, mix, rgba, shade, smoothPath, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { FOOTING, KSAR_PALMS, KSAR_SHAPES, windows, type BlockShape } from './ksar';
import { BLUFF } from './layout';

/** The earth both are made of: golden where the sun strikes, red-ochre in the body, deep in the cuts. */
export const EARTH = {
  lit: '#efc18a',
  gold: '#dca06a',
  body: '#c8784e',
  deep: '#94503e',
  // violet-rose shade on the faces turned from the sun
  shade: '#9e7183',
  cool: '#8c89a1',
  dark: '#5a3a36',
  sand: '#ebcb8b',
} satisfies Record<string, Pigment>;
/** The bluff's painted tone just under the ksar, for the solid seat over the walls' feet. */
const SEAT: Pigment = '#d49d78';
const PEBBLES: readonly Pigment[] = ['#b98a6a', '#d9b48c', '#8f5a48', '#c9a080', '#a79a90', '#e0c39c', '#7d5446'];

/** The shapes daylight (O5) shades and lights: the bluff and each block's front and flank. */
export const ROCK_SHAPES = { bluff: BLUFF, ksar: KSAR_SHAPES } as const;

function trace(p: Painter, shape: readonly Pt[]): void {
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
}

/** Paper over `shape`, so nothing painted earlier shows through it. */
function fillPaper(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  trace(p, shape);
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

function clipTo(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  trace(p, shape);
  p.ctx.clip();
}

/** A hand-cut outline: resampled and nudged by noise (washes would smooth the shape's steps). */
export function roughOutline(poly: readonly Pt[], rng: Rng, amp = 1.6, spacing = 4): Pt[] {
  const noise = createSimplex2D(rng.fork('rough'));
  return closedResample(poly, spacing).map((q) => ({ x: q.x + noise(q.x / 14, q.y / 14) * amp, y: q.y + noise(q.y / 14 + 40, q.x / 14) * amp }));
}

function box(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

/** The bluff's top edge at x (its highest crossing). */
export function bluffTopAt(x: number): number {
  let best = Infinity;
  for (let i = 0; i < BLUFF.length; i++) {
    const a = BLUFF[i]!;
    const b = BLUFF[(i + 1) % BLUFF.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    best = Math.min(best, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  }
  return best;
}

/** The bluff's foot at x (its lowest crossing). */
function bluffFootAt(x: number): number {
  let best = -Infinity;
  for (let i = 0; i < BLUFF.length; i++) {
    const a = BLUFF[i]!;
    const b = BLUFF[(i + 1) % BLUFF.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    best = Math.max(best, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  }
  return best;
}

/** The shoulder's right edge at y (for the runnels and strata that wrap round it). */
const SHOULDER = BLUFF.filter((q, i) => i >= BLUFF.findIndex((r) => r.x === 900) && i <= BLUFF.findIndex((r) => r.x === 1022));
function shoulderAt(y: number): number {
  for (let i = 1; i < SHOULDER.length; i++) {
    const a = SHOULDER[i - 1]!;
    const b = SHOULDER[i]!;
    if (y <= b.y && y >= a.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
  }
  return y < SHOULDER[0]!.y ? SHOULDER[0]!.x : SHOULDER[SHOULDER.length - 1]!.x;
}

// ── the bluff ───────────────────────────────────────────────────────────────────────────────

/**
 * The bluff: a body wash cool-rose on the left and golden on the right, the rounded forms modelled
 * with glazes, sandstone beds that wrap round the shoulder, conglomerate bands of pebbles, vertical
 * erosion runnels from the rim with talus fans at their feet, and a warm lit rim on the shoulder.
 */
export function* paintBluff(p: Painter, rng: Rng): Strokes {
  const body = roughOutline(BLUFF, rng, 1.8);
  const b = bounds(body);
  fillPaper(p, body);
  clipTo(p, body);
  yield;
  yield* p.parts.wetInWet(box(b.x - 20, b.y - 20, b.x + b.w + 20, b.y + b.h + 20), mix(EARTH.body, EARTH.shade, 0.45), mix(EARTH.gold, EARTH.body, 0.35), {
    rng, angle: -0.25, split: 0.55, softness: 0.65, opacity: 0.8, deform: 0.04, spread: 0.03, edge: 0, granulation: 0.5, granules: 0.25, flow: 0.5, flowScale: 120,
    drops: [{ pigment: EARTH.deep, at: { x: 640, y: 420 }, size: 0.25, alpha: 0.3 }, { pigment: EARTH.gold, at: { x: 960, y: 380 }, size: 0.2, alpha: 0.4 }],
  });
  yield;
  // the left ridge: its rounded crown lit on the right, the face under it turned away in rose shade
  yield* p.parts.glaze({ cx: 70, cy: 330, rx: 170, ry: 130 }, EARTH.shade, { rng, opacity: 0.38, deform: 0.2, spread: 0.3, fade: { angle: 0, start: 0.35, amount: 1, ragged: 0.6 } });
  yield;
  yield* p.parts.glaze([{ x: 120, y: 214 }, { x: 206, y: 228 }, { x: 262, y: 266 }, { x: 330, y: 290 }, { x: 300, y: 330 }, { x: 200, y: 290 }, { x: 130, y: 250 }], EARTH.lit, { rng, opacity: 0.5, deform: 0.15, spread: 0.2, fade: { angle: Math.PI * 0.75, start: 0.3, amount: 1, ragged: 0.7 } });
  yield;
  // the shoulder: a lit band turned to the sun, a soft core shadow further in, then the body
  const rim: Pt[] = [];
  const core: Pt[] = [];
  for (let y = 318; y <= 480; y += 8) {
    const x = shoulderAt(y);
    rim.push({ x: x + 6, y });
    core.push({ x: x - 50 - (y - 318) * 0.12, y });
  }
  const litBand = [...rim, ...rim.slice().reverse().map((q) => ({ x: q.x - 44, y: q.y }))];
  yield* p.parts.glaze(litBand, EARTH.lit, { rng, opacity: 0.55, deform: 0.12, spread: 0.15, fade: { angle: Math.PI, start: 0.35, amount: 1, ragged: 0.6 } });
  yield;
  const coreBand = [...core.map((q) => ({ x: q.x + 18, y: q.y })), ...core.slice().reverse().map((q) => ({ x: q.x - 40, y: q.y }))];
  yield* p.parts.glaze(coreBand, mix(EARTH.shade, EARTH.deep, 0.3), { rng, opacity: 0.3, deform: 0.2, spread: 0.3, fade: { angle: Math.PI, start: 0.3, amount: 1, ragged: 0.7 } });
  yield;
  yield* paintBeds(p, rng.fork('beds'));
  yield* paintConglomerate(p, rng.fork('pebbles'));
  yield* paintRunnels(p, rng.fork('runnels'));
  // warm light bounced up from the sand along the foot, the shade gathering under the rim
  yield* p.parts.glaze(box(-20, 420, 1030, 486), mix(EARTH.sand, EARTH.gold, 0.4), { rng, opacity: 0.3, deform: 0.2, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.6 } });
  yield;
  p.ctx.restore();
  // the lit rim along the skyline where the rock turns to the sun
  const lip = closedResample(BLUFF, 3).filter((q) => q.y <= bluffTopAt(q.x) + 0.5 && (q.x > 120 && q.x < 330 || q.x > 896));
  for (let i = 0; i < lip.length; ) {
    const run: Pt[] = [];
    while (i < lip.length && run.length < 14) {
      const q = lip[i++]!;
      if (run.length && Math.hypot(q.x - run[run.length - 1]!.x, q.y - run[run.length - 1]!.y) > 8) break;
      run.push({ x: q.x - 1.5, y: q.y + 2 });
    }
    if (run.length > 2) p.dryBrush(run, { rng, pigment: lighten(EARTH.lit, 0.1), width: 3.5, opacity: 0.55, dryness: 0.45, blend: 'source-over' });
  }
  yield;
  // talus fans spilling from the runnels onto the terrace
  for (let x = 20; x < 1010; x += rng.range(70, 130)) {
    const y = bluffFootAt(x);
    if (!Number.isFinite(y)) continue;
    const w = rng.range(30, 60);
    p.wash([{ x: x - 6, y: y - 28 }, { x: x + 6, y: y - 28 }, { x: x + w, y: y + 6 }, { x: x - w, y: y + 6 }], mix(EARTH.body, EARTH.sand, 0.55), { rng, opacity: 0.4, deform: 0.3, spread: 0.3, edge: 0.05, granulation: 0.7, granules: 0.3, fade: { angle: -Math.PI / 2, start: 0.3, amount: 0.9, ragged: 0.8 } });
    yield;
  }
}

/** Sandstone beds: broken ledges, a lit lip over a dark undercut, bending down round the shoulder. */
function* paintBeds(p: Painter, rng: Rng): Strokes {
  for (let k = 0; k < 9; k++) {
    const y0 = 238 + k * 26 + rng.range(-6, 6);
    for (let x = -20; x < 1030; ) {
      const len = rng.range(50, 170);
      const pts: Pt[] = [];
      for (let t = 0; t <= 1.001; t += 0.125) {
        const xx = x + len * t;
        // round the shoulder the beds dip toward the foot, as they wrap a rounded mass
        const wrap = xx > 860 ? ((xx - 860) / 160) ** 2 * 60 : 0;
        pts.push({ x: xx, y: y0 + wrap + Math.sin(xx / 90 + k) * 3 });
      }
      const top = bluffTopAt(x + len / 2);
      if (pts[0]!.y > top + 6 && pts[0]!.y < bluffFootAt(x + len / 2) - 10) {
        p.dryBrush(pts.map((q) => ({ x: q.x, y: q.y + 3 })), { rng, pigment: mix(EARTH.deep, EARTH.shade, 0.3), width: rng.range(3, 6), opacity: 0.4, dryness: 0.55 });
        p.dryBrush(pts, { rng, pigment: EARTH.lit, width: rng.range(2, 3.5), opacity: x > 600 ? 0.5 : 0.3, dryness: 0.6, blend: 'source-over' });
      }
      x += len + rng.range(20, 80);
    }
    yield;
  }
}

/**
 * Two conglomerate beds: lenses of rounded pebbles set in the red matrix, packed in the lens and
 * sparse at its ends, close in tone to the rock, each pebble with a soft shade under it.
 */
function* paintConglomerate(p: Painter, rng: Rng): Strokes {
  for (const [y0, depth] of [[352, 26], [410, 20]] as const) {
    for (let cx = rng.range(-20, 60); cx < 1020; cx += rng.range(110, 220)) {
      const half = rng.range(40, 90);
      const wrap = (x: number) => (x > 860 ? ((x - 860) / 160) ** 2 * 60 : 0);
      const cy = y0 + rng.range(-8, 8);
      p.glaze({ cx, cy: cy + wrap(cx), rx: half * 1.1, ry: depth * 0.6 }, mix(EARTH.deep, EARTH.body, 0.4), { rng, opacity: 0.18, deform: 0.4, spread: 0.4, edge: 0.05 });
      const n = Math.round(half * 0.55);
      for (let i = 0; i < n; i++) {
        const u = rng.gaussian() * 0.45;
        const x = cx + u * half;
        const y = cy + rng.gaussian() * depth * 0.28 + wrap(x);
        if (y < bluffTopAt(x) + 8 || y > bluffFootAt(x) - 8) continue;
        const r = rng.range(1.4, 3.8) * (1 - Math.min(0.5, Math.abs(u) * 0.5));
        const pig = mix(rng.pick(PEBBLES), EARTH.body, 0.3);
        p.dab({ x: x - r * 0.3, y: y + r * 0.45 }, mix(EARTH.deep, EARTH.shade, 0.5), { rng, variant: 'round', length: r * 2, width: r * 1.5, opacity: 0.22, layers: 1 });
        p.dab({ x, y }, pig, { rng, variant: 'round', length: r * 2, width: r * rng.range(1.3, 1.9), angle: rng.range(0, Math.PI), opacity: 0.5, layers: 1 });
        if (rng.chance(0.4)) p.dab({ x: x + r * 0.3, y: y - r * 0.35 }, EARTH.lit, { rng, variant: 'round', length: r * 0.9, width: r * 0.7, opacity: 0.45, layers: 1, blend: 'source-over' });
      }
      yield;
    }
  }
}

/** Vertical erosion runnels from the rim: a dark groove, its left wall lit, flaring at the foot. */
function* paintRunnels(p: Painter, rng: Rng): Strokes {
  for (let x = 6; x < 1010; x += rng.range(28, 58)) {
    const top = bluffTopAt(x) + rng.range(2, 10);
    const foot = bluffFootAt(x);
    if (!Number.isFinite(top) || foot - top < 60) continue;
    const len = (foot - top) * rng.range(0.55, 0.95);
    const lean = x > 880 ? (x - 880) * 0.18 : 0;
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.1) pts.push({ x: x + Math.sin(t * 3.2 + x) * 4 + lean * t, y: top + t * len });
    const w = rng.range(5, 11);
    p.stroke(pts, { rng, pigment: mix(EARTH.deep, EARTH.shade, 0.35), width: w, taper: [0.15, 0.6], opacity: 0.42, wetness: 0.6, dryness: 0.25, wobble: 0.25 });
    p.dryBrush(pts.map((q) => ({ x: q.x - w * 0.55, y: q.y })), { rng, pigment: EARTH.lit, width: w * 0.35, opacity: 0.4, dryness: 0.6, blend: 'source-over' });
    if (rng.chance(0.5)) {
      const fine = pts.slice(0, 6).map((q) => ({ x: q.x + rng.range(10, 18), y: q.y + 4 }));
      p.stroke(fine, { rng, pigment: EARTH.deep, width: 2.4, taper: [0.1, 0.7], opacity: 0.35, wetness: 0.3 });
    }
    yield;
  }
}

// ── the ksar ────────────────────────────────────────────────────────────────────────────────

/** The bases the rock lip seats the walls on: the lowest block base over x, or null. */
function seatAt(x: number): number | null {
  let y: number | null = null;
  for (const s of KSAR_SHAPES) {
    const { block: b } = s;
    if (x >= b.x - 2 && x <= b.x + b.w + b.side + 2) y = Math.max(y ?? -Infinity, b.base);
  }
  return y;
}

/**
 * The ksar: the palms inside its walls, then each block back to front (houses, towers, the
 * ruined curtain walls), then the bluff's lip in front of their feet so they stand in the rock.
 */
export function* paintKsar(p: Painter, rng: Rng): Strokes {
  for (const k of KSAR_PALMS) {
    yield* ksarPalm(p, k.top, k.base, k.size, rng.fork(`palm-${k.top.x}`));
  }
  for (const s of KSAR_SHAPES) yield* paintBlock(p, s, rng.fork(s.block.id));
  yield* paintSeat(p, rng.fork('seat'));
}

const PALM = { trunk: '#8a6a4e', frond: '#8c9a5c', shade: '#66714a', lit: '#b3bb78' } satisfies Record<string, Pigment>;

/** A date palm growing in a courtyard: its trunk, then its fronds a pair at a time. */
function* ksarPalm(p: Painter, top: Pt, base: Pt, size: number, rng: Rng): Strokes {
  p.stroke(smoothPath([base, { x: (top.x + base.x) / 2 + rng.range(-4, 4), y: (top.y + base.y) / 2 }, top], 6), { rng, pigment: PALM.trunk, width: 6 * size, taper: [0, 0.05], opacity: 0.8, wetness: 0.35, dryness: 0.25 });
  const n = 15;
  for (let i = 0; i < n; i++) {
    const lower = i < 5;
    const a0 = lower ? (i % 2 ? rng.range(-0.2, 0.4) : Math.PI - rng.range(-0.2, 0.4)) : -Math.PI - 0.2 + rng.range(0, Math.PI + 0.4);
    const len = size * rng.range(40, 54);
    const droop = lower ? 0.9 : 0.2 + Math.abs(Math.cos(a0)) * 0.5;
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.125) pts.push({ x: top.x + Math.cos(a0) * len * t, y: top.y + Math.sin(a0) * len * t * 0.85 + droop * len * t * t * 0.55 });
    const pig = lower ? PALM.shade : Math.cos(a0) > 0.1 ? PALM.lit : PALM.frond;
    p.stroke(pts, { rng, pigment: pig, width: size * 2.6, taper: [0.05, 0.75], opacity: 0.7, wetness: 0.3, dryness: 0.3 });
    for (let k = 2; k < pts.length; k++) {
      const q = pts[k]!;
      const dir = Math.atan2(q.y - pts[k - 1]!.y, q.x - pts[k - 1]!.x);
      for (const sgn of [-1, 1]) p.dab(q, pig, { rng, variant: 'blade', angle: dir + sgn * 0.75, length: size * rng.range(8, 12) * (1.2 - k / pts.length), width: size * 1.6, opacity: 0.42, layers: 1 });
    }
    yield;
  }
  p.dab(top, PALM.shade, { rng, variant: 'round', length: size * 8, width: size * 7, opacity: 0.6 });
  yield;
}

/** The houses' fronts, where a tower's shadow falls. */
const HOUSE_FRONTS = KSAR_SHAPES.filter((s) => s.block.kind === 'house').map((s) => s.front);

function* paintBlock(p: Painter, s: BlockShape, rng: Rng): Strokes {
  const b = s.block;
  const top = b.base - b.h;
  const tower = b.kind === 'tower';
  // a tower throws its shade left onto the houses behind it (the sun is on the right)
  if (tower) {
    p.ctx.save();
    p.ctx.beginPath();
    for (const h of HOUSE_FRONTS) h.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.clip();
    yield* p.parts.glaze([{ x: b.x - 26, y: top + 30 }, { x: b.x + 4, y: top + 20 }, { x: b.x + 4, y: b.base + FOOTING }, { x: b.x - 26, y: b.base + FOOTING }], EARTH.shade, { rng, opacity: 0.42, deform: 0.1, edge: 0.2, fade: { angle: Math.PI, start: 0.5, amount: 1, ragged: 0.5 } });
    p.ctx.restore();
    yield;
  }
  const front = roughOutline(s.front, rng, 0.7, 3);
  const flank = s.flank.length ? roughOutline(s.flank, rng.fork('flank'), 0.6, 3) : [];
  if (flank.length) {
    fillPaper(p, flank);
    yield* p.parts.wetInWet(flank, mix(EARTH.lit, EARTH.gold, 0.35), mix(EARTH.gold, EARTH.body, 0.3), { rng, angle: Math.PI / 2, split: 0.6, opacity: 0.8, deform: 0.03, spread: 0.02, edge: 0.3, sharpness: 0.85, granulation: 0.35, granules: 0.1 });
    yield;
    clipTo(p, flank);
    for (let y = top + 8; y < b.base; y += rng.range(9, 12)) p.dryBrush([{ x: b.x + b.w, y: y + 2 }, { x: b.x + b.w + b.side, y: y - b.side * 0.3 + 2 }], { rng, pigment: EARTH.gold, width: 1.6, opacity: 0.3, dryness: 0.6 });
    p.ctx.restore();
  }
  fillPaper(p, front);
  // houses sit back in the ksar: a touch paler and cooler than the towers in front
  const far = b.kind === 'house' ? 0.18 : 0;
  yield* p.parts.wetInWet(front, mix(mix(EARTH.gold, EARTH.body, 0.45), EARTH.cool, far * 0.5), mix(mix(EARTH.body, EARTH.deep, 0.2), EARTH.shade, 0.15 + far), {
    rng, angle: Math.PI / 2 - 0.5, split: 0.55, opacity: 0.9 - far * 0.5, deform: 0.03, spread: 0.02, edge: 0.25, sharpness: 0.85, granulation: 0.45, granules: 0.18,
  });
  yield;
  clipTo(p, front);
  // the face turns from the sun toward its left edge
  yield* p.parts.glaze(box(b.x - 4, top - 20, b.x + Math.min(22, b.w * 0.3), b.base + FOOTING), EARTH.shade, { rng, opacity: 0.32, deform: 0.1, fade: { angle: 0, start: 0.2, amount: 1, ragged: 0.4 } });
  // pisé lifts: the formwork's courses, and the putlog holes in rows
  for (let y = top + 10; y < b.base; y += rng.range(9, 12)) {
    p.dryBrush([{ x: b.x - 2, y }, { x: b.x + b.w + 2, y: y + rng.range(-1, 1) }], { rng, pigment: mix(EARTH.deep, EARTH.shade, 0.3), width: 1.3, opacity: 0.28, dryness: 0.65 });
    if (rng.chance(0.35)) for (let x = b.x + rng.range(6, 12); x < b.x + b.w - 4; x += rng.range(12, 18)) p.dab({ x, y: y - 2 }, EARTH.dark, { rng, variant: 'round', length: 1.6, width: 1.4, opacity: 0.45, layers: 1 });
  }
  yield;
  if (tower) paintBands(p, s, rng);
  // small dark windows, a palm-wood lintel over some
  for (const w of windows(b)) {
    p.wash(box(w.x, w.y, w.x + w.w, w.y + w.h), mix(EARTH.dark, EARTH.deep, 0.25), { rng, layers: 3, opacity: 0.8, deform: 0.05, edge: 0.25, sharpness: 0.9 });
    if (w.h > 8 && rng.chance(0.3)) p.stroke([{ x: w.x - 1, y: w.y - 1.2 }, { x: w.x + w.w + 1, y: w.y - 1.2 }], { rng, pigment: mix('#7a5a40', EARTH.dark, 0.3), width: 1.4, opacity: 0.6, wetness: 0.1 });
  }
  yield;
  // rain has washed down from every merlon; the edges have crumbled
  for (let i = 0; i < Math.round(b.w / 9); i++) {
    const x = rng.range(b.x + 3, b.x + b.w - 3);
    p.dryBrush([{ x, y: top + rng.range(0, 6) }, { x: x + rng.range(-1.5, 1.5), y: top + rng.range(16, b.h * 0.7) }], { rng, pigment: mix(EARTH.deep, EARTH.shade, 0.3), width: rng.range(1.2, 2.6), opacity: 0.32, dryness: 0.65 });
  }
  for (let i = 0; i < Math.round(b.h / 30); i++) {
    const left = rng.chance(0.6);
    const x = left ? b.x + rng.range(0, 4) : b.x + b.w - rng.range(0, 4);
    p.lift({ cx: x, cy: rng.range(top + 6, b.base - 4), rx: rng.range(2, 4.5), ry: rng.range(2, 5) }, { rng, amount: 0.45, layers: 3, deform: 0.5 });
  }
  // the lit tops of the parapet and the horns
  for (let i = 1; i < s.top.length - 1; i++) {
    const a = s.top[i]!;
    const c = s.top[i + 1]!;
    if (Math.abs(c.y - a.y) < 3 && c.x > a.x) p.stroke([{ x: a.x + 0.5, y: a.y + 1.4 }, { x: c.x - 0.5, y: c.y + 1.4 }], { rng, pigment: EARTH.lit, width: 1.8, opacity: 0.6, wetness: 0.15, blend: 'source-over' });
  }
  p.ctx.restore();
  yield;
}

/** A tower's incised bands near the top: chevrons over a row of diamonds, between two fillets. */
function paintBands(p: Painter, s: BlockShape, rng: Rng): void {
  const b = s.block;
  const top = b.base - b.h;
  const x0 = b.x + 5;
  const x1 = b.x + b.w - 5;
  const incise = mix(EARTH.deep, EARTH.dark, 0.35);
  const fillet = (y: number) => {
    p.dryBrush([{ x: x0 - 3, y }, { x: x1 + 3, y }], { rng, pigment: incise, width: 1.4, opacity: 0.5, dryness: 0.4 });
    p.stroke([{ x: x0 - 3, y: y + 1.6 }, { x: x1 + 3, y: y + 1.6 }], { rng, pigment: EARTH.lit, width: 1, opacity: 0.45, wetness: 0.1, blend: 'source-over' });
  };
  const y1 = top + 12;
  fillet(y1 - 3);
  // chevrons: a running zigzag
  const zig: Pt[] = [];
  const step = 5;
  for (let x = x0, i = 0; x <= x1 + 0.1; x += step, i++) zig.push({ x, y: y1 + (i % 2 ? 6 : 1) });
  p.stroke(zig, { rng, pigment: incise, width: 1.3, opacity: 0.6, wetness: 0.1, wobble: 0.1 });
  // diamonds, each a small lozenge with a dark eye
  const y2 = y1 + 13;
  const n = Math.max(2, Math.floor((x1 - x0) / 11));
  const dx = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + dx * (i + 0.5);
    p.stroke([{ x: cx - 4, y: y2 }, { x: cx, y: y2 - 5 }, { x: cx + 4, y: y2 }, { x: cx, y: y2 + 5 }, { x: cx - 4, y: y2 }], { rng, pigment: incise, width: 1.1, opacity: 0.55, wetness: 0.1 });
  }
  fillet(y2 + 8);
}

/**
 * The bluff's lip in front of the walls' feet: rock of the same earth, its ragged top just above
 * each block's base, so the ksar stands in the rock rather than on it; a dark seam at the join.
 */
function* paintSeat(p: Painter, rng: Rng): Strokes {
  const x0 = KSAR_SHAPES.reduce((a, s) => Math.min(a, s.block.x), Infinity) - 6;
  const x1 = KSAR_SHAPES.reduce((a, s) => Math.max(a, s.block.x + s.block.w + s.block.side), -Infinity) + 6;
  const top: Pt[] = [];
  for (let x = x0; x <= x1; x += 4) {
    const seat = seatAt(x) ?? bluffTopAt(x);
    top.push({ x, y: Math.max(bluffTopAt(x), seat - 2) + rng.range(-1.5, 1.5) });
  }
  // thinning to nothing at both ends, so the seat has no edge of its own on the rock
  const depth = (x: number) => (FOOTING + 30) * Math.min(1, (x - x0) / 30, (x1 - x) / 30);
  const lip = [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + depth(q.x) }))];
  // the feet are covered with the bluff's own tone, solid down past them and lost below
  clipTo(p, lip);
  const g = p.ctx.createLinearGradient(0, 316, 0, 376);
  g.addColorStop(0, rgba(SEAT, 1));
  g.addColorStop(0.5, rgba(SEAT, 1));
  g.addColorStop(1, rgba(SEAT, 0));
  p.ctx.fillStyle = g;
  p.ctx.fillRect(x0, 310, x1 - x0, 70);
  yield;
  // in stretches, so no part of the step grows past one big mark at a close view
  for (let sx = x0; sx < x1; sx += 120) yield* p.parts.glaze(box(sx - 4, 312, Math.min(x1, sx + 124), 370), mix(EARTH.deep, EARTH.body, 0.5), { rng, opacity: 0.25, deform: 0.3, spread: 0.3, edge: 0, granulation: 0.8, granules: 0.35, fade: { angle: Math.PI / 2, start: 0.4, amount: 1, ragged: 0.8 } });
  p.ctx.restore();
  yield;
  // runnels start again under the walls' feet
  for (let x = x0 + 14; x < x1 - 10; x += rng.range(26, 50)) {
    const y = (seatAt(x) ?? bluffTopAt(x)) + rng.range(6, 14);
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.2) pts.push({ x: x + Math.sin(t * 3 + x) * 2, y: y + t * rng.range(30, 60) });
    p.stroke(pts, { rng, pigment: mix(EARTH.deep, EARTH.shade, 0.35), width: rng.range(3, 6), taper: [0.2, 0.7], opacity: 0.32, wetness: 0.5, dryness: 0.3 });
  }
  yield;
  // the seam where the walls go into the rock, and the rock's broken lit edge under it
  const seam = smoothPath(top.map((q) => ({ x: q.x, y: q.y - 0.5 })), 3);
  p.dryBrush(seam, { rng, pigment: mix(EARTH.dark, EARTH.shade, 0.4), width: 2.2, opacity: 0.5, dryness: 0.4 });
  p.dryBrush(seam.map((q) => ({ x: q.x, y: q.y + 3 })), { rng, pigment: EARTH.lit, width: 2, opacity: 0.4, dryness: 0.6, blend: 'source-over' });
  // fallen pisé on the lip under the ruined stretches
  for (const s of KSAR_SHAPES.filter((q) => q.block.kind === 'curtain')) {
    const b = s.block;
    for (let i = 0; i < 6; i++) {
      const x = rng.range(b.x + 4, b.x + b.w - 4);
      const y = b.base + rng.range(1, 6);
      p.dab({ x, y }, mix(EARTH.body, EARTH.deep, rng.range(0, 0.4)), { rng, variant: 'round', length: rng.range(3, 6), width: rng.range(2, 4), opacity: 0.6, layers: 2 });
    }
  }
  // the shade the walls' feet cast down the rock below them, and the runnels starting there
  p.glaze(box(x0, 336, x1, 356), shade(EARTH.shade, 0.1), { rng, opacity: 0.22, deform: 0.3, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.7 } });
  yield;
}
