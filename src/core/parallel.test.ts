import { describe, expect, it } from 'vitest';
import type { Habitat, SizeClass, Tier } from '../plants/types';
import { compatibleSlots, freeSlotIds } from './placement';
import { findPlan, type StudyPlan } from './plans';
import { dueFocusWaterings, elapsedMs, focusWateringTimes, isLongPause, sessionPhase, sessionTimeline } from './session';
import {
  canStartSession,
  createDefaultState,
  createReducer,
  heldSlotIds,
  inProgressSessions,
  lastLeftSession,
  MAX_SESSIONS,
  type Action,
  type GardenState,
  type ReducerWorld,
} from './state';
import { makePlant, MIN, plan, T0 } from './testing';

/**
 * Parallel sessions in the pure reducer (SPEC §2 › Parallel sessions, ADRs 0150–0152): up to three
 * in progress, exactly one active; starting or switching pauses the active one; paused time never
 * counts; cancel / complete leave the others as they are.
 */

const SPECIES: Record<string, { habitats: Habitat[]; sizeClass: SizeClass; tier: Tier }> = {
  violet: { habitats: ['meadow', 'rock'], sizeClass: 'small', tier: 1 },
  iris: { habitats: ['shore'], sizeClass: 'medium', tier: 2 },
};
const SLOT_LIST = [
  { id: 'meadow-1', habitat: 'meadow' as Habitat, maxSize: 'large' as SizeClass },
  { id: 'meadow-2', habitat: 'meadow' as Habitat, maxSize: 'large' as SizeClass },
  { id: 'meadow-3', habitat: 'meadow' as Habitat, maxSize: 'large' as SizeClass },
  { id: 'meadow-4', habitat: 'meadow' as Habitat, maxSize: 'large' as SizeClass },
  { id: 'shore-1', habitat: 'shore' as Habitat, maxSize: 'medium' as SizeClass },
];
const world: ReducerWorld = { getSpecies: (id) => SPECIES[id], getSlot: (sc, id) => (sc === 'japanese-garden' ? SLOT_LIST.find((s) => s.id === id) : undefined) };
const reducer = createReducer(world);
const run = (state: GardenState, ...actions: Action[]): GardenState => actions.reduce(reducer, state);
const at = (min: number) => T0 + min * MIN;

const start = (id: string, slotId: string, min: number, over: Partial<Extract<Action, { type: 'session/start' }>> = {}): Action => ({
  type: 'session/start',
  id,
  taskName: `Task ${id}`,
  goalMinutes: 25,
  plan: findPlan(25, 'unbroken') as StudyPlan,
  speciesId: 'violet',
  slotId,
  seed: id.length * 1000 + 7,
  now: at(min),
  weather: 'sun',
  ...over,
});
const switchTo = (id: string, min: number): Action => ({ type: 'session/switch', id, now: at(min) });

/** a at 0, b at 5 (a waits), c at 10 (b waits) */
const three = () => run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5), start('c', 'meadow-3', 10));

