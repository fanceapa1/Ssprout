import type { SpeedClock } from '../core/clock';
import type { SessionController, SessionStatus } from '../core/controller';
import { exportState, importState, validateState, type ImportResult, type Saver } from '../core/persistence';
import { createRng, type Rng } from '../core/rng';
import { remainingMs } from '../core/session';
import type { ActiveSession, GardenState, PendingReward, PlantInstance, Store } from '../core/state';
import type { SpeciesDef, Tier } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { extendDebug } from './debug';
import { plantRandomly } from './fill-garden';

/** Core-logic additions to `window.sprout` (docs/systems/core.md › Debug API). */
declare module './debug' {
  interface SproutDebug {
    /** Fresh default garden (saved). */
    reset(): void;
    /** Seed the rng used for session ids, weather, offers, plant seeds and `addPlants`. */
    seed(n: number): void;
    /** Start a session (default: last goal). */
    start(goalMinutes?: number): ActiveSession | null;
    pause(): boolean;
    resume(): boolean;
    cancel(): boolean;
    /** Jump the dev clock to the end of the session (resuming it if paused) and complete it. */
    completeSession(): PendingReward | null;
    /** Choose an offered species (default: the first option). */
    choose(speciesId?: string): boolean;
    /** Plant the chosen species (default: the first free compatible slot, else the first one). */
    place(slotId?: string): PlantInstance | null;
    /** Compatible slots for the chosen species: `{ id, habitat, occupiedBy? }`. */
    placementOptions(): Array<{ id: string; habitat: string; occupiedBy?: string }>;
    /** Instantly plant up to `n` random species (optionally of one tier) in free slots. Returns how many. */
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

  extendDebug({
    reset() {
      store.dispatch({ type: 'state/reset', now: clock.now() });
      saver?.flush();
    },
    seed(n) {
      controller.setSeed(n);
      fillRng = createRng(n).fork('dev-fill');
    },
    start: (goalMinutes) => controller.start(goalMinutes),
    pause: () => controller.pause(),
    resume: () => controller.resume(),
    cancel: () => controller.cancel(),
    completeSession() {
      if (store.get().session?.pausedAt != null) controller.resume();
      const s = store.get().session;
      if (s) {
        clock.advance(remainingMs(s, clock.now()));
        controller.check();
      }
      return store.get().pendingReward;
    },
    choose(speciesId) {
      const id = speciesId ?? store.get().pendingReward?.options[0];
      return id ? controller.choose(id) : false;
    },
    place(slotId) {
      const opts = controller.placementOptions();
      const id = slotId ?? (opts.find((o) => !o.occupiedBy) ?? opts[0])?.slot.id;
      return id ? controller.place(id) : null;
    },
    placementOptions: () =>
      controller.placementOptions().map((o) => ({
        id: o.slot.id,
        habitat: o.slot.habitat,
        ...(o.occupiedBy ? { occupiedBy: o.occupiedBy.speciesId } : {}),
      })),
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
