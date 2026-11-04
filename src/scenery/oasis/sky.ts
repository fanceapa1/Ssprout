/**
 * The oasis's four painted skies, cut to its skyline, and the sky mirrored into the basin (O5,
 * ADR 0301): desert light, all of it standing over the notch where the low suns are (ADR 0300).
 * Same watercolour language as the other skies, on white; the paper is multiplied last.
 */
import type { DayPhase } from '../../ambience/daylight';
import { reserveStar, stars, type Star } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, lighten, mix, type Painter, type Pigment } from '../../paint';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import type { ScenerySky } from '../types';
import { OASIS_SKY_LAYOUT, openSky, SKY_TOP, SKYLINE, skylineAt } from './layout';
import { bluffTopAt } from './paint-rocks';

/** The band the sky plates cover: from above the world down past the far range (y 340). */
export const OASIS_SKY_RECT: Rect = { x: 0, y: SKY_TOP, w: WORLD_W, h: 620 };

/** The basin's turquoise, which every phase's mirrored sky keeps (the sunset plate greyed it, devlog 110). */
export const TURQUOISE: Pigment = '#3fb3ad';

/** The desert's own colours, beside the shared pigments. */
const DESERT = {
  dust: '#a9b9c4',
  bleach: '#f6ecd6',
  roseGold: '#efc0a4',
  coral: '#e66f5c',
  apricot: '#f39a5c',
  ember: '#f2b04e',
  plum: '#5a3f7c',
  night: '#1f2a5e',
} satisfies Record<string, Pigment>;

/**
 * How far the washes hang under the skyline: a short hang over the bluff and the ksar (paper must
 * not show at their edge, a long one would tint the pale pisé), down to 44 over the far range,
 * which takes the distance's colour, but never onto the bluff's shoulder in front of it.
 */
function hangAt(x: number, y: number): number {
  const rock = bluffTopAt(x);
  if (x < 880) return 4;
  return Math.max(4, Math.min(44, rock - y - 3));
}

/** The washes' outline: the skyline with its hang, closed over the top of the plate. */
export function plateSky(): Pt[] {
  const line = SKYLINE.map((q) => ({ x: q.x, y: q.y + hangAt(q.x, q.y) }));
  return [{ x: -80, y: SKY_TOP - 40 }, { x: 1680, y: SKY_TOP - 40 }, ...line.reverse()];
}

const band = (y0: number, y1: number, x0 = -80, x1 = WORLD_W + 80): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** A glow round a low sun. */
function glow(cx: number, cy: number, rx: number, ry: number): Pt[] {
  return Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
}

/** A thin desert cloud streak: a crisp pooled top, a lost lower edge, the low sun's colour dropped under it. */
function streak(p: Painter, rng: Rng, x: number, y: number, len: number, h: number, pigment: Pigment, opacity: number, lit: Pigment): void {
  for (let k = 0; k < rng.int(2, 3); k++) {
    const l = len * rng.range(0.4, 0.75);
    const cx = x - len / 2 + rng.range(l / 2, len - l / 2);
    const cy = y + rng.range(-h, h);
    p.wash(blob(cx, cy, l / 2, h * rng.range(0.7, 1.2), rng, { irregularity: 0.4, rotation: rng.range(-0.04, 0.02) }), pigment, {
      rng,
      opacity: opacity * rng.range(0.75, 1),
      deform: 0.16,
      spread: 0.25,
      edge: 0.3,
      edgeWidth: 1.2,
      sharpness: 0.45,
      centreLift: 0.15,
      granulation: 0.08,
      flow: 0.6,
      flowScale: 30,
      fade: { angle: Math.PI / 2, start: 0.4, amount: 0.85, ragged: 0.6 },
      drops: [{ pigment: lit, at: { x: cx + rng.range(-0.2, 0.2) * l, y: cy + h * 0.5 }, size: 0.4, alpha: 0.6 }],
    });
  }
}

/** The night's extra stars: a dense desert field over the whole open sky, smaller and fainter than the shared 30. */
export const OASIS_NIGHT_STARS: readonly Star[] = stars(240, 'oasis-stars', {
  ...OASIS_SKY_LAYOUT,
  stars: { top: -40, depth: 380, gap: null },
})
  .filter((s) => s.y < skylineAt(s.x) - 14)
  .map((s) => ({ ...s, r: s.r * 0.9, a: s.a * 0.95 }));

/** The Milky Way's line across the night sky, from the upper left down toward the notch. */
export const MILKY_WAY = { x0: 60, y0: 0, x1: 1540, y1: 250 } as const;

/** The four phases' plates, clipped to the washes' outline. */
export function paintOasisSky(p: Painter, rng: Rng, phase: DayPhase): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.beginPath();
  plateSky().forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
  paintPhaseSky(p, rng, phase);
  ctx.restore();
}

