import type { SpeedClock } from '../core/clock';
import type { SessionController, SessionStatus } from '../core/controller';
import { exportState, importState, validateState, type ImportResult, type Saver } from '../core/persistence';
import type { StudyPlan } from '../core/plans';
import { createRng, type Rng } from '../core/rng';
import { slotsOfAny, type SceneryId, type SlotsOf } from '../core/sceneries';
import { blockStartMs, clampGoalMinutes, planPositionMs, sessionTimeline } from '../core/session';
import type { ActiveSession, GardenState, PlantInstance, SessionLogEntry, Store } from '../core/state';
import type { SpeciesDef, Tier } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { extendDebug } from './debug';
import { plantRandomly } from './fill-garden';

/** One session in progress, as `sprout.sessions()` reports it. */
export interface DebugSessionInfo {
  id: string;
  taskName: string;
  speciesId: string;
  sceneryId: SceneryId;
  slotId: string;
  active: boolean;
  running: boolean;
  /** plan position (session time + skipped breaks), ms */
  elapsedMs: number;
  totalRemainingMs: number;
  growth: number;
  pausedAt: number | null;
  focusWaterings: number;
}

export interface DebugStartOptions {
  /** default 'Test task' */
  taskName?: string;
  /** default 'unbroken' */
  planId?: string;
  /** default: the first selectable (unlocked) species that fits some slot */
  speciesId?: string;
  /** default: the garden on view */
  sceneryId?: SceneryId;
  /** default: the first free compatible slot, else the first compatible one */
  slotId?: string;
}

/** A plant for `setState`; `sceneryId` may be left out (validation reads it as the default scenery). */
export type DebugPlant = Omit<PlantInstance, 'sceneryId'> & { sceneryId?: SceneryId };
export type DebugStatePatch = Partial<Omit<GardenState, 'plants'>> & { plants?: DebugPlant[] };

/** Core-logic additions to `window.sprout` (docs/systems/core.md › Debug API). */
declare module './debug' {
  interface SproutDebug {
    /** Fresh default garden (saved). */
    reset(): void;
    /** Seed the rng used for session ids, weather, plant seeds and `addPlants`. */
    seed(n: number): void;
    /**
     * Start a session with sensible defaults (total default: last goal). With others in progress
     * the new one becomes active and the active one waits; null at the limit of three.
     */
    start(goalMinutes?: number, opts?: DebugStartOptions): ActiveSession | null;
    /** Start `n` sessions one after another ("Task 1" …), each `gapMs` (default 0) of dev time apart; returns their ids. */
    startSessions(n: number, goalMinutes?: number, gapMs?: number): string[];
    /** Every session in progress, oldest start first. */
    sessions(): DebugSessionInfo[];
    /** Make another session in progress the active one (resumes it; the active one waits). */
    switchTo(id: string): boolean;
    /** The session log (ended sessions, oldest first). */
    log(): SessionLogEntry[];
    /** Focused time until the active session's next automatic watering (ms), or null. */
    nextFocusWatering(): number | null;
    /**
     * Jump the dev clock to the active session's next automatic focus watering and run the check,
     * so it plays now. Returns false when none is left or the session is paused / in a break.
     */
    focusWater(): boolean;
    pause(): boolean;
    resume(): boolean;
    /** End the active session (or the one with `id`). */
    cancel(id?: string): boolean;
    water(): boolean;
    skipBreak(): boolean;
    /** Jump the dev clock to the start of the next break. Returns its block index, or -1. */
    toBreak(): number;
    /** Jump the dev clock forward to the start of block `i` (resuming if paused). */
    skipToBlock(i: number): boolean;
    /** Jump the dev clock to the end of the plan (resuming if paused); returns the finished plant. */
    completeSession(): PlantInstance | null;
    plans(goalMinutes: number): StudyPlan[];
    /** `{ id, tier, locked, earned }` for a total. */
    selectableSpecies(goalMinutes: number): Array<{ id: string; tier: Tier; locked: boolean; earned: boolean }>;
    /**
     * Compatible slots of a garden (default: the one on view) for a species (default: the active
     * session's): `{ id, habitat, occupiedBy? }`.
     */
    placementOptions(speciesId?: string, sceneryId?: SceneryId): Array<{ id: string; habitat: string; occupiedBy?: string }>;
    /** Instantly add up to `n` finished plants (optionally of one tier) in free slots of a garden (default: the one on view). Returns how many. */
    addPlants(n: number, tier?: Tier, sceneryId?: SceneryId): number;
    /** Shallow-merge into the state (validated). Throws on an invalid result. */
    setState(partial: DebugStatePatch): GardenState;
    status(): SessionStatus;
    /** Write any pending debounced save now. */
    flush(): void;
    exportState(): string;
    importState(json: string): ImportResult;
  }
}

export interface CoreDebugDeps {
  store: Store;
  controller: SessionController;
  clock: SpeedClock;
  species: readonly SpeciesDef[];
  /** each scenery's slots; a plain list is the default scenery's */
  slots: readonly Slot[] | SlotsOf<Slot>;
  saver?: Saver;
  isKnownSpecies?: (id: string) => boolean;
}

