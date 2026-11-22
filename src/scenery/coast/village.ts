/**
 * The far shore (G2, GB1): pale headlands and islands on the horizon, the hill across the bay in
 * aerial perspective with its field terraces, olive groves and the road to the chapel, and its
 * whitewashed village with the blue-domed chapel on the crest, cypresses and a harbour below.
 * docs/systems/scenery.md › Coast › Rock.
 */
import type { Rng } from '../../core/rng';
import { blob, mix, ribbon, smoothPath, type Painter, type Pigment } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import {
  CAMPANILE, CHAPEL_ROAD, FAR_CYPRESSES, FAR_OLIVES, FAR_SAIL, FIELD_TERRACES, GAP_ISLANDS, GULLIES, HARBOUR, HEADLANDS, HILL_SHORE, PASTEL_WALLS, TILED_ROOFS, VILLAGE_GROUND,
} from './distance';
import { CHAPEL, FAR_HILL, HORIZON, VILLAGE } from './layout';
import { VILLAGE_CUBES } from './shapes';
import { box, ellipse, liftBatch, rough, wetBatch, type Mark } from './rock-kit';

const HAZE = {
  far: '#b4b8d4',
  hill: '#b6b2c6',
  maquis: '#a3a99a',
  shade: '#8d8ba9',
  dark: '#6e7468',
  white: '#fdfbf5',
  wall: '#a9acc8',
  hole: '#535a72',
  dome: '#2a6cc6',
  domeDeep: '#1f4a90',
} satisfies Record<string, Pigment>;

/** The far shore's few colours beyond the haze's: old roof tiles, pastel walls, olives, cypress, a boat's blue. */
const TILE: Pigment = '#c48a6c';
const PASTEL = { ochre: '#e6c98e', rose: '#e3b4a6' } satisfies Record<string, Pigment>;
const OLIVE_GREY: Pigment = '#8f9a7c';
const CYPRESS: Pigment = '#4f5d4a';
const BOAT_BLUE: Pigment = '#4f78b8';

export { HEADLANDS };

const fade = (amount: number, start = 0.5) => ({ angle: Math.PI / 2, start, amount, ragged: 0.4 });

/** The far hill and the headlands (a soft step: painted at draft resolution). */
export function* paintFarHill(p: Painter, rng: Rng): Strokes {
  for (const [i, h] of HEADLANDS.entries()) {
    yield* p.parts.wash(rough(h, rng, 0.8, 4), mix(HAZE.far, HAZE.shade, i * 0.2), { rng, opacity: 0.34, deform: 0.03, spread: 0.04, edge: 0.15, sharpness: 0.6, granulation: 0.15, fade: fade(0.6) });
    yield;
  }
  yield* paintGapIslands(p, rng.fork('islands'));
  const hill = rough(FAR_HILL, rng, 0.9, 4);
  yield* p.parts.wetInWet(hill, HAZE.hill, HAZE.maquis, { rng, angle: Math.PI / 2 + 0.4, split: 0.45, softness: 0.7, opacity: 0.5, deform: 0.03, spread: 0.03, edge: 0.12, sharpness: 0.7, granulation: 0.35 });
  yield;
  // the right slope turned from the sun; maquis in soft patches; the shore line
  yield* p.parts.glaze([{ x: 300, y: 300 }, { x: 330, y: 308 }, { x: 392, y: 332 }, { x: 448, y: 362 }, { x: 492, y: 388 }, { x: 520, y: 404 }, { x: 330, y: 404 }], HAZE.shade, { rng, opacity: 0.32, edge: 0.05, deform: 0.05, fade: { angle: Math.PI, start: 0.3, amount: 1, ragged: 0.6 } });
  yield* paintHillForm(p, rng.fork('form'));
  const patches: Mark[] = [];
  for (let i = 0; i < 40; i++) {
    const x = rng.range(-10, 490);
    const y = rng.range(318, 396);
    if (VILLAGE.some((v) => x > v.x - 8 && x < v.x + v.w + 8 && y > v.y - 6 && y < v.y + v.h + 6)) continue;
    patches.push({ poly: blob(x, y, rng.range(5, 16), rng.range(2, 4.5), rng, { irregularity: 0.5 }), alpha: rng.range(0.16, 0.3) });
  }
  const shore: Mark[] = [{ poly: rough([{ x: -30, y: HORIZON - 3 }, { x: 520, y: HORIZON - 2 }, { x: 520, y: HORIZON + 2 }, { x: -30, y: HORIZON + 2 }], rng, 0.8, 6), alpha: 0.28 }];
  yield* wetBatch(p, patches, mix(HAZE.maquis, HAZE.dark, 0.35), { edge: 0.12, sharpness: 0.4, granulation: 0.4 });
  yield* paintFields(p, rng.fork('fields'));
  yield* wetBatch(p, shore, HAZE.dark, { edge: 0.2, sharpness: 0.6 });
}

