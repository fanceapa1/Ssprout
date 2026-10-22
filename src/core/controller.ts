import type { SpeciesDef } from '../plants/types';
import type { Slot } from '../scene/geometry';
import type { Clock } from './clock';
import type { EventBus } from './events';
import { compatibleSlots, type CompatibleSlot } from './placement';
import { findPlan, recommendPlans, type StudyPlan } from './plans';
import { selectableSpecies, type SelectableSpecies } from './rewards';
import { createRng, type Rng } from './rng';
import {
  clampGoalMinutes,
  completionTime,
  dueFocusWaterings,
  isComplete,
  isLongPause,
  nextFocusWateringIn,
  pausedFor,
  pickWeather,
  sessionPhase,
  sessionTimeline,
  type SessionPhase,
  type SessionTimeline,
} from './session';
import {
  canStartSession,
  heldSlotIds,
  inProgressSessions,
  lastLeftSession,
  MAX_SESSIONS,
  type Action,
  type ActiveSession,
  type GardenState,
  type Settings,
  type Store,
} from './state';
import { tipsRetiredBy } from './tips';

/**
 * The session controller: the single API the UI (and widget) use to drive the garden. It owns
 * every impure input — time from the Clock, ids/seeds/weather from a seeded Rng — turns user
 * intent into store actions, and announces what happened on the event bus. No DOM.
 * Contract and examples: docs/systems/core.md.
 */

/** Calls `tick` periodically until the returned stop function is called. */
export interface Ticker {
  start(tick: () => void): () => void;
}

/** Default ticker: `setInterval`. The widget task swaps in a Web Worker ticker (not throttled). */
export function createIntervalTicker(ms = 1000): Ticker {
  return {
    start(tick) {
      const h = setInterval(tick, ms);
      return () => clearInterval(h);
    },
  };
}

export interface SessionControllerDeps {
  store: Store;
  clock: Clock;
  bus: EventBus;
  /** every species that can be planted (the plant registry) */
  species: readonly SpeciesDef[];
  /** scene slots, for `placementOptions` (default: none) */
  slots?: readonly Slot[];
  ticker?: Ticker;
  /** seed for ids, weather and plant seeds (default: clock time at creation) */
  seed?: number | string;
}

export interface StartOptions {
  /** free text; trimmed, ≤ 40 chars, empty → "Study session" */
  taskName: string;
  /** total minutes (clamped to 10–180, step 5) */
  goalMinutes: number;
  /** one of `recommendPlans(goalMinutes)` ids; default 'unbroken' */
  planId?: string;
  speciesId: string;
  slotId: string;
}

/** One session in progress, as the dock lists it (ADR 0150). */
export interface SessionSummary {
  session: ActiveSession;
  timeline: SessionTimeline;
  /** the session the timer, the garden and the widget follow */
  active: boolean;
  /** active and not paused */
  running: boolean;
  pausedForMs: number;
  /** the waiting session left most recently (the one the dock offers first when none is active) */
  lastLeft: boolean;
}

export interface SessionStatus {
  /** phase of the active session ('idle' when none is active, even if others wait) */
  phase: SessionPhase;
  /** the active session */
  session: ActiveSession | null;
  timeline: SessionTimeline | null;
  pausedForMs: number;
  /**
   * the active session has been paused for 30 min or more → show "Still with us?". Only the
   * active session can be paused by the gardener; sessions left for another one wait without
   * asking (ADR 0150).
   */
  longPause: boolean;
  /** every session in progress, oldest start first (the active one included) */
  sessions: SessionSummary[];
  /** another session may be started (fewer than `maxSessions` in progress) */
  canStart: boolean;
  maxSessions: number;
}

export interface SessionController {
  /**
   * Plant a seedling and start studying; it becomes the active session and the one that was
   * active waits, paused (ADR 0150). False at the limit of three or when the choice is invalid.
   */
  start(opts: StartOptions): boolean;
  pause(): boolean;
  resume(): boolean;
  /**
   * Make another in-progress session the active one and resume it; the active one (if any)
   * waits, paused. Switching to the active session itself resumes it. False if nothing changed.
   */
  switchTo(id: string): boolean;
  /** Water the current break (once per break). */
  water(): boolean;
  /** Skip the rest of the current break; the session ends that much sooner. */
  skipBreak(): boolean;
  /**
   * End without a plant (default: the active session; a waiting one by id): the seedling
   * withers, a displaced plant stays, the other sessions are untouched.
   */
  cancel(id?: string): boolean;
  /**
   * Announce block transitions, water the active plant when focus time reaches the next
   * automatic watering, and complete plans when due. Runs on every tick.
   */
  check(): boolean;
  /** Focused time until the active session's next automatic watering (ms), or null. */
  nextFocusWatering(): number | null;
  recommendPlans(totalMinutes: number): StudyPlan[];
  selectableSpecies(totalMinutes: number): SelectableSpecies[];
  /** Slots this species fits, each with its finished occupant (a swap) if any. */
  placementOptions(speciesId: string): CompatibleSlot[];
  retireTip(id: string): boolean;
  updateSettings(patch: Partial<Settings>): boolean;
  /** Record that a creature has been announced; emits `fauna:arrived` the first time. */
  announceFauna(id: string): boolean;
  status(): SessionStatus;
  /** Called after every tick (once a second while a session exists) with the fresh status. */
  onTick(fn: (status: SessionStatus) => void): () => void;
  /** Swap the tick source (e.g. a Web Worker ticker). */
  setTicker(ticker: Ticker): void;
  /** Reseed the rng used for ids, weather and plant seeds (dev/tests). */
  setSeed(seed: number | string): void;
  dispose(): void;
}

