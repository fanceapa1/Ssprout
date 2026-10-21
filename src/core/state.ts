import type { Tier } from '../plants/types';
import { isCompatible, type PlacementSlot, type PlacementSpecies } from './placement';
import { tierForMinutes } from './rewards';
import { clampGoalMinutes, goalMinutesOf, isComplete, MINUTE_MS } from './session';

// ---------------------------------------------------------------------------------------------
// State shape (contract: docs/ARCHITECTURE.md › State)
// ---------------------------------------------------------------------------------------------

export interface PlantInstance {
  id: string;
  speciesId: string;
  slotId: string;
  seed: number;
  plantedAt: number;
  sessionMinutes: number;
}

export interface PressedFlower {
  speciesId: string;
  seed: number;
  plantedAt: number;
  removedAt: number;
}

export type Weather = 'sun' | 'rain' | 'mist';

export interface ActiveSession {
  id: string;
  goalMs: number;
  startedAt: number;
  pausedAt: number | null;
  pausedTotalMs: number;
  weather: Weather;
}

export interface PendingReward {
  sessionId: string;
  goalMinutes: number;
  tier: Tier;
  options: string[];
  chosen: string | null;
  completedAt: number;
}

export interface Settings {
  muted: boolean;
  lastGoalMinutes: number;
  notifications: 'unasked' | 'granted' | 'denied';
}

export interface GardenStats {
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
  pendingReward: PendingReward | null;
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
    pendingReward: null,
    stats: { totalMinutes: 0, completed: 0, cancelled: 0 },
    faunaSeen: [],
    tips: {},
    settings: { muted: true, lastGoalMinutes: DEFAULT_GOAL_MINUTES, notifications: 'unasked' },
  };
}

// ---------------------------------------------------------------------------------------------
// Actions. Every impure input (time, ids, seeds, weather, offers) is carried in the action so
// reducers stay pure and deterministic.
// ---------------------------------------------------------------------------------------------

export type Action =
  | { type: 'session/start'; goalMinutes: number; now: number; id: string; weather: Weather }
  | { type: 'session/pause'; now: number }
  | { type: 'session/resume'; now: number }
  | { type: 'session/cancel'; now: number }
  | { type: 'session/complete'; now: number; options: string[]; tier: Tier }
  | { type: 'reward/choose'; speciesId: string }
  | { type: 'plant/place'; slotId: string; id: string; seed: number; now: number }
  | { type: 'reward/discard' }
  | { type: 'tip/retire'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'fauna/seen'; id: string }
  | { type: 'state/replace'; state: GardenState }
  | { type: 'state/reset'; now: number };

export type ActionType = Action['type'];

export type Reducer<S = GardenState, A = Action> = (state: S, action: A) => S;

/**
 * What the reducer needs to know about the world to validate placement: species definitions and
 * scene slots. Both are static data, so the reducer stays pure.
 */
export interface ReducerWorld {
  getSpecies(id: string): PlacementSpecies | undefined;
  getSlot(id: string): PlacementSlot | undefined;
}

const WEATHER_SET: ReadonlySet<string> = new Set<Weather>(['sun', 'rain', 'mist']);
const NOTIFICATION_SET: ReadonlySet<string> = new Set<Settings['notifications']>(['unasked', 'granted', 'denied']);

const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.length > 0;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Build the root reducer (rules: docs/systems/core.md). Invalid actions are no-ops and return the
 * same state reference. With a `world`, `plant/place` also checks the slot exists and fits the
 * chosen species (habitat + size class); without one, any slot id is accepted.
 */
export function createReducer(world?: ReducerWorld): Reducer {
  return (state, action) => {
    switch (action.type) {
      case 'session/start': {
        if (state.session || state.pendingReward) return state;
        if (!nonEmpty(action.id) || !finite(action.now) || !WEATHER_SET.has(action.weather)) return state;
        if (!finite(action.goalMinutes)) return state;
        const goalMinutes = clampGoalMinutes(action.goalMinutes);
        return {
          ...state,
          session: {
            id: action.id,
            goalMs: goalMinutes * MINUTE_MS,
            startedAt: action.now,
            pausedAt: null,
            pausedTotalMs: 0,
            weather: action.weather,
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

      case 'session/cancel': {
        if (!state.session) return state;
        return { ...state, session: null, stats: { ...state.stats, cancelled: state.stats.cancelled + 1 } };
      }

      case 'session/complete': {
        const s = state.session;
        if (!s || !finite(action.now) || !isComplete(s, action.now)) return state;
        const goalMinutes = goalMinutesOf(s);
        if (action.tier !== tierForMinutes(goalMinutes)) return state;
        const options = action.options;
        if (!Array.isArray(options) || !options.every(nonEmpty) || new Set(options).size !== options.length) {
          return state;
        }
        return {
          ...state,
          session: null,
          pendingReward: {
            sessionId: s.id,
            goalMinutes,
            tier: action.tier,
            options: [...options],
            chosen: null,
            completedAt: action.now,
          },
          stats: {
            ...state.stats,
            totalMinutes: state.stats.totalMinutes + goalMinutes,
            completed: state.stats.completed + 1,
          },
        };
      }

      case 'reward/choose': {
        const r = state.pendingReward;
        if (!r || !r.options.includes(action.speciesId) || r.chosen === action.speciesId) return state;
        return { ...state, pendingReward: { ...r, chosen: action.speciesId } };
      }

      case 'plant/place': {
        const r = state.pendingReward;
        if (!r || r.chosen === null) return state;
        if (!nonEmpty(action.slotId) || !nonEmpty(action.id) || !finite(action.now) || !finite(action.seed)) {
          return state;
        }
        if (state.plants.some((p) => p.id === action.id)) return state;
        if (world) {
          const slot = world.getSlot(action.slotId);
          const species = world.getSpecies(r.chosen);
          if (!slot || !species || !isCompatible(species, slot)) return state;
        }
        const plant: PlantInstance = {
          id: action.id,
          speciesId: r.chosen,
          slotId: action.slotId,
          seed: action.seed,
          plantedAt: action.now,
          sessionMinutes: r.goalMinutes,
        };
        const old = state.plants.find((p) => p.slotId === action.slotId);
        const pressed = old
          ? [...state.pressed, { speciesId: old.speciesId, seed: old.seed, plantedAt: old.plantedAt, removedAt: action.now }]
          : state.pressed;
        return {
          ...state,
          plants: [...state.plants.filter((p) => p !== old), plant],
          pressed,
          pendingReward: null,
        };
      }

      case 'reward/discard':
        return state.pendingReward ? { ...state, pendingReward: null } : state;

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

/** Reducer without world knowledge (placement accepts any slot id). Prefer `createReducer(world)`. */
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
