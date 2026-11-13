import { describe, expect, it } from 'vitest';
import { FaunaSim } from '../../fauna/sim';
import { distanceToPolygon, pointInPolygon, polygonBounds, polygonCentroid } from '../../fauna/math';
import { carried, inRegion, perchY, regionScale, wallTopAt, type Perch } from '../../fauna/targets';
import type { Pt } from '../../render/viewport';
import { perspectiveScale } from '../../scene/slots';
import { COAST } from '.';
import { POOL_WATER, SEA_WATER } from './geometry';
import { ARCHITRAVE, BEACH, CAIQUE, COAST_SKY_LAYOUT, COLUMNS, DRUM, HORIZON, LAND, LIFT, OLIVE, PATH, PINE, skylineAt, TEMPLE_SHAPES, WALLS, WATERLINE_EDGE } from './layout';
import { CAIQUE_BOX, CAIQUE_SHAPES, DEPTH, shoreDistance } from './sea';
import { BEDS, FLIGHTS, JARS, OLIVE_LIMBS, PINE_BRANCHES, PINE_TRUNK, PROMONTORY_PINE_SHAPES, promontoryTop, SPLASH_ROCK_SHAPES, WALL_FACES, WALL_TOPS } from './shapes';
import { COAST_SLOTS } from './slots';
import {
  CAIQUE_MEASURE, COAST_CARRIERS, COAST_GROUND, COAST_PERCHES, COAST_REGIONS, COAST_STANDS, COAST_WALLS, COAST_WILDLIFE, coastPerspective, intoSea, seaScale, TEMPLE_SCALE,
} from './wildlife';

const of = (kind: Perch['kind']) => COAST_PERCHES.filter((p) => p.kind === kind);
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
const region = (id: string) => COAST_REGIONS.find((r) => r.id === id)!;
const spots = (prefix: string) => COAST_GROUND.filter((g) => g.id.startsWith(prefix));

describe('the coast’s wildlife data', () => {
  it('is the scenery’s: the sea still, the rock pools in the water clip, the caique a carrier at rest', () => {
    expect(COAST.fauna).toBe(COAST_WILDLIFE);
    expect(COAST_WILDLIFE.water!.still).toBe(SEA_WATER);
    expect(COAST_WILDLIFE.water!.moving).toBe(POOL_WATER);
    expect(COAST_WILDLIFE.carriers).toBe(COAST_CARRIERS);
    expect(COAST_CARRIERS.caique!.pivot).toEqual(CAIQUE);
    expect(COAST_CARRIERS.caique!.pose).toEqual({ dx: 0, dy: 0, angle: 0 });
  });

  it('has every kind of perch, unique ids, each inside the frame, off every slot, drawn in front of what it stands on', () => {
    const ids = COAST_PERCHES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const counts = Object.fromEntries(['wall', 'branch', 'jar', 'rock', 'ruin', 'boat', 'crown', 'ledge'].map((k) => [k, of(k as Perch['kind']).length]));
    expect(counts.wall).toBeGreaterThanOrEqual(20);
    expect(counts.branch).toBeGreaterThanOrEqual(4);
    expect(counts.rock).toBeGreaterThanOrEqual(2);
    expect(counts.crown).toBeGreaterThanOrEqual(2);
    expect(counts.ledge).toBeGreaterThanOrEqual(4);
    expect(counts).toMatchObject({ jar: JARS.length, ruin: 4, boat: 3 });
    for (const p of COAST_PERCHES) {
      for (const q of along(p)) {
        expect(q.x, p.id).toBeGreaterThanOrEqual(0);
        expect(q.x, p.id).toBeLessThanOrEqual(1600);
      }
      expect(p.x, p.id).toBeGreaterThanOrEqual(10);
      expect(p.x, p.id).toBeLessThanOrEqual(1590);
      expect(p.y, p.id).toBeGreaterThanOrEqual(20);
      expect(p.y, p.id).toBeLessThanOrEqual(990);
      for (const s of COAST_SLOTS) expect(Math.hypot(s.x - p.x, s.y - p.y), `${p.id} ${s.id}`).toBeGreaterThanOrEqual(20);
      expect(p.depth, p.id).toBeGreaterThan(p.y);
    }
  });
});