export function createSessionController(deps: SessionControllerDeps): SessionController {
  const { store, clock, bus } = deps;
  const species = deps.species;
  const slots = deps.slots ?? [];
  const speciesById = new Map(species.map((s) => [s.id, s]));

  let rng: Rng = createRng(deps.seed ?? clock.now());
  let ticker = deps.ticker ?? createIntervalTicker();
  let stopTicker: (() => void) | null = null;
  const tickListeners = new Set<(s: SessionStatus) => void>();
  /** last block announced for a session; null = not yet known (e.g. just reloaded) */
  let announced: { sessionId: string; blockIndex: number } | null = null;

  const newId = (prefix: string): string =>
    `${prefix}-${Math.max(0, Math.floor(clock.now())).toString(36)}-${rng.int(0, 0xffffff).toString(36).padStart(5, '0')}`;
  const newSeed = (): number => rng.int(0, 0xffffffff) >>> 0;

  /** Dispatch and report whether the state changed. */
  const apply = (action: Action): { changed: boolean; prev: GardenState; next: GardenState } => {
    const prev = store.get();
    store.dispatch(action);
    const next = store.get();
    return { changed: next !== prev, prev, next };
  };

  const status = (): SessionStatus => {
    const state = store.get();
    const s = state.session;
    const now = clock.now();
    const left = lastLeftSession(state);
    return {
      phase: sessionPhase(state, now),
      session: s,
      timeline: s ? sessionTimeline(s, now) : null,
      pausedForMs: s ? pausedFor(s, now) : 0,
      longPause: s ? isLongPause(s, now) : false,
      sessions: inProgressSessions(state).map((x) => ({
        session: x,
        timeline: sessionTimeline(x, now),
        active: x === s,
        running: x === s && x.pausedAt === null,
        pausedForMs: pausedFor(x, now),
        lastLeft: x === left,
      })),
      canStart: canStartSession(state),
      maxSessions: MAX_SESSIONS,
    };
  };

  const tick = (): void => {
    controller.check();
    if (tickListeners.size === 0) return;
    const st = status();
    for (const fn of [...tickListeners]) fn(st);
  };

  /** Tick only while a session exists. */
  const syncTicker = (): void => {
    const want = store.get().session !== null;
    if (want && !stopTicker) stopTicker = ticker.start(tick);
    if (!want && stopTicker) {
      stopTicker();
      stopTicker = null;
    }
  };

  const unsubscribe = store.subscribe((next, prev, action) => {
    for (const id of tipsRetiredBy(action, prev, next)) {
      store.dispatch({ type: 'tip/retire', id }); // queued until this delivery finishes
      bus.emit('tip:retired', { id });
    }
    syncTicker();
  });

  const complete = (s: ActiveSession, now: number): boolean => {
    const at = Math.min(now, completionTime(s) ?? now); // the real moment (matters after a reload)
    const { changed, prev, next } = apply({ type: 'session/complete', now: at, id: s.id });
    if (!changed) return false;
    const plant = next.plants.find((p) => p.id === s.id);
    if (!plant) return false;
    if (announced?.sessionId === s.id) announced = null;
    for (const removed of next.pressed.slice(prev.pressed.length)) bus.emit('plant:swapped', { plant, removed });
    bus.emit('plant:placed', { plant });
    bus.emit('session:complete', { sessionId: s.id, plant });
    return true;
  };

  const controller: SessionController = {
    start(opts) {
      const state = store.get();
      if (!canStartSession(state)) return false;
      const goalMinutes = clampGoalMinutes(opts.goalMinutes);
      const plan = findPlan(goalMinutes, opts.planId ?? 'unbroken');
      if (!plan) return false;
      const id = newId('session');
      const before = state.session;
      const now = clock.now();
      const { changed, next } = apply({
        type: 'session/start',
        id,
        taskName: opts.taskName,
        goalMinutes,
        plan,
        speciesId: opts.speciesId,
        slotId: opts.slotId,
        seed: newSeed(),
        now,
        weather: pickWeather(rng),
      });
      if (!changed || !next.session) return false;
      announced = { sessionId: id, blockIndex: 0 };
      // the session that was active now waits (announced as a pause when it was running)
      if (before && before.pausedAt === null) bus.emit('session:pause', { sessionId: before.id, at: now, reason: 'switch' });
      bus.emit('session:start', { session: next.session, pausedId: before?.id ?? null });
      return true;
    },

    pause() {
      const s = store.get().session;
      if (!s) return false;
      const at = clock.now();
      if (!apply({ type: 'session/pause', now: at }).changed) return false;
      bus.emit('session:pause', { sessionId: s.id, at, reason: 'user' });
      return true;
    },

    resume() {
      const s = store.get().session;
      if (!s) return false;
      const at = clock.now();
      if (!apply({ type: 'session/resume', now: at }).changed) return false;
      bus.emit('session:resume', { sessionId: s.id, at });
      return true;
    },

    switchTo(id) {
      const before = store.get().session;
      if (before?.id === id) return controller.resume();
      const at = clock.now();
      const { changed, next } = apply({ type: 'session/switch', id, now: at });
      if (!changed || !next.session) return false;
      // the chosen session's current block is not news: no break/focus announcement for it
      announced = { sessionId: id, blockIndex: sessionTimeline(next.session, at).blockIndex };
      if (before && before.pausedAt === null) bus.emit('session:pause', { sessionId: before.id, at, reason: 'switch' });
      bus.emit('session:resume', { sessionId: id, at });
      bus.emit('session:switch', { from: before?.id ?? null, to: id, at });
      return true;
    },

    water() {
      const s = store.get().session;
      if (!s) return false;
      const now = clock.now();
      const { blockIndex } = sessionTimeline(s, now);
      if (!apply({ type: 'session/water', blockIndex, now }).changed) return false;
      bus.emit('session:water', { blockIndex, sessionId: s.id, auto: false });
      return true;
    },

    skipBreak() {
      if (!apply({ type: 'session/skipBreak', now: clock.now() }).changed) return false;
      controller.check(); // announce the next focus block (or complete)
      return true;
    },

    cancel(id) {
      const state = store.get();
      const s = id === undefined ? state.session : inProgressSessions(state).find((x) => x.id === id);
      if (!s) return false;
      const at = clock.now();
      if (!apply({ type: 'session/cancel', now: at, id: s.id }).changed) return false;
      if (announced?.sessionId === s.id) announced = null;
      bus.emit('session:cancel', { sessionId: s.id, at });
      return true;
    },

    check() {
      const now = clock.now();
      // a plan may have ended while the app was closed (only the active session runs, but one
      // left exactly at its end is finished too)
      let completed = false;
      for (const x of inProgressSessions(store.get())) if (isComplete(x, now)) completed = complete(x, now) || completed;
      const s = store.get().session;
      if (!s) return completed;
      const { blockIndex, block } = sessionTimeline(s, now);
      const known = announced?.sessionId === s.id ? announced.blockIndex : null;
      if (known !== blockIndex) {
        announced = { sessionId: s.id, blockIndex };
        // the first block of a fresh session is announced by session:start; after a reload the
        // current block (only) is announced once
        if (!(known === null && blockIndex === 0)) {
          bus.emit(block.kind === 'break' ? 'session:break' : 'session:focus', { blockIndex, sessionId: s.id });
        }
      }
      // automatic focus watering (ADR 0153): due ones are recorded together and shown once, and
      // only while focusing (one that came due in the last tick of a focus block is let go)
      if (s.pausedAt === null && dueFocusWaterings(s, now) > s.focusWaterings) {
        if (apply({ type: 'session/focusWater', now }).changed && block.kind === 'focus') {
          bus.emit('session:water', { blockIndex, sessionId: s.id, auto: true });
        }
      }
      return completed;
    },

    nextFocusWatering() {
      const s = store.get().session;
      return s ? nextFocusWateringIn(s, clock.now()) : null;
    },

    recommendPlans: (totalMinutes) => recommendPlans(totalMinutes),

    selectableSpecies: (totalMinutes) => selectableSpecies(species, totalMinutes),

    placementOptions(speciesId) {
      const def = speciesById.get(speciesId);
      const state = store.get();
      return def ? compatibleSlots(def, slots, state.plants, heldSlotIds(state)) : [];
    },

    retireTip(id) {
      if (!apply({ type: 'tip/retire', id }).changed) return false;
      bus.emit('tip:retired', { id });
      return true;
    },

    updateSettings(patch) {
      const { changed, next } = apply({ type: 'settings/update', patch });
      if (!changed) return false;
      bus.emit('settings:changed', { settings: next.settings });
      return true;
    },

    announceFauna(id) {
      if (!apply({ type: 'fauna/seen', id }).changed) return false;
      bus.emit('fauna:arrived', { id });
      return true;
    },

    status,

    onTick(fn) {
      tickListeners.add(fn);
      return () => {
        tickListeners.delete(fn);
      };
    },

    setTicker(next) {
      if (stopTicker) {
        stopTicker();
        stopTicker = null;
      }
      ticker = next;
      syncTicker();
    },

    setSeed(seed) {
      rng = createRng(seed);
    },

    dispose() {
      unsubscribe();
      if (stopTicker) stopTicker();
      stopTicker = null;
      tickListeners.clear();
    },
  };

  // A session may have finished (or moved into a break) while the app was closed.
  controller.check();
  syncTicker();
  return controller;
}

