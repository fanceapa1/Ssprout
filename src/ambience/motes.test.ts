import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createDefaultState, type ActiveSession, type GardenState, type PlantInstance } from '../core/state';
import { gardenScene } from '../scene/geometry';
import { createEnvelope, settleEnvelope, targetsFor } from './envelope';
import { MOTE, moteEmitters, moteRate, pickEmitter, type Emitter } from './motes';
import { createSim, lifeAlpha, rainTarget, RAIN, stepSim, warmSim, type SimInputs } from './sim';
import { wind } from './wind';

const slots = gardenScene.slots;
const plant = (slotId: string, i: number): PlantInstance => ({
  id: `p${i}`,
  speciesId: 'x',
  slotId,
  seed: i,
  plantedAt: 0,
  sessionMinutes: 25,
  taskName: 't',
  completedAt: 0,
});
const session = (slotId: string, startedAt: number): ActiveSession => ({
  id: 's',
  taskName: 't',
  goalMs: 25 * 60_000,
  plan: { id: 'unbroken', name: 'Unbroken', blocks: [{ kind: 'focus', minutes: 25 }] },
  speciesId: 'x',
  slotId,
  seed: 1,
  displacedPlantId: null,
  startedAt,
  pausedAt: null,
  pausedTotalMs: 0,
  skippedMs: 0,
  weather: 'sun',
  waterings: [],
});
const garden = (plants: PlantInstance[], s: ActiveSession | null): GardenState => ({ ...createDefaultState(0), plants, session: s });

describe('moteEmitters', () => {
  it('one emitter per finished plant in a known slot, plus the growing plant (weighted)', () => {
    const st = garden([plant('meadow-1', 1), plant('nowhere', 2)], session('shore-1', 0));
    const e = moteEmitters(st, slots, 12.5 * 60_000);
    expect(e).toHaveLength(2);
    expect(e[0]!.weight).toBe(1);
    expect(e[1]!.weight).toBe(MOTE.growingWeight);
    expect(e[1]!.x).toBe(slots.find((s) => s.id === 'shore-1')!.x);
  });

  it('the growing plant gets taller as it grows', () => {
    const st = garden([], session('meadow-1', 0));
    const early = moteEmitters(st, slots, 60_000)[0]!.h;
    const late = moteEmitters(st, slots, 24 * 60_000)[0]!.h;
    expect(late).toBeGreaterThan(early);
  });

  it('a plant stepping aside for the session does not emit', () => {
    const st = garden([plant('meadow-1', 1)], session('meadow-1', 0));
    expect(moteEmitters(st, slots, 0)).toHaveLength(1);
  });
});

describe('moteRate', () => {
  const one: Emitter = { x: 0, y: 0, w: 10, h: 10, weight: 1 };
  it('is zero without plants or at level 0', () => {
    expect(moteRate([], 1)).toBe(0);
    expect(moteRate([one], 0)).toBe(0);
  });
  it('grows with plants and level, capped', () => {
    expect(moteRate([one, one], 1)).toBeGreaterThan(moteRate([one], 1));
    expect(moteRate([one], 1)).toBeGreaterThan(moteRate([one], 0.5));
    expect(moteRate(Array(200).fill(one), 1)).toBe(MOTE.maxRate);
    expect(moteRate([one], 5)).toBe(moteRate([one], 1));
  });
  it('pickEmitter respects weights', () => {
    const heavy: Emitter = { ...one, x: 1, weight: 3 };
    let n = 0;
    const rng = createRng(3);
    for (let i = 0; i < 4000; i++) if (pickEmitter([one, heavy], rng.next()) === heavy) n++;
    expect(n / 4000).toBeGreaterThan(0.7);
    expect(n / 4000).toBeLessThan(0.8);
    expect(pickEmitter([], 0.5)).toBeUndefined();
  });
});

const world = { pond: gardenScene.pond, area: { x: 0, y: 0, w: 1600, h: 1000 } };
const inputs = (levels = settleEnvelope(targetsFor('focus', 'rain')).value, emitters: Emitter[] = []): SimInputs => ({ levels, wind, emitters });

