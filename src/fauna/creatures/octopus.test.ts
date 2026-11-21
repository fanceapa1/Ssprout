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
import { sightedFauna } from '../system';
import type { Creature } from '../types';
import octopus, {
  ARMS, armPoints, armQuirks, armRoot, armShape, chooseSpot, fitsAt, Octopus, OCTOPUS_TUNING, poolRadius, poolsOf, POSE_SIT, SKIN_IDS, skinOf, SQUASH,
  type OctopusParts, type SkinId,
} from './octopus';
import { createRng } from '../../core/rng';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'octopus');

function coastSim(seed = 4, { hour = 12, auto = false, reduced = false } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, auto, reducedMotion: reduced });
  sim.setGarden(plants, ONLY, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const octopuses = (sim: FaunaSim) => sim.creatures.filter((c): c is Octopus => c instanceof Octopus);
const stub = (kind: string, x: number, y: number): Creature => ({ id: 999, kind, x, y, layer: 'air', state: 'fly', done: false, visitor: true, forced: true, update: () => {}, draw: () => {}, depth: () => null, leave: () => {} });
const lead = (o: Octopus): SkinId => SKIN_IDS.reduce((a, b) => (o.skin[b] > o.skin[a] ? b : a));

/** The back of the mantle in world units (the body's far end from the head). */
const mantleBack = (o: Octopus) => ({ x: o.x - Math.cos(o.heading) * 11 * o.size, y: o.y - Math.sin(o.heading) * 11 * o.size * SQUASH });

/** Run one hand-spawned visit to its end, calling `each` every step. */
function visit(seed: number, each?: (o: Octopus, sim: FaunaSim) => void, o: { reduced?: boolean } = {}) {
  const sim = coastSim(seed, { reduced: o.reduced });
  const oc = sim.spawn('octopus')[0] as Octopus;
  let t = 0;
  while (!oc.done && t < 600) {
    sim.update(0.05, 0);
    t += 0.05;
    each?.(oc, sim);
  }
  return { oc, t, sim };
}

await loadAllCreatures();

describe('where the octopus lives', () => {
  it('knows the coast’s three rock pools, as their ellipses', () => {
    const w = coastSim().world;
    const pools = poolsOf(w);
    expect(pools.map((p) => p.id)).toEqual(['pool-1', 'pool-2', 'pool-3']);
    for (const p of pools) {
      const r = w.regions.find((g) => g.id === p.id)!;
      expect(inRegion(r, { x: p.cx, y: p.cy })).toBe(true);
      expect(p.ix).toBeLessThan(p.rx);
      expect(p.iy).toBeLessThan(p.ry);
    }
  });

  it('lives only at the coast', () => {
    const sim = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS.fauna, auto: false });
    expect(octopus.needs!(sim.world)).toBe(false);
    expect(sim.spawn('octopus')).toHaveLength(0);
  });

  it('sits where its curled arms are inside the water, clear of a crab', () => {
    const w = coastSim().world;
    const rng = createRng(3);
    const quirks = armQuirks(rng);
    for (const p of poolsOf(w)) {
      const sc = w.perspective(p.cy, p.cx);
      // a crab on the back rim, toward one end (the small pool has room for both only there)
      const crab = { x: p.cx + p.ix * 0.75, y: p.cy - p.iy * 0.66 };
      for (let i = 0; i < 40; i++) {
        const q = chooseSpot(p, rng, sc, [crab], null);
        expect(fitsAt(p, q, sc)).toBe(true);
        expect(Math.hypot(q.x - crab.x, q.y - crab.y)).toBeGreaterThanOrEqual(OCTOPUS_TUNING.crabGap);
        // every point of every arm, sitting, at any heading, inside the visible water
        const h = rng.range(0, Math.PI * 2);
        for (let a = 0; a < ARMS.length; a++) {
          for (const pt of armPoints(armRoot(a), armShape(a, POSE_SIT, quirks[a]!, i, a === 1), 0, i)) {
            const x = q.x + (pt.x * Math.cos(h) - pt.y * Math.sin(h)) * sc;
            const y = q.y + (pt.x * Math.sin(h) + pt.y * Math.cos(h)) * sc * SQUASH;
            expect(poolRadius(p, { x, y })).toBeLessThanOrEqual(1.05);
          }
        }
      }
    }
  });
});

