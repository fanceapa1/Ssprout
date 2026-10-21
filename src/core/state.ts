import type { Tier } from '../plants/types';

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
 * Root reducer. SKELETON: returns the state unchanged for every action. The core logic task
 * implements each case (must stay pure; return the same reference when nothing changes).
 */
export const reducer: Reducer = (state, action) => {
  switch (action.type) {
    default:
      return state;
  }
};

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
