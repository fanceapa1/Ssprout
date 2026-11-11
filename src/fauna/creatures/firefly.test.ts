import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import { WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { FaunaSim } from '../sim';
import { fallsStage } from '../stage';
import { visitTuning } from '../schedule';
import firefly, { chooseRest, Firefly, FIREFLY_TUNING, flash, flightPoint, nearFoam, orderOf, overFlightWater, restSpots, syncStep } from './firefly';

const ONLY = WATERFALL_FAUNA.filter((r) => r.kind === 'firefly');

function waterfallSim(seed = 3, { hour = 22, reduced = false } = {}) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: reduced });
  sim.setGarden([], ONLY, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const swarms = (sim: FaunaSim) => sim.creatures.filter((c): c is Firefly => c instanceof Firefly);

function run(sim: FaunaSim, seconds: number, each?: (t: number) => void) {
  for (let t = 0; t < seconds; t += 1 / 15) {
    sim.update(1 / 15, 0);
    each?.(t);
  }
}

// every garden's creatures (ADR 0346)
await loadAllCreatures();

describe('the flash', () => {
  it('swells, fades and goes dark once a cycle', () => {
    expect(flash(0)).toBe(0);
    expect(flash(0.22)).toBeCloseTo(1, 5);
    expect(flash(0.1)).toBeGreaterThan(0.3);
    expect(flash(0.4)).toBeGreaterThan(0);
    expect(flash(0.4)).toBeLessThan(flash(0.25));
    expect(flash(0.7)).toBe(0);
    expect(flash(1.22)).toBeCloseTo(1, 5);
  });

  it('pulls scattered phases into step, but never quite into one', () => {
    const rng = createRng(5);
    const phases = Array.from({ length: 14 }, () => rng.next());
    const rates = phases.map(() => 1 / rng.range(...FIREFLY_TUNING.period));
    const before = orderOf(phases).r;
    for (let i = 0; i < 60 * 15; i++) syncStep(phases, rates, 1 / 15, FIREFLY_TUNING.coupling, FIREFLY_TUNING.wander, rng);
    const after = orderOf(phases).r;
    expect(before).toBeLessThan(0.5);
    expect(after).toBeGreaterThan(0.8);
    expect(after).toBeLessThan(0.999);
  });
});

describe('where they fly and rest', () => {
  const w = waterfallSim().world;

  it('flies over the stream and the pool margin, never the foam', () => {
    const rng = createRng(2);
    let stream = 0;
    for (let i = 0; i < 300; i++) {
      const q = flightPoint(w, rng)!;
      expect(q).not.toBeNull();
      expect(nearFoam(q, w)).toBe(false);
      expect(overFlightWater(q, w)).toBe(true);
      if (w.water.moving.some((m) => m.length > 2 && insidePoly(q, m))) stream++;
    }
    expect(stream).toBeGreaterThan(60);
  });

  it('rests on the bank, plants and wet rocks by the water, clear of the foam and in view', () => {
    const spots = restSpots(w);
    expect(spots.filter((s) => s.kind === 'bank').length).toBeGreaterThanOrEqual(8);
    expect(spots.some((s) => s.kind === 'rock')).toBe(true);
    for (const s of spots) {
      expect(nearFoam({ x: s.x, y: s.g }, w, 1.2), s.id).toBe(false);
      expect(s.g, `${s.id} up on the cliff`).toBeGreaterThanOrEqual(w.pond.bounds.y);
      expect(s.x).toBeGreaterThan(w.view.x);
      expect(s.x).toBeLessThan(w.view.x + w.view.w);
    }
    const rng = createRng(1);
    const a = chooseRest(spots, w.pond.centre, rng, [])!;
    const b = chooseRest(spots, w.pond.centre, rng, [a]);
    expect(b && b.id).not.toBe(a.id);
  });
});

function insidePoly(p: { x: number; y: number }, poly: readonly { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

describe('a night of fireflies', () => {
  it('is night only: refused by day, comes after dark', () => {
    const t = visitTuning('firefly');
    expect(t.nocturnal).toBe(true);
    expect(t.diurnal).toBe(false);
    expect(t.visitor).toBe(false);
    const day = waterfallSim(3, { hour: 13 });
    run(day, 600);
    expect(swarms(day)).toHaveLength(0);
    const night = waterfallSim(3, { hour: 22 });
    run(night, 200);
    expect(swarms(night)).toHaveLength(1);
  });

  it('5 to 20 lights drift low over the water, breathe, fall into step and rest on the bank', () => {
    const sim = waterfallSim(7);
    sim.spawn('firefly');
    const f = swarms(sim)[0]!;
    const w = sim.world;
    expect(f.lights.length).toBeGreaterThanOrEqual(5);
    expect(f.lights.length).toBeLessThanOrEqual(20);
    const problems: string[] = [];
    let rested = 0;
    let flew = 0;
    let lit = 0;
    let dark = 0;
    const orders: number[] = [];
    const off: number[] = [];
    run(sim, 600, (t) => {
      f.lights.forEach((L, i) => {
        if (L.state === 'wait' || L.state === 'out') return;
        if (nearFoam(L.g, w)) problems.push(`foam ${t.toFixed(1)} ${L.g.x.toFixed(0)},${L.g.y.toFixed(0)}`);
        // in flight it keeps over the water; leaving a bank plant it crosses back within seconds
        off[i] = L.state === 'fly' && !overFlightWater(L.g, w, 16) ? (off[i] ?? 0) + 1 / 15 : 0;
        if (off[i]! > 12) problems.push(`off the water ${t.toFixed(1)} ${L.g.x.toFixed(0)},${L.g.y.toFixed(0)}`);
        if (L.state === 'fly' && (L.h < 0 || L.h > 30)) problems.push(`height ${L.h.toFixed(1)}`);
        if (L.state === 'rest') rested++;
        if (L.state === 'fly') flew++;
        const b = f.brightness(i, w);
        if (b > 0.7) lit++;
        if (b < 0.15) dark++;
      });
      if (t > 60) orders.push(orderOf(f.phases).r);
    });
    expect(problems.slice(0, 5)).toEqual([]);
    expect(rested).toBeGreaterThan(0);
    expect(flew).toBeGreaterThan(rested * 0.5);
    expect(lit).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(0);
    expect(orders.reduce((a, b) => a + b, 0) / orders.length).toBeGreaterThan(0.7);
    // slow: no light moves faster than a drift
    expect(Math.max(...f.lights.map((L) => Math.hypot(L.vel.x, L.vel.y)))).toBeLessThan(15);
  });

  it('a swarm spawned by hand stays by day (dev, studio)', () => {
    const sim = waterfallSim(4, { hour: 12 });
    sim.spawn('firefly');
    run(sim, 120);
    expect(swarms(sim)).toHaveLength(1);
    expect(swarms(sim)[0]!.state).not.toBe('leave');
  });

  it('goes dark at daybreak, one by one', () => {
    const sim = waterfallSim(4);
    run(sim, 200);
    expect(swarms(sim)).toHaveLength(1);
    sim.hourOverride = 6;
    run(sim, 10);
    const f = swarms(sim)[0];
    expect(f?.state).toBe('leave');
    run(sim, 90);
    expect(swarms(sim)).toHaveLength(0);
  });

  it('is deterministic, and draws from its own stream', () => {
    const pos = (seed: number) => {
      const sim = waterfallSim(seed);
      sim.spawn('firefly');
      run(sim, 120);
      return swarms(sim)[0]!.lights.map((L) => `${L.g.x.toFixed(2)},${L.g.y.toFixed(2)},${L.state}`).join(' ');
    };
    expect(pos(9)).toBe(pos(9));
    expect(pos(9)).not.toBe(pos(10));
    const before = waterfallSim(9).world.rng.next();
    const w = waterfallSim(9).world;
    firefly.spawn(w, { count: 1, index: 0, seed: 1, stay: 900, variants: [] });
    expect(w.rng.next()).toBe(before);
  });

  it('in reduced motion: fewer lights, slower, breathing gently and never dark', () => {
    const sim = waterfallSim(7, { reduced: true });
    sim.spawn('firefly');
    const f = swarms(sim)[0]!;
    expect(f.lights.length).toBeLessThanOrEqual(FIREFLY_TUNING.reducedLights[1]);
    let min = 1;
    let max = 0;
    let fastest = 0;
    let last = f.lights.map((L) => ({ ...L.g }));
    let frame = 0;
    run(sim, 300, (t) => {
      // ground speed over whole seconds
      if (++frame % 15 === 0) {
        const now = f.lights.map((L) => ({ ...L.g }));
        now.forEach((p, i) => (fastest = Math.max(fastest, Math.hypot(p.x - last[i]!.x, p.y - last[i]!.y))));
        last = now;
      }
      if (t < 40) return;
      f.lights.forEach((L, i) => {
        if (L.state === 'wait' || L.state === 'out' || L.on < 1) return;
        const b = f.brightness(i, sim.world);
        min = Math.min(min, b);
        max = Math.max(max, b);
      });
    });
    expect(min).toBeGreaterThanOrEqual(0.35);
    expect(max).toBeLessThanOrEqual(0.85);
    expect(fastest).toBeLessThan(FIREFLY_TUNING.speed[1] * 0.75);
  });

  it('lives on the studio falls stage too', () => {
    const { scene, habitat } = fallsStage({ w: 420, h: 266 });
    const sim = new FaunaSim({ scene, seed: 2, habitat, view: { x: 0, y: 0, w: 420, h: 266 } });
    sim.setGarden([], ONLY, () => undefined);
    sim.hourOverride = 22;
    sim.spawn('firefly');
    run(sim, 60);
    const f = swarms(sim)[0]!;
    expect(f.lights.some((L) => L.state === 'fly' || L.state === 'rest')).toBe(true);
    expect(restSpots(sim.world).length).toBeGreaterThan(0);
  });
});