describe('a visit', () => {
  it('comes out of its den, sits, crawls, feels into the rim, and goes back in', () => {
    const seen = new Set<string>();
    let moves = 0;
    let reaches = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { oc, t } = visit(seed, (o) => seen.add(o.doing()));
      expect(oc.done).toBe(true);
      expect(t).toBeLessThan(260);
      moves += oc.did.moves;
      reaches += oc.did.reaches;
    }
    for (const m of ['emerge', 'sit', 'move', 'reach', 'den']) expect(seen, m).toContain(m);
    expect(moves).toBeGreaterThan(6);
    expect(reaches).toBeGreaterThan(2);
  });

  it('stays in its pool’s water: its body inside the rim, unseen beyond it', () => {
    for (let seed = 1; seed <= 8; seed++) {
      visit(seed, (o, sim) => {
        expect(o.layer).toBe('underwater');
        const region = sim.world.regions.find((r) => r.id === o.pool.id)!;
        if (o.alpha > 0.05) expect(inRegion(region, o)).toBe(true);
        if (o.doing() === 'sit' || o.doing() === 'move' || o.doing() === 'reach' || o.doing() === 'alarm') {
          expect(poolRadius(o.pool, o)).toBeLessThanOrEqual(1);
          expect(poolRadius(o.pool, mantleBack(o))).toBeLessThanOrEqual(1.02);
        }
        // beyond the rim's edge (in or out of its den) it has faded
        if (poolRadius(o.pool, o) > 1.15) expect(o.alpha).toBeLessThan(0.05);
      });
    }
  });

  it('its colour follows what it does: stone sitting, sand or a flush crawling, pale when frightened', () => {
    let flushes = 0;
    for (let seed = 1; seed <= 6; seed++) {
      visit(seed, (o) => {
        if (o.doing() === 'sit' && o.timer > 3) expect(lead(o)).toBe('stone');
        if (o.doing() === 'move' && o.timer > 2) expect(['sand', 'flush']).toContain(lead(o));
        if (lead(o) === 'flush') flushes++;
      });
    }
    expect(flushes).toBeGreaterThan(0);
    // the blend is smooth: no step changes a weight by more than a tenth
    visit(3, (o) => {
      const before = { ...o.skin };
      o.update(0.05, coastSim().world);
      for (const id of SKIN_IDS) expect(Math.abs(o.skin[id] - before[id])).toBeLessThan(0.1);
    });
  });

  it('pales and flattens when something big comes near, then pours into its den and is gone', () => {
    const sim = coastSim(5);
    const o = sim.spawn('octopus')[0] as Octopus;
    for (let s = 0; s < 40; s += 0.05) sim.update(0.05, 0);
    expect(o.doing()).not.toBe('emerge');
    // a butterfly is nothing to it
    sim.creatures.push(stub('butterfly', o.x + 5, o.y - 5));
    for (let s = 0; s < 2; s += 0.05) sim.update(0.05, 0);
    expect(o.did.frights).toBe(0);
    sim.creatures.push(stub('heron', o.x + 60, o.y - 120));
    for (let s = 0; s < 0.8; s += 0.05) sim.update(0.05, 0);
    expect(o.doing()).toBe('alarm');
    expect(lead(o)).toBe('pale');
    expect(o.pose.flat).toBeGreaterThan(0.9);
    for (let s = 0; s < 20 && !o.done; s += 0.05) sim.update(0.05, 0);
    expect(o.did.fled).toBe(true);
    expect(o.done).toBe(true);
  });

  it('settles again when the shadow passes on at once', () => {
    const sim = coastSim(6);
    const o = sim.spawn('octopus')[0] as Octopus;
    for (let s = 0; s < 40; s += 0.05) sim.update(0.05, 0);
    const gull = stub('gull', o.x, o.y - 30);
    sim.creatures.push(gull);
    sim.update(0.05, 0);
    expect(o.doing()).toBe('alarm');
    gull.done = true;
    for (let s = 0; s < 3; s += 0.05) sim.update(0.05, 0);
    expect(o.doing()).not.toBe('den');
    expect(o.done).toBe(false);
  });

  it('takes a pool without a water plant in it when there is one', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sim = coastSim(seed);
      const pools = poolsOf(sim.world);
      sim.world.pads = pools.slice(0, 2).map((p, i) => ({ plantId: `p${i}`, x: p.cx, y: p.cy, r: 20, scale: 1 }));
      const o = sim.spawn('octopus')[0] as Octopus;
      expect(o.pool.id).toBe('pool-3');
    }
    // even when only a planted pool is in view
    const sim = coastSim(3);
    const pools = poolsOf(sim.world);
    sim.world.pads = [{ plantId: 'p', x: pools[2]!.cx, y: pools[2]!.cy, r: 20, scale: 1 }];
    sim.world.view = { x: 500, y: 800, w: 120, h: 140 };
    expect((sim.spawn('octopus')[0] as Octopus).pool.id).not.toBe('pool-3');
  });

  it('one at a time: a second hand spawn is refused', () => {
    const sim = coastSim(2);
    expect(sim.spawn('octopus')).toHaveLength(1);
    expect(sim.spawn('octopus')).toHaveLength(0);
  });

  it('is rare: short visits with long gaps, one at a time, by day only', () => {
    const sim = coastSim(9, { auto: true });
    let visits = 0;
    let was = false;
    let shown = 0;
    // the sim takes at most a tenth of a second a step
    for (let s = 0; s < 6 * 3600; s += 0.1) {
      sim.update(0.1, 0);
      const n = octopuses(sim).length;
      expect(n).toBeLessThanOrEqual(1);
      if (n && !was) visits++;
      if (n) shown += 0.1;
      was = n > 0;
    }
    // gaps of 22–43 minutes: eight to sixteen visits in six hours, each a few minutes at most
    expect(visits).toBeGreaterThanOrEqual(8);
    expect(visits).toBeLessThanOrEqual(16);
    expect(shown / visits).toBeLessThan(220);
    const night = coastSim(9, { auto: true, hour: 22 });
    for (let s = 0; s < 4 * 3600; s += 1) {
      night.update(1, 0);
      expect(octopuses(night)).toHaveLength(0);
    }
  });

  it('at nightfall it goes into its den', () => {
    const sim = coastSim(5);
    sim.spawn('octopus');
    for (let s = 0; s < 20; s += 0.05) sim.update(0.05, 0);
    sim.hourOverride = 22;
    for (let s = 0; s < 30; s += 0.05) sim.update(0.05, 0);
    expect(octopuses(sim)).toHaveLength(0);
  });

  it('is announced once it is in sight', () => {
    const sim = coastSim(6);
    sim.spawn('octopus', { forced: false });
    sim.update(0.3, 0);
    expect([...sightedFauna(sim.creatures, sim.world.view, COAST_FAUNA)]).toEqual(['octopus']);
    expect([...sightedFauna(sim.creatures, { x: 900, y: 300, w: 400, h: 300 }, COAST_FAUNA)]).toEqual([]);
  });

  it('is deterministic and draws only on its own fork', () => {
    const a = visit(7);
    const b = visit(7);
    expect(a.t).toBe(b.t);
    expect(a.oc.did).toEqual(b.oc.did);
    expect(a.sim.rng.next()).toBe(b.sim.rng.next());
  });

  it('in reduced motion: slower', () => {
    let slower = 0;
    for (let seed = 1; seed <= 6; seed++) if (visit(seed, undefined, { reduced: true }).t > visit(seed).t) slower++;
    expect(slower).toBeGreaterThanOrEqual(5);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(octopus.show!.spec, 1, 'octopus', 'coast');
    let seen = 0;
    for (let i = 0; i < 30 * 60; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      if (octopuses(stage.sim).some((o) => o.alpha > 0.5)) seen++;
    }
    expect(seen).toBeGreaterThan(30 * 30);
  });
});