/** The far coast in the gap between the hill and the point: a pale ridge, a nearer island before it, both lost into the sea haze. */
function* paintGapIslands(p: Painter, rng: Rng): Strokes {
  const [ridge, island] = GAP_ISLANDS;
  yield* p.parts.wash(rough(ridge!, rng, 0.4, 3), mix(HAZE.far, HAZE.white, 0.25), { rng, opacity: 0.3, deform: 0.02, spread: 0.03, edge: 0.12, sharpness: 0.5, granulation: 0.1, fade: fade(0.7, 0.35) });
  yield;
  yield* p.parts.wash(rough(island!, rng, 0.3, 3), mix(HAZE.far, HAZE.shade, 0.45), { rng, opacity: 0.36, deform: 0.02, spread: 0.03, edge: 0.2, sharpness: 0.6, granulation: 0.15, fade: fade(0.55, 0.45) });
  yield;
}

/** The hill's form: two gullies in shade on their right, lit on their left, and the warm ground the village stands on. */
function* paintHillForm(p: Painter, rng: Rng): Strokes {
  const shade: Mark[] = [];
  const lit: Mark[] = [];
  for (const g of GULLIES) {
    const line = smoothPath(g, 3);
    shade.push({ poly: rough(ribbon(line, (t) => 0.6 + t * 1.8, (t) => 0.8 + t * 1.6), rng, 1, 3), alpha: 0.16 });
    lit.push({ poly: rough(ribbon(line, (t) => 0.4 + t * 0.8, (t) => -0.8 - t), rng, 0.8, 3), alpha: 0.18 });
  }
  yield* wetBatch(p, [{ poly: rough(VILLAGE_GROUND, rng, 2.5, 5), alpha: 0.2 }], mix(HAZE.hill, '#d9c6a4', 0.55), { edge: 0.02, sharpness: 0.2, granulation: 0.4 });
  yield* wetBatch(p, shade, HAZE.shade, { edge: 0.08, sharpness: 0.3, granulation: 0.4 });
  yield* liftBatch(p, lit, HAZE.white, { edge: 0, sharpness: 0.3 });
}

/** The old field terraces as broken lit risers over their shade, the olive groves on them, and the road up to the chapel. */
function* paintFields(p: Painter, rng: Rng): Strokes {
  const risers: Mark[] = [];
  const tops: Mark[] = [];
  for (const line of FIELD_TERRACES) {
    const a = rng.range(0.22, 0.36);
    risers.push({ poly: ribbon(line, () => 0.45, () => -0.55), alpha: a });
    tops.push({ poly: ribbon(line, () => 0.35, () => 0.35), alpha: a + 0.15 });
  }
  yield* wetBatch(p, risers, mix(HAZE.shade, HAZE.dark, 0.3), { edge: 0.1, sharpness: 0.5, granulation: 0.3 });
  yield* liftBatch(p, tops, HAZE.white, { edge: 0, sharpness: 0.5 });
  const crowns: Mark[] = [];
  const under: Mark[] = [];
  for (const o of FAR_OLIVES) {
    crowns.push({ poly: blob(o.x, o.y, o.r, o.r * 0.72, rng, { irregularity: 0.35, points: 10 }), alpha: rng.range(0.4, 0.6) });
    under.push({ poly: blob(o.x + o.r * 0.5, o.y + o.r * 0.55, o.r * 0.7, o.r * 0.3, rng, { irregularity: 0.3, points: 8 }), alpha: 0.4 });
  }
  yield* wetBatch(p, crowns, mix(HAZE.maquis, OLIVE_GREY, 0.5), { edge: 0.15, sharpness: 0.5, granulation: 0.3 });
  yield* wetBatch(p, under, mix(HAZE.dark, HAZE.shade, 0.4), { edge: 0.1, sharpness: 0.5 });
  // the road: a pale dusty line, its downhill edge in a thin shade
  // broken where a grove, a wall or the slope hides it
  const road: Mark[] = [];
  const edge: Mark[] = [];
  for (let i = 0; i < CHAPEL_ROAD.length - 2; ) {
    const n = rng.int(5, 14);
    const run = CHAPEL_ROAD.slice(i, Math.min(CHAPEL_ROAD.length, i + n + 1));
    if (run.length > 1 && rng.chance(0.82)) {
      road.push({ poly: rough(ribbon(run, () => 0.62), rng, 0.25, 2), alpha: rng.range(0.55, 0.75) });
      edge.push({ poly: rough(ribbon(run, () => 0.4, () => 0.95), rng, 0.25, 2), alpha: 0.2 });
    }
    i += n + rng.int(0, 2);
  }
  yield* wetBatch(p, edge, HAZE.shade, { edge: 0.1, sharpness: 0.5 });
  yield* liftBatch(p, road, mix(HAZE.white, '#efe2c8', 0.4), { edge: 0, sharpness: 0.6 });
}

