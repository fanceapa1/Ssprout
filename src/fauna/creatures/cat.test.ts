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
import cat, {
  BONES,
  Cat,
  CAT_COATS,
  CAT_K,
  CAT_TUNING,
  catMap,
  changeFor,
  chooseRest,
  clearAt,
  drawCat,
  GAIT,
  inBetween,
  legJoints,
  REST_POSE,
  rigOf,
  RIGS,
  routes,
  stretchPose,
  terraceOf,
  torsoOf,
  travelPerCycle,
  viewFor,
  walkFoot,
  walkRig,
  type CatParts,
  type CatPose,
  type Rig,
} from './cat';
import { blockerOn, GROUND_ROOM, groundBodies, groundFree, hiddenByPlant, plantCovers, stepsRound } from './lib/ground';
import { getSpecies } from '../../plants/registry';
import { Tortoise } from './tortoise';

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
    // and plenty of places far enough from the plants to lie down, on every terrace
    const rest = map.nodes.filter((n) => n.rest);
    expect(rest.length).toBeGreaterThan(15);
    expect(new Set(rest.map((n) => n.terrace)).size).toBeGreaterThanOrEqual(3);
    expect(rest.some((n) => n.shade)).toBe(true);
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

  it('does not doze behind a planted plant: the olive’s shade behind a lavender in `top-2` is skipped (devlog 228)', () => {
    const planted = (slots: [string, string][]): PlantInstance[] =>
      slots.map(([speciesId, slotId], i) => ({ id: `p${i}`, speciesId, sceneryId: 'coast', slotId, seed: i + 1, plantedAt: 0, sessionMinutes: 90, taskName: '', completedAt: 1 }));
    const lookup = (id: string) => getSpecies(id);
    const sim = coastSim(5);
    sim.setGarden(planted([['lavender', 'top-2'], ['lavender', 'low-3'], ['rock-rose', 'path-5']]), ONLY, lookup);
    const covers = plantCovers(sim.world);
    expect(covers.map((c) => c.slot).sort()).toEqual(['low-3', 'path-5', 'top-2']);
    const hidden = (q: { x: number; y: number }) => hiddenByPlant(covers, q);
    // the acceptance's spot: in the olive's shade, behind the lavender
    const behind = map.nodes.filter((n) => n.rest && hidden(n));
    expect(behind.some((n) => n.shade)).toBe(true);
    const rng = createRng(8);
    let chosen = 0;
    for (let i = 0; i < 400; i++) {
      const to = chooseRest(map, rng, w.view, null, [], undefined, hidden)!;
      expect(hidden(map.nodes[to]!), map.nodes[to]!.id).toBe(false);
      if (map.nodes[to]!.shade) chosen++;
    }
    // the shade on the olive's other side is still there
    expect(chosen).toBeGreaterThan(20);
    // and over an hour of the real thing it never lies down out of sight
    for (const seed of [1, 2, 3]) {
      const live = coastSim(seed);
      live.setGarden(planted([['lavender', 'top-2'], ['lavender', 'low-3'], ['rock-rose', 'path-5']]), ONLY, lookup);
      const cs = plantCovers(live.world);
      let dozing = 0;
      for (let i = 0; i < 3600 * 20; i++) {
        live.update(0.05, 0);
        for (const k of cats(live)) {
          if (k.doing() !== 'doze') continue;
          dozing++;
          expect(hiddenByPlant(cs, k), `seed ${seed}: dozing at (${k.x.toFixed(0)}, ${k.y.toFixed(0)})`).toBe(false);
        }
      }
      expect(dozing).toBeGreaterThan(0);
    }
  }, 60_000);

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
        if (['doze', 'sit', 'wash', 'stretch'].includes(k.doing()) && !clearAt(sim.world, k, CAT_TUNING.rest - 2)) problems.push(`${k.doing()} by a slot at ${t.toFixed(1)} (${k.x.toFixed(0)}, ${k.y.toFixed(0)})`);
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

