import type { SpeciesDef } from '../plants/types';
import { isCompatible, type PlacementSlot, type PlacementSpecies } from './placement';
import { focusMinutes, planProblem, type StudyPlan } from './plans';
import { tierForMinutes } from './rewards';
import {
  clampGoalMinutes,
  dueFocusWaterings,
  goalMinutesOf,
  isComplete,
  isValidGoalMinutes,
  MINUTE_MS,
  normalizeTaskName,
  sessionTimeline,
} from './session';

// ---------------------------------------------------------------------------------------------
// State shape (contract: docs/ARCHITECTURE.md › State; ADR 0003, ADR 0036, ADRs 0150–0153)
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
  /**
   * How many of the session's automatic focus waterings (`focusWateringTimes`, seeded by `seed`)
   * have happened. The controller raises it when focus time passes the next one (ADR 0153).
   */
  focusWaterings: number;
}

/**
 * One ended session in the history (ADR 0151): appended on completion and on cancel, never
 * edited. The calendar reads it with the queries in `core/session-log.ts`.
 */
export interface SessionLogEntry {
  /** the session id (for a completed session also the id of the plant it grew) */
  id: string;
  outcome: 'completed' | 'cancelled';
  taskName: string;
  speciesId: string;
  slotId: string;
  seed: number;
  /** the study plan; null when back-filled from a v1 plant (the plan was not kept then) */
  plan: StudyPlan | null;
  /** the chosen total (focus + breaks) */
  goalMinutes: number;
  /** focus time actually studied, whole minutes (completed: the plan's focus minutes) */
  focusedMinutes: number;
  /** wall-clock start and end (epoch ms); pauses and waiting time fall in between */
  startedAt: number;
  endedAt: number;
  /** reconstructed from a finished plant by the v1 → v2 migration */
  backfilled?: true;
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
  version: 2;
  createdAt: number;
  plants: PlantInstance[];
  pressed: PressedFlower[];
  /** the active session: the one the timer, the garden's weather and the widget follow */
  session: ActiveSession | null;
  /**
   * The other sessions in progress, all paused, in the order they were left (most recent last).
   * With `session` at most `MAX_SESSIONS` (ADR 0150).
   */
  waiting: ActiveSession[];
  /** ended sessions, oldest first (ADR 0151) */
  log: SessionLogEntry[];
  stats: GardenStats;
  /** creature ids already announced */
  faunaSeen: string[];
  /** retired tips */
  tips: Record<string, 'seen'>;
  settings: Settings;
}

export const STATE_VERSION = 2 as const;
export const DEFAULT_GOAL_MINUTES = 25;
/** Sessions that may be in progress at once: one active, the others waiting (ADR 0150). */
export const MAX_SESSIONS = 3;