/** The whitewashed village, a row at a time from the top of the slope, then the chapel, the cypresses and the harbour below. */
export function* paintVillage(p: Painter, rng: Rng): Strokes {
  const flat = VILLAGE_CUBES.flat();
  const roofs = new Set(TILED_ROOFS.map((i) => flat[i]!));
  const pastel = new Map(PASTEL_WALLS.map((w) => [flat[w.cube]!, w.tint] as const));
  const extra = rng.fork('roofs');
  for (const row of VILLAGE_CUBES) {
    const walls: Mark[] = row.map((c) => ({ poly: rough(box(c.x, c.y, c.x + c.w, c.y + c.h), rng, 0.3, 2), alpha: 0.95 }));
    yield* liftBatch(p, walls, HAZE.white, { edge: 0.05, sharpness: 0.9, granulation: 0 });
    for (const tint of ['ochre', 'rose'] as const) {
      const marks = row.filter((c) => pastel.get(c) === tint).map((c) => ({ poly: rough(box(c.x + 0.3, c.y + 0.3, c.x + c.w - 0.3, c.y + c.h - 0.3), extra, 0.25, 2), alpha: 0.34 }));
      yield* wetBatch(p, marks, PASTEL[tint], { edge: 0.1, sharpness: 0.6, granulation: 0.3 });
    }
    const shade: Mark[] = row.map((c) => ({ poly: rough(box(c.x + c.w * (1 - c.side), c.y + 0.3, c.x + c.w + 0.2, c.y + c.h), rng, 0.25, 2), alpha: 0.42 }));
    // a thin shade along the foot where the house meets the slope
    for (const c of row) shade.push({ poly: rough(box(c.x - 0.5, c.y + c.h - 1, c.x + c.w + 0.5, c.y + c.h + 0.8), rng, 0.3, 2), alpha: 0.35 });
    yield* wetBatch(p, shade, HAZE.wall, { edge: 0.2, sharpness: 0.8, granulation: 0.2 });
    const holes = row.flatMap((c) => c.holes.map((h) => ({ poly: rough(box(h.x, h.y, h.x + h.w, h.y + h.h), rng, 0.2, 1), alpha: 0.75 })));
    yield* wetBatch(p, holes, HAZE.hole, { edge: 0.3, edgeWidth: 0.6, sharpness: 0.8 });
    yield* paintRoofs(p, row.filter((c) => roofs.has(c)), extra);
  }
  yield* paintChapel(p, rng.fork('chapel'));
  yield* paintCampanile(p, rng.fork('campanile'));
  yield* paintCypresses(p, rng.fork('cypresses'));
  yield* paintHarbour(p, rng.fork('harbour'));
}

