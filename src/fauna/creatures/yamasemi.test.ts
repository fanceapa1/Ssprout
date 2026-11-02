import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { FOAM, WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { closestOnPolygon, insideWithMargin, pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { Stage } from '../stage';
import { THREATS } from './kajika';
import { SAWAGANI_TUNING } from './sawagani';
import yamasemi, { choosePerch, FALLS_CLEAR, onRock, plungeSpot, Route, streamWay, Yamasemi, YAMASEMI_TUNING, yamasemiPerches } from './yamasemi';

const plants: PlantInstance[] = [];
const ONLY = WATERFALL_FAUNA.filter((r) => r.kind === 'yamasemi');
const inFoam = (p: { x: number; y: number }) => ((p.x - FOAM.x) / FOAM.rx) ** 2 + ((p.y - FOAM.y) / FOAM.ry) ** 2 < 1;

function waterfallSim(seed = 4, { hour = 12, reduced = false, rows = [] as typeof ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const birds = (sim: FaunaSim) => sim.creatures.filter((c): c is Yamasemi => c instanceof Yamasemi);

describe('where the yamasemi perches and fishes', () => {
  const w = waterfallSim().world;

  it('perches on the high rocks by the pool, never on a shelf in the falls or a stone out in the stream', () => {
    const ids = yamasemiPerches(w).map((c) => c.perch.id);
    expect(ids).toContain('rock-pool-left');
    expect(ids).toContain('rock-outflow');
    expect(ids).not.toContain('rock-stream');
    for (const c of yamasemiPerches(w)) {
      if (c.perch.kind === 'ledge') expect(closestOnPolygon(c.perch, waterfallScene.falls!.outline).d).toBeGreaterThanOrEqual(FALLS_CLEAR);
    }
    expect(ids.some((id) => id.startsWith('ledge-'))).toBe(false);
    // the high rock is its favourite; the rock in the falls' spray the least
    const weight = (id: string) => yamasemiPerches(w).find((c) => c.perch.id === id)?.weight ?? 0;
    expect(weight('rock-pool-left')).toBeGreaterThan(weight('rock-foot'));
  });

  it('keeps off perches others hold', () => {
    const rng = createRng(3);
    const left = w.perches.find((p) => p.id === 'rock-pool-left')!;
    for (let i = 0; i < 50; i++) expect(choosePerch(w, rng, [{ x: left.x, y: left.y }])?.id).not.toBe('rock-pool-left');
  });

  it('plunges only into the still water, well inside it: never the foam, the shore or the stream', () => {
    const rng = createRng(5);
    let found = 0;
    for (const c of yamasemiPerches(w)) {
      for (let i = 0; i < 60; i++) {
        const s = plungeSpot(w, { x: c.perch.x, y: c.perch.depth }, rng);
        if (!s) continue;
        found++;
        expect(insideWithMargin(s, w.pond.world, YAMASEMI_TUNING.margin - 0.01)).toBe(true);
        expect(inFoam(s)).toBe(false);
        expect(onRock(s, waterfallScene.rocks, 11.9)).toBe(false);
      }
    }
    expect(found).toBeGreaterThan(100);
  });

  it('comes and goes low along the stream, from off the view', () => {
    const way = streamWay(w, createRng(2), YAMASEMI_TUNING.low);
    const mouth = way[0]!;
    const v = w.view;
    expect(mouth.x < v.x || mouth.x > v.x + v.w || mouth.y < v.y || mouth.y > v.y + v.h).toBe(true);
    // the rest over the stream, a little above the water
    for (const q of way.slice(1)) {
      expect(pointInPolygon({ x: q.x, y: q.g }, w.water.moving[0]!)).toBe(true);
      expect(q.g - q.y).toBeCloseTo(YAMASEMI_TUNING.low, 5);
    }
  });

  it('walks a smoothed route by distance', () => {
    const r = new Route([
      { x: 0, y: 0, g: 0 },
      { x: 100, y: 0, g: 10 },
      { x: 100, y: 100, g: 20 },
    ]);
    expect(r.at(0)).toMatchObject({ x: 0, y: 0 });
    expect(r.at(r.len)).toMatchObject({ x: 100, y: 100, g: 20 });
    expect(r.len).toBeLessThan(200);
    expect(r.len).toBeGreaterThan(150);
  });

  it('never comes to the Japanese garden (no stream to come along)', () => {
    const sim = new FaunaSim({ scene: gardenScene, seed: 3 });
    expect(yamasemi.needs!(sim.world)).toBe(false);
    expect(sim.spawn('yamasemi')).toHaveLength(0);
  });

  it('is a threat the crab and the kajika know', () => {
    expect(THREATS.yamasemi).toBeDefined();
    expect(SAWAGANI_TUNING.threats.yamasemi).toBeGreaterThan(0);
  });
});

describe('a visit', () => {
  it('arrives along the stream, watches from its perch, hovers and plunges, comes back, and leaves down the stream', () => {
    const sim = waterfallSim(7, { auto: false });
    const [b] = sim.spawn('yamasemi') as Yamasemi[];
    expect(b).toBeDefined();
    const problems: string[] = [];
    const states = new Set<string>();
    let entered = false;
    let t = 0;
    for (; t < 600 && birds(sim).length > 0; t += 0.05) {
      sim.update(0.05, 0);
      states.add(b!.state);
      if (!Number.isFinite(b!.x) || !Number.isFinite(b!.y)) problems.push(`NaN at ${t.toFixed(1)}`);
      if (b!.state === 'enter' && t < 0.2 && !entered) entered = true;
      if ((b!.state === 'plunge' || b!.state === 'under') && b!.target) {
        if (inFoam(b!.target)) problems.push(`plunge in the foam at ${t.toFixed(1)}`);
        if (!pointInPolygon(b!.target, sim.world.pond.world)) problems.push(`plunge off the pool at ${t.toFixed(1)}`);
      }
      if (b!.state === 'perch' && b!.perch?.id.startsWith('ledge-')) problems.push(`on a falls ledge at ${t.toFixed(1)}`);
    }
    expect(problems).toEqual([]);
    expect(entered).toBe(true);
    for (const s of ['enter', 'perch', 'launch', 'hover', 'plunge', 'under', 'emerge', 'return', 'leave']) expect(states, s).toContain(s);
    expect(b!.plunges).toBeGreaterThanOrEqual(3);
    // gone within its stay and the flight out
    expect(birds(sim)).toHaveLength(0);
    expect(t).toBeLessThan(b!.stay + 60);
  });

  it('comes up with a fish now and then', () => {
    let plunges = 0;
    let catches = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = waterfallSim(seed, { auto: false });
      const [b] = sim.spawn('yamasemi') as Yamasemi[];
      for (let i = 0; i < 4000 && birds(sim).length > 0; i++) sim.update(0.05, 0);
      plunges += b!.plunges;
      catches += b!.catches;
    }
    expect(catches).toBeGreaterThan(0);
    expect(catches).toBeLessThan(plunges);
  });

  it('is rare, diurnal, counted as a visitor, and leaves at nightfall', () => {
    const sim = waterfallSim(11, { rows: ONLY });
    let seen = 0;
    let arrivals = 0;
    let atNight = 0;
    for (let t = 0; t < 7200; t += 0.25) {
      sim.hourOverride = t < 6600 ? 12 : 22;
      const before = birds(sim).length;
      sim.update(0.25, 0);
      const now = birds(sim).length;
      if (now > before) arrivals++;
      if (now > 0) seen++;
      if (t > 6700 && now > 0) atNight++;
      expect(now).toBeLessThanOrEqual(1);
    }
    expect(arrivals).toBeGreaterThanOrEqual(1);
    expect(arrivals).toBeLessThanOrEqual(5);
    expect(seen).toBeGreaterThan(0);
    expect(atNight).toBe(0);
    expect(yamasemi.visit!.diurnal).toBe(true);
    expect(yamasemi.visit!.visitor).toBe(true);
    expect(yamasemi.visit!.gap[0]).toBeGreaterThanOrEqual(900);
  });

  it('draws only on its own fork: other creatures’ randomness is untouched', () => {
    const a = waterfallSim(5, { auto: false });
    const b = waterfallSim(5, { auto: false });
    // rings are the sim's own (their variant comes from its stream): leave them out here
    a.world.ripple = () => {};
    b.world.ripple = () => {};
    a.spawn('yamasemi');
    b.spawn('yamasemi');
    for (let i = 0; i < 1200; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = waterfallSim(9, { auto: false });
      sim.spawn('yamasemi');
      for (let i = 0; i < 1500; i++) sim.update(0.05, 0);
      return birds(sim).map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.state}`);
    };
    expect(run()).toEqual(run());
  });

  it('in reduced motion: slower, and still hunts', () => {
    const speed = (reduced: boolean) => {
      const sim = waterfallSim(3, { reduced, auto: false });
      const [b] = sim.spawn('yamasemi') as Yamasemi[];
      let d = 0;
      let n = 0;
      for (let i = 0; i < 3000 && birds(sim).length > 0; i++) {
        const x = b!.x;
        const y = b!.y;
        const s = b!.state;
        sim.update(0.05, 0);
        if (s === 'enter' && b!.state === 'enter') {
          d += Math.hypot(b!.x - x, b!.y - y);
          n++;
        }
      }
      return { v: d / n / 0.05, plunges: b!.plunges };
    };
    const calm = speed(true);
    const lively = speed(false);
    expect(calm.v).toBeLessThan(lively.v * 0.75);
    expect(calm.plunges).toBeGreaterThan(0);
  });

  it('hunts on the studio’s falls stage', () => {
    const stage = new Stage(yamasemi.show!.spec, 1, 'yamasemi', 'falls');
    const states = new Set<string>();
    for (let i = 0; i < 1800; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const b of birds(stage.sim)) states.add(b.state);
    }
    for (const s of ['perch', 'hover', 'plunge', 'emerge']) expect(states, s).toContain(s);
  });
});
