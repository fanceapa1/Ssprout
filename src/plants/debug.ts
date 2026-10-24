import { extendDebug } from '../dev/debug';
import type { Rect } from '../render/viewport';
import type { Pt } from '../render/viewport';
import type { SpriteCacheStats } from './sprites';
import type { PlantDebugState, PlantHit, PlantPerf, PlantSystem } from './system';
import { drawPlantView, plantViewStats, prewarmPlantView, renderPlantView, setPlantViewCacheOptions, whenPlantViewsReady } from './view';
import { usingAmbienceWind } from './wind-adapter';

/** `window.sprout.plants` (?dev): plant system state for e2e tests and screenshots. */
declare module '../dev/debug' {
  interface SproutDebug {
    /**
     * Resolves once the plant system has picked up the latest store change (even one made just
     * before, without a frame in between), every sprite the garden needs is painted (sprites
     * paint in workers, asynchronously) and the plants that just appeared have faded in. Unlike
     * `plants.settle()` it does not snap growth or blooms — use it before a screenshot:
     * `sprout.addPlants(25); await sprout.plantsReady()`.
     */
    plantsReady(): Promise<void>;
    plants: {
      state(): PlantDebugState;
      /** resolves once every requested sprite is painted */
      whenIdle(): Promise<void>;
      /** snap growth/fades to their targets and resolve once their sprites are painted */
      settle(): Promise<void>;
      bounds(plantId: string): Rect | null;
      /** world rect a species would occupy in a slot */
      boundsFor(speciesId: string, slotId: string): Rect | null;
      /** world rect → canvas device pixels */
      toDevice(rect: Rect): Rect | null;
      /** the front-most plant painted at a world point (`tolerance` world units of slack) */
      hitTest(world: Pt, tolerance?: number): PlantHit | null;
      perf(): PlantPerf;
      resetPerf(): void;
      /** true when the ambience wind field is in use (else the local fallback) */
      ambienceWind(): boolean;
      /** the plant view's sprite cache (previews, widget, "Your plant"; ADRs 0220, 0221) */
      view: {
        /** cache stats plus `syncPaints`: sprites `renderPlantView` painted on the main thread */
        stats(): SpriteCacheStats & { syncPaints: number };
        /** resolves once no view sprite is queued or being painted */
        whenReady(): Promise<void>;
        /**
         * Paint one view twice, synchronously on a main-thread-only cache and prewarmed through
         * the worker, and compare the pixels. Resets the view cache (dev only).
         */
        parity(o: ViewParityOptions): Promise<ViewParity>;
      };
    };
  }
}

export interface ViewParityOptions {
  speciesId: string;
  seed: number;
  /** a whole growth step (e.g. 1 or 0.5): the first frame is then complete on both paths */
  growth: number;
  width: number;
  height: number;
}

export interface ViewParity {
  /** the prewarm resolved true */
  prewarmed: boolean;
  /** what `drawPlantView` did after the prewarm */
  drawn: string;
  /** workers of the view cache, and its main-thread paints, after the worker path */
  workers: number;
  syncPaints: number;
  /** pixels with any paint in the main-thread view */
  ink: number;
  /** largest and mean per-channel difference (RGBA, 0–255) */
  maxDiff: number;
  meanDiff: number;
}

async function viewParity(o: ViewParityOptions): Promise<ViewParity> {
  const opts = { speciesId: o.speciesId, seed: o.seed, growth: o.growth, watering: null };
  const canvas = () => Object.assign(document.createElement('canvas'), { width: o.width, height: o.height });
  const pixels = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const main = canvas();
  setPlantViewCacheOptions({ createWorker: null, scheduleIdle: () => {} });
  renderPlantView(main, opts);
  setPlantViewCacheOptions(null);
  const viaWorker = canvas();
  const prewarmed = await prewarmPlantView(viaWorker, opts);
  const drawn = drawPlantView(viaWorker, opts).state;
  const { workers, syncPaints } = plantViewStats();
  const a = pixels(main);
  const b = pixels(viaWorker);
  let maxDiff = 0;
  let sum = 0;
  let ink = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i]! - b[i]!);
    if (d > maxDiff) maxDiff = d;
    sum += d;
    if (i % 4 === 3 && a[i]! > 0) ink++;
  }
  return { prewarmed, drawn, workers, syncPaints, ink, maxDiff, meanDiff: sum / a.length };
}

export function installPlantsDebug(system: PlantSystem): void {
  extendDebug({
    plantsReady: async () => {
      // the store change lands on the next frame; give the system one to see new plants
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      await system.ready();
    },
    plants: {
      state: () => system.debugState(),
      whenIdle: () => system.whenIdle(),
      settle: () => system.settle(),
      bounds: (id: string) => system.plantBounds(id),
      boundsFor: (speciesId: string, slotId: string) => system.boundsFor(speciesId, slotId),
      toDevice: (rect: Rect) => system.toDevice(rect),
      hitTest: (world: Pt, tolerance?: number) => system.hitTest(world, tolerance),
      perf: () => system.perf(),
      resetPerf: () => system.resetPerf(),
      ambienceWind: () => usingAmbienceWind,
      view: {
        stats: () => plantViewStats(),
        whenReady: () => whenPlantViewsReady(),
        parity: (o: ViewParityOptions) => viewParity(o),
      },
    },
  });
}
