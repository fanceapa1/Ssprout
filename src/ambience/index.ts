/**
 * Ambience & lighting: session weather (sun / rain / mist), photosynthesis motes, the shared
 * wind field and the four painted daylight phases. docs/systems/ambience.md,
 * docs/systems/daylight.md.
 */
import type { Renderer } from '../render/renderer';
import { JAPANESE_GARDEN } from '../scenery/japanese-garden';
import type { Scenery } from '../scenery/types';
import type { DaylightSource } from './daylight-source';
import { installAmbienceDebug } from './dev';
import { createAmbienceSystem, type AmbienceSystem } from './system';

/** Register the ambience system (and its `window.sprout` methods in dev) for a scenery (default: the Japanese garden). */
export function addAmbience(renderer: Renderer, opts: { dev?: boolean; daylight?: DaylightSource; scenery?: Scenery } = {}): AmbienceSystem {
  const system = createAmbienceSystem({ daylight: opts.daylight, scenery: opts.scenery ?? JAPANESE_GARDEN });
  void renderer.add(system);
  if (opts.dev) installAmbienceDebug(system);
  return system;
}

export { createAmbienceSystem, type AmbienceSystem } from './system';
export { wind, windBoost, createWind, type WindFn, type WindSample } from './wind';
export { gradeAt, gradeFor, localHour, NAMED_HOURS, type Grade } from './timeofday';
export { createDaylightSource, pinnedSource, type DaylightSource } from './daylight-source';
export { PHASES, type DayPhase, type DaylightState, type TimeOverride } from './daylight';
