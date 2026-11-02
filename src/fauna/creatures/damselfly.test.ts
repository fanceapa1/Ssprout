import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { FOAM, WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { closestOnPolygon, insideWithMargin } from '../math';
import { FaunaSim } from '../sim';
import { fallsStage } from '../stage';
import { chooseSpot, Damselfly, damselWaters, flightPose, perchSpots, restPose, waterPoint, wingAxes } from './damselfly';
import damselfly from './damselfly';

const inFoam = (p: { x: number; y: number }) => ((p.x - FOAM.x) / FOAM.rx) ** 2 + ((p.y - FOAM.y) / FOAM.ry) ** 2 < 0.97;
const plants: PlantInstance[] = [];

/** The waterfall with every row unlocked; `scheduled: false` leaves the damselfly to hand spawns. */
function waterfallSim(seed = 4, reduced = false, scheduled = false) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: reduced });
  sim.setGarden(plants, WATERFALL_FAUNA.filter((r) => scheduled || r.kind !== 'damselfly'), () => undefined);
  sim.hourOverride = 12;
  return sim;
}

const damsels = (sim: FaunaSim) => sim.creatures.filter((c): c is Damselfly => c instanceof Damselfly);
const len = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe('the damselfly’s wings', () => {
  it('rest closed over the back, lying flat in the side view', () => {
    const { fore, hind } = restPose(0);
    for (const w of [fore, hind]) {
      const { s, c } = wingAxes(w.phi, w.beta, true);
      expect(s.x).toBeLessThan(-0.95); // swept back along the abdomen
      expect(s.y).toBeLessThan(0); // tip a little above it
      expect(len(c)).toBeGreaterThan(0.95);
    }
  });

  it('open slowly toward us, and beat from high over the back to below the body', () => {
    // opening fans the near and far wings apart
    const fan = (k: number) => {
      const f = restPose(k).fore;
      const n = wingAxes(f.phi, f.beta, true).s;
      const r = wingAxes(f.phi, f.beta, false).s;
      return Math.abs(Math.atan2(n.y, n.x) - Math.atan2(r.y, r.x));
    };
    expect(fan(0)).toBeLessThan(0.01);
    expect(fan(1)).toBeGreaterThan(0.3);
    const tips = Array.from({ length: 24 }, (_, i) => {
      const f = flightPose((i / 24) * Math.PI * 2).fore;
      return wingAxes(f.phi, f.beta, true).s.y;
    });
    expect(Math.min(...tips)).toBeLessThan(-0.8);
    expect(Math.max(...tips)).toBeGreaterThan(0.5);
    // spread flat toward us the wing is foreshortened
    expect(len(wingAxes(0, 0.3, true).s)).toBeLessThan(0.5);
  });
});

describe('where the damselfly goes', () => {
  const w = waterfallSim().world;
  const waters = damselWaters(w);

  it('flies over the stream or the pool’s margin, never over the foam, in view', () => {
    const rng = createRng(3);
    for (let i = 0; i < 300; i++) {
      const q = waterPoint(w, rng, i % 2 ? { x: 1130, y: 760 } : null);
      expect(q).not.toBeNull();
      const inStream = w.water.moving.some((m) => insideWithMargin(q!, m, 3));
      const margin = insideWithMargin(q!, w.pond.world, 4) && closestOnPolygon(q!, w.pond.world).d < 70;
      expect(inStream || margin, `${q!.x | 0},${q!.y | 0}`).toBe(true);
      expect(inFoam(q!)).toBe(false);
      expect(q!.x > w.view.x && q!.x < w.view.x + w.view.w && q!.y > w.view.y && q!.y < w.view.y + w.view.h).toBe(true);
    }
    expect(waters.length).toBeGreaterThanOrEqual(2);
  });

  it('perches on the wet rocks, never on the cliff ledges', () => {
    const spots = perchSpots(w);
    const rocks = w.perches.filter((p) => p.kind === 'rock');
    expect(spots.filter((s) => s.kind === 'rock')).toHaveLength(rocks.length);
    expect(spots.some((s) => s.id.startsWith('ledge'))).toBe(false);
  });

  it('chooses another perch, clear of other creatures', () => {
    const spots = perchSpots(w);
    const rng = createRng(8);
    const from = spots[0]!;
    for (let i = 0; i < 200; i++) {
      const s = chooseSpot(spots, from, rng, from, [spots[1]!]);
      expect(s).not.toBeNull();
      expect(s!.id).not.toBe(from.id);
      expect(s!.id).not.toBe(spots[1]!.id);
    }
    expect(chooseSpot(spots.slice(0, 1), from, rng, from, [])).toBeNull();
  });
});

