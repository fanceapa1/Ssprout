import type { SpeciesDef } from '../plants/types';
import { isCompatible, type PlacementSlot, type PlacementSpecies } from './placement';
import { focusMinutes, planProblem, type StudyPlan } from './plans';
import { tierForMinutes } from './rewards';
import {
  clampGoalMinutes,
  goalMinutesOf,
  isComplete,
  isValidGoalMinutes,
  MINUTE_MS,
  normalizeTaskName,
  sessionTimeline,
} from './session';

// ---------------------------------------------------------------------------------------------
// State shape (contract: docs/ARCHITECTURE.md › State; ADR 0003, ADR 0036)
// ---------------------------------------------------------------------------------------------

/** A finished plant: one completed study session. */
export interface PlantInstance {
  /** equals the id of the session that grew it */
  id: string;
  speciesId: string;
  slotId: string;
  seed: number;
  /** session start */
  plantedAt: number;
  /** total session minutes (the tier basis) */
  sessionMinutes: number;
  taskName: string;
  completedAt: number;
}

/** A plant swapped out of the garden, kept in the herbarium. */
export interface PressedFlower {
  speciesId: string;
  seed: number;
  plantedAt: number;
  removedAt: number;
  taskName: string;
}

export type Weather = 'sun' | 'rain' | 'mist';

export interface ActiveSession {
  id: string;
  taskName: string;
  /** total plan length (focus + breaks) */
  goalMs: number;
  plan: StudyPlan;
  /** the plant growing live at `slotId` */
  speciesId: string;
  slotId: string;
  seed: number;
  /** the finished plant in `slotId` when the session started (pressed on completion) */
  displacedPlantId: string | null;
  startedAt: number;
  pausedAt: number | null;
  pausedTotalMs: number;
  /** skipped break remainders: the plan ends this much sooner */
  skippedMs: number;
  weather: Weather;
  /** indexes of break blocks that were watered */
  waterings: number[];
}

export interface Settings {
  muted: boolean;
  lastGoalMinutes: number;
  notifications: 'unasked' | 'granted' | 'denied';
}

export interface GardenStats {
  /** focused minutes of completed sessions (breaks excluded) */
  totalMinutes: number;
  completed: number;
  cancelled: number;
}

export interface GardenState {
  version: 1;
  createdAt: number;
  plants: PlantInstance[];
  pressed: PressedFlower[];
  session: ActiveSession | null;
  stats: GardenStats;
  /** creature ids already announced */
  faunaSeen: string[];
  /** retired tips */
  tips: Record<string, 'seen'>;
  settings: Settings;
}

export const STATE_VERSION = 1 as const;
export const DEFAULT_GOAL_MINUTES = 25;

export function createDefaultState(now: number): GardenState {
  return {
    version: STATE_VERSION,
    createdAt: now,
    plants: [],
    pressed: [],
    session: null,
    stats: { totalMinutes: 0, completed: 0, cancelled: 0 },
    faunaSeen: [],
    tips: {},
    settings: { muted: true, lastGoalMinutes: DEFAULT_GOAL_MINUTES, notifications: 'unasked' },
  };
}

// ---------------------------------------------------------------------------------------------
// Actions. Every impure input (time, ids, seeds, weather) is carried in the action so reducers
// stay pure and deterministic.
// ---------------------------------------------------------------------------------------------

export type Action =
  | {
      type: 'session/start';
      id: string;
      taskName: string;
      goalMinutes: number;
      plan: StudyPlan;
      speciesId: string;
      slotId: string;
      seed: number;
      now: number;
      weather: Weather;
    }
  | { type: 'session/pause'; now: number }
  | { type: 'session/resume'; now: number }
  | { type: 'session/water'; blockIndex: number; now: number }
  | { type: 'session/skipBreak'; now: number }
  | { type: 'session/cancel'; now: number }
  | { type: 'session/complete'; now: number }
  | { type: 'tip/retire'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'fauna/seen'; id: string }
  | { type: 'state/replace'; state: GardenState }
  | { type: 'state/reset'; now: number };

export type ActionType = Action['type'];

export type Reducer<S = GardenState, A = Action> = (state: S, action: A) => S;

