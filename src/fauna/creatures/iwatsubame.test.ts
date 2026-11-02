import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { FaunaSim } from '../sim';
import { Stage } from '../stage';
import iwatsubame, { cliffFace, facePoint, inRect, Martin, nestSites, sprayPoint } from './iwatsubame';

const plants: PlantInstance[] = [];

/** The waterfall with every row unlocked; `scheduled: false` leaves the martins to hand spawns. */
function waterfallSim(seed = 4, opts: { reduced?: boolean; scheduled?: boolean; auto?: boolean } = {}) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: opts.reduced ?? false, auto: opts.auto ?? true });
  sim.setGarden(plants, WATERFALL_FAUNA.filter((r) => opts.scheduled || r.kind !== 'iwatsubame'), () => undefined);
  sim.hourOverride = 12;
  return sim;
}

const martins = (sim: FaunaSim) => sim.creatures.filter((c): c is Martin => c instanceof Martin);

describe('where the martins fly', () => {
  const w = waterfallSim().world;
  const face = cliffFace(w)!;
  const ledges = w.perches.filter((p) => p.kind === 'ledge');

  it('work the cliff face: every ledge and the falls, inside the view', () => {
    expect(face).not.toBeNull();
    for (const l of ledges) expect(inRect(l, face)).toBe(true);
    const foot = waterfallScene.falls!.foot;
    expect(face.y + face.h).toBeLessThan(foot.y);
    expect(face.y + face.h).toBeGreaterThan(Math.max(...ledges.map((l) => l.y)));
    expect(face.x).toBeGreaterThanOrEqual(w.view.x);
    expect(face.x + face.w).toBeLessThanOrEqual(w.view.x + w.view.w);
    const rng = createRng(2);
    for (let i = 0; i < 200; i++) expect(inRect(facePoint(face, { x: 600, y: 400 }, rng), face)).toBe(true);
    for (let i = 0; i < 100; i++) {
      const q = sprayPoint(w, rng)!;
      expect(q.y).toBeGreaterThan(400);
      expect(q.y).toBeLessThan(foot.y);
    }
  });

  it('have no cliff in the Japanese garden, so they never come there', () => {
    const sim = new FaunaSim({ scene: gardenScene, seed: 3 });
    expect(cliffFace(sim.world)).toBeNull();
    expect(iwatsubame.needs!(sim.world)).toBe(false);
    expect(sim.spawn('iwatsubame', { count: 4 })).toHaveLength(0);
  });

  it('nest in a few mud cups just under the ledges’ lips, the same for every flock', () => {
    const nests = nestSites(w);
    expect(nests.length).toBeGreaterThanOrEqual(2);
    for (const n of nests) {
      const l = ledges.find((p) => p.id === n.ledge)!;
      expect(n.y).toBeGreaterThan(l.y);
      expect(n.y - l.y).toBeLessThan(8);
      expect(Math.abs(n.x - l.x)).toBeLessThan(l.spread + 12);
      expect(n.s).toBeCloseTo(w.perspective(l.y, l.x), 5);
    }
    expect(nestSites(waterfallSim().world)).toEqual(nests);
  });
});

