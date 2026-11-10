import { extendDebug } from '../dev/debug';
import type { SceneGeometry, Slot } from './geometry';
import type { PrepaintStats, SceneStats, SceneSystem } from './system';

declare module '../dev/debug' {
  interface SproutDebug {
    /** Scene geometry slots (world units). */
    slots(): Slot[];
    /** Paint counters and per-step timings of the last background paint. */
    sceneStats(): SceneStats;
    /** Resolves when no background repaint is pending. */
    scenePainted(): Promise<void>;
    /** Daylight skies: plates painted, composites built, ms spent painting skies. */
    skyStats(): ReturnType<SceneSystem['skyStats']>;
    /** The camera's detail painting (its view, painting, fade-in) and the whole-world extension. */
    sceneDetail(): ReturnType<SceneSystem['detailStats']>;
    /** Gardens not on view pre-painted into the paint cache: painted, found stored, cancelled, CPU (ADR 0339). */
    scenePrepaint(): PrepaintStats;
  }
}

/** `?dev` hooks for the scene (e2e tests, perf review). */
export function installSceneDebug(system: SceneSystem, scene: SceneGeometry): void {
  extendDebug({
    slots: () => scene.slots.map((s) => ({ ...s })),
    sceneStats: () => system.stats(),
    scenePainted: () => system.whenPainted(),
    skyStats: () => system.skyStats(),
    sceneDetail: () => system.detailStats(),
    scenePrepaint: () => system.prepaintStats(),
  });
}
