/**
 * Shows the garden the store says is on view (`state.scenery`) and brings an active session's
 * garden into view when it becomes active (ADR 0243). docs/systems/scenery.md › Switching.
 */
import type { SceneryId } from '../core/sceneries';
import type { GardenState, Store } from '../core/state';
import type { Scenery } from './types';

export interface SceneryHost {
  /** the scenery on view (what the renderer shows or is switching to) */
  viewed(): Scenery;
  /** resolves when the garden on view is ready (painted or taken from the paint cache) */
  whenReady(): Promise<void>;
  dispose(): void;
}

export interface SceneryHostOptions {
  store: Store;
  renderer: { setScenery(s: Scenery): Promise<void>; whenReady(): Promise<void> };
  getScenery(id: SceneryId): Scenery;
}

export function createSceneryHost(opts: SceneryHostOptions): SceneryHost {
  const { store, renderer, getScenery } = opts;
  let viewed = getScenery(store.get().scenery);
  let ready: Promise<void> = renderer.whenReady();

  const show = (state: GardenState) => {
    const next = getScenery(state.scenery);
    if (next.id === viewed.id) return;
    viewed = next;
    ready = renderer.setScenery(next);
  };

  const unsubscribe = store.subscribe((next, prev) => {
    // an active session from another garden brings its garden with it (applied before its glide)
    const s = next.session;
    if (s && s.id !== prev.session?.id && s.sceneryId !== next.scenery) {
      store.dispatch({ type: 'scenery/view', id: s.sceneryId });
      return;
    }
    if (next.scenery !== prev.scenery) show(next);
  });
  show(store.get());

  return {
    viewed: () => viewed,
    whenReady: () => ready,
    dispose: unsubscribe,
  };
}