describe('skin', () => {
  it('blends the four looks by weight', () => {
    const mid = skinOf({ stone: 0.5, sand: 0.5, flush: 0, pale: 0 });
    const stone = skinOf({ stone: 1, sand: 0, flush: 0, pale: 0 });
    const sand = skinOf({ stone: 0, sand: 1, flush: 0, pale: 0 });
    expect(mid.alpha).toBeCloseTo((stone.alpha + sand.alpha) / 2, 5);
    expect(mid.mottle).toBeCloseTo((stone.mottle + sand.mottle) / 2, 5);
    expect(stone.mottle).toBeGreaterThan(sand.mottle);
    expect(skinOf({ stone: 0, sand: 0, flush: 0, pale: 1 }).mottle).toBeLessThan(0.1);
  });
});

describe('cost', () => {
  const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
  const parts: OctopusParts = { stamps: [sprite(), sprite()], sucker: sprite(), web: sprite(), head: sprite(), mantle: sprite(), eye: sprite(), sheen: sprite(), pattern: sprite(), shadow: sprite() };
  const counting = () => {
    const n = { drawImage: 0, clip: 0 };
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n.drawImage++ : k === 'clip' ? () => n.clip++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    return { ctx: ctx as never, n };
  };

  it('draws on the water only: one clip, two drawImages; composed ten times a second while it sits', () => {
    const inner = counting();
    const was = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return inner.ctx;
      }
    };
    let most = 0;
    let composed = 0;
    let frames = 0;
    let sitting = 0;
    let sitComposes = 0;
    try {
      visit(4, (o, sim) => {
        const w = sim.world;
        (w.art as unknown as { get: () => OctopusParts }).get = () => parts;
        const before = inner.n.drawImage;
        const c = counting();
        o.draw('underwater', c.ctx, w);
        const n = inner.n.drawImage - before;
        most = Math.max(most, c.n.drawImage);
        composed = Math.max(composed, n);
        if (c.n.drawImage) {
          expect(c.n.clip).toBe(1);
          frames++;
        }
        if (o.doing() === 'sit' && o.timer > 3) {
          sitting++;
          if (n > 0) sitComposes++;
        }
        const none = counting();
        for (const l of ['waterSurface', 'entities', 'air'] as const) o.draw(l, none.ctx, w);
        expect(none.n.drawImage).toBe(0);
      });
    } finally {
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = was;
    }
    expect(frames).toBeGreaterThan(1000);
    // the picture and its shadow onto the garden; in its own canvas, a stamp per arm segment and the body
    expect(most).toBeLessThanOrEqual(2);
    expect(composed).toBeLessThanOrEqual(8 * 11 + 8);
    // steps here are 0.05 s: every other one while it sits
    expect(sitComposes / sitting).toBeLessThan(0.55);
  });

  it('updates cheaply', () => {
    const sim = coastSim(2);
    sim.spawn('octopus');
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(600);
  });
});
