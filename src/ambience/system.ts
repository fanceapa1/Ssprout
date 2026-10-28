/**
 * Render-system adapter: reads the session phase/weather and plants from the store, the hour
 * from the Clock (or a dev override) and drives the ambience engine in three layers:
 * `waterSurface` (ripples, glints), `ambience` (the sun glaze, grades, mist, leaf glints, rain, motes) and
 * `lighting` (time-of-day wash, lantern).
 */
import { sessionPhase } from '../core/session';
import type { Store, Weather } from '../core/state';
import type { LayerId, System } from '../render/types';
import type { CameraView } from '../render/camera';
import type { SceneGeometry } from '../scene/geometry';
import { createAmbience, type Ambience, type AmbienceDebug, type AmbienceScenery } from './ambience';
import { moteEmitters, type Emitter } from './motes';
import type { Grade } from './timeofday';
import type { TimeOverride } from './daylight';
import { createDaylightSource, type DaylightSource } from './daylight-source';
import { lightPlatesPending, type LightArt } from './cast';

export const WEATHER_PREVIEWS: readonly (Weather | null)[] = ['sun', 'rain', 'mist', null];

export interface AmbienceSystem extends System {
  /** dev: 'sunrise' | 'midday' | 'sunset' | 'night' (+ v1 aliases), a blend {from,to,t}, an hour, or null (follow the clock) */
  setTime(value: TimeOverride): void;
  /** dev: preview a weather without a session (null = back to the session's) */
  setWeather(weather: Weather | null): void;
  /** dev/tests: jump every transition to its steady state */
  settle(): void;
  debug(): (AmbienceDebug & { ms: number; timeOverride: string | null; location: { lat: number; lon: number; source: string; zone: string | null }; sunTimes: Record<string, string | null> | null }) | null;
  /** the daylight this system paints with (shared with the scene, plants and fauna) */
  readonly daylight: DaylightSource;
  /** the clock time (epoch ms) of the last frame */
  now(): number;
  /** the sharp light plate for the camera's resting view: wanted rect, scale, painted yet (null: none) */
  lightDetail(): ReturnType<Ambience['lightDetail']>;
  /** called with the time-of-day grade whenever the lighting repaints (e.g. to tint the DOM UI) */
  onLight(fn: (grade: Grade) => void): () => void;
  /**
   * Keep the time-of-day wash off until `ready` resolves (the landscape is painted), then ease
   * it in — on a first load at night the indigo wash and lantern otherwise float on bare paper.
   */
  revealLightAfter(ready: Promise<unknown>): void;
}

/** Seconds the lighting takes to ease in once revealed. */
const LIGHT_REVEAL_S = 1.4;
/** Longest wait (s) for the light plates' paint-cache lookups before revealing anyway (ADR 0236). */
const LIGHT_LOOKUP_WAIT_S = 0.3;

export interface AmbienceSystemOptions {
  seed?: string;
  /** the garden's daylight (default: its own, following the clock at the zone's location) */
  daylight?: DaylightSource;
  /** painting-only layout the light plates throw shadows from (default: the scenery's) */
  lightArt?: LightArt;
  /** the scenery's id, light art and ambience numbers (ADR 0241) */
  scenery?: AmbienceScenery;
}

const NO_EMITTERS: readonly Emitter[] = [];