describe('starting while another session is in progress', () => {
  it('makes the new session the active one and pauses the previous one at that moment', () => {
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5));
    expect(s.session?.id).toBe('b');
    expect(s.waiting.map((w) => w.id)).toEqual(['a']);
    expect(s.waiting[0]!.pausedAt).toBe(at(5));
    expect(elapsedMs(s.waiting[0]!, at(60))).toBe(5 * MIN); // its clock stopped at the switch
    expect(inProgressSessions(s).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('keeps a session the gardener had already paused as it was (its pause began earlier)', () => {
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0), { type: 'session/pause', now: at(3) }, start('b', 'meadow-2', 9));
    expect(s.waiting[0]!.pausedAt).toBe(at(3));
    expect(elapsedMs(s.waiting[0]!, at(30))).toBe(3 * MIN);
  });

  it('allows up to three in progress; a fourth start changes nothing', () => {
    const s = three();
    expect(MAX_SESSIONS).toBe(3);
    expect(inProgressSessions(s)).toHaveLength(3);
    expect(canStartSession(s)).toBe(false);
    expect(reducer(s, start('d', 'meadow-4', 12))).toBe(s);
    // also when none of them is active (all three waiting)
    const allWaiting = run(s, { type: 'session/pause', now: at(11) });
    expect(reducer(allWaiting, start('d', 'meadow-4', 12))).toBe(allWaiting);
  });

  it('treats the spots of sessions in progress as occupied: no second seedling in them, not even as a swap', () => {
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5));
    expect(heldSlotIds(s, 'japanese-garden')).toEqual(new Set(['meadow-1', 'meadow-2']));
    expect(reducer(s, start('c', 'meadow-1', 6))).toBe(s); // a waits there
    expect(reducer(s, start('c', 'meadow-2', 6))).toBe(s); // b grows there
    const withPlant = { ...s, plants: [makePlant({ id: 'p', slotId: 'meadow-3' })] };
    const opts = compatibleSlots(SPECIES.violet!, SLOT_LIST, withPlant.plants, heldSlotIds(withPlant, 'japanese-garden'));
    expect(opts.map((o) => o.slot.id)).toEqual(['meadow-3', 'meadow-4']);
    expect(opts[0]!.occupiedBy?.id).toBe('p'); // a finished plant is still a swap
    expect(freeSlotIds(SLOT_LIST, withPlant.plants, heldSlotIds(withPlant, 'japanese-garden'))).toEqual(['meadow-4', 'shore-1']);
  });

  it('never reuses an id of a session in progress or in the log', () => {
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0));
    expect(reducer(s, start('a', 'meadow-2', 1))).toBe(s);
    const cancelled = run(s, { type: 'session/cancel', now: at(2) });
    expect(reducer(cancelled, start('a', 'meadow-2', 3))).toBe(cancelled);
  });
});

describe('session/switch', () => {
  it('pauses the active session and resumes the chosen one; paused time counts for neither', () => {
    // a runs 0–5, waits 5–20, runs again from 20
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5), switchTo('a', 20));
    expect(s.session?.id).toBe('a');
    expect(s.session!.pausedAt).toBeNull();
    expect(s.session!.pausedTotalMs).toBe(15 * MIN);
    expect(elapsedMs(s.session!, at(30))).toBe(15 * MIN);
    // b ran 5–20 and is now waiting
    expect(s.waiting.map((w) => w.id)).toEqual(['b']);
    expect(s.waiting[0]!.pausedAt).toBe(at(20));
    expect(elapsedMs(s.waiting[0]!, at(90))).toBe(15 * MIN);
  });

  it('each session keeps its own plant, spot, plan position, watering state and pause time', () => {
    const pom = findPlan(60, 'pomodoro') as StudyPlan;
    let s = run(createDefaultState(T0), start('a', 'meadow-1', 0, { goalMinutes: 60, plan: pom }));
    const firstFocus = pom.blocks[0]!.minutes;
    s = run(s, { type: 'session/water', blockIndex: 1, now: at(firstFocus + 1) }); // in a's break
    s = run(s, start('b', 'shore-1', firstFocus + 2, { speciesId: 'iris' }));
    s = run(s, switchTo('a', firstFocus + 30));
    expect(s.session).toMatchObject({ id: 'a', slotId: 'meadow-1', speciesId: 'violet', waterings: [1] });
    expect(sessionTimeline(s.session!, at(firstFocus + 30)).elapsedMs).toBe((firstFocus + 2) * MIN);
    expect(s.waiting[0]).toMatchObject({ id: 'b', slotId: 'shore-1', speciesId: 'iris', waterings: [], pausedAt: at(firstFocus + 30) });
  });

  it('with no active session (after one bloomed) it resumes the chosen one and nothing else changes', () => {
    let s = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5));
    s = run(s, { type: 'session/complete', now: at(30) }); // b: 25 min from 5
    expect(s.session).toBeNull();
    expect(s.waiting.map((w) => w.id)).toEqual(['a']);
    s = run(s, switchTo('a', 40));
    expect(s.session).toMatchObject({ id: 'a', pausedAt: null, pausedTotalMs: 35 * MIN });
    expect(s.waiting).toEqual([]);
  });

  it('is a no-op for an unknown id, the active session itself, or a bad time', () => {
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5));
    expect(reducer(s, switchTo('zzz', 6))).toBe(s);
    expect(reducer(s, switchTo('b', 6))).toBe(s);
    expect(reducer(s, { type: 'session/switch', id: 'a', now: Number.NaN })).toBe(s);
  });

  it('remembers which session was left most recently', () => {
    const s = run(three(), switchTo('a', 20));
    expect(s.waiting.map((w) => w.id)).toEqual(['b', 'c']);
    expect(lastLeftSession(s)?.id).toBe('c');
  });
});

