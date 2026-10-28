/**
 * The waterfall's four painted skies, cut to its skyline, and the sky mirrored into the plunge
 * pool (ADR 0247). Same watercolour language as the garden's (`scene/paint-sky.ts`), on white;
 * the paper is multiplied last. docs/systems/daylight.md › Waterfall.
 */
import type { DayPhase } from '../../ambience/daylight';
import { reserveStar, stars } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, lighten, mix, type Painter, type Pigment } from '../../paint';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import type { ScenerySky } from '../types';
import { FAR_RIDGE, openSky, SKY_TOP, SKYLINE, skylineAt, WATERFALL_SKY_LAYOUT } from './layout';

/** The band the sky plates cover: from above the world down past the far ridge's plain (y 470). */
export const WATERFALL_SKY_RECT: Rect = { x: 0, y: SKY_TOP, w: WORLD_W, h: 740 };

/** An elliptical glow kept in the sky: nothing of it hangs more than a few units under the skyline. */
function skyGlow(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    pts.push({ x, y: Math.min(cy + Math.sin(a) * ry, skylineAt(x) + 8) });
  }
  return pts;
}

const band = (y0: number, y1: number): Pt[] => [
  { x: -80, y: y0 },
  { x: WORLD_W + 80, y: y0 },
  { x: WORLD_W + 80, y: y1 },
  { x: -80, y: y1 },
];

/** A long cloud bank laid sideways: a crisp pooled top, a lost lower edge, the lit colour dropped in. */
function bank(p: Painter, rng: Rng, x: number, y: number, len: number, h: number, pigment: Pigment, opacity: number, lit: Pigment): void {
  for (let k = 0; k < rng.int(2, 3); k++) {
    const l = len * rng.range(0.45, 0.8);
    const cx = x - len / 2 + rng.range(l / 2, len - l / 2);
    const cy = y + rng.range(-h, h) * 1.2;
    p.wash(blob(cx, cy, l / 2, h * rng.range(0.8, 1.3), rng, { irregularity: 0.35, rotation: rng.range(-0.03, 0.03) }), pigment, {
      rng,
      opacity: opacity * rng.range(0.75, 1),
      deform: 0.14,
      spread: 0.25,
      edge: 0.3,
      edgeWidth: 1.4,
      sharpness: 0.45,
      centreLift: 0.15,
      granulation: 0.05,
      flow: 0.55,
      flowScale: 26,
      fade: { angle: Math.PI / 2, start: 0.45, amount: 0.85, ragged: 0.6 },
      drops: [{ pigment: lit, at: { x: cx + rng.range(-0.2, 0.2) * l, y: cy + h * 0.5 }, size: 0.35, alpha: 0.55 }],
    });
  }
}

/** Soft whites lifted out of the wet midday blue (ADR 0184): never a cloud shape. */
function lifts(p: Painter, rng: Rng, cx: number, cy: number, w: number, h: number): void {
  for (let i = 0; i < rng.int(4, 6); i++) {
    const t = i / 5 - 0.5;
    p.lift(blob(cx + t * w, cy + rng.range(-0.35, 0.35) * h, w * rng.range(0.1, 0.18), h * rng.range(0.35, 0.65), rng, { irregularity: 0.45 }), {
      rng,
      amount: rng.range(0.28, 0.5) * (1 - Math.abs(t) * 0.6),
      deform: 0.55,
      spread: 0.6,
      layers: 8,
      sharpness: 0.04,
      fade: { angle: rng.range(0, Math.PI * 2), start: rng.range(0.3, 0.55), amount: 0.8, ragged: 0.8 },
    });
  }
}

/** The far ridge and its plain, glazed in the phase's distance colour (fades out by y 470). */
function ridge(p: Painter, rng: Rng, pigment: Pigment, opacity: number): void {
  p.glaze(FAR_RIDGE as Pt[], pigment, { rng, opacity, fade: { angle: Math.PI / 2, start: 0.3, amount: 1 } });
}

/**
 * The washes' outline: a short hang under the crown and the buttress (the pale cliff would show a
 * longer one), a deeper one over the flank and the far ridge, where the distance takes the sky.
 */
export function plateSky(): Pt[] {
  const line = SKYLINE.map((q) => ({ x: q.x, y: q.y + (q.x >= 870 ? 40 : 14) }));
  return [{ x: -80, y: SKY_TOP - 40 }, { x: 1680, y: SKY_TOP - 40 }, ...line.reverse()];
}

/**
 * One phase's sky, into a painter whose transform maps world units onto the plate. Clipped to the
 * plate's outline: the washes spread, and their bleed showed as a band on the pale cliff top.
 */
export function paintWaterfallSky(p: Painter, rng: Rng, phase: DayPhase): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.beginPath();
  plateSky().forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
  paintPhaseSky(p, rng, phase);
  ctx.restore();
  // the far ridge takes the phase's distance colour unclipped, fading out by its plain
  ridge(p, rng, ...RIDGE[phase]);
}

