import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { OASIS } from '../../scenery/oasis';
import { WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import { sightedFauna } from '../system';
import dolphin, { bayOf, dolphinLength, drawRoll, noseAt, OUTLINE, planPass, Pod, rollAt, spanAt, type DolphinParts, type RollKind } from './dolphin';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'dolphin');

function coastSim(seed = 4, { hour = 12, reduced = false, auto = false } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, reducedMotion: reduced, auto });
  sim.setGarden(plants, ONLY, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const pods = (sim: FaunaSim) => sim.creatures.filter((c): c is Pod => c instanceof Pod);

/** Run one hand-spawned pass to its end, calling `each` every step. */
function pass(seed: number, each?: (p: Pod, sim: FaunaSim) => void, o: { reduced?: boolean; count?: number } = {}) {
  const sim = coastSim(seed, { reduced: o.reduced });
  const pod = sim.spawn('dolphin', { count: o.count ?? 1 })[0] as Pod;
  let t = 0;
  while (!pod.done && t < 600) {
    sim.update(0.05, 0);
    t += 0.05;
    each?.(pod, sim);
  }
  return { pod, t, sim };
}

await loadAllCreatures();

/** The outline at `u` of a roll, in body lengths about the surfacing point (y down: − is above the water). */
function outlineAt(kind: RollKind, u: number) {
  const q = rollAt(kind, u);
  const c = Math.cos(q.angle);
  const s = Math.sin(q.angle);
  return OUTLINE.map((p) => ({ x: q.x + p.x * c - p.y * s, y: q.y + p.x * s + p.y * c }));
}
const top = (kind: RollKind, u: number) => Math.min(...outlineAt(kind, u).map((p) => p.y));
const bottom = (kind: RollKind, u: number) => Math.max(...outlineAt(kind, u).map((p) => p.y));

describe('the roll', () => {
  const kinds: RollKind[] = ['low', 'high', 'dive', 'leap'];

  it('begins and ends wholly under the water, so nothing pops in or out above it', () => {
    for (const k of kinds) {
      expect(top(k, 0), `${k} at 0`).toBeGreaterThan(0);
      expect(top(k, 1), `${k} at 1`).toBeGreaterThan(0);
    }
  });

  it('a low roll shows only the back and the fin, a high one the beak too', () => {
    const peak = (k: RollKind) => Math.min(...Array.from({ length: 41 }, (_, i) => top(k, i / 40)));
    // the fin's tip is the highest point: about a quarter of a body length
    expect(peak('low')).toBeLessThan(-0.15);
    expect(peak('low')).toBeGreaterThan(-0.35);
    const noseUp = (k: RollKind) => Math.min(...Array.from({ length: 41 }, (_, i) => noseAt(k, i / 40).y));
    expect(noseUp('high')).toBeLessThan(noseUp('low'));
    expect(noseUp('high')).toBeLessThan(-0.1);
    // the body's centre stays at or under the surface in a low roll
    expect(Math.min(...Array.from({ length: 41 }, (_, i) => rollAt('low', i / 40).y))).toBeGreaterThanOrEqual(0);
  });

  it('a dive lifts the tail stock and flukes clear at its end; a leap clears the water, modestly', () => {
    const tail = (u: number) => {
      const q = rollAt('dive', u);
      return q.y - 0.55 * Math.sin(q.angle);
    };
    expect(Math.min(...Array.from({ length: 30 }, (_, i) => tail(0.7 + i / 100)))).toBeLessThan(-0.05);
    expect(bottom('leap', 0.5)).toBeLessThan(0);
    expect(top('leap', 0.5)).toBeGreaterThan(-1);
  });
});

describe('where the pod swims', () => {
  const w = coastSim().world;
  const bay = bayOf(w)!;

  it('the bay is the coast’s far stage: far out, small, clear of every planting slot', () => {
    expect(bay).not.toBeNull();
    for (const s of COAST_SLOTS) expect(pointInPolygon(s, bay.outline), s.id).toBe(false);
    // the size: a fleck far out, at most a fifth of the caique (about 76 units)
    const b = bay.outline.map((p) => p.y);
    expect(dolphinLength(bay, Math.max(...b))).toBeLessThan(76 / 3.5);
    expect(dolphinLength(bay, Math.min(...b))).toBeGreaterThan(2);
  });

  it('lives only at the coast', () => {
    expect(dolphin.needs!(new FaunaSim({ scene: gardenScene, seed: 3 }).world)).toBe(false);
    expect(dolphin.needs!(new FaunaSim({ scene: waterfallScene, seed: 3, habitat: WATERFALL_WILDLIFE }).world)).toBe(false);
    expect(dolphin.needs!(new FaunaSim({ scene: OASIS.geometry, seed: 3, habitat: OASIS.fauna }).world)).toBe(false);
    expect(dolphin.needs!(w)).toBe(true);
  });

  it('every surfacing, splash and ring stays inside the bay, its whole roll too', () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      pass(seed, (pod, sim) => {
        for (const s of pod.surfacing()) {
          const span = spanAt(bay, s.y)!;
          if (s.x - 1.5 * s.L < span[0] || s.x + 1.5 * s.L > span[1]) problems.push(`seed ${seed}: a roll at ${s.x.toFixed(0)} reaches out of ${span.map((v) => v.toFixed(0))}`);
        }
        // the caique's mast top stands under the bay's foot: every roll well above it
        const mast = sim.world.perches.find((p) => p.id === 'mast-top')!;
        for (const s of pod.surfacing()) if (s.y > mast.y - 12) problems.push(`seed ${seed}: a roll at the caique's height`);
        for (const m of pod.marks()) {
          const span = spanAt(bay, m.y)!;
          if (m.x - m.w / 2 < span[0] - 1 || m.x + m.w / 2 > span[1] + 1) problems.push(`seed ${seed}: a mark at ${m.x.toFixed(0)} out of the bay`);
        }
      });
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});

describe('a pass', () => {
  it('a pod of two to five crosses in about a minute, each breathing in its own rhythm, then dives and is gone', () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 16; seed++) {
      const starts = new Map<number, number[]>();
      const seen = new WeakSet<object>();
      let first = -1;
      const { pod, t } = pass(seed, (p) => {
        p.animals.forEach((a, i) => {
          if (!a.roll || seen.has(a.roll)) return;
          seen.add(a.roll);
          starts.set(i, [...(starts.get(i) ?? []), p.time]);
        });
        if (first < 0 && p.surfacing().length) first = p.time;
      });
      sizes.add(pod.animals.length);
      expect(pod.done).toBe(true);
      expect(t, `seed ${seed}`).toBeGreaterThan(45);
      expect(t, `seed ${seed}`).toBeLessThan(170);
      // the leader breaks the surface at once: the arrival line is true when it is said
      expect(first).toBeLessThan(0.1);
      // the adults breathe every few seconds, out of step
      for (const [i, ts] of starts) {
        if (pod.animals[i]!.mother >= 0) continue;
        expect(ts.length, `seed ${seed} animal ${i}`).toBeGreaterThan(5);
        const gaps = ts.slice(1).map((v, k) => v - ts[k]!).filter((g) => g < 9);
        expect(Math.min(...gaps)).toBeGreaterThan(1.5);
      }
      expect(pod.did.dive).toBeGreaterThan(0);
    }
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(5);
  });

  it('pods of two to five, three or four most often', () => {
    const bay = bayOf(coastSim().world)!;
    const n = new Map<number, number>();
    for (let seed = 1; seed <= 400; seed++) {
      const size = planPass(bay, createRng(seed), { stay: 80 }).size;
      n.set(size, (n.get(size) ?? 0) + 1);
    }
    expect([...n.keys()].sort()).toEqual([2, 3, 4, 5]);
    expect(n.get(3)! + n.get(4)!).toBeGreaterThan(200);
  });

  it('now and then one modest leap, never two; sometimes it mills a while; a calf comes up beside its mother', () => {
    let leaps = 0;
    let mills = 0;
    let calves = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let lag = Infinity;
      const { pod } = pass(seed, (p) => {
        const calf = p.animals.find((a) => a.mother >= 0);
        if (calf?.roll && calf.roll.u < 0.04) {
          const mum = p.animals[calf.mother]!;
          if (mum.roll) lag = Math.min(lag, (mum.roll.u - calf.roll.u) * 1.5);
        }
      });
      expect(pod.did.leap).toBeLessThanOrEqual(1);
      leaps += pod.did.leap;
      mills += pod.did.mill;
      if (pod.plan.calf) {
        calves++;
        expect(lag).toBeLessThan(0.6);
      }
    }
    expect(leaps).toBeGreaterThan(4);
    expect(leaps).toBeLessThan(20);
    expect(mills).toBeGreaterThan(8);
    expect(calves).toBeGreaterThan(3);
  });

  it('a hand spawn’s count is the pod’s size', () => {
    expect(pass(3, undefined, { count: 4 }).pod.animals.length).toBe(4);
  });

  it('is rare: a pass in some sessions, one pod at a time, never at night', () => {
    const sim = coastSim(9, { auto: true });
    let passes = 0;
    let was = false;
    for (let s = 0; s < 6 * 3600; s += 0.25) {
      sim.update(0.25, 0);
      const n = pods(sim).length;
      expect(n).toBeLessThanOrEqual(1);
      if (n && !was) passes++;
      was = n > 0;
    }
    // gaps of 25–50 minutes: four to fourteen passes in six hours of daylight
    expect(passes).toBeGreaterThanOrEqual(4);
    expect(passes).toBeLessThanOrEqual(14);
    const night = coastSim(9, { auto: true, hour: 22 });
    for (let s = 0; s < 4 * 3600; s += 1) {
      night.update(1, 0);
      expect(pods(night)).toHaveLength(0);
    }
  });

  it('at nightfall the pod dives and is gone', () => {
    const sim = coastSim(5);
    sim.spawn('dolphin');
    for (let s = 0; s < 10; s += 0.05) sim.update(0.05, 0);
    sim.hourOverride = 22;
    for (let s = 0; s < 30; s += 0.05) sim.update(0.05, 0);
    expect(pods(sim)).toHaveLength(0);
  });

  it('is announced only when it shows: the pod is in sight at once, and the row is the dolphins’', () => {
    const sim = coastSim(6);
    const pod = sim.spawn('dolphin', { forced: false })[0] as Pod;
    sim.update(0.3, 0);
    expect(pod.surfacing().length).toBe(1);
    expect([...sightedFauna(sim.creatures, sim.world.view, COAST_FAUNA)]).toEqual(['dolphins']);
    // a close view on the terraces does not see it
    expect([...sightedFauna(sim.creatures, { x: 900, y: 500, w: 500, h: 300 }, COAST_FAUNA)]).toEqual([]);
  });

  it('is deterministic and draws only on its own fork', () => {
    const a = pass(7);
    const b = pass(7);
    expect(a.t).toBe(b.t);
    expect(a.pod.did).toEqual(b.pod.did);
    expect(a.sim.rng.next()).toBe(b.sim.rng.next());
  });

  it('in reduced motion: slower, and no leap', () => {
    let leaps = 0;
    let slow = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = pass(seed, undefined, { reduced: true });
      leaps += r.pod.did.leap;
      if (r.t > pass(seed).t) slow++;
    }
    expect(leaps).toBe(0);
    expect(slow).toBeGreaterThan(9);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(dolphin.show!.spec, 1, 'dolphin', 'coast');
    let up = 0;
    for (let i = 0; i < 30 * 90; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      up += pods(stage.sim).reduce((n, p) => n + p.surfacing().length, 0);
    }
    expect(up).toBeGreaterThan(30 * 20);
  });
});

