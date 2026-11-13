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
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import type { Creature } from '../types';
import tortoise, {
  besideOf,
  choosePlod,
  clearOf,
  crossesWall,
  drawTortoise,
  drawTurn,
  footAt,
  greeneryAt,
  homeScrubs,
  levelOf,
  levelsOf,
  routes,
  sideOn,
  STAND_POSE,
  Tortoise,
  TORTOISE_K,
  TORTOISE_TUNING,
  tortoiseMap,
  type TortoiseParts,
} from './tortoise';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'tortoise');

function coastSim(seed = 4, { hour = 12, reduced = false, rows = ONLY, auto = false } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const tortoises = (sim: FaunaSim) => sim.creatures.filter((c): c is Tortoise => c instanceof Tortoise);

// every garden's creatures (ADR 0346)
await loadAllCreatures();

describe('where the tortoise goes', () => {
  const w = coastSim().world;
  const map = tortoiseMap(w);

  it('knows the terrace walks, the level path and the scrub at the terraces’ ends, by name, clear of the slots', () => {
    const kinds = new Set(map.nodes.map((n) => n.id.replace(/-\d+$/, '').replace(/-(west|mid|east)$/, '')));
    for (const k of ['walk-top', 'walk-middle', 'walk-lower', 'path-middle', 'path-lower']) expect(kinds).toContain(k);
    expect(map.nodes.some((n) => n.id === 'path-foreground')).toBe(false);
    for (const n of map.nodes) {
      if (n.kind !== 'scrub') expect(levelOf(n.id.replace(/-\d+$/, ''))).toBe(n.level);
      expect(clearOf(w, n), n.id).toBe(true);
      if (n.rest) expect(besideOf(w, n), n.id).toBe(true);
    }
    // a scrub to come out of on every terrace
    expect(levelsOf(map)).toEqual([0, 1, 2]);
    expect(homeScrubs(map).length).toBeGreaterThanOrEqual(4);
  });

  it('keeps to one terrace: every way joins places of one level, side-on, over no wall and past no slot', () => {
    map.edges.forEach((es, i) => {
      const a = map.nodes[i]!;
      for (const e of es) {
        const b = map.nodes[e.to]!;
        expect(b.level, `${a.id} → ${b.id}`).toBe(a.level);
        expect(sideOn(a, b, 0.65, 6), `${a.id} → ${b.id}`).toBe(true);
        expect(crossesWall(w, a, b), `${a.id} → ${b.id}`).toBe(false);
        for (let k = 1; k < 20; k++) expect(clearOf(w, { x: a.x + ((b.x - a.x) * k) / 20, y: a.y + ((b.y - a.y) * k) / 20 })).toBe(true);
      }
    });
    // and the walks themselves are the flattest ways: only the scrub links slope more
    for (let i = 0; i < map.nodes.length; i++) for (const e of map.edges[i]!) if (map.nodes[i]!.kind !== 'scrub' && map.nodes[e.to]!.kind !== 'scrub') expect(sideOn(map.nodes[i]!, map.nodes[e.to]!)).toBe(true);
  });

  it('grazes at the scrub’s edge and beside flowers, facing them', () => {
    const near = map.nodes.map((_, i) => i).filter((i) => greeneryAt(map, [], i) !== 0);
    expect(near.length).toBeGreaterThan(3);
    for (const i of near) {
      const n = map.nodes[i]!;
      const dir = greeneryAt(map, [], i);
      const scrub = map.nodes.find((s) => s.kind === 'scrub' && s.level === n.level && Math.sign(s.x - n.x) === dir && Math.abs(s.x - n.x) < TORTOISE_TUNING.reach);
      expect(scrub, n.id).toBeDefined();
    }
    // a flower in the bed just in front, to one side
    const i = map.nodes.findIndex((n) => n.rest && n.kind === 'walk' && greeneryAt(map, [], map.nodes.indexOf(n)) === 0);
    const n = map.nodes[i]!;
    expect(greeneryAt(map, [{ plantId: 'p', x: n.x + 34, y: n.y + 10, baseY: n.y + 28, r: 14 }], i)).toBe(1);
    expect(greeneryAt(map, [{ plantId: 'p', x: n.x - 34, y: n.y + 10, baseY: n.y + 28, r: 14 }], i)).toBe(-1);
  });

  it('plods a few body lengths, onward likelier, never onto another creature’s spot', () => {
    const rng = createRng(2);
    const from = map.nodes.findIndex((n) => n.id === 'walk-lower-mid-3');
    const { cost } = routes(map, from);
    let ahead = 0;
    for (let k = 0; k < 300; k++) {
      const to = choosePlod(map, rng, w.view, from, 1, [], [map.nodes[from + 1]!])!;
      expect(to).not.toBe(from + 1);
      expect(cost[to]!).toBeGreaterThanOrEqual(TORTOISE_TUNING.plod[0] * TORTOISE_TUNING.bodyLength);
      expect(cost[to]!).toBeLessThanOrEqual(TORTOISE_TUNING.plod[1] * TORTOISE_TUNING.bodyLength);
      expect(map.nodes[to]!.kind).not.toBe('scrub');
      if (map.nodes[to]!.x > map.nodes[from]!.x) ahead++;
    }
    expect(ahead).toBeGreaterThan(150);
  });

  it('lives only at the coast', () => {
    expect(tortoise.needs!(new FaunaSim({ scene: gardenScene, seed: 3 }).world)).toBe(false);
    expect(tortoise.needs!(new FaunaSim({ scene: waterfallScene, seed: 3, habitat: WATERFALL_WILDLIFE }).world)).toBe(false);
    expect(tortoise.needs!(new FaunaSim({ scene: OASIS.geometry, seed: 3, habitat: OASIS.fauna }).world)).toBe(false);
    expect(tortoise.needs!(coastSim().world)).toBe(true);
  });
});

describe('a visit', () => {
  it('comes out of the scrub, basks, plods its terrace, grazes, turns round, dozes in the shade at the heat and goes back in', () => {
    const problems: string[] = [];
    const modes = new Set<string>();
    const totals = { plods: 0, grazes: 0, basks: 0, shades: 0, turns: 0 };
    const levels = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = coastSim(seed);
      const [t] = sim.spawn('tortoise') as Tortoise[];
      expect(t, `seed ${seed}`).toBeDefined();
      levels.add(t!.level);
      const map = tortoiseMap(sim.world);
      let last = { x: t!.x, y: t!.y };
      let gone = false;
      for (let s = 0; s < 1500 && !gone; s += 0.1) {
        sim.update(0.1, 0);
        const k = tortoises(sim)[0];
        if (!k) {
          gone = true;
          break;
        }
        modes.add(k.doing());
        if (map.nodes[k.node]!.level !== t!.level) problems.push(`seed ${seed}: left its terrace at ${s.toFixed(1)}`);
        if (!clearOf(sim.world, k, TORTOISE_TUNING.clear - 0.5)) problems.push(`seed ${seed}: on a slot at ${s.toFixed(1)} (${k.x.toFixed(0)}, ${k.y.toFixed(0)})`);
        if (['pause', 'graze'].includes(k.doing()) && !besideOf(sim.world, k)) problems.push(`seed ${seed}: stopped behind a slot at ${s.toFixed(1)}`);
        const dx = k.x - last.x;
        const dy = k.y - last.y;
        if (Math.hypot(dx, dy) > 0.01 && !sideOn({ x: 0, y: 0 }, { x: dx, y: dy }, 0.75, 0.02)) problems.push(`seed ${seed}: toward the viewer at ${s.toFixed(1)}`);
        if (Math.hypot(dx, dy) > 1) problems.push(`seed ${seed}: a jump of ${Math.hypot(dx, dy).toFixed(1)}`);
        last = { x: k.x, y: k.y };
      }
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += t![key];
      expect(gone, `seed ${seed}: back in the scrub at the end of its visit`).toBe(true);
    }
    expect(problems.slice(0, 10)).toEqual([]);
    for (const m of ['emerge', 'bask', 'plod', 'pause', 'graze', 'turn', 'doze', 'tuck']) expect(modes, m).toContain(m);
    expect(totals.basks).toBe(6);
    expect(totals.plods).toBeGreaterThan(30);
    expect(totals.grazes).toBeGreaterThan(5);
    expect(totals.shades).toBeGreaterThan(3);
    expect(levels.size).toBeGreaterThan(1);
  });

  it('is slow: a plod is about a fifth of a body length a second and it stands far more than it walks', () => {
    const sim = coastSim(3);
    sim.spawn('tortoise');
    let walking = 0;
    let still = 0;
    let moved = 0;
    for (let s = 0; s < 600; s += 0.1) {
      const k = tortoises(sim)[0];
      if (!k) break;
      const x = k.x;
      const y = k.y;
      sim.update(0.1, 0);
      if (k.doing() === 'plod') {
        walking++;
        moved += Math.hypot(k.x - x, k.y - y);
      } else still++;
    }
    const v = moved / (walking * 0.1);
    expect(v).toBeGreaterThan(2.5);
    expect(v).toBeLessThan(7);
    expect(still).toBeGreaterThan(walking * 2);
  });

  it('into its shell when the cat strolls close or a heron lands near, out again after a while', () => {
    const sim = coastSim(8);
    const [t] = sim.spawn('tortoise') as Tortoise[];
    for (let s = 0; s < 40; s += 0.1) sim.update(0.1, 0);
    const stub = (kind: string, state: string, layer: Creature['layer']): Creature => ({ id: 999, kind, x: t!.x + 30, y: t!.y, layer, state, done: false, visitor: false, forced: true, update: () => {}, draw: () => {}, depth: () => null, leave: () => {} });
    // a sleeping cat beside it, a heron flying over: nothing
    const cat = stub('cat', 'doze', 'entities');
    sim.creatures.push(cat);
    for (let s = 0; s < 3; s += 0.1) sim.update(0.1, 0);
    expect(t!.doing()).not.toBe('withdraw');
    cat.state = 'walk';
    for (let s = 0; s < 1; s += 0.1) sim.update(0.1, 0);
    expect(t!.doing()).toBe('withdraw');
    expect(t!.withdrawn()).toBe(true);
    cat.done = true;
    for (let s = 0; s < 30; s += 0.1) sim.update(0.1, 0);
    expect(t!.doing()).not.toBe('withdraw');
    expect(t!.hides).toBe(1);
    sim.creatures.push(stub('heron', 'land', 'entities'));
    for (let s = 0; s < 1; s += 0.1) sim.update(0.1, 0);
    expect(t!.doing()).toBe('withdraw');
  });

  it('out of sight at night: back into the scrub, and no visit after dark', () => {
    const sim = coastSim(5, { auto: true });
    let seen = false;
    for (let s = 0; s < 200; s += 0.1) {
      sim.update(0.1, 0);
      seen ||= tortoises(sim).length > 0;
    }
    expect(seen).toBe(true);
    sim.hourOverride = 22;
    for (let s = 0; s < 900 && tortoises(sim).length; s += 0.1) sim.update(0.1, 0);
    expect(tortoises(sim)).toHaveLength(0);
    for (let s = 0; s < 1500; s += 0.5) {
      sim.update(0.5, 0);
      expect(tortoises(sim)).toHaveLength(0);
    }
  });

  it('now and then a pair, on one terrace', () => {
    let pairs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sim = coastSim(seed);
      const made = sim.spawn('tortoise', { count: 2 }) as Tortoise[];
      expect(made).toHaveLength(2);
      expect(made[0]!.level).toBe(made[1]!.level);
      if (made[0]!.node !== made[1]!.node) pairs++;
    }
    expect(pairs).toBeGreaterThan(10);
  });

  it('gives its spot, draws only on its own fork, and is deterministic', () => {
    const a = coastSim(5);
    const b = coastSim(5);
    a.spawn('tortoise');
    b.spawn('tortoise');
    for (let i = 0; i < 3000; i++) a.update(0.05, 0);
    for (let i = 0; i < 3000; i++) b.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
    const ta = tortoises(a)[0]!;
    const tb = tortoises(b)[0]!;
    expect([ta.x, ta.y, ta.state]).toEqual([tb.x, tb.y, tb.state]);
    expect(ta.spot()).not.toBeNull();
  });

  it('in reduced motion: slower', () => {
    const speed = (reduced: boolean) => {
      const sim = coastSim(3, { reduced });
      sim.spawn('tortoise');
      let walked = 0;
      let n = 0;
      for (let i = 0; i < 20000; i++) {
        const k = tortoises(sim)[0];
        if (!k) break;
        const x = k.x;
        const y = k.y;
        sim.update(0.05, 0);
        if (k.doing() === 'plod') {
          walked += Math.hypot(k.x - x, k.y - y);
          n++;
        }
      }
      return walked / Math.max(1, n);
    };
    expect(speed(true)).toBeLessThan(speed(false) * 0.75);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(tortoise.show!.spec, 1, 'tortoise', 'coast');
    const modes = new Set<string>();
    for (let i = 0; i < 3600 * 3; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const c of tortoises(stage.sim)) modes.add(c.doing());
    }
    for (const s of ['emerge', 'bask', 'plod']) expect(modes, s).toContain(s);
  });
});

