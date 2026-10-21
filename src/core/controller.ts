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
  isComplete,
  isLongPause,
  pausedFor,
  pickWeather,
  sessionPhase,
  sessionTimeline,
  type SessionPhase,
  type SessionTimeline,
} from './session';
import type { Action, ActiveSession, GardenState, Settings, Store } from './state';
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

export interface SessionStatus {
  phase: SessionPhase;
  session: ActiveSession | null;
  timeline: SessionTimeline | null;
  pausedForMs: number;
  /** paused for 30 min or more → show "Still with us?" */
  longPause: boolean;
}

export interface SessionController {
  /** Plant a seedling and start studying. False if a session exists or the choice is invalid. */
  start(opts: StartOptions): boolean;
  pause(): boolean;
  resume(): boolean;
  /** Water the current break (once per break). */
  water(): boolean;
  /** Skip the rest of the current break; the session ends that much sooner. */
  skipBreak(): boolean;
  /** End without a plant: the seedling withers, a displaced plant stays. */
  cancel(): boolean;
  /** Announce block transitions and complete the plan when due. Runs on every tick. */
  check(): boolean;
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
    return {
      phase: sessionPhase(state, now),
      session: s,
      timeline: s ? sessionTimeline(s, now) : null,
      pausedForMs: s ? pausedFor(s, now) : 0,
      longPause: s ? isLongPause(s, now) : false,
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
    const { changed, prev, next } = apply({ type: 'session/complete', now: at });
    if (!changed) return false;
    const plant = next.plants.find((p) => p.id === s.id);
    if (!plant) return false;
    announced = null;
    for (const removed of next.pressed.slice(prev.pressed.length)) bus.emit('plant:swapped', { plant, removed });
    bus.emit('plant:placed', { plant });
    bus.emit('session:complete', { sessionId: s.id, plant });
    return true;
  };

  const controller: SessionController = {
    start(opts) {
      const state = store.get();
      if (state.session) return false;
      const goalMinutes = clampGoalMinutes(opts.goalMinutes);
      const plan = findPlan(goalMinutes, opts.planId ?? 'unbroken');
      if (!plan) return false;
      const id = newId('session');
      const { changed, next } = apply({
        type: 'session/start',
        id,
        taskName: opts.taskName,
        goalMinutes,
        plan,
        speciesId: opts.speciesId,
        slotId: opts.slotId,
        seed: newSeed(),
        now: clock.now(),
        weather: pickWeather(rng),
      });
      if (!changed || !next.session) return false;
      announced = { sessionId: id, blockIndex: 0 };
      bus.emit('session:start', { session: next.session });
      return true;
    },

    pause() {
      const s = store.get().session;
      if (!s) return false;
      const at = clock.now();
      if (!apply({ type: 'session/pause', now: at }).changed) return false;
      bus.emit('session:pause', { sessionId: s.id, at });
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

    water() {
      const s = store.get().session;
      if (!s) return false;
      const now = clock.now();
      const { blockIndex } = sessionTimeline(s, now);
      if (!apply({ type: 'session/water', blockIndex, now }).changed) return false;
      bus.emit('session:water', { blockIndex });
      return true;
    },

    skipBreak() {
      if (!apply({ type: 'session/skipBreak', now: clock.now() }).changed) return false;
      controller.check(); // announce the next focus block (or complete)
      return true;
    },

    cancel() {
      const s = store.get().session;
      if (!s) return false;
      const at = clock.now();
      if (!apply({ type: 'session/cancel', now: at }).changed) return false;
      announced = null;
      bus.emit('session:cancel', { sessionId: s.id, at });
      return true;
    },

    check() {
      const s = store.get().session;
      if (!s) return false;
      const now = clock.now();
      if (isComplete(s, now)) return complete(s, now);
      const { blockIndex, block } = sessionTimeline(s, now);
      const known = announced?.sessionId === s.id ? announced.blockIndex : null;
      if (known === blockIndex) return false;
      announced = { sessionId: s.id, blockIndex };
      // first block of a fresh session is announced by session:start; after a reload the
      // current block (only) is announced once
      if (known === null && blockIndex === 0) return false;
      bus.emit(block.kind === 'break' ? 'session:break' : 'session:focus', { blockIndex });
      return false;
    },

    recommendPlans: (totalMinutes) => recommendPlans(totalMinutes),

    selectableSpecies: (totalMinutes) => selectableSpecies(species, totalMinutes),

    placementOptions(speciesId) {
      const def = speciesById.get(speciesId);
      return def ? compatibleSlots(def, slots, store.get().plants) : [];
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