describe('cost', () => {
  const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
  const parts: DolphinParts = { body: sprite(), splash: sprite(), bigSplash: sprite(), ring: sprite() };
  const counting = () => {
    const n = { drawImage: 0, clip: 0 };
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n.drawImage++ : k === 'clip' ? () => n.clip++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    return { ctx: ctx as never, n };
  };

  it('a body is one clipped drawImage, and a frame of a pass a handful', () => {
    const a = counting();
    drawRoll(a.ctx, parts, 'low', 0.5, 300, 430, 10, 1);
    expect(a.n).toEqual({ drawImage: 1, clip: 1 });
    let most = 0;
    pass(4, (pod, sim) => {
      (sim.world.art as unknown as { get: () => DolphinParts }).get = () => parts;
      const c = counting();
      pod.draw('waterSurface', c.ctx, sim.world);
      most = Math.max(most, c.n.drawImage);
      const none = counting();
      pod.draw('entities', none.ctx, sim.world);
      pod.draw('air', none.ctx, sim.world);
      expect(none.n.drawImage).toBe(0);
    });
    expect(most).toBeLessThanOrEqual(18);
  });

  it('updates cheaply', () => {
    const sim = coastSim(2);
    sim.spawn('dolphin', { count: 5 });
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(800);
  });

  it('plans from its own fork', () => {
    const w = coastSim().world;
    const a = planPass(bayOf(w)!, createRng(3), { stay: 80 });
    const b = planPass(bayOf(w)!, createRng(3), { stay: 80 });
    expect(a).toEqual(b);
  });
});