describe('perches', () => {
  it('coping perches lie on a wall’s coping where it stands full height, clear of the flights', () => {
    for (const p of of('wall')) {
      const i = WALLS.findIndex((_, k) => p.id.startsWith(`${COAST_WALLS[k]!.id}-`));
      expect(i, p.id).toBeGreaterThanOrEqual(0);
      for (const q of along(p)) expect(Math.abs(q.y - wallTopAt({ top: WALL_TOPS[i]! }, q.x)), p.id).toBeLessThan(1.2);
      expect(p.x, p.id).toBeGreaterThanOrEqual(WALLS[i]!.edge[0]!.x + 60);
      for (const f of FLIGHTS.flat()) expect(p.x > f.tread[0]!.x - 12 && p.x < f.tread[1]!.x + 12 && Math.abs(f.tread[0]!.y - p.y) < 40, p.id).toBe(false);
    }
    for (const w of COAST_WALLS.filter((f) => f.id.startsWith('wall-'))) expect(of('wall').some((p) => p.id.startsWith(`${w.id}-`)), w.id).toBe(true);
  });

  it('branch perches lie on the olive’s limbs or the pine’s branches, at their tree’s scale', () => {
    const olive = of('branch').filter((p) => p.id.startsWith('olive'));
    const pine = of('branch').filter((p) => p.id.startsWith('pine'));
    expect(olive.length).toBeGreaterThanOrEqual(2);
    expect(pine.length).toBeGreaterThanOrEqual(2);
    for (const [list, limbs, base] of [[olive, OLIVE_LIMBS, OLIVE.base], [pine, PINE_BRANCHES, PINE.base]] as const) {
      for (const p of list) {
        expect(Math.min(...limbs.map((l) => lineDist(p, l))), p.id).toBeLessThan(0.5);
        for (const q of along(p)) expect(Math.min(...limbs.map((l) => lineDist(q, l))), p.id).toBeLessThan(p.id === 'olive-fork' ? 4 : 2);
        expect(p.scale, p.id).toBe(coastPerspective(base.x, base.y));
        expect(p.depth, p.id).toBe(base.y + 1);
      }
    }
  });

  it('jar, splash-rock, temple and far-pine perches sit on what the shapes say', () => {
    of('jar').forEach((p, i) => {
      expect(Math.abs(p.x - JARS[i]!.x)).toBeLessThan(JARS[i]!.h * 0.2);
      expect(p.y).toBe(JARS[i]!.y - JARS[i]!.h);
    });
    for (const p of of('rock')) {
      const rock = SPLASH_ROCK_SHAPES[Number(p.id.split('-')[1]) - 1]!;
      for (const q of along(p)) expect(pointInPolygon(q, rock.top), p.id).toBe(true);
      expect(p.depth).toBe(rock.y + 1);
    }
    const [arch, ...rest] = of('ruin');
    const archTop = TEMPLE_SHAPES[COLUMNS.length]![0]!.y;
    expect(arch!.y).toBe(archTop);
    expect(arch!.x - arch!.spread).toBeGreaterThan(ARCHITRAVE.x0);
    expect(arch!.x + arch!.spread).toBeLessThan(ARCHITRAVE.x1);
    for (const p of rest.filter((q) => q.id.startsWith('column-'))) {
      const [a, b] = TEMPLE_SHAPES[Number(p.id.split('-')[1]) - 1]!;
      for (const q of along(p)) expect(segDist(q, a!, b!), p.id).toBeLessThan(0.6);
    }
    const drum = of('ruin').find((p) => p.id === 'drum')!;
    expect(drum.y).toBeLessThan(DRUM.y);
    expect(Math.abs(drum.x - DRUM.x)).toBeLessThan(2);
    for (const p of of('crown')) {
      const s = PROMONTORY_PINE_SHAPES.find((c) => p.id === `pine-crown-${Math.round(c.x)}`)!;
      expect(Math.abs(p.x - s.x), p.id).toBeLessThanOrEqual(s.rx);
      expect(p.y).toBeLessThan(s.y);
      // on one of its needle clouds, not in the sky between them
      expect(s.clouds.some((c) => ((p.x - c.x) / c.rx) ** 2 + ((p.y - c.y) / c.ry) ** 2 < 1 && p.y < c.y), p.id).toBe(true);
    }
  });

  it('the caique’s perches (mast top, rail) ride it: they move with its pose', () => {
    const boat = of('boat');
    expect(boat[0]).toMatchObject({ id: 'mast-top', x: Math.round(CAIQUE_SHAPES.mast[1].x * 10) / 10 });
    for (const p of boat) {
      expect(p.carrier, p.id).toBe('caique');
      expect(p.scale).toBe(CAIQUE_MEASURE);
      expect(pointInPolygon(p, [{ x: CAIQUE_BOX.x, y: CAIQUE_BOX.y }, { x: CAIQUE_BOX.x + CAIQUE_BOX.w, y: CAIQUE_BOX.y }, { x: CAIQUE_BOX.x + CAIQUE_BOX.w, y: CAIQUE_BOX.y + CAIQUE_BOX.h }, { x: CAIQUE_BOX.x, y: CAIQUE_BOX.y + CAIQUE_BOX.h }]), p.id).toBe(true);
    }
    for (const p of boat.filter((q) => q.id.startsWith('rail'))) for (const q of along(p)) expect(lineDist(q, CAIQUE_SHAPES.sheer), p.id).toBeLessThan(0.6);
    const c = { pivot: COAST_CARRIERS.caique!.pivot, pose: { dx: 2, dy: 1, angle: 0.05 } };
    const top = carried(boat[0]!, c);
    expect(top.x).toBeGreaterThan(boat[0]!.x + 2);
    expect(carried(boat[0]!, COAST_CARRIERS.caique)).toEqual({ x: boat[0]!.x, y: boat[0]!.y });
  });

  it('the goats’ ledges cross the promontory’s face, at the temple’s measure, out of the olive’s crown', () => {
    for (const p of of('ledge')) {
      const top = promontoryTop(p.x)!;
      expect(p.y, p.id).toBeGreaterThan(top + 10);
      expect(p.y, p.id).toBeLessThan(500);
      expect(((p.x - OLIVE.crown.x) / OLIVE.rx) ** 2 + ((p.y - OLIVE.crown.y) / OLIVE.ry) ** 2, p.id).toBeGreaterThan(1);
      expect(p.scale).toBe(TEMPLE_SCALE);
    }
  });

  it('far things carry their own measure, smaller than the ground’s; the sea’s falls to nothing at the horizon', () => {
    expect(TEMPLE_SCALE).toBeGreaterThan(0.08);
    expect(TEMPLE_SCALE).toBeLessThan(perspectiveScale(400));
    expect(CAIQUE_MEASURE).toBeLessThan(perspectiveScale(CAIQUE.y));
    expect(seaScale(HORIZON)).toBe(0);
    expect(seaScale(CAIQUE.y)).toBe(CAIQUE_MEASURE);
    for (const p of COAST_PERCHES) {
      const s = p.scale ?? coastPerspective(p.x, p.y);
      expect(s, p.id).toBeGreaterThanOrEqual(['ruin', 'boat', 'crown', 'ledge'].includes(p.kind) ? 0.05 : 0.55);
      expect(s, p.id).toBeLessThanOrEqual(1.15);
    }
  });
});