describe('the damselfly at the waterfall', () => {
  it('is a diurnal visitor that needs water and a perch', () => {
    expect(damselfly.role).toBe('visitor');
    expect(damselfly.visit!.diurnal).toBe(true);
    expect(damselfly.needs!(waterfallSim().world)).toBe(true);
  });

  it('visits by itself once its row is unlocked, and only by day', () => {
    const sim = waterfallSim(5, false, true);
    let first = -1;
    for (let s = 0; s < 3 * 60 * 10 && first < 0; s++) {
      sim.update(0.1, 0);
      if (damsels(sim).length > 0) first = s / 10;
    }
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(damselfly.visit!.first[1] + 1);
    const night = waterfallSim(5, false, true);
    night.hourOverride = 23;
    for (let s = 0; s < 5 * 60 * 10; s++) night.update(0.1, 0);
    expect(damsels(night)).toHaveLength(0);
  });

  it('comes as a pair, a male and a female', () => {
    const sim = waterfallSim();
    const made = sim.spawn('damselfly', { count: 2 }) as Damselfly[];
    expect(made.map((d) => d.sex).sort()).toEqual(['female', 'male']);
  });

  it('over a visit it flits over the water, perches, sallies back to its perch and leaves', () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    let returns = 0;
    let landings = 0;
    for (const seed of [2, 5, 9]) {
      const sim = waterfallSim(seed);
      sim.spawn('damselfly', { count: 2 });
      const spots = perchSpots(sim.world);
      const last = new Map<number, string>();
      const state = new Map<number, string>();
      for (let s = 0; s < 4 * 60 * 10; s++) {
        sim.update(0.1, 0);
        for (const d of damsels(sim)) {
          seen.add(d.state);
          if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) problems.push('not finite');
          if (d.state === 'perch') {
            const p = d.lastPerch()!;
            if (!spots.some((q) => q.id === p.id)) problems.push(`perched on ${p.id}`);
            if (Math.hypot(d.x - p.x, d.y - p.y) > p.spread + 0.5) problems.push(`off its perch ${p.id}`);
            if (state.get(d.id) !== 'perch') {
              landings++;
              if (last.get(d.id) === p.id) returns++;
              last.set(d.id, p.id);
            }
          }
          state.set(d.id, d.state);
          if (d.state === 'fly') {
            // low over the water: the ground under it is never far from a stream or the pool
            const g = { x: d.x, y: d.ground() };
            const near = damselWaters(sim.world).some((poly) => insideWithMargin(g, poly, 0) || closestOnPolygon(g, poly).d < 150);
            if (!near) problems.push(`far from the water at ${d.x | 0},${d.ground() | 0}`);
            if (d.ground() - d.y < -1) problems.push('below the ground');
          }
        }
      }
      if (damsels(sim).length > 0) problems.push(`seed ${seed}: still here after 4 minutes`);
    }
    expect(problems.slice(0, 5)).toEqual([]);
    for (const st of ['enter', 'fly', 'land', 'perch', 'leave']) expect(seen, st).toContain(st);
    expect(landings).toBeGreaterThan(10);
    expect(returns).toBeGreaterThan(2);
  });

  it('opens its wings slowly now and then on a perch', () => {
    const sim = waterfallSim(6);
    const [d] = sim.spawn('damselfly') as Damselfly[];
    let opened = 0;
    for (let s = 0; s < 1200; s++) {
      sim.update(0.1, 0);
      if (d!.state === 'perch' && (d as unknown as { open: number }).open > 0.3) opened++;
    }
    expect(opened).toBeGreaterThan(5);
  });

  it('leaves at night', () => {
    const sim = waterfallSim(3);
    sim.spawn('damselfly');
    for (let s = 0; s < 200; s++) sim.update(0.1, 0);
    sim.hourOverride = 22;
    for (let s = 0; s < 900; s++) sim.update(0.1, 0);
    expect(damsels(sim)).toHaveLength(0);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const sim = waterfallSim(11);
      sim.spawn('damselfly', { count: 2 });
      for (let s = 0; s < 1500; s++) sim.update(0.1, 0);
      return damsels(sim).map((d) => `${d.state}:${d.x.toFixed(2)},${d.y.toFixed(2)}`);
    };
    expect(run()).toEqual(run());
  });

  it('is slower with reduced motion, and still perches and leaves', () => {
    const progress = (reduced: boolean) => {
      const sim = waterfallSim(7, reduced);
      const [d] = sim.spawn('damselfly') as Damselfly[];
      const seen = new Set<string>();
      let path = 0;
      let px = d!.x;
      let py = d!.y;
      for (let s = 0; s < 6 * 60 * 10; s++) {
        sim.update(0.1, 0);
        seen.add(d!.state);
        if (s < 100) path += Math.hypot(d!.x - px, d!.y - py);
        px = d!.x;
        py = d!.y;
      }
      return { seen, path, done: d!.done };
    };
    const normal = progress(false);
    const slow = progress(true);
    expect(slow.path).toBeLessThan(normal.path);
    expect(slow.seen).toContain('perch');
    expect(slow.done).toBe(true);
  });
});

describe('the damselfly on the studio’s falls stage', () => {
  it('finds water and a rock to perch on', () => {
    const { habitat, scene } = fallsStage({ w: 380, h: 240 });
    const sim = new FaunaSim({ scene, seed: 1, habitat });
    sim.setGarden([], [], () => undefined);
    expect(damselfly.needs!(sim.world)).toBe(true);
    expect(waterPoint(sim.world, createRng(1))).not.toBeNull();
  });
});
