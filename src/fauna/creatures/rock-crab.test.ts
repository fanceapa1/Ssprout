import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import type { PlantInstance } from '../../core/state';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { inRegion } from '../targets';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import type { Creature } from '../types';
import rockCrab, { crabRocks, drawRockCrab, feedPose, RockCrab, rockPoint, ROCK_CRAB_SIZE, ROCK_CRAB_TUNING, wavePose, type RockCrabParts } from './rock-crab';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'rock-crab');

function coastSim(seed = 4, { hour = 12, auto = false } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, auto });
  sim.setGarden(plants, ONLY, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const crabs = (sim: FaunaSim) => sim.creatures.filter((c): c is RockCrab => c instanceof RockCrab);
const run = (sim: FaunaSim, seconds: number, dt = 0.1) => {
  for (let s = 0; s < seconds; s += dt) sim.update(dt, 0);
};
const stub = (kind: string, x: number, y: number): Creature => ({ id: 999, kind, x, y, layer: 'air', state: 'fly', done: false, visitor: true, forced: true, update: () => {}, draw: () => {}, depth: () => null, leave: () => {} });

await loadAllCreatures();

describe('where the rock crab lives', () => {
  it('knows the four splash rocks and the three rock pools, never in the water or the sea', () => {
    const w = coastSim().world;
    const rocks = crabRocks(w);
    expect(rocks.map((r) => r.id)).toEqual(['splash-1', 'splash-2', 'splash-3', 'splash-4', 'pool-1', 'pool-2', 'pool-3']);
    const pools = w.regions.filter((r) => r.kind === 'pool');
    for (const r of rocks) {
      for (const u of [0, 0.5, 1]) for (const v of [0, 1]) for (const p of pools) expect(inRegion(p, rockPoint(r, u, v))).toBe(false);
    }
    // the crown's lip is only used near a perch, which is clear of the slot (splash-1 has none)
    expect(rocks[0]!.dryU).toBeNull();
    for (const r of rocks.slice(1, 4)) expect(r.dryU).not.toBeNull();
  });

  it('lives only on the coast', () => {
    const sim = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS.fauna, auto: false });
    expect(rockCrab.needs!(sim.world)).toBe(false);
    expect(sim.spawn('rock-crab')).toHaveLength(0);
  });
});

