import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { FOAM, WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { dist, pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { fallsStage } from '../stage';
import type { Creature } from '../types';
import { Dipper } from './dipper';
import { boutNotes, chooseSeat, edgePoint, Kajika, KAJIKA_TUNING, kajikaSeats, kajikaWaters, sacAt, seatY, swimmable } from './kajika';

const inFoam = (p: { x: number; y: number }) => ((p.x - FOAM.x) / FOAM.rx) ** 2 + ((p.y - FOAM.y) / FOAM.ry) ** 2 < 0.97;
const plants: PlantInstance[] = [];
const ONLY_KAJIKA = WATERFALL_FAUNA.filter((r) => r.kind === 'kajika');

function waterfallSim(seed = 4, { hour = 22, reduced = false, rows = ONLY_KAJIKA } = {}) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: reduced });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const frogs = (sim: FaunaSim) => sim.creatures.filter((c): c is Kajika => c instanceof Kajika);

/** A bird that stands still where it is put (for the alarm tests). */
function standIn(kind: string, x: number, y: number): Creature {
  return { id: 9999, kind, x, y, layer: 'entities', state: 'stand', done: false, visitor: false, forced: true, update() {}, draw() {}, depth: () => null, leave() {} };
}

describe('where the kajika sits', () => {
  const w = waterfallSim().world;
  const seats = kajikaSeats(w);
  const waters = kajikaWaters(w);

  it('sits on the wet stones in and by the water, never on a cliff ledge, all in view', () => {
    expect(seats.length).toBeGreaterThanOrEqual(4);
    const ids = seats.map((s) => s.id);
    expect(ids).toContain('rock-outflow');
    expect(ids).toContain('rock-stream');
    expect(ids.some((id) => id.startsWith('ledge'))).toBe(false);
    // a boulder the birds never use but the frog can: the stream bank
    expect(ids).toContain('rock-stream-bank');
    for (const s of seats) {
      expect(s.x).toBeGreaterThan(w.view.x);
      expect(s.x).toBeLessThan(w.view.x + w.view.w);
      expect(seatY(s, s.x)).toBeLessThan(s.depth);
    }
  });

  it('gets into the water at each stone’s foot, beside or in front of it, never in the foam', () => {
    const rng = createRng(3);
    for (const s of seats) {
      for (let i = 0; i < 12; i++) {
        const e = edgePoint(s, waters, rng);
        expect(e, s.id).not.toBeNull();
        expect(inFoam(e!)).toBe(false);
        if (e!.y < s.depth - 2) expect(Math.abs(e!.x - s.x)).toBeGreaterThan(s.spread * 3);
      }
    }
  });

  it('swims only where the water goes the whole way', () => {
    expect(swimmable({ x: 700, y: 660 }, { x: 900, y: 680 }, waters)).toBe(true);
    expect(swimmable({ x: 700, y: 660 }, { x: 700, y: 900 }, waters)).toBe(false);
  });

  it('picks another free stone, never the one it is on', () => {
    const rng = createRng(5);
    const from = seats[0]!;
    const taken = [{ x: seats[1]!.x, y: seats[1]!.y }];
    for (let i = 0; i < 200; i++) {
      const s = chooseSeat(seats, from, rng, from, taken)!;
      expect(s.id).not.toBe(from.id);
      expect(s.id).not.toBe(seats[1]!.id);
    }
    expect(chooseSeat(seats.slice(0, 1), from, rng, from, [])).toBeNull();
  });
});

describe('its song', () => {
  it('sings a rhythmic series whose notes come faster toward the end (a trill)', () => {
    const t = boutNotes(10);
    expect(t).toHaveLength(10);
    const gaps = t.slice(1).map((v, i) => v - t[i]!);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThan(gaps[i - 1]!);
    expect(gaps[0]).toBeCloseTo(KAJIKA_TUNING.gap[0], 2);
  });

  it('swells the throat with each note and lets it go after the last', () => {
    const t = boutNotes(8);
    expect(sacAt(-0.1, t)).toBe(0);
    expect(sacAt(t[0]! + 0.14, t)).toBeGreaterThan(0.9);
    // between the first slow notes it nearly empties
    expect(sacAt(t[0]! + 0.5, t)).toBeLessThan(0.15);
    expect(sacAt(t[7]! + 2, t)).toBe(0);
  });
});