describe('a flock at the waterfall', () => {
  it('swirls along the cliff, darts to the cups and clings there, and goes away up over the skyline', () => {
    const sim = waterfallSim(7);
    const flock = sim.spawn('iwatsubame', { count: 6 }) as Martin[];
    expect(flock).toHaveLength(6);
    const face = cliffFace(sim.world)!;
    const nests = nestSites(sim.world);
    const problems: string[] = [];
    const states = new Set<string>();
    let clings = 0;
    let onFace = 0;
    let swirling = 0;
    let t = 0;
    for (; t < 400 && martins(sim).length > 0; t += 0.1) {
      sim.update(0.1, 0);
      for (const m of martins(sim)) {
        states.add(m.state);
        if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) problems.push(`#${m.id} NaN`);
        if (m.state === 'swirl') {
          swirling++;
          if (inRect(m, face, 60)) onFace++;
        }
        const at = m.clingingAt();
        if (at) {
          clings++;
          if (!nests.some((n) => n.id === at.id && Math.hypot(n.x - m.x, n.y - m.y) < 0.5)) problems.push(`#${m.id} clinging off its cup at ${m.x | 0},${m.y | 0}`);
        }
      }
      const atCups = martins(sim).filter((m) => m.state === 'cling').length;
      if (atCups > 2) problems.push(`${atCups} at the cups at ${t.toFixed(1)}`);
    }
    expect(problems).toEqual([]);
    for (const s of ['enter', 'swirl', 'dart', 'cling', 'drop', 'leave']) expect(states, s).toContain(s);
    expect(clings).toBeGreaterThan(20);
    // nearly all of the swirling is on the cliff face
    expect(onFace / swirling).toBeGreaterThan(0.95);
    // the visit ends: the whole flock has gone within its stay and the way out
    expect(martins(sim)).toHaveLength(0);
    expect(t).toBeGreaterThan(60);
  });

  it('comes by day in loose flocks of 3 to 7, never counts as a visitor, and is gone at night', () => {
    const sim = waterfallSim(11, { scheduled: true });
    const sizes: number[] = [];
    let seen = 0;
    let atNight = 0;
    for (let t = 0; t < 3600; t += 0.25) {
      sim.hourOverride = t < 2400 ? 12 : 22;
      const before = martins(sim).length;
      sim.update(0.25, 0);
      const now = martins(sim);
      if (now.length > before && before === 0) sizes.push(now.length);
      if (now.length > 0) seen++;
      if (t > 2700 && now.length > 0) atNight++;
      expect(sim.census().visitors).toBeLessThanOrEqual(3);
    }
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    for (const n of sizes) {
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
    expect(seen).toBeGreaterThan(0);
    // nightfall at t 2400: they leave on their own (not counted, so the sim does not send them)
    expect(atNight).toBe(0);
  });

  it('draws only on its own fork: other creatures’ randomness is untouched', () => {
    const a = waterfallSim(5, { auto: false });
    const b = waterfallSim(5, { auto: false });
    a.spawn('iwatsubame', { count: 5 });
    b.spawn('iwatsubame', { count: 5 });
    for (let i = 0; i < 600; i++) a.update(0.1, 0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = waterfallSim(9);
      sim.spawn('iwatsubame', { count: 5 });
      for (let i = 0; i < 300; i++) sim.update(0.1, 0);
      return martins(sim).map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.state}`);
    };
    expect(run()).toEqual(run());
  });

  it('in reduced motion: two or three birds, slower, still darting to the cups', () => {
    const speedOf = (reduced: boolean) => {
      const sim = waterfallSim(3, { reduced });
      const flock = sim.spawn('iwatsubame', { count: reduced ? 1 : 5 }) as Martin[];
      let d = 0;
      let n = 0;
      let clung = false;
      for (let i = 0; i < 900; i++) {
        const before = flock.map((m) => ({ x: m.x, y: m.y, s: m.state }));
        sim.update(0.1, 0);
        flock.forEach((m, k) => {
          if (m.state === 'swirl' && before[k]!.s === 'swirl') {
            d += Math.hypot(m.x - before[k]!.x, m.y - before[k]!.y);
            n++;
          }
          if (m.state === 'cling') clung = true;
        });
      }
      return { size: flock.length, speed: d / n / 0.1, clung };
    };
    const calm = speedOf(true);
    const lively = speedOf(false);
    expect(calm.size).toBeGreaterThanOrEqual(2);
    expect(calm.size).toBeLessThanOrEqual(3);
    expect(calm.speed).toBeLessThan(lively.speed * 0.75);
    expect(calm.clung).toBe(true);
  });

  it('swirls on the studio’s falls stage', () => {
    const stage = new Stage(iwatsubame.show!.spec, 1, 'iwatsubame', 'falls');
    const w = stage.sim.world;
    expect(cliffFace(w)).not.toBeNull();
    expect(nestSites(w).length).toBeGreaterThan(0);
    let inView = 0;
    for (let i = 0; i < 300; i++) {
      stage.tickRespawn(i * 0.1);
      stage.sim.update(0.1, 0);
      const v = w.view;
      inView += martins(stage.sim).filter((m) => m.x > v.x && m.x < v.x + v.w && m.y > v.y && m.y < v.y + v.h).length;
    }
    expect(inView / 300).toBeGreaterThan(2);
  });
});
