/**
 * The coast's placeholder skies (G1): one wash per phase cut to its skyline, a glow where the low
 * sun stands over the sea, the stars at night, and a plain mirrored sky for the sea. The daylight
 * task paints the real plates. Same watercolour language as the other skies, on white.
 */
import type { DayPhase } from '../../ambience/daylight';
import { reserveStar, stars } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, lighten, mix, type Painter, type Pigment } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import type { SkyPainters } from '../types';
import { COAST_SKY_LAYOUT, openSky } from './layout';

/** Zenith, horizon, the low glow, and the wash's strength per phase. */
const PLATES: Record<DayPhase, { top: Pigment; low: Pigment; glow: Pigment | null; opacity: number }> = {
  midday: { top: mix(PIGMENTS.cerulean, PIGMENTS.ultramarine, 0.2), low: lighten(PIGMENTS.cerulean, 0.6), glow: null, opacity: 0.4 },
  sunrise: { top: mix(PIGMENTS.bellflower, PIGMENTS.violet, 0.3), low: lighten(PIGMENTS.apricot, 0.2), glow: lighten(PIGMENTS.gold, 0.2), opacity: 0.44 },
  sunset: { top: mix(PIGMENTS.violet, PIGMENTS.rose, 0.4), low: mix(PIGMENTS.apricot, PIGMENTS.rose, 0.3), glow: PIGMENTS.gold, opacity: 0.5 },
  night: { top: mix(PIGMENTS.indigo, PIGMENTS.ultramarine, 0.35), low: mix(PIGMENTS.ultramarine, PIGMENTS.violet, 0.4), glow: null, opacity: 0.32 },
};

/** One phase's sky, clipped to the open sky with a short hang under the skyline. */
export function paintCoastSky(p: Painter, rng: Rng, phase: DayPhase): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.beginPath();
  openSky(4).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
  const plate = PLATES[phase];
  p.wetInWet(openSky(48), plate.top, plate.low, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.7, opacity: plate.opacity, deform: 0.03, edge: 0.06, centreLift: 0.04, granulation: 0.1, flow: 0.45, flowScale: 260 });
  if (plate.glow) {
    const x = phase === 'sunset' ? COAST_SKY_LAYOUT.sunsetX : COAST_SKY_LAYOUT.sunriseX;
    p.glaze(blob(x, COAST_SKY_LAYOUT.horizonY - 60, 360, 130, rng, { irregularity: 0.3 }), plate.glow, { rng, opacity: 0.34, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.9, ragged: 0.5 } });
  }
  if (phase === 'night') for (const s of stars(30, 'stars', COAST_SKY_LAYOUT)) reserveStar(ctx, s);
  ctx.restore();
}

/** The sea's mirrored sky: the horizon's haze at the far edge, the zenith nearer. */
export function paintCoastWaterSky(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void {
  const whole: Pt[] = [
    { x: box.x - 20, y: box.y - 10 },
    { x: box.x + box.w + 20, y: box.y - 10 },
    { x: box.x + box.w + 20, y: box.y + box.h + 10 },
    { x: box.x - 20, y: box.y + box.h + 10 },
  ];
  const plate = PLATES[phase];
  p.wetInWet(whole, plate.low, mix(plate.top, PIGMENTS.celadonMid, 0.3), { rng, angle: Math.PI / 2, split: 0.45, softness: 0.7, opacity: 0.6, deform: 0.02, edge: 0.04, centreLift: 0, granulation: 0.06, flow: 0.5, flowScale: 80 });
}

export const COAST_SKY_PAINTERS: SkyPainters = { paint: paintCoastSky, paintWater: paintCoastWaterSky };
