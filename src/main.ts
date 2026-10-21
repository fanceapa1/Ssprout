import './style.css';
import { createGardenAudio } from './audio';
import { createSpeedClock, realClock, type Clock } from './core/clock';
import { createSessionController } from './core/controller';
import { createEventBus } from './core/events';
import { createSaver, loadState, type StorageLike } from './core/persistence';
import { createReducer, createStore } from './core/state';
import { installCoreDebug } from './dev/core-debug';
import { installDebug, isDev } from './dev/debug';
import { withFixtures } from './dev/fixture-species';
import { createFakeWidget, installUiDebug } from './dev/ui-debug';
import { allSpecies } from './plants/registry';
import { createRenderer } from './render/renderer';
import { gardenScene } from './scene/geometry';
import { createUI } from './ui';
import { createTimerSurfaces } from './widget';
import { installWidgetDebug } from './widget/dev';
import { installSceneDebug } from './scene/debug';
import { createPaperSystem, createSceneSystem } from './scene/system';

/** localStorage, or null when the browser blocks it (private mode, disabled storage). */
function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#garden');
  if (!canvas) throw new Error('missing #garden canvas');

  const params = new URLSearchParams(location.search);
  const dev = isDev(location.search);
  const speed = Number(params.get('speed') ?? 1);
  const speedClock = dev ? createSpeedClock(Number.isFinite(speed) && speed >= 0 ? speed : 1) : null;
  const clock: Clock = speedClock ?? realClock;

  const scene = gardenScene;
  // ?dev&fixtures adds the dev-only fx-* species (ADR 0055)
  const species = dev && params.has('fixtures') ? withFixtures(allSpecies()) : allSpecies();
  const speciesById = new Map(species.map((s) => [s.id, s]));
  const getSpecies = (id: string) => speciesById.get(id);
  const isKnownSpecies = (id: string) => speciesById.has(id);
  const storage = browserStorage();
  const loaded = loadState(storage, clock.now(), { isKnownSpecies });
  if (loaded.status === 'recovered') console.warn('[persistence] unreadable garden backed up as', loaded.backupKey, loaded.error);
  if (loaded.warnings.unknownSpecies.length) console.warn('[persistence] unknown species', loaded.warnings.unknownSpecies);
  const saver = storage
    ? createSaver(storage, { onError: (e) => console.warn('[persistence] save failed', e) })
    : null;
  addEventListener('pagehide', () => saver?.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saver?.flush();
  });

  const slotById = new Map(scene.slots.map((s) => [s.id, s]));
  const reducer = createReducer({ getSpecies, getSlot: (id) => slotById.get(id) });
  const store = createStore(loaded.state, reducer, (next) => saver?.schedule(next));
  const bus = createEventBus();
  const controller = createSessionController({ store, clock, bus, species, slots: scene.slots });
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const renderer = createRenderer({ canvas, store, bus, clock, scene, reducedMotion });
  const sceneSystem = createSceneSystem({ invalidate: (layer) => renderer.invalidate(layer), showSlots: dev && params.has('slots') });
  void renderer.add(createPaperSystem());
  void renderer.add(sceneSystem);
  renderer.start();

  // Timer surfaces: worker ticker, tab title/favicon, notifications (asked inside session:start),
  // the floating widget (docs/systems/widget.md).
  const surfaces = createTimerSurfaces({ controller, store, bus, clock });

  // UI over the canvas (docs/systems/ui.md).
  const audio = createGardenAudio({ bus, getState: store.get, clock });
  const fakeWidget = dev && params.get('widget') === 'fake' ? createFakeWidget() : null;
  const uiTime = Number(params.get('uitime'));
  const ui = createUI({
    root: document.querySelector<HTMLElement>('#ui')!,
    controller,
    store,
    bus,
    clock,
    getSpecies,
    slots: scene.slots,
    viewport: () => renderer.viewport,
    audio,
    widget: fakeWidget ?? surfaces.widget,
    isKnownSpecies,
    reducedMotion,
    timeScale: dev && Number.isFinite(uiTime) && params.has('uitime') ? uiTime : 1,
  });

  if (speedClock) {
    installDebug({ store, renderer, clock: speedClock });
    installCoreDebug({ store, controller, clock: speedClock, species, slots: scene.slots, saver: saver ?? undefined, isKnownSpecies });
    installUiDebug({ ui, clock: speedClock, widget: fakeWidget, viewport: () => renderer.viewport, slots: scene.slots });
    installWidgetDebug({ surfaces, controller, store, bus });
    installSceneDebug(sceneSystem, scene);
  }
}

boot();