export function createAmbienceSystem(opts: AmbienceSystemOptions = {}): AmbienceSystem {
  let engine: Ambience | null = null;
  let engineScene: SceneGeometry | null = null;
  /** the scenery the engine was built for: another one (ADR 0243) builds it again */
  let scenery: AmbienceScenery | undefined = opts.scenery;
  let store: Store | null = null;
  const daylight = opts.daylight ?? createDaylightSource();
  let seenVersion = -1;
  let lastNow = 0;
  let preview: Weather | null = null;
  /** moving average of the per-frame draw cost (ms), and the current frame's running sum */
  let ms = 0;
  let frameMs = 0;
  const lightListeners = new Set<(grade: Grade) => void>();
  let lightPaints = -1;
  /** 0..1 how much of the lighting shows; `revealing` while it eases in */
  let reveal = 1;
  let revealing = false;
  /** once `ready`: seconds waited for the light plates' lookups before revealing (-1: not waiting) */
  let lightWait = -1;
  let reducedMotion = false;
  let camera: CameraView | null = null;
  let seenDetail = -1;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  const timed = (fn: () => void) => {
    const t0 = now();
    fn();
    frameMs += now() - t0;
  };

  return {
    id: 'ambience',
    daylight,
    now: () => lastNow,
    lightDetail: () => engine?.lightDetail() ?? null,
    init(ctx) {
      store = ctx.store;
      reducedMotion = ctx.reducedMotion;
      camera = ctx.camera ?? null;
      seenDetail = -1;
      const switched = !!ctx.scenery && ctx.scenery.id !== scenery?.id;
      if (ctx.scenery && switched) scenery = ctx.scenery;
      if (!engine || engineScene !== ctx.scene || switched) {
        const lightArt = switched ? undefined : opts.lightArt;
        engine = createAmbience({ scene: ctx.scene, reducedMotion: ctx.reducedMotion, seed: opts.seed, area: ctx.viewport.visible, lightArt, scenery });
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
      // the light is revealed once its plates' paint-cache lookups have answered (after one
      // update has asked for them), so the first lit frame does not paint a plate the cache is
      // about to give (ADR 0236); a still frame or a slow store does not wait
      if (lightWait >= 0) {
        if (f.dt === 0 || lightWait >= LIGHT_LOOKUP_WAIT_S || (lightWait > 0 && !lightPlatesPending())) {
          lightWait = -1;
          revealing = true;
        } else lightWait += Math.max(f.dt, 1e-6);
      }
      if (revealing) {
        reveal = reducedMotion || f.dt === 0 ? 1 : Math.min(1, reveal + f.dt / LIGHT_REVEAL_S);
        if (reveal >= 1) revealing = false;
      }
      const e = engine;
      const state = store.get();
      const phase = sessionPhase(state, f.now);
      timed(() => e.update({
        dt: f.dt,
        phase,
        weather: state.session?.weather ?? null,
        emitters: phase === 'focus' || e.level('motes') > 0.001 ? moteEmitters(state, engineScene!.slots, f.now) : NO_EMITTERS,
        light: daylight.at(f.now),
        lightChanged: daylight.version !== seenVersion,
      }));
      seenVersion = daylight.version;
      lastNow = f.now;
      // the camera came to rest somewhere new: a sharp light plate for that view (ADR 0163)
      if (camera && camera.detailVersion !== seenDetail && !camera.moving()) {
        seenDetail = camera.detailVersion;
        const v = camera.detailView();
        e.setDetail(camera.isOverview() ? null : v.visible, v.pixelScale);
      }
      if (lightListeners.size) {
        const { grade, paints } = e.light();
        if (paints !== lightPaints) {
          lightPaints = paints;
          for (const fn of lightListeners) fn(grade);
        }
      }
    },
    draw(layer: LayerId, ctx, f) {
      const e = engine;
      if (!e) return;
      if (layer === 'waterSurface') timed(() => e.drawWater(ctx));
      else if (layer === 'ambience') timed(() => e.drawAir(ctx));
      else if (layer === 'lighting') timed(() => e.drawLighting(ctx, reveal * reveal * (3 - 2 * reveal), f?.view?.visible));
    },
    setTime(value) {
      daylight.setOverride(value);
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
      if (revealing || lightWait >= 0) {
        reveal = 1;
        revealing = false;
        lightWait = -1;
      }
    },
    debug() {
      if (!engine) return null;
      const loc = daylight.location(lastNow);
      const times = daylight.at(lastNow).times;
      const iso = (t: number | null | undefined) => (t == null ? null : new Date(t).toISOString());
      return {
        ...engine.debug(),
        ms,
        timeOverride: daylight.override()?.label ?? null,
        location: { lat: loc.lat, lon: loc.lon, source: loc.source, zone: loc.zone },
        sunTimes: times ? { dawn: iso(times.dawn), sunrise: iso(times.sunrise), noon: iso(times.noon), sunset: iso(times.sunset), dusk: iso(times.dusk) } : null,
      };
    },
    revealLightAfter(ready) {
      reveal = 0;
      revealing = false;
      lightWait = -1;
      void ready.then(() => {
        lightWait = 0;
      });
    },
    onLight(fn) {
      lightListeners.add(fn);
      lightPaints = -1;
      return () => {
        lightListeners.delete(fn);
      };
    },
    dispose() {
      engine = null;
      store = null;
    },
  };
}
