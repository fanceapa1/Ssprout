import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { OASIS } from '../../scenery/oasis';
import { OASIS_FAUNA } from '../../scenery/oasis/fauna';
import { JAPANESE_FAUNA } from '../../scenery/japanese-garden/fauna';
import { WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { closestOnPolygon, pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { Stage } from '../stage';
import dropwing, { chooseDropPerch, Dropwing, DROPWING_TUNING, dropWaters, dropwingPerches, flightPose, obeliskCurve, REST_POSE, sallyPoint, sitY, wingAxes } from './dropwing';

const plants: PlantInstance[] = [];
const ONLY = OASIS_FAUNA.filter((r) => r.kind === 'dropwing');
const KINDS = new Set(['post', 'rock', 'rim', 'wall']);

function oasisSim(seed = 4, { hour = 12, reduced = false, rows = ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: OASIS.geometry, seed, habitat: OASIS.fauna, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const flies = (sim: FaunaSim) => sim.creatures.filter((c): c is Dropwing => c instanceof Dropwing);
const toWater = (sim: FaunaSim, q: { x: number; y: number }) => Math.min(...dropWaters(sim.world).map((p) => (pointInPolygon(q, p) ? 0 : closestOnPolygon(q, p).d)));

// every garden's creatures (ADR 0346)
await loadAllCreatures();

describe('where the dropwing goes', () => {
  const sim = oasisSim();
  const w = sim.world;

  it('perches on the gate posts, the stones, the rim and wall copings by the water only', () => {
    const ps = dropwingPerches(w);
    for (const p of ps) expect(KINDS.has(p.kind), p.id).toBe(true);
    for (const k of ['post', 'rock', 'rim']) expect(ps.some((p) => p.kind === k), k).toBe(true);
    expect(ps.filter((p) => p.kind === 'post')).toHaveLength(2);
    for (const p of ps) expect(toWater(sim, p), p.id).toBeLessThan(70);
    // no fronds, no tower, no far wall
    expect(ps.some((p) => p.id === 'wall-high-1' || p.id.startsWith('palm') || p.id === 'tower-nest')).toBe(false);
  });

  it('keeps off perches others hold, and finds none when all are held', () => {
    const rng = createRng(3);
    const ps = dropwingPerches(w);
    const post = ps.find((p) => p.id === 'gate-post-1')!;
    const held = [{ x: post.x, y: post.y }];
    for (let i = 0; i < 200; i++) expect(chooseDropPerch(ps, w.view, rng, post, null, held)?.id).not.toBe('gate-post-1');
    expect(chooseDropPerch(ps, w.view, rng, null, null, ps.map((p) => ({ x: p.x, y: p.y })))).toBeNull();
  });

  it('prefers the tips: posts and stones over the long rim', () => {
    const rng = createRng(5);
    const ps = dropwingPerches(w);
    const n: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const p = chooseDropPerch(ps, w.view, rng, null, null, [])!;
      n[p.kind] = (n[p.kind] ?? 0) + 1;
    }
    const per = (k: string) => n[k]! / ps.filter((p) => p.kind === k).length;
    expect(per('post')).toBeGreaterThan(per('rim') * 2);
    expect(per('rock')).toBeGreaterThan(per('rim') * 1.4);
  });

  it('perches in view on a phone view', () => {
    const rng = createRng(4);
    const view = { x: 430, y: 300, w: 600, h: 700 };
    for (let i = 0; i < 100; i++) {
      const p = chooseDropPerch(dropwingPerches(w), view, rng, { x: 700, y: 630 }, null, [])!;
      expect(p.x).toBeGreaterThan(430);
      expect(p.x).toBeLessThan(1030);
    }
  });

  it('sallies out over the water, in view', () => {
    const rng = createRng(7);
    for (const p of dropwingPerches(w)) {
      for (let i = 0; i < 10; i++) {
        const q = sallyPoint(w, rng, p);
        if (!q) continue;
        expect(toWater(sim, q), p.id).toBe(0);
        expect(Math.hypot(q.x - p.x, (q.y - p.y) * 2)).toBeLessThanOrEqual(DROPWING_TUNING.reach[1] + 1e-6);
      }
    }
  });

  it('holds its wings forward and down at rest, beats them in flight, and lifts its abdomen slowly', () => {
    for (const near of [true, false]) {
      const f = wingAxes(REST_POSE.fore.sweep, REST_POSE.fore.droop, near);
      expect(f.s.x, `fore near=${near}`).toBeGreaterThan(0.5);
      expect(f.s.y, `fore near=${near}`).toBeGreaterThan(0);
    }
    expect(wingAxes(REST_POSE.fore.sweep, REST_POSE.fore.droop, true).s.y).toBeGreaterThan(0.4);
    const ys = Array.from({ length: 24 }, (_, i) => wingAxes(flightPose((i / 24) * Math.PI * 2).fore.sweep, flightPose((i / 24) * Math.PI * 2).fore.droop, true).s.y);
    expect(Math.min(...ys)).toBeLessThan(-0.5);
    expect(Math.max(...ys)).toBeGreaterThan(0.5);
    expect(obeliskCurve(0)).toBe(0);
    expect(obeliskCurve(0.5)).toBe(1);
    expect(obeliskCurve(1)).toBe(0);
    expect(obeliskCurve(0.05)).toBeLessThan(0.5);
  });

  it('never comes to the Japanese garden or the waterfall (no posts, no basin rim)', () => {
    const garden = new FaunaSim({ scene: gardenScene, seed: 3 });
    garden.setGarden(plants, JAPANESE_FAUNA, () => undefined);
    expect(dropwing.needs!(garden.world)).toBe(false);
    expect(garden.spawn('dropwing')).toHaveLength(0);
    const falls = new FaunaSim({ scene: waterfallScene, seed: 3, habitat: WATERFALL_WILDLIFE });
    falls.setGarden(plants, WATERFALL_FAUNA, () => undefined);
    expect(dropwing.needs!(falls.world)).toBe(false);
  });
});

describe('the dropwing at the oasis', () => {
  it('visits by day: perches still on its tips, sallies over the water and mostly comes back to the same perch', () => {
    const sim = oasisSim(7);
    const problems: string[] = [];
    let perched = 0;
    let obelisk = 0;
    let visits = 0;
    const seen = new Set<number>();
    for (let t = 0; t < 700; t += 0.1) {
      sim.update(0.1, 0);
      for (const d of flies(sim)) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          visits++;
        }
        if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) problems.push(`#${d.id} NaN`);
        if (d.state === 'perch') {
          perched++;
          const p = d.perch!;
          if (!KINDS.has(p.kind)) problems.push(`#${d.id} on a ${p.kind}`);
          if (Math.abs(d.x - p.x) > p.spread + 0.01) problems.push(`#${d.id} off ${p.id} at ${d.x.toFixed(1)}`);
          if (Math.abs(d.y - sitY(sim.world, p, d.x)) > 0.5) problems.push(`#${d.id} not on ${p.id}`);
          if (d.layer !== 'entities' || d.depth() !== p.depth) problems.push(`#${d.id} perched on ${d.layer}`);
          if (d.abdomenLift() > 0.5) obelisk++;
        } else if (d.state !== 'wait' && d.layer !== 'air') problems.push(`#${d.id} flying on ${d.layer}`);
      }
      // never two on one perch
      const on = flies(sim).filter((d) => d.state === 'perch').map((d) => d.perch!.id);
      if (new Set(on).size !== on.length) problems.push(`shared perch at ${t.toFixed(1)}`);
    }
    expect(problems).toEqual([]);
    const all = [...seen];
    expect(visits).toBeGreaterThan(1);
    expect(perched).toBeGreaterThan(1000);
    expect(obelisk).toBeGreaterThan(50);
    expect(all.length).toBeGreaterThan(0);
  }, 120_000);

  it('a sally goes out over the water and back, most often to the same perch', () => {
    const sim = oasisSim(3, { rows: [], auto: false });
    const [d] = sim.spawn('dropwing', { count: 1 }) as Dropwing[];
    let overWater = 0;
    let flying = 0;
    for (let i = 0; i < 6000; i++) {
      sim.update(0.05, 0);
      if (d!.done) break;
      if (d!.state === 'fly') {
        flying++;
        if (toWater(sim, { x: d!.x, y: d!.ground() }) < 25) overWater++;
      }
    }
    expect(d!.sallies).toBeGreaterThan(6);
    expect(d!.returns / d!.sallies).toBeGreaterThan(0.45);
    expect(overWater / flying).toBeGreaterThan(0.6);
  });

  it('a second male is chased off', () => {
    let chases = 0;
    for (const seed of [1, 2, 3, 4]) {
      const sim = oasisSim(seed, { rows: [], auto: false });
      const pair = sim.spawn('dropwing', { count: 2 }) as Dropwing[];
      expect(pair).toHaveLength(2);
      expect(pair[1]!.sex).toBe('male');
      for (let i = 0; i < 2400; i++) sim.update(0.05, 0);
      chases += pair.reduce((n, d) => n + d.chases, 0);
    }
    expect(chases).toBeGreaterThan(0);
  });

  it('keeps off a perch another creature holds', () => {
    const sim = oasisSim(6, { rows: [], auto: false });
    const free = new Set(['gate-post-2', 'rim-near-3']);
    const held = dropwingPerches(sim.world).filter((p) => !free.has(p.id));
    held.forEach((p, i) => {
      const spot = { x: p.x, y: p.y };
      sim.creatures.push({ id: 9000 + i, kind: 'bird', x: p.x, y: p.y, layer: 'entities', state: 'perch', done: false, visitor: false, forced: true, update() {}, draw() {}, depth: () => null, leave() {}, spot: () => spot } as never);
    });
    const [d] = sim.spawn('dropwing', { count: 1 }) as Dropwing[];
    for (let i = 0; i < 4000 && !d!.done; i++) {
      sim.update(0.05, 0);
      if (d!.state === 'perch') expect(free.has(d!.perch!.id), d!.perch!.id).toBe(true);
    }
  });

  it('is not out at night, and leaves at nightfall', () => {
    const sim = oasisSim(11);
    let atNight = 0;
    let day = 0;
    for (let t = 0; t < 1500; t += 0.5) {
      sim.hourOverride = t < 600 ? 12 : 23;
      sim.update(0.5, 0);
      const n = flies(sim).length;
      if (t < 600) day += n;
      if (t > 700) atNight += n;
    }
    expect(day).toBeGreaterThan(0);
    expect(atNight).toBe(0);
    expect(dropwing.visit!.diurnal).toBe(true);
  }, 60_000);

  it('draws only on its own fork: other creatures’ randomness is untouched', () => {
    const a = oasisSim(5, { auto: false });
    const b = oasisSim(5, { auto: false });
    a.spawn('dropwing', { count: 2 });
    b.spawn('dropwing', { count: 2 });
    for (let i = 0; i < 2000; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = oasisSim(9);
      for (let i = 0; i < 2000; i++) sim.update(0.1, 0);
      return flies(sim).map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.state},${m.sex}`);
    };
    const r = run();
    expect(run()).toEqual(r);
  }, 60_000);

  it('in reduced motion: slower darts, still sallies', () => {
    const measure = (reduced: boolean) => {
      const sim = oasisSim(3, { reduced, rows: [], auto: false });
      const [d] = sim.spawn('dropwing', { count: 1 }) as Dropwing[];
      let dd = 0;
      let n = 0;
      for (let i = 0; i < 6000 && !d!.done; i++) {
        const before = { x: d!.x, y: d!.y, s: d!.state };
        sim.update(0.05, 0);
        if (d!.state === 'fly' && before.s === 'fly') {
          dd += Math.hypot(d!.x - before.x, d!.y - before.y);
          n++;
        }
      }
      return { speed: dd / n / 0.05, sallies: d!.sallies };
    };
    const calm = measure(true);
    const lively = measure(false);
    expect(calm.speed).toBeLessThan(lively.speed * 0.8);
    expect(calm.sallies).toBeGreaterThan(3);
  });

  it('lives on its studio stages, in view', () => {
    for (const spec of [dropwing.show!.spec, { x: 960, y: 540, w: 240, h: 135 }]) {
      const stage = new Stage(spec, 1, 'dropwing', 'oasis');
      const v = stage.view;
      let inView = 0;
      let n = 0;
      for (let i = 0; i < 1800; i++) {
        stage.tickRespawn(i / 30);
        stage.sim.update(1 / 30, 0);
        for (const d of flies(stage.sim)) {
          if (d.state !== 'perch') continue;
          n++;
          if (d.x > v.x && d.x < v.x + v.w && d.y > v.y && d.y < v.y + v.h) inView++;
        }
      }
      expect(n).toBeGreaterThan(300);
      expect(inView / n).toBeGreaterThan(0.95);
    }
  });

  it('costs little to run', () => {
    const sim = oasisSim(2, { rows: [], auto: false });
    const pair = sim.spawn('dropwing', { count: 2 }) as Dropwing[];
    const w = sim.world;
    const t0 = performance.now();
    for (let i = 0; i < 3600; i++) {
      w.t += 1 / 60;
      for (const d of pair) d.update(1 / 60, w);
    }
    expect((performance.now() - t0) / 3600).toBeLessThan(0.05);
  });
});