function paintPhaseSky(p: Painter, rng: Rng, phase: DayPhase): void {
  // deeper than the plate: a wash smooths its outline, so it would leave paper in the crenels
  const sky = openSky(48);
  const { sunriseX, sunsetX, horizonY } = OASIS_SKY_LAYOUT;
  switch (phase) {
    case 'midday': {
      // a high, dusty blue bleached to almost white over the horizon: hot, not the garden's soft blue
      p.wetInWet(sky, mix(PIGMENTS.cerulean, DESERT.dust, 0.22), DESERT.bleach, {
        rng,
        angle: Math.PI / 2,
        split: 0.6,
        softness: 0.8,
        fingers: 0.2,
        opacity: 0.52,
        deform: 0.03,
        edge: 0.05,
        centreLift: 0.03,
        granulation: 0.28,
        flow: 0.45,
        flowScale: 260,
        fade: { angle: Math.PI / 2, start: 0.6, amount: 0.9, ragged: 0.4 },
      });
      // the deepest blue straight up, still in a wide screen's top edge
      p.glaze(band(SKY_TOP - 40, 150), mix(PIGMENTS.cerulean, PIGMENTS.ultramarine, 0.15), { rng, opacity: 0.2, fade: { angle: Math.PI / 2, start: 0.45, amount: 1, ragged: 0.5 } });
      // the dust haze over the horizon, warm, thickest in the notch where the heat shimmers
      p.glaze(band(190, 380), mix(DESERT.bleach, PIGMENTS.ochre, 0.12), { rng, opacity: 0.22, deform: 0.05, fade: { angle: -Math.PI / 2, start: 0.25, amount: 1, ragged: 0.5 } });
      p.glaze(glow(1000, 330, 520, 70), mix(DESERT.bleach, PIGMENTS.gold, 0.2), { rng, opacity: 0.18, deform: 0.12, fade: { angle: -Math.PI / 2, start: 0.35, amount: 1, ragged: 0.6 } });
      break;
    }
    case 'sunrise': {
      // pale lilac-rose overhead into rose-gold low in the notch, where the sun comes up
      p.wetInWet(sky, lighten(mix(PIGMENTS.bellflower, PIGMENTS.rose, 0.45), 0.18), DESERT.roseGold, {
        rng,
        angle: Math.PI / 2,
        split: 0.45,
        softness: 0.7,
        opacity: 0.42,
        deform: 0.03,
        edge: 0.06,
        centreLift: 0.04,
        granulation: 0.12,
        flow: 0.35,
        flowScale: 320,
      });
      p.glaze(glow(sunriseX, horizonY - 30, 420, 150), lighten(PIGMENTS.gold, 0.25), { rng, opacity: 0.4, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.9, ragged: 0.5 } });
      // the low haze over the grove, lying along the far range
      p.glaze(band(240, 380, 760), mix(DESERT.roseGold, DESERT.bleach, 0.4), { rng, opacity: 0.34, deform: 0.06, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.6 } });
      streak(p, rng, 1260, 180, 460, 6, mix(PIGMENTS.violet, PIGMENTS.rose, 0.45), 0.22, lighten(PIGMENTS.gold, 0.15));
      streak(p, rng, 330, 130, 420, 5, mix(PIGMENTS.violet, PIGMENTS.rose, 0.4), 0.1, DESERT.roseGold);
      break;
    }
    case 'sunset': {
      // deep violet overhead, coral through the middle, apricot and ember low where the sun sinks
      p.wetInWet(sky, mix(PIGMENTS.violet, DESERT.plum, 0.4), DESERT.apricot, {
        rng,
        angle: Math.PI / 2,
        split: 0.66,
        softness: 0.6,
        opacity: 0.6,
        deform: 0.03,
        edge: 0.08,
        centreLift: 0.05,
        granulation: 0.1,
        flow: 0.35,
        flowScale: 320,
      });
      p.wash(band(110, 330), DESERT.coral, {
        rng,
        opacity: 0.3,
        deform: 0.05,
        edge: 0.05,
        sharpness: 0.3,
        centreLift: 0,
        flow: 0.5,
        flowScale: 140,
        fade: { angle: -Math.PI / 2, start: 0.35, amount: 0.9, ragged: 0.5 },
      });
      p.glaze(glow(sunsetX + 30, horizonY - 30, 480, 160), DESERT.ember, { rng, opacity: 0.46, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.45, amount: 0.9, ragged: 0.5 } });
      streak(p, rng, 1250, 210, 520, 8, mix(PIGMENTS.violet, PIGMENTS.crimson, 0.35), 0.4, mix(DESERT.coral, DESERT.ember, 0.5));
      streak(p, rng, 380, 90, 520, 7, mix(PIGMENTS.violet, PIGMENTS.crimson, 0.25), 0.22, DESERT.coral);
      streak(p, rng, 960, 10, 460, 7, mix(PIGMENTS.violet, PIGMENTS.rose, 0.3), 0.26, PIGMENTS.rose);
      break;
    }
    case 'night': {
      // deep granulating indigo, a paler violet-blue glow along the far range
      p.wetInWet(sky, mix(DESERT.night, PIGMENTS.ultramarine, 0.25), mix(PIGMENTS.ultramarine, PIGMENTS.violet, 0.3), {
        rng,
        angle: Math.PI / 2,
        split: 0.55,
        softness: 0.65,
        opacity: 0.42,
        deform: 0.03,
        edge: 0.1,
        centreLift: 0.04,
        granulation: 0.16,
        flow: 0.4,
        flowScale: 300,
      });
      p.glaze(band(SKY_TOP - 40, 140), mix(DESERT.night, PIGMENTS.violet, 0.15), { rng, opacity: 0.2, fade: { angle: Math.PI / 2, start: 0.35, amount: 1, ragged: 0.4 } });
      // the Milky Way: a soft lifted drift slanting across, broken along its length
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        p.lift(blob(MILKY_WAY.x0 + t * (MILKY_WAY.x1 - MILKY_WAY.x0), MILKY_WAY.y0 + t * (MILKY_WAY.y1 - MILKY_WAY.y0) + rng.range(-14, 14), rng.range(90, 150), rng.range(18, 34), rng, { irregularity: 0.5, rotation: 0.17 }), {
          rng,
          amount: rng.range(0.25, 0.4),
          deform: 0.6,
          spread: 0.7,
          layers: 6,
          sharpness: 0.03,
        });
      }
      for (const s of stars(30, 'stars', OASIS_SKY_LAYOUT)) reserveStar(p.ctx, s);
      for (const s of OASIS_NIGHT_STARS) reserveStar(p.ctx, s);
      break;
    }
  }
}