describe('ground and faces', () => {
  it('every walk, path and scrub spot is on the land, off the sea and off the wall faces; the beach’s on the shingle', () => {
    for (const g of COAST_GROUND) {
      for (const q of [{ x: g.x, y: g.y }, ...ellipse(g)]) {
        if (g.id.startsWith('beach')) {
          expect(pointInPolygon(q, BEACH), g.id).toBe(true);
          continue;
        }
        expect(pointInPolygon(q, LAND), g.id).toBe(true);
        expect(pointInPolygon(q, SEA_WATER), g.id).toBe(false);
        for (const f of WALL_FACES) expect(pointInPolygon(q, f), g.id).toBe(false);
      }
    }
    expect(spots('walk-').length).toBe(9);
    expect(spots('scrub-').length).toBeGreaterThanOrEqual(6);
    expect(spots('beach-').length).toBe(2);
  });

  it('the terrace walks run between the wall above and the beds, off the path; the path spots on its middle', () => {
    for (const g of spots('walk-')) {
      for (const q of ellipse(g)) {
        for (const b of BEDS) expect(pointInPolygon(q, b.poly), `${g.id} bed`).toBe(false);
        expect(lineDist(q, PATH), g.id).toBeGreaterThan(14);
      }
    }
    for (const g of spots('path-')) expect(lineDist(g, PATH), g.id).toBeLessThan(1);
  });

  it('the lizard’s faces are the three walls where they stand full height; the crab’s the splash rocks’ fronts down to the water', () => {
    const walls = COAST_WALLS.filter((w) => w.id.startsWith('wall-'));
    expect(walls.map((w) => w.id)).toEqual(['wall-top', 'wall-middle', 'wall-lower']);
    walls.forEach((w, i) => {
      expect(w.h).toBe(WALLS[i]!.h);
      for (const q of w.top) expect(WALL_TOPS[i]).toContainEqual(q);
      const mid = (w.top[0]!.x + w.top[w.top.length - 1]!.x) / 2;
      expect(pointInPolygon({ x: mid, y: wallTopAt(w, mid) + w.h / 2 }, WALL_FACES[i]!)).toBe(true);
    });
    const splash = COAST_WALLS.filter((w) => w.id.startsWith('splash-'));
    expect(splash).toHaveLength(SPLASH_ROCK_SHAPES.length);
    splash.forEach((w, i) => {
      const r = SPLASH_ROCK_SHAPES[i]!;
      for (const q of w.top) {
        const c = r.columns.find((k) => k.x === q.x)!;
        expect(Math.abs(q.y - c.front), w.id).toBeLessThan(0.1);
        expect(q.y + w.h, w.id).toBeLessThanOrEqual(c.base + 0.01);
        expect(q.y + w.h, w.id).toBeGreaterThan(c.base - 4);
        expect(pointInPolygon({ x: q.x, y: q.y + w.h / 2 }, r.outline), w.id).toBe(true);
      }
    });
  });
});

