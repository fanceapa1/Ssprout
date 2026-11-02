import { describe, expect, it } from 'vitest';
import type { PlantInstance } from '../../core/state';
import { FOAM, WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { fallsStage } from '../stage';
import type { Creature } from '../types';
import sawagani, { crabHomes, inFoam, Sawagani, SAWAGANI_VARIANTS, threatNear, waterlineDistance } from './sawagani';

const foamK = (p: { x: number; y: number }) => ((p.x - FOAM.x) / FOAM.rx) ** 2 + ((p.y - FOAM.y) / FOAM.ry) ** 2;
const plants: PlantInstance[] = [];

/** The waterfall with every row unlocked, at a pinned hour. */
function waterfallSim(seed = 4, hour = 22, reduced = false, rows = WATERFALL_FAUNA) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: reduced });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const crabs = (sim: FaunaSim) => sim.creatures.filter((c): c is Sawagani => c instanceof Sawagani);
const run = (sim: FaunaSim, seconds: number, each?: (t: number) => void) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    sim.update(1 / 30, 0);
    each?.(t);
  }
};
/** Only the crab's row: no birds to frighten it. */
const crabOnly = WATERFALL_FAUNA.filter((r) => r.kind === 'sawagani');

/** A bird that stands still where it is put. */
function fakeBird(kind: string, x: number, y: number): Creature {
  return { id: 999, kind, x, y, layer: 'entities', state: 'stand', done: false, visitor: true, forced: true, update() {}, draw() {}, depth: () => null, leave() {} };
}

describe('where the sawagani lives', () => {
  const w = waterfallSim().world;
  const homes = crabHomes(w);
  const inWater = (p: { x: number; y: number }) => pointInPolygon(p, w.pond.world) || w.water.moving.some((m) => pointInPolygon(p, m));

  it('under wet stones at the waterline, never by the foam, in view', () => {
    expect(new Set(homes.map((h) => h.rock.id)).size).toBeGreaterThanOrEqual(3);
    for (const h of homes) {
      for (const p of [h.door, ...h.spots.filter((s) => s.on === 'foot')]) {
        expect(inWater(p) || waterlineDistance(p, w) <= 12, `${h.rock.id} ${p.x | 0},${p.y | 0}`).toBe(true);
        expect(foamK(p)).toBeGreaterThan(1.2);
      }
      for (const p of [h.door, h.den, ...h.spots]) {
        expect(p.x > w.view.x + 30 && p.x < w.view.x + w.view.w - 30 && p.y > w.view.y + 30 && p.y < w.view.y + w.view.h - 30).toBe(true);
        expect(inFoam(p, w)).toBe(false);
      }
      // the den is behind the stone's foot, the door just clear of its side
      expect(Math.abs(h.den.x - h.rock.x)).toBeLessThan(h.rock.w / 2);
      expect(Math.abs(h.door.x - h.rock.x)).toBeGreaterThan(h.rock.w / 2);
    }
    // the foot boulder's side toward the falls is in the foam
    expect(homes.some((h) => h.rock.id === 'rock-foot' && h.side === -1)).toBe(false);
  });

  it('knows the foam from the still pool and the stream', () => {
    expect(inFoam({ x: FOAM.x, y: FOAM.y }, w)).toBe(true);
    expect(inFoam(w.pond.centre, w)).toBe(false);
    expect(inFoam({ x: 200, y: 400 }, w)).toBe(false);
  });

  it('is frightened by birds that come near, not by other creatures', () => {
    const at = { x: 500, y: 700 };
    expect(threatNear(at, [fakeBird('heron', 600, 700)])).not.toBeNull();
    expect(threatNear(at, [fakeBird('heron', 800, 700)])).toBeNull();
    expect(threatNear(at, [fakeBird('dipper', 540, 690)])).not.toBeNull();
    expect(threatNear(at, [fakeBird('damselfly', 505, 700)])).toBeNull();
  });
});

