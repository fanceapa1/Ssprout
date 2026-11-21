import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import type { PlantInstance } from '../../core/state';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { angleDiff, pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import type { TargetSpecies } from '../targets';
import type { Creature } from '../types';
import damselfish, { clearWater, DAMSELFISH_TUNING, drawShoal, openHomes, Shoal, shoalHomes, type DamselfishParts } from './damselfish';

const ONLY = COAST_FAUNA.filter((r) => r.kind === 'damselfish');

function coastSim(seed = 4, { hour = 12, auto = false, plants = [] as PlantInstance[] } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, auto });
  sim.setGarden(plants, ONLY, lookup);
  sim.hourOverride = hour;
  return sim;
}

const WATER: TargetSpecies = { habitats: ['water'], size: { w: 70, h: 50 }, anchor: { x: 0.5, y: 1 }, pollinators: false } as unknown as TargetSpecies;
const lookup = (id: string) => (id === 'water-plant' ? WATER : undefined);
const planted = (slotId: string): PlantInstance => ({ id: slotId, speciesId: 'water-plant', sceneryId: 'coast', slotId, seed: 1, plantedAt: 0, sessionMinutes: 25, taskName: '', completedAt: 0 });

const shoals = (sim: FaunaSim) => sim.creatures.filter((c): c is Shoal => c instanceof Shoal);
const run = (sim: FaunaSim, seconds: number, dt = 0.1) => {
  for (let s = 0; s < seconds; s += dt) sim.update(dt, 0);
};
/** Run until the shoal has hung still for a while. */
const settle = (sim: FaunaSim, s: Shoal) => {
  for (let i = 0; i < 3000 && !(s.doing() === 'hover' && s.timer > 12); i++) sim.update(0.1, 0);
};
const stub = (kind: string, x: number, y: number): Creature => ({ id: 999, kind, x, y, layer: 'air', state: 'fly', done: false, visitor: true, forced: true, update: () => {}, draw: () => {}, depth: () => null, leave: () => {} });

/** Every fish's bed point in clear water (in the shallows, off its rocks and the planted pads), and where it is drawn in the sea. */
function strays(sim: FaunaSim, s: Shoal): string[] {
  const w = sim.world;
  const r = w.regions.find((g) => g.kind === 'shallows')!;
  const out: string[] = [];
  for (const f of s.fish) {
    const q = s.fishAt(f);
    if (!clearWater(r, q.bed, w.pads)) out.push(`bed ${q.bed.x.toFixed(1)},${q.bed.y.toFixed(1)} (${s.doing()})`);
    if (!pointInPolygon(q.at, r.outline)) out.push(`drawn ${q.at.x.toFixed(1)},${q.at.y.toFixed(1)} (${s.doing()})`);
  }
  return out;
}

await loadAllCreatures();

describe('where the damselfish live', () => {
  it('has homes in the coast’s shallows, in its deeper part, and none elsewhere', () => {
    const w = coastSim().world;
    const h = shoalHomes(w)!;
    expect(h.region.id).toBe('shallows');
    expect(h.spots.length).toBeGreaterThan(40);
    const oasis = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS.fauna, auto: false });
    expect(damselfish.needs!(oasis.world)).toBe(false);
    expect(oasis.spawn('damselfish')).toHaveLength(0);
  });

  it('keeps off the planted water plants', () => {
    const plants = ['shallows-4', 'shallows-6', 'shallows-1'].map(planted);
    const sim = coastSim(2, { plants });
    expect(sim.world.pads).toHaveLength(3);
    const open = openHomes(sim.world);
    const all = shoalHomes(sim.world)!.spots;
    expect(open.length).toBeGreaterThan(0);
    expect(open.length).toBeLessThan(all.length);
    for (const q of open) for (const p of sim.world.pads) expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeGreaterThan(p.r);
  });
});