describe('the kajika at the waterfall', () => {
  it('is there from the start, on a stone, one resident, day and night', () => {
    for (const hour of [12, 22]) {
      const sim = waterfallSim(4, { hour });
      sim.update(0.1, 0);
      const f = frogs(sim);
      expect(f).toHaveLength(1);
      expect(f[0]!.state).toBe('sit');
      expect(f[0]!.visitor).toBe(false);
      expect(f[0]!.layer).toBe('entities');
    }
  });

  it('over 30 minutes of night it sings, hops or swims to other stones, and is always on a stone or in the water', () => {
    const sim = waterfallSim(7);
    const seen = new Set<string>();
    const problems: string[] = [];
    const waters = kajikaWaters(sim.world);
    const onWater = (p: { x: number; y: number }) => waters.some((poly) => pointInPolygon(p, poly));
    const stones = new Set<string>();
    for (let s = 0; s < 30 * 60 * 10; s++) {
      sim.update(0.1, 0);
      for (const f of frogs(sim)) {
        seen.add(f.state);
        if (f.seat && (f.state === 'sit' || f.state === 'call')) {
          stones.add(f.seat.id);
          if (Math.abs(f.y - seatY(f.seat, f.x)) > 0.01) problems.push(`off its stone at ${f.x | 0},${f.y | 0}`);
        }
        if (f.state === 'swim' && (!onWater(f) || inFoam(f))) problems.push(`swimming on land or in the foam at ${f.x | 0},${f.y | 0}`);
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) problems.push('not finite');
      }
      if (frogs(sim).length > 1) problems.push('two frogs');
    }
    expect(problems.slice(0, 5)).toEqual([]);
    for (const st of ['sit', 'call', 'leap', 'swim', 'climb']) expect(seen, st).toContain(st);
    expect(stones.size).toBeGreaterThan(1);
    expect(frogs(sim)[0]!.song().bouts).toBeGreaterThan(60);
  });

  it('sings far more at night than by day, and by day it sometimes hides under a stone', () => {
    const run = (hour: number) => {
      const sim = waterfallSim(3, { hour });
      let under = 0;
      for (let s = 0; s < 40 * 60 * 10; s++) {
        sim.update(0.1, 0);
        if (frogs(sim)[0]?.state === 'under') under++;
      }
      return { bouts: frogs(sim)[0]!.song().bouts, under };
    };
    const day = run(12);
    const night = run(22);
    expect(night.bouts).toBeGreaterThan(day.bouts * 4);
    expect(day.bouts).toBeGreaterThan(0);
    expect(day.under).toBeGreaterThan(0);
  });

  it('freezes when a heron comes near and stops singing; dives when one is close; comes back when it has gone', () => {
    const sim = waterfallSim(2);
    sim.update(0.1, 0);
    const f = frogs(sim)[0]!;
    const heron = standIn('heron', f.x + 150, f.y);
    (sim.creatures as Creature[]).push(heron);
    for (let s = 0; s < 10; s++) sim.update(0.1, 0);
    expect(f.state).toBe('freeze');
    for (let s = 0; s < 600; s++) sim.update(0.1, 0);
    expect(f.song().calling).toBe(false);
    expect(f.state).toBe('freeze');
    heron.x = f.x + 60;
    for (let s = 0; s < 30; s++) sim.update(0.1, 0);
    expect(['leap', 'under']).toContain(f.state);
    heron.done = true;
    const back = new Set<string>();
    for (let s = 0; s < 3000; s++) {
      sim.update(0.1, 0);
      back.add(f.state);
    }
    expect(back).toContain('sit');
  });

  it('keeps off a stone the dipper holds (and the dipper off its stone)', () => {
    const sim = waterfallSim(5, { hour: 12, rows: WATERFALL_FAUNA.filter((r) => r.kind === 'kajika' || r.kind === 'dipper') });
    const problems: string[] = [];
    for (let s = 0; s < 30 * 60 * 10; s++) {
      sim.update(0.1, 0);
      const f = frogs(sim)[0];
      const d = sim.creatures.find((c): c is Dipper => c instanceof Dipper);
      if (!f?.seat || !d?.perch || d.state !== 'perch' || !['sit', 'call', 'freeze'].includes(f.state)) continue;
      if (dist(f.seat, d.perch) < 22) problems.push(`shares ${f.seat.id} with the dipper at ${sim.world.t | 0}s`);
    }
    expect(problems.slice(0, 3)).toEqual([]);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const sim = waterfallSim(11);
      for (let s = 0; s < 4000; s++) sim.update(0.1, 0);
      return frogs(sim).map((f) => `${f.state}:${f.x.toFixed(2)},${f.y.toFixed(2)}:${f.song().bouts}`);
    };
    expect(run()).toEqual(run());
  });

  it('is slower with reduced motion but still sings and moves', () => {
    const count = (reduced: boolean) => {
      const sim = waterfallSim(7, { reduced });
      const seen = new Set<string>();
      for (let s = 0; s < 30 * 60 * 10; s++) {
        sim.update(0.1, 0);
        for (const f of frogs(sim)) seen.add(f.state);
      }
      return { bouts: frogs(sim)[0]!.song().bouts, seen };
    };
    const calm = count(true);
    expect(calm.bouts).toBeLessThan(count(false).bouts);
    expect(calm.seen).toContain('call');
    expect(calm.seen).toContain('swim');
  });
});

describe('the kajika on the studio’s falls stage', () => {
  it('finds a stone by the water and a way into it', () => {
    const { scene, habitat } = fallsStage({ w: 300, h: 190 });
    const w = { pond: { world: habitat.water!.still }, water: { moving: habitat.water!.moving, clip: [] }, perches: habitat.perches!, scene, view: { x: 0, y: 0, w: 300, h: 190 } };
    const seats = kajikaSeats(w as never);
    expect(seats.length).toBeGreaterThan(0);
    expect(edgePoint(seats[0]!, kajikaWaters(w as never), createRng(2))).not.toBeNull();
  });
});