describe('regions and stands', () => {
  it('the shallows are the sea near the shore, off the rocks, the caique and the pine', () => {
    const r = region('shallows');
    const b = polygonBounds(r.outline);
    for (const q of r.outline) {
      expect(pointInPolygon({ x: q.x, y: q.y - 0.5 }, SEA_WATER) || pointInPolygon({ x: q.x, y: q.y + 0.5 }, SEA_WATER), `${q.x},${q.y}`).toBe(true);
      expect(shoreDistance(q), `${q.x},${q.y}`).toBeLessThanOrEqual(DEPTH.turquoise + 12);
    }
    expect(b.x).toBeGreaterThan(Math.max(...PINE_TRUNK.filter((q) => q.y > 560).map((q) => q.x)));
    expect(b.y).toBeGreaterThan(CAIQUE_BOX.y + CAIQUE_BOX.h);
    for (const rock of SPLASH_ROCK_SHAPES) expect(inRegion(r, polygonCentroid(rock.top))).toBe(false);
    expect(inRegion(r, COAST_SLOTS.find((s) => s.id === 'shallows-1')!)).toBe(true);
  });

  it('the rock pools are the geometry’s, each its own region', () => {
    expect(COAST_REGIONS.filter((r) => r.kind === 'pool').map((r) => r.outline)).toEqual(POOL_WATER);
  });

  it('the bay is far out under the far hill: in the sea, off the caique, the pine and the low suns’ paths, at the sea’s scale', () => {
    const r = region('bay');
    const sun = Math.min(COAST_SKY_LAYOUT.sunsetX, COAST_SKY_LAYOUT.sunriseX);
    for (const q of r.outline) {
      expect(pointInPolygon(q, SEA_WATER), `${q.x},${q.y}`).toBe(true);
      expect(q.y).toBeLessThan(CAIQUE_BOX.y);
      expect(q.x).toBeLessThan(sun - 16 - (q.y - HORIZON) * 0.5);
      expect(q.x).toBeGreaterThan(Math.max(...PINE_TRUNK.filter((p) => p.y > HORIZON - 30).map((p) => p.x)));
    }
    const b = polygonBounds(r.outline);
    expect(regionScale(r, b.y)).toBe(seaScale(b.y));
    expect(regionScale(r, b.y + b.h)).toBe(seaScale(b.y + b.h));
    expect(regionScale(r, b.y + b.h)!).toBeLessThan(CAIQUE_MEASURE);
    expect(regionScale(r, b.y)!).toBeGreaterThan(0);
  });

  it('the sky over the cove stays in the open sky, over the architrave', () => {
    const r = region('sky-cove');
    const archTop = TEMPLE_SHAPES[COLUMNS.length]![0]!.y;
    for (const q of r.outline) {
      expect(q.y, `${q.x}`).toBeLessThan(skylineAt(q.x) - 10);
      if (q.x >= ARCHITRAVE.x0 && q.x <= ARCHITRAVE.x1) expect(q.y).toBeLessThan(archTop);
    }
  });

  it('the bark bands follow the olive’s trunk and the pine’s, at each tree’s scale', () => {
    const olive = region('bark-olive');
    for (const q of OLIVE_LIMBS[0]!.slice(1, -1)) expect(inRegion(olive, q)).toBe(true);
    expect(regionScale(olive, 500)).toBe(coastPerspective(OLIVE.base.x, OLIVE.base.y));
    const pine = region('bark-pine');
    expect(inRegion(pine, PINE_TRUNK[2]!)).toBe(true);
    expect(regionScale(pine, 600)).toBe(coastPerspective(PINE.base.x, PINE.base.y));
  });

  it('the heron fishes in the shallows off the beach, clear of the water and beach slots and the splash rocks', () => {
    expect(COAST_STANDS.length).toBeGreaterThanOrEqual(3);
    for (const s of COAST_STANDS) {
      expect(intoSea(s), `${s.x}`).toBeGreaterThan(4);
      expect(shoreDistance(s)).toBeLessThan(DEPTH.shallows);
      for (const slot of COAST_SLOTS.filter((q) => q.habitat === 'water' || q.habitat === 'shore')) expect(Math.hypot(slot.x - s.x, slot.y - s.y), `${s.x} ${slot.id}`).toBeGreaterThanOrEqual(50);
      for (const r of SPLASH_ROCK_SHAPES) expect(distanceToPolygon(s, r.outline), `${s.x}`).toBeGreaterThan(10);
      const wl = WATERLINE_EDGE.find((q, i) => i > 0 && q.x >= s.x)!;
      expect(s.y).toBeLessThan(wl.y);
    }
  });
});