describe('the walk', () => {
  const side = { x: 1, y: 0 };
  const V = travelPerCycle(side);

  it('steps in a lateral sequence with diagonal couplets, and each hind lands in the print its fore has just left', () => {
    const order = [0, 1, 2, 3].sort((a, b) => GAIT.touch[a]! - GAIT.touch[b]!);
    // near hind, near fore, far hind, far fore
    expect(order).toEqual([2, 3, 0, 1]);
    // each fore follows its hind by a little over a quarter cycle (diagonal couplets)
    expect(GAIT.touch[3] - GAIT.touch[2]).toBeGreaterThan(0.25);
    expect(GAIT.touch[3] - GAIT.touch[2]).toBeLessThan(0.35);
    for (const [hind, fore] of [
      [2, 3],
      [0, 1],
    ] as const) {
      const tf = GAIT.touch[fore];
      const th = GAIT.touch[hind] + 1;
      const forePrint = tf * V.x + walkFoot(fore, tf + 1e-6, V).x;
      const hindPrint = th * V.x + walkFoot(hind, th + 1e-6, V).x;
      expect(Math.abs(hindPrint - forePrint)).toBeLessThan(0.05);
      // the fore is up before the hind comes down
      expect(tf + GAIT.duty).toBeLessThan(th);
    }
  });

  it('keeps a paw on the ground where it is put, side-on, slanting and toward or away from the viewer', () => {
    for (const dir of [side, { x: 0.8, y: 0.6 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const Vd = travelPerCycle(dir);
      for (let leg = 0; leg < 4; leg++) {
        const t0 = GAIT.touch[leg]!;
        const at = (ph: number) => ({ x: ph * Vd.x + walkFoot(leg, ph, Vd).x, y: ph * Vd.y + walkFoot(leg, ph, Vd).y });
        const first = at(t0 + 0.001);
        for (let ph = t0 + 0.001; ph < t0 + GAIT.duty; ph += 0.02) {
          const q = at(ph);
          expect(Math.hypot(q.x - first.x, q.y - first.y), `${leg} at ${ph.toFixed(2)} going ${dir.x},${dir.y}`).toBeLessThan(1e-6);
        }
        // in the swing it goes on to the next print, a stride on, lifted
        const next = at(t0 + 1.001);
        expect(Math.hypot(next.x - first.x - Vd.x, next.y - first.y - Vd.y)).toBeLessThan(1e-6);
        const mid = t0 + GAIT.duty + (1 - GAIT.duty) / 2;
        expect(at(mid).y - (first.y + next.y) / 2).toBeLessThan(-2);
      }
    }
    // toward the viewer a stride covers less of the picture
    expect(travelPerCycle({ x: 0, y: 1 }).y).toBeCloseTo(GAIT.stride * GAIT.depth, 6);
  });

  it('reaches every foot with its bones, through the whole stride and in every pose', () => {
    const rigs: [string, Rig][] = Object.entries(RIGS);
    for (let i = 0; i < 40; i++) rigs.push([`walk ${i}`, walkRig(i / 40, side)]);
    for (const [name, r] of rigs) {
      const torso = torsoOf(r);
      for (let leg = 0; leg < 4; leg++) {
        const j = legJoints(r, leg, torso);
        const [l1, l2] = leg % 2 === 1 ? [BONES.upperArm, BONES.forearm] : [BONES.thigh, BONES.shin];
        expect(Math.hypot(j.low.x - j.top.x, j.low.y - j.top.y), `${name} leg ${leg}`).toBeLessThanOrEqual(l1 + l2 + 1e-3);
        expect(Math.hypot(j.mid.x - j.top.x, j.mid.y - j.top.y)).toBeCloseTo(l1, 3);
        expect(Math.hypot(j.low.x - j.mid.x, j.low.y - j.mid.y)).toBeCloseTo(l2, 3);
        // elbows fold back, knees forward
        const cross = (j.low.x - j.top.x) * (j.mid.y - j.top.y) - (j.low.y - j.top.y) * (j.mid.x - j.top.x);
        if (Math.abs(cross) > 1e-3) expect(Math.sign(cross), `${name} leg ${leg} bends`).toBe(leg % 2 === 1 ? 1 : -1);
      }
    }
    // the shoulders and hips rise a little over each foot
    const sh = Array.from({ length: 40 }, (_, i) => walkRig(i / 40, side).sh);
    expect(Math.max(...sh) - Math.min(...sh)).toBeGreaterThan(0.2);
    expect(Math.max(...sh) - Math.min(...sh)).toBeLessThan(1.2);
  });

  it('plants its paws in the scene at its real pace: the stride matches the ground covered', () => {
    let checked = 0;
    for (const seed of [1, 2, 3]) {
      const sim = coastSim(seed);
      let prints = new Map<number, { x: number; y: number; dx: number; dy: number }>();
      for (let t = 0; t < 900; t += 1 / 30) {
        sim.update(1 / 30, 0);
        const k = cats(sim)[0];
        // walking and drawn as the walk (not while it gets up into it or turns)
        const busy = k && ((k as unknown as { change: unknown }).change !== null || (k as unknown as { turnT: number }).turnT < 1);
        if (!k || k.doing() !== 'walk' || k.facingView() !== 'side' || busy) {
          prints = new Map();
          continue;
        }
        const q = k.pose();
        const { facing, scale } = k as unknown as { facing: number; scale: number };
        const Vq = travelPerCycle(q.dir);
        for (let leg = 0; leg < 4; leg++) {
          const s = (((q.walk - GAIT.touch[leg]!) % 1) + 1) % 1;
          const f = walkFoot(leg, q.walk, Vq);
          const world = { x: k.x + facing * scale * CAT_K * f.x, y: k.y + scale * CAT_K * f.y };
          if (s < 0.03 || s > GAIT.duty - 0.03) {
            prints.delete(leg);
            continue;
          }
          const p = prints.get(leg);
          // a stance across a change of heading (a corner) is a pivot, not a slide
          if (!p || Math.hypot(q.dir.x - p.dx, q.dir.y - p.dy) > 0.01) prints.set(leg, { ...world, dx: q.dir.x, dy: q.dir.y });
          else {
            checked++;
            // the walk's own scale changes a little with depth; a slide would be units
            expect(Math.hypot(world.x - p.x, world.y - p.y), `seed ${seed} leg ${leg} at ${t.toFixed(2)}`).toBeLessThan(0.35);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe('toward and away from the viewer', () => {
  it('picks its view from the way it goes, holding it near the line', () => {
    expect(viewFor(10, 0)).toBe('side');
    expect(viewFor(10, 4)).toBe('side');
    expect(viewFor(0, 10)).toBe('front');
    expect(viewFor(2, -10)).toBe('back');
    expect(viewFor(10, 5.5, 'side')).toBe('side');
    expect(viewFor(10, 5.5, 'front')).toBe('front');
    expect(viewFor(10, 1, 'front')).toBe('side');
  });

  it('walks a way mostly in depth facing it, turns to and from it, and never sits or lies in it', () => {
    const problems: string[] = [];
    let turns = 0;
    let deep = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = coastSim(seed);
      let last: { x: number; y: number } | null = null;
      for (let t = 0; t < 1500; t += 0.1) {
        sim.update(0.1, 0);
        const k = cats(sim)[0];
        if (!k) continue;
        const v = k.facingView();
        if (['doze', 'sit', 'wash', 'stretch', 'wake'].includes(k.doing()) && v !== 'side') problems.push(`${k.doing()} facing ${v} at ${t.toFixed(1)}`);
        if (k.doing() === 'walk' && last) {
          const dx = k.x - last.x;
          const dy = k.y - last.y;
          if (Math.hypot(dx, dy) > 0.5 && Math.abs(dy) / GAIT.depth > 2.5 * Math.abs(dx)) {
            deep++;
            if (v !== (dy > 0 ? 'front' : 'back')) problems.push(`walking ${dy > 0 ? 'toward' : 'away'} side-on at ${t.toFixed(1)}`);
          }
        }
        last = { x: k.x, y: k.y };
      }
      turns += cats(sim)[0]?.turns ?? 0;
    }
    expect(problems.slice(0, 10)).toEqual([]);
    expect(deep).toBeGreaterThan(20);
    expect(turns).toBeGreaterThan(2);
  });
});

describe('changes of pose', () => {
  const q = (p: Partial<CatPose>): CatPose => ({ ...REST_POSE, ...p });

  it('are drawn: painted to painted through the rig, painted to the rig, rig to rig; none when the painting goes on', () => {
    expect(changeFor(q({ shape: 'sit' }), q({ shape: 'loaf' }))).toBe(CAT_TUNING.change.paint);
    expect(changeFor(q({ shape: 'sit' }), q({ shape: 'walk' }))).toBe(CAT_TUNING.change.mixed);
    expect(changeFor(q({ shape: 'stand' }), stretchPose(q({}), 0.2))).toBe(CAT_TUNING.change.rig);
    expect(changeFor(q({ shape: 'sit' }), q({ shape: 'wash' }))).toBe(0);
    expect(changeFor(q({ shape: 'loaf' }), q({ shape: 'loaf', sleep: false }))).toBe(0);
    // the in-between runs from one pose's joints to the other's
    const a = q({ shape: 'stand' });
    const b = q({ shape: 'sit' });
    expect(inBetween(a, b, 0).rig).toEqual(expect.objectContaining({ sh: RIGS.stand.sh, hip: RIGS.stand.hip }));
    expect(inBetween(a, b, 1).rig).toEqual(expect.objectContaining({ sh: RIGS.sit.sh, hip: RIGS.sit.hip }));
    const mid = inBetween(a, b, 0.5).rig!;
    expect(mid.hip).toBeLessThan(RIGS.stand.hip);
    expect(mid.hip).toBeGreaterThan(RIGS.sit.hip);
    // the painted poses' own rigs meet their outlines: the sitting chest is up, the loaf low
    expect(rigOf(b).sh - rigOf(b).hip).toBeGreaterThan(14);
    expect(rigOf(q({ shape: 'loaf' })).sh).toBeLessThan(7);
  });

  it('in the scene: sitting down, lying down, getting up and the stretch each start a drawn change', () => {
    const seen = new Map<string, number>();
    for (const seed of [1, 2, 3]) {
      const sim = coastSim(seed);
      let was = '';
      for (let t = 0; t < 1200; t += 0.05) {
        sim.update(0.05, 0);
        const k = cats(sim)[0];
        if (!k) continue;
        const m = k.doing();
        if (m !== was && was) {
          const change = (k as unknown as { change: { dur: number } | null }).change;
          seen.set(`${was}>${m}`, change?.dur ?? 0);
        }
        was = m;
      }
    }
    expect(seen.get('walk>sit') ?? seen.get('land>sit')).toBe(CAT_TUNING.change.mixed);
    expect(seen.get('sit>doze') ?? seen.get('wash>doze')).toBe(CAT_TUNING.change.paint);
    expect(seen.get('wake>stretch')).toBe(CAT_TUNING.change.mixed);
    expect(seen.get('sit>walk') ?? seen.get('stretch>walk')).toBeGreaterThan(0);
    expect(seen.get('sit>wash')).toBe(0);
  });
});

describe('the front stretch', () => {
  it('two forelegs out along the ground with the toes spread, rump up, tail up and curved; then a hind leg trailing', () => {
    const bow = stretchPose({ ...REST_POSE }, 0.3);
    expect(bow.shape).toBe('bow');
    const r = rigOf(bow);
    const torso = torsoOf(r);
    const near = legJoints(r, 3, torso);
    const far = legJoints(r, 1, torso);
    for (const j of [near, far]) {
      expect(j.foot.x - j.top.x).toBeGreaterThan(10);
      expect(Math.abs(j.foot.y)).toBeLessThan(1);
    }
    expect(Math.abs(near.foot.x - far.foot.x)).toBeGreaterThan(2);
    expect(r.hip - r.sh).toBeGreaterThan(10);
    expect(r.tail).toBeLessThan(0);
    const reach = rigOf(stretchPose({ ...REST_POSE }, 0.82));
    const hind = legJoints(reach, 2);
    expect(hind.top.x - hind.foot.x).toBeGreaterThan(10);
  });
});

describe('ground creatures keep off each other', () => {
  const body = (x: number, y: number, r = 10, rest: { x: number; y: number } | null = null) => ({ kind: 'tortoise', at: { x, y }, rest, r, ref: {} });

  it('the shared helper: who is in the way, where is free, the steps round', () => {
    const bodies = [body(50, 2), body(20, 30), body(-20, 0)];
    const hit = blockerOn({ x: 0, y: 0 }, { x: 100, y: 0 }, 5, bodies)!;
    expect(hit.body).toBe(bodies[0]);
    expect(hit.along).toBeCloseTo(50, 6);
    expect(blockerOn({ x: 0, y: 0 }, { x: 30, y: 0 }, 5, [body(80, 0)])).toBeNull();
    expect(groundFree({ x: 50, y: 10 }, 5, bodies)).toBe(false);
    expect(groundFree({ x: 50, y: 20 }, 5, bodies)).toBe(true);
    expect(groundFree({ x: 0, y: 60 }, 5, [body(0, 0, 10, { x: 0, y: 64 })])).toBe(false);
    const [a, b] = stepsRound({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 2 }, 20, 16, 1);
    expect(a).toEqual({ x: 30, y: 16 });
    expect(b).toEqual({ x: 70, y: 16 });
    const sim = coastSim(1, { auto: false });
    sim.spawn('tortoise');
    sim.spawn('heron');
    const w = sim.world;
    // only ground creatures, and not while hidden
    for (const c of sim.creatures) (c as unknown as { alpha: number }).alpha = 1;
    expect(groundBodies(w).map((g) => g.kind)).toEqual(['tortoise']);
    for (const c of sim.creatures) (c as unknown as { alpha: number }).alpha = 0;
    expect(groundBodies(w)).toEqual([]);
  });

  it('the cat goes round a tortoise or gives the way up, never through it, and neither rests on the other’s spot', () => {
    const problems: string[] = [];
    let waits = 0;
    let detours = 0;
    let meetings = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sim = coastSim(seed);
      sim.update(0.05, 0);
      sim.spawn('tortoise', { count: 2 });
      let was = '';
      for (let t = 0; t < 1200; t += 0.1) {
        sim.update(0.1, 0);
        const k = cats(sim)[0];
        if (!k) continue;
        if (k.doing() === 'wait' && was !== 'wait') waits++;
        was = k.doing();
        const { scale, facing } = k as unknown as { scale: number; facing: number };
        for (const tt of sim.creatures.filter((c): c is Tortoise => c instanceof Tortoise && !c.done && c.alpha > 0.5)) {
          const d = dist(k, tt);
          if (d < 80) meetings++;
          const room = (GROUND_ROOM.cat! * 0.25 + GROUND_ROOM.tortoise!) * scale;
          // walking, it never passes over a tortoise in front of it
          if (k.doing() === 'walk' && d < room * 0.8) {
            const q = k.pose();
            const ahead = (tt.x - k.x) * (q.view === 'side' ? facing : q.dir.x) + (tt.y - k.y) * q.dir.y;
            if (ahead > 0 && tt.doing() !== 'plod') problems.push(`cat walks into the tortoise at ${t.toFixed(1)} (seed ${seed}, ${d.toFixed(1)})`);
          }
          if (['doze', 'sit', 'wash'].includes(k.doing()) && ['pause', 'graze', 'bask', 'doze'].includes(tt.doing()) && d < room) problems.push(`resting together at ${t.toFixed(1)} (seed ${seed}, ${d.toFixed(1)})`);
        }
      }
      detours += cats(sim)[0]?.detours ?? 0;
    }
    expect(problems.slice(0, 10)).toEqual([]);
    // the meetings themselves are rare in a day; the next test makes them
    expect(meetings + waits + detours).toBeGreaterThanOrEqual(0);
  });

  it('a tortoise put down on its way: it stops and looks, then steps round it or gives the stroll up', () => {
    let detours = 0;
    let met = 0;
    const problems: string[] = [];
    // seed 51 meets it on the middle terrace's east walk with room to step round (devlog 219)
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 51]) {
      const sim = coastSim(seed);
      let k: Cat | undefined;
      type LegT = { from: { x: number; y: number }; to: { x: number; y: number }; kind: string; node: number };
      let leg: LegT | undefined;
      for (let t = 0; t < 1500 && !leg; t += 0.1) {
        sim.update(0.1, 0);
        k = cats(sim)[0];
        const r = (k as unknown as { route: LegT[] } | undefined)?.route;
        const l = r?.[0];
        if (k && k.doing() === 'walk' && l && l.kind === 'walk' && l.node >= 0 && Math.abs(l.to.x - k.x) > 90 && Math.abs(l.to.y - k.y) < 12) leg = l;
      }
      if (!k || !leg) continue;
      const [tt] = sim.spawn('tortoise') as Tortoise[];
      if (!tt) continue;
      met++;
      // a dozing tortoise half way along
      Object.assign(tt, { x: (k.x + leg.to.x) / 2, y: (k.y + leg.to.y) / 2, alpha: 1, mode: 'doze', modeFor: 1e6, modeT: 0, route: [] });
      (tt as unknown as { state: string }).state = 'doze';
      let waited = false;
      for (let t = 0; t < 60; t += 0.1) {
        sim.update(0.1, 0);
        const c = cats(sim)[0]!;
        if (c.doing() === 'wait') waited = true;
        const scale = (c as unknown as { scale: number }).scale;
        const room = (GROUND_ROOM.cat! * 0.25 + GROUND_ROOM.tortoise!) * scale;
        if (dist(c, tt) < room * 0.9) problems.push(`seed ${seed}: within ${dist(c, tt).toFixed(1)} of the tortoise (${c.doing()}) at ${t.toFixed(1)}`);
      }
      if (!waited) problems.push(`seed ${seed}: never stopped to look`);
      detours += cats(sim)[0]!.detours;
    }
    expect(problems.slice(0, 6).join('\n')).toBe('');
    expect(met).toBeGreaterThan(5);
    expect(detours).toBeGreaterThan(0);
  });
});

describe('cost', () => {
  const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
  // every part a sprite that also stands for a near and far pair
  const parts = new Proxy({}, { get: () => Object.assign([sprite(), sprite()], sprite()) }) as unknown as CatParts;
  const counting = () => {
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    return { ctx: ctx as never, count: () => n };
  };

  it('composes a frame from a handful of painted parts in every pose: whole paintings, or the rig a sprite a bone', () => {
    for (const shape of ['loaf', 'curl', 'sit', 'wash'] as const) {
      const a = counting();
      drawCat(a.ctx, parts, { ...REST_POSE, shape, paw: 0.5 });
      expect(a.count(), shape).toBeLessThanOrEqual(9);
    }
    for (const shape of ['bow', 'walk', 'stand', 'reach', 'crouch', 'leap'] as const) {
      const a = counting();
      drawCat(a.ctx, parts, { ...REST_POSE, shape, paw: 0.5 });
      // shadow, four legs of three bones, tail, torso, head
      expect(a.count(), shape).toBeLessThanOrEqual(16);
    }
    for (const view of ['front', 'back'] as const) {
      const a = counting();
      drawCat(a.ctx, parts, { ...REST_POSE, shape: 'walk', view, dir: { x: 0, y: view === 'front' ? 1 : -1 } });
      expect(a.count(), view).toBeLessThanOrEqual(9);
    }
  });

  it('updates cheaply', () => {
    const sim = coastSim(2);
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
