import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { gardenScene } from '../../scene/geometry';
import { JAPANESE_FAUNA } from '../../scenery/japanese-garden/fauna';
import { OASIS } from '../../scenery/oasis';
import { OASIS_FAUNA } from '../../scenery/oasis/fauna';
import { OASIS_WILDLIFE } from '../../scenery/oasis/wildlife';
import { WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { distanceToPolygon, pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { Stage } from '../stage';
import saharaFrog, { croaks, floatable, floatSpot, FROG_TUNING, frogSeats, SaharaFrog } from './sahara-frog';

const plants: PlantInstance[] = [];
const ONLY = OASIS_FAUNA.filter((r) => r.kind === 'sahara-frog');

function oasisSim(seed = 4, { hour = 12, reduced = false, rows = [] as typeof ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: OASIS.geometry, seed, habitat: OASIS_WILDLIFE, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const frogs = (sim: FaunaSim) => sim.creatures.filter((c): c is SaharaFrog => c instanceof SaharaFrog);

/** A bird standing at `q` (a dove on the rim). */
const bird = (id: number, q: { x: number; y: number }, kind = 'dove') =>
  ({ id, kind, x: q.x, y: q.y, layer: 'entities', state: 'perch', done: false, visitor: true, forced: true, update() {}, draw() {}, depth: () => null, leave() {}, spot: () => q }) as never;

/** Where a frog is wrong: off its seat, afloat outside the basin, anywhere but the basin and its coping. */
function problems(sim: FaunaSim, t: number): string[] {
  const out: string[] = [];
  const pond = sim.world.pond.world;
  for (const f of frogs(sim)) {
    const at = `${f.state} at ${t.toFixed(1)} (${f.x.toFixed(1)}, ${f.y.toFixed(1)})`;
    if (f.state === 'bask') {
      const s = f.seat!;
      if (Math.abs(f.x - s.x) > s.spread + 0.01 || Math.abs(f.y - s.y) > 0.01) out.push(`off its seat: ${at}`);
      if (s.kind === 'rim' && distanceToPolygon(f, pond) > 2.5) out.push(`basking away from the water: ${at}`);
    }
    if (['float', 'paddle', 'surface', 'dive', 'under'].includes(f.state) && !pointInPolygon(f, pond)) out.push(`out of the basin: ${at}`);
  }
  return out;
}

describe('where the Sahara frog lives', () => {
  const w = oasisSim().world;

  it('sits on the near and far coping at the water’s edge and on the stair’s submerged treads; never the steep side copings', () => {
    const seats = frogSeats(w);
    const rims = seats.filter((s) => s.kind === 'rim');
    expect(rims.map((s) => s.id).sort()).toEqual(['rim-far-1', 'rim-far-2', 'rim-far-3', 'rim-near-1', 'rim-near-2', 'rim-near-3', 'rim-near-4']);
    for (const s of rims) expect(distanceToPolygon(s, w.pond.world), s.id).toBeLessThan(2);
    const steps = seats.filter((s) => s.kind === 'step');
    expect(steps).toHaveLength(2);
    for (const s of steps) {
      expect(pointInPolygon(s, w.pond.world)).toBe(true);
      expect(s.sub).toBeGreaterThan(0);
    }
    // cached: the same list while the world is the same
    expect(frogSeats(w)).toBe(seats);
  });

  it('floats only in the basin, inside its edge, off the stair; among the lilies when there are some', () => {
    const rng = createRng(7);
    for (let i = 0; i < 300; i++) {
      const q = floatSpot(w, rng, [])!;
      expect(q).not.toBeNull();
      expect(floatable(w, q)).toBe(true);
      expect(distanceToPolygon(q, w.pond.world)).toBeGreaterThanOrEqual(FROG_TUNING.margin);
    }
    const pad = { plantId: 'p', x: 760, y: 600, r: 12, scale: 0.75 };
    const lily = { ...w, pads: [pad] };
    let near = 0;
    for (let i = 0; i < 200; i++) if (Math.hypot(floatSpot(lily, rng, [])!.x - pad.x, 0) < pad.r * 1.6) near++;
    expect(near).toBeGreaterThan(80);
  });

  it('keeps off a seat a bird holds', () => {
    const sim = oasisSim(3, { auto: false });
    const rims = frogSeats(sim.world).filter((s) => s.kind === 'rim');
    // birds on every coping seat but one
    rims.slice(1).forEach((s, i) => sim.creatures.push(bird(900 + i, s)));
    for (let k = 0; k < 20; k++) {
      sim.world.t = 100 + k;
      const [f] = sim.spawn('sahara-frog') as SaharaFrog[];
      sim.update(0.05, 0);
      if (f?.seat?.kind === 'rim') expect(f.seat.id).toBe(rims[0]!.id);
      sim.creatures.splice(sim.creatures.indexOf(f!), 1);
    }
  });

  it('never comes to the Japanese garden or the waterfall: only the oasis’s table has its row', () => {
    expect(JAPANESE_FAUNA.some((r) => r.kind === 'sahara-frog')).toBe(false);
    expect(WATERFALL_WILDLIFE.unlocks.some((r) => r.kind === 'sahara-frog')).toBe(false);
    const garden = new FaunaSim({ scene: gardenScene, seed: 1 });
    garden.setGarden(plants, JAPANESE_FAUNA, () => undefined);
    garden.hourOverride = 21;
    for (let i = 0; i < 200; i++) garden.update(0.1, 0);
    expect(frogs(garden)).toHaveLength(0);
    const falls = new FaunaSim({ scene: waterfallScene, seed: 1, habitat: WATERFALL_WILDLIFE });
    falls.setGarden(plants, WATERFALL_WILDLIFE.unlocks, () => undefined);
    falls.hourOverride = 21;
    for (let i = 0; i < 200; i++) falls.update(0.1, 0);
    expect(frogs(falls)).toHaveLength(0);
  });

  it('a croak bout runs evenly and quickens a little', () => {
    const notes = croaks(6, createRng(2));
    expect(notes[0]).toBe(0);
    const gaps = notes.slice(1).map((t, i) => t - notes[i]!);
    for (const g of gaps) expect(g).toBeGreaterThan(0.1);
    expect(gaps[gaps.length - 1]!).toBeLessThan(gaps[0]!);
  });
});

describe('a day and a night in the basin', () => {
  it('by day one frog basks on the coping, floats, plops in and comes up elsewhere; after dark a chorus of three calls; only in the basin and on its coping', () => {
    const sim = oasisSim(11, { rows: ONLY });
    const bad: string[] = [];
    const states = new Set<string>();
    let mostDay = 0;
    let mostNight = 0;
    let calling = 0;
    let together = 0;
    let dayCalls = 0;
    for (let t = 0; t < 2400; t += 0.1) {
      sim.hourOverride = t < 1200 ? 12 : 22;
      sim.update(0.1, 0);
      const fs = frogs(sim);
      for (const f of fs) states.add(f.state);
      if (t > 60 && t < 1200) {
        mostDay = Math.max(mostDay, fs.filter((f) => !f.leaving).length);
        dayCalls += fs.filter((f) => f.song().calling).length;
      }
      if (t > 1300) mostNight = Math.max(mostNight, fs.length);
      const n = fs.filter((f) => f.song().calling).length;
      if (n > 0) calling++;
      if (n > 1) together++;
      if (Math.round(t * 10) % 10 === 0) bad.push(...problems(sim, t));
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(mostDay).toBe(1);
    expect(mostNight).toBe(3);
    expect(dayCalls).toBe(0);
    expect(calling).toBeGreaterThan(50);
    expect(together).toBeGreaterThan(5);
    for (const s of ['bask', 'float', 'plop', 'under', 'surface', 'paddle', 'climb']) expect(states, s).toContain(s);
    const all = frogs(sim);
    expect(all.reduce((n, f) => n + f.plops + f.surfacings, 0)).toBeGreaterThan(0);
    // at daybreak the chorus goes under, one stays
    for (let t = 0; t < 400; t += 0.1) {
      sim.hourOverride = 9;
      sim.update(0.1, 0);
    }
    expect(frogs(sim)).toHaveLength(1);
  });

  it('plops in when a bird lands near it on the coping', () => {
    const sim = oasisSim(5, { auto: false });
    let plopped = 0;
    for (let k = 0; k < 12; k++) {
      sim.clear();
      sim.world.t = 50 + k;
      sim.update(0.05, 0);
      const f = (sim.spawn('sahara-frog') as SaharaFrog[])[0]!;
      for (let i = 0; i < 4000 && f.state !== 'bask'; i++) sim.update(0.05, 0);
      if (f.state !== 'bask') continue;
      sim.creatures.push(bird(999, { x: f.x + 20, y: f.y }));
      sim.update(0.05, 0);
      if ((f.state as string) === 'plop') plopped++;
    }
    expect(plopped).toBeGreaterThan(0);
  });

  it('draws only on its own fork: other creatures’ randomness is untouched', () => {
    const a = oasisSim(5, { auto: false, hour: 22 });
    const b = oasisSim(5, { auto: false, hour: 22 });
    a.world.ripple = () => {};
    b.world.ripple = () => {};
    a.spawn('sahara-frog', { count: 3 });
    b.spawn('sahara-frog', { count: 3 });
    for (let i = 0; i < 2400; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = oasisSim(9, { auto: false, hour: 22 });
      sim.spawn('sahara-frog', { count: 3 });
      for (let i = 0; i < 2000; i++) sim.update(0.05, 0);
      return frogs(sim).map((f) => `${f.x.toFixed(2)},${f.y.toFixed(2)},${f.state},${f.bouts}`);
    };
    const first = run();
    expect(first).toHaveLength(3);
    expect(run()).toEqual(first);
  });

  it('in reduced motion: two at night, and slower', () => {
    expect(saharaFrog.resident!(1, { reduced: true, lively: false, night: true, boost: new Set() })).toBe(2);
    expect(saharaFrog.resident!(1, { reduced: false, lively: false, night: false, boost: new Set() })).toBe(1);
    expect(saharaFrog.resident!(0, { reduced: false, lively: false, night: true, boost: new Set() })).toBe(0);
    const count = (reduced: boolean) => {
      const sim = oasisSim(3, { reduced, auto: false });
      const [f] = sim.spawn('sahara-frog') as SaharaFrog[];
      for (let i = 0; i < 12000; i++) sim.update(0.05, 0);
      return f!.plops + f!.surfacings;
    };
    const calm = count(true);
    expect(calm).toBeGreaterThan(0);
    expect(calm).toBeLessThan(count(false));
  });

  it('a frog spawned mid-session is in the basin from its first frame', () => {
    const sim = oasisSim(6, { auto: false });
    sim.world.t = 30;
    for (const f of sim.spawn('sahara-frog', { count: 3 }) as SaharaFrog[]) expect(pointInPolygon(f, sim.world.pond.world)).toBe(true);
  });

  it('lives on the studio’s oasis stage', () => {
    const stage = new Stage(saharaFrog.show!.spec, 1, 'sahara-frog', 'oasis');
    const states = new Set<string>();
    for (let i = 0; i < 3600; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const f of frogs(stage.sim)) states.add(f.state);
    }
    expect(frogs(stage.sim)).toHaveLength(3);
    expect([...states].some((s) => s === 'bask' || s === 'float')).toBe(true);
  });
});

describe('cost', () => {
  it('needs nothing but the still water to be there: a cheap check, every frame in every garden', () => {
    const w = oasisSim().world;
    expect(saharaFrog.needs!(w)).toBe(true);
    const t0 = performance.now();
    for (let i = 0; i < 100000; i++) saharaFrog.needs!(w);
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it('updates a chorus cheaply', () => {
    const sim = oasisSim(2, { auto: false, hour: 22 });
    sim.spawn('sahara-frog', { count: 3 });
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(400);
  });
});