/** Each phase's mirrored sky on the basin: turquoise always, the far edge a little of the horizon, the near the zenith. */
export const OASIS_WATER_SKY: Record<DayPhase, { far: Pigment; near: Pigment; glints: Pigment | null }> = {
  midday: { far: mix(TURQUOISE, DESERT.bleach, 0.3), near: mix(TURQUOISE, PIGMENTS.cerulean, 0.3), glints: DESERT.bleach },
  sunrise: { far: mix(TURQUOISE, DESERT.roseGold, 0.22), near: mix(TURQUOISE, PIGMENTS.bellflower, 0.25), glints: DESERT.roseGold },
  sunset: { far: mix(TURQUOISE, DESERT.coral, 0.16), near: mix(TURQUOISE, PIGMENTS.ultramarine, 0.12), glints: mix(DESERT.coral, DESERT.ember, 0.4) },
  night: { far: mix(PIGMENTS.indigo, TURQUOISE, 0.4), near: mix(PIGMENTS.ultramarine, TURQUOISE, 0.45), glints: null },
};

/** The basin's mirrored sky: turquoise under every sky, with the sky's colour in broken streaks. */
export function paintOasisWaterSky(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void {
  const far = box.y;
  const near = box.y + box.h;
  const whole: Pt[] = [
    { x: box.x - 20, y: far - 10 },
    { x: box.x + box.w + 20, y: far - 10 },
    { x: box.x + box.w + 20, y: near + 10 },
    { x: box.x - 20, y: near + 10 },
  ];
  const w = OASIS_WATER_SKY[phase];
  p.wetInWet(whole, w.far, w.near, { rng, angle: Math.PI / 2, split: 0.45, softness: 0.7, opacity: 0.85, deform: 0.02, edge: 0.04, centreLift: 0, granulation: 0.06, flow: 0.5, flowScale: 60 });
  if (w.glints) {
    // the sky's colour caught in slow ripples, more of it toward the far edge
    for (let i = 0; i < 12; i++) {
      const y = far + rng.next() ** 1.6 * (near - far);
      const len = rng.range(60, 200);
      p.glaze({ cx: rng.range(box.x + 30, box.x + box.w - 30), cy: y, rx: len / 2, ry: rng.range(1.5, 3) }, w.glints, { rng, opacity: rng.range(0.3, 0.55), deform: 0.25, spread: 0.3 });
    }
  }
  for (let i = 0; i < 10; i++) {
    const y = far + rng.range(0.05, 0.95) * (near - far);
    const len = rng.range(50, 160);
    p.lift({ cx: rng.range(box.x, box.x + box.w), cy: y, rx: len / 2, ry: rng.range(1, 2.2) }, { rng, amount: rng.range(0.2, 0.4), deform: 0.25, spread: 0.3, layers: 5 });
  }
}

/** The oasis's sky (O5, ADR 0301): its layout with the sun on the right (ADR 0300), plates and open-sky shape. */
export const OASIS_SKY: ScenerySky = {
  layout: OASIS_SKY_LAYOUT,
  rect: OASIS_SKY_RECT,
  shape: openSky,
  paint: paintOasisSky,
  paintWater: paintOasisWaterSky,
};
