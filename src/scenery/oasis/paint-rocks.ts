/**
 * The oasis's rock (O2): the red-ochre bluff of conglomerate and sandstone, and the ksar of pisé
 * growing out of it in the same golden-red earth. Lit from the upper right (ADR 0300), painted on
 * white in world units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Oasis › Rock.
 */
import { createRng, type Rng } from '../../core/rng';
import { PAPER_WHITE, blob, bounds, closedResample, insetPolygon, createSimplex2D, lighten, mix, rgba, shade, smoothPath, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { FOOTING, KSAR_PALMS, KSAR_SHAPES, taper, windows, type BlockShape } from './ksar';
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
const SEAT: Pigment = '#d3a088';
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
  fillUnder(p, shape, PAPER_WHITE);
}

/** An opaque underlayer over `shape`: hides what is behind, and no white shows where a wash stops short of the edge. */
function fillUnder(p: Painter, shape: readonly Pt[], pigment: Pigment): void {
  p.ctx.save();
  trace(p, shape);
  p.ctx.fillStyle = rgba(pigment);
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
 * The ksar: the palms inside its walls, then each block back to front (the far houses, the near
 * houses, the towers, the ruined curtain walls), then the bluff's lip in front of their feet so
 * they grow out of the rock.
 */
export function* paintKsar(p: Painter, rng: Rng): Strokes {
  for (const k of KSAR_PALMS) {
    yield* ksarPalm(p, k.top, k.base, k.size, rng.fork(`palm-${k.top.x}`));
  }
  for (let i = 0; i < KSAR_SHAPES.length; i++) yield* paintBlock(p, KSAR_SHAPES[i]!, i, rng.fork(KSAR_SHAPES[i]!.block.id));
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

/** A block's own earth: each tower a slightly different mud, the far houses paler and cooler. */
interface Tint {
  lit: Pigment;
  body: Pigment;
  shade: Pigment;
  /** how far back it stands: 0 for the towers and walls, up to 0.4 for the far houses */
  far: number;
}

function tintOf(s: BlockShape, rng: Rng): Tint {
  const b = s.block;
  const far = b.id.endsWith('-back') ? 0.55 : b.kind === 'house' ? 0.35 : 0;
  const warm = rng.range(-0.12, 0.12);
  const body = mix(mix(mix(EARTH.body, EARTH.gold, 0.42 + warm), EARTH.cool, far * 0.4), EARTH.lit, far * 0.3);
  return {
    lit: mix(mix(EARTH.lit, EARTH.gold, 0.4 + warm), EARTH.cool, far * 0.3),
    body,
    shade: mix(mix(EARTH.shade, EARTH.deep, 0.3), EARTH.cool, 0.05 + far * 0.35),
    far,
  };
}

/** What lies behind each block (the fronts painted before it), where its shade falls. */
const BEHIND: readonly (readonly Pt[])[][] = KSAR_SHAPES.map((_, i) => KSAR_SHAPES.slice(0, i).filter((q) => q.block.kind === 'house').map((q) => q.front));

function* paintBlock(p: Painter, s: BlockShape, index: number, rng: Rng): Strokes {
  const b = s.block;
  const top = b.base - b.h;
  const foot = b.base + FOOTING;
  const tower = b.kind === 'tower';
  const tint = tintOf(s, rng.fork('tint'));
  clipAboveSeat(p);
  // a block throws its shade left onto the houses behind it (the sun is on the right)
  const behind = BEHIND[index]!;
  if (behind.length && b.kind !== 'curtain') {
    p.ctx.save();
    p.ctx.beginPath();
    for (const h of behind) h.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.clip();
    const len = tower ? 30 : 12;
    yield* p.parts.glaze([{ x: b.x - len, y: top + len * 0.9 }, { x: b.x + 4, y: top + 6 }, { x: b.x + 4, y: foot }, { x: b.x - len, y: foot }], mix(EARTH.shade, EARTH.cool, 0.3), { rng, opacity: tower ? 0.55 : 0.4, deform: 0.12, spread: 0.2, edge: 0.15, fade: { angle: Math.PI, start: 0.5, amount: 1, ragged: 0.6 } });
    p.ctx.restore();
    yield;
  }
  const front = roughOutline(s.front, rng, 0.6, 3);
  const flank = s.flank.length ? roughOutline(s.flank, rng.fork('flank'), 0.5, 3) : [];
  if (flank.length) {
    fillUnder(p, insetPolygon(flank, 1), mix(PAPER_WHITE, tint.lit, 0.6));
    // the flank turned to the sun: the palest wash, pooling darker at its far edge
    yield* p.parts.wetInWet(flank, tint.lit, mix(tint.lit, tint.body, 0.6), { rng, angle: Math.PI / 2, split: 0.6, opacity: 0.85 - tint.far * 0.3, deform: 0.03, spread: 0.02, edge: 0.45, sharpness: 0.75, granulation: 0.55, granules: 0.2 });
    yield;
  }
  fillUnder(p, insetPolygon(front, 1.2), mix(PAPER_WHITE, tint.lit, 0.35));
  // the front: warm where the light strikes high on the right, cooling down and to the left
  yield* p.parts.wetInWet(front, mix(tint.lit, tint.body, 0.45), mix(tint.body, tint.shade, 0.2), {
    rng, angle: Math.PI / 2 + 0.55, split: 0.5, softness: 0.7, opacity: 0.8 - tint.far * 0.35, deform: 0.03, spread: 0.02, edge: 0.3, sharpness: 0.65,
    granulation: 0.45, granules: 0.2, flow: 0.5, flowScale: 40,
  });
  yield;
  // the parapet with a smaller brush: a big wash's outline is too coarse for the merlons
  const crest = roughOutline([...s.top, { x: b.x + b.w - taper(b), y: top + 9 }, { x: b.x + taper(b), y: top + 9 }], rng.fork('crest'), 0.4, 1.5);
  yield* p.parts.wash(crest, mix(tint.lit, tint.body, 0.5), { rng, layers: 6, opacity: 0.6 - tint.far * 0.3, deform: 0.02, spread: 0.02, edge: 0.3, sharpness: 0.6, granulation: 0.4, fade: { angle: Math.PI / 2, start: 0.5, amount: 1 } });
  yield;
  clipTo(p, front);
  const x0 = b.x;
  const x1 = b.x + b.w;
  // pisé is patchy: newer mud in pale patches, damp darker ones, soft and overlapping
  for (let i = 0; i < Math.max(2, Math.round((b.w * b.h) / 2600)); i++) {
    const dark = rng.chance(0.5);
    p.glaze({ cx: rng.range(x0, x1), cy: rng.range(top + 8, b.base), rx: rng.range(8, 20), ry: rng.range(6, 16) }, dark ? mix(tint.body, EARTH.deep, 0.5) : tint.lit, { rng, opacity: dark ? 0.16 : 0.22, deform: 0.5, spread: 0.5, edge: 0.15, granulation: 0.5 });
  }
  yield;
  // the face turns from the sun toward its left edge; a cool shade gathers there and at the foot
  yield* p.parts.glaze(box(x0 - 4, top - 20, x0 + Math.max(10, b.w * 0.38), foot), mix(EARTH.shade, EARTH.cool, 0.3 + tint.far * 0.3), { rng, opacity: b.kind === 'tower' ? 0.5 : 0.4, deform: 0.14, spread: 0.2, edge: 0.05, fade: { angle: 0, start: 0.15, amount: 1, ragged: 0.7 } });
  yield* p.parts.glaze(box(x0 - 4, b.base - 30, x1 + 4, foot), mix(tint.shade, EARTH.deep, 0.3), { rng, opacity: 0.28, deform: 0.2, spread: 0.3, edge: 0, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.7 } });
  yield;
  // the lifts of the formwork: short broken courses, never a ruled line across
  for (let y = top + rng.range(12, 18); y < b.base - 6; y += rng.range(10, 14)) {
    for (let x = x0 + rng.range(-2, 10); x < x1; ) {
      const len = rng.range(12, 34);
      if (rng.chance(0.6)) p.dryBrush([{ x, y: y + rng.range(-0.6, 0.6) }, { x: x + len * 0.5, y: y + rng.range(-0.8, 0.8) }, { x: x + len, y: y + rng.range(-0.6, 0.6) }], { rng, pigment: mix(tint.shade, EARTH.deep, 0.4), width: rng.range(1, 1.6), opacity: 0.2, dryness: 0.7 });
      x += len + rng.range(4, 16);
    }
    if (tower && rng.chance(0.25)) {
      // the putlog holes of one lift, a short run of them
      const hx = rng.range(x0 + 8, x1 - 24);
      for (let k = 0; k < 3; k++) p.dab({ x: hx + k * rng.range(6, 9), y: y - 2 }, mix(EARTH.dark, tint.shade, 0.3), { rng, variant: 'round', length: 1.5, width: 1.3, opacity: 0.35, layers: 1 });
    }
  }
  yield;
  if (tower) paintBands(p, s, tint, rng.fork('bands'));
  if (b.kind === 'curtain') yield* paintRuin(p, s, tint, rng.fork('ruin'));
  paintOpenings(p, b, tint, rng.fork('openings'));
  yield;
  // rain has washed down from the merlons and gullied the corners
  for (let i = 0; i < Math.round(b.w / 14); i++) {
    const x = rng.range(x0 + 4, x1 - 4);
    const len = rng.range(10, b.h * (tower ? 0.55 : 0.4));
    const y = top + rng.range(0, 6);
    p.stroke([{ x, y }, { x: x + rng.range(-1, 1), y: y + len * 0.5 }, { x: x + rng.range(-1.5, 1.5), y: y + len }], { rng, pigment: mix(tint.shade, EARTH.deep, 0.35), width: rng.range(1.4, 2.8), taper: [0.2, 0.9], opacity: 0.18, wetness: 0.6, dryness: 0.3 });
  }
  for (let i = 0; i < Math.round(b.h / 34) + 1; i++) {
    const left = rng.chance(0.8);
    const x = left ? x0 + rng.range(-1, 3) : x1 - rng.range(-1, 3);
    p.lift({ cx: x, cy: rng.range(top + 4, b.base - 4), rx: rng.range(2, 4), ry: rng.range(3, 7) }, { rng, amount: 0.25, layers: 3, deform: 0.5 });
  }
  // the light catches the worn tops: broken, loose touches along the parapet
  const lit = smoothPath(s.top.map((q) => ({ x: q.x, y: q.y + 1.6 })), 3);
  for (let i = 0; i < lit.length; ) {
    const n = Math.round(rng.range(4, 9));
    const run = lit.slice(i, i + n);
    if (run.length > 1 && rng.chance(0.5)) p.dryBrush(run, { rng, pigment: lighten(tint.lit, 0.08), width: rng.range(1.4, 2.2), opacity: 0.36 - tint.far * 0.3, dryness: 0.5, blend: 'source-over' });
    i += n + Math.round(rng.range(1, 4));
  }
  p.ctx.restore();
  p.ctx.restore();
  yield;
}

/**
 * A tower's carved band near the top, done as quick loose brushwork: a broken fillet, a running
 * zigzag of uneven teeth, a row of lozenges flicked in two strokes each, some faint or missing.
 */
function paintBands(p: Painter, s: BlockShape, tint: Tint, rng: Rng): void {
  const b = s.block;
  const top = b.base - b.h;
  const tp = taper(b);
  const x0 = b.x + tp + 4;
  const x1 = b.x + b.w - tp - 4;
  const incise = mix(EARTH.deep, tint.shade, 0.35);
  // the band stands proud of the wall: a touch lighter, with a soft shade under its lower fillet
  p.glaze(box(x0 - 3, top + 6, x1 + 3, top + 32), tint.lit, { rng, opacity: 0.18, deform: 0.2, spread: 0.3, edge: 0 });
  const broken = (y: number, width: number, op: number) => {
    for (let x = x0 - 3; x < x1 + 2; ) {
      const len = rng.range(10, 26);
      p.dryBrush([{ x, y: y + rng.range(-0.5, 0.5) }, { x: Math.min(x1 + 3, x + len), y: y + rng.range(-0.7, 0.7) }], { rng, pigment: incise, width, opacity: op, dryness: 0.5 });
      x += len + rng.range(1, 5);
    }
  };
  const y1 = top + 11 + rng.range(-1, 1);
  broken(y1 - 3, 1.3, 0.38);
  // the zigzag: one flick of the brush per tooth edge, heavy where it lands, now and then skipped
  const flick = (a: Pt, c: Pt, op: number) => p.stroke([a, c], { rng, pigment: incise, width: rng.range(1.1, 1.6), taper: [0.05, 0.6], opacity: op, wetness: 0.3, wobble: 0.2 });
  let up = true;
  for (let x = x0; x < x1 - 3; x += rng.range(4.2, 5.4), up = !up) {
    if (rng.chance(0.08)) continue;
    const lo = y1 + rng.range(4.6, 6.2);
    const hi = y1 + rng.range(0, 1);
    const nx = Math.min(x1, x + rng.range(4.2, 5.4));
    flick({ x, y: up ? lo : hi }, { x: nx, y: up ? hi : lo }, rng.range(0.3, 0.5));
  }
  const y2 = y1 + 13;
  const n = Math.max(2, Math.floor((x1 - x0) / 10.5));
  const dx = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    if (rng.chance(0.12)) continue;
    const cx = x0 + dx * (i + 0.5) + rng.range(-0.8, 0.8);
    const rx = rng.range(3.2, 4.2);
    const ry = rng.range(4.2, 5.4);
    const op = rng.range(0.3, 0.48);
    const t = { x: cx + rng.range(-0.4, 0.4), y: y2 - ry };
    const l = { x: cx - rx, y: y2 + rng.range(-0.4, 0.4) };
    const bt = { x: cx + rng.range(-0.4, 0.4), y: y2 + ry };
    const r = { x: cx + rx, y: y2 + rng.range(-0.4, 0.4) };
    // a lozenge in four flicks, the corners overlapping or just missing as a quick hand leaves them
    flick(t, l, op);
    flick(l, bt, op * 0.9);
    flick({ x: t.x + 0.4, y: t.y }, r, op * 0.85);
    if (rng.chance(0.85)) flick(r, { x: bt.x + 0.5, y: bt.y - 0.3 }, op * 0.8);
  }
  const y3 = y2 + 8 + rng.range(-0.5, 0.5);
  broken(y3, 1.4, 0.36);
  p.glaze(box(x0 - 3, y3 + 1, x1 + 3, y3 + 6), tint.shade, { rng, opacity: 0.22, deform: 0.2, spread: 0.2, edge: 0, fade: { angle: Math.PI / 2, start: 0.1, amount: 1, ragged: 0.5 } });
  // on the tallest towers, two blind niches under the band
  if (b.h > 125) {
    for (const f of [0.34, 0.66]) {
      const cx = x0 + (x1 - x0) * f + rng.range(-1.5, 1.5);
      p.wash(arch(cx - 2.6, y3 + 9, 5.2, 9), mix(tint.shade, EARTH.deep, 0.35), { rng, layers: 3, opacity: 0.4, deform: 0.08, edge: 0.4, sharpness: 0.6 });
    }
  }
}

