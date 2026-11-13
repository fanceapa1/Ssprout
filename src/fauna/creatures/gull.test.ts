import { afterEach, describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { COAST_CARRIERS } from '../../scenery/coast/wildlife';
import { OASIS } from '../../scenery/oasis';
import { WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { dist } from '../math';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import { carried, choosePerch, inRegion } from '../targets';
import { heldSpots } from './bird';
import gull, { choosePlace, drawGull, floatSpots, Gull, GULL_LEN, GULL_TUNING, gullPerches, gullScale, REST_POSE, soarCircle, wingsAt, type GullParts } from './gull';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'gull');

function coastSim(seed = 4, { hour = 12, reduced = false, rows = ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const gulls = (sim: FaunaSim) => sim.creatures.filter((c): c is Gull => c instanceof Gull);

/** A gull sent straight to `to` (or the mast), stepped until it stands there. */
function landed(sim: FaunaSim, prefer: 'mast' | undefined = 'mast'): Gull {
  const w = sim.world;
  const to = choosePlace(w, createRng(1), [], { prefer })!;
  const g = new Gull(w, createRng(2), 9999, to);
  g.forced = true;
  (sim as unknown as { creatures: unknown[] }).creatures.push(g);
  for (let i = 0; i < 2000 && g.state !== 'stand' && g.state !== 'float'; i++) sim.update(0.05, 0);
  return g;
}

/** Is a standing gull's body clear of every planting slot (half a length either side, its height above)? */
function bodyClear(sim: FaunaSim, g: Gull): boolean {
  const s = gullScale(g.scale);
  return sim.world.scene.slots.every((q) => !(Math.abs(q.x - g.x) < 0.5 * GULL_LEN * s && q.y > g.y - 0.45 * GULL_LEN * s && q.y < g.y + 20));
}

// every garden's creatures (ADR 0346)
await loadAllCreatures();

afterEach(() => {
  COAST_CARRIERS.caique!.pose = { dx: 0, dy: 0, angle: 0 };
});

describe('where the gull goes', () => {
  const sim = coastSim();
  const w = sim.world;

  it('takes the caique, a splash rock and the temple, read by name, its whole body clear of the slots', () => {
    const ps = gullPerches(w);
    const ids = ps.map((p) => p.perch.id);
    expect(ids).toContain('mast-top');
    expect(ids.filter((id) => id.startsWith('rail-')).length).toBeGreaterThan(0);
    expect(ids).toContain('architrave');
    expect(ps.some((p) => p.perch.kind === 'rock')).toBe(true);
    for (const { perch, x } of ps) {
      const s = gullScale(perch.scale ?? w.perspective(perch.depth, perch.x));
      for (const q of w.scene.slots) {
        const blocked = Math.abs(q.x - x) < 0.55 * GULL_LEN * s && q.y > perch.y - 0.5 * GULL_LEN * s - 20 && q.y < perch.y + 20;
        expect(blocked, `${perch.id} by ${q.id}`).toBe(false);
      }
    }
    // the boat's perches ride it
    expect(ps.filter((p) => p.perch.kind === 'boat').every((p) => p.perch.carrier === 'caique')).toBe(true);
  });

  it('floats in the shallows, clear of every slot and the heron’s stands', () => {
    const spots = floatSpots(w);
    expect(spots.length).toBeGreaterThan(20);
    const shallows = w.regions.find((r) => r.id === 'shallows')!;
    for (const q of spots) {
      expect(inRegion(shallows, q)).toBe(true);
      for (const s of w.scene.slots) expect(dist(s, q), s.id).toBeGreaterThanOrEqual(GULL_TUNING.slotGap);
      for (const s of w.stands()) expect(dist(s, q)).toBeGreaterThanOrEqual(GULL_TUNING.slotGap);
    }
  });

  it('circles inside the sky over the cove', () => {
    const sky = w.regions.find((r) => r.kind === 'sky')!;
    const rng = createRng(5);
    for (let i = 0; i < 40; i++) {
      const c = soarCircle(w, rng)!;
      for (let k = 0; k < 16; k++) expect(inRegion(sky, { x: c.c.x + Math.cos((k / 16) * Math.PI * 2) * c.r, y: c.c.y + Math.sin((k / 16) * Math.PI * 2) * c.ry })).toBe(true);
    }
  });

  it('never goes where another creature is, nor near a heron; an arrival takes the mast when it is free', () => {
    const rng = createRng(3);
    const mast = w.perches.find((p) => p.id === 'mast-top')!;
    expect(choosePlace(w, rng, [], { prefer: 'mast' })!.perch).toBe(mast);
    const held = [{ x: mast.x, y: mast.y }];
    for (let i = 0; i < 100; i++) expect(choosePlace(w, rng, held, { prefer: 'mast' })!.perch?.id).not.toBe('mast-top');
    const heron = { kind: 'heron', x: 340, y: 700, done: false };
    const near = { ...w, creatures: [heron] } as unknown as typeof w;
    for (let i = 0; i < 200; i++) {
      const to = choosePlace(near, rng, [])!;
      expect(dist(to, heron)).toBeGreaterThanOrEqual(GULL_TUNING.heronGap);
    }
  });

  it('lives only at the coast', () => {
    const garden = new FaunaSim({ scene: gardenScene, seed: 3 });
    expect(gull.needs!(garden.world)).toBe(false);
    expect(garden.spawn('gull')).toHaveLength(0);
    expect(gull.needs!(new FaunaSim({ scene: waterfallScene, seed: 3, habitat: WATERFALL_WILDLIFE }).world)).toBe(false);
    expect(gull.needs!(new FaunaSim({ scene: OASIS.geometry, seed: 3, habitat: OASIS.fauna }).world)).toBe(false);
    expect(gull.needs!(w)).toBe(true);
  });
});

describe('a day', () => {
  it('one gull, sometimes two: it stands, preens, stretches, calls, flies, soars, floats and patters off the water; never on a slot', () => {
    const problems: string[] = [];
    const did = { call: 0, preen: 0, stretch: 0, shift: 0, soar: 0, float: 0, patter: 0, boat: 0, rock: 0, ruin: 0 };
    let present = 0;
    let two = 0;
    let n = 0;
    const seen = new Set<Gull>();
    for (const seed of [1, 2, 3]) {
      const sim = coastSim(seed);
      const spots = floatSpots(sim.world);
      for (let t = 0; t < 3600; t += 0.1) {
        sim.update(0.1, 0);
        const all = gulls(sim);
        n++;
        if (all.length > 0) present++;
        if (all.length > 1) two++;
        if (all.length > 2) problems.push(`${all.length} gulls at ${t.toFixed(1)}`);
        for (const g of all) {
          seen.add(g);
          if (!Number.isFinite(g.x) || !Number.isFinite(g.y)) problems.push(`NaN at ${t.toFixed(1)}`);
          if (g.state === 'stand' && !bodyClear(sim, g)) problems.push(`standing by a slot at ${t.toFixed(1)} (${g.x.toFixed(0)}, ${g.y.toFixed(0)})`);
          if (g.state === 'float' && !spots.some((q) => Math.abs(q.x - g.x) < 10 && Math.abs(q.y - g.y) < 10)) problems.push(`afloat off the open water at ${t.toFixed(1)}`);
        }
      }
    }
    for (const g of seen) for (const k of Object.keys(did) as (keyof typeof did)[]) did[k] += g.did[k];
    expect(problems.slice(0, 10)).toEqual([]);
    // mostly there, a second now and then
    expect(present / n).toBeGreaterThan(0.5);
    expect(two / n).toBeGreaterThan(0.02);
    expect(two / n).toBeLessThan(0.35);
    for (const k of Object.keys(did) as (keyof typeof did)[]) expect(did[k], k).toBeGreaterThan(0);
  });

  it('rides the caique on its mast', () => {
    const sim = coastSim(6, { auto: false });
    const g = landed(sim);
    expect(g.place?.perch?.id).toBe('mast-top');
    const pose = { dx: 0.7, dy: -1.1, angle: 0.03 };
    sim.world.carriers.caique!.pose = pose;
    sim.update(0.05, 0);
    const want = carried(g.place!, sim.world.carriers.caique);
    expect(dist(g, want)).toBeLessThan(1e-6);
    expect(dist(g, g.place!)).toBeGreaterThan(0.5);
  });

  it('leaves at nightfall and does not come by night', () => {
    const sim = coastSim(5);
    for (let t = 0; t < 600 && gulls(sim).length === 0; t += 0.1) sim.update(0.1, 0);
    expect(gulls(sim).length).toBeGreaterThan(0);
    for (let t = 0; t < 60; t += 0.1) sim.update(0.1, 0);
    sim.hourOverride = 22;
    for (let t = 0; t < 120; t += 0.1) sim.update(0.1, 0);
    expect(gulls(sim)).toHaveLength(0);
    for (let t = 0; t < 1800; t += 0.5) {
      sim.update(0.5, 0);
      expect(gulls(sim)).toHaveLength(0);
    }
  });

  it('gives its spot, so small birds keep off its perch', () => {
    const sim = coastSim(7, { auto: false });
    const g = landed(sim);
    const held = heldSpots(sim.world);
    expect(held.some((q) => dist(q, g.place!) < 1e-6)).toBe(true);
    const boat = sim.world.perches.filter((p) => p.id === 'mast-top');
    expect(choosePerch(boat, held, createRng(1), 'boat')).toBeNull();
  });

  it('moves off when a heron comes near the water it floats on', () => {
    const sim = coastSim(8, { auto: false });
    const w = sim.world;
    const spot = floatSpots(w)[10]!;
    const g = new Gull(w, createRng(4), 9999, { kind: 'float', perch: null, x: spot.x, y: spot.y, scale: w.perspective(spot.y, spot.x), depth: spot.y + 0.5 });
    (sim as unknown as { creatures: unknown[] }).creatures.push(g);
    for (let i = 0; i < 2000 && g.state !== 'float'; i++) sim.update(0.05, 0);
    expect(g.state).toBe('float');
    (sim as unknown as { creatures: unknown[] }).creatures.push({ kind: 'heron', x: spot.x + 20, y: spot.y, done: false, update() {}, draw() {}, depth: () => null, leave() {} });
    let moved = false;
    for (let i = 0; i < 400 && !moved; i++) {
      sim.update(0.05, 0);
      moved = g.state !== 'float';
    }
    expect(moved).toBe(true);
  });

  it('draws only on its own fork, and is deterministic', () => {
    const a = coastSim(5, { auto: false });
    const b = coastSim(5, { auto: false });
    a.spawn('gull');
    b.spawn('gull');
    for (let i = 0; i < 3000; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
    const run = () => {
      const sim = coastSim(9);
      for (let i = 0; i < 12000; i++) sim.update(0.05, 0);
      return gulls(sim).map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.state}`);
    };
    const first = run();
    expect(first.length).toBeGreaterThan(0);
    expect(run()).toEqual(first);
  });

  it('in reduced motion: slower flights, and still about', () => {
    const measure = (reduced: boolean) => {
      const sim = coastSim(3, { reduced, auto: false });
      sim.spawn('gull');
      let flown = 0;
      let n = 0;
      for (let i = 0; i < 2000; i++) {
        const g = gulls(sim)[0];
        if (!g) break;
        const x = g.x;
        const y = g.y;
        sim.update(0.05, 0);
        if (g.state === 'arrive') {
          flown += Math.hypot(g.x - x, g.y - y) / Math.max(0.35, g.scale);
          n++;
        }
      }
      return flown / Math.max(1, n) / 0.05;
    };
    const calm = measure(true);
    expect(calm).toBeGreaterThan(0);
    expect(calm).toBeLessThan(measure(false) * 0.75);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(gull.show!.spec, 1, 'gull', 'coast');
    const states = new Set<string>();
    for (let i = 0; i < 3600 * 3; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const c of gulls(stage.sim)) states.add(c.state);
    }
    for (const s of ['arrive', 'stand', 'fly']) expect(states, s).toContain(s);
  });
});

describe('cost', () => {
  const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
  const parts = Object.fromEntries(['body', 'floatBody', 'head', 'neck', 'headOpen', 'leg', 'flyBody', 'arm', 'hand', 'shadow'].map((k) => [k, sprite()])) as unknown as GullParts;
  const counting = () => {
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    return { ctx: ctx as never, count: () => n };
  };

  it('composes a frame from a handful of painted parts in every pose', () => {
    for (const q of [REST_POSE, { ...REST_POSE, stretch: 1 }, { ...REST_POSE, back: true }, { ...REST_POSE, shape: 'float' as const }, { ...REST_POSE, shape: 'fly' as const, legsDown: 1, ...wingsAt(0.3, 0) }]) {
      const a = counting();
      drawGull(a.ctx, parts, q);
      expect(a.count()).toBeLessThanOrEqual(10);
    }
  });

  it('updates cheaply', () => {
    const sim = coastSim(2);
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