/**
 * What the reducer needs to know about the world to validate a session start: species
 * definitions (habitats, size, tier) and scene slots. Both are static data, so the reducer stays
 * pure.
 */
export interface ReducerWorld {
  getSpecies(id: string): (PlacementSpecies & Pick<SpeciesDef, 'tier'>) | undefined;
  getSlot(id: string): PlacementSlot | undefined;
}

const WEATHER_SET: ReadonlySet<string> = new Set<Weather>(['sun', 'rain', 'mist']);
const NOTIFICATION_SET: ReadonlySet<string> = new Set<Settings['notifications']>(['unasked', 'granted', 'denied']);

const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.length > 0;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const clonePlan = (p: StudyPlan): StudyPlan => ({ id: p.id, name: p.name, blocks: p.blocks.map((b) => ({ ...b })) });

/**
 * Build the root reducer (rules: docs/systems/core.md). Invalid actions are no-ops and return the
 * same state reference. With a `world`, `session/start` also checks the species exists, its tier
 * is earned by the total, and the slot exists and fits it (habitat + size class); without one,
 * any species/slot id is accepted.
 */
export function createReducer(world?: ReducerWorld): Reducer {
  return (state, action) => {
    switch (action.type) {
      case 'session/start': {
        if (state.session) return state;
        const { id, goalMinutes, plan, speciesId, slotId, seed, now, weather } = action;
        if (!nonEmpty(id) || !nonEmpty(speciesId) || !nonEmpty(slotId)) return state;
        if (!finite(now) || !finite(seed) || !WEATHER_SET.has(weather)) return state;
        if (!isValidGoalMinutes(goalMinutes) || planProblem(plan, goalMinutes) !== null) return state;
        if (state.plants.some((p) => p.id === id)) return state; // the finished plant takes this id
        if (world) {
          const def = world.getSpecies(speciesId);
          const slot = world.getSlot(slotId);
          if (!def || !slot || def.tier > tierForMinutes(goalMinutes) || !isCompatible(def, slot)) return state;
        }
        const displaced = state.plants.find((p) => p.slotId === slotId);
        return {
          ...state,
          session: {
            id,
            taskName: normalizeTaskName(action.taskName),
            goalMs: goalMinutes * MINUTE_MS,
            plan: clonePlan(plan),
            speciesId,
            slotId,
            seed,
            displacedPlantId: displaced?.id ?? null,
            startedAt: now,
            pausedAt: null,
            pausedTotalMs: 0,
            skippedMs: 0,
            weather,
            waterings: [],
          },
          settings: { ...state.settings, lastGoalMinutes: goalMinutes },
        };
      }

      case 'session/pause': {
        const s = state.session;
        if (!s || s.pausedAt !== null || !finite(action.now)) return state;
        return { ...state, session: { ...s, pausedAt: Math.max(action.now, s.startedAt) } };
      }

      case 'session/resume': {
        const s = state.session;
        if (!s || s.pausedAt === null || !finite(action.now)) return state;
        const span = Math.max(0, action.now - s.pausedAt);
        return { ...state, session: { ...s, pausedAt: null, pausedTotalMs: s.pausedTotalMs + span } };
      }

      case 'session/water': {
        const s = state.session;
        if (!s || !finite(action.now) || isComplete(s, action.now)) return state;
        const t = sessionTimeline(s, action.now);
        if (t.block.kind !== 'break' || action.blockIndex !== t.blockIndex || t.watered) return state;
        return { ...state, session: { ...s, waterings: [...s.waterings, t.blockIndex] } };
      }

      case 'session/skipBreak': {
        const s = state.session;
        if (!s || !finite(action.now) || isComplete(s, action.now)) return state;
        const t = sessionTimeline(s, action.now);
        if (t.block.kind !== 'break' || t.blockRemainingMs <= 0) return state;
        return { ...state, session: { ...s, skippedMs: s.skippedMs + t.blockRemainingMs } };
      }

      case 'session/cancel': {
        // the displaced plant never left `plants`, so it simply stays
        if (!state.session) return state;
        return { ...state, session: null, stats: { ...state.stats, cancelled: state.stats.cancelled + 1 } };
      }

      case 'session/complete': {
        const s = state.session;
        if (!s || !finite(action.now) || !isComplete(s, action.now)) return state;
        const plant: PlantInstance = {
          id: s.id,
          speciesId: s.speciesId,
          slotId: s.slotId,
          seed: s.seed,
          plantedAt: s.startedAt,
          sessionMinutes: goalMinutesOf(s),
          taskName: s.taskName,
          completedAt: action.now,
        };
        // press the displaced plant (and anything else that ended up in the slot)
        const leaving = state.plants.filter((p) => p.id === s.displacedPlantId || p.slotId === s.slotId);
        const pressed = leaving.map<PressedFlower>((p) => ({
          speciesId: p.speciesId,
          seed: p.seed,
          plantedAt: p.plantedAt,
          removedAt: action.now,
          taskName: p.taskName,
        }));
        return {
          ...state,
          session: null,
          plants: [...state.plants.filter((p) => !leaving.includes(p)), plant],
          pressed: pressed.length > 0 ? [...state.pressed, ...pressed] : state.pressed,
          stats: {
            ...state.stats,
            totalMinutes: state.stats.totalMinutes + focusMinutes(s.plan),
            completed: state.stats.completed + 1,
          },
        };
      }

      case 'tip/retire':
        if (!nonEmpty(action.id) || state.tips[action.id] === 'seen') return state;
        return { ...state, tips: { ...state.tips, [action.id]: 'seen' } };

      case 'settings/update': {
        const next = mergeSettings(state.settings, action.patch);
        return next === state.settings ? state : { ...state, settings: next };
      }

      case 'fauna/seen':
        if (!nonEmpty(action.id) || state.faunaSeen.includes(action.id)) return state;
        return { ...state, faunaSeen: [...state.faunaSeen, action.id] };

      case 'state/replace':
        if (!action.state || action.state.version !== STATE_VERSION || action.state === state) return state;
        return action.state;

      case 'state/reset':
        if (!finite(action.now)) return state;
        return createDefaultState(action.now);

      default:
        return state;
    }
  };
}