describe('sim', () => {
  it('motes: few at a time, at roughly the expected rate, mostly from the growing plant', () => {
    const emitters = moteEmitters(garden([plant('meadow-1', 1), plant('back-1', 2)], session('shore-1', 0)), slots, 10 * 60_000);
    const sim = createSim(createRng(1), world);
    const levels = settleEnvelope(targetsFor('focus', 'sun')).value;
    let spawned = 0;
    let seen = new Set<object>();
    let maxAlive = 0;
    const growing = emitters.find((e) => e.weight > 1)!;
    let fromGrowing = 0;
    for (let i = 0; i < 600 * 30; i++) {
      stepSim(sim, 1 / 30, inputs(levels, emitters));
      for (const m of sim.motes) {
        if (!seen.has(m)) {
          seen.add(m);
          spawned++;
          if (Math.abs(m.x - growing.x) <= growing.w / 2 + 1 && m.y <= growing.y) fromGrowing++;
        }
      }
      if (seen.size > 2000) seen = new Set(sim.motes);
      maxAlive = Math.max(maxAlive, sim.motes.length);
    }
    const rate = spawned / 600;
    expect(rate).toBeGreaterThan(moteRate(emitters, 1) * 0.75);
    expect(rate).toBeLessThan(moteRate(emitters, 1) * 1.1);
    expect(maxAlive).toBeLessThanOrEqual(MOTE.max);
    expect(fromGrowing / spawned).toBeGreaterThan(0.45);
  });

  it('motes rise and fade out', () => {
    const sim = createSim(createRng(2), world);
    const e: Emitter[] = [{ x: 800, y: 700, w: 40, h: 60, weight: 3 }];
    const levels = settleEnvelope(targetsFor('focus', 'sun')).value;
    while (sim.motes.length === 0) stepSim(sim, 1 / 30, inputs(levels, e));
    const m = sim.motes[0]!;
    const y0 = m.y;
    for (let i = 0; i < 60; i++) stepSim(sim, 1 / 30, inputs(levels, e));
    expect(m.y).toBeLessThan(y0 - 3);
    expect(lifeAlpha(0, 10)).toBe(0);
    expect(lifeAlpha(5, 10)).toBe(1);
    expect(lifeAlpha(10, 10)).toBe(0);
  });

  it('no motes outside focus', () => {
    const sim = createSim(createRng(3), world);
    const e: Emitter[] = [{ x: 800, y: 700, w: 40, h: 60, weight: 3 }];
    warmSim(sim, 30, inputs(settleEnvelope(targetsFor('break', 'sun')).value, e));
    expect(sim.motes).toHaveLength(0);
  });

  it('rain: count tracks the level; ripples stay on the pond', () => {
    const sim = createSim(createRng(4), world);
    warmSim(sim, 3, inputs());
    const full = sim.rain.length;
    const target = RAIN.layers.reduce((s, L) => s + rainTarget(L, world.area), 0);
    expect(full).toBeGreaterThan(target * 0.7);
    expect(full).toBeLessThan(target * 1.3);
    expect(sim.ripples.length).toBeGreaterThan(0);
    const box = sim.pondBox;
    for (const r of sim.ripples) {
      expect(r.x).toBeGreaterThanOrEqual(box.x);
      expect(r.x).toBeLessThanOrEqual(box.x + box.w);
    }
    const half = createSim(createRng(4), world);
    warmSim(half, 3, inputs({ ...settleEnvelope(targetsFor('focus', 'rain')).value, rain: 0.5 }));
    expect(half.rain.length).toBeLessThan(full * 0.7);
  });

  it('rain falls downward and slants with the wind', () => {
    const sim = createSim(createRng(5), world);
    warmSim(sim, 1, inputs());
    for (const r of sim.rain) {
      expect(r.vy).toBeGreaterThan(0);
      expect(Math.abs(r.vx / r.vy)).toBeLessThan(0.6);
    }
  });

  it('paused (motion 0): nothing moves, nothing spawns', () => {
    const sim = createSim(createRng(6), world);
    warmSim(sim, 2, inputs());
    const snapshot = JSON.stringify(sim.rain);
    const still = { ...settleEnvelope(targetsFor('paused', 'rain')).value };
    for (let i = 0; i < 60; i++) stepSim(sim, 1 / 30, inputs(still));
    expect(JSON.stringify(sim.rain)).toBe(snapshot);
  });

  it('sun glints are rare and bounded; nothing without weather', () => {
    const sim = createSim(createRng(7), world);
    warmSim(sim, 20, inputs(settleEnvelope(targetsFor('focus', 'sun')).value));
    expect(sim.glints.length).toBeLessThanOrEqual(5);
    expect(sim.rain).toHaveLength(0);
    const idle = createSim(createRng(7), world);
    warmSim(idle, 20, inputs(createEnvelope({ motion: 1 }).value));
    expect(idle.rain.length + idle.ripples.length + idle.glints.length + idle.motes.length).toBe(0);
  });

  it('is deterministic for a seed', () => {
    const a = createSim(createRng(9), world);
    const b = createSim(createRng(9), world);
    warmSim(a, 2, inputs());
    warmSim(b, 2, inputs());
    expect(JSON.stringify(a.rain)).toBe(JSON.stringify(b.rain));
  });
});