/** Low hipped roofs of old tiles: a terracotta band, its far slope in shade, the eaves' shadow on the wall. */
function* paintRoofs(p: Painter, cubes: readonly Rect[], rng: Rng): Strokes {
  if (!cubes.length) return;
  const tiles: Mark[] = [];
  const dark: Mark[] = [];
  for (const c of cubes) {
    const h = Math.min(3.4, c.w * 0.14);
    tiles.push({ poly: rough([{ x: c.x - 0.7, y: c.y + 0.4 }, { x: c.x + 2.2, y: c.y - h }, { x: c.x + c.w - 2.2, y: c.y - h }, { x: c.x + c.w + 0.7, y: c.y + 0.4 }], rng, 0.2, 1.5), alpha: 0.75 });
    dark.push({ poly: [{ x: c.x + c.w * 0.62, y: c.y - h + 0.2 }, { x: c.x + c.w - 2.2, y: c.y - h }, { x: c.x + c.w + 0.7, y: c.y + 0.4 }, { x: c.x + c.w * 0.7, y: c.y + 0.4 }], alpha: 0.4 });
    dark.push({ poly: box(c.x, c.y + 0.4, c.x + c.w, c.y + 1.2), alpha: 0.3 });
  }
  yield* wetBatch(p, tiles, TILE, { edge: 0.25, sharpness: 0.7, granulation: 0.4 });
  yield* wetBatch(p, dark, mix(TILE, HAZE.hole, 0.5), { edge: 0.1, sharpness: 0.6 });
}

/** A slender bell tower in the lower village: a white shaft, an arched bell storey, a small tiled cap. */
function* paintCampanile(p: Painter, rng: Rng): Strokes {
  const { x, y, w, h } = CAMPANILE;
  const top = y - h;
  yield* liftBatch(p, [{ poly: rough(box(x - w / 2, top, x + w / 2, y), rng, 0.15, 1.5), alpha: 0.97 }], HAZE.white, { edge: 0.05, sharpness: 0.9, granulation: 0 });
  yield* wetBatch(p, [
    { poly: box(x + w * 0.12, top + 0.4, x + w / 2 + 0.1, y), alpha: 0.42 },
    { poly: box(x - w / 2 - 0.3, top + 4.6, x + w / 2 + 0.3, top + 5.3), alpha: 0.4 },
    { poly: box(x - w / 2 - 0.4, y - 0.6, x + w / 2 + 0.4, y + 0.6), alpha: 0.3 },
  ], HAZE.wall, { edge: 0.2, sharpness: 0.8 });
  yield* wetBatch(p, [
    { poly: rough([{ x: x - 1, y: top + 4.2 }, { x: x - 1, y: top + 2.4 }, { x, y: top + 1.5 }, { x: x + 1, y: top + 2.4 }, { x: x + 1, y: top + 4.2 }], rng, 0.1, 1), alpha: 0.8 },
    { poly: box(x - 0.45, top + 8.4, x + 0.45, top + 9.6), alpha: 0.7 },
  ], HAZE.hole, { edge: 0.3, edgeWidth: 0.5, sharpness: 0.8 });
  yield* wetBatch(p, [{ poly: rough([{ x: x - w / 2 - 0.5, y: top + 0.2 }, { x, y: top - 3.2 }, { x: x + w / 2 + 0.5, y: top + 0.2 }], rng, 0.1, 1), alpha: 0.75 }], TILE, { edge: 0.25, sharpness: 0.7 });
}

/** Cypresses among the houses and by the road: slim dark spires, lit a little on their left. */
function* paintCypresses(p: Painter, rng: Rng): Strokes {
  const body: Mark[] = [];
  const lit: Mark[] = [];
  for (const c of FAR_CYPRESSES) {
    const side = (s: number, t: number) => ({ x: c.x + s * c.w * Math.sin(Math.PI * (0.12 + t * 0.88)) ** 0.7, y: c.y - c.h * (1 - t) });
    const spire: Pt[] = [];
    for (let i = 0; i <= 10; i++) spire.push(side(-1, i / 10));
    for (let i = 10; i >= 0; i--) spire.push(side(1, i / 10));
    body.push({ poly: rough(spire, rng, 0.25, 1.5), alpha: rng.range(0.6, 0.72) });
    lit.push({ poly: ribbon([{ x: c.x - c.w * 0.45, y: c.y - c.h * 0.8 }, { x: c.x - c.w * 0.55, y: c.y - c.h * 0.2 }], () => 0.3), alpha: 0.3 });
  }
  yield* wetBatch(p, body, mix(HAZE.dark, CYPRESS, 0.5), { edge: 0.25, sharpness: 0.7, granulation: 0.3 });
  yield* liftBatch(p, lit, HAZE.maquis, { edge: 0 });
}

/**
 * The hill's foot at the water: low rock either side, a strip of shingle with two boats drawn up,
 * the quay under the lower houses and the mole curving out to its light; small boats in its lee,
 * each over a short dark reflection; and a sail far out in the gap.
 */
