/**
 * The coast's vegetation (G4): the maquis, olive and pine painted in parts within the cooperative
 * painter's bounds, deterministic; the scenery olive is the olive species' tree; the perches the
 * wildlife reads; and no scenery plant stands on a slot.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { visibleBranches } from '../../plants/lib/tree-paint';
import { treeView } from '../../plants/lib/tree-structure';
import { planOlive } from '../../plants/species/olive';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { PLANT_SIZES, plantScale } from '../../scene/slots';
import { COAST_ART, COAST_ELEMENTS } from '.';
import { LAND, OLIVE, PINE } from './layout';
import { coastSteps } from './painters';
import { copingY, GRASS, MAQUIS, OLIVE_LIMBS, OLIVE_TREE, PHRYGANA, PINE_BRANCHES, PINE_PADS, PINE_TRUNK, promontoryTop, SHORE_CLUMPS, WALL_GRASS } from './shapes';
import { COAST_SLOTS } from './slots';

// the painters are a lazy chunk (ADR 0341)
beforeAll(() => COAST_ART.painters.load());

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the olive's trunk and crown, at 1.6×
const DETAIL: PaintView = { rect: { x: 1100, y: 300, w: 400, h: 260 }, scale: 1.6 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(COAST_ART, view, { only: ['trees'], now: () => 0 });
    const chunks: Chunk[] = [];
    rec.mark();
    for (;;) {
      const r = job.next();
      if (r.done) break;
      chunks.push({ name: r.value, ...rec.mark() });
    }
    return { hash: rec.hash, chunks };
  } finally {
    uninstall();
  }
}

describe('coast vegetation painting (G4)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
    runs.again = record(OVERVIEW);
  }, 180_000);

  it('paints the maquis, the olive and the pine as their own steps', () => {
    expect(COAST_ELEMENTS.trees).toEqual(['maquis', 'olive', 'pine']);
    expect(coastSteps(COAST_ART, ['trees']).map((s) => s.name)).toEqual(['maquis', 'olive', 'pine']);
  });

  // quantised hashes from a fresh process's first runs (paint caches warm up, so a later run differs)
  it('is deterministic: the same marks every time (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '1d811838', detail: '980ca25b' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    // the olive species' trunk (one call of its painter) dries its layers over the scaffold limbs' box: 514 k at 1.6×
    const cap = (c: Chunk) => (c.name === 'olive' ? 520_000 : 400_000);
    for (const c of chunks) expect(c.pixels, c.name).toBeLessThanOrEqual(cap(c));
  });

  it('pauses inside every step: each comes in several parts', () => {
    for (const step of ['maquis', 'olive', 'pine']) expect(runs.overview!.chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(5);
  });

  it('paints the scenery olive as the olive species’ tree, its trunk and limbs where the perches say (ADR 0367)', () => {
    const plan = planOlive(createRng(OLIVE_TREE.seed));
    const view = treeView(1, plan.tree.base);
    const trunk = plan.tree.branches[0]!;
    const vis = visibleBranches(plan.tree, view).filter((v) => v.b.id === trunk.id || v.b.parent === trunk.id);
    const b = plan.tree.base;
    const k = OLIVE_TREE.scale;
    const world = vis.map((v) =>
      [0, 1, 2, 3, 4].map((i) => v.path[Math.round((i * (v.path.length - 1)) / 4)]!).map((q) => ({ x: Math.round(OLIVE.base.x + (q.x - b.x) * k), y: Math.round(OLIVE.base.y + (q.y - b.y) * k) })),
    );
    expect(OLIVE_TREE.base).toEqual(OLIVE.base);
    expect(world).toEqual(OLIVE_LIMBS);
  });

  it('roots the pine on its rock, its branches on the trunk, its crown in the sky clear of the chapel', () => {
    expect(PINE_TRUNK[0]).toEqual(PINE.base);
    expect(PINE_TRUNK.at(-1)).toEqual(PINE.top);
    for (const br of PINE_BRANCHES) expect(Math.min(...PINE_TRUNK.map((q) => Math.hypot(q.x - br[0]!.x, q.y - br[0]!.y)))).toBeLessThan(40);
    for (const pad of PINE_PADS) {
      expect(pad.x - pad.rx).toBeGreaterThan(-40);
      expect(pad.y - pad.ry).toBeGreaterThan(100);
      expect(Math.hypot(pad.x - 232, (pad.y - 290) * 2) > pad.rx + 10, `${pad.x}`).toBe(true);
    }
  });

  it('keeps the maquis on the promontory’s back and the low plants on the land', () => {
    for (const m of MAQUIS) {
      const top = promontoryTop(Math.min(1619, m.x))!;
      expect(m.y).toBeGreaterThan(top);
      expect(m.y).toBeLessThan(top + 60);
    }
    for (const c of PHRYGANA) expect(pointInPolygon({ x: c.x, y: c.y }, LAND), `${c.x},${c.y}`).toBe(true);
    for (const [x, y] of GRASS) expect(pointInPolygon({ x, y }, LAND), `${x},${y}`).toBe(true);
  });

  it('puts no scenery plant on a slot: no footprint covers a slot’s base or the foot of its plant', () => {
    const feet: { id: string; x: number; y: number; r: number; ry?: number }[] = [
      ...PHRYGANA.map((c, i) => ({ id: `phrygana-${i}`, x: c.x, y: c.y, r: c.r })),
      ...SHORE_CLUMPS.map((c, i) => ({ id: `scrub-${i}`, x: c.x, y: c.y, r: c.rx })),
      ...GRASS.map(([x, y, h], i) => ({ id: `grass-${i}`, x, y, r: h * 0.4 })),
      ...WALL_GRASS.map(([w, x, d], i) => ({ id: `wall-grass-${i}`, x, y: copingY(w, x) + d, r: 8 })),
      // the trunks' flared feet: wide, but only a few units deep on the ground
      { id: 'olive', x: OLIVE.base.x, y: OLIVE.base.y, r: 34, ry: 6 },
      { id: 'pine', x: PINE.base.x, y: PINE.base.y, r: 20, ry: 6 },
    ];
    for (const s of COAST_SLOTS) {
      const k = plantScale(s);
      // the plant's foot: the lowest fifth of its box, as wide as a small plant
      const half = Math.min(PLANT_SIZES[s.maxSize].w, PLANT_SIZES.small.w) * k * 0.5;
      const h = PLANT_SIZES[s.maxSize].h * k * 0.2;
      const foot = { x: s.x - half, y: s.y - h, w: half * 2, h: h + 4 };
      for (const f of feet) {
        const dx = Math.max(foot.x - f.x, 0, f.x - (foot.x + foot.w));
        const dy = Math.max(foot.y - f.y, 0, f.y - (foot.y + foot.h));
        expect(Math.hypot(dx / f.r, dy / (f.ry ?? f.r)), `${f.id} on ${s.id}`).toBeGreaterThan(0.6);
      }
    }
    for (const s of COAST_SLOTS) for (const q of PINE_TRUNK) expect(Math.hypot(s.x - q.x, s.y - q.y), s.id).toBeGreaterThan(30);
    expect(bounds(PINE_TRUNK).x).toBeGreaterThanOrEqual(0);
  });
});
