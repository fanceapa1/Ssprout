import type { SceneryId } from '../core/sceneries';
import type { Store } from '../core/state';
import type { SceneryHost } from '../scenery/host';
import type { Scenery } from '../scenery/types';
import { extendDebug } from './debug';

declare module './debug' {
  interface SproutDebug {
    /** The garden on view and the sceneries these URL flags offer (`?dev&scenery=waterfall`). */
    scenery(): { viewed: SceneryId; available: SceneryId[]; fade: number };
    /** Show another garden (as `scenery/view`); resolves once it is ready. Rejects an unavailable id. */
    showScenery(id: SceneryId): Promise<void>;
  }
}

/** `?dev` hooks for switching sceneries (ADR 0243). */
export function installSceneryDebug(deps: { store: Store; host: SceneryHost; available: readonly Scenery[]; fade: () => number }): void {
  extendDebug({
    scenery: () => ({ viewed: deps.host.viewed().id, available: deps.available.map((s) => s.id), fade: deps.fade() }),
    showScenery: async (id: SceneryId) => {
      if (!deps.available.some((s) => s.id === id)) throw new Error(`scenery "${id}" is not available`);
      deps.store.dispatch({ type: 'scenery/view', id });
      await deps.host.whenReady();
    },
  });
}
