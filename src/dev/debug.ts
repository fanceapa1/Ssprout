import type { SpeedClock } from '../core/clock';
import type { GardenState, Store } from '../core/state';
import type { Renderer } from '../render/renderer';

/**
 * `window.sprout` — the ?dev debug API used by e2e tests and screenshots.
 * Other modules add methods with `extendDebug({...})` and augment `SproutDebug` via
 * declaration merging:
 *
 *   declare module '../dev/debug' { interface SproutDebug { addPlants(n: number): void } }
 */
export interface SproutDebug {
  /** Current garden state (live object; do not mutate). */
  state(): GardenState;
  /** Resolves once the renderer has initialised every system for the current size. */
  ready(): Promise<void>;
  /** Stop animation and render one stable frame (resolves after it is drawn). */
  freeze(): Promise<void>;
  unfreeze(): void;
  /** Change the dev clock speed (1 = real time). */
  setSpeed(n: number): void;
}

declare global {
  interface Window {
    sprout?: SproutDebug;
  }
}

export function isDev(search: string = location.search): boolean {
  return new URLSearchParams(search).has('dev');
}

export interface DebugDeps {
  store: Store;
  renderer: Renderer;
  clock: SpeedClock;
}

export function installDebug({ store, renderer, clock }: DebugDeps): SproutDebug {
  const api: SproutDebug = {
    state: () => store.get(),
    ready: () => renderer.whenReady(),
    async freeze() {
      await renderer.whenReady();
      renderer.freeze();
    },
    unfreeze: () => renderer.unfreeze(),
    setSpeed: (n) => clock.setSpeed(n),
  };
  window.sprout = api;
  return api;
}

/** Add methods to `window.sprout` (no-op outside ?dev). */
export function extendDebug(methods: Partial<SproutDebug> & Record<string, unknown>): void {
  if (window.sprout) Object.assign(window.sprout, methods);
}