describe('the gait', () => {
  it('a foot planted sweeps back exactly as far as the body goes, so nothing slides', () => {
    const S = TORTOISE_TUNING.stride / TORTOISE_K;
    // during the stance the foot moves back by the body's travel: a planted foot stays put on the ground
    const a = footAt(0.1, S);
    const b = footAt(0.3, S);
    expect(a.lift).toBe(0);
    expect(b.lift).toBe(0);
    expect(a.x - b.x).toBeCloseTo(0.2 * S, 6);
    // and lifts only while it swings forward
    expect(footAt(0.86, S).lift).toBeGreaterThan(0.9);
  });
});

describe('cost', () => {
  const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
  const parts = Object.fromEntries(['shellRear', 'shellHead', 'head', 'headSleep', 'neck', 'foreNear', 'foreFar', 'hindNear', 'hindFar', 'tail', 'shadow', 'front'].map((k) => [k, sprite()])) as unknown as TortoiseParts;
  const counting = () => {
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    return { ctx: ctx as never, count: () => n };
  };

  it('composes a frame from a handful of painted parts', () => {
    const a = counting();
    drawTortoise(a.ctx, parts, { ...STAND_POSE, gait: 1 });
    expect(a.count()).toBeLessThanOrEqual(10);
    const b = counting();
    drawTurn(b.ctx, parts, STAND_POSE, 1, 0.3);
    expect(b.count()).toBeLessThanOrEqual(13);
  });

  it('updates cheaply', () => {
    const sim = coastSim(2);
    sim.spawn('tortoise', { count: 2 });
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
