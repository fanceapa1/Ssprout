/**
 * Ambience & lighting: session weather (sun / rain / mist), photosynthesis motes, the shared
 * wind field and the four painted daylight phases. docs/systems/ambience.md,
 * docs/systems/daylight.md.
 */
import type { Renderer } from '../render/renderer';
import { SHRUBS, TREES } from '../scene/layout';
import type { DaylightSource } from './daylight-source';
import { installAmbienceDebug } from './dev';
import { createAmbienceSystem, type AmbienceSystem } from './system';

/** Register the ambience system (and its `window.sprout` methods in dev). */
export function addAmbience(renderer: Renderer, opts: { dev?: boolean; daylight?: DaylightSource } = {}): AmbienceSystem {
  const system = createAmbienceSystem({ daylight: opts.daylight, lightArt: { trees: TREES, shrubs: SHRUBS } });
  void renderer.add(system);
  if (opts.dev) installAmbienceDebug(system);
  return system;
}

export { createAmbienceSystem, type AmbienceSystem } from './system';
export { wind, windBoost, createWind, type WindFn, type WindSample } from './wind';
export { gradeAt, gradeFor, localHour, NAMED_HOURS, type Grade } from './timeofday';
export { createDaylightSource, pinnedSource, type DaylightSource } from './daylight-source';
export { PHASES, type DayPhase, type DaylightState, type TimeOverride } from './daylight';
