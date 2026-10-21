import { extendDebug } from '../dev/debug';
import type { Rect } from '../render/viewport';
import type { PlantDebugState, PlantPerf, PlantSystem } from './system';
import { usingAmbienceWind } from './wind-adapter';

/** `window.sprout.plants` (?dev): plant system state for e2e tests and screenshots. */
declare module '../dev/debug' {
  interface SproutDebug {
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
      perf(): PlantPerf;
      resetPerf(): void;
      /** true when the ambience wind field is in use (else the local fallback) */
      ambienceWind(): boolean;
    };
  }
}

export function installPlantsDebug(system: PlantSystem): void {
  extendDebug({
    plants: {
      state: () => system.debugState(),
      whenIdle: () => system.whenIdle(),
      settle: () => system.settle(),
      bounds: (id: string) => system.plantBounds(id),
      boundsFor: (speciesId: string, slotId: string) => system.boundsFor(speciesId, slotId),
      toDevice: (rect: Rect) => system.toDevice(rect),
      perf: () => system.perf(),
      resetPerf: () => system.resetPerf(),
      ambienceWind: () => usingAmbienceWind,
    },
  });
}