/** A ruined curtain wall's wear: a lit crest, a shade under it, rain gullies down the face, a few holes. */
function* paintRuin(p: Painter, s: BlockShape, tint: Tint, rng: Rng): Strokes {
  const b = s.block;
  const crest = s.top;
  const band = (d0: number, d1: number) => [...crest.map((q) => ({ x: q.x, y: q.y + d0 })), ...crest.slice().reverse().map((q) => ({ x: q.x, y: q.y + d1 }))];
  yield* p.parts.glaze(band(-2, 9), tint.lit, { rng, opacity: 0.4, deform: 0.15, spread: 0.2, edge: 0, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.6 } });
  yield* p.parts.glaze(band(8, 16), mix(tint.shade, EARTH.deep, 0.3), { rng, opacity: 0.22, deform: 0.25, spread: 0.3, edge: 0, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.8 } });
  for (let x = b.x + rng.range(6, 14); x < b.x + b.w - 6; x += rng.range(14, 26)) {
    const i = crest.findIndex((q) => q.x >= x);
    const y0 = (crest[Math.max(0, i)]?.y ?? b.base - b.h) + rng.range(1, 4);
    const len = rng.range(0.35, 0.8) * (b.base - y0);
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.25) pts.push({ x: x + Math.sin(t * 2.6 + x) * 1.2, y: y0 + t * len });
    p.stroke(pts, { rng, pigment: mix(tint.shade, EARTH.deep, 0.4), width: rng.range(2, 3.2), taper: [0.15, 0.85], opacity: 0.3, wetness: 0.45, dryness: 0.3 });
    p.dryBrush(pts.slice(0, 4).map((q) => ({ x: q.x - 1.8, y: q.y })), { rng, pigment: tint.lit, width: 1.1, opacity: 0.35, dryness: 0.6, blend: 'source-over' });
  }
  for (let i = 0; i < 2; i++) {
    const x = rng.range(b.x + 10, b.x + b.w - 10);
    const y = rng.range(b.base - b.h * 0.6, b.base - 8);
    p.wash(blob(x, y, rng.range(1.5, 2.6), rng.range(1.2, 2), rng, { irregularity: 0.35, points: 8 }), mix(EARTH.dark, tint.shade, 0.35), { rng, layers: 3, opacity: 0.5, deform: 0.1, edge: 0.4, sharpness: 0.6 });
  }
  yield;
}

