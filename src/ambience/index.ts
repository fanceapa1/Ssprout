/**
 * Ambience & lighting: session weather (sun / rain / mist), photosynthesis motes, the shared
 * wind field and time-of-day lighting. docs/systems/ambience.md.
 */
import type { Renderer } from '../render/renderer';
import { installAmbienceDebug } from './dev';
import { createAmbienceSystem, type AmbienceSystem } from './system';

/** Register the ambience system (and its `window.sprout` methods in dev). */
export function addAmbience(renderer: Renderer, opts: { dev?: boolean } = {}): AmbienceSystem {
  const system = createAmbienceSystem();
  void renderer.add(system);
  if (opts.dev) installAmbienceDebug(system);
  return system;
}

export { createAmbienceSystem, type AmbienceSystem } from './system';
export { wind, windBoost, createWind, type WindFn, type WindSample } from './wind';
export { gradeAt, localHour, NAMED_HOURS, type Grade, type TimeOverride } from './timeofday';