describe('a crab on the splash rock', () => {
  it('comes out of its crack, sidles in quick runs and stops, feeds, and stays on its rows', () => {
    const sim = coastSim(3);
    const [c] = sim.spawn('rock-crab') as RockCrab[];
    expect(c!.doing()).toBe('hidden');
    const seen = new Set<string>();
    for (let s = 0; s < 240; s += 0.1) {
      sim.update(0.1, 0);
      seen.add(c!.doing());
      const r = c!.rock;
      // on the rock: between the lip and the waterline, never on the lip away from the perch
      expect(c!.v).toBeGreaterThanOrEqual(-1e-9);
      expect(c!.v).toBeLessThanOrEqual(1 + 1e-9);
      if (c!.v < 0.99 && c!.doing() !== 'run') expect(r.dryU).not.toBeNull();
      expect(c!.layer).toBe('entities');
      expect(c!.depth()).toBe(r.depth);
    }
    for (const m of ['hidden', 'run', 'stop', 'feed']) expect(seen, m).toContain(m);
    expect(c!.runs).toBeGreaterThan(10);
    expect(c!.feeds).toBeGreaterThan(2);
  });

  it('runs are quick and sideways: along the rock, a few units, then a stop', () => {
    const sim = coastSim(6);
    const [c] = sim.spawn('rock-crab') as RockCrab[];
    let sideways = 0;
    let upDown = 0;
    for (let i = 0; i < 4000; i++) {
      const was = c!.doing() === 'run' ? { x: c!.x, y: c!.y, v: c!.v } : null;
      sim.update(0.05, 0);
      // along a row, not the odd climb between the lip and the waterline
      if (was && c!.doing() === 'run' && c!.v === was.v) {
        sideways += Math.abs(c!.x - was.x);
        upDown += Math.abs(c!.y - was.y);
        // at its scale there, with some slack for a rim's unevenly spaced points
        expect(Math.hypot(c!.x - was.x, c!.y - was.y)).toBeLessThan(ROCK_CRAB_TUNING.speed * 0.05 * sim.world.perspective(c!.y, c!.x) * 1.2);
      }
    }
    expect(sideways).toBeGreaterThan(upDown * 2);
  });

  it('feeding picks with both claws in turn', () => {
    const qs = Array.from({ length: 12 }, (_, i) => feedPose(i / 20));
    expect(Math.max(...qs.map((q) => q.pickL))).toBeGreaterThan(0.8);
    expect(Math.max(...qs.map((q) => q.pickR))).toBeGreaterThan(0.8);
    for (const q of qs) expect(Math.min(q.pickL, q.pickR)).toBe(0);
  });

  it('now and then stops to wave a claw: raised up and out, swung, lowered again', () => {
    const sim = coastSim(3);
    const [c] = sim.spawn('rock-crab') as RockCrab[];
    let raised = 0;
    let movingRaised = 0;
    for (let s = 0; s < 400; s += 0.05) {
      sim.update(0.05, 0);
      const q = c!.pose(sim.world.t);
      if (q.waveL > 0.5 || q.waveR > 0.5) {
        raised++;
        if (c!.doing() !== 'wave') movingRaised++;
      }
    }
    expect(c!.waves).toBeGreaterThan(2);
    expect(raised).toBeGreaterThan(20);
    expect(movingRaised).toBe(0);
    // one claw at a time, down at both ends, swinging while up
    for (const side of [1, -1] as const) {
      const qs = Array.from({ length: 41 }, (_, i) => wavePose(i / 40, 1.8, side));
      for (const q of qs) expect(Math.min(q.waveL, q.waveR)).toBe(0);
      expect(Math.max(...qs.map((q) => (side > 0 ? q.waveR : q.waveL)))).toBeGreaterThan(0.95);
      expect(qs[0]!.waveL + qs[0]!.waveR).toBeLessThan(0.02);
      expect(qs[40]!.waveL + qs[40]!.waveR).toBeLessThan(0.02);
      expect(Math.max(...qs.map((q) => q.swing)) - Math.min(...qs.map((q) => q.swing))).toBeGreaterThan(0.5);
    }
  });

  it('fits every rock and rim it uses: on the stone at both rows, with room to sidle', () => {
    const w = coastSim().world;
    for (const r of crabRocks(w)) {
      const mid = rockPoint(r, 0.5, 1);
      const s = w.perspective(mid.y, mid.x);
      // its legs' whole span at the rock's middle, and three body widths of room along the waterline
      const span = 2.12 * ROCK_CRAB_SIZE * s;
      const len = Math.hypot(rockPoint(r, 1, 1).x - rockPoint(r, 0, 1).x, rockPoint(r, 1, 1).y - rockPoint(r, 0, 1).y);
      expect(len, r.id).toBeGreaterThan(span);
      expect(len, r.id).toBeGreaterThan(3 * ROCK_CRAB_SIZE * s);
    }
    // stopped anywhere, its shell is on the rock, not past an end
    const sim = coastSim(9);
    const [c] = sim.spawn('rock-crab') as RockCrab[];
    let stops = 0;
    for (let t = 0; t < 400; t += 0.1) {
      sim.update(0.1, 0);
      if (!['stop', 'feed', 'wave'].includes(c!.doing())) continue;
      const r = c!.rock;
      const len = Math.hypot(rockPoint(r, 1, 1).x - rockPoint(r, 0, 1).x, rockPoint(r, 1, 1).y - rockPoint(r, 0, 1).y);
      const half = (0.5 * ROCK_CRAB_SIZE * sim.world.perspective(c!.y, c!.x)) / len;
      expect(c!.u, r.id).toBeGreaterThanOrEqual(half);
      expect(c!.u, r.id).toBeLessThanOrEqual(1 - half);
      stops++;
    }
    expect(stops).toBeGreaterThan(100);
  });

  it('freezes when something large comes near, darts off the end of its rock, and comes back after', () => {
    const sim = coastSim(8);
    const [c] = sim.spawn('rock-crab') as RockCrab[];
    run(sim, 3);
    while (c!.doing() === 'hidden') run(sim, 0.1);
    // a butterfly near, a gull far off: nothing
    sim.creatures.push(stub('butterfly', c!.x + 5, c!.y), stub('gull', c!.x + 300, c!.y));
    run(sim, 1);
    expect(c!.frights).toBe(0);
    const cat = stub('cat', c!.x + 40, c!.y - 20);
    sim.creatures.push(cat);
    run(sim, 0.3);
    expect(c!.doing()).toBe('freeze');
    expect(c!.flatness()).toBeGreaterThan(0.75);
    const seen = new Set<string>();
    for (let s = 0; s < 4; s += 0.05) {
      sim.update(0.05, 0);
      seen.add(c!.doing());
    }
    expect(seen).toContain('dart');
    expect(c!.doing()).toBe('hidden');
    expect([0, 1]).toContain(c!.u);
    // stays hidden while the cat is there
    run(sim, 30);
    expect(c!.doing()).toBe('hidden');
    cat.done = true;
    run(sim, 30);
    expect(c!.doing()).not.toBe('hidden');
    expect(c!.frights).toBe(1);
  });

  it('a swell washes over it at the waterline, never on the dry lip', () => {
    const sim = coastSim(2);
    const [c] = sim.spawn('rock-crab') as RockCrab[];
    let wet = 0;
    for (let s = 0; s < 200; s += 0.1) {
      sim.update(0.1, 0);
      const wash = c!.wash(sim.world.t);
      if (c!.v < 0.7) expect(wash).toBe(0);
      if (wash > 0.5) wet++;
    }
    expect(wet).toBeGreaterThan(0);
    expect(c!.swells).toBeGreaterThan(2);
  });

  it('out day and night: one by day, two after dark', () => {
    const sim = coastSim(5, { auto: true });
    run(sim, 30);
    expect(crabs(sim)).toHaveLength(1);
    sim.hourOverride = 23;
    run(sim, 60);
    expect(crabs(sim)).toHaveLength(2);
    const [a, b] = crabs(sim);
    expect(a!.rock).not.toBe(b!.rock);
    run(sim, 120);
    expect(crabs(sim).filter((c) => c.runs > 0)).toHaveLength(2);
  });

  it('moves to another rock now and then, and is deterministic', () => {
    const a = coastSim(5);
    const b = coastSim(5);
    a.spawn('rock-crab');
    b.spawn('rock-crab');
    const rocks = new Set<string>();
    for (let s = 0; s < 600; s += 0.05) {
      a.update(0.05, 0);
      b.update(0.05, 0);
      rocks.add(crabs(a)[0]!.rock.id);
    }
    expect(rocks.size).toBeGreaterThan(1);
    expect(a.rng.next()).toBe(b.rng.next());
    const ca = crabs(a)[0]!;
    const cb = crabs(b)[0]!;
    expect([ca.x, ca.y, ca.state, ca.runs]).toEqual([cb.x, cb.y, cb.state, cb.runs]);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(rockCrab.show!.spec, 1, 'rock-crab', 'coast');
    const modes = new Set<string>();
    for (let i = 0; i < 30 * 60; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const c of crabs(stage.sim)) modes.add(c.doing());
    }
    for (const s of ['run', 'stop']) expect(modes, s).toContain(s);
  });
});

describe('the cost', () => {
  it('draws a frame with five drawImages (six under the swell, five waving) and updates cheaply', () => {
    const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
    const parts: RockCrabParts = { shadow: sprite(), body: sprite(), legs: [sprite(), sprite(), sprite()], claw: sprite(), foam: sprite() };
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, key) => (key === 'drawImage' ? () => n++ : key === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    drawRockCrab(ctx as never, parts, feedPose(0.3));
    expect(n).toBe(5);
    drawRockCrab(ctx as never, parts, { ...feedPose(0), wash: 1 });
    expect(n).toBe(11);
    drawRockCrab(ctx as never, parts, wavePose(0.5, 1.8, 1));
    expect(n).toBe(16);
    const sim = coastSim(2, { hour: 23 });
    sim.spawn('rock-crab', { count: 2 });
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
