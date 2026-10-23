/**
 * The four painted skies (daylight phases, ADR 0145) and the sky each throws onto the pond.
 *
 * A sky plate is a watercolour painted on white over the sky band of the world and multiplied
 * over the landscape in the `background` layer, as if the sky had been laid in first and the
 * garden painted over it: the trees and the pavilion that stand against the sky take its glaze,
 * the sun and the moon are paper left unpainted (punched out per frame, so they can move and the
 * hills still hide the sun as it sets). A water plate is the same sky mirrored into the pond,
 * laid over the water with a little opacity on the `waterSurface` layer.
 */
import type { Rng } from '../core/rng';
import { PIGMENTS, blob, createSimplex2D, lighten, mix, ribbon, smoothPath, type Painter, type Pigment } from '../paint';
import type { DayPhase } from '../ambience/daylight';
import { WORLD_W, type Pt, type Rect } from '../render/viewport';
import { HILLS } from './layout';
import { reserveStar, stars } from '../ambience/sky-layout';

/** The world band the sky plates cover (above the world's top for tall phones, down past the far bank). */
export const SKY_RECT: Rect = { x: 0, y: -240, w: WORLD_W, h: 740 };
/** Plate resolution, bitmap px per world unit (soft washes; the paper adds the grain). */
export const SKY_SCALE = 0.7;

/** The far ridge as a smooth line: the sun sets behind it. */
export function farRidge(): Pt[] {
  return smoothPath(HILLS[0]!.ridge, 16);
}

/** The open sky above the far ridge (with `below` extra units hanging under the ridge). */
export function skyShape(below = 0): Pt[] {
  const ridge = farRidge().map((q) => ({ x: q.x, y: q.y + below }));
  return [{ x: -80, y: SKY_RECT.y - 40 }, { x: WORLD_W + 80, y: SKY_RECT.y - 40 }, { x: WORLD_W + 80, y: ridge[ridge.length - 1]!.y }, ...ridge.reverse()];
}

/** Both hill bands, from the far ridge down to the far bank. */
function hillsShape(): Pt[] {
  const ridge = farRidge();
  return [...ridge, { x: WORLD_W + 80, y: 470 }, { x: -80, y: 470 }];
}

/** The far ridge's height at x (linear between the smoothed points). */
function ridgeAt(x: number): number {
  const r = farRidge();
  if (x <= r[0]!.x) return r[0]!.y;
  for (let i = 1; i < r.length; i++) if (r[i]!.x >= x) return r[i - 1]!.y + ((r[i]!.y - r[i - 1]!.y) * (x - r[i - 1]!.x)) / (r[i]!.x - r[i - 1]!.x || 1);
  return r[r.length - 1]!.y;
}

/** An elliptical glow kept in the sky: nothing of it hangs below the far ridge (+ a few units). */
function skyGlow(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    pts.push({ x, y: Math.min(cy + Math.sin(a) * ry, ridgeAt(x) + 8) });
  }
  return pts;
}

const band = (y0: number, y1: number): Pt[] => [
  { x: -80, y: y0 },
  { x: WORLD_W + 80, y: y0 },
  { x: WORLD_W + 80, y: y1 },
  { x: -80, y: y1 },
];

/**
 * A cloud bank drawn the way a brush lays one down sideways: two or three overlapping ribbons
 * of uneven thickness along a gently sagging line, a crisp, pooled upper edge and a lower edge
 * lost into the sky, the lit colour dropped into the wet underside. Never a uniform bar.
 */