describe('a shoal in the shallows', () => {
  it('is one creature of 12–25 fish, under the water, rising into view', () => {
    const sim = coastSim(3);
    const [s] = sim.spawn('damselfish') as Shoal[];
    expect(shoals(sim)).toHaveLength(1);
    expect(s!.fish.length).toBeGreaterThanOrEqual(12);
    expect(s!.fish.length).toBeLessThanOrEqual(25);
    expect(s!.layer).toBe('underwater');
    expect(s!.depth()).toBeNull();
    expect(s!.doing()).toBe('enter');
    run(sim, 8);
    expect(s!.alpha).toBeGreaterThan(0.9);
    expect(s!.doing()).not.toBe('enter');
  });

  it('stays in clear water for a long day, drifting, turning, frightened, with water plants planted', () => {
    const problems: string[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const plants = seed % 2 ? [] : ['shallows-4', 'shallows-6', 'shallows-5'].map(planted);
      const sim = coastSim(seed, { plants });
      const [s] = sim.spawn('damselfish') as Shoal[];
      for (let t = 0; t < 900; t += 0.1) {
        sim.update(0.1, 0);
        // a gull over it now and then
        if (Math.floor(t) % 200 === 100 && t % 1 < 0.1) sim.creatures.push(Object.assign(stub('gull', s!.x + 20, s!.y - 60), { done: false }));
        if (Math.floor(t) % 200 === 130) for (const c of sim.creatures) if (c.kind === 'gull') c.done = true;
        if (Math.round(t * 10) % 5 === 0) problems.push(...strays(sim, s!).map((p) => `seed ${seed} t ${t.toFixed(1)}: ${p}`));
      }
      expect(s!.drifts, `seed ${seed}`).toBeGreaterThan(5);
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('hangs as one soft cloud, every fish facing the same way', () => {
    const sim = coastSim(5);
    const [s] = sim.spawn('damselfish') as Shoal[];
    let checked = 0;
    for (let t = 0; t < 300; t += 0.1) {
      sim.update(0.1, 0);
      if (s!.doing() !== 'hover' || s!.timer < 4) continue;
      checked++;
      for (const f of s!.fish) expect(Math.abs(angleDiff(f.heading, s!.heading))).toBeLessThan(0.35);
      // along the shore, across the view: never nose-on to the viewer
      expect(Math.abs(Math.sin(s!.heading))).toBeLessThan(0.75);
      // close about its centre: within the loose radius (and its wander)
      const R = DAMSELFISH_TUNING.radius * 1.2 * s!.scale;
      for (const f of s!.fish) expect(Math.hypot(f.x - s!.x, (f.y - s!.y) / 0.5)).toBeLessThan(R + 6);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('drifts along the shore and turns as one', () => {
    const sim = coastSim(7);
    const [s] = sim.spawn('damselfish') as Shoal[];
    let along = 0;
    let across = 0;
    let turnSeen = 0;
    for (let t = 0; t < 600; t += 0.1) {
      const was = { x: s!.x, y: s!.y };
      sim.update(0.1, 0);
      if (s!.doing() === 'drift') {
        along += Math.abs(s!.x - was.x);
        across += Math.abs(s!.y - was.y);
        // slowly: a few units a second
        expect(Math.hypot(s!.x - was.x, s!.y - was.y)).toBeLessThan(DAMSELFISH_TUNING.speed * 0.1 * 1.01);
      }
      // mid-turn the fish face several ways: the turn runs across the shoal
      if (s!.doing() === 'turn' && s!.timer < 0.6) {
        const spread = Math.max(...s!.fish.map((f) => Math.abs(angleDiff(f.heading, s!.heading))));
        if (spread > 0.5) turnSeen++;
      }
    }
    expect(s!.drifts).toBeGreaterThan(4);
    expect(s!.turns).toBeGreaterThan(4);
    expect(along).toBeGreaterThan(across * 2);
    expect(turnSeen).toBeGreaterThan(0);
  });

  it('tightens and sinks when a gull or the heron passes over, and loosens again after', () => {
    for (const kind of ['gull', 'heron']) {
      const sim = coastSim(8);
      const [s] = sim.spawn('damselfish') as Shoal[];
      settle(sim, s!);
      expect(s!.spread).toBeGreaterThan(s!.room * 0.85);
      expect(s!.z).toBeLessThan(0.5);
      // a butterfly over it, a gull far along the shore: nothing
      sim.creatures.push(stub('butterfly', s!.x, s!.y - 10), stub('gull', s!.x + 400, s!.y));
      run(sim, 2);
      expect(s!.frights).toBe(0);
      const bird = stub(kind, s!.x - 30, s!.y - 100);
      sim.creatures.push(bird);
      run(sim, 0.2);
      expect(s!.doing()).toBe('tight');
      run(sim, 2);
      expect(s!.spread).toBeLessThan(0.55);
      expect(s!.z).toBeGreaterThan(0.75);
      bird.done = true;
      run(sim, 4);
      expect(s!.doing()).toBe('tight');
      run(sim, 10);
      expect(s!.doing()).not.toBe('tight');
      settle(sim, s!);
      expect(s!.spread).toBeGreaterThan(s!.room * 0.85);
      expect(s!.z).toBeLessThan(0.5);
      expect(s!.frights).toBe(1);
    }
  });

  it('slips away along the shore from a gull that sits over it', () => {
    const sim = coastSim(9);
    const [s] = sim.spawn('damselfish') as Shoal[];
    run(sim, 30);
    const gull = stub('gull', s!.x, s!.y);
    sim.creatures.push(gull);
    const from = Math.hypot(s!.x - gull.x, (s!.y - gull.y) * 0.5);
    run(sim, 40);
    expect(Math.hypot(s!.x - gull.x, (s!.y - gull.y) * 0.5)).toBeGreaterThan(from + 25);
    expect(strays(sim, s!)).toEqual([]);
  });

  it('a shadow from beyond the view tightens it now and then', () => {
    const sim = coastSim(10);
    const [s] = sim.spawn('damselfish') as Shoal[];
    let tight = 0;
    for (let t = 0; t < 1200; t += 0.1) {
      sim.update(0.1, 0);
      if (s!.doing() === 'tight') tight += 0.1;
    }
    expect(s!.frights).toBe(0);
    expect(s!.shadows).toBeGreaterThanOrEqual(4);
    expect(s!.shadows).toBeLessThanOrEqual(18);
    expect(tight).toBeLessThan(1200 * 0.12);
  });
});

describe('by day only', () => {
  it('one shoal by day, none at night: it sinks away at nightfall', () => {
    const sim = coastSim(5, { auto: true });
    run(sim, 30);
    expect(shoals(sim)).toHaveLength(1);
    const [s] = shoals(sim);
    sim.hourOverride = 23;
    run(sim, 0.2);
    expect(s!.doing()).toBe('leave');
    run(sim, 20);
    expect(shoals(sim)).toHaveLength(0);
    run(sim, 60);
    expect(shoals(sim)).toHaveLength(0);
    sim.hourOverride = 9;
    run(sim, 5);
    expect(shoals(sim)).toHaveLength(1);
  });

  it('a hand-spawned shoal goes at nightfall too', () => {
    const sim = coastSim(6);
    sim.spawn('damselfish');
    run(sim, 10);
    sim.hourOverride = 22;
    run(sim, 25);
    expect(shoals(sim)).toHaveLength(0);
  });

  it('is deterministic for a seed', () => {
    const trace = (seed: number) => {
      const sim = coastSim(seed);
      const [s] = sim.spawn('damselfish') as Shoal[];
      run(sim, 120);
      return [s!.x, s!.y, s!.heading, ...s!.fish.flatMap((f) => [f.x, f.y])].map((v) => v.toFixed(4)).join(',');
    };
    expect(trace(11)).toBe(trace(11));
    expect(trace(11)).not.toBe(trace(12));
  });
});

describe('drawing', () => {
  it('two drawImages a fish, three for the turning ones, in one save', () => {
    const sim = coastSim(4);
    const [s] = sim.spawn('damselfish') as Shoal[];
    run(sim, 30);
    const sp = { img: {}, w: 10, h: 4, ox: 5, oy: 2 } as unknown as Sprite;
    const parts: DamselfishParts = { frames: [sp, sp, sp], deep: [sp, sp, sp], glint: sp, shadow: sp, body: sp, tail: sp };
    let draws = 0;
    let saves = 0;
    const ctx = {
      globalAlpha: 1,
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      setTransform: () => {},
      drawImage: () => draws++,
      save: () => saves++,
      restore: () => {},
    } as unknown as CanvasRenderingContext2D;
    drawShoal(ctx, parts, s!, 1);
    expect(saves).toBe(0);
    expect(draws).toBeGreaterThanOrEqual(2 * s!.fish.length);
    expect(draws).toBeLessThanOrEqual(3 * s!.fish.length);
  });

  it('shows on the coast stage', () => {
    expect(damselfish.show?.stage).toBe('coast');
  });
});
