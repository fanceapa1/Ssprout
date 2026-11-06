import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { OASIS } from '../../scenery/oasis';
import { OASIS_FAUNA } from '../../scenery/oasis/fauna';
import { OASIS_WILDLIFE } from '../../scenery/oasis/wildlife';
import { WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { closestOnPolygon, dist } from '../math';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import { perchY } from '../targets';
import dove, { alongPerch, choosePlace, Dove, DOVE_TUNING, dovePerches, drawDove, drinkPerches, drinkY, inEllipse, REST_POSE, type DoveParts } from './dove';

const plants: PlantInstance[] = [];
const ONLY = OASIS_FAUNA.filter((r) => r.kind === 'dove');

function oasisSim(seed = 4, { hour = 12, reduced = false, rows = [] as typeof ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: OASIS.geometry, seed, habitat: OASIS_WILDLIFE, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const doves = (sim: FaunaSim) => sim.creatures.filter((c): c is Dove => c instanceof Dove);

/** A creature holding a spot (as a bunting on a perch does). */
const holder = (id: number, q: { x: number; y: number }) =>
  ({ id, kind: 'bunting', x: q.x, y: q.y, layer: 'entities', state: 'perch', done: false, visitor: false, forced: true, update() {}, draw() {}, depth: () => null, leave() {}, spot: () => q }) as never;

/** Where a settled dove is wrong: off its perch, outside its plot, drinking anywhere but the rim. */
function placeProblems(d: Dove, t: number): string[] {
  const out: string[] = [];
  const p = d.place;
  if (!p || d.state === 'clatter' || d.layer === 'air') return out;
  if (p.perch) {
    const pr = p.perch;
    if (!['frond', 'wall', 'rim'].includes(pr.kind)) out.push(`on a ${pr.kind} at ${t.toFixed(1)}`);
    const reach = pr.spread + DOVE_TUNING.pair * p.scale + 0.5;
    if (Math.abs(d.x - pr.x) > reach) out.push(`off the end of ${pr.id} at ${t.toFixed(1)} (${(d.x - pr.x).toFixed(1)})`);
    if (Math.abs(d.y - alongPerch(pr, d.x)) > 5.5) out.push(`off the line of ${pr.id} at ${t.toFixed(1)}`);
  } else if (p.ground) {
    if (!inEllipse(p.ground, d, 1)) out.push(`outside ${p.ground.id} at ${t.toFixed(1)}`);
  } else out.push(`nowhere at ${t.toFixed(1)}`);
  if (d.state === 'drink' && p.perch?.kind !== 'rim') out.push(`drinking off the rim at ${t.toFixed(1)}`);
  return out;
}

describe('where the dove goes', () => {
  const w = oasisSim().world;

  it('sits on palm fronds, wall tops and the basin’s coping, and drinks only at the near and far rims', () => {
    const kinds = new Set(dovePerches(w).map((p) => p.kind));
    expect([...kinds].sort()).toEqual(['frond', 'rim', 'wall']);
    const drinks = drinkPerches(w).map((p) => p.id);
    expect(drinks.length).toBe(7);
    for (const id of drinks) expect(id).toMatch(/^rim-(near|far)-/);
    // at the rim it stands on the coping's water edge: the water within reach of its bill
    for (const p of drinkPerches(w)) {
      const y = drinkY(w, p, p.x);
      expect(Math.abs(y - perchY(p, p.x))).toBeLessThan(5.5);
      expect(closestOnPolygon({ x: p.x, y }, w.pond.world).d).toBeLessThan(1.5);
    }
  });

  it('settles only on its perches and the plots, inside them', () => {
    const rng = createRng(3);
    for (let i = 0; i < 400; i++) {
      const pl = choosePlace(w, rng, [], { pair: i % 2 === 0 })!;
      expect(pl).not.toBeNull();
      if (pl.perch) {
        expect(['frond', 'wall', 'rim']).toContain(pl.perch.kind);
        expect(Math.abs(pl.x - pl.perch.x)).toBeLessThanOrEqual(pl.perch.spread);
        expect(pl.drink).toBe(pl.perch.kind === 'rim');
        // a frond takes its palm's scale, not the ground's under the crown
        if (pl.perch.kind === 'frond') expect(pl.scale).toBe(pl.perch.scale);
      } else expect(inEllipse(pl.ground!, pl, 0.61)).toBe(true);
    }
  });

  it('keeps off perches others hold', () => {
    const rng = createRng(5);
    const held = dovePerches(w).filter((p) => p.kind !== 'wall');
    const taken = held.map((p) => ({ x: p.x, y: p.y }));
    for (let i = 0; i < 200; i++) {
      const pl = choosePlace(w, rng, taken)!;
      expect(pl.kind === 'wall' || pl.kind === 'ground').toBe(true);
      if (pl.perch) expect(taken.every((t) => dist(t, pl.perch!) >= DOVE_TUNING.clear)).toBe(true);
    }
  });

  it('on a phone (the basin and the middle plot in view) it drinks and walks where it can be seen', () => {
    const narrow = { ...w, view: { x: 430, y: 120, w: 600, h: 840 } };
    const rng = createRng(4);
    for (let i = 0; i < 100; i++) {
      const pl = choosePlace(narrow, rng, [])!;
      expect(pl.x).toBeGreaterThan(430);
      expect(pl.x).toBeLessThan(1030);
    }
  });

  it('never comes to the Japanese garden or the waterfall: no fronds, no plots', () => {
    const garden = new FaunaSim({ scene: gardenScene, seed: 3 });
    expect(dove.needs!(garden.world)).toBe(false);
    expect(garden.spawn('dove', { count: 2 })).toHaveLength(0);
    const falls = new FaunaSim({ scene: waterfallScene, seed: 3, habitat: WATERFALL_WILDLIFE });
    expect(dove.needs!(falls.world)).toBe(false);
    expect(falls.spawn('dove', { count: 2 })).toHaveLength(0);
    expect(dove.needs!(oasisSim().world)).toBe(true);
  });
});

describe('a visit', () => {
  it('a pair comes in, sits, bows and coos, walks the plots, drinks at the rim, clatters off, and leaves', () => {
    const problems: string[] = [];
    const states = new Set<string>();
    let bows = 0;
    let drinks = 0;
    let clatters = 0;
    let gaps = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = oasisSim(seed, { auto: false });
      const pair = sim.spawn('dove', { count: 2 }) as Dove[];
      expect(pair).toHaveLength(2);
      expect(pair[0]!.mate).toBe(pair[1]);
      let t = 0;
      for (; t < 400 && doves(sim).length > 0; t += 0.05) {
        sim.update(0.05, 0);
        for (const d of doves(sim)) {
          states.add(d.state);
          if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) problems.push(`NaN at ${t.toFixed(1)}`);
          problems.push(...placeProblems(d, t));
        }
        const [a, b] = doves(sim);
        // a pair sits close together on the same perch
        if (a && b && a.place?.perch && a.place.perch === b.place?.perch && a.layer === 'entities' && b.layer === 'entities') {
          if (Math.abs(a.x - b.x) > DOVE_TUNING.pair * a.place.scale * 1.6) gaps++;
        }
      }
      for (const d of pair) {
        bows += d.bows;
        drinks += d.drinks;
        clatters += d.clatters;
      }
      expect(doves(sim)).toHaveLength(0);
      expect(t).toBeLessThan(pair[0]!.stay + 80);
    }
    expect(problems.slice(0, 10)).toEqual([]);
    expect(gaps).toBe(0);
    for (const s of ['arrive', 'perch', 'walk', 'drink', 'clatter', 'fly', 'depart']) expect(states, s).toContain(s);
    expect(bows).toBeGreaterThan(0);
    expect(drinks).toBeGreaterThan(0);
    expect(clatters).toBeGreaterThan(6);
  });

  it('respects held perches: lands clear of a bird on every frond and coping', () => {
    const sim = oasisSim(8, { auto: false });
    const held = dovePerches(sim.world).filter((p) => p.kind !== 'rim');
    held.forEach((p, i) => sim.creatures.push(holder(9000 + i, { x: p.x, y: p.y })));
    for (let n = 0; n < 6; n++) {
      const made = sim.spawn('dove', { count: 2 }) as Dove[];
      for (let i = 0; i < 300; i++) sim.update(0.05, 0);
      for (const d of made) {
        if (d.place?.perch) expect(held.every((h) => dist(h, d.place!.perch!) >= DOVE_TUNING.clear), d.place.perch.id).toBe(true);
      }
      sim.creatures = sim.creatures.filter((c) => !(c instanceof Dove));
    }
  });

  it('gives its spot, so other birds keep off its perch', () => {
    const sim = oasisSim(9, { auto: false });
    const [a] = sim.spawn('dove') as Dove[];
    expect(a!.spot()).not.toBeNull();
    for (let i = 0; i < 400; i++) sim.update(0.05, 0);
    if (a!.place) expect(dist(a!.spot()!, a!.place)).toBeLessThan(1e-6);
  });

  it('is diurnal, comes alone or in pairs, counted as a visitor, and leaves at nightfall', () => {
    const sim = oasisSim(11, { rows: ONLY });
    let seen = 0;
    let atNight = 0;
    let most = 0;
    // the oasis's auto sim costs about half a millisecond a step in Node: half-second steps
    for (let t = 0; t < 2400; t += 0.5) {
      sim.hourOverride = t < 2000 ? 12 : 22;
      sim.update(0.5, 0);
      const now = doves(sim).length;
      most = Math.max(most, now);
      if (now > 0) seen++;
      if (t > 2120 && now > 0) atNight++;
    }
    expect(seen).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
    expect(atNight).toBe(0);
    expect(dove.visit!.diurnal).toBe(true);
    expect(dove.visit!.visitor).toBe(true);
    expect(dove.visit!.group).toEqual([1, 2]);
    // never scheduled by night
    const night = oasisSim(12, { rows: ONLY, hour: 23 });
    for (let t = 0; t < 1200; t += 1) night.update(1, 0);
    expect(doves(night)).toHaveLength(0);
  });

  it('draws only on its own fork: other creatures’ randomness is untouched', () => {
    const a = oasisSim(5, { auto: false });
    const b = oasisSim(5, { auto: false });
    // the rings are the sim's own: leave them out here
    a.world.ripple = () => {};
    b.world.ripple = () => {};
    a.spawn('dove', { count: 2 });
    b.spawn('dove', { count: 2 });
    for (let i = 0; i < 2400; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = oasisSim(9, { auto: false });
      sim.spawn('dove', { count: 2 });
      for (let i = 0; i < 2000; i++) sim.update(0.05, 0);
      return doves(sim).map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.state}`);
    };
    const first = run();
    expect(first.length).toBeGreaterThan(0);
    expect(run()).toEqual(first);
  });

  it('in reduced motion: slower, and still moving (walks, drinks, flies)', () => {
    const measure = (reduced: boolean) => {
      const sim = oasisSim(3, { reduced, auto: false });
      const [d] = sim.spawn('dove') as Dove[];
      let flown = 0;
      let n = 0;
      let moved = 0;
      for (let i = 0; i < 8000 && doves(sim).length > 0; i++) {
        const x = d!.x;
        const y = d!.y;
        const s = d!.state;
        sim.update(0.05, 0);
        const step = Math.hypot(d!.x - x, d!.y - y);
        if (s === 'arrive' && d!.state === 'arrive') {
          flown += step;
          n++;
        }
        if (d!.layer === 'entities') moved += step;
      }
      return { v: flown / n / 0.05, moved, flights: d!.clatters };
    };
    const calm = measure(true);
    const lively = measure(false);
    expect(calm.v).toBeLessThan(lively.v * 0.75);
    expect(calm.flights).toBeGreaterThan(0);
    expect(calm.moved).toBeGreaterThan(0);
  });

  it('lives on the studio’s oasis stage', () => {
    const stage = new Stage(dove.show!.spec, 1, 'dove', 'oasis');
    const states = new Set<string>();
    for (let i = 0; i < 3600; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const d of doves(stage.sim)) states.add(d.state);
    }
    for (const s of ['arrive', 'perch', 'clatter']) expect(states, s).toContain(s);
  });
});

describe('cost', () => {
  const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
  const parts: DoveParts = { body: sprite(), head: sprite(), tail: sprite(), fan: sprite(), leg: sprite(), flyBody: sprite(), wing: sprite(), shadow: sprite() };
  const counting = () => {
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    return { ctx: ctx as never, count: () => n };
  };

  it('composes a frame from a handful of painted parts, standing or flying', () => {
    const a = counting();
    drawDove(a.ctx, parts, { ...REST_POSE, shadow: 1 });
    expect(a.count()).toBeLessThanOrEqual(7);
    const b = counting();
    drawDove(b.ctx, parts, { ...REST_POSE, fly: true, wing: 0.5, legsDown: 1 });
    expect(b.count()).toBeLessThanOrEqual(8);
  });

  it('updates a pair cheaply', () => {
    const sim = oasisSim(2, { auto: false });
    sim.spawn('dove', { count: 2 });
    const t0 = performance.now();
    for (let i = 0; i < 6000 && doves(sim).length > 0; i++) sim.update(1 / 60, 0);
    // 6000 frames: well under a microsecond budget per frame and dove
    expect(performance.now() - t0).toBeLessThan(400);
  });
});