function* paintHarbour(p: Painter, rng: Rng): Strokes {
  const rock: Mark[] = [];
  const wet: Mark[] = [];
  const lit: Mark[] = [];
  for (const s of HILL_SHORE) {
    // a low rocky point or two: a mass of overlapping rocks, highest in its middle, its lit tops broken
    for (let x = s.x0 + rng.range(0, 6); x < s.x1 - 6; ) {
      const len = Math.min(s.x1 - x, rng.range(10, 24));
      for (let q = x; q < x + len; q += rng.range(2, 4)) {
        const u = (q - x) / len;
        const h = (1.4 + Math.sin(Math.PI * u) * rng.range(1, 2.6)) * (0.6 + s.jut * 0.2);
        const w = rng.range(2.5, 5);
        const foot = HORIZON + Math.sin(Math.PI * u) * s.jut * rng.range(0.5, 1);
        rock.push({ poly: blob(q, foot - h / 2, w / 2, h / 2 + 0.3, rng, { irregularity: 0.35, points: 10, flatBottom: 0.6 }), alpha: rng.range(0.22, 0.34) });
        if (rng.chance(0.6)) lit.push({ poly: blob(q - w * 0.12, foot - h * 0.85, w * 0.3, Math.max(0.35, h * 0.16), rng, { irregularity: 0.3, points: 8 }), alpha: 0.55 });
        wet.push({ poly: box(q - w / 2 + 0.4, foot - 0.45, q + w / 2 - 0.4, foot + 0.35), alpha: 0.32 });
      }
      x += len + rng.range(6, 22);
    }
  }
  yield* wetBatch(p, rock, mix(HAZE.hill, HAZE.dark, 0.3), { edge: 0.2, sharpness: 0.6, granulation: 0.5 });
  yield* liftBatch(p, lit, HAZE.white, { edge: 0, sharpness: 0.5 });
  yield* wetBatch(p, wet, mix(HAZE.dark, HAZE.hole, 0.4), { edge: 0.2, sharpness: 0.6 });
  // the quay, the mole and the shingle: a lit top, the stone's face in shade down to the water
  yield* liftBatch(p, [HARBOUR.quay, HARBOUR.mole, HARBOUR.shingle].map((poly) => ({ poly: rough(poly, rng, 0.15, 2), alpha: 0.9 })), mix(HAZE.white, '#e8dcc4', 0.35), { edge: 0.05, sharpness: 0.7 });
  const faces = [HARBOUR.quay, HARBOUR.mole].map((poly) => {
    const low = poly.slice(poly.length / 2);
    return { poly: [...low.map((q) => ({ x: q.x, y: q.y - 1.2 })).reverse(), ...low], alpha: 0.55 };
  });
  yield* wetBatch(p, faces, mix(HAZE.wall, HAZE.dark, 0.3), { edge: 0.15, sharpness: 0.7 });
  const white: Mark[] = [];
  const blue: Mark[] = [];
  const dark: Mark[] = [];
  for (const b of HARBOUR.boats) {
    const half = b.w / 2;
    const y = b.y;
    (b.colour === 'blue' ? blue : white).push({ poly: [{ x: b.x - half, y: y - 1.5 }, { x: b.x + half, y: y - 1.9 }, { x: b.x + half - 1, y }, { x: b.x - half + 0.7, y }], alpha: 0.95 });
    dark.push({ poly: [{ x: b.x - half, y: y - 1.6 }, { x: b.x + half, y: y - 2 }, { x: b.x + half, y: y - 1.5 }, { x: b.x - half, y: y - 1.1 }], alpha: 0.6 });
    dark.push(b.beached ? { poly: box(b.x - half + 0.5, y, b.x + half, y + 0.7), alpha: 0.35 } : { poly: rough(box(b.x - half + 0.6, y + 0.3, b.x + half - 1, y + 1.6), rng, 0.25, 1), alpha: 0.3 });
  }
  const { light } = HARBOUR;
  white.push({ poly: box(light.x - 0.8, light.y - 5.2, light.x + 0.8, light.y), alpha: 0.95 });
  dark.push({ poly: box(light.x + 0.1, light.y - 5, light.x + 0.9, light.y), alpha: 0.35 });
  const s = FAR_SAIL;
  white.push({ poly: [{ x: s.x - 0.1, y: s.y - 4.6 }, { x: s.x + 2, y: s.y - 0.9 }, { x: s.x - 0.3, y: s.y - 0.9 }], alpha: 0.9 });
  dark.push({ poly: box(s.x - 0.9, s.y - 0.8, s.x + 2.2, s.y), alpha: 0.35 });
  yield* liftBatch(p, white, HAZE.white, { edge: 0.05, sharpness: 0.9 });
  yield* wetBatch(p, blue, BOAT_BLUE, { edge: 0.2, sharpness: 0.8 });
  yield* wetBatch(p, dark, HAZE.hole, { edge: 0.15, sharpness: 0.7 });
}

