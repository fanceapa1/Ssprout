import './style.css';
import { createSpeedClock, realClock, type Clock } from './core/clock';
import { createEventBus } from './core/events';
import { createDefaultState, createStore, reducer, STATE_VERSION, type GardenState } from './core/state';
import { installDebug, isDev } from './dev/debug';
import { createRenderer } from './render/renderer';
import { placeholderScene } from './scene/geometry';
import { createPlaceholderBackground } from './scene/placeholder-background';

const STORAGE_KEY = 'studysprout:v1';

/** Minimal read; src/core/persistence.ts (core logic task) replaces this with migrations + saving. */
function loadState(now: number): GardenState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GardenState> | null;
      if (parsed && parsed.version === STATE_VERSION) return { ...createDefaultState(now), ...parsed };
    }
  } catch {
    // unreadable storage → fresh garden
  }
  return createDefaultState(now);
}

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#garden');
  if (!canvas) throw new Error('missing #garden canvas');

  const params = new URLSearchParams(location.search);
  const dev = isDev(location.search);
  const speed = Number(params.get('speed') ?? 1);
  const speedClock = dev ? createSpeedClock(Number.isFinite(speed) && speed >= 0 ? speed : 1) : null;
  const clock: Clock = speedClock ?? realClock;

  const store = createStore(loadState(clock.now()), reducer);
  const bus = createEventBus();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const renderer = createRenderer({ canvas, store, bus, clock, scene: placeholderScene, reducedMotion });
  void renderer.add(createPlaceholderBackground());
  renderer.start();

  if (speedClock) installDebug({ store, renderer, clock: speedClock });
}

boot();
