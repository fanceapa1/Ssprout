import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { OASIS } from '../../scenery/oasis';
import { OASIS_FAUNA } from '../../scenery/oasis/fauna';
import { intoBasin } from '../../scenery/oasis/wildlife';
import { WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { JAPANESE_FAUNA } from '../../scenery/japanese-garden/fauna';
import { pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { Stage } from '../stage';
import bunting, { bobCurve, Bunting, buntingPerches, choosePerch, isHeld, sipPitch, SIP_DOWN, SIP_UP, standY } from './bunting';

const plants: PlantInstance[] = [];
const ONLY = OASIS_FAUNA.filter((r) => r.kind === 'bunting');
const KINDS = new Set(['wall', 'rim', 'rock']);

function oasisSim(seed = 4, { hour = 12, reduced = false, rows = ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: OASIS.geometry, seed, habitat: OASIS.fauna, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const birds = (sim: FaunaSim) => sim.creatures.filter((c): c is Bunting => c instanceof Bunting);
const inWater = (sim: FaunaSim, q: { x: number; y: number }) => intoBasin(q) > 0 || sim.world.water.moving.some((m) => pointInPolygon(q, m));

describe('where the bunting goes', () => {
  const w = oasisSim().world;

  it('perches on the wall copings, the basin rim and the stones only', () => {
    const ps = buntingPerches(w);
    expect(ps.length).toBeGreaterThan(20);
    for (const p of ps) expect(KINDS.has(p.kind), p.id).toBe(true);
    for (const k of KINDS) expect(ps.some((p) => p.kind === k), k).toBe(true);
    // its standing line is never in the water
    for (const p of ps) for (const u of [-1, 0, 1]) expect(inWater(oasisSim(), { x: p.x + u * p.spread, y: standY(p, p.x + u * p.spread) }), p.id).toBe(false);
  });

  it('keeps off perches others hold, and finds none when all are held', () => {
    const rng = createRng(3);
    const rim = w.perches.find((p) => p.id === 'rim-near-2')!;
    const held = [{ x: rim.x + 20, y: rim.y }];
    expect(isHeld(rim, held)).toBe(true);
    for (let i = 0; i < 200; i++) expect(choosePerch(w, rng, { x: rim.x, y: rim.y }, null, held)?.id).not.toBe('rim-near-2');
    const all = buntingPerches(w).map((p) => ({ x: p.x, y: p.y }));
    expect(choosePerch(w, rng, null, null, all)).toBeNull();
  });

  it('prefers perches in view (a phone sees only the basin)', () => {
    const narrow = { ...w, view: { x: 430, y: 300, w: 600, h: 700 } };
    const rng = createRng(4);
    for (let i = 0; i < 100; i++) {
      const p = choosePerch(narrow, rng, { x: 700, y: 630 }, null, [])!;
      expect(p.x).toBeGreaterThan(430);
      expect(p.x).toBeLessThan(1030);
    }
  });

  it('pecks with a quick dip, and drinks with a lean and a lift of the bill', () => {
    expect(bobCurve(0)).toBe(0);
    expect(bobCurve(0.3)).toBeCloseTo(1, 5);
    expect(bobCurve(1)).toBe(0);
    expect(sipPitch(0.4)).toBe(SIP_DOWN);
    expect(Math.min(...Array.from({ length: 101 }, (_, i) => sipPitch(i / 100)))).toBeCloseTo(SIP_UP, 2);
    expect(sipPitch(1)).toBe(0);
  });

  it('never comes to the Japanese garden or the waterfall (no walls, no rim)', () => {
    const garden = new FaunaSim({ scene: gardenScene, seed: 3 });
    garden.setGarden(plants, JAPANESE_FAUNA, () => undefined);
    expect(bunting.needs!(garden.world)).toBe(false);
    expect(garden.spawn('bunting')).toHaveLength(0);
    const falls = new FaunaSim({ scene: waterfallScene, seed: 3, habitat: WATERFALL_WILDLIFE });
    falls.setGarden(plants, WATERFALL_FAUNA, () => undefined);
    expect(bunting.needs!(falls.world)).toBe(false);
    expect(JAPANESE_FAUNA.some((r) => r.kind === 'bunting')).toBe(false);
    expect(WATERFALL_FAUNA.some((r) => r.kind === 'bunting')).toBe(false);
    for (let i = 0; i < 400; i++) {
      garden.update(0.5, 0);
      falls.update(0.5, 0);
    }
    expect(garden.creatures.some((c) => c.kind === 'bunting')).toBe(false);
    expect(falls.creatures.some((c) => c.kind === 'bunting')).toBe(false);
  });
});

describe('the pair at the oasis', () => {
  it('is a resident pair by day: hops, pecks, drinks at the rim and dips from perch to perch, never in the water', () => {
    const sim = oasisSim(7);
    const problems: string[] = [];
    const acts = new Set<string>();
    let t = 0;
    for (; t < 900; t += 0.05) {
      sim.update(0.05, 0);
      const bs = birds(sim);
      if (t > 1 && bs.filter((b) => !b.leaving).length !== 2) problems.push(`${bs.length} birds at ${t.toFixed(1)}`);
      for (const b of bs) {
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) problems.push(`#${b.id} NaN`);
        const d = b.doing();
        if (d) acts.add(d);
        if (b.state === 'perch') {
          const p = b.perch!;
          if (!KINDS.has(p.kind)) problems.push(`#${b.id} on a ${p.kind}`);
          if (Math.abs(b.x - p.x) > p.spread + 0.01) problems.push(`#${b.id} off ${p.id} at ${b.x.toFixed(1)}`);
          if (b.y > standY(p, b.x) + 0.01) problems.push(`#${b.id} below ${p.id}`);
          if (inWater(sim, b)) problems.push(`#${b.id} in the water at ${b.x | 0},${b.y | 0}`);
        }
      }
      // never two on one perch
      const on = bs.filter((b) => b.state === 'perch').map((b) => b.perch!.id);
      if (new Set(on).size !== on.length) problems.push(`shared perch at ${t.toFixed(1)}`);
    }
    expect(problems).toEqual([]);
    const bs = birds(sim);
    expect(new Set(bs.map((b) => b.sex))).toEqual(new Set(['male', 'female']));
    for (const a of ['hop', 'peck', 'drink', 'look']) expect(acts, a).toContain(a);
    expect(bs.reduce((n, b) => n + b.flights, 0)).toBeGreaterThan(30);
    expect(bs.reduce((n, b) => n + b.sips, 0)).toBeGreaterThan(0);
    expect(bs.reduce((n, b) => n + b.pecks, 0)).toBeGreaterThan(50);
  }, 60_000);

  it('keeps off a perch another creature holds', () => {
    const sim = oasisSim(6, { rows: [] });
    // stand-ins hold every perch but two stones and the near rim's middle
    const free = new Set(['rim-near-2', 'stone-470-680', 'stone-1230-740']);
    const held = buntingPerches(sim.world).filter((p) => !free.has(p.id));
    held.forEach((p, i) => {
      const spot = { x: p.x, y: p.y };
      sim.creatures.push({ id: 9000 + i, kind: 'bird', x: p.x, y: p.y, layer: 'entities', state: 'perch', done: false, visitor: false, forced: true, update() {}, draw() {}, depth: () => null, leave() {}, spot: () => spot } as never);
    });
    const pair = sim.spawn('bunting', { count: 2 }) as Bunting[];
    expect(pair).toHaveLength(2);
    for (let i = 0; i < 6000; i++) {
      sim.update(0.05, 0);
      for (const b of pair) {
        if (b.state === 'perch') expect(free.has(b.perch!.id), b.perch!.id).toBe(true);
      }
    }
    expect(pair.reduce((n, b) => n + b.flights, 0)).toBeGreaterThan(5);
  });

  it('is gone at night and back in the morning', () => {
    const sim = oasisSim(11);
    let atNight = 0;
    let morning = 0;
    for (let t = 0; t < 1500; t += 0.25) {
      sim.hourOverride = t < 300 ? 12 : t < 1000 ? 23 : 9;
      sim.update(0.25, 0);
      const n = birds(sim).length;
      if (t > 400 && t < 1000) atNight += n;
      if (t > 1100) morning = Math.max(morning, n);
    }
    expect(atNight).toBe(0);
    expect(morning).toBe(2);
    expect(bunting.role).toBe('resident');
  });

  it('draws only on its own fork: other creatures’ randomness is untouched', () => {
    const a = oasisSim(5, { auto: false });
    const b = oasisSim(5, { auto: false });
    a.spawn('bunting', { count: 2 });
    b.spawn('bunting', { count: 2 });
    for (let i = 0; i < 2000; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = oasisSim(9);
      for (let i = 0; i < 3000; i++) sim.update(0.05, 0);
      return birds(sim).map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.state},${m.sex}`);
    };
    const r = run();
    expect(r).toHaveLength(2);
    expect(run()).toEqual(r);
  });

  it('in reduced motion: slower flights, and it still hops, pecks and dips', () => {
    const measure = (reduced: boolean) => {
      const sim = oasisSim(3, { reduced, auto: false });
      const pair = sim.spawn('bunting', { count: 2 }) as Bunting[];
      let d = 0;
      let n = 0;
      for (let i = 0; i < 12000; i++) {
        const before = pair.map((b) => ({ x: b.x, y: b.y, s: b.state }));
        sim.update(0.05, 0);
        pair.forEach((b, k) => {
          if (b.state === 'fly' && before[k]!.s === 'fly') {
            d += Math.hypot(b.x - before[k]!.x, b.y - before[k]!.y);
            n++;
          }
        });
      }
      return { speed: d / n / 0.05, flights: pair.reduce((s, b) => s + b.flights, 0), pecks: pair.reduce((s, b) => s + b.pecks, 0) };
    };
    const calm = measure(true);
    const lively = measure(false);
    expect(calm.speed).toBeLessThan(lively.speed * 0.75);
    expect(calm.flights).toBeGreaterThan(3);
    expect(calm.pecks).toBeGreaterThan(10);
  });

  it('lives on the studio’s oasis stages, in view', () => {
    for (const spec of [bunting.show!.spec, { x: 300, y: 500, w: 320, h: 180 }]) {
      const stage = new Stage(spec, 1, 'bunting', 'oasis');
      const v = stage.view;
      let inView = 0;
      let n = 0;
      for (let i = 0; i < 1800; i++) {
        stage.tickRespawn(i / 30);
        stage.sim.update(1 / 30, 0);
        for (const b of birds(stage.sim)) {
          n++;
          if (b.x > v.x && b.x < v.x + v.w && b.y > v.y && b.y < v.y + v.h) inView++;
        }
      }
      expect(inView / n).toBeGreaterThan(0.95);
    }
  });

  it('costs little to run', () => {
    const sim = oasisSim(2, { rows: [], auto: false });
    const pair = sim.spawn('bunting', { count: 2 }) as Bunting[];
    const w = sim.world;
    const t0 = performance.now();
    for (let i = 0; i < 3600; i++) {
      w.t += 1 / 60;
      for (const b of pair) b.update(1 / 60, w);
    }
    const per = (performance.now() - t0) / 3600;
    // the pair's own update per frame (the draw is a handful of drawImage calls; the bench covers it)
    expect(per).toBeLessThan(0.05);
  });
});
