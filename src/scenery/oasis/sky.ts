/**
 * The oasis's placeholder skies (O1): one warm golden wash per phase cut to its skyline, a glow
 * where the low sun stands, the stars at night, and a plain mirrored sky for the basin. O5 paints
 * the real plates. Same watercolour language as the other skies, on white (paper multiplied last).
 */
import type { DayPhase } from '../../ambience/daylight';
import { reserveStar, stars } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, lighten, mix, type Painter, type Pigment } from '../../paint';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import type { ScenerySky } from '../types';
import { OASIS_SKY_LAYOUT, openSky, SKY_TOP } from './layout';

/** The band the sky plates cover: from above the world down past the far range (y 340). */
export const OASIS_SKY_RECT: Rect = { x: 0, y: SKY_TOP, w: WORLD_W, h: 620 };

/** Zenith, horizon, the low glow, and the wash's strength per phase. */
const PLATES: Record<DayPhase, { top: Pigment; low: Pigment; glow: Pigment | null; opacity: number }> = {
  midday: { top: mix(PIGMENTS.cerulean, PIGMENTS.ultramarine, 0.15), low: lighten(PIGMENTS.gold, 0.35), glow: null, opacity: 0.4 },
  sunrise: { top: mix(PIGMENTS.bellflower, PIGMENTS.violet, 0.3), low: lighten(PIGMENTS.apricot, 0.2), glow: lighten(PIGMENTS.gold, 0.2), opacity: 0.44 },
  sunset: { top: mix(PIGMENTS.violet, PIGMENTS.rose, 0.4), low: mix(PIGMENTS.ochre, PIGMENTS.apricot, 0.35), glow: PIGMENTS.gold, opacity: 0.52 },
  night: { top: mix(PIGMENTS.indigo, PIGMENTS.ultramarine, 0.35), low: mix(PIGMENTS.ultramarine, PIGMENTS.violet, 0.4), glow: null, opacity: 0.32 },
};

/** One phase's sky, clipped to the open sky with a short hang under the skyline. */
export function paintOasisSky(p: Painter, rng: Rng, phase: DayPhase): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.beginPath();
  openSky(4).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
  const plate = PLATES[phase];
  p.wetInWet(openSky(48), plate.top, plate.low, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.7, opacity: plate.opacity, deform: 0.03, edge: 0.06, centreLift: 0.04, granulation: 0.1, flow: 0.45, flowScale: 260 });
  if (plate.glow) {
    const x = phase === 'sunset' ? OASIS_SKY_LAYOUT.sunsetX : OASIS_SKY_LAYOUT.sunriseX;
    p.glaze(blob(x, OASIS_SKY_LAYOUT.horizonY - 60, 360, 130, rng, { irregularity: 0.3 }), plate.glow, { rng, opacity: 0.34, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.9, ragged: 0.5 } });
  }
  if (phase === 'night') for (const s of stars(30, 'stars', OASIS_SKY_LAYOUT)) reserveStar(ctx, s);
  ctx.restore();
}

/** The basin's mirrored sky: the bluff's warm shade at the far edge, the zenith nearer. */
export function paintOasisWaterSky(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void {
  const whole: Pt[] = [
    { x: box.x - 20, y: box.y - 10 },
    { x: box.x + box.w + 20, y: box.y - 10 },
    { x: box.x + box.w + 20, y: box.y + box.h + 10 },
    { x: box.x - 20, y: box.y + box.h + 10 },
  ];
  const plate = PLATES[phase];
  p.wetInWet(whole, mix(plate.low, PIGMENTS.celadonMid, 0.35), plate.top, { rng, angle: Math.PI / 2, split: 0.45, softness: 0.7, opacity: 0.8, deform: 0.02, edge: 0.04, centreLift: 0, granulation: 0.06, flow: 0.5, flowScale: 60 });
}

/** The oasis's sky: its layout, placeholder plates and open-sky shape (ADR 0241). */
export const OASIS_SKY: ScenerySky = {
  layout: OASIS_SKY_LAYOUT,
  rect: OASIS_SKY_RECT,
  shape: openSky,
  paint: paintOasisSky,
  paintWater: paintOasisWaterSky,
};
