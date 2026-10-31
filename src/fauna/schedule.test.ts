import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { JAPANESE_FAUNA } from '../scenery/japanese-garden/fauna';
import { creatureDef } from './creatures/registry';
import { rosterFor } from './roster';
import {
  CALM_MODE,
  dueVisits,
  gapScale,
  groupSize,
  isNight,
  refuseVisit,
  residentTarget,
  visitDelay,
  type Census,
  type FaunaMode,
  type Schedule,
} from './schedule';
import { FAUNA_TUNING, VISITS, type VisitorKind } from './tuning';

const empty: Census = { byKind: {}, visitors: 0 };

describe('visit delays', () => {
  it('stay inside the tuned ranges and the first visit is sooner', () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const d = visitDelay('heron', rng, CALM_MODE);
      expect(d).toBeGreaterThanOrEqual(VISITS.heron.gap[0]);
      expect(d).toBeLessThanOrEqual(VISITS.heron.gap[1]);
      expect(visitDelay('heron', rng, CALM_MODE, true)).toBeLessThanOrEqual(VISITS.heron.first[1]);
    }
  });

  it('are shorter during a session, much longer with reduced motion, shorter for birds at 25 plants', () => {
    expect(gapScale('bee', { ...CALM_MODE, lively: true })).toBeLessThan(1);
    expect(gapScale('bee', { ...CALM_MODE, reduced: true })).toBeGreaterThanOrEqual(2);
    expect(gapScale('bird', { ...CALM_MODE, boost: new Set(['bird']) })).toBeLessThan(1);
    expect(gapScale('bee', { ...CALM_MODE, boost: new Set(['bird']) })).toBe(1);
  });

  it('heron visits are rare: the quiet gap is at least a quarter of an hour', () => {
    expect(VISITS.heron.gap[0]).toBeGreaterThanOrEqual(15 * 60);
  });
});

describe('refuseVisit', () => {
  it('rests diurnal creatures at night but not leaves', () => {
    const night: FaunaMode = { ...CALM_MODE, night: true };
    expect(refuseVisit('bird', night, empty)).toBe('night');
    expect(refuseVisit('bee', night, empty)).toBe('night');
    expect(refuseVisit('butterfly', night, empty)).toBe('night');
    // night-only visitors (fireflies) are refused by day and come at night
    const nocturnal = { ...VISITS.dragonfly, diurnal: false, nocturnal: true };
    expect(refuseVisit('firefly', CALM_MODE, empty, nocturnal)).toBe('day');
    expect(refuseVisit('firefly', night, empty, nocturnal)).toBeNull();
    expect(refuseVisit('leaf', night, empty)).toBeNull();
  });

  it('caps visitors and per-kind maxima', () => {
    expect(refuseVisit('bee', CALM_MODE, { byKind: {}, visitors: FAUNA_TUNING.maxVisitors })).toBe('cap');
    expect(refuseVisit('heron', CALM_MODE, { byKind: { heron: 1 }, visitors: 1 })).toBe('kind-max');
    expect(refuseVisit('leaf', CALM_MODE, { byKind: {}, visitors: 99 })).toBeNull();
  });

  it('reduced motion allows one visitor and no swallows', () => {
    const reduced: FaunaMode = { ...CALM_MODE, reduced: true };
    expect(refuseVisit('swallow', reduced, empty)).toBe('mode');
    expect(refuseVisit('bee', reduced, { byKind: { bird: 1 }, visitors: 1 })).toBe('cap');
  });

  it('isNight follows the tuned hours', () => {
    expect(isNight(23)).toBe(true);
    expect(isNight(2)).toBe(true);
    expect(isNight(13)).toBe(false);
  });
});

describe('groupSize', () => {
  it('never exceeds the room left', () => {
    const rng = createRng(4);
    for (let i = 0; i < 40; i++) {
      const n = groupSize('bee', rng, CALM_MODE, { byKind: { bee: 1 }, visitors: 2 });
      expect(n).toBeLessThanOrEqual(1);
      expect(groupSize('swallow', rng, { ...CALM_MODE, reduced: true }, empty)).toBeLessThanOrEqual(1);
    }
  });
});

