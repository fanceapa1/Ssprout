import './style.css';
import { createGardenAudio } from './audio';
import { installAudioDebug } from './audio/debug';
import { addAmbience, createDaylightSource } from './ambience';
import { createSpeedClock, realClock, type Clock } from './core/clock';
import { createSessionController } from './core/controller';
import { createScheduler } from './core/schedule-controller';
import { createEventBus } from './core/events';
import { createSaver, loadState, type StorageLike } from './core/persistence';
import { slotLookup, type SceneryId } from './core/sceneries';
import { createReducer, createStore } from './core/state';
import { installCoreDebug } from './dev/core-debug';
import { installDebug, isDev } from './dev/debug';
import { installScheduleDebug } from './dev/schedule-debug';
import { withFixtures } from './dev/fixture-species';
import { createFakeWidget, installUiDebug } from './dev/ui-debug';
import { installPlantsDebug } from './plants/debug';
import { installCameraDebug } from './dev/camera-debug';
import { plantWorldBounds } from './plants/bounds';
import { floraLookup } from './plants/flora';
import { allSpecies } from './plants/registry';
import { createPlantSystem } from './plants/system';
import { setPlantViewSpecies } from './plants/view';
import { createFauna, installFaunaDebug } from './fauna';
import { createRenderer } from './render/renderer';
import { getScenery, hasScenery, sceneries } from './scenery/registry';
import { createSceneryHost } from './scenery/host';
import { installSceneryDebug } from './dev/scenery-debug';
import { gardenScene } from './scene/geometry';
import { createUI } from './ui';
import { applyUiLight } from './ui/ambient-light';
import { createTimerSurfaces } from './widget';
import { installServiceWorkerDebug, installWidgetDebug } from './widget/dev';
import { installServiceWorker } from './widget/service-worker';
import { installSceneDebug } from './scene/debug';
import { installPaintCacheDebug } from './paint/debug';
import { paintCache } from './paint/persist';
import { createPaperSystem, createSceneSystem } from './scene/system';

/** localStorage, or null when the browser blocks it (private mode, disabled storage). */
function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A boot stage mark (`sprout:boot:<name>`): e2e asserts their order (ADR 0232). */
const mark = (name: string) => performance.mark(`sprout:boot:${name}`);

/** After the browser has shown a frame: a frame, then a task (a timer when frames stall, e.g. a background tab). */
function afterPaint(): Promise<void> {
  return new Promise((done) => {
    let fired = false;
    const go = () => {
      if (fired) return;
      fired = true;
      setTimeout(done, 0);
    };
    requestAnimationFrame(go);
    setTimeout(go, 100);
  });
}

/**
 * Boot in stages (ADR 0232, docs/ARCHITECTURE.md › Boot order): the landscape starts painting in
 * the first task; the UI comes after the first frame; plants, fauna and ambience only once the
 * landscape is painted, since they stack on top of it; `window.sprout` last.
 */
