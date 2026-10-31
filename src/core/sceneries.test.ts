import { describe, expect, it } from 'vitest';
import type { Habitat, SizeClass, Tier } from '../plants/types';
import { faunaSeenIn, faunaSeenKey, gardenCounts, newlyArrived, unlockedFauna, type FaunaTable, type SpeciesLookup } from './fauna-unlocks';
import { findPlan, type StudyPlan } from './plans';
import { DEFAULT_SCENERY, isSceneryId, SCENERY_IDS, slotLookup, slotsOfAny, type SceneryId } from './sceneries';
import {
  createDefaultState,
  createReducer,
  heldSlotIds,
  plantsIn,
  sessionsIn,
  type Action,
  type GardenState,
  type ReducerWorld,
} from './state';
import { makePlant, makeSession, MIN, T0 } from './testing';

/**
 * Per-scenery gardens (schema v4, ADR 0240): plants and their spots belong to one garden;
 * sessions, history, schedules and settings are shared. Slot ids are only unique within a scenery.
 */

type SlotDef = { id: string; habitat: Habitat; maxSize: SizeClass };
const SPECIES: Record<string, { habitats: Habitat[]; sizeClass: SizeClass; tier: Tier; pollinators?: boolean }> = {
  violet: { habitats: ['meadow', 'rock'], sizeClass: 'small', tier: 1, pollinators: true },
  lily: { habitats: ['water'], sizeClass: 'medium', tier: 1 },
};
/** `shared-1` exists in both sceneries; `pool-1` only at the waterfall; `meadow-1` only in the Japanese garden. */
const SLOTS: Record<SceneryId, SlotDef[]> = {
  'japanese-garden': [
    { id: 'meadow-1', habitat: 'meadow', maxSize: 'large' },
    { id: 'shared-1', habitat: 'meadow', maxSize: 'large' },
  ],
  waterfall: [
    { id: 'pool-1', habitat: 'water', maxSize: 'medium' },
    { id: 'shared-1', habitat: 'rock', maxSize: 'small' },
  ],
};
const slots = slotLookup<SlotDef>((id) => SLOTS[id]);
const world: ReducerWorld = { getSpecies: (id) => SPECIES[id], getSlot: slots.get };
const reducer = createReducer(world);
const run = (state: GardenState, ...actions: Action[]): GardenState => actions.reduce(reducer, state);
const fresh = () => createDefaultState(T0);

type StartOver = Partial<Omit<Extract<Action, { type: 'session/start' }>, 'type'>>;
const start = (over: StartOver = {}): Action => ({
  type: 'session/start',
  id: 'session-1',
  taskName: 'Task',
  goalMinutes: 25,
  plan: findPlan(25, 'unbroken') as StudyPlan,
  speciesId: 'violet',
  slotId: 'shared-1',
  seed: 42,
  now: T0,
  weather: 'sun',
  ...over,
});
const at = (min: number) => T0 + min * MIN;

describe('scenery ids and slot lookups', () => {
  it('lists the Japanese garden (the default) and the waterfall', () => {
    expect(SCENERY_IDS).toEqual(['japanese-garden', 'waterfall']);
    expect(DEFAULT_SCENERY).toBe('japanese-garden');
    expect(isSceneryId('waterfall')).toBe(true);
    expect(isSceneryId('pond')).toBe(false); // an audio scenery, not a garden
  });

  it('finds a slot by scenery and id; a plain list is the default scenery’s', () => {
    expect(slots.get('waterfall', 'shared-1')!.habitat).toBe('rock');
    expect(slots.get('japanese-garden', 'shared-1')!.habitat).toBe('meadow');
    expect(slots.get('japanese-garden', 'pool-1')).toBeUndefined();
    const of = slotsOfAny(SLOTS['japanese-garden']);
    expect(of('japanese-garden')).toBe(SLOTS['japanese-garden']);
    expect(of('waterfall')).toEqual([]);
    expect(slotsOfAny(undefined)('japanese-garden')).toEqual([]);
  });
});