const RIDGE: Record<DayPhase, [Pigment, number]> = {
  midday: [mix(PIGMENTS.cerulean, PIGMENTS.bellflower, 0.4), 0.16],
  sunrise: [mix(PIGMENTS.bellflower, PIGMENTS.violet, 0.3), 0.28],
  sunset: [mix(PIGMENTS.violet, PIGMENTS.indigo, 0.25), 0.36],
  night: [mix(PIGMENTS.indigo, PIGMENTS.violet, 0.2), 0.38],
};

function paintPhaseSky(p: Painter, rng: Rng, phase: DayPhase): void {
  const sky = plateSky();
  const { sunriseX, sunsetX, horizonY } = WATERFALL_SKY_LAYOUT;
  switch (phase) {
    case 'midday': {
      // deep cerulean at the zenith, paling over the far ridge on the right
      p.wetInWet(sky, mix(PIGMENTS.cerulean, PIGMENTS.ultramarine, 0.22), lighten(PIGMENTS.cerulean, 0.3), {
        rng,
        angle: Math.PI / 2,
        split: 0.5,
        softness: 0.75,
        fingers: 0.3,
        opacity: 0.52,
        deform: 0.03,
        edge: 0.06,
        centreLift: 0.04,
        granulation: 0.2,
        flow: 0.5,
        flowScale: 230,
        fade: { angle: Math.PI / 2, start: 0.85, amount: 0.8, ragged: 0.4 },
      });
      for (const [x, y, w] of [
        [300, -130, 560],
        [1200, -40, 600],
      ] as const) {
        p.glaze(blob(x, y, w / 2, w * 0.16, rng, { irregularity: 0.5 }), mix(PIGMENTS.cerulean, PIGMENTS.ultramarine, 0.4), {
          rng,
          opacity: 0.12,
          deform: 0.5,
          spread: 0.5,
          fade: { angle: rng.range(0, Math.PI * 2), start: 0.2, amount: 1, ragged: 0.7 },
        });
      }
      p.glaze(band(280, 400), lighten(PIGMENTS.gold, 0.4), { rng, opacity: 0.1, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1 } });
      lifts(p, rng, 1220, 150, 560, 56);
      lifts(p, rng, 380, 60, 480, 64);
      lifts(p, rng, 820, -120, 520, 70);
      break;
    }
    case 'sunrise': {
      // violet-blue overhead into a peach dawn low on the right, where the sun comes up
      p.wetInWet(sky, mix(PIGMENTS.bellflower, PIGMENTS.violet, 0.35), lighten(PIGMENTS.apricot, 0.25), {
        rng,
        angle: Math.PI / 2,
        split: 0.5,
        softness: 0.6,
        opacity: 0.46,
        deform: 0.03,
        edge: 0.08,
        centreLift: 0.05,
        granulation: 0.08,
        flow: 0.35,
        flowScale: 320,
      });
      p.wash(band(120, 400), mix(PIGMENTS.rose, PIGMENTS.apricot, 0.55), {
        rng,
        opacity: 0.26,
        deform: 0.05,
        edge: 0.05,
        sharpness: 0.3,
        centreLift: 0,
        flow: 0.5,
        flowScale: 140,
        fade: { angle: Math.PI, start: 0.3, amount: 1, ragged: 0.5 },
      });
      p.glaze(skyGlow(sunriseX, horizonY - 40, 380, 140), lighten(PIGMENTS.ochre, 0.3), { rng, opacity: 0.36, deform: 0.1, fade: { angle: Math.PI, start: 0.45, amount: 0.9, ragged: 0.5 } });
      bank(p, rng, 1260, 236, 520, 9, mix(PIGMENTS.violet, PIGMENTS.bellflower, 0.45), 0.36, mix(PIGMENTS.rose, PIGMENTS.apricot, 0.5));
      bank(p, rng, 1000, 296, 300, 6, mix(PIGMENTS.rose, PIGMENTS.violet, 0.35), 0.3, PIGMENTS.apricot);
      bank(p, rng, 300, 120, 440, 8, mix(PIGMENTS.violet, PIGMENTS.bellflower, 0.5), 0.24, mix(PIGMENTS.rose, PIGMENTS.apricot, 0.3));
      break;
    }
    case 'sunset': {
      // dusky rose-violet overhead, crimson, then amber low behind the buttress where the sun sets
      p.wetInWet(sky, mix(PIGMENTS.violet, PIGMENTS.rose, 0.45), mix(PIGMENTS.ochre, PIGMENTS.apricot, 0.4), {
        rng,
        angle: Math.PI / 2,
        split: 0.55,
        softness: 0.55,
        opacity: 0.55,
        deform: 0.03,
        edge: 0.08,
        centreLift: 0.05,
        granulation: 0.08,
        flow: 0.35,
        flowScale: 320,
      });
      p.wash(band(100, 340), mix(PIGMENTS.crimson, PIGMENTS.rose, 0.4), {
        rng,
        opacity: 0.28,
        deform: 0.05,
        edge: 0.05,
        sharpness: 0.3,
        centreLift: 0,
        flow: 0.5,
        flowScale: 140,
        fade: { angle: -Math.PI / 2, start: 0.3, amount: 0.9, ragged: 0.5 },
      });
      p.glaze(skyGlow(sunsetX + 40, horizonY - 40, 460, 150), PIGMENTS.ochre, { rng, opacity: 0.42, deform: 0.1, fade: { angle: Math.PI, start: 0.5, amount: 0.9, ragged: 0.5 } });
      bank(p, rng, 1240, 250, 560, 10, mix(PIGMENTS.violet, PIGMENTS.crimson, 0.4), 0.42, mix(PIGMENTS.crimson, PIGMENTS.ochre, 0.4));
      bank(p, rng, 420, 130, 520, 9, mix(PIGMENTS.crimson, PIGMENTS.violet, 0.3), 0.34, PIGMENTS.ochre);
      bank(p, rng, 900, 40, 480, 8, mix(PIGMENTS.violet, PIGMENTS.rose, 0.4), 0.28, PIGMENTS.rose);
      break;
    }
    case 'night': {
      // granulating indigo overhead, a paler ultramarine glow along the far ridge
      p.wetInWet(sky, mix(PIGMENTS.indigo, PIGMENTS.ultramarine, 0.35), mix(PIGMENTS.ultramarine, PIGMENTS.cerulean, 0.45), {
        rng,
        angle: Math.PI / 2,
        split: 0.5,
        softness: 0.65,
        opacity: 0.3,
        deform: 0.03,
        edge: 0.1,
        centreLift: 0.04,
        granulation: 0.1,
        flow: 0.4,
        flowScale: 300,
      });
      p.glaze(band(-240, 160), mix(PIGMENTS.indigo, PIGMENTS.violet, 0.2), { rng, opacity: 0.16, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.4 } });
      for (const s of stars(30, 'stars', WATERFALL_SKY_LAYOUT)) reserveStar(p.ctx, s);
      break;
    }
  }
}

