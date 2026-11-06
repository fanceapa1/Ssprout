import { describe, expect, it } from 'vitest';
import { FaunaSim } from '../../fauna/sim';
import { closestOnPolygon, pointInPolygon } from '../../fauna/math';
import { perchY, wallFootAt, wallTopAt, type Perch } from '../../fauna/targets';
import type { Pt } from '../../render/viewport';
import { perspectiveScale } from '../../scene/slots';
import { OASIS } from '.';
import { BASIN_STONE, BASIN_WATER, OUED_WATER, SEGUIA, SLUICE_WATER } from './geometry';
import { HORN, KSAR_SHAPES } from './ksar';
import { BASIN, BLUFF, FOOTPATH, LIFT, NEAR_PLOTS, PATH_HALF_WIDTH, SEGUIA_FALLS, WALLS } from './layout';
import { FALLEN_STONES, NEAR_STONES, WALL_FACES } from './paint-land';
import { BASIN_STEPS, SLUICE_GATE } from './paint-water';
import { BIG_PALM_SHAPES, GROVE_PALMS } from './paint-veg';
import { OASIS_SLOTS } from './slots';
import { inOued, intoBasin, KSAR_SCALE, NEST, OASIS_GROUND, OASIS_PERCHES, OASIS_STANDS, OASIS_WALLS, OASIS_WILDLIFE, oasisPerspective } from './wildlife';

const of = (kind: Perch['kind']) => OASIS_PERCHES.filter((p) => p.kind === kind);
/** The perch's two ends and its middle, on its surface. */
const along = (p: Perch): Pt[] => [-1, 0, 1].map((u) => ({ x: p.x + u * p.spread, y: perchY(p, p.x + u * p.spread) }));
const segDist = (q: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
};
const lineDist = (q: Pt, line: readonly Pt[]) => Math.min(...line.slice(1).map((b, i) => segDist(q, line[i]!, b)));
const ellipse = (g: { x: number; y: number; rx: number; ry: number }): Pt[] =>
  Array.from({ length: 16 }, (_, i) => ({ x: g.x + Math.cos((i / 16) * Math.PI * 2) * g.rx, y: g.y + Math.sin((i / 16) * Math.PI * 2) * g.ry }));
const WATERS = [BASIN_STONE, ...SEGUIA, SLUICE_WATER, OUED_WATER];

describe('the oasis’s wildlife data', () => {
  it('is the scenery’s, with the basin still and the channels and oued moving', () => {
    expect(OASIS.fauna).toBe(OASIS_WILDLIFE);
    expect(OASIS_WILDLIFE.water!.still).toBe(BASIN_WATER);
    expect(OASIS_WILDLIFE.water!.moving).toEqual([...SEGUIA, SLUICE_WATER, OUED_WATER]);
    expect(OASIS_WILDLIFE.water!.avoid).toBeUndefined();
  });

  it('has every kind of perch, unique ids, each drawn in front of what it stands on', () => {
    const ids = OASIS_PERCHES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const counts = Object.fromEntries(['wall', 'rim', 'frond', 'tower', 'post', 'rock'].map((k) => [k, of(k as Perch['kind']).length]));
    expect(counts.wall).toBeGreaterThanOrEqual(12);
    expect(counts.rim).toBe(9);
    expect(counts.frond).toBeGreaterThanOrEqual(8);
    expect(counts).toMatchObject({ tower: 1, post: 2, rock: 5 });
    for (const p of OASIS_PERCHES) expect(p.depth, p.id).toBeGreaterThan(p.y);
  });
});

