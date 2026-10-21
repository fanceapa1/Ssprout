import { createRng } from '../core/rng';
import type { SessionPhase } from '../core/session';
import { createSimplex2D } from '../paint/noise';

/**
 * The plant system's view of the garden wind (docs/systems/plants.md › Sway).
 *
 * The ambience task owns the real field (`src/ambience/wind.ts`: `wind(t, x, y, boost?) →
 * { sway, gust }`). Until that module is on main this adapter falls back to a small local field
 * with the same signature; the glob below picks the real one up automatically once it exists, so
 * no code here has to change when it lands.
 */
export interface WindSample {
  /** signed lean, -1..1 (positive = toward +x) */
  sway: number;
  /** strength of a passing gust, 0..1 */
  gust: number;
}

export type WindFn = (t: number, x: number, y: number, boost?: number) => WindSample;

interface AmbienceWindModule {
  wind?: WindFn;
  windBoost?: (phase: SessionPhase) => number;
}

const found = import.meta.glob<AmbienceWindModule>('../ambience/wind.ts', { eager: true });
const ambience: AmbienceWindModule | undefined = Object.values(found)[0];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Local stand-in: slow base lean + flutter + travelling gusts (same shape as the ambience field). */
export function createFallbackWind(seed: number | string = 'garden-wind'): WindFn {
  const rng = createRng(seed);
  const base = createSimplex2D(rng.fork('base'));
  const flutter = createSimplex2D(rng.fork('flutter'));
  const gusts = createSimplex2D(rng.fork('gust'));
  return (t, x, y, boost = 0) => {
    const b = clamp(Number.isFinite(boost) ? boost : 0, 0, 1);
    const g = clamp((gusts(0.045 * (t - x / 140), y * 0.0007 + 3.1) - 0.15) / 0.6, 0, 1);
    const s = 0.06 + 0.42 * base(t * 0.07 + x * 0.0011, y * 0.0011) + 0.16 * (0.5 + 0.5 * g) * flutter(t * 0.55 + x * 0.006, y * 0.006 - 7.3) + 0.38 * g * g;
    return { sway: clamp(s * (1 + 0.35 * b), -1, 1), gust: g };
  };
}

/** True when the ambience task's wind field is present (the fallback is not in use). */
export const usingAmbienceWind = typeof ambience?.wind === 'function';

export const gardenWind: WindFn = ambience?.wind ?? createFallbackWind();

/** Wind boost for a session phase: focus 1, break 0.5, otherwise 0 (ambience's `windBoost`). */
export const windBoost: (phase: SessionPhase) => number =
  ambience?.windBoost ?? ((phase) => (phase === 'focus' ? 1 : phase === 'break' ? 0.5 : 0));