export function installCoreDebug(deps: CoreDebugDeps): void {
  const { store, controller, clock, species, saver } = deps;
  const slotsOf = slotsOfAny(deps.slots);
  let fillRng: Rng = createRng(clock.now()).fork('dev-fill');

  const firstSlot = (speciesId: string, sceneryId: SceneryId): string | undefined => {
    const opts = controller.placementOptions(speciesId, sceneryId);
    return (opts.find((o) => !o.occupiedBy) ?? opts[0])?.slot.id;
  };

  /** Resume if paused, then jump the dev clock so the plan position reaches `targetMs`. */
  const jumpTo = (targetMs: number): boolean => {
    if (store.get().session?.pausedAt != null) controller.resume();
    const s = store.get().session;
    if (!s) return false;
    const delta = targetMs - planPositionMs(s, clock.now());
    if (delta < 0) return false;
    clock.advance(delta);
    controller.check();
    return true;
  };

  const start = (goalMinutes?: number, opts: DebugStartOptions = {}): ActiveSession | null => {
    const total = clampGoalMinutes(goalMinutes ?? store.get().settings.lastGoalMinutes);
    const sceneryId = opts.sceneryId ?? store.get().scenery;
    const speciesId =
      opts.speciesId ??
      controller
        .selectableSpecies(total)
        .find((s) => !s.locked && firstSlot(s.species.id, sceneryId) !== undefined)?.species.id;
    if (!speciesId) return null;
    const slotId = opts.slotId ?? firstSlot(speciesId, sceneryId);
    if (!slotId) return null;
    const ok = controller.start({
      taskName: opts.taskName ?? 'Test task',
      goalMinutes: total,
      planId: opts.planId ?? 'unbroken',
      speciesId,
      sceneryId,
      slotId,
    });
    return ok ? store.get().session : null;
  };

  extendDebug({
    reset() {
      store.dispatch({ type: 'state/reset', now: clock.now() });
      saver?.flush();
    },
    seed(n) {
      controller.setSeed(n);
      fillRng = createRng(n).fork('dev-fill');
    },
    start,
    startSessions(n, goalMinutes, gapMs = 0) {
      const ids: string[] = [];
      for (let i = 0; i < n; i++) {
        if (i > 0 && gapMs > 0) clock.advance(gapMs);
        const s = start(goalMinutes, { taskName: `Task ${i + 1}` });
        if (!s) break;
        ids.push(s.id);
      }
      return ids;
    },
    sessions: () =>
      controller.status().sessions.map((x) => ({
        id: x.session.id,
        taskName: x.session.taskName,
        speciesId: x.session.speciesId,
        sceneryId: x.sceneryId,
        slotId: x.session.slotId,
        active: x.active,
        running: x.running,
        elapsedMs: x.timeline.elapsedMs,
        totalRemainingMs: x.timeline.totalRemainingMs,
        growth: x.timeline.growth,
        pausedAt: x.session.pausedAt,
        focusWaterings: x.session.focusWaterings,
      })),
    switchTo: (id) => controller.switchTo(id),
    log: () => store.get().log,
    nextFocusWatering: () => controller.nextFocusWatering(),
    focusWater() {
      const st = controller.status();
      if (!st.session || st.phase !== 'focus') return false;
      const inMs = controller.nextFocusWatering();
      if (inMs === null) return false;
      const before = store.get().session!.focusWaterings;
      if (inMs > 0) clock.advance(inMs);
      controller.check();
      return (store.get().session?.focusWaterings ?? before) > before;
    },
    pause: () => controller.pause(),
    resume: () => controller.resume(),
    cancel: (id) => controller.cancel(id),
    water: () => controller.water(),
    skipBreak: () => controller.skipBreak(),
    toBreak() {
      const s = store.get().session;
      if (!s) return -1;
      const current = sessionTimeline(s, clock.now()).blockIndex;
      const i = s.plan.blocks.findIndex((b, idx) => idx > current && b.kind === 'break');
      if (i < 0) return -1;
      return jumpTo(blockStartMs(s.plan, i)!) ? i : -1;
    },
    skipToBlock(i) {
      const s = store.get().session;
      const start = s ? blockStartMs(s.plan, i) : null;
      return start === null ? false : jumpTo(start);
    },
    completeSession() {
      const s = store.get().session;
      if (!s) return null;
      jumpTo(s.goalMs);
      return store.get().plants.find((p) => p.id === s.id) ?? null;
    },
    plans: (goalMinutes) => controller.recommendPlans(goalMinutes),
    selectableSpecies: (goalMinutes) =>
      controller
        .selectableSpecies(goalMinutes)
        .map((s) => ({ id: s.species.id, tier: s.species.tier, locked: s.locked, earned: s.earned })),
    placementOptions(speciesId, sceneryId) {
      const id = speciesId ?? store.get().session?.speciesId;
      if (!id) return [];
      return controller.placementOptions(id, sceneryId).map((o) => ({
        id: o.slot.id,
        habitat: o.slot.habitat,
        ...(o.occupiedBy ? { occupiedBy: o.occupiedBy.speciesId } : {}),
      }));
    },
    addPlants(n, tier, sceneryId = store.get().scenery) {
      const { state, added } = plantRandomly(store.get(), fillRng, species, slotsOf(sceneryId), n, clock.now(), tier, sceneryId);
      if (added.length > 0) store.dispatch({ type: 'state/replace', state });
      return added.length;
    },
    setState(partial) {
      const r = validateState({ ...store.get(), ...partial }, { now: clock.now() });
      if (!r.ok) throw new Error(`setState: ${r.error.message}`);
      store.dispatch({ type: 'state/replace', state: r.value.state });
      return store.get();
    },
    status: () => controller.status(),
    flush: () => saver?.flush(),
    exportState: () => exportState(store.get(), clock.now()),
    importState(json) {
      const r = importState(json, { isKnownSpecies: deps.isKnownSpecies, now: clock.now() });
      if (r.ok) store.dispatch({ type: 'state/replace', state: r.state });
      return r;
    },
  });
}
