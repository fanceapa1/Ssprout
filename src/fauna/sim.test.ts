import { describe, expect, it } from 'vitest';
import type { PlantInstance } from '../core/state';
import { gardenScene } from '../scene/geometry';
import { JAPANESE_FAUNA } from '../scenery/japanese-garden/fauna';
import { pointInPolygon } from './math';
import { FaunaSim } from './sim';
import type { TargetSpecies } from './targets';
import { FAUNA_TUNING } from './tuning';

const ALL = JAPANESE_FAUNA;
const flower: TargetSpecies = { pollinators: true, habitats: ['meadow', 'path', 'rock', 'shore', 'back'], size: { w: 60, h: 90 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: '#e8a7a9' };
const lily: TargetSpecies = { pollinators: false, habitats: ['water'], size: { w: 60, h: 30 }, anchor: { x: 0.5, y: 0.6 }, bloomColor: '#faf6ee' };
const lookup = (id: string) => (id === 'lily' ? lily : flower);
const plants: PlantInstance[] = gardenScene.slots.map((s, i) => ({
  id: `p${i}`,
  speciesId: s.habitat === 'water' ? 'lily' : 'flower',
  sceneryId: 'japanese-garden',
  slotId: s.id,
  seed: i + 1,
  plantedAt: 0,
  sessionMinutes: 25,
  taskName: 't',
  completedAt: 1,
}));

/** Simulating hours of garden time takes seconds; give those tests room on a loaded machine. */
const LONG_RUN_MS = 30_000;

function run(opts: { seed?: number; seconds: number; reduced?: boolean; hour?: number; each?: (sim: FaunaSim) => void }) {
  const sim = new FaunaSim({ scene: gardenScene, seed: opts.seed ?? 7, reducedMotion: opts.reduced });
  sim.setGarden(plants, ALL, lookup);
  sim.hourOverride = opts.hour ?? 12;
  const spawnedKinds = new Map<string, number>();
  const seen = new Set<number>();
  for (let t = 0; t < opts.seconds; t += 0.1) {
    sim.update(0.1, 0);
    for (const c of sim.creatures) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        spawnedKinds.set(c.kind, (spawnedKinds.get(c.kind) ?? 0) + 1);
      }
    }
    opts.each?.(sim);
  }
  return { sim, spawnedKinds };
}

describe('FaunaSim', () => {
  it('keeps the residents the roster asks for: three koi, striders, a frog on the pad', () => {
    const { sim } = run({ seconds: 5 });
    const count = (k: string) => sim.creatures.filter((c) => c.kind === k).length;
    expect(count('koi')).toBe(3);
    expect(count('strider')).toBe(FAUNA_TUNING.striders);
    expect(count('frog')).toBe(1);
  });

  it('koi and striders never leave the pond, and visitors never exceed the cap', () => {
    let maxVisitors = 0;
    // collect problems and assert once: an expect() per creature per step made this test slow
    // enough to time out on a loaded machine
    const problems: string[] = [];
    run({
      seconds: 1800,
      each(sim) {
        let visitors = 0;
        for (const c of sim.creatures) {
          if ((c.kind === 'koi' || c.kind === 'strider') && !pointInPolygon(c, gardenScene.pond)) problems.push(`${c.kind} at ${c.x},${c.y}`);
          if (c.visitor) visitors++;
          if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) problems.push(`${c.kind} not finite`);
        }
        maxVisitors = Math.max(maxVisitors, visitors);
      },
    });
    expect(problems.slice(0, 5)).toEqual([]);
    expect(maxVisitors).toBeLessThanOrEqual(FAUNA_TUNING.maxVisitors);
  }, LONG_RUN_MS);

  it('brings every visiting kind over a long afternoon, but rarely', () => {
    const { spawnedKinds } = run({ seconds: 3600 });
    for (const k of ['dragonfly', 'butterfly', 'bee', 'bird', 'leaf']) expect(spawnedKinds.get(k) ?? 0, k).toBeGreaterThan(0);
    expect(spawnedKinds.get('heron') ?? 0).toBeLessThanOrEqual(4);
    expect(spawnedKinds.get('dragonfly') ?? 0).toBeLessThan(40);
  }, LONG_RUN_MS);

  it('is deterministic for a seed', () => {
    const a = run({ seed: 3, seconds: 300 }).sim.list();
    const b = run({ seed: 3, seconds: 300 }).sim.list();
    expect(a).toEqual(b);
  });

  it('at night no birds, bees or butterflies come; the koi stay', () => {
    const { sim, spawnedKinds } = run({ seconds: 1800, hour: 23 });
    for (const k of ['bird', 'bee', 'butterfly', 'dragonfly', 'swallow', 'heron']) expect(spawnedKinds.get(k) ?? 0, k).toBe(0);
    expect(sim.creatures.filter((c) => c.kind === 'koi')).toHaveLength(3);
  });

  it('reduced motion: far fewer visits, one striders, no swallows', () => {
    const calm = run({ seconds: 3600 }).spawnedKinds;
    const { sim, spawnedKinds } = run({ seconds: 3600, reduced: true });
    const total = (m: Map<string, number>) => ['dragonfly', 'butterfly', 'bee', 'bird'].reduce((s, k) => s + (m.get(k) ?? 0), 0);
    expect(total(spawnedKinds)).toBeLessThan(total(calm) / 2);
    expect(spawnedKinds.get('swallow') ?? 0).toBe(0);
    expect(sim.creatures.filter((c) => c.kind === 'strider')).toHaveLength(FAUNA_TUNING.reducedStriders);
  }, LONG_RUN_MS);

  it('a garden that loses its plants lets the koi go', () => {
    const { sim } = run({ seconds: 2 });
    sim.setGarden([], JAPANESE_FAUNA.filter((f) => f.id === 'striders' || f.id === 'leaf'), lookup);
    for (let t = 0; t < 30; t += 0.1) sim.update(0.1, 0);
    expect(sim.creatures.filter((c) => c.kind === 'koi')).toHaveLength(0);
    expect(sim.creatures.filter((c) => c.kind === 'frog')).toHaveLength(0);
  });
});
