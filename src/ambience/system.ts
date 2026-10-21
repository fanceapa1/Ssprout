/**
 * Render-system adapter: reads the session phase/weather and plants from the store, the hour
 * from the Clock (or a dev override) and drives the ambience engine in three layers:
 * `waterSurface` (ripples, glints), `ambience` (grades, mist, shafts, rain, motes) and
 * `lighting` (time-of-day wash, lantern).
 */
import { sessionPhase } from '../core/session';
import type { Store, Weather } from '../core/state';
import type { LayerId, System } from '../render/types';
import type { SceneGeometry } from '../scene/geometry';
import { createAmbience, type Ambience, type AmbienceDebug } from './ambience';
import { moteEmitters, type Emitter } from './motes';
import { localHour, parseTimeOverride, type TimeOverride } from './timeofday';

export const WEATHER_PREVIEWS: readonly (Weather | null)[] = ['sun', 'rain', 'mist', null];

export interface AmbienceSystem extends System {
  /** dev: 'morning' | 'noon' | 'evening' | 'dusk' | 'night' | hour | null (follow the clock) */
  setTime(value: TimeOverride): void;
  /** dev: preview a weather without a session (null = back to the session's) */
  setWeather(weather: Weather | null): void;
  /** dev/tests: jump every transition to its steady state */
  settle(): void;
  debug(): (AmbienceDebug & { ms: number; timeOverride: number | null }) | null;
}

export interface AmbienceSystemOptions {
  seed?: string;
}

const NO_EMITTERS: readonly Emitter[] = [];

export function createAmbienceSystem(opts: AmbienceSystemOptions = {}): AmbienceSystem {
  let engine: Ambience | null = null;
  let engineScene: SceneGeometry | null = null;
  let store: Store | null = null;
  let timeOverride: number | null = null;
  let preview: Weather | null = null;
  /** moving average of the per-frame draw cost (ms), and the current frame's running sum */
  let ms = 0;
  let frameMs = 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  const timed = (fn: () => void) => {
    const t0 = now();
    fn();
    frameMs += now() - t0;
  };

  return {
    id: 'ambience',
    init(ctx) {
      store = ctx.store;
      if (!engine || engineScene !== ctx.scene) {
        engine = createAmbience({ scene: ctx.scene, reducedMotion: ctx.reducedMotion, seed: opts.seed, area: ctx.viewport.visible });
        engine.preview = preview;
        engineScene = ctx.scene;
      } else {
        engine.setArea(ctx.viewport.visible);
      }
    },
    update(f) {
      if (!engine || !store) return;
      ms = ms * 0.95 + frameMs * 0.05;
      frameMs = 0;
      const state = store.get();
      const phase = sessionPhase(state, f.now);
      engine.update({
        dt: f.dt,
        phase,
        weather: state.session?.weather ?? null,
        emitters: phase === 'focus' || engine.debug().levels.motes > 0.001 ? moteEmitters(state, engineScene!.slots, f.now) : NO_EMITTERS,
        hour: timeOverride ?? localHour(f.now),
      });
    },
    draw(layer: LayerId, ctx) {
      const e = engine;
      if (!e) return;
      if (layer === 'waterSurface') timed(() => e.drawWater(ctx));
      else if (layer === 'ambience') timed(() => e.drawAir(ctx));
      else if (layer === 'lighting') timed(() => e.drawLighting(ctx));
    },
    setTime(value) {
      timeOverride = parseTimeOverride(value);
      engine?.invalidateLighting();
    },
    setWeather(weather) {
      if (weather !== null && weather !== 'sun' && weather !== 'rain' && weather !== 'mist') {
        throw new TypeError(`setWeather expects sun|rain|mist|null, got ${String(weather)}`);
      }
      preview = weather;
      if (engine) {
        engine.preview = weather;
        engine.settle();
      }
    },
    settle() {
      engine?.settle();
    },
    debug() {
      return engine ? { ...engine.debug(), ms, timeOverride } : null;
    },
    dispose() {
      engine = null;
      store = null;
    },
  };
}