/** Every session in progress — the active one and the waiting ones — oldest start first. */
export function inProgressSessions(state: Pick<GardenState, 'session' | 'waiting'>): ActiveSession[] {
  const all = state.session ? [state.session, ...state.waiting] : [...state.waiting];
  return all.sort((a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Another session may be started (fewer than `MAX_SESSIONS` in progress). */
export function canStartSession(state: Pick<GardenState, 'session' | 'waiting'>): boolean {
  return state.waiting.length + (state.session ? 1 : 0) < MAX_SESSIONS;
}

/** The waiting session left most recently (the one the dock offers to resume first), or null. */
export function lastLeftSession(state: Pick<GardenState, 'waiting'>): ActiveSession | null {
  let best: ActiveSession | null = null;
  for (const s of state.waiting) if (!best || (s.pausedAt ?? 0) >= (best.pausedAt ?? 0)) best = s;
  return best;
}

/** Slot ids held by sessions in progress (not available to another session). */
export function heldSlotIds(state: Pick<GardenState, 'session' | 'waiting'>): Set<string> {
  return new Set(inProgressSessions(state).map((s) => s.slotId));
}

export function createDefaultState(now: number): GardenState {
  return {
    version: STATE_VERSION,
    createdAt: now,
    plants: [],
    pressed: [],
    session: null,
    waiting: [],
    log: [],
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
  /** make a waiting session the active one (resumed); the active one, if any, waits (paused) */
  | { type: 'session/switch'; id: string; now: number }
  | { type: 'session/water'; blockIndex: number; now: number }
  /** record the automatic focus waterings that are due for the active session */
  | { type: 'session/focusWater'; now: number }
  | { type: 'session/skipBreak'; now: number }
  /** `id` defaults to the active session; a waiting one may be ended too */
  | { type: 'session/cancel'; now: number; id?: string }
  | { type: 'session/complete'; now: number; id?: string }
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

/** Paused at `now` (an already paused session keeps its own pause start). */
const pauseAt = (s: ActiveSession, now: number): ActiveSession =>
  s.pausedAt !== null ? s : { ...s, pausedAt: Math.max(now, s.startedAt) };

/** Running again; the paused span is added to `pausedTotalMs` (paused time never counts). */
const resumeAt = (s: ActiveSession, now: number): ActiveSession =>
  s.pausedAt === null ? s : { ...s, pausedAt: null, pausedTotalMs: s.pausedTotalMs + Math.max(0, now - s.pausedAt) };

/** An id already used by a session in progress, a finished plant or a logged session. */
const idTaken = (state: GardenState, id: string): boolean =>
  state.session?.id === id ||
  state.waiting.some((w) => w.id === id) ||
  state.plants.some((p) => p.id === id) ||
  state.log.some((e) => e.id === id);

/** The in-progress session with `id` (default: the active one). */
const findInProgress = (state: GardenState, id: string | undefined): ActiveSession | null => {
  if (id === undefined) return state.session;
  if (state.session?.id === id) return state.session;
  return state.waiting.find((w) => w.id === id) ?? null;
};

/** The state with session `s` no longer in progress (no other session becomes active). */
const withoutSession = (state: GardenState, s: ActiveSession): GardenState =>
  state.session === s ? { ...state, session: null } : { ...state, waiting: state.waiting.filter((w) => w !== s) };

/** The history line for a session ending at `now` (ADR 0151). */
export function logEntry(s: ActiveSession, outcome: SessionLogEntry['outcome'], now: number): SessionLogEntry {
  const focused = outcome === 'completed' ? focusMinutes(s.plan) : Math.round(sessionTimeline(s, now).focusDoneMs / MINUTE_MS);
  return {
    id: s.id,
    outcome,
    taskName: s.taskName,
    speciesId: s.speciesId,
    slotId: s.slotId,
    seed: s.seed,
    plan: clonePlan(s.plan),
    goalMinutes: goalMinutesOf(s),
    focusedMinutes: focused,
    startedAt: s.startedAt,
    endedAt: Math.max(now, s.startedAt),
  };
}

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
        if (!canStartSession(state)) return state;
        const { id, goalMinutes, plan, speciesId, slotId, seed, now, weather } = action;
        if (!nonEmpty(id) || !nonEmpty(speciesId) || !nonEmpty(slotId)) return state;
        if (!finite(now) || !finite(seed) || !WEATHER_SET.has(weather)) return state;
        if (!isValidGoalMinutes(goalMinutes) || planProblem(plan, goalMinutes) !== null) return state;
        if (idTaken(state, id)) return state; // the finished plant and the log entry take this id
        if (heldSlotIds(state).has(slotId)) return state; // another seedling grows there
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
            focusWaterings: 0,
          },
          // the session that was active waits, paused, while the new one grows (ADR 0150)
          waiting: state.session ? [...state.waiting, pauseAt(state.session, now)] : state.waiting,
          settings: { ...state.settings, lastGoalMinutes: goalMinutes },
        };
      }

      case 'session/switch': {
        const { id, now } = action;
        if (!finite(now) || !nonEmpty(id)) return state;
        const target = state.waiting.find((w) => w.id === id);
        if (!target) return state;
        const rest = state.waiting.filter((w) => w !== target);
        return {
          ...state,
          session: resumeAt(target, now),
          waiting: state.session ? [...rest, pauseAt(state.session, now)] : rest,
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

      case 'session/focusWater': {
        const s = state.session;
        if (!s || !finite(action.now)) return state;
        const due = dueFocusWaterings(s, action.now);
        if (due <= s.focusWaterings) return state;
        return { ...state, session: { ...s, focusWaterings: due } };
      }

      case 'session/skipBreak': {
        const s = state.session;
        if (!s || !finite(action.now) || isComplete(s, action.now)) return state;
        const t = sessionTimeline(s, action.now);
        if (t.block.kind !== 'break' || t.blockRemainingMs <= 0) return state;
        return { ...state, session: { ...s, skippedMs: s.skippedMs + t.blockRemainingMs } };
      }

      case 'session/cancel': {
        // the displaced plant never left `plants`, so it simply stays; the others are untouched
        const s = findInProgress(state, action.id);
        if (!s || !finite(action.now)) return state;
        return {
          ...withoutSession(state, s),
          log: [...state.log, logEntry(s, 'cancelled', action.now)],
          stats: { ...state.stats, cancelled: state.stats.cancelled + 1 },
        };
      }

      case 'session/complete': {
        const s = findInProgress(state, action.id);
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
        // the others stay as they are: nothing resumes on its own (ADR 0152)
        return {
          ...withoutSession(state, s),
          plants: [...state.plants.filter((p) => !leaving.includes(p)), plant],
          pressed: pressed.length > 0 ? [...state.pressed, ...pressed] : state.pressed,
          log: [...state.log, logEntry(s, 'completed', action.now)],
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