function streak(p: Painter, rng: Rng, x: number, y: number, len: number, h: number, pigment: Pigment, opacity: number, lit?: Pigment): void {
  const noise = createSimplex2D(rng.fork('streak'));
  const pieces = rng.int(2, 3);
  for (let k = 0; k < pieces; k++) {
    const l = len * rng.range(0.45, 0.8);
    const x0 = x - len / 2 + rng.range(0, len - l);
    const yy = y + rng.range(-h, h) * 1.4;
    const sag = rng.range(-0.5, 1.2) * h;
    const path: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      path.push({ x: x0 + l * t, y: yy + sag * Math.sin(t * Math.PI) + noise(t * 3 + k * 7, 0.5) * h * 0.6 });
    }
    const thick = h * rng.range(0.7, 1.3);
    const shape = ribbon(path, (t, i) => {
      const taper = Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6;
      return thick * taper * (0.55 + 0.7 * Math.abs(noise(i * 0.31 + k * 3, 2.7)));
    });
    p.wash(shape, pigment, {
      rng,
      opacity: opacity * rng.range(0.75, 1),
      deform: 0.12,
      spread: 0.25,
      edge: 0.3,
      edgeWidth: 1.4,
      sharpness: 0.45,
      centreLift: 0.15,
      granulation: 0.05,
      flow: 0.55,
      flowScale: 26,
      fade: { angle: Math.PI / 2, start: 0.45, amount: 0.85, ragged: 0.6 },
      drops: lit ? [{ pigment: lit, at: { x: x0 + l * rng.range(0.3, 0.7), y: yy + sag * 0.6 + thick * 0.5 }, size: 0.35, alpha: 0.55 }] : undefined,
    });
  }
}

/**
 * Midday whites lifted out of the wet blue (ADR 0184): not a cloud *shape* but the places where a
 * damp brush took the pigment back up — several soft, overlapping lifts of uneven strength strung
 * along a slightly tilted drift, most with lost edges, one or two left to dry with a crisp rim or a
 * crinkled bloom, and a few torn wisps trailing off. No outline, no flat belly, no glaze under it.
 */
function liftedDrift(p: Painter, rng: Rng, cx: number, cy: number, w: number, h: number): void {
  const tilt = rng.range(-0.1, 0.06);
  const n = rng.int(4, 7);
  for (let i = 0; i < n; i++) {
    const t = (i + rng.range(-0.3, 0.3)) / Math.max(1, n - 1) - 0.5;
    const x = cx + t * w;
    const y = cy + t * w * tilt + rng.range(-0.35, 0.35) * h;
    // fuller in the middle of the drift, thinning toward its ends
    const body = 1 - Math.abs(t) * 1.1;
    // now and then a lift dries with a crisp rim: kept long and thin so it reads as a dried edge,
    // never as a little puff
    const crisp = rng.chance(0.15);
    const rx = w * rng.range(0.1, 0.2) * (0.7 + body * 0.5) * (crisp ? 1.3 : 1);
    const ry = h * rng.range(0.35, 0.7) * (0.6 + body * 0.5) * (crisp ? 0.45 : 1);
    p.lift(blob(x, y, rx, ry, rng, { irregularity: 0.45, rotation: rng.range(-0.3, 0.3) }), {
      rng,
      amount: rng.range(0.28, 0.55) * (0.6 + body * 0.5),
      deform: 0.55,
      spread: 0.6,
      layers: 9,
      sharpness: crisp ? 0.55 : 0.04,
      edge: crisp ? 0.25 : 0,
      blooms: crisp && rng.chance(0.5) ? 1 : 0,
      bloomSize: 0.35,
      fade: { angle: rng.range(0, Math.PI * 2), start: rng.range(0.3, 0.55), amount: 0.8, ragged: 0.8 },
    });
  }
  // torn wisps trailing from the drift in the wind's direction
  for (let i = 0; i < rng.int(1, 3); i++) {
    const side = rng.chance(0.6) ? 1 : -1;
    const x = cx + side * w * rng.range(0.45, 0.7);
    const y = cy + side * w * tilt * 0.6 + rng.range(-0.3, 0.5) * h;
    p.lift({ cx: x, cy: y, rx: w * rng.range(0.12, 0.22), ry: h * rng.range(0.08, 0.16), rotation: tilt + rng.range(-0.08, 0.08) }, {
      rng,
      amount: rng.range(0.22, 0.38),
      deform: 0.6,
      spread: 0.6,
      layers: 6,
      sharpness: 0.05,
      fade: { angle: side > 0 ? 0 : Math.PI, start: 0.3, amount: 0.9, ragged: 0.8 },
    });
  }
}