async function boot(): Promise<void> {
  mark('start');
  // open the paint cache's store before anything else, so the landscape lookup finds it ready (ADR 0228)
  paintCache();
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
  // each garden's flora (ADR 0250): what its planting sheet lists and a start accepts
  const flora = floraLookup(species, (id: SceneryId) => getScenery(id).flora);
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

  const slots = slotLookup((id) => (hasScenery(id) ? getScenery(id).geometry.slots : []));
  const reducer = createReducer({ getSpecies, getSlot: slots.get, grows: flora.grows });
  const store = createStore(loaded.state, reducer, (next) => saver?.schedule(next));
  const bus = createEventBus();
  const controller = createSessionController({ store, clock, bus, species, speciesIn: flora.of, slots: slots.of });
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // the garden on view follows `state.scenery`, switched at runtime (ADR 0243)
  const available = sceneries(params);
  const pickScenery = (id: string) => available.find((s) => s.id === id) ?? available[0]!;
  const initialScenery = pickScenery(store.get().scenery);
  // the UI and the dev hooks read the garden on view at each use (ADR 0244)
  const viewedSlots = () => pickScenery(store.get().scenery).geometry.slots;
  const renderer = createRenderer({ canvas, store, bus, clock, scene, scenery: initialScenery, reducedMotion });
  const sceneryHost = createSceneryHost({ store, renderer, getScenery: pickScenery });
  // one daylight for every system that paints or behaves with it (docs/systems/daylight.md)
  const daylight = createDaylightSource();
  const sceneSystem = createSceneSystem({ art: initialScenery.art, invalidate: (layer) => renderer.invalidate(layer), showSlots: dev && params.has('slots'), daylight });
  void renderer.add(createPaperSystem());
  void renderer.add(sceneSystem);
  renderer.start();
  // nothing is drawn while the garden stage is scrolled out of view (ADR 0224)
  renderer.pauseWhenOffscreen(canvas.closest('#stage') ?? canvas);
  // resolves once the landscape is painted (or taken from the paint cache)
  const landscape = renderer.whenReady();
  mark('scene');
  await afterPaint();

  // plants: finished + growing sprites, wither, watering, reflections (docs/systems/plants.md);
  // made now for the UI, drawn from the third stage on
  setPlantViewSpecies(getSpecies);
  const plants = createPlantSystem({ getSpecies, daylight });
  /** every system registered and initialised: what the dock and the service worker wait for */
  let contents!: () => void;
  const gardenAdded = new Promise<void>((done) => (contents = done));
  const gardenReady = () => gardenAdded.then(() => renderer.whenReady());

  // Timer surfaces: worker ticker, tab title/favicon, notifications (asked inside session:start),
  // the floating widget (docs/systems/widget.md).
  const surfaces = createTimerSurfaces({ controller, store, bus, clock });
  // the caching worker registers after the first paint, on idle; a lazy chunk that a deploy
  // removed reloads the page once (ADR 0230, docs/systems/widget.md)
  const sw = installServiceWorker({ afterPaint: gardenReady() });
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
    slots: viewedSlots,
    habitatWords: () => pickScenery(store.get().scenery).habitatWords,
    sceneries: available.map(({ id, name, blurb }) => ({ id, name, blurb })),
    sceneryFade: () => renderer.sceneryFade(),
    viewport: () => renderer.viewport,
    audio,
    widget: fakeWidget ?? surfaces.widget,
    isKnownSpecies,
    reducedMotion,
    timeScale: dev && Number.isFinite(uiTime) && params.has('uitime') ? uiTime : 1,
    schedules: scheduler,
    // the camera over the garden: gestures, focus on the growing plant, plant cards (docs/systems/camera.md)
    camera: { camera: renderer.camera, hitTest: (p, tolerance) => plants.hitTest(p, tolerance) },
    whenGardenReady: gardenReady,
  });
  plants.connectPlacement(ui.placement);
  mark('ui');

  // what stacks on the landscape, a task each, once it is painted
  await landscape;
  mark('landscape');
  await afterPaint();
  void renderer.add(plants);
  mark('plants');
  await afterPaint();
  const fauna = createFauna({ species: getSpecies, daylight });
  void renderer.add(fauna);
  mark('fauna');
  await afterPaint();

  // the ambience and `window.sprout` share the last task: e2e sees the dev API whole, with every
  // system registered
  if (speedClock) {
    installDebug({ store, renderer, clock: speedClock });
    installAudioDebug(audio);
    installCoreDebug({ store, controller, clock: speedClock, species, speciesIn: flora.of, slots: slots.of, saver: saver ?? undefined, isKnownSpecies });
    installUiDebug({ ui, clock: speedClock, widget: fakeWidget, viewport: () => renderer.viewport, slots: viewedSlots });
    installWidgetDebug({ surfaces, controller, store, bus });
    installServiceWorkerDebug(sw);
    installSceneDebug(sceneSystem, { ...scene, get slots() { return viewedSlots(); } });
    installSceneryDebug({ store, host: sceneryHost, available, fade: () => renderer.sceneryFade() });
    installPlantsDebug(plants);
    installFaunaDebug(fauna);
    installPaintCacheDebug();
    installScheduleDebug({ store, scheduler, clock: speedClock, ui, species: flora.of, slots: slots.of });
    installCameraDebug({
      renderer,
      ui,
      slots: viewedSlots(),
      // a small plant's box at the slot (PLANT_SIZES.small)
      boundsForSlot: (slotId) => {
        const slot = viewedSlots().find((s) => s.id === slotId);
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
  const ambience = addAmbience(renderer, { dev: speedClock !== null, daylight, scenery: initialScenery });
  mark('ambience');
  contents();
  // the time-of-day wash eases in once the landscape is painted (never on bare paper), and the
  // DOM slips and paper dabs follow the garden's light from then on (ADR 0121)
  const painted = renderer.whenReady();
  ambience.revealLightAfter(painted);
  void painted.then(() => ambience.onLight((grade) => applyUiLight(uiRoot, grade)));
  mark('done');
}

void boot();