/** The pool's mirrored sky: the horizon's colour at the far (cliff) edge, the zenith's nearer. */
export function paintWaterfallWaterSky(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void {
  const far = box.y;
  const near = box.y + box.h;
  const whole: Pt[] = [
    { x: box.x - 20, y: far - 10 },
    { x: box.x + box.w + 20, y: far - 10 },
    { x: box.x + box.w + 20, y: near + 10 },
    { x: box.x - 20, y: near + 10 },
  ];
  // the cliff stands behind the pool: its far edge mirrors dark rock, not the horizon
  const colours: Record<DayPhase, [Pigment, Pigment]> = {
    midday: [mix(PIGMENTS.cerulean, PIGMENTS.celadonMid, 0.5), lighten(PIGMENTS.cerulean, 0.35)],
    sunrise: [mix(PIGMENTS.bellflower, PIGMENTS.celadonMid, 0.4), mix(PIGMENTS.apricot, PIGMENTS.rose, 0.4)],
    sunset: [mix(PIGMENTS.violet, PIGMENTS.celadonMid, 0.35), mix(PIGMENTS.ochre, PIGMENTS.rose, 0.4)],
    night: [mix(PIGMENTS.indigo, PIGMENTS.ultramarine, 0.3), mix(PIGMENTS.ultramarine, PIGMENTS.cerulean, 0.4)],
  };
  const [back, front] = colours[phase];
  p.wetInWet(whole, back, front, { rng, angle: Math.PI / 2, split: 0.45, softness: 0.7, opacity: 0.85, deform: 0.02, edge: 0.04, centreLift: 0, granulation: 0.06, flow: 0.5, flowScale: 60 });
  // the falls' churn breaks the mirror: broken horizontal light, most of it near the foot
  for (let i = 0; i < 14; i++) {
    const y = far + rng.range(0.05, 0.95) * (near - far);
    const len = rng.range(50, 180);
    p.lift({ cx: rng.range(box.x, box.x + box.w), cy: y, rx: len / 2, ry: rng.range(1.2, 2.6) }, { rng, amount: rng.range(0.25, 0.5), deform: 0.25, spread: 0.3, layers: 5 });
  }
}

/** The waterfall's sky: its layout, plates and open-sky shape (ADR 0241, 0247). */
export const WATERFALL_SKY: ScenerySky = {
  layout: WATERFALL_SKY_LAYOUT,
  rect: WATERFALL_SKY_RECT,
  shape: openSky,
  paint: paintWaterfallSky,
  paintWater: paintWaterfallWaterSky,
};
