import { extendDebug } from '../dev/debug';
import type { SceneGeometry, Slot } from './geometry';
import type { SceneStats, SceneSystem } from './system';

declare module '../dev/debug' {
  interface SproutDebug {
    /** Scene geometry slots (world units). */
    slots(): Slot[];
    /** Paint counters and per-step timings of the last background paint. */
    sceneStats(): SceneStats;
    /** Resolves when no background repaint is pending. */
    scenePainted(): Promise<void>;
  }
}

/** `?dev` hooks for the scene (e2e tests, perf review). */
export function installSceneDebug(system: SceneSystem, scene: SceneGeometry): void {
  extendDebug({
    slots: () => scene.slots.map((s) => ({ ...s })),
    sceneStats: () => system.stats(),
    scenePainted: () => system.whenPainted(),
  });
}
