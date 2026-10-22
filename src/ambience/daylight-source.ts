/**
 * The garden's one daylight: the location guessed from the time zone, the dev override
 * (`sprout.setTime`) and a cached `DaylightState` per frame time. Created once in `main.ts` and
 * handed to every system that paints or behaves with the light (scene sky, ambience lighting,
 * plants' shadows and rims, fauna's night), so they always agree. Time only comes in as the
 * frame's `now` (the injected Clock). docs/systems/daylight.md, ADR 0143.
 */
import { daylightFor, parseTimeOverride, pinnedState, only, type DaylightState, type ParsedOverride, type TimeOverride } from './daylight';
import type { GeoPoint } from './solar';
import { browserLocation, type Location } from './zones';

export interface DaylightSource {
  /** the state at `now` (epoch ms from the Clock); cached while `now` and the settings hold */
  at(now: number): DaylightState;
  /** dev: pin a phase / blend / hour, or null to follow the clock (throws on bad input) */
  setOverride(value: TimeOverride): void;
  override(): ParsedOverride | null;
  /** the location in use (guessed from the zone unless set) */
  location(now: number): Location;
  /** dev/tests: use this point instead of the zone's (null: back to the guess) */
  setLocation(at: GeoPoint | null): void;
  /** increments on every override/location change (systems repaint at once instead of easing) */
  readonly version: number;
}

export interface DaylightSourceOptions {
  /** fixed location (tests, studio); default: guessed from the browser's time zone */
  location?: GeoPoint;
}

export function createDaylightSource(opts: DaylightSourceOptions = {}): DaylightSource {
  let override: ParsedOverride | null = null;
  let fixed: GeoPoint | null = opts.location ?? null;
  let guessed: Location | null = null;
  let version = 0;
  let cacheNow = NaN;
  let cacheVersion = -1;
  let cache: DaylightState | null = null;

  const location = (now: number): Location => {
    if (fixed) return { ...fixed, source: 'zone', zone: null };
    guessed ??= browserLocation(now);
    return guessed;
  };

  return {
    at(now) {
      // the light changes over minutes: one computation per second of clock time is plenty
      const key = Math.floor(now / 1000);
      if (cache && key === cacheNow && cacheVersion === version) return cache;
      cache = daylightFor(now, location(now), override);
      cacheNow = key;
      cacheVersion = version;
      return cache;
    },
    setOverride(value) {
      override = parseTimeOverride(value);
      version++;
    },
    override: () => override,
    location,
    setLocation(at) {
      fixed = at;
      version++;
    },
    get version() {
      return version;
    },
  };
}

/** A source pinned to one phase (studio, tests, systems created without the app's source). */
export function pinnedSource(phase: Parameters<typeof only>[0] = 'midday'): DaylightSource {
  const state = pinnedState(only(phase));
  return {
    at: () => state,
    setOverride() {},
    override: () => null,
    location: () => ({ lat: 40, lon: 0, source: 'offset', zone: null }),
    setLocation() {},
    version: 0,
  };
}
