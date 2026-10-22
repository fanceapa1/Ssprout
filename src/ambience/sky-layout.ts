/**
 * Where the light comes from in the painted garden — pure. Maps a `DaylightState` to world
 * positions (the sun low over the right-hand hills at sunrise, over the left-hand hills at
 * sunset; the moon arcing through the gap between the two tree groups), and to the cast shadow
 * and rim light every painted thing shares, so the sky, the cast plates, the plants and the
 * boulders all agree on one sun. docs/systems/daylight.md › Sky layout, ADR 0142.
 */
import { createRng } from '../core/rng';
import type { Pt } from '../render/viewport';
import type { DaylightState } from './daylight';

/** World y of the horizon the sun sets into (behind the far ridge, ~y 300–352). */
export const HORIZON_Y = 368;
/** World units of rise per degree of sun altitude (the sky band is short: keep it low). */
export const UNITS_PER_DEGREE = 8.5;
export const SUN_R = 22;
export const MOON_R = 17;

/** Sun x at the horizon and its drift per degree of altitude (rising sun moves left, setting right). */
const SUNRISE_X = 1130;
const SUNSET_X = 556;
const DRIFT = 2.2;

export interface Disc extends Pt {
  r: number;
  /** 0..1 how strongly it shows */
  alpha: number;
}

export function sunDisc(s: DaylightState): Disc {
  const alt = Math.max(-8, Math.min(16, s.sunAltitude));
  const x = s.sunRising ? SUNRISE_X - alt * DRIFT : SUNSET_X + alt * DRIFT;
  const low = s.weights.sunrise + s.weights.sunset;
  // a low sun only: it rises out of the frame toward midday and is gone at night
  const alpha = low * clamp01((alt + 3) / 4) * clamp01((15 - alt) / 4);
  return { x, y: HORIZON_Y - alt * UNITS_PER_DEGREE, r: SUN_R, alpha };
}

/** The moon's arc (dusk → dawn), east (right) to west (left), through the gap in the trees. */
const MOON_ARC: readonly Pt[] = [
  { x: 918, y: 236 },
  { x: 812, y: 112 },
  { x: 716, y: 196 },
];

export function moonDisc(s: DaylightState): Disc {
  const u = clamp01(s.moonProgress);
  // quadratic Bézier through the three arc points (the middle one is the control point's image)
  const [a, m, b] = MOON_ARC as [Pt, Pt, Pt];
  const c = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 };
  const x = (1 - u) ** 2 * a.x + 2 * (1 - u) * u * c.x + u * u * b.x;
  const y = (1 - u) ** 2 * a.y + 2 * (1 - u) * u * c.y + u * u * b.y;
  return { x, y, r: MOON_R, alpha: clamp01(s.weights.night * 1.25 - 0.1) };
}

export interface Star extends Pt {
  r: number;
  /** 0..1 brightness */
  a: number;
}

/**
 * A few faint stars, mostly high in the sky and clear of the moon's arc; both the night sky and
 * the night light plate leave paper at these points, so the stars survive the indigo glaze.
 */
export function stars(count = 30, seed = 'stars'): Star[] {
  const rng = createRng(seed);
  const out: Star[] = [];
  for (let i = 0; out.length < count && i < count * 10; i++) {
    const x = rng.range(20, 1580);
    const y = -200 + rng.next() ** 1.6 * 470;
    if (Math.abs(x - 812) < 120 && y > 60 && y < 260) continue;
    out.push({ x, y, r: rng.range(1.2, 2.4) * (rng.chance(0.15) ? 1.5 : 1), a: rng.range(0.5, 1) });
  }
  return out;
}

/** Leave a star as paper: a tiny feathered fleck of `paper` colour over whatever wash is there. */
export function reserveStar(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, s: Star, k = 1, paper = '255,253,248'): void {
  const r = s.r * 1.8;
  const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
  g.addColorStop(0, `rgba(${paper},${s.a * k})`);
  g.addColorStop(0.35, `rgba(${paper},${s.a * k * 0.7})`);
  g.addColorStop(1, `rgba(${paper},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
}

export interface CastShadow {
  /** horizontal reach per unit of object height (+ = toward +x) */
  dx: number;
  /** vertical reach per unit of height on the ground plane (+ = toward the viewer) */
  dy: number;
  /** darkness 0..1 */
  alpha: number;
}

/**
 * Shadows fall away from the sun: long and to the left at sunrise (the sun is on the right),
 * long and to the right at sunset, short and a little toward the viewer at midday, faint at
 * night (moonlight). Weighted over the phases so blends move the shadow continuously.
 */
export function castShadow(s: DaylightState): CastShadow {
  const w = s.weights;
  const len = (alt: number) => Math.min(2.6, 0.55 / Math.tan((Math.max(6, alt) * Math.PI) / 180));
  const low = len(Math.max(0, s.sunAltitude));
  const dx = w.sunrise * -low + w.sunset * low + w.midday * 0.07 + w.night * -0.2;
  const dy = w.sunrise * 0.12 + w.sunset * 0.12 + w.midday * 0.1 + w.night * 0.06;
  const alpha = w.sunrise * 0.5 + w.midday * 0.55 + w.sunset * 0.55 + w.night * 0.12;
  return { dx, dy, alpha };
}

export interface RimLight {
  /** the lit side: −1 = left, +1 = right */
  side: -1 | 1;
  /** 0..1 */
  strength: number;
  rgb: readonly [number, number, number];
}

/**
 * Warm light on the sun-facing edges: peach from the right at sunrise, deep gold from the left at
 * sunset (the stronger). Midday light is overhead and the moon too faint: no rim.
 */
export function rimLight(s: DaylightState): RimLight {
  const rise = s.weights.sunrise;
  const set = s.weights.sunset;
  const evening = set >= rise;
  return {
    side: evening ? -1 : 1,
    strength: clamp01(evening ? set : rise * 0.75),
    rgb: evening ? [255, 196, 128] : [255, 214, 180],
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