/** An opening's outline: a box, or a box under a round head. */
function arch(x: number, y: number, w: number, h: number): Pt[] {
  const r = w / 2;
  const out: Pt[] = [{ x, y: y + h }, { x, y: y + r }];
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (Math.PI * i) / 6;
    out.push({ x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r });
  }
  out.push({ x: x + w, y: y + r }, { x: x + w, y: y + h });
  return out;
}

/** The openings: soft dark washes darkest at their top, a palm-wood lintel and a lit sill on some. */
function paintOpenings(p: Painter, b: BlockShape['block'], tint: Tint, rng: Rng): void {
  const hole = mix(mix(EARTH.dark, EARTH.deep, 0.35), tint.shade, 0.2 + tint.far);
  for (const w of windows(b)) {
    const shape = w.kind === 'arch' ? arch(w.x, w.y, w.w, w.h) : roughOutline(box(w.x, w.y, w.x + w.w, w.y + w.h), rng, 0.3, 1.5);
    p.wash(shape, hole, { rng, layers: 4, opacity: 0.66 - tint.far * 0.4, deform: 0.06, spread: 0.05, edge: 0.45, sharpness: 0.7, fade: { angle: Math.PI / 2, start: 0.4, amount: 0.35 } });
    if (w.lintel) {
      const over = rng.range(1.5, 3);
      p.stroke([{ x: w.x - over, y: w.y - 1.3 }, { x: w.x + w.w + over, y: w.y - 1.1 + rng.range(-0.4, 0.4) }], { rng, pigment: mix('#7a5a40', EARTH.dark, 0.25), width: 1.5, opacity: 0.6 - tint.far * 0.3, wetness: 0.15, wobble: 0.2 });
    }
    p.dryBrush([{ x: w.x - 0.5, y: w.y + w.h + 1.2 }, { x: w.x + w.w + 1, y: w.y + w.h + 1.4 }], { rng, pigment: tint.lit, width: 1.2, opacity: 0.4, dryness: 0.4, blend: 'source-over' });
  }
}

