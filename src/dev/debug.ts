import type { SpeedClock } from '../core/clock';
import type { GardenState, Store } from '../core/state';
import type { Renderer } from '../render/renderer';
import type { System } from '../render/types';

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
  /** Current time of the app clock (epoch ms, accelerated by ?speed). */
  now(): number;
  /** Main-thread frame cost (update + composite) and rAF intervals over the last frames, ms. */
  frameStats(): ReturnType<Renderer['frameStats']>;
  resetFrameStats(): void;
  /** false while the garden stage is scrolled out of view and the renderer draws nothing (ADR 0224) */
  stageVisible(): boolean;
  /**
   * Leave out what systems draw, for isolating a layer in a screenshot or a pixel probe:
   * `mute({ scene: ['background'], ambience: '*' })` (system id → layers, or '*' for all, including
   * its entities); `mute({})` restores everything. Returns the registered system ids.
   */
  mute(spec: Record<string, readonly string[] | '*'>): string[];
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
  // Typed as the base methods only: augmented methods are added later via extendDebug.
  const api = {
    state: () => store.get(),
    ready: () => renderer.whenReady(),
    async freeze() {
      await renderer.whenReady();
      renderer.freeze();
    },
    unfreeze: () => renderer.unfreeze(),
    setSpeed: (n) => clock.setSpeed(n),
    now: () => clock.now(),
    frameStats: () => renderer.frameStats(),
    resetFrameStats: () => renderer.resetFrameStats(),
    stageVisible: () => renderer.visible,
    mute: (spec) => muteSystems(renderer, spec),
  } satisfies Partial<SproutDebug> as SproutDebug;
  window.sprout = api;
  return api;
}

/** Add methods to `window.sprout` (no-op outside ?dev). */
export function extendDebug(methods: Partial<SproutDebug> & Record<string, unknown>): void {
  if (window.sprout) Object.assign(window.sprout, methods);
}

type Muted = System & { __unmuted?: Pick<System, 'draw' | 'entities'> };

/** Wrap systems' draw/entities so the muted layers draw nothing (dev only). */
function muteSystems(renderer: Renderer, spec: Record<string, readonly string[] | '*'>): string[] {
  for (const raw of renderer.systems()) {
    const s = raw as Muted;
    if (s.__unmuted) {
      s.draw = s.__unmuted.draw;
      s.entities = s.__unmuted.entities;
      delete s.__unmuted;
    }
    const m = spec[s.id];
    if (!m) continue;
    const orig = { draw: s.draw, entities: s.entities };
    s.__unmuted = orig;
    const all = m === '*';
    if (orig.draw) s.draw = (layer, ctx, f) => (all || m.includes(layer) ? undefined : orig.draw!.call(s, layer, ctx, f));
    if (orig.entities && (all || m.includes('entities'))) s.entities = () => [];
  }
  renderer.invalidate();
  if (renderer.frozen) renderer.renderOnce();
  return renderer.systems().map((s) => s.id);
}
