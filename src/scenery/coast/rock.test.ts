/**
 * The coast's rock (G2): the far hill and village, the promontory, the temple and the shore's
 * rock painted in parts within the cooperative painter's bounds (ADR 0226, 0330), deterministic,
 * meeting the sky without paper, and keeping the splash rocks' tops where their slots stand.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { bounds, createPainter, makeCanvas } from '../../paint';
import { pointInPolygon, resample } from '../../paint/geometry';
import { applyView, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { COAST_ART, COAST_ELEMENTS } from '.';
import { FAR_HILL, HORIZON, LAND, PROMONTORY, SHORE_EDGE, SPLASH_ROCKS, TEMPLE_SHAPES, WALLS } from './layout';
import { PROMONTORY_FORM, SHORE_RUNS, footAt, topAt } from './paint-rocks';
import { coastSteps } from './painters';
import { rough } from './rock-kit';
import { SUN_R, UNITS_PER_DEGREE } from '../../ambience/sky-layout';
import { CHAPEL_ROAD, FAR_CYPRESSES, FAR_OLIVES, FIELD_TERRACES, GAP_ISLANDS, HARBOUR, HILL_SHORE, PASTEL_WALLS, TILED_ROOFS } from './distance';
import { CLIFF_STONES, LEDGE_SCRUB, SHORE_BOULDER_SHAPES, SPLASH_ROCK_SHAPES } from './shapes';
import { COAST_WILDLIFE } from './wildlife';
import { FOOT_BOULDER_SHAPES, FOOT_SHELF } from './lip-shapes';
import { BACK_EDGES, FACE_FEET, PLATFORM_FACES } from './platform';
import { CLIFF_FOOT } from './sea';
import { SEA_WATER } from './geometry';
import { COAST_SLOTS } from './slots';
import { columnShapes } from './temple';
import { VILLAGE_CUBES } from './shapes';

// the painters are a lazy chunk (ADR 0341)
beforeAll(() => COAST_ART.painters.load());

/** The rock painter's own steps (the promontory's pines and scrub are the vegetation's). */
const MINE = ['far-hill', 'village', 'promontory', 'temple', 'cliff-foot', 'platform', 'shore-rocks'];
const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the temple
const DETAIL: PaintView = { rect: { x: 640, y: 270, w: 270, h: 150 }, scale: 3 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const canvas = makeCanvas(view.rect.w * view.scale, view.rect.h * view.scale);
    const p = createPainter(canvas, { seed: COAST_ART.seed });
    const soft = createPainter(canvas, { seed: COAST_ART.seed, quality: 'draft' });
    const chunks: Chunk[] = [];
    rec.mark();
    for (const step of coastSteps(COAST_ART).filter((s) => MINE.includes(s.name))) {
      const painter = step.soft ? soft : p;
      applyView(painter, view);
      const marks = step.run(painter);
      while (marks && !marks.next().done) chunks.push({ name: step.name, ...rec.mark() });
      chunks.push({ name: step.name, ...rec.mark() });
    }
    return { hash: rec.hash, chunks };
  } finally {
    uninstall();
  }
}

/** Distance from q to the closed polygon's outline. */
function toOutline(q: { x: number; y: number }, poly: readonly { x: number; y: number }[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t));
  }
  return d;
}