describe('perches', () => {
  it('wall perches lie along a terrace wall’s coping, clear of the seguia’s falls and the wall slots', () => {
    const walls = OASIS_WALLS.filter((w) => w.id.startsWith('wall-'));
    for (const p of of('wall')) {
      const face = walls.find((w) => p.id.startsWith(w.id))!;
      for (const q of along(p)) expect(Math.abs(q.y - wallTopAt(face, q.x)), p.id).toBeLessThan(1.2);
      expect(p.x).toBeGreaterThanOrEqual(face.top[0]!.x);
      expect(p.x).toBeLessThanOrEqual(face.top[face.top.length - 1]!.x);
      for (const f of SEGUIA_FALLS) expect(Math.hypot(f.top.x - p.x, f.top.y - p.y), p.id).toBeGreaterThan(20);
      for (const s of OASIS_SLOTS.filter((q) => q.id.startsWith('wall-'))) expect(Math.hypot(s.x - p.x, s.y - p.y), `${p.id} ${s.id}`).toBeGreaterThan(20);
    }
    for (const w of walls) expect(of('wall').some((p) => p.id.startsWith(w.id)), w.id).toBe(true);
  });

  it('rim perches lie on the basin’s coping, never over the water', () => {
    for (const p of of('rim')) {
      for (const q of along(p)) {
        expect(pointInPolygon(q, BASIN_STONE), p.id).toBe(true);
        expect(intoBasin(q), p.id).toBeLessThan(-0.5);
      }
    }
  });

  it('frond perches lie on a green front frond of their palm, in its crown, not behind a big palm, inside the world', () => {
    const palms = [...BIG_PALM_SHAPES.map((s, i) => [`palm-${i + 1}-`, s] as const), ...GROVE_PALMS.map((s) => [`grove-${Math.round(s.top.x)}-`, s] as const)];
    for (const p of of('frond')) {
      const palm = palms.find(([id]) => p.id.startsWith(id))![1];
      const fronds = palm.fronds.filter((f) => f.front && f.dry === 0);
      expect(Math.min(...fronds.map((f) => lineDist(p, f.path))), p.id).toBeLessThan(0.5);
      for (const q of along(p)) expect(Math.min(...fronds.map((f) => lineDist(q, f.path))), p.id).toBeLessThan(3);
      expect(pointInPolygon(p, palm.crown), p.id).toBe(true);
      for (const other of BIG_PALM_SHAPES) if (other !== palm) expect(pointInPolygon(p, other.crown), p.id).toBe(false);
      expect(p.x).toBeGreaterThanOrEqual(20);
      expect(p.x).toBeLessThanOrEqual(1580);
      expect(p.y).toBeGreaterThanOrEqual(50);
      expect(p.scale, p.id).toBe(oasisPerspective(palm.base.x, palm.base.y));
      expect(p.depth).toBeCloseTo(palm.base.y + 1, 0);
    }
  });

  it('the stork’s perch is the middle tower’s top, at the ksar’s own scale, with its nest', () => {
    const [p] = of('tower');
    const tower = KSAR_SHAPES.find((s) => s.block.id === NEST.towerId)!;
    const top = tower.block.base - tower.block.h;
    expect(tower.block.kind).toBe('tower');
    expect(Math.max(...KSAR_SHAPES.filter((s) => s.block.kind === 'tower').map((s) => s.block.h))).toBe(tower.block.h);
    expect(p!.x).toBe(NEST.x);
    expect(p!.y).toBeGreaterThan(top - HORN);
    expect(p!.y).toBeLessThan(top);
    expect(p!.x - p!.spread).toBeGreaterThan(tower.block.x + tower.block.w * 0.2);
    expect(p!.x + p!.spread).toBeLessThan(tower.block.x + tower.block.w * 0.8);
    expect(p!.scale).toBe(KSAR_SCALE);
    expect(KSAR_SCALE).toBeLessThan(perspectiveScale(tower.block.base));
  });

  it('the gate posts and the painted stones carry the dropwing and the small birds', () => {
    of('post').forEach((p, i) => {
      const post = SLUICE_GATE.posts[i]!;
      expect(p.x).toBeGreaterThan(post[0]!.x);
      expect(p.x).toBeLessThan(post[1]!.x);
      expect(Math.abs(p.y - post[0]!.y)).toBeLessThan(0.5);
    });
    const stones = [...FALLEN_STONES, ...NEAR_STONES.filter(([, y]) => y < 990)];
    expect(of('rock').map((p) => p.id)).toEqual(stones.map(([x, y]) => `stone-${x}-${y}`));
    for (const p of of('rock')) expect(p.y).toBeLessThan(Number(p.id.split('-')[2]));
  });
});