describe('scenery/view', () => {
  it('shows another garden and leaves the sessions where they grow', () => {
    const s = run(fresh(), start());
    const next = run(s, { type: 'scenery/view', id: 'waterfall' });
    expect(next.scenery).toBe('waterfall');
    expect(next.session).toBe(s.session);
    expect(next.session!.sceneryId).toBe('japanese-garden');
    expect(next.plants).toBe(s.plants);
  });

  it('is a no-op for an unknown id or the garden already on view', () => {
    const s = fresh();
    expect(reducer(s, { type: 'scenery/view', id: 'coast' as SceneryId })).toBe(s);
    expect(reducer(s, { type: 'scenery/view', id: 'japanese-garden' })).toBe(s);
  });
});

describe('session/start in a scenery', () => {
  it('plants in the garden on view by default, or in the one it names', () => {
    expect(run(fresh(), start()).session!.sceneryId).toBe('japanese-garden');
    const viewing = run(fresh(), { type: 'scenery/view', id: 'waterfall' });
    expect(run(viewing, start()).session!.sceneryId).toBe('waterfall');
    expect(run(viewing, start({ sceneryId: 'japanese-garden' })).session!.sceneryId).toBe('japanese-garden');
  });

  it('checks the slot in that scenery: its habitat, and that it exists there', () => {
    const s = fresh();
    expect(run(s, start({ sceneryId: 'waterfall', speciesId: 'lily', slotId: 'pool-1' })).session).not.toBeNull();
    expect(reducer(s, start({ sceneryId: 'japanese-garden', speciesId: 'lily', slotId: 'pool-1' }))).toBe(s);
    expect(reducer(s, start({ sceneryId: 'waterfall', slotId: 'meadow-1' }))).toBe(s);
    expect(reducer(s, start({ sceneryId: 'coast' as SceneryId }))).toBe(s);
  });

  it('a slot is held only in its own garden: the same slot id is free in the other one', () => {
    const one = run(fresh(), start());
    const two = run(one, start({ id: 'session-2', sceneryId: 'waterfall', now: at(1) }));
    expect(two.session!.sceneryId).toBe('waterfall');
    expect(two.waiting.map((w) => w.id)).toEqual(['session-1']);
    expect(reducer(two, start({ id: 'session-3', now: at(2) }))).toBe(two); // Japanese shared-1 is held
    expect(heldSlotIds(two, 'japanese-garden')).toEqual(new Set(['shared-1']));
    expect(heldSlotIds(two, 'waterfall')).toEqual(new Set(['shared-1']));
  });

  it('displaces only the plant in that garden’s slot', () => {
    const plants = [makePlant({ id: 'jp', slotId: 'shared-1' })];
    const s = run({ ...fresh(), plants }, start({ sceneryId: 'waterfall' }));
    expect(s.session!.displacedPlantId).toBeNull();
    expect(run({ ...fresh(), plants }, start()).session!.displacedPlantId).toBe('jp');
  });
});

describe('session/complete in a scenery', () => {
  it('the plant, its pressed predecessor and the log entry carry the session’s scenery', () => {
    const plants = [
      makePlant({ id: 'jp', slotId: 'shared-1' }),
      makePlant({ id: 'wf', sceneryId: 'waterfall', slotId: 'shared-1' }),
    ];
    const s = run({ ...fresh(), plants }, start({ sceneryId: 'waterfall' }), { type: 'session/complete', now: at(25) });
    expect(s.plants.map((p) => [p.id, p.sceneryId, p.slotId])).toEqual([
      ['jp', 'japanese-garden', 'shared-1'],
      ['session-1', 'waterfall', 'shared-1'],
    ]);
    expect(s.pressed).toHaveLength(1);
    expect(s.pressed[0]).toMatchObject({ sceneryId: 'waterfall', seed: plants[1]!.seed });
    expect(s.log.at(-1)).toMatchObject({ id: 'session-1', sceneryId: 'waterfall', slotId: 'shared-1' });
  });

  it('completing a session in one garden leaves the other garden’s plant in the same slot id', () => {
    const plants = [makePlant({ id: 'wf', sceneryId: 'waterfall', slotId: 'shared-1' })];
    const s = run({ ...fresh(), plants }, start(), { type: 'session/complete', now: at(25) });
    expect(s.plants.map((p) => p.id)).toEqual(['wf', 'session-1']);
    expect(s.pressed).toEqual([]);
  });

  it('a cancelled session’s log entry keeps its scenery', () => {
    const s = run(fresh(), start({ sceneryId: 'waterfall' }), { type: 'session/cancel', now: at(5) });
    expect(s.log[0]).toMatchObject({ outcome: 'cancelled', sceneryId: 'waterfall' });
  });
});

