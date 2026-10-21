/** `window.sprout` additions for the ambience (?dev). docs/systems/ambience.md › Dev. */
import type { Weather } from '../core/state';
import { extendDebug } from '../dev/debug';
import type { AmbienceSystem } from './system';
import type { TimeOverride } from './timeofday';

declare module '../dev/debug' {
  interface SproutDebug {
    /** Lighting hour: 'morning' | 'noon' | 'evening' | 'dusk' | 'night' | hour (0–24) | null (follow the clock). */
    setTime(value: TimeOverride): void;
    /** Preview a weather without a session (null: back to the session's weather). Jumps straight to steady state. */
    setWeather(weather: Weather | null): void;
    /** Jump every ambience transition (crossfades, pause) to its steady state — for stable screenshots. */
    settleAmbience(): void;
    /** Ambience readout: phase, levels, hour, particle counts, average draw cost (ms/frame). */
    ambience(): ReturnType<AmbienceSystem['debug']>;
  }
}

export function installAmbienceDebug(system: AmbienceSystem): void {
  extendDebug({
    setTime: (value: TimeOverride) => system.setTime(value),
    setWeather: (weather: Weather | null) => system.setWeather(weather),
    settleAmbience: () => system.settle(),
    ambience: () => system.debug(),
  });
}