describe('ground, walls and stands', () => {
  it('the hoopoe’s spots lie on the plots or the raised terraces, off the water and the footpath', () => {
    for (const g of OASIS_GROUND) {
      for (const q of [{ x: g.x, y: g.y }, ...ellipse(g)]) {
        if (g.id.startsWith('plot-')) expect(NEAR_PLOTS.some((plot) => pointInPolygon(q, plot)), g.id).toBe(true);
        for (const w of WATERS) expect(pointInPolygon(q, w), g.id).toBe(false);
        expect(lineDist(q, FOOTPATH), g.id).toBeGreaterThan(PATH_HALF_WIDTH.near);
        expect(pointInPolygon(q, BLUFF), g.id).toBe(false);
        for (const face of OASIS_WALLS) expect(pointInPolygon(q, face.outline), `${g.id} ${face.id}`).toBe(false);
      }
    }
    const [high, middle] = [OASIS_WALLS.find((w) => w.id === 'wall-high')!, OASIS_WALLS.find((w) => w.id === 'wall-middle')!];
    const t = OASIS_GROUND.find((g) => g.id === 'terrace-middle')!;
    for (const q of ellipse(t)) {
      expect(q.y).toBeGreaterThan(wallFootAt(high, q.x));
      expect(q.y).toBeLessThan(wallTopAt(middle, q.x));
    }
    for (const q of ellipse(OASIS_GROUND.find((g) => g.id === 'terrace-high')!)) expect(q.y).toBeLessThan(wallTopAt(high, q.x));
  });

  it('the gecko’s faces are the three terrace walls and the basin’s near face, foot below top', () => {
    expect(OASIS_WALLS.map((w) => w.id)).toEqual(['wall-high', 'wall-middle', 'wall-grove', 'basin-face']);
    expect(OASIS_WALLS.slice(0, 3).map((w) => w.h)).toEqual([WALLS[1]!.h, WALLS[2]!.h, WALLS[0]!.h]);
    OASIS_WALLS.slice(0, 3).forEach((w, i) => expect(w.outline).toEqual(WALL_FACES[[1, 2, 0][i]!]));
    for (const w of OASIS_WALLS) {
      const mid = (w.top[0]!.x + w.top[w.top.length - 1]!.x) / 2;
      expect(pointInPolygon({ x: mid, y: wallTopAt(w, mid) + w.h / 2 }, w.outline), w.id).toBe(true);
    }
  });

  it('the heron fishes from the basin’s submerged steps and the oued’s shallows, facing the water', () => {
    const [a, b, ...oued] = OASIS_STANDS;
    for (const [s, k] of [[a!, 2], [b!, 3]] as const) {
      expect(intoBasin(s)).toBeGreaterThan(8);
      expect(pointInPolygon(s, BASIN_STEPS[k]!.tread)).toBe(true);
      expect(BASIN_STEPS[k]!.depth).toBeGreaterThan(0);
      expect(s.facing).toBe(-1);
    }
    expect(oued).toHaveLength(3);
    for (const s of oued) {
      expect(inOued(s)).toBe(true);
      expect(closestOnPolygon(s, OUED_WATER).d).toBeGreaterThan(15);
    }
  });
});

describe('oasisPerspective', () => {
  it('matches every slot’s scale, raised terraces and copings included (ADR 0300)', () => {
    // talus-2 stands on the grove wall's painted extension (x < 1066): 0.02 off, the most of any slot
    for (const s of OASIS_SLOTS) expect(Math.abs(oasisPerspective(s.x, s.y) - s.scale), s.id).toBeLessThanOrEqual(0.02 + 1e-9);
  });

  it('a raised terrace takes its lift, a wall face its coping’s scale, the basin’s near face its rim’s', () => {
    expect(oasisPerspective(300, 470)).toBe(perspectiveScale(470 + LIFT.high));
    expect(oasisPerspective(300, 560)).toBe(perspectiveScale(560 + LIFT.middle));
    expect(oasisPerspective(1400, 440)).toBe(perspectiveScale(440 + LIFT.grove));
    const face = OASIS_WALLS.find((w) => w.id === 'wall-middle')!;
    const top = wallTopAt(face, 300);
    expect(oasisPerspective(300, top + 5)).toBe(oasisPerspective(300, top + face.h - 1));
    expect(oasisPerspective(800, 650)).toBe(perspectiveScale(BASIN[3]!.y));
    expect(oasisPerspective(800, 900)).toBe(perspectiveScale(900));
  });

  it('is continuous down every column: each lift is the drop of the wall in front of it', () => {
    for (let x = -10; x <= 1600; x += 15) {
      for (let y = 380; y < 1000; y += 1) expect(Math.abs(oasisPerspective(x, y + 1) - oasisPerspective(x, y)), `${x},${y}`).toBeLessThanOrEqual(0.02);
    }
  });

  it('every perch, spot and stand has a believable scale', () => {
    for (const p of OASIS_PERCHES) {
      const s = p.scale ?? oasisPerspective(p.x, p.y);
      expect(s, p.id).toBeGreaterThanOrEqual(p.kind === 'tower' ? 0.1 : 0.55);
      expect(s, p.id).toBeLessThanOrEqual(1.15);
    }
  });
});

describe('the fauna sim in the oasis', () => {
  it('hands the creatures its perches, plots, faces and stands; other gardens get no plots or faces', () => {
    const sim = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS_WILDLIFE });
    expect(sim.world.perches).toBe(OASIS_PERCHES);
    expect(sim.world.ground).toBe(OASIS_GROUND);
    expect(sim.world.walls).toBe(OASIS_WALLS);
    expect(sim.heronStands()).toEqual(OASIS_STANDS);
    expect(sim.world.perspective(560, 300)).toBe(oasisPerspective(300, 560));
    const plain = new FaunaSim({ scene: OASIS.geometry, seed: 1 });
    expect(plain.world.ground).toEqual([]);
    expect(plain.world.walls).toEqual([]);
  });
});
