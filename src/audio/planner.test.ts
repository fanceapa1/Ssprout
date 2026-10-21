import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { EVENT_KINDS, type EventKind } from './params';
import { createPlanner, MAX_VOICES, MIN_GAP_S, PAN_SPREAD, type PlannedEvent } from './planner';

const rates = (patch: Partial<Record<EventKind, number>>): Record<EventKind, number> => ({
  ...(Object.fromEntries(EVENT_KINDS.map((k) => [k, 0])) as Record<EventKind, number>),
  ...patch,
});

/** Run the planner for `seconds` in `dt` steps. */
function simulate(r: Record<EventKind, number>, seconds: number, seed: number | string = 1, dt = 0.25) {
  const planner = createPlanner({ rng: createRng(seed) });
  const events: (PlannedEvent & { abs: number })[] = [];
  let now = 0;
  while (now < seconds) {
    now += dt;
    for (const e of planner.step(dt, r, now)) events.push({ ...e, abs: now - dt + e.at });
  }
  return { planner, events };
}

describe('planner', () => {
  it('is deterministic for a seed', () => {
    const r = rates({ chirp: 10, plip: 5 });
    expect(simulate(r, 120, 'a').events).toEqual(simulate(r, 120, 'a').events);
    expect(simulate(r, 120, 'a').events).not.toEqual(simulate(r, 120, 'b').events);
  });

  it('fires nothing when every rate is zero or dt is not positive', () => {
    expect(simulate(rates({}), 600).events).toEqual([]);
    const p = createPlanner({ rng: createRng(1) });
    expect(p.step(0, rates({ chirp: 1000 }), 0)).toEqual([]);
    expect(p.step(-1, rates({ chirp: 1000 }), 0)).toEqual([]);
  });

  it('matches the requested rate on average', () => {
    const { events } = simulate(rates({ plip: 6 }), 3600, 7);
    // 6/min for an hour = 360, minus a few dropped by the minimum gap
    expect(events.length).toBeGreaterThan(300);
    expect(events.length).toBeLessThan(400);
  });

  it('does not depend on the step size (Poisson process)', () => {
    const coarse = simulate(rates({ chirp: 4 }), 3600, 3, 1).events.length;
    const fine = simulate(rates({ chirp: 4 }), 3600, 3, 0.1).events.length;
    expect(Math.abs(coarse - fine)).toBeLessThan(40);
  });

  it('keeps offsets inside the step and orders them', () => {
    const planner = createPlanner({ rng: createRng(2) });
    const out = planner.step(1, rates({ plip: 60, chirp: 60, cricket: 60 }), 1);
    for (const e of out) {
      expect(e.at).toBeGreaterThanOrEqual(0);
      expect(e.at).toBeLessThan(1);
    }
    expect(out.map((e) => e.at)).toEqual([...out.map((e) => e.at)].sort((a, b) => a - b));
  });

  it('never exceeds the concurrent voice budget', () => {
    const { events } = simulate(rates({ plip: 200, chirp: 200, cricket: 200, swallow: 200, drip: 200 }), 120, 5);
    for (const e of events) {
      const sounding = events.filter((o) => o.kind !== 'gust' && o.abs <= e.abs && o.abs + o.duration > e.abs);
      expect(sounding.length).toBeLessThanOrEqual(MAX_VOICES);
    }
  });

  it('respects per-kind minimum gaps (the warbler stays rare)', () => {
    const { events } = simulate(rates({ warbler: 100 }), 600, 9);
    const times = events.map((e) => e.abs);
    expect(times.length).toBeGreaterThan(0);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(MIN_GAP_S.warbler);
  });

  it('gusts do not use the voice budget', () => {
    const planner = createPlanner({ rng: createRng(4), maxVoices: 0 });
    let gusts = 0;
    for (let t = 1; t <= 600; t++) {
      const out = planner.step(1, rates({ gust: 6, chirp: 60 }), t);
      expect(out.every((e) => e.kind === 'gust')).toBe(true);
      gusts += out.length;
    }
    expect(gusts).toBeGreaterThan(10);
  });

  it('pans within each kind’s spread and gives every event its own seed', () => {
    const { events } = simulate(rates({ plip: 20, chirp: 20 }), 600, 11);
    for (const e of events) expect(Math.abs(e.pan)).toBeLessThanOrEqual(PAN_SPREAD[e.kind]);
    expect(new Set(events.map((e) => e.seed)).size).toBe(events.length);
  });
});
