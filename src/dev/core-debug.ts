import type { SpeedClock } from '../core/clock';
import type { SessionController, SessionStatus } from '../core/controller';
import { exportState, importState, validateState, type ImportResult, type Saver } from '../core/persistence';
import type { StudyPlan } from '../core/plans';
import { createRng, type Rng } from '../core/rng';
import { blockStartMs, clampGoalMinutes, planPositionMs, sessionTimeline } from '../core/session';
import type { ActiveSession, GardenState, PlantInstance, Store } from '../core/state';
import type { SpeciesDef, Tier } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { extendDebug } from './debug';
import { plantRandomly } from './fill-garden';

export interface DebugStartOptions {
  /** default 'Test task' */
  taskName?: string;
  /** default 'unbroken' */
  planId?: string;
  /** default: the first selectable (unlocked) species that fits some slot */
  speciesId?: string;
  /** default: the first free compatible slot, else the first compatible one */
  slotId?: string;
}

/** Core-logic additions to `window.sprout` (docs/systems/core.md › Debug API). */
declare module './debug' {
  interface SproutDebug {
    /** Fresh default garden (saved). */
    reset(): void;
    /** Seed the rng used for session ids, weather, plant seeds and `addPlants`. */
    seed(n: number): void;
    /** Start a session with sensible defaults (total default: last goal). */
    start(goalMinutes?: number, opts?: DebugStartOptions): ActiveSession | null;
    pause(): boolean;
    resume(): boolean;
    cancel(): boolean;
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
    /** Compatible slots for a species (default: the active session's): `{ id, habitat, occupiedBy? }`. */
    placementOptions(speciesId?: string): Array<{ id: string; habitat: string; occupiedBy?: string }>;
    /** Instantly add up to `n` finished plants (optionally of one tier) in free slots. Returns how many. */
    addPlants(n: number, tier?: Tier): number;
    /** Shallow-merge into the state (validated). Throws on an invalid result. */
    setState(partial: Partial<GardenState>): GardenState;
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
  slots: readonly Slot[];
  saver?: Saver;
  isKnownSpecies?: (id: string) => boolean;
}

export function installCoreDebug(deps: CoreDebugDeps): void {
  const { store, controller, clock, species, slots, saver } = deps;
  let fillRng: Rng = createRng(clock.now()).fork('dev-fill');

  const firstSlot = (speciesId: string): string | undefined => {
    const opts = controller.placementOptions(speciesId);
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

  extendDebug({
    reset() {
      store.dispatch({ type: 'state/reset', now: clock.now() });
      saver?.flush();
    },
    seed(n) {
      controller.setSeed(n);
      fillRng = createRng(n).fork('dev-fill');
    },
    start(goalMinutes, opts = {}) {
      const total = clampGoalMinutes(goalMinutes ?? store.get().settings.lastGoalMinutes);
      const speciesId =
        opts.speciesId ??
        controller
          .selectableSpecies(total)
          .find((s) => !s.locked && firstSlot(s.species.id) !== undefined)?.species.id;
      if (!speciesId) return null;
      const slotId = opts.slotId ?? firstSlot(speciesId);
      if (!slotId) return null;
      const ok = controller.start({
        taskName: opts.taskName ?? 'Test task',
        goalMinutes: total,
        planId: opts.planId ?? 'unbroken',
        speciesId,
        slotId,
      });
      return ok ? store.get().session : null;
    },
    pause: () => controller.pause(),
    resume: () => controller.resume(),
    cancel: () => controller.cancel(),
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
    placementOptions(speciesId) {
      const id = speciesId ?? store.get().session?.speciesId;
      if (!id) return [];
      return controller.placementOptions(id).map((o) => ({
        id: o.slot.id,
        habitat: o.slot.habitat,
        ...(o.occupiedBy ? { occupiedBy: o.occupiedBy.speciesId } : {}),
      }));
    },
    addPlants(n, tier) {
      const { state, added } = plantRandomly(store.get(), fillRng, species, slots, n, clock.now(), tier);
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
