import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { FOAM, WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { fallsStage } from '../stage';
import type { Perch } from '../targets';
import { dipCurve, Dipper, dipperWaters, diveEntry, inWater, nextPerch, streamMouth, underExit } from './dipper';

const inFoam = (p: { x: number; y: number }) => ((p.x - FOAM.x) / FOAM.rx) ** 2 + ((p.y - FOAM.y) / FOAM.ry) ** 2 < 0.97;
const plants: PlantInstance[] = [];

function waterfallSim(seed = 4, reduced = false) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: reduced });
  sim.setGarden(plants, WATERFALL_FAUNA, () => undefined);
  sim.hourOverride = 12;
  return sim;
}

const dippers = (sim: FaunaSim) => sim.creatures.filter((c): c is Dipper => c instanceof Dipper);

// every garden's creatures (ADR 0346)
await loadAllCreatures();

describe('where the dipper can go', () => {
  const w = waterfallSim().world;
  const waters = dipperWaters(w);
  const rocks = w.perches.filter((p) => p.kind === 'rock');

  it('walks in beside or in front of each wet rock, never from a ledge, never into the foam', () => {
    const rng = createRng(3);
    for (const rock of rocks) {
      for (let i = 0; i < 20; i++) {
        const e = diveEntry(rock, waters, rng);
        expect(e, rock.id).not.toBeNull();
        expect(inWater(e!, waters, 5)).toBe(true);
        expect(inFoam(e!)).toBe(false);
        // never behind the rock it stands on
        if (e!.y < rock.depth - 2) expect(Math.abs(e!.x - rock.x)).toBeGreaterThan(rock.spread * 2);
      }
    }
    for (const ledge of w.perches.filter((p) => p.kind === 'ledge')) expect(diveEntry(ledge, waters, rng)).toBeNull();
  });

  it('comes up 24–70 units on, in the same water, the whole way under it', () => {
    const rng = createRng(5);
    for (const rock of rocks) {
      const e = diveEntry(rock, waters, rng)!;
      const x = underExit(e, waters, rng)!;
      expect(x).not.toBeNull();
      const d = Math.hypot(x.x - e.x, (x.y - e.y) / 0.4);
      expect(d).toBeGreaterThanOrEqual(23.9);
      expect(d).toBeLessThanOrEqual(70.1);
      const body = waters.find((p) => pointInPolygon(e, p))!;
      for (let k = 0; k <= 10; k++) expect(pointInPolygon({ x: e.x + ((x.x - e.x) * k) / 10, y: e.y + ((x.y - e.y) * k) / 10 }, body)).toBe(true);
    }
  });

  it('flies away down the stream, off the view', () => {
    const m = streamMouth(w, createRng(1));
    const v = w.view;
    expect(m.y).toBeGreaterThan(900);
    expect(m.x > v.x + v.w || m.y > v.y + v.h || m.x < v.x).toBe(true);
  });

  it('prefers the wet rocks to the ledges, and never picks the perch it is on', () => {
    const rng = createRng(9);
    const counts = { rock: 0, ledge: 0 };
    const from = rocks[0]!;
    for (let i = 0; i < 600; i++) {
      const p = nextPerch(w.perches, from, rng, from, []) as Perch;
      expect(p).not.toBe(from);
      counts[p.kind as 'rock' | 'ledge']++;
    }
    expect(counts.rock).toBeGreaterThan(counts.ledge);
  });

  it('dips down fast and comes up slower', () => {
    expect(dipCurve(0)).toBe(0);
    expect(dipCurve(0.35)).toBeCloseTo(1);
    expect(dipCurve(1)).toBe(0);
    expect(dipCurve(0.15)).toBeGreaterThan(dipCurve(0.75));
  });
});

describe('the dipper at the waterfall', () => {
  it('is there from the start, on a perch, as the one resident', () => {
    const sim = waterfallSim();
    sim.update(0.1, 0);
    const d = dippers(sim);
    expect(d).toHaveLength(1);
    expect(d[0]!.state).toBe('perch');
    expect(d[0]!.visitor).toBe(false);
  });

  it('over 30 simulated minutes it bobs, dives, swims and flies, and is never in the foam or out of the water when wet', () => {
    const sim = waterfallSim(7);
    const seen = new Set<string>();
    const problems: string[] = [];
    const waters = dipperWaters(sim.world);
    for (let s = 0; s < 30 * 60 * 10; s++) {
      sim.update(0.1, 0);
      for (const d of dippers(sim)) {
        seen.add(d.state);
        const wet = ['wade', 'dive', 'under', 'emerge', 'swim'].includes(d.state);
        if (wet && inFoam(d)) problems.push(`${d.state} in the foam at ${d.x | 0},${d.y | 0}`);
        if (wet && !inWater(d, waters, 0)) problems.push(`${d.state} out of the water at ${d.x | 0},${d.y | 0}`);
        if (d.state === 'under' && d.layer !== 'underwater') problems.push('under but not on the underwater layer');
        if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) problems.push('not finite');
      }
      if (dippers(sim).length > 1) problems.push('two dippers');
    }
    expect(problems.slice(0, 5)).toEqual([]);
    for (const st of ['perch', 'walk', 'wade', 'dive', 'under', 'emerge', 'swim', 'fly']) expect(seen, st).toContain(st);
  });

  it('flies off down the stream at night and is back by day', () => {
    const sim = waterfallSim(2);
    sim.update(0.1, 0);
    sim.hourOverride = 22;
    for (let s = 0; s < 600; s++) sim.update(0.1, 0);
    expect(dippers(sim)).toHaveLength(0);
    sim.hourOverride = 9;
    sim.update(0.1, 0);
    expect(dippers(sim)).toHaveLength(1);
    expect(dippers(sim)[0]!.state).toBe('enter');
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const sim = waterfallSim(11);
      for (let s = 0; s < 3000; s++) sim.update(0.1, 0);
      return dippers(sim).map((d) => `${d.state}:${d.x.toFixed(2)},${d.y.toFixed(2)}`);
    };
    expect(run()).toEqual(run());
  });

  it('is slower with reduced motion but still dives', () => {
    const sim = waterfallSim(7, true);
    const seen = new Set<string>();
    for (let s = 0; s < 30 * 60 * 10; s++) {
      sim.update(0.1, 0);
      for (const d of dippers(sim)) seen.add(d.state);
    }
    expect(seen).toContain('under');
  });
});

describe('the dipper on the studio’s falls stage', () => {
  it('finds a rock to dive from', () => {
    const { habitat } = fallsStage({ w: 380, h: 240 });
    const waters = [habitat.water!.still, ...habitat.water!.moving];
    const rock = habitat.perches!.find((p) => p.kind === 'rock')!;
    expect(diveEntry(rock, waters, createRng(2))).not.toBeNull();
  });
});
