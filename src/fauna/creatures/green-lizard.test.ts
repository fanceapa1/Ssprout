import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import type { PlantInstance } from '../../core/state';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { FaunaSim } from '../sim';
import { wallTopAt } from '../targets';
import type { Creature } from '../types';
import type { Sprite } from '../sprite';
import greenLizard, { drawGreenLizard, GreenLizard, legReach, lizardHomes, LIZARD_REST, lookPose, threatNear, wallPoint, type GreenLizardParts } from './green-lizard';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'green-lizard');

function coastSim(seed = 4, { hour = 12, auto = false } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, auto });
  sim.setGarden(plants, ONLY, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const lizards = (sim: FaunaSim) => sim.creatures.filter((c): c is GreenLizard => c instanceof GreenLizard && !c.done);
const run = (sim: FaunaSim, seconds: number, dt = 0.1) => {
  for (let s = 0; s < seconds; s += dt) sim.update(dt, 0);
};
const stub = (kind: string, x: number, y: number): Creature => ({ id: 999, kind, x, y, layer: 'air', state: 'fly', done: false, visitor: true, forced: true, update: () => {}, draw: () => {}, depth: () => null, leave: () => {} });

await loadAllCreatures();

describe('where the green lizard lives', () => {
  it('holds stretches of the three terrace walls, on the face and the coping', () => {
    const homes = lizardHomes(coastSim().world);
    expect(homes.length).toBeGreaterThan(3);
    for (const h of homes) {
      expect(h.face.id).toMatch(/^wall-/);
      expect(h.lo).toBeLessThan(h.x);
      expect(h.hi).toBeGreaterThan(h.x);
      // the coping's top (v −0.15) down to most of the face, never below the foot
      for (const x of [h.lo, h.x, h.hi]) {
        expect(wallPoint(h, x, -0.15).y).toBeGreaterThanOrEqual(wallTopAt(h.face, x) - h.face.h * 0.16);
        expect(wallPoint(h, x, 0.75).y).toBeLessThan(wallTopAt(h.face, x) + h.face.h);
      }
    }
  });

  it('lives only on the coast, and only by day', () => {
    const sim = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS.fauna, auto: false });
    expect(greenLizard.needs!(sim.world)).toBe(false);
    const mode = { reduced: false, lively: false, boost: new Set<never>() };
    expect(greenLizard.resident!(1, { ...mode, night: false })).toBe(1);
    expect(greenLizard.resident!(1, { ...mode, night: true })).toBe(0);
    expect(greenLizard.resident!(0, { ...mode, night: false })).toBe(0);
  });

  it('keeps one lizard on the walls by day and none at night', () => {
    const day = coastSim(2, { auto: true });
    run(day, 30);
    expect(lizards(day)).toHaveLength(1);
    const night = coastSim(2, { hour: 1, auto: true });
    run(night, 30);
    expect(lizards(night)).toHaveLength(0);
  });
});

describe('one lizard', () => {
  it('a hand spawn beside the resident is refused; another comes once it is gone', () => {
    const sim = coastSim(2, { auto: true });
    run(sim, 30);
    expect(lizards(sim)).toHaveLength(1);
    expect(sim.spawn('green-lizard')).toHaveLength(0);
    run(sim, 5);
    expect(lizards(sim)).toHaveLength(1);
    sim.hourOverride = 1;
    run(sim, 30);
    expect(lizards(sim)).toHaveLength(0);
    expect(sim.spawn('green-lizard')).toHaveLength(1);
  });
});