describe('cancel and complete with others in progress', () => {
  it('cancelling the active session leaves the waiting ones untouched and nothing active', () => {
    const s0 = three();
    const s = run(s0, { type: 'session/cancel', now: at(12) });
    expect(s.session).toBeNull();
    expect(s.waiting).toBe(s0.waiting);
    expect(s.stats.cancelled).toBe(1);
    expect(s.log.at(-1)).toMatchObject({ id: 'c', outcome: 'cancelled', focusedMinutes: 2, startedAt: at(10), endedAt: at(12) });
  });

  it('a waiting session can be ended by id; the active one keeps running', () => {
    const s0 = three();
    const s = run(s0, { type: 'session/cancel', id: 'a', now: at(12) });
    expect(s.session).toBe(s0.session);
    expect(s.waiting.map((w) => w.id)).toEqual(['b']);
    expect(s.log.at(-1)).toMatchObject({ id: 'a', outcome: 'cancelled', focusedMinutes: 5 });
    expect(reducer(s0, { type: 'session/cancel', id: 'nope', now: at(12) })).toBe(s0);
  });

  it('completing the active session blooms it; the others stay paused and none resumes on its own', () => {
    const s0 = three();
    const s = run(s0, { type: 'session/complete', now: at(35) });
    expect(s.session).toBeNull();
    expect(s.waiting).toBe(s0.waiting);
    expect(s.waiting.every((w) => w.pausedAt !== null)).toBe(true);
    expect(s.plants.map((p) => p.id)).toEqual(['c']);
    expect(s.log.at(-1)).toMatchObject({ id: 'c', outcome: 'completed', focusedMinutes: 25, goalMinutes: 25, endedAt: at(35) });
    expect(sessionPhase(s, at(36))).toBe('idle');
  });

  it('a waiting session that is not finished cannot be completed', () => {
    const s0 = three();
    expect(reducer(s0, { type: 'session/complete', id: 'a', now: at(500) })).toBe(s0);
  });
});

describe('"Still with us?" and waiting sessions', () => {
  it('a waiting session is never a long pause of the garden: the phase follows the active one', () => {
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5));
    expect(isLongPause(s.waiting[0]!, at(200))).toBe(true); // paused for hours …
    expect(sessionPhase(s, at(200))).toBe('focus'); // … but the garden works with b
  });

  it('switching back resumes it at once: it never shows as paused after a switch', () => {
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 5), switchTo('a', 200));
    expect(sessionPhase(s, at(200))).toBe('focus');
    expect(isLongPause(s.session!, at(200))).toBe(false);
  });
});

describe('session/focusWater', () => {
  it('records the due automatic waterings of the active session once', () => {
    const s0 = run(createDefaultState(T0), start('a', 'meadow-1', 0));
    const first = focusWateringTimes(s0.session!.seed, 25 * MIN)[0]!;
    expect(reducer(s0, { type: 'session/focusWater', now: T0 + first - 1 })).toBe(s0);
    const s1 = reducer(s0, { type: 'session/focusWater', now: T0 + first });
    expect(s1.session!.focusWaterings).toBe(1);
    expect(reducer(s1, { type: 'session/focusWater', now: T0 + first + 1000 })).toBe(s1);
  });

  it('pauses do not bring the next watering closer', () => {
    const s0 = run(createDefaultState(T0), start('a', 'meadow-1', 0), { type: 'session/pause', now: at(1) });
    expect(dueFocusWaterings(s0.session!, at(500))).toBe(0);
    expect(reducer(s0, { type: 'session/focusWater', now: at(500) })).toBe(s0);
  });

  it('a waiting session is never watered', () => {
    const s0 = run(createDefaultState(T0), start('a', 'meadow-1', 0), start('b', 'meadow-2', 0.5), { type: 'session/pause', now: at(1) });
    const s = run(s0, { type: 'session/focusWater', now: at(100) });
    expect(s.waiting[0]!.focusWaterings).toBe(0);
  });
});

describe('log ids', () => {
  it('logs plans as copies (later mutation does not leak in)', () => {
    const p = plan([25]);
    const s = run(createDefaultState(T0), start('a', 'meadow-1', 0, { plan: p }), { type: 'session/cancel', now: at(3) });
    p.blocks[0]!.minutes = 99;
    expect(s.log[0]!.plan!.blocks[0]!.minutes).toBe(25);
  });
});
