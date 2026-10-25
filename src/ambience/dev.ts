/** `window.sprout` additions for the ambience (?dev). docs/systems/ambience.md › Dev, docs/systems/daylight.md › Dev. */
import type { Weather } from '../core/state';
import { extendDebug } from '../dev/debug';
import type { DayPhase, TimeOverride } from './daylight';
import { castShadow, moonDisc, rimLight, sunDisc, type CastShadow, type Disc, type RimLight } from './sky-layout';
import { lightPlateTotals } from './cast';
import type { AmbienceSystem } from './system';

export interface DaylightDebug {
  phase: DayPhase;
  weights: Record<DayPhase, number>;
  blend: { from: DayPhase; to: DayPhase; t: number } | null;
  sunAltitude: number;
  /** the painted sun and moon (world units; alpha 0 = not shown) */
  sun: Disc;
  moon: Disc;
  moonPhase: number;
  shadow: CastShadow;
  rim: RimLight;
  /** the location in use and how it was found */
  location: { lat: number; lon: number; source: string; zone: string | null };
  /** today's sun events (ISO, UTC), null when pinned */
  sunTimes: Record<string, string | null> | null;
  override: string | null;
}

declare module '../dev/debug' {
  interface SproutDebug {
    /**
     * Daylight: 'sunrise' | 'midday' | 'sunset' | 'night', a v1 name ('morning' | 'noon' |
     * 'evening' | 'dusk' | 'dawn'), a blend `{ from, to, t }`, an hour (0–24) of today, or null
     * (follow the clock). Moves the sky, light, shadows, plants' light and fauna's night.
     */
    setTime(value: TimeOverride): void;
    /** Preview a weather without a session (null: back to the session's weather). Jumps straight to steady state. */
    setWeather(weather: Weather | null): void;
    /** Jump every ambience transition (crossfades, pause) to its steady state — for stable screenshots. */
    settleAmbience(): void;
    /** Ambience readout: phase, levels, daylight phase and weights, particle counts, average draw cost (ms/frame). */
    ambience(): ReturnType<AmbienceSystem['debug']>;
    /** the light plate's detail for the camera's resting view: rect, scale, painted yet (null: none) */
    lightDetail(): ReturnType<AmbienceSystem['lightDetail']>;
    /** The daylight now: phase weights, sun and moon, shadow and rim, location and sun times. */
    daylight(): DaylightDebug;
    /** Light plates painted, taken from the paint cache and looked up in vain so far (ADR 0236). */
    lightPlates(): ReturnType<typeof lightPlateTotals>;
  }
}

export function installAmbienceDebug(system: AmbienceSystem): void {
  extendDebug({
    setTime: (value: TimeOverride) => system.setTime(value),
    setWeather: (weather: Weather | null) => system.setWeather(weather),
    settleAmbience: () => system.settle(),
    ambience: () => system.debug(),
    lightDetail: () => system.lightDetail(),
    lightPlates: () => lightPlateTotals(),
    daylight: (): DaylightDebug => {
      const t = system.now();
      const s = system.daylight.at(t);
      const loc = system.daylight.location(t);
      const iso = (v: number | null | undefined) => (v == null ? null : new Date(v).toISOString());
      return {
        phase: s.phase,
        weights: { ...s.weights },
        blend: s.blend,
        sunAltitude: s.sunAltitude,
        sun: sunDisc(s),
        moon: moonDisc(s),
        moonPhase: s.moonPhase,
        shadow: castShadow(s),
        rim: rimLight(s),
        location: { lat: loc.lat, lon: loc.lon, source: loc.source, zone: loc.zone },
        sunTimes: s.times ? { dawn: iso(s.times.dawn), sunrise: iso(s.times.sunrise), noon: iso(s.times.noon), sunset: iso(s.times.sunset), dusk: iso(s.times.dusk) } : null,
        override: system.daylight.override()?.label ?? null,
      };
    },
  });
}