describe('dueVisits', () => {
  const run = (enabled: VisitorKind[], seconds: number, mode = CALM_MODE, census = empty) => {
    const rng = createRng(9);
    const schedule: Schedule = new Map();
    const visits: { t: number; kind: VisitorKind }[] = [];
    for (let t = 0; t <= seconds; t += 1) for (const k of dueVisits(schedule, t, new Set(enabled), mode, census, rng)) visits.push({ t, kind: k });
    return { visits, schedule };
  };

  it('nothing comes at once; the first visit comes within the first-visit window', () => {
    const { visits } = run(['dragonfly'], 400);
    expect(visits[0]!.t).toBeGreaterThanOrEqual(VISITS.dragonfly.first[0]);
    expect(visits[0]!.t).toBeLessThanOrEqual(VISITS.dragonfly.first[1] + 1);
  });

  it('later visits are separated by long quiet gaps', () => {
    const { visits } = run(['bird'], 4000);
    for (let i = 1; i < visits.length; i++) expect(visits[i]!.t - visits[i - 1]!.t).toBeGreaterThanOrEqual(VISITS.bird.gap[0] - 1);
    expect(visits.length).toBeGreaterThan(5);
  });

  it('reduced motion makes visits far rarer', () => {
    const calm = run(['bee'], 6000).visits.length;
    const reduced = run(['bee'], 6000, { ...CALM_MODE, reduced: true }).visits.length;
    expect(reduced).toBeLessThan(calm / 2);
  });

  it('blocked visits are retried, not dropped, and disabled kinds are forgotten', () => {
    const rng = createRng(2);
    const schedule: Schedule = new Map();
    const full: Census = { byKind: {}, visitors: FAUNA_TUNING.maxVisitors };
    dueVisits(schedule, 0, new Set(['bee']), CALM_MODE, full, rng);
    const due = schedule.get('bee')!;
    expect(dueVisits(schedule, due, new Set(['bee']), CALM_MODE, full, rng)).toEqual([]);
    expect(schedule.get('bee')!).toBeGreaterThan(due);
    expect(schedule.get('bee')! - due).toBeLessThanOrEqual(FAUNA_TUNING.retry[1]);
    expect(dueVisits(schedule, due + 100, new Set(['bee']), CALM_MODE, empty, rng)).toEqual(['bee']);
    dueVisits(schedule, due + 101, new Set(), CALM_MODE, empty, rng);
    expect(schedule.has('bee')).toBe(false);
  });

  it('does not admit more visitors than the cap in one step', () => {
    const rng = createRng(5);
    const schedule: Schedule = new Map([
      ['bee', 0],
      ['bird', 0],
      ['butterfly', 0],
      ['dragonfly', 0],
    ]);
    const out = dueVisits(schedule, 1, new Set(['bee', 'bird', 'butterfly', 'dragonfly']), CALM_MODE, empty, rng);
    expect(out.length).toBe(FAUNA_TUNING.maxVisitors);
  });
});

describe('roster (unlocked rows → active set)', () => {
  const rows = (...ids: string[]) => JAPANESE_FAUNA.filter((f) => ids.includes(f.id));

  it('maps the unlock table onto residents and visitors', () => {
    const all = rosterFor(JAPANESE_FAUNA);
    expect(Object.fromEntries(all.residents)).toEqual({ strider: 1, koi: 3, frog: 1 });
    expect([...all.boosts]).toEqual(['bird']);
    expect([...all.visitors]).toEqual(['dragonfly', 'butterfly', 'bee', 'bird', 'swallow', 'heron', 'leaf']);
    expect(all.variants.size).toBe(0);
  });

  it('a new garden only has striders and leaves', () => {
    const r = rosterFor(rows('striders', 'leaf'));
    expect(r.residents.get('koi')).toBeUndefined();
    expect([...r.visitors]).toEqual(['leaf']);
    expect(rosterFor(rows('striders', 'dragonfly', 'koi-1')).residents.get('koi')).toBe(1);
  });

  it('every Japanese garden row names a creature module', () => {
    for (const f of JAPANESE_FAUNA) expect(creatureDef(f.kind), f.id).toBeDefined();
  });

  it('skips rows whose creature module does not exist yet, and gathers variants per kind in row order', () => {
    const r = rosterFor([
      { kind: 'not-painted-yet', variant: 'one' },
      { kind: 'dragonfly', variant: 'aka' },
      { kind: 'koi', variant: 'kohaku' },
      { kind: 'koi', variant: 'showa' },
      { kind: 'unicorn' },
    ]);
    expect([...r.visitors]).toEqual(['dragonfly']);
    expect(Object.fromEntries(r.residents)).toEqual({ koi: 2 });
    expect(Object.fromEntries(r.variants)).toEqual({ dragonfly: ['aka'], koi: ['kohaku', 'showa'] });
  });

  it('resident targets', () => {
    expect(residentTarget('strider', 1, CALM_MODE)).toBe(FAUNA_TUNING.striders);
    expect(residentTarget('strider', 1, { ...CALM_MODE, reduced: true })).toBe(1);
    expect(residentTarget('koi', 2, CALM_MODE)).toBe(2);
  });
});