describe('coastPerspective', () => {
  it('matches every slot’s scale, raised terraces, copings and faces included (ADR 0360)', () => {
    // crack-1 sits in the middle wall's face 25 below its coping: the slot takes the terrace's lift at its own y, the face its coping's
    for (const s of COAST_SLOTS) expect(Math.abs(coastPerspective(s.x, s.y) - s.scale), s.id).toBeLessThanOrEqual((s.id === 'crack-1' ? 0.03 : 0.02) + 1e-9);
  });

  it('a terrace takes its lift, a face its coping’s scale, the sea, the beach and the shelf the ground’s', () => {
    expect(coastPerspective(1200, 540)).toBe(perspectiveScale(540 + LIFT.top));
    expect(coastPerspective(1200, 650)).toBe(perspectiveScale(650 + LIFT.middle));
    expect(coastPerspective(1200, 800)).toBe(perspectiveScale(800 + LIFT.lower));
    expect(coastPerspective(744, 726)).toBe(perspectiveScale(726 + LIFT.middle));
    expect(coastPerspective(400, 600)).toBe(perspectiveScale(600));
    expect(coastPerspective(300, 800)).toBe(perspectiveScale(800));
    expect(coastPerspective(400, 900)).toBe(perspectiveScale(900));
  });

  it('is continuous down every column of the terraces where the walls stand full height', () => {
    for (let x = 920; x <= 1600; x += 20) {
      for (let y = 502; y < 1000; y += 1) expect(Math.abs(coastPerspective(x, y + 1) - coastPerspective(x, y)), `${x},${y}`).toBeLessThanOrEqual(0.02);
    }
  });
});

describe('the fauna sim on the coast', () => {
  it('hands the creatures its perches, walks, faces, regions, carriers and stands; other gardens get no regions or carriers', () => {
    const sim = new FaunaSim({ scene: COAST.geometry, seed: 1, habitat: COAST_WILDLIFE });
    expect(sim.world.perches).toBe(COAST_PERCHES);
    expect(sim.world.ground).toBe(COAST_GROUND);
    expect(sim.world.walls).toBe(COAST_WALLS);
    expect(sim.world.regions).toBe(COAST_REGIONS);
    expect(sim.world.carriers).toBe(COAST_CARRIERS);
    expect(sim.heronStands()).toEqual(COAST_STANDS);
    expect(sim.world.perspective(650, 1200)).toBe(coastPerspective(1200, 650));
    const plain = new FaunaSim({ scene: COAST.geometry, seed: 1 });
    expect(plain.world.regions).toEqual([]);
    expect(plain.world.carriers).toEqual({});
  });
});