/** The chapel on the crest: a white cell under a blue dome, a small bell wall on its left. */
function* paintChapel(p: Painter, rng: Rng): Strokes {
  const { x, y } = CHAPEL;
  const cell = rough(box(x - 10, y + 0.5, x + 10, y + 15), rng, 0.3, 2);
  const drum = rough(box(x - 7, y - 2, x + 7, y + 1), rng, 0.25, 2);
  const bell = rough([{ x: x - 20, y: y + 15 }, { x: x - 20, y: y - 4 }, { x: x - 18, y: y - 7.5 }, { x: x - 15.5, y: y - 9 }, { x: x - 13, y: y - 7.5 }, { x: x - 11, y: y - 4 }, { x: x - 11, y: y + 15 }], rng, 0.25, 2);
  yield* liftBatch(p, [cell, drum, bell].map((poly) => ({ poly, alpha: 0.97 })), HAZE.white, { edge: 0.05, sharpness: 0.9, granulation: 0 });
  yield* wetBatch(p, [
    { poly: box(x + 4.5, y + 0.8, x + 10.2, y + 15), alpha: 0.42 },
    { poly: box(x + 3, y - 2, x + 7.2, y + 1), alpha: 0.4 },
    { poly: box(x - 13.5, y - 6, x - 11, y + 15), alpha: 0.35 },
    { poly: box(x - 20.5, y + 14, x + 10.5, y + 15.6), alpha: 0.4 },
  ], HAZE.wall, { edge: 0.2, sharpness: 0.8 });
  // the door, the bell's arch and the bell
  yield* wetBatch(p, [
    { poly: rough([{ x: x - 4, y: y + 15 }, { x: x - 4, y: y + 9 }, { x: x - 2.6, y: y + 7.6 }, { x: x - 1.2, y: y + 9 }, { x: x - 1.2, y: y + 15 }], rng, 0.15, 1), alpha: 0.8 },
    { poly: rough([{ x: x - 17.6, y: y + 1 }, { x: x - 17.6, y: y - 3.6 }, { x: x - 15.5, y: y - 5.6 }, { x: x - 13.4, y: y - 3.6 }, { x: x - 13.4, y: y + 1 }], rng, 0.15, 1), alpha: 0.75 },
  ], HAZE.hole, { edge: 0.3, edgeWidth: 0.6, sharpness: 0.8 });
  // the dome: one clear blue note, lit on its left shoulder, a little deeper to the right; a small cross
  const dome: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    dome.push({ x: x + Math.cos(a) * 8.6, y: y - 1.6 + Math.sin(a) * 8.4 });
  }
  yield* wetBatch(p, [{ poly: rough(dome, rng, 0.2, 1.5), alpha: 0.92 }], HAZE.dome, { edge: 0.35, edgeWidth: 1, sharpness: 0.8, granulation: 0.2, blend: 'source-over' });
  yield* wetBatch(p, [{ poly: dome.filter((q) => q.x > x + 1).concat({ x: x + 1.5, y: y - 1.6 }), alpha: 0.4 }], HAZE.domeDeep, { edge: 0.1, sharpness: 0.4 });
  yield* liftBatch(p, [{ poly: rough(ellipse(x - 3.2, y - 5, 1.8, 2.2, 10), rng, 0.2, 1), alpha: 0.45 }], HAZE.white, { edge: 0 });
  yield* wetBatch(p, [
    { poly: box(x - 0.35, y - 13.5, x + 0.35, y - 8.6), alpha: 0.75 },
    { poly: box(x - 1.8, y - 12.2, x + 1.8, y - 11.6), alpha: 0.7 },
  ], HAZE.hole, { edge: 0.1, sharpness: 0.8 });
}
