import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { dist } from '../math';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import cat, { Cat, CAT_COATS, CAT_TUNING, catMap, chooseRest, clearAt, drawCat, REST_POSE, routes, terraceOf, type CatParts } from './cat';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'cat');

function coastSim(seed = 4, { hour = 12, reduced = false, rows = ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const cats = (sim: FaunaSim) => sim.creatures.filter((c): c is Cat => c instanceof Cat);

// every garden's creatures (ADR 0346)
await loadAllCreatures();

describe('where the cat goes', () => {
  const w = coastSim().world;
  const map = catMap(w);

  it('knows the copings, the terrace walks and the path, by name, each clear of the slots', () => {
    const kinds = new Set(map.nodes.map((n) => n.id.replace(/-\d+$/, '').replace(/-(west|mid|east)$/, '')));
    expect([...kinds].sort()).toEqual(['path-foreground', 'path-lower', 'path-middle', 'walk-lower', 'walk-middle', 'walk-top', 'wall-lower', 'wall-middle', 'wall-top']);
    for (const n of map.nodes) {
      expect(terraceOf(n.id)).toBe(n.terrace);
      for (const s of w.scene.slots) expect(Math.hypot(s.x - n.x, s.y - n.y), `${n.id} by ${s.id}`).toBeGreaterThanOrEqual(CAT_TUNING.clear);
    }
    // the olive's shade: the top walk either side of the trunk
    expect(map.nodes.filter((n) => n.shade).every((n) => n.id.startsWith('walk-top-'))).toBe(true);
    expect(map.nodes.some((n) => n.shade)).toBe(true);
  });

  it('strolls along a terrace and jumps one tier between a coping and the terrace below', () => {
    let jumps = 0;
    map.edges.forEach((es, i) => {
      const a = map.nodes[i]!;
      for (const e of es) {
        const b = map.nodes[e.to]!;
        if (e.kind === 'walk') {
          // along its terrace, or the path's steps
          if (a.terrace !== b.terrace) expect([a.id, b.id].every((id) => id.startsWith('path-'))).toBe(true);
        } else {
          jumps++;
          expect(Math.abs(a.terrace - b.terrace)).toBe(1);
          const hi = a.terrace < b.terrace ? a : b;
          expect(hi.kind).toBe('coping');
        }
        // the way between is clear of the slots, the jars and the olive's trunk
        if (e.kind === 'walk') for (let k = 0; k <= 10; k++) expect(clearAt(w, { x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 })).toBe(true);
      }
    });
    expect(jumps).toBeGreaterThan(4);
    // from a top coping it can reach every terrace
    const top = map.nodes.findIndex((n) => n.id.startsWith('wall-top-'));
    const { cost } = routes(map, top);
    const reached = new Set(map.nodes.filter((_, i) => cost[i]! < Infinity).map((n) => n.terrace));
    expect([...reached].sort()).toEqual([0, 1, 2, 3]);
  });

  it('settles where no other creature is, in view first', () => {
    const rng = createRng(3);
    const held = map.nodes.filter((n) => n.kind === 'coping').map((n) => ({ x: n.x, y: n.y }));
    for (let i = 0; i < 200; i++) {
      const to = chooseRest(map, rng, w.view, null, held)!;
      expect(map.nodes[to]!.kind).toBe('ground');
    }
    const narrow = { x: 1100, y: 400, w: 400, h: 400 };
    for (let i = 0; i < 100; i++) {
      const n = map.nodes[chooseRest(map, rng, narrow, null, [])!]!;
      expect(n.x).toBeGreaterThan(1100);
      expect(n.x).toBeLessThan(1500);
    }
  });

  it('lives only at the coast', () => {
    const garden = new FaunaSim({ scene: gardenScene, seed: 3 });
    expect(cat.needs!(garden.world)).toBe(false);
    expect(garden.spawn('cat')).toHaveLength(0);
    const falls = new FaunaSim({ scene: waterfallScene, seed: 3, habitat: WATERFALL_WILDLIFE });
    expect(cat.needs!(falls.world)).toBe(false);
    const oasis = new FaunaSim({ scene: OASIS.geometry, seed: 3, habitat: OASIS.fauna });
    expect(cat.needs!(oasis.world)).toBe(false);
    expect(cat.needs!(coastSim().world)).toBe(true);
  });
});

describe('a day', () => {
  it('one cat from the first visit, asleep on its place; it wakes, stretches, washes, strolls, jumps a tier and settles again', () => {
    const problems: string[] = [];
    const modes = new Set<string>();
    const totals = { dozes: 0, stretches: 0, washes: 0, jumps: 0, strolls: 0 };
    for (const seed of [1, 2, 3, 4]) {
      const sim = coastSim(seed);
      sim.update(0.05, 0);
      const [c] = cats(sim);
      expect(c, `seed ${seed}`).toBeDefined();
      expect(c!.doing()).toBe('doze');
      const map = catMap(sim.world);
      for (let t = 0; t < 1500; t += 0.1) {
        sim.update(0.1, 0);
        const all = cats(sim);
        if (all.length !== 1) problems.push(`${all.length} cats at ${t.toFixed(1)}`);
        const k = all[0];
        if (!k) continue;
        modes.add(k.doing());
        if (!Number.isFinite(k.x) || !Number.isFinite(k.y)) problems.push(`NaN at ${t.toFixed(1)}`);
        if (['doze', 'sit', 'wash', 'stretch'].includes(k.doing()) && !clearAt(sim.world, k, CAT_TUNING.clear - 4)) problems.push(`${k.doing()} by a slot at ${t.toFixed(1)} (${k.x.toFixed(0)}, ${k.y.toFixed(0)})`);
        if (k.doing() === 'doze' && dist(k, map.nodes[k.node]!) > 25) problems.push(`dozing off its place at ${t.toFixed(1)}`);
      }
      const k = cats(sim)[0]!;
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += k[key];
    }
    expect(problems.slice(0, 10)).toEqual([]);
    for (const m of ['doze', 'wake', 'stretch', 'sit', 'wash', 'walk', 'crouch', 'leap', 'land']) expect(modes, m).toContain(m);
    expect(totals.dozes).toBeGreaterThan(6);
    expect(totals.jumps).toBeGreaterThan(0);
    expect(totals.strolls).toBeGreaterThan(2);
    expect(totals.washes).toBeGreaterThan(0);
  });

  it('at nightfall sits up facing the sea, then strolls away; it is back in the morning, walking in', () => {
    const sim = coastSim(5);
    for (let t = 0; t < 120; t += 0.1) sim.update(0.1, 0);
    sim.hourOverride = 21;
    let dusk = false;
    let facingSea = false;
    let goneAt = -1;
    for (let t = 0; t < 400; t += 0.1) {
      sim.update(0.1, 0);
      const [k] = cats(sim);
      if (k?.doing() === 'dusk') {
        dusk = true;
        // the sea lies seaward of the terraces: west
        facingSea ||= (k as unknown as { facing: number }).facing < 0;
      }
      if (!k && goneAt < 0) goneAt = t;
    }
    expect(dusk).toBe(true);
    expect(facingSea).toBe(true);
    expect(goneAt).toBeGreaterThan(CAT_TUNING.dusk[0]);
    expect(cats(sim)).toHaveLength(0);
    sim.hourOverride = 9;
    sim.update(0.1, 0);
    const [back] = cats(sim);
    expect(back?.doing()).toBe('walk');
    for (let t = 0; t < 200; t += 0.1) sim.update(0.1, 0);
    expect(cats(sim)).toHaveLength(1);
  });

  it('a morning before it has gone: it stays, and there is still one cat', () => {
    const sim = coastSim(6);
    for (let t = 0; t < 30; t += 0.1) sim.update(0.1, 0);
    sim.hourOverride = 21;
    for (let t = 0; t < 10; t += 0.1) sim.update(0.1, 0);
    expect(cats(sim)[0]!.leaving).toBe(true);
    sim.hourOverride = 10;
    for (let t = 0; t < 60; t += 0.1) sim.update(0.1, 0);
    expect(cats(sim)).toHaveLength(1);
    expect(cats(sim)[0]!.leaving).toBe(false);
  });

  it('takes one coat per garden from its seed, three in all', () => {
    const coats = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const sim = coastSim(seed);
      sim.update(0.05, 0);
      const again = coastSim(seed);
      again.update(0.05, 0);
      expect(cats(sim)[0]!.coat).toBe(cats(again)[0]!.coat);
      coats.add(cats(sim)[0]!.coat);
    }
    expect([...coats].sort()).toEqual([...CAT_COATS].sort());
  });

  it('gives its spot, so birds keep off its coping', () => {
    const sim = coastSim(7);
    sim.update(0.05, 0);
    const [k] = cats(sim);
    expect(dist(k!.spot()!, k!)).toBeLessThan(1e-6);
  });

  it('draws only on its own fork, and is deterministic', () => {
    const a = coastSim(5, { auto: false });
    const b = coastSim(5, { auto: false });
    a.spawn('cat');
    b.spawn('cat');
    for (let i = 0; i < 3000; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
    const run = () => {
      const sim = coastSim(9);
      for (let i = 0; i < 6000; i++) sim.update(0.05, 0);
      return cats(sim).map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.state},${m.coat}`);
    };
    const first = run();
    expect(first.length).toBe(1);
    expect(run()).toEqual(first);
  });

  it('in reduced motion: slower, and still waking and strolling', () => {
    const measure = (reduced: boolean) => {
      const sim = coastSim(3, { reduced });
      let walked = 0;
      let n = 0;
      let strolls = 0;
      for (let i = 0; i < 30000; i++) {
        const k = cats(sim)[0];
        const x = k?.x ?? 0;
        const y = k?.y ?? 0;
        const m = k?.doing();
        sim.update(0.05, 0);
        const k2 = cats(sim)[0];
        if (k && k2 === k && m === 'walk' && k.doing() === 'walk') {
          walked += Math.hypot(k.x - x, k.y - y);
          n++;
        }
        strolls = k2?.strolls ?? strolls;
      }
      return { v: walked / Math.max(1, n) / 0.05, strolls };
    };
    const calm = measure(true);
    const lively = measure(false);
    expect(calm.v).toBeLessThan(lively.v * 0.75);
    expect(calm.strolls).toBeGreaterThan(0);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(cat.show!.spec, 1, 'cat', 'coast');
    const modes = new Set<string>();
    for (let i = 0; i < 3600 * 3; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const c of cats(stage.sim)) modes.add(c.doing());
    }
    for (const s of ['doze', 'wake', 'stretch']) expect(modes, s).toContain(s);
  });
});

describe('cost', () => {
  const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
  const parts = Object.fromEntries(['head', 'headSleep', 'loaf', 'curl', 'sit', 'sitLeg', 'bow', 'torso', 'foreNear', 'foreFar', 'hindNear', 'hindFar', 'tailUp', 'tailWrap', 'tailTip', 'shadow'].map((k) => [k, sprite()])) as unknown as CatParts;
  const counting = () => {
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    return { ctx: ctx as never, count: () => n };
  };

  it('composes a frame from a handful of painted parts in every pose', () => {
    for (const shape of ['loaf', 'curl', 'sit', 'wash', 'bow', 'walk', 'reach', 'crouch', 'leap'] as const) {
      const a = counting();
      drawCat(a.ctx, parts, { ...REST_POSE, shape, paw: 0.5 });
      expect(a.count(), shape).toBeLessThanOrEqual(9);
    }
  });

  it('updates cheaply', () => {
    const sim = coastSim(2);
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