describe('selectors', () => {
  it('plantsIn and sessionsIn pick one garden', () => {
    const state: GardenState = {
      ...fresh(),
      plants: [makePlant({ id: 'a' }), makePlant({ id: 'b', sceneryId: 'waterfall', slotId: 'pool-1' })],
      session: makeSession({ id: 's1', sceneryId: 'waterfall', slotId: 'pool-1', startedAt: T0 + 1 }),
      waiting: [makeSession({ id: 's2', pausedAt: T0 }), makeSession({ id: 's3', sceneryId: 'waterfall', slotId: 'shared-1', pausedAt: T0 })],
    };
    expect(plantsIn(state, 'waterfall').map((p) => p.id)).toEqual(['b']);
    expect(plantsIn(state, 'japanese-garden').map((p) => p.id)).toEqual(['a']);
    expect(sessionsIn(state, 'waterfall').map((s) => s.id)).toEqual(['s3', 's1']); // oldest start first
    expect(sessionsIn(state, 'japanese-garden').map((s) => s.id)).toEqual(['s2']);
    expect(heldSlotIds(state, 'waterfall')).toEqual(new Set(['pool-1', 'shared-1']));
  });
});

describe('wildlife per garden', () => {
  const lookup: SpeciesLookup = (id) => SPECIES[id] && { habitats: SPECIES[id]!.habitats, pollinators: !!SPECIES[id]!.pollinators };
  // the first rows of a table like the Japanese garden's (core never imports the sceneries' tables)
  const table: FaunaTable = [
    { id: 'striders', kind: 'strider', rule: 'always', arrival: 'Striders.', announce: false, unlocked: () => true },
    { id: 'dragonfly', kind: 'dragonfly', rule: '2 plants', arrival: 'A dragonfly.', announce: true, unlocked: (c) => c.plants >= 2 },
    { id: 'koi-1', kind: 'koi', rule: '3 plants', arrival: 'A koi.', announce: true, unlocked: (c) => c.plants >= 3 },
  ];
  const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);
  const many = (n: number, sceneryId: SceneryId, speciesId = 'violet') =>
    Array.from({ length: n }, (_, i) => makePlant({ id: `${sceneryId}-${i}`, sceneryId, speciesId, slotId: `slot-${i}` }));

  it('unlocks from that garden’s own plants (default: the garden on view)', () => {
    const state: GardenState = { ...fresh(), plants: [...many(3, 'japanese-garden'), ...many(1, 'waterfall', 'lily')] };
    expect(gardenCounts(state, lookup)).toEqual({ plants: 3, pollinatorFlowers: 3, waterPlants: 0 });
    expect(gardenCounts(state, lookup, 'waterfall')).toEqual({ plants: 1, pollinatorFlowers: 0, waterPlants: 1 });
    expect(ids(unlockedFauna(state, lookup, 'japanese-garden', table))).toEqual(['striders', 'dragonfly', 'koi-1']);
    expect(ids(unlockedFauna(state, lookup, 'waterfall', table))).toEqual(['striders']);
  });

  it('announced creatures are namespaced outside the Japanese garden', () => {
    expect(faunaSeenKey('japanese-garden', 'dragonfly')).toBe('dragonfly');
    expect(faunaSeenKey('waterfall', 'dragonfly')).toBe('waterfall:dragonfly');
    const state: GardenState = { ...fresh(), plants: [...many(2, 'japanese-garden'), ...many(2, 'waterfall')], faunaSeen: ['dragonfly'] };
    expect(faunaSeenIn(state, 'japanese-garden', 'dragonfly')).toBe(true);
    expect(faunaSeenIn(state, 'waterfall', 'dragonfly')).toBe(false);
    expect(newlyArrived(state, lookup, 'japanese-garden', table)).toEqual(['striders']);
    expect(newlyArrived(state, lookup, 'waterfall', table)).toEqual(['striders', 'dragonfly']);
    const seen = { ...state, faunaSeen: ['dragonfly', 'waterfall:striders', 'waterfall:dragonfly'] };
    expect(newlyArrived(seen, lookup, 'waterfall', table)).toEqual([]);
  });
});
