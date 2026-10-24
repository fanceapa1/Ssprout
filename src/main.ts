import './style.css';
import { createGardenAudio } from './audio';
import { installAudioDebug } from './audio/debug';
import { addAmbience, createDaylightSource } from './ambience';
import { createSpeedClock, realClock, type Clock } from './core/clock';
import { createSessionController } from './core/controller';
import { createScheduler } from './core/schedule-controller';
import { createEventBus } from './core/events';
import { createSaver, loadState, type StorageLike } from './core/persistence';
import { createReducer, createStore } from './core/state';
import { installCoreDebug } from './dev/core-debug';
import { installDebug, isDev } from './dev/debug';
import { installScheduleDebug } from './dev/schedule-debug';
import { withFixtures } from './dev/fixture-species';
import { createFakeWidget, installUiDebug } from './dev/ui-debug';
import { installPlantsDebug } from './plants/debug';
import { installCameraDebug } from './dev/camera-debug';
import { plantWorldBounds } from './plants/bounds';
import { allSpecies } from './plants/registry';
import { createPlantSystem } from './plants/system';
import { setPlantViewSpecies } from './plants/view';
import { createFauna } from './fauna';
import { createRenderer } from './render/renderer';
import { gardenScene } from './scene/geometry';
import { createUI } from './ui';
import { applyUiLight } from './ui/ambient-light';
import { createTimerSurfaces } from './widget';
import { installWidgetDebug } from './widget/dev';
import { installSceneDebug } from './scene/debug';
import { installPaintCacheDebug } from './paint/debug';
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
  // one daylight for every system that paints or behaves with it (docs/systems/daylight.md)
  const daylight = createDaylightSource();
  const sceneSystem = createSceneSystem({ invalidate: (layer) => renderer.invalidate(layer), showSlots: dev && params.has('slots'), daylight });
  void renderer.add(createPaperSystem());
  void renderer.add(sceneSystem);
  // plants: finished + growing sprites, wither, watering, reflections (docs/systems/plants.md)
  setPlantViewSpecies(getSpecies);
  const plants = createPlantSystem({ getSpecies, daylight });
  void renderer.add(plants);
  void renderer.add(createFauna({ species: getSpecies, debug: dev, daylight }));
  renderer.start();
  // nothing is drawn while the garden stage is scrolled out of view (ADR 0224)
  renderer.pauseWhenOffscreen(canvas.closest('#stage') ?? canvas);

  // Timer surfaces: worker ticker, tab title/favicon, notifications (asked inside session:start),
  // the floating widget (docs/systems/widget.md).
  const surfaces = createTimerSurfaces({ controller, store, bus, clock });
  // scheduled sessions tick on the same worker, so a background tab notices them (ADR 0174)
  const scheduler = createScheduler({ store, clock, bus, ticker: surfaces.internals.ticker });

  // UI over the canvas (docs/systems/ui.md).
  const audio = createGardenAudio({ bus, getState: store.get, clock });
  const fakeWidget = dev && params.get('widget') === 'fake' ? createFakeWidget() : null;
  const uiTime = Number(params.get('uitime'));
  const uiRoot = document.querySelector<HTMLElement>('#ui')!;
  const ui = createUI({
    root: uiRoot,
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
    schedules: scheduler,
    // the camera over the garden: gestures, focus on the growing plant, plant cards (docs/systems/camera.md)
    camera: { camera: renderer.camera, hitTest: (p, tolerance) => plants.hitTest(p, tolerance) },
    whenGardenReady: () => renderer.whenReady(),
  });
  plants.connectPlacement(ui.placement);

  if (speedClock) {
    installDebug({ store, renderer, clock: speedClock });
    installAudioDebug(audio);
    installCoreDebug({ store, controller, clock: speedClock, species, slots: scene.slots, saver: saver ?? undefined, isKnownSpecies });
    installUiDebug({ ui, clock: speedClock, widget: fakeWidget, viewport: () => renderer.viewport, slots: scene.slots });
    installWidgetDebug({ surfaces, controller, store, bus });
    installSceneDebug(sceneSystem, scene);
    installPlantsDebug(plants);
    installPaintCacheDebug();
    installScheduleDebug({ store, scheduler, clock: speedClock, ui, species });
    installCameraDebug({
      renderer,
      ui,
      slots: scene.slots,
      // a small plant's box at the slot (PLANT_SIZES.small)
      boundsForSlot: (slotId) => {
        const slot = scene.slots.find((s) => s.id === slotId);
        return slot ? plantWorldBounds({ size: { w: 86, h: 86 }, anchor: { x: 0.5, y: 0.92 } }, slot) : null;
      },
      plantBounds: (id) => plants.plantBounds(id),
      whenDetail: async () => {
        await sceneSystem.whenPainted();
        await plants.ready();
        // the light plate's detail paints in idle callbacks, a phase at a time
        for (let i = 0; i < 300 && ambience.lightDetail() && !ambience.lightDetail()!.ready; i++) await new Promise((r) => setTimeout(r, 20));
      },
    });
  }
  const ambience = addAmbience(renderer, { dev: speedClock !== null, daylight });
  // the time-of-day wash eases in once the landscape is painted (never on bare paper), and the
  // DOM slips and paper dabs follow the garden's light from then on (ADR 0121)
  const painted = renderer.whenReady();
  ambience.revealLightAfter(painted);
  void painted.then(() => ambience.onLight((grade) => applyUiLight(uiRoot, grade)));
}

boot();