describe('the sawagani over a long run', () => {
  /** Problems collected over a run of the whole roster at an hour; and the share of time out. */
  function longRun(hour: number, seed: number) {
    const sim = waterfallSim(seed, hour);
    const problems: string[] = [];
    let out = 0;
    let samples = 0;
    let most = 0;
    run(sim, 15 * 60, (t) => {
      const cs = crabs(sim);
      most = Math.max(most, cs.length);
      for (const c of cs) {
        samples++;
        if (c.out) out++;
        const r = c.home.rock;
        if (foamK(c) < 1.1) problems.push(`in the foam at ${t | 0}s`);
        if (Math.abs(c.x - r.x) > r.w / 2 + 22 || c.y < r.y - r.h * 0.3 || c.y > r.y + 8) problems.push(`off its stone ${r.id} at ${t | 0}s: ${c.x | 0},${c.y | 0}`);
        if (c.layer !== 'entities') problems.push(`layer ${c.layer}`);
        if (!(SAWAGANI_VARIANTS as readonly string[]).includes(c.variant ?? '')) problems.push(`variant ${c.variant}`);
      }
    });
    return { problems: [...new Set(problems)].slice(0, 8), out: out / Math.max(1, samples), most };
  }

  it('stays on its stone and out of the foam, out mostly after dark: two crabs at night, one by day', () => {
    const night = longRun(22, 7);
    const day = longRun(12, 7);
    expect(night.problems).toEqual([]);
    expect(day.problems).toEqual([]);
    expect(night.most).toBe(2);
    expect(day.most).toBe(1);
    expect(night.out).toBeGreaterThan(0.6);
    expect(day.out).toBeLessThan(0.45);
    expect(day.out).toBeGreaterThan(0.08);
  });

  it('is deterministic', () => {
    const a = waterfallSim(11, 22);
    const b = waterfallSim(11, 22);
    run(a, 120);
    run(b, 120);
    const pick = (s: FaunaSim) => crabs(s).map((c) => [Math.round(c.x * 100), Math.round(c.y * 100), c.state, c.variant]);
    expect(pick(a)).toEqual(pick(b));
    expect(pick(a).length).toBeGreaterThan(0);
  });

  it('goes back under its stone when there is one crab too many (daybreak)', () => {
    const sim = waterfallSim(3, 22, false, crabOnly);
    run(sim, 60);
    expect(crabs(sim)).toHaveLength(2);
    sim.hourOverride = 12;
    run(sim, 240);
    expect(crabs(sim)).toHaveLength(1);
  });
});

describe('the sawagani’s fright', () => {
  /** A crab out on its stone, with nothing else around. */
  function outCrab(seed = 5, reduced = false) {
    const sim = waterfallSim(seed, 22, reduced, crabOnly);
    sim.hourOverride = 22;
    sim.spawn('sawagani');
    const c = crabs(sim).find((x) => x.forced)!;
    let t = 0;
    while (!(c.state === 'forage' || c.state === 'sidle') && t < 60) {
      run(sim, 0.5);
      t += 0.5;
    }
    return { sim, c, t };
  }

  it('freezes when a heron comes near, then scuttles back under its stone', () => {
    const { sim, c } = outCrab();
    expect(['forage', 'sidle']).toContain(c.state);
    sim.creatures.push(fakeBird('heron', c.x + 60, c.y - 20));
    const seen: string[] = [];
    run(sim, 6, () => seen.push(c.state));
    expect(seen.slice(0, 15)).toContain('freeze');
    expect(seen).toContain('flee');
    expect(c.state).toBe('hidden');
    // and stays under while the bird is there
    run(sim, 30);
    expect(['hidden', 'emerge', 'freeze', 'flee']).toContain(c.state);
  });

  it('freezes when the camera comes to rest close by (the paint resolution rises)', () => {
    const { sim, c } = outCrab(8);
    sim.setResolution(sim.world.art.res * 3);
    run(sim, 0.2);
    expect(['freeze', 'flee', 'hidden']).toContain(c.state);
    // it comes out again after a while
    let back = false;
    run(sim, 40, () => (back ||= c.state === 'forage'));
    expect(back).toBe(true);
  });

  it('is slower in reduced motion, and alone at night', () => {
    const fast = outCrab(5, false);
    const slow = outCrab(5, true);
    expect(slow.t).toBeGreaterThan(fast.t);
    const sim = waterfallSim(5, 22, true, crabOnly);
    run(sim, 60);
    expect(crabs(sim)).toHaveLength(1);
  });
});

describe('the sawagani in the studio', () => {
  it('finds a stone on the falls stage and comes out', () => {
    const spec = sawagani.show!.spec;
    const stage = fallsStage(spec);
    const sim = new FaunaSim({ scene: stage.scene, seed: 1, auto: false, view: { x: 0, y: 0, w: spec.w, h: spec.h }, habitat: stage.habitat });
    sim.hourOverride = 12;
    expect(crabHomes(sim.world).length).toBeGreaterThan(0);
    sim.spawn('sawagani');
    run(sim, 5);
    expect(crabs(sim)[0]!.out).toBe(true);
  });
});