/** The ksar's span over the rock, with a little room either side. */
const SEAT_X0 = KSAR_SHAPES.reduce((a, s) => Math.min(a, s.block.x), Infinity) - 6;
const SEAT_X1 = KSAR_SHAPES.reduce((a, s) => Math.max(a, s.block.x + s.block.w + s.block.side), -Infinity) + 6;

/**
 * Where the walls go into the rock, left → right: just above each block's base, with the rock
 * swelling up into them here and there as outcrops the builders kept. Deterministic.
 */
export const SEAT_LINE: readonly Pt[] = (() => {
  const rng = createRng('ksar-seat');
  const noise = createSimplex2D(rng.fork('rise'));
  const out: Pt[] = [];
  for (let x = SEAT_X0; x <= SEAT_X1; x += 4) {
    const seat = seatAt(x);
    const rise = Math.max(0, noise(x / 40, 3) - 0.1) * 17 + Math.max(0, noise(x / 13, 9)) * 1.5;
    out.push({ x, y: (seat === null ? bluffTopAt(x) : seat - 2 - rise) + rng.range(-1.2, 1.2) });
  }
  return out;
})();

/** Clip to everything above the seat line, so no wall foot is painted over the rock. */
function clipAboveSeat(p: Painter): void {
  clipTo(p, [{ x: SEAT_X0 - 60, y: -100 }, { x: SEAT_X1 + 60, y: -100 }, { x: SEAT_X1 + 60, y: SEAT_LINE[SEAT_LINE.length - 1]!.y }, ...SEAT_LINE.slice().reverse(), { x: SEAT_X0 - 60, y: SEAT_LINE[0]!.y }]);
}

