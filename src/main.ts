import './style.css';
import { createSpeedClock, realClock, type Clock } from './core/clock';
import { createSessionController } from './core/controller';
import { createEventBus } from './core/events';
import { createSaver, loadState, type StorageLike } from './core/persistence';
import { createReducer, createStore } from './core/state';
import { installCoreDebug } from './dev/core-debug';
import { installDebug, isDev } from './dev/debug';
import { allSpecies, getSpecies } from './plants/registry';
import { createRenderer } from './render/renderer';
import { placeholderScene } from './scene/geometry';
import { createPlaceholderBackground } from './scene/placeholder-background';

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

  const scene = placeholderScene;
  const species = allSpecies();
  const isKnownSpecies = (id: string) => getSpecies(id) !== undefined;
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
  void renderer.add(createPlaceholderBackground());
  renderer.start();

  if (speedClock) {
    installDebug({ store, renderer, clock: speedClock });
    installCoreDebug({ store, controller, clock: speedClock, species, slots: scene.slots, saver: saver ?? undefined, isKnownSpecies });
  }
}

boot();