describe('a lizard on the wall', () => {
  it('peers out, then basks, looks round, and dashes in legs with stops, staying on its stretch', () => {
    const sim = coastSim(3);
    const [z] = sim.spawn('green-lizard') as GreenLizard[];
    expect(z!.doing()).toBe('hidden');
    const seen = new Set<string>();
    for (let s = 0; s < 300; s += 0.1) {
      sim.update(0.1, 0);
      seen.add(z!.doing());
      const h = z!.home;
      if (z!.doing() !== 'peer' && z!.gapKeep === null) {
        expect(z!.x).toBeGreaterThanOrEqual(h.lo - 1e-6);
        expect(z!.x).toBeLessThanOrEqual(h.hi + 1e-6);
      }
      expect(z!.v).toBeGreaterThanOrEqual(-0.15 - 1e-9);
      expect(z!.v).toBeLessThanOrEqual(0.75 + 1e-9);
      expect(z!.layer).toBe('entities');
    }
    for (const m of ['hidden', 'peer', 'bask', 'look', 'dash', 'stop']) expect(seen, m).toContain(m);
    expect(z!.basks).toBeGreaterThan(5);
    expect(z!.stops).toBeGreaterThan(2);
    expect(z!.dashes).toBeGreaterThan(z!.basks);
  });

  it('dashes fast and straight, and lies still while it basks', () => {
    const sim = coastSim(6);
    const [z] = sim.spawn('green-lizard') as GreenLizard[];
    let fast = 0;
    for (let i = 0; i < 3000; i++) {
      const was = { x: z!.x, y: z!.y, m: z!.doing() };
      sim.update(0.05, 0);
      if (was.m === 'bask' && z!.doing() === 'bask') expect([z!.x, z!.y]).toEqual([was.x, was.y]);
      if (was.m === 'dash' && z!.doing() === 'dash' && Math.hypot(z!.x - was.x, z!.y - was.y) > 1.5) fast++;
    }
    expect(fast).toBeGreaterThan(10);
  });

  it('runs with the trunk’s outer side reaching: fore leg forward, hind leg back, the inner side gathered', () => {
    for (const bend of [1, -1]) {
      // the trunk curves toward +y for a bend of +1, so −y is its outer side
      const outer = -bend;
      expect(legReach(bend, outer, true)).toBeGreaterThan(0);
      expect(legReach(bend, outer, false)).toBeLessThan(0);
      expect(legReach(bend, -outer, true)).toBeLessThan(0);
      expect(legReach(bend, -outer, false)).toBeGreaterThan(0);
    }
    // a diagonal pair moves together: one side's fore leg with the other side's hind leg
    expect(legReach(1, 1, true)).toBe(legReach(1, -1, false));
  });

  it('draws with two drawImages: the body with its cast shadow, and the head', () => {
    const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
    const parts: GreenLizardParts = { body: [sprite(), sprite(), sprite()], head: [sprite(), sprite()] };
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, { get: (_, key) => (key === 'drawImage' ? () => n++ : () => {}), set: () => true });
    drawGreenLizard(ctx as never, parts, LIZARD_REST);
    drawGreenLizard(ctx as never, parts, { ...lookPose(1), frame: 1 });
    expect(n).toBe(4);
  });

  it('looks round with its head lifted, the throat showing', () => {
    const qs = Array.from({ length: 20 }, (_, i) => lookPose(i / 4));
    for (const q of qs) expect(q.lift).toBe(1);
    expect(Math.max(...qs.map((q) => q.turn)) - Math.min(...qs.map((q) => q.turn))).toBeGreaterThan(0.6);
  });

  it('runs for a gap and slips in head first when the cat comes near, then peers back out', () => {
    const sim = coastSim(8);
    const [z] = sim.spawn('green-lizard') as GreenLizard[];
    while (z!.doing() !== 'bask') run(sim, 0.1);
    // a butterfly near, a gull far off: nothing
    sim.creatures.push(stub('butterfly', z!.x + 5, z!.y), stub('gull', z!.x + 300, z!.y));
    run(sim, 0.5);
    expect(z!.frights).toBe(0);
    const cat = stub('cat', z!.x + 40, z!.y - 20);
    sim.creatures.push(cat);
    run(sim, 0.02, 0.02);
    expect(z!.frights).toBe(1);
    expect(['flee', 'slip']).toContain(z!.doing());
    while (z!.doing() === 'flee') run(sim, 0.02, 0.02);
    expect(z!.doing()).toBe('slip');
    expect(z!.gapKeep).toBe('back');
    // the snout at the gap: the head goes in first
    expect(z!.gapAt()).toBeCloseTo(12.8, 0);
    run(sim, 1.5);
    expect(z!.doing()).toBe('hidden');
    // it stays in while the cat is there
    run(sim, 40);
    expect(z!.doing()).toBe('hidden');
    cat.done = true;
    const peeks = z!.peeks;
    run(sim, 20);
    expect(z!.peeks).toBe(peeks + 1);
    expect(['peer', 'dash', 'stop', 'bask', 'look']).toContain(z!.doing());
  });

  it('a big bird near frightens it, a small one does not', () => {
    expect(threatNear({ x: 0, y: 0 }, [{ kind: 'heron', x: 120, y: 0, done: false }])).toBe('heron');
    expect(threatNear({ x: 0, y: 0 }, [{ kind: 'gull', x: 60, y: 0, done: false }])).toBe('gull');
    expect(threatNear({ x: 0, y: 0 }, [{ kind: 'swallow', x: 5, y: 0, done: false }])).toBeNull();
    expect(threatNear({ x: 0, y: 0 }, [{ kind: 'bee', x: 1, y: 0, done: false }])).toBeNull();
  });

  it('goes into its gap at nightfall and is gone', () => {
    const sim = coastSim(5, { hour: 12 });
    const [z] = sim.spawn('green-lizard') as GreenLizard[];
    while (z!.doing() !== 'bask') run(sim, 0.1);
    sim.hourOverride = 1;
    run(sim, 10);
    expect(z!.done).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const trace = (seed: number) => {
      const sim = coastSim(seed);
      const [z] = sim.spawn('green-lizard') as GreenLizard[];
      const out: string[] = [];
      for (let i = 0; i < 400; i++) {
        sim.update(0.1, 0);
        out.push(`${z!.doing()}:${z!.x.toFixed(3)}:${z!.y.toFixed(3)}`);
      }
      return out.join('|');
    };
    expect(trace(11)).toBe(trace(11));
    expect(trace(11)).not.toBe(trace(12));
  });
});