/**
 * Where the ksar meets the bluff: the walls stop at the seat line, and the rock rises into them
 * in outcrops of its own earth over the bluff's top, so the ksar grows out of the rock rather
 * than standing on it; the join broken, not ruled.
 */
function* paintSeat(p: Painter, rng: Rng): Strokes {
  const top = SEAT_LINE;
  const x0 = SEAT_X0;
  const x1 = SEAT_X1;
  // the rock's tone creeps up the wall feet, so pisé and rock read as one earth
  yield* p.parts.glaze([...top.map((q) => ({ x: q.x, y: q.y - 22 })), ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + 2 }))], mix(SEAT, EARTH.body, 0.3), { rng, opacity: 0.28, deform: 0.2, spread: 0.3, edge: 0, granulation: 0.4, fade: { angle: -Math.PI / 2, start: 0.25, amount: 1, ragged: 0.8 } });
  yield;
  // the outcrops above the bluff's own top: an underlayer so no paper shows, then a granulating wash
  // that runs on down over the bluff and is lost in it, in stretches (one big mark's work each)
  const under = [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: Math.max(q.y, bluffTopAt(q.x) + 3) }))];
  fillUnder(p, under, mix(PAPER_WHITE, SEAT, 0.85));
  for (let sx = x0; sx < x1; sx += 120) {
    const run = top.filter((q) => q.x >= sx - 4 && q.x <= sx + 124);
    if (run.length < 2) continue;
    const low = Math.max(...run.map((q) => q.y));
    const fade = Math.min(1, (run[0]!.x - x0 + 20) / 40, (x1 - run[run.length - 1]!.x + 20) / 40);
    const shape = [...run, { x: run[run.length - 1]!.x, y: low + 20 }, { x: run[0]!.x, y: low + 20 }];
    yield* p.parts.wash(shape, SEAT, { rng, layers: 6, opacity: 0.75 * fade, deform: 0.04, spread: 0.06, edge: 0.12, sharpness: 0.4, granulation: 0.7, granules: 0.3, fade: { angle: Math.PI / 2, start: 0.35, amount: 1, ragged: 0.8 } });
  }
  yield;
  // the outcrops' faces turned from the sun, and the beds running on through them
  for (let i = 2; i < top.length - 2; i++) {
    const q = top[i]!;
    const prev = top[i - 2]!;
    if (prev.y - q.y > 3) p.glaze({ cx: q.x - 3, cy: q.y + 6, rx: 4, ry: 7 }, mix(EARTH.shade, EARTH.deep, 0.3), { rng, opacity: 0.2, deform: 0.4, spread: 0.4, edge: 0 });
  }
  for (let x = x0 + rng.range(0, 30); x < x1 - 20; x += rng.range(60, 120)) {
    const len = rng.range(20, 50);
    const y = Math.max(top[Math.round((x - x0) / 4)]?.y ?? 318, 314) + rng.range(8, 16);
    const pts = [{ x, y }, { x: x + len * 0.5, y: y + rng.range(-1, 1) }, { x: x + len, y: y + rng.range(-1.5, 1.5) }];
    p.dryBrush(pts.map((q) => ({ x: q.x, y: q.y + 2.5 })), { rng, pigment: mix(EARTH.deep, EARTH.shade, 0.3), width: rng.range(2, 3), opacity: 0.25, dryness: 0.6 });
    p.dryBrush(pts, { rng, pigment: EARTH.lit, width: rng.range(1.5, 2.2), opacity: 0.3, dryness: 0.6, blend: 'source-over' });
  }
  yield;
  // the join, in broken touches: a dark crack here, the rock's lit edge there
  const seam = smoothPath(top.map((q) => ({ x: q.x, y: q.y - 0.3 })), 3);
  for (let i = 0; i < seam.length; ) {
    const n = Math.round(rng.range(4, 12));
    const run = seam.slice(i, i + n);
    if (run.length > 1) {
      if (rng.chance(0.55)) p.dryBrush(run, { rng, pigment: mix(EARTH.dark, EARTH.shade, 0.45), width: rng.range(1.2, 2.2), opacity: 0.34, dryness: 0.5 });
      if (rng.chance(0.55)) p.dryBrush(run.map((q) => ({ x: q.x, y: q.y + 2.4 })), { rng, pigment: EARTH.lit, width: 1.6, opacity: 0.34, dryness: 0.6, blend: 'source-over' });
    }
    i += n + Math.round(rng.range(0, 5));
  }
  // fallen pisé slumped below the ruined stretches, in the walls' own colour
  for (const s of KSAR_SHAPES.filter((q) => q.block.kind === 'curtain')) {
    const b = s.block;
    for (let i = 0; i < 3; i++) {
      const x = rng.range(b.x + 6, b.x + b.w - 6);
      const y = b.base + rng.range(0, 4);
      const w = rng.range(8, 14);
      p.wash(blob(x, y, w, w * 0.3, rng, { irregularity: 0.3, points: 12 }), mix(SEAT, EARTH.gold, 0.35), { rng, layers: 4, opacity: 0.35, deform: 0.2, edge: 0.15, sharpness: 0.5, granulation: 0.6, fade: { angle: Math.PI / 2, start: 0.3, amount: 0.7 } });
    }
  }
  // the shade the walls cast down the rock just below them
  yield* p.parts.glaze([...top.map((q) => ({ x: q.x, y: q.y + 2 })), ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + 18 }))], shade(EARTH.shade, 0.1), { rng, opacity: 0.16, deform: 0.3, spread: 0.3, edge: 0, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.7 } });
  yield;
}