describe('coast rock painting (G2)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.again = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 120_000);

  it('paints the far hill, the village, the promontory, the temple and the shore’s rock as their own steps', () => {
    expect(COAST_ELEMENTS.far).toEqual(['far-hill']);
    expect(COAST_ELEMENTS.rock).toEqual(['village', 'promontory', 'temple']);
    expect(COAST_ELEMENTS.stones).toEqual(['cliff-foot', 'platform', 'shore-rocks']);
    // the cliff's foot, the platform and the shore's rock go over the land's edge and the water, before the trees
    const names = coastSteps(COAST_ART).map((s) => s.name);
    expect(names.indexOf('cliff-foot')).toBeGreaterThan(names.indexOf('beds'));
    expect(names.indexOf('cliff-foot')).toBeLessThan(names.indexOf('olive'));
    expect(names.indexOf('platform')).toBeGreaterThan(names.indexOf('walls'));
    expect(names.indexOf('shore-rocks')).toBeGreaterThan(names.indexOf('platform'));
    expect(names.indexOf('shore-rocks')).toBeLessThan(names.indexOf('shore'));
    expect(names.indexOf('shore-rocks')).toBeLessThan(names.indexOf('pine'));
  });

  it('is deterministic: the same marks every time', () => {
    // quantised hashes from a fresh process, pinned as the oasis's (paint caches warm up across runs)
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '0ba1cd6f', detail: '54624ba2' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('pauses inside every step: no part lays more than 60 000 calls or 400 000 pixels (%s, ADR 0330)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(60_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
    // the cliff's foot and the platform skip themselves when the view does not reach them (the detail view is the temple)
    for (const step of MINE.filter((s) => view === 'overview' || (s !== 'cliff-foot' && s !== 'platform'))) expect(chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(10);
  });

  it('keeps the promontory and the cliff’s foot in many parts, each pixel read in a part of its own (GR1)', () => {
    const parts = (view: string, step: string) => runs[view]!.chunks.filter((c) => c.name === step);
    expect(parts('overview', 'promontory').length).toBeGreaterThanOrEqual(300);
    expect(parts('detail', 'promontory').length).toBeGreaterThanOrEqual(450);
    expect(parts('overview', 'cliff-foot').length).toBeGreaterThanOrEqual(140);
    for (const step of ['promontory', 'temple', 'cliff-foot']) for (const c of parts('overview', step)) expect(c.reads, step).toBeLessThanOrEqual(1);
  });

  it('dries its runs of like marks as shared layers: few pixel reads per step', () => {
    const reads = (step: string) => runs.overview!.chunks.filter((c) => c.name === step).reduce((a, c) => a + c.reads, 0);
    for (const step of MINE) expect(reads(step), step).toBeLessThanOrEqual(260);
  });
});

describe('the rock meets the sky and the water', () => {
  it('keeps the hand-cut outlines within the sky’s hang', () => {
    for (const poly of [PROMONTORY, FAR_HILL]) {
      for (const q of rough(poly, createRng(3), 1.2, 4)) expect(toOutline(q, poly)).toBeLessThanOrEqual(2);
    }
  });

  it('reads the promontory’s top as the skyline and its foot as the water or the top terrace', () => {
    for (let x = 640; x <= 1610; x += 10) {
      expect(pointInPolygon({ x, y: (topAt(x) + footAt(x)) / 2 }, PROMONTORY), `${x}`).toBe(true);
      expect(footAt(x) - topAt(x), `${x}`).toBeGreaterThan(5);
    }
  });

  it('cuts the face into blocks at fissures of uneven spacing, with harder beds as ledges', () => {
    const { fissures, beds } = PROMONTORY_FORM;
    const deep = fissures.filter((f) => f.depth > 0.75);
    expect(deep.length).toBeGreaterThanOrEqual(8);
    const gaps = fissures.slice(1).map((f, i) => f.x - fissures[i]!.x);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(2);
    expect(beds.filter((b) => b.hard).length).toBeGreaterThanOrEqual(3);
    expect(new Set(beds.slice(1).map((b, i) => Math.round(b.y - beds[i]!.y))).size).toBeGreaterThan(4);
  });

  it('covers each column’s skyline shape, a broken one up to its slanted break, so no paper shows under the sky’s line', () => {
    const cols = columnShapes();
    cols.forEach((c, i) => {
      const shape = TEMPLE_SHAPES[i]!;
      const top = Math.min(...c.outline.map((q) => q.y));
      const shapeTop = Math.min(...shape.map((q) => q.y));
      // whole shafts end under their capital, which the capital's own shape covers
      expect(top, `${c.x}`).toBeLessThanOrEqual(c.whole ? shapeTop + 9 : shapeTop + 0.5);
      if (!c.whole) for (const q of c.outline.filter((r) => r.y < c.top + 7 && Math.abs(r.x - c.x) < 6)) expect(q.y, `${q.x}`).toBeLessThanOrEqual(c.top + ((q.x - (c.x - 8)) / 16) * 6 + 0.5);
    });
  });

  it('splits the shoreline into the runs that show a face and the runs that show a lip', () => {
    expect(SHORE_RUNS.face.length).toBeGreaterThanOrEqual(2);
    expect(SHORE_RUNS.lip.length).toBeGreaterThanOrEqual(2);
    for (const run of SHORE_RUNS.face) for (let i = 1; i < run.length; i++) expect(run[i]!.x).toBeGreaterThan(run[i - 1]!.x);
  });
});

describe('the splash rocks and the shoreline’s blocks', () => {
  it('stands each splash slot on its rock’s flat top, the rock on its layout place', () => {
    for (const [i, r] of SPLASH_ROCK_SHAPES.entries()) {
      expect(r.x).toBe(SPLASH_ROCKS[i]!.x);
      expect(r.topY, `rock ${i}`).toBeLessThan(r.y - 6);
      const slot = COAST_SLOTS.find((s) => s.id.startsWith('splash') && Math.abs(s.x - r.x) < 4);
      if (!slot) continue;
      expect(pointInPolygon({ x: slot.x, y: slot.y }, r.top), slot.id).toBe(true);
      expect(pointInPolygon({ x: slot.x, y: slot.y }, r.outline), slot.id).toBe(true);
    }
    expect(SPLASH_ROCK_SHAPES.filter((r) => COAST_SLOTS.some((s) => s.id.startsWith('splash') && Math.abs(s.x - r.x) < 4)).length).toBe(3);
  });

  it('stands the whole base of each splash rock’s plant on the rock’s dry top, not on the water', () => {
    for (const s of COAST_SLOTS.filter((q) => q.habitat === 'rock')) {
      const r = SPLASH_ROCK_SHAPES.find((q) => Math.abs(q.x - s.x) < 4);
      if (!r) continue;
      // a plant's base: as wide as the stem cluster of a small plant at the slot's scale, at its foot
      const half = 8 * s.scale;
      for (const dx of [-half, 0, half]) expect(pointInPolygon({ x: s.x + dx, y: s.y }, r.top), `${s.id} ${dx.toFixed(1)}`).toBe(true);
    }
  });

  it('keeps every rock wider than tall, its top inside its outline', () => {
    for (const r of [...SPLASH_ROCK_SHAPES, ...SHORE_BOULDER_SHAPES, ...CLIFF_STONES]) {
      const xs = r.outline.map((q) => q.x);
      const ys = r.outline.map((q) => q.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
      const c = r.top.reduce((a, q) => ({ x: a.x + q.x / r.top.length, y: a.y + q.y / r.top.length }), { x: 0, y: 0 });
      expect(pointInPolygon(c, r.outline)).toBe(true);
    }
  });

  it('builds the village on the far hill, its houses stepping up the slope in rows', () => {
    const cubes = VILLAGE_CUBES.flat();
    expect(cubes.length).toBeGreaterThan(14);
    for (const c of cubes) expect(pointInPolygon({ x: c.x + c.w / 2, y: c.y + c.h - 1 }, FAR_HILL), `${c.x},${c.y}`).toBe(true);
    const rowY = VILLAGE_CUBES.map((row) => Math.min(...row.map((c) => c.y)));
    for (let i = 1; i < rowY.length; i++) expect(rowY[i]!).toBeGreaterThanOrEqual(rowY[i - 1]! - 8);
  });
});

describe('coast far shore and cliff detail (GB1)', () => {
  const houses = VILLAGE_CUBES.flat();
  const inHouse = (x: number, y: number) => houses.some((c) => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h);

  it('keeps the far islands low in the gap: a sun from 2° up stands over them, lower it sets behind them', () => {
    for (const q of GAP_ISLANDS.flat()) {
      expect(q.y).toBeGreaterThanOrEqual(HORIZON - 14);
      expect(q.y).toBeLessThanOrEqual(HORIZON);
    }
    // the sun's centre at 2°; the disc's lower part is the painting's (paper reserved over the island)
    expect(HORIZON - 2 * UNITS_PER_DEGREE).toBeLessThan(Math.min(...GAP_ISLANDS.flat().map((q) => q.y)));
    expect(SUN_R).toBeGreaterThan(HORIZON - Math.min(...GAP_ISLANDS.flat().map((q) => q.y)));
  });

  it('puts the harbour on the hill’s waterline, above the bay where the far creatures go', () => {
    for (const q of [...HARBOUR.quay, ...HARBOUR.mole, ...HARBOUR.shingle, HARBOUR.light]) {
      expect(q.y).toBeGreaterThan(HORIZON - 3);
      expect(q.y).toBeLessThan(HORIZON + 8);
      expect(q.x).toBeGreaterThan(200);
      expect(q.x).toBeLessThan(470);
    }
    for (const b of HARBOUR.boats) expect(b.y).toBeLessThan(HORIZON + 8);
    for (const s of HILL_SHORE) expect(s.x1).toBeLessThanOrEqual(516);
  });

  it('plants the far groves and cypresses on the hill, never inside a house', () => {
    expect(FAR_OLIVES.length).toBeGreaterThan(40);
    for (const o of FAR_OLIVES) {
      expect(pointInPolygon(o, FAR_HILL), `${o.x},${o.y}`).toBe(true);
      expect(inHouse(o.x, o.y), `${o.x},${o.y}`).toBe(false);
    }
    for (const c of FAR_CYPRESSES) {
      expect(pointInPolygon({ x: c.x, y: c.y - 1 }, FAR_HILL)).toBe(true);
      expect(inHouse(c.x, c.y - 1), `${c.x},${c.y}`).toBe(false);
    }
    for (const q of CHAPEL_ROAD) expect(inHouse(q.x, q.y), `${q.x},${q.y}`).toBe(false);
    expect(FIELD_TERRACES.length).toBeGreaterThan(20);
    for (const i of [...TILED_ROOFS, ...PASTEL_WALLS.map((w) => w.cube)]) expect(houses[i]).toBeDefined();
  });

  it('keeps the ledges’ scrub off the goats’ ways and the slots', () => {
    expect(LEDGE_SCRUB.length).toBeGreaterThan(8);
    const ledges = (COAST_WILDLIFE.perches ?? []).filter((p) => p.kind === 'ledge');
    expect(ledges.length).toBeGreaterThan(50);
    for (const s of LEDGE_SCRUB) {
      for (const l of ledges) expect(Math.hypot(s.x - l.x, s.y - l.y), `${s.x},${s.y} by ${l.id}`).toBeGreaterThan(l.spread + 4);
      for (const slot of COAST_SLOTS) expect(Math.hypot(s.x - slot.x, s.y - slot.y)).toBeGreaterThan(30);
      expect(s.y).toBeGreaterThan(topAt(s.x));
      expect(s.y).toBeLessThan(footAt(s.x));
    }
  });
});

describe('the platform above the sea (GO1, ADR 0388) and the cliff’s wave-cut shelf (GA1)', () => {
  const dist = (q: { x: number; y: number }, line: readonly { x: number; y: number }[]) =>
    Math.min(...line.map((r) => Math.hypot(r.x - q.x, r.y - q.y)));
  const onShore = (q: { x: number; y: number }) => SHORE_EDGE.some((r) => r.x === q.x && r.y === q.y);

  it('drops a face from each headland’s rim to its foot on the shoreline, taller than the wall it ends', () => {
    expect(PLATFORM_FACES.map((f) => f.id)).toEqual(['top', 'bastion']);
    for (const f of PLATFORM_FACES) {
      for (const q of f.foot) expect(onShore(q), `${f.id} ${q.x},${q.y}`).toBe(true);
      // the rim runs from the headland's west corner to the coping of the wall that holds its terrace
      expect(onShore(f.rim[0]!), f.id).toBe(true);
      expect(f.rim[f.rim.length - 1]).toEqual(WALLS[f.wall]!.edge[0]);
      for (let i = 1; i < f.foot.length; i++) expect(f.foot[i]!.x, f.id).toBeGreaterThan(f.foot[i - 1]!.x);
      // the foot lies below the rim all along: at least 45 units of rock, more than the wall's height
      for (const q of f.foot) {
        const rim = f.rim.reduce((a, r) => (Math.abs(r.x - q.x) < Math.abs(a.x - q.x) ? r : a));
        expect(q.y - rim.y, `${f.id} ${q.x}`).toBeGreaterThanOrEqual(45);
      }
      expect(Math.max(...f.foot.map((q) => q.y)) - f.rim[f.rim.length - 1]!.y, f.id).toBeGreaterThan(WALLS[f.wall]!.h);
      // the face is land: the sea stops at its foot
      const b = bounds(f.outline);
      expect(pointInPolygon({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, LAND), f.id).toBe(true);
      expect(pointInPolygon({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, SEA_WATER), f.id).toBe(false);
    }
    // the top terrace's headland stands higher in the picture than the bastion below it
    expect(PLATFORM_FACES[0]!.rim[0]!.y).toBeLessThan(PLATFORM_FACES[1]!.rim[0]!.y - 100);
    // the motion's breaks follow each foot
    FACE_FEET.forEach((f, i) => expect(dist(f[0]!, PLATFORM_FACES[i]!.foot) + dist(f[f.length - 1]!, PLATFORM_FACES[i]!.foot)).toBeLessThan(1));
  });

  it('runs every back edge down to the left on the shoreline: the floor’s rim over the water, its face turned away', () => {
    expect(BACK_EDGES.length).toBe(3);
    for (const e of BACK_EDGES) {
      for (const q of e) expect(onShore(q), `${q.x},${q.y}`).toBe(true);
      for (let i = 1; i < e.length; i++) expect(e[i]!.x).toBeLessThan(e[i - 1]!.x);
    }
  });

  it('drops the fallen blocks into the water at a face’s foot, off the water slots', () => {
    const fallen = SHORE_BOULDER_SHAPES.filter((r) => !r.ground);
    expect(fallen.length).toBeGreaterThanOrEqual(4);
    for (const r of fallen) {
      expect(pointInPolygon({ x: r.x, y: r.y - 1 }, SEA_WATER), `${r.x},${r.y}`).toBe(true);
      expect(Math.min(...FACE_FEET.map((f) => dist(r, f))), `${r.x},${r.y}`).toBeLessThan(40);
      for (const s of COAST_SLOTS.filter((q) => q.habitat === 'water')) expect(Math.hypot(s.x - r.x, s.y - r.y), s.id).toBeGreaterThan(40);
    }
  });

  it('keeps the cliff’s fallen blocks off the other rocks and the water slots, and in the water', () => {
    const others = [...SHORE_BOULDER_SHAPES, ...SPLASH_ROCK_SHAPES].map((r) => bounds(r.outline));
    for (const r of FOOT_BOULDER_SHAPES) {
      const b = bounds(r.outline);
      for (const o of others) expect(o.x < b.x + b.w && b.x < o.x + o.w && o.y < b.y + b.h && b.y < o.y + o.h, `${r.x},${r.y}`).toBe(false);
      for (const s of COAST_SLOTS.filter((q) => q.habitat === 'water')) expect(Math.hypot(s.x - r.x, s.y - r.y), s.id).toBeGreaterThan(40);
      expect(pointInPolygon({ x: r.x, y: r.y - 1 }, SEA_WATER), `${r.x},${r.y}`).toBe(true);
    }
  });

  it('gives the cliff’s foot a broken shelf, with gaps where the face drops straight in', () => {
    const { depth, front } = FOOT_SHELF;
    expect(depth.filter((d) => d === 0).length).toBeGreaterThan(8);
    expect(depth.filter((d) => d > 4).length).toBeGreaterThan(8);
    for (const q of front) expect(dist(q, resample(CLIFF_FOOT, 3))).toBeLessThanOrEqual(10);
  });
});
