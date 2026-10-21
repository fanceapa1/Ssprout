import type { SpeciesDef } from '../plants/types';
import type { Slot } from '../scene/geometry';
import type { Clock } from './clock';
import type { EventBus } from './events';
import { compatibleSlots, type CompatibleSlot } from './placement';
import { generateOffer, ownedSpeciesIds, tierForMinutes } from './rewards';
import { createRng, type Rng } from './rng';
import {
  completionTime,
  elapsedMs,
  goalMinutesOf,
  isComplete,
  isLongPause,
  pausedFor,
  pickWeather,
  progress,
  remainingMs,
  sessionPhase,
  type SessionPhase,
} from './session';
import type { ActiveSession, GardenState, PendingReward, PlantInstance, Settings, Store } from './state';
import { tipsRetiredBy } from './tips';

/**
 * The session controller: the single API the UI (and widget) use to drive the garden. It owns
 * every impure input — time from the Clock, ids/seeds/weather/offers from a seeded Rng — turns
 * user intent into store actions, and announces what happened on the event bus.
 * No DOM. Contract and examples: docs/systems/core.md.
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
  /** every species the garden can offer (the plant registry) */
  species: readonly SpeciesDef[];
  /** scene slots, for placement checks/options (default: none known → `placementOptions` is empty) */
  slots?: readonly Slot[];
  ticker?: Ticker;
  /** seed for ids, weather, offers and plant seeds (default: clock time at creation) */
  seed?: number | string;
}

export interface SessionStatus {
  phase: SessionPhase;
  session: ActiveSession | null;
  pendingReward: PendingReward | null;
  goalMs: number;
  elapsedMs: number;
  remainingMs: number;
  /** 0..1 */
  progress: number;
  pausedForMs: number;
  /** paused for 30 min or more → show "Still with us?" */
  longPause: boolean;
}

export interface SessionController {
  /** Start a session (goal clamped to 10–180 / step 5; default: last goal). Null if not idle. */
  start(goalMinutes?: number): ActiveSession | null;
  pause(): boolean;
  resume(): boolean;
  /** End without reward (no penalty). */
  cancel(): boolean;
  /** Complete the session if its goal has been reached. Runs on every tick. */
  check(): boolean;
  /** Pick one of the offered species. */
  choose(speciesId: string): boolean;
  /** Species definitions of the pending offer (unknown ids are skipped). */
  offer(): SpeciesDef[];
  /** Compatible slots for the chosen species, each with its occupant (swap) if any. */
  placementOptions(): CompatibleSlot[];
  /** Plant the chosen species; an occupant is swapped into the pressed flowers. */
  place(slotId: string): PlantInstance | null;
  /** Drop the pending reward (to "plant later", simply do not place: it stays pending). */
  discard(): boolean;
  retireTip(id: string): boolean;
  updateSettings(patch: Partial<Settings>): boolean;
  /** Record that a creature has been announced; emits `fauna:arrived` the first time. */
  announceFauna(id: string): boolean;
  status(): SessionStatus;
  /** Called after every tick (once a second while a session exists) with the fresh status. */
  onTick(fn: (status: SessionStatus) => void): () => void;
  /** Swap the tick source (e.g. a Web Worker ticker). */
  setTicker(ticker: Ticker): void;
  /** Reseed the rng used for ids, weather, offers and plant seeds (dev/tests). */
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

  const newId = (prefix: string): string =>
    `${prefix}-${Math.max(0, Math.floor(clock.now())).toString(36)}-${rng.int(0, 0xffffff).toString(36).padStart(5, '0')}`;
  const newSeed = (): number => rng.int(0, 0xffffffff) >>> 0;

  /** Dispatch and report whether the state changed. */
  const apply = (action: Parameters<Store['dispatch']>[0]): { changed: boolean; prev: GardenState; next: GardenState } => {
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
      phase: sessionPhase(state),
      session: s,
      pendingReward: state.pendingReward,
      goalMs: s?.goalMs ?? 0,
      elapsedMs: s ? elapsedMs(s, now) : 0,
      remainingMs: s ? remainingMs(s, now) : 0,
      progress: s ? progress(s, now) : 0,
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

  const controller: SessionController = {
    start(goalMinutes) {
      const state = store.get();
      if (sessionPhase(state) !== 'idle') return null;
      const id = newId('session');
      const { changed, next } = apply({
        type: 'session/start',
        goalMinutes: goalMinutes ?? state.settings.lastGoalMinutes,
        now: clock.now(),
        id,
        weather: pickWeather(rng),
      });
      if (!changed || !next.session) return null;
      bus.emit('session:start', { session: next.session });
      return next.session;
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

    cancel() {
      const s = store.get().session;
      if (!s) return false;
      const at = clock.now();
      if (!apply({ type: 'session/cancel', now: at }).changed) return false;
      bus.emit('session:cancel', { sessionId: s.id, at });
      return true;
    },

    check() {
      const state = store.get();
      const s = state.session;
      const now = clock.now();
      if (!s || !isComplete(s, now)) return false;
      // stamp the moment the goal was actually reached (matters when the app was closed)
      const at = Math.min(now, completionTime(s) ?? now);
      const tier = tierForMinutes(goalMinutesOf(s));
      const options = generateOffer(rng.fork(`offer:${s.id}`), tier, species, ownedSpeciesIds(state.plants));
      const { changed, next } = apply({ type: 'session/complete', now: at, options, tier });
      if (!changed || !next.pendingReward) return false;
      bus.emit('session:complete', { sessionId: s.id, reward: next.pendingReward });
      return true;
    },

    choose(speciesId) {
      if (!apply({ type: 'reward/choose', speciesId }).changed) return false;
      bus.emit('reward:chosen', { speciesId });
      return true;
    },

    offer() {
      const r = store.get().pendingReward;
      return (r?.options ?? []).flatMap((id) => {
        const def = speciesById.get(id);
        return def ? [def] : [];
      });
    },

    placementOptions() {
      const state = store.get();
      const chosen = state.pendingReward?.chosen;
      const def = chosen ? speciesById.get(chosen) : undefined;
      return def ? compatibleSlots(def, slots, state.plants) : [];
    },

    place(slotId) {
      const id = newId('plant');
      const { changed, prev, next } = apply({ type: 'plant/place', slotId, id, seed: newSeed(), now: clock.now() });
      if (!changed) return null;
      const plant = next.plants.find((p) => p.id === id);
      if (!plant) return null;
      if (next.pressed.length > prev.pressed.length) {
        const removed = next.pressed[next.pressed.length - 1]!;
        bus.emit('plant:swapped', { plant, removed });
      }
      bus.emit('plant:placed', { plant });
      return plant;
    },

    discard() {
      return apply({ type: 'reward/discard' }).changed;
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

  // A session may have finished while the app was closed: complete it now (reward waits).
  controller.check();
  syncTicker();
  return controller;
}