/** Merge only valid, changed fields; returns `current` itself when nothing changes. */
export function mergeSettings(current: Settings, patch: Partial<Settings> | null | undefined): Settings {
  if (!patch || typeof patch !== 'object') return current;
  const next: Settings = { ...current };
  if (typeof patch.muted === 'boolean') next.muted = patch.muted;
  if (finite(patch.lastGoalMinutes)) next.lastGoalMinutes = clampGoalMinutes(patch.lastGoalMinutes);
  if (typeof patch.notifications === 'string' && NOTIFICATION_SET.has(patch.notifications)) {
    next.notifications = patch.notifications;
  }
  const changed =
    next.muted !== current.muted ||
    next.lastGoalMinutes !== current.lastGoalMinutes ||
    next.notifications !== current.notifications;
  return changed ? next : current;
}

/** Reducer without world knowledge (any species/slot accepted). Prefer `createReducer(world)`. */
export const reducer: Reducer = createReducer();

// ---------------------------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------------------------

export type Listener<S = GardenState, A = Action> = (state: S, prev: S, action: A) => void;

export interface Store<S = GardenState, A = Action> {
  get(): S;
  /**
   * Apply an action. Dispatches issued from inside a listener are queued and applied after
   * the current one has been delivered to every listener (in order, never nested).
   */
  dispatch(action: A): void;
  /** Called after every state change (not when the reducer returns the same reference). */
  subscribe(fn: Listener<S, A>): () => void;
}

/**
 * @param onChange called on every state change before subscribers — the persistence hook.
 */
export function createStore<S = GardenState, A = Action>(
  initial: S,
  reduce: Reducer<S, A>,
  onChange?: Listener<S, A>,
): Store<S, A> {
  let state = initial;
  const listeners = new Set<Listener<S, A>>();
  const queue: A[] = [];
  let dispatching = false;

  const apply = (action: A): void => {
    const prev = state;
    const next = reduce(prev, action);
    if (next === prev) return;
    state = next;
    onChange?.(next, prev, action);
    for (const fn of [...listeners]) fn(next, prev, action);
  };

  return {
    get: () => state,
    dispatch(action) {
      queue.push(action);
      if (dispatching) return;
      dispatching = true;
      try {
        while (queue.length > 0) apply(queue.shift() as A);
      } finally {
        dispatching = false;
        queue.length = 0;
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