/** Paint one phase's sky into a painter whose transform maps world units onto the plate. */
export function paintSkyPlate(p: Painter, rng: Rng, phase: DayPhase): void {
  const sky = skyShape(40);
  switch (phase) {
    case 'midday': {
      // wet-in-wet cerulean, deepest and coolest at the zenith, still blue low over the hills (wide
      // canvases only show the sky band above them), warming to paper just above the ridge; the
      // pigment flows unevenly and settles in the grain
      p.wetInWet(sky, mix(PIGMENTS.cerulean, PIGMENTS.ultramarine, 0.22), lighten(PIGMENTS.cerulean, 0.3), {
        rng,
        angle: Math.PI / 2,
        split: 0.48,
        softness: 0.75,
        fingers: 0.3,
        opacity: 0.54,
        deform: 0.03,
        edge: 0.06,
        centreLift: 0.04,
        granulation: 0.2,
        flow: 0.5,
        flowScale: 230,
        fade: { angle: Math.PI / 2, start: 0.8, amount: 0.9, ragged: 0.4 },
      });
      // a second, thinner pass of blue dropped in while wet: darker pools of pigment, no edges
      for (const [x, y, w] of [
        [260, -150, 520],
        [1180, -60, 640],
        [760, 120, 420],
      ] as const) {
        p.glaze(blob(x, y, w / 2, w * 0.16, rng, { irregularity: 0.5 }), mix(PIGMENTS.cerulean, PIGMENTS.ultramarine, 0.4), {
          rng,
          opacity: 0.12,
          deform: 0.5,
          spread: 0.5,
          fade: { angle: rng.range(0, Math.PI * 2), start: 0.2, amount: 1, ragged: 0.7 },
        });
      }
      // a little warmth low down
      p.glaze(band(300, 390), lighten(PIGMENTS.gold, 0.4), { rng, opacity: 0.1, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1 } });
      // the whites lifted out of the wet blue: drifts, never cloud shapes (ADR 0184)
      liftedDrift(p, rng, 330, 40, 520, 70);
      liftedDrift(p, rng, 1120, 130, 620, 60);
      liftedDrift(p, rng, 1580, 10, 360, 50);
      liftedDrift(p, rng, 760, -140, 560, 80);
      liftedDrift(p, rng, 420, 230, 380, 22);
      break;
    }
    case 'sunrise': {
      // cool violet-blue overhead into a peach dawn low over the hills, warmest on the right
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
      p.wash(band(150, 420), mix(PIGMENTS.rose, PIGMENTS.apricot, 0.55), {
        rng,
        opacity: 0.28,
        deform: 0.05,
        edge: 0.05,
        sharpness: 0.3,
        centreLift: 0,
        flow: 0.5,
        flowScale: 140,
        fade: { angle: Math.PI, start: 0.25, amount: 1, ragged: 0.5 },
      });
      p.glaze(skyGlow(1000, 335, 400, 130), lighten(PIGMENTS.ochre, 0.3), { rng, opacity: 0.35, deform: 0.1, fade: { angle: Math.PI, start: 0.45, amount: 0.9, ragged: 0.5 } });
      // a few long cloud banks catching the dawn on their undersides
      streak(p, rng, 1220, 252, 560, 10, mix(PIGMENTS.violet, PIGMENTS.bellflower, 0.45), 0.4, mix(PIGMENTS.rose, PIGMENTS.apricot, 0.5));
      streak(p, rng, 960, 300, 420, 7, mix(PIGMENTS.rose, PIGMENTS.violet, 0.35), 0.36, PIGMENTS.apricot);
      streak(p, rng, 480, 186, 460, 8, mix(PIGMENTS.violet, PIGMENTS.bellflower, 0.5), 0.26, mix(PIGMENTS.rose, PIGMENTS.apricot, 0.3));
      // the hills stand cool and blue against the dawn
      p.glaze(hillsShape(), mix(PIGMENTS.bellflower, PIGMENTS.violet, 0.3), { rng, opacity: 0.26, fade: { angle: Math.PI / 2, start: 0.35, amount: 1 } });
      break;
    }
    case 'sunset': {
      // dusky rose-violet overhead, crimson, then amber gold low on the left where the sun goes down
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
      p.wash(band(120, 330), mix(PIGMENTS.crimson, PIGMENTS.rose, 0.4), {
        rng,
        opacity: 0.3,
        deform: 0.05,
        edge: 0.05,
        sharpness: 0.3,
        centreLift: 0,
        flow: 0.5,
        flowScale: 140,
        fade: { angle: -Math.PI / 2, start: 0.3, amount: 0.9, ragged: 0.5 },
      });
      p.glaze(skyGlow(560, 335, 480, 140), PIGMENTS.ochre, { rng, opacity: 0.42, deform: 0.1, fade: { angle: 0, start: 0.45, amount: 0.9, ragged: 0.5 } });
      // cloud banks, dark violet above, burning crimson and gold underneath
      streak(p, rng, 420, 236, 620, 11, mix(PIGMENTS.violet, PIGMENTS.crimson, 0.4), 0.46, mix(PIGMENTS.crimson, PIGMENTS.ochre, 0.4));
      streak(p, rng, 800, 290, 440, 8, mix(PIGMENTS.crimson, PIGMENTS.violet, 0.3), 0.4, PIGMENTS.ochre);
      streak(p, rng, 1160, 150, 520, 9, mix(PIGMENTS.violet, PIGMENTS.rose, 0.4), 0.32, PIGMENTS.rose);
      // hills as violet silhouettes against the warm sky
      p.glaze(hillsShape(), mix(PIGMENTS.violet, PIGMENTS.indigo, 0.25), { rng, opacity: 0.34, fade: { angle: Math.PI / 2, start: 0.35, amount: 1 } });
      break;
    }
    case 'night': {
      // deep granulating indigo overhead, a paler ultramarine glow along the horizon
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
      // the hills: darker indigo shapes against the lighter horizon
      p.glaze(hillsShape(), mix(PIGMENTS.indigo, PIGMENTS.violet, 0.2), { rng, opacity: 0.36, fade: { angle: Math.PI / 2, start: 0.4, amount: 1 } });
      // a few faint stars: tiny flecks of paper left in the wash (the light plate leaves them too)
      for (const s of stars()) reserveStar(p.ctx, s);
      break;
    }
  }
}

/**
 * The sky mirrored into the pond: horizontal bands of the phase's colours, warmest near the far
 * shore where the water reflects the horizon, broken by lifted streaks. Painted opaque over the
 * pond's box (the caller clips it to the water).
 */
export function paintWaterSkyPlate(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void {
  const far = box.y;
  const near = box.y + box.h;
  const b = (y0: number, y1: number): Pt[] => [
    { x: box.x - 20, y: y0 },
    { x: box.x + box.w + 20, y: y0 },
    { x: box.x + box.w + 20, y: y1 },
    { x: box.x - 20, y: y1 },
  ];
  const whole = b(far - 10, near + 10);
  const colours: Record<DayPhase, [Pigment, Pigment]> = {
    midday: [lighten(PIGMENTS.cerulean, 0.45), mix(PIGMENTS.cerulean, PIGMENTS.celadonMid, 0.4)],
    sunrise: [mix(PIGMENTS.apricot, PIGMENTS.rose, 0.35), mix(PIGMENTS.bellflower, PIGMENTS.violet, 0.3)],
    sunset: [mix(PIGMENTS.ochre, PIGMENTS.apricot, 0.3), mix(PIGMENTS.crimson, PIGMENTS.violet, 0.45)],
    night: [mix(PIGMENTS.ultramarine, PIGMENTS.cerulean, 0.4), mix(PIGMENTS.indigo, PIGMENTS.ultramarine, 0.3)],
  };
  const [horizon, zenith] = colours[phase];
  p.wetInWet(whole, horizon, zenith, { rng, angle: Math.PI / 2, split: 0.35, softness: 0.7, opacity: 0.85, deform: 0.02, edge: 0.04, centreLift: 0, granulation: 0.06, flow: 0.5, flowScale: 60 });
  // broken horizontal light: reflections are never one sheet
  for (let i = 0; i < 16; i++) {
    const y = far + rng.range(0.05, 0.95) * (near - far);
    const len = rng.range(60, 220);
    const x = rng.range(box.x, box.x + box.w);
    p.lift({ cx: x, cy: y, rx: len / 2, ry: rng.range(1.2, 2.6) }, { rng, amount: rng.range(0.25, 0.5), deform: 0.25, spread: 0.3, layers: 5 });
  }
}
