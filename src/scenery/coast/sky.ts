/**
 * The coast's four skies and the sea's mirrored sky (G5, ADR 0372), cut round the temple.
 * docs/systems/scenery.md › Coast › Daylight.
 */
import type { DayPhase } from '../../ambience/daylight';
import { reserveStar, stars, type Star } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, hexToRgb, insetPolygon, lighten, mix, type Painter, type Pigment } from '../../paint';
import { pointInPolygon } from '../../paint/geometry';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import type { SkyPainters } from '../types';
import { ARCHITRAVE, COLUMNS, COAST_SKY_LAYOUT, COAST_SKY_RECT, FAR_HILL, HORIZON, PROMONTORY, SKY_TOP, STYLOBATE, skylineAt } from './layout';
import { columnShapes } from './temple';
import { HEADLANDS } from './village';

export { COAST_SKY_RECT };

/** The Ionian sky's own colours, beside the shared pigments. */
export const AEGEAN = {
  zenith: '#3f86c8',
  haze: '#f4ead8',
  pearl: '#f3e4e0',
  lilac: '#a99ad0',
  peach: '#f6c6a2',
  apricot: '#f49a5e',
  ember: '#f0b04a',
  rose: '#e07a86',
  plum: '#5b3f82',
  ink: '#18264f',
  night: '#1d2c66',
  turquoise: '#22aab0',
  teal: '#2f7f8c',
} satisfies Record<string, Pigment>;

/** The top of a closed outline at x (its highest crossing), or null where it does not reach. */
function topOf(poly: readonly Pt[], x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    if (best === null || y < best) best = y;
  }
  return best;
}

/** The painted ground's top at x without the temple: the far hill, the horizon and the promontory. */
export function groundAt(x: number): number {
  let y = HORIZON;
  for (const poly of [FAR_HILL, PROMONTORY]) {
    const t = topOf(poly, Math.min(WORLD_W + 20, Math.max(FAR_HILL[0]!.x, x)));
    if (t !== null && t < y) y = t;
  }
  return y;
}

/** How far the sky hangs under the ground line: 4 (no paper at the edge), none on the krepis. */
function hangAt(x: number): number {
  return x > STYLOBATE.x0 && x < STYLOBATE.x1 ? 0.5 : 4;
}

/** The sky's outline: the ground line without the temple and its hang, closed over the plate's top. */
export function plateSky(): Pt[] {
  const line: Pt[] = [];
  for (let x = -80; x <= 1680; x += 4) line.push({ x, y: groundAt(x) + hangAt(x) });
  return [{ x: -80, y: SKY_TOP - 40 }, { x: 1680, y: SKY_TOP - 40 }, ...line.reverse()];
}

/** The washes' shape: the same line run 48 deeper, so their wet edges fall under the clip. */
function washSky(): Pt[] {
  const line: Pt[] = [];
  for (let x = -80; x <= 1680; x += 20) line.push({ x, y: groundAt(x) + 48 });
  return [{ x: -80, y: SKY_TOP - 40 }, { x: 1680, y: SKY_TOP - 40 }, ...line.reverse()];
}

/** The architrave's underside and top, as the temple paints them (it slumped 2.5 to the left). */
const ARCH_LOW = STYLOBATE.y - Math.max(COLUMNS[0]!.h, COLUMNS[1]!.h);
const archLow = (x: number) => ARCH_LOW + ((ARCHITRAVE.x1 - x) / (ARCHITRAVE.x1 - ARCHITRAVE.x0)) * 2.5;

/**
 * The temple's pieces the sky must not cover, a little inside their painted edges (so no paper
 * shows between): each shaft, the two capitals and the architrave's fragment.
 */
export const TEMPLE_CUT: readonly Pt[][] = (() => {
  // (an inset point that a concave corner throws outside the shaft is dropped)
  const out: Pt[][] = columnShapes().map((c) => insetPolygon(c.outline, 0.7).filter((q) => pointInPolygon(q, c.outline)));
  for (const c of COLUMNS.slice(0, 2)) {
    const t = Math.min(STYLOBATE.y - c.h, archLow(c.x)) + 0.6;
    const y9 = STYLOBATE.y - c.h + 9.5;
    out.push([{ x: c.x - 9.6, y: t }, { x: c.x + 9.6, y: t }, { x: c.x + 9.4, y: t + 3.4 }, { x: c.x + 7.4, y: t + 6.6 }, { x: c.x + 6.6, y: y9 }, { x: c.x - 6.6, y: y9 }, { x: c.x - 7.4, y: t + 6.6 }, { x: c.x - 9.4, y: t + 3.4 }]);
  }
  const { x0, x1, h } = ARCHITRAVE;
  // the broken right end falls away to the lower right; the cut keeps to its solid part
  out.push([{ x: x0 + 0.8, y: archLow(x0) - h + 1.4 }, { x: x1 - 9, y: archLow(x1 - 9) - h + 0.8 }, { x: x1 - 6, y: archLow(x1) - h * 0.45 }, { x: x1 - 3, y: archLow(x1) - 0.8 }, { x: x0 + 0.8, y: archLow(x0) - 0.8 }]);
  return out;
})();

/** Clip to the open sky: the outline, less the temple's pieces. */
function clipSky(p: Painter): void {
  const ctx = p.ctx;
  ctx.beginPath();
  plateSky().forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-1e4, -1e4, 2e4, 2e4);
  for (const poly of TEMPLE_CUT) {
    poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  }
  ctx.clip('evenodd');
}

const band = (y0: number, y1: number, x0 = -80, x1 = WORLD_W + 80): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** A soft glow round a low sun. */
function glow(cx: number, cy: number, rx: number, ry: number): Pt[] {
  return Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
}

/** A thin cloud bar at a low sun: a crisp pooled top, a lost lower edge, the sun's colour under it. */
function bar(p: Painter, rng: Rng, x: number, y: number, len: number, h: number, pigment: Pigment, opacity: number, lit: Pigment): void {
  for (let k = 0; k < rng.int(2, 3); k++) {
    const l = len * rng.range(0.35, 0.7);
    const cx = x - len / 2 + rng.range(l / 2, len - l / 2);
    const cy = y + rng.range(-h, h);
    p.wash(blob(cx, cy, l / 2, h * rng.range(0.7, 1.2), rng, { irregularity: 0.4, rotation: rng.range(-0.03, 0.02) }), pigment, {
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

/** A small fair-weather cloud lifted out of the wet blue: a few soft lobes on a flatter base, its belly a cool grey. */
function cumulus(p: Painter, rng: Rng, x: number, y: number, w: number): void {
  const lobes = rng.int(4, 6);
  for (let i = 0; i < lobes; i++) {
    const u = (i + 0.5) / lobes - 0.5;
    const r = w * rng.range(0.13, 0.2) * (1 - Math.abs(u) * 0.8);
    p.lift(blob(x + u * w * 0.9 + rng.range(-3, 3), y - r * 0.4 - (0.5 - Math.abs(u)) * w * 0.05, r * 1.2, r * 0.7, rng, { irregularity: 0.45 }), {
      rng,
      amount: rng.range(0.4, 0.6),
      deform: 0.6,
      spread: 0.8,
      layers: 6,
      sharpness: 0.06,
    });
  }
  // a torn wisp trailing off, and the flat base in a cool grey
  p.lift(blob(x + w * 0.45, y - w * 0.02, w * 0.35, w * 0.035, rng, { irregularity: 0.5, rotation: -0.05 }), { rng, amount: 0.3, deform: 0.6, spread: 0.8, layers: 5, sharpness: 0.05 });
  p.lift(blob(x, y + w * 0.01, w * 0.5, w * 0.05, rng, { irregularity: 0.3 }), { rng, amount: 0.4, deform: 0.4, spread: 0.6, layers: 5, sharpness: 0.1 });
  p.glaze(blob(x + w * 0.04, y + w * 0.03, w * 0.42, w * 0.05, rng, { irregularity: 0.3 }), mix(PIGMENTS.shadow, AEGEAN.lilac, 0.4), { rng, opacity: 0.12, deform: 0.5, spread: 0.7 });
}

/** Where the night's extra stars may not go: the leaning pine's pads, the olive and the promontory's pines, the temple. */
const STARLESS: readonly Rect[] = [
  { x: -80, y: 140, w: 400, h: 400 },
  { x: 900, y: 180, w: 800, h: 400 },
  { x: 660, y: 270, w: 200, h: 200 },
];

/** The night's extra stars: a summer field over the open sky, smaller and fainter than the shared 30. */
export const COAST_NIGHT_STARS: readonly Star[] = stars(170, 'coast-stars', {
  ...COAST_SKY_LAYOUT,
  stars: { top: -40, depth: 320, gap: { x: 610, halfW: 190, y0: 150, y1: 420 } },
})
  .filter((s) => s.y < skylineAt(s.x) - 14 && !STARLESS.some((r) => s.x > r.x && s.x < r.x + r.w && s.y > r.y && s.y < r.y + r.h))
  .map((s) => ({ ...s, r: s.r * 0.8, a: s.a * 0.85 }));

/** The four phases' plates, cut to the open sky; then the far shore glazed in the light's colour. */
export function paintCoastSky(p: Painter, rng: Rng, phase: DayPhase): void {
  const ctx = p.ctx;
  ctx.save();
  clipSky(p);
  paintPhaseSky(p, rng, phase);
  ctx.restore();
  paintDistance(p, rng, phase);
}

function paintPhaseSky(p: Painter, rng: Rng, phase: DayPhase): void {
  const sky = washSky();
  const { sunriseX, sunsetX, horizonY } = COAST_SKY_LAYOUT;
  switch (phase) {
    case 'midday': {
      // a high clear summer blue straight up, thinning to a pale warm haze over the sea's horizon
      p.wetInWet(sky, AEGEAN.zenith, AEGEAN.haze, {
        rng,
        angle: Math.PI / 2,
        split: 0.6,
        softness: 0.75,
        fingers: 0.15,
        opacity: 0.56,
        deform: 0.03,
        edge: 0.04,
        centreLift: 0.03,
        granulation: 0.14,
        flow: 0.45,
        flowScale: 260,
        fade: { angle: Math.PI / 2, start: 0.62, amount: 0.85, ragged: 0.4 },
      });
      p.glaze(band(SKY_TOP - 40, 170), mix(AEGEAN.zenith, PIGMENTS.ultramarine, 0.12), { rng, opacity: 0.3, fade: { angle: Math.PI / 2, start: 0.5, amount: 1, ragged: 0.5 } });
      // the haze along the horizon, warm and pale, a little thicker over the open sea
      p.glaze(band(270, 420), mix(AEGEAN.haze, PIGMENTS.ochre, 0.1), { rng, opacity: 0.2, deform: 0.05, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.5 } });
      cumulus(p, rng, 330, 176, 96);
      cumulus(p, rng, 940, 118, 62);
      break;
    }
    case 'sunrise': {
      // cool lilac overhead into pale peach low over the sea, where the sun comes up
      p.wetInWet(sky, lighten(mix(AEGEAN.lilac, PIGMENTS.bellflower, 0.35), 0.1), AEGEAN.peach, {
        rng,
        angle: Math.PI / 2,
        split: 0.55,
        softness: 0.7,
        opacity: 0.42,
        deform: 0.03,
        edge: 0.05,
        centreLift: 0.04,
        granulation: 0.12,
        flow: 0.35,
        flowScale: 320,
      });
      p.glaze(glow(sunriseX, horizonY - 30, 420, 150), lighten(PIGMENTS.gold, 0.2), { rng, opacity: 0.4, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.9, ragged: 0.5 } });
      // a pearly haze lying on the horizon, and two quiet lilac bars lit gold underneath
      p.glaze(band(320, 420), mix(AEGEAN.pearl, AEGEAN.peach, 0.3), { rng, opacity: 0.3, deform: 0.06, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.6 } });
      bar(p, rng, 900, 250, 420, 5, mix(AEGEAN.lilac, PIGMENTS.rose, 0.3), 0.2, lighten(PIGMENTS.gold, 0.2));
      bar(p, rng, 330, 150, 380, 5, mix(AEGEAN.lilac, PIGMENTS.rose, 0.25), 0.12, AEGEAN.peach);
      break;
    }
    case 'sunset': {
      // violet overhead, rose through the middle, apricot and ember low where the sun goes down
      p.wetInWet(sky, mix(PIGMENTS.violet, AEGEAN.plum, 0.3), AEGEAN.rose, {
        rng,
        angle: Math.PI / 2,
        split: 0.5,
        softness: 0.65,
        opacity: 0.52,
        deform: 0.03,
        edge: 0.06,
        centreLift: 0.05,
        granulation: 0.1,
        flow: 0.35,
        flowScale: 320,
      });
      p.wash(band(170, 440), AEGEAN.apricot, {
        rng,
        opacity: 0.42,
        deform: 0.05,
        edge: 0.04,
        sharpness: 0.3,
        centreLift: 0,
        flow: 0.5,
        flowScale: 140,
        fade: { angle: -Math.PI / 2, start: 0.3, amount: 0.95, ragged: 0.5 },
      });
      p.glaze(glow(sunsetX, horizonY - 24, 460, 150), AEGEAN.ember, { rng, opacity: 0.44, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.45, amount: 0.9, ragged: 0.5 } });
      bar(p, rng, 1000, 236, 560, 7, mix(PIGMENTS.violet, PIGMENTS.crimson, 0.35), 0.34, mix(AEGEAN.apricot, AEGEAN.ember, 0.5));
      bar(p, rng, 260, 196, 420, 6, mix(PIGMENTS.violet, PIGMENTS.crimson, 0.3), 0.28, AEGEAN.apricot);
      bar(p, rng, 760, 70, 520, 7, mix(PIGMENTS.violet, PIGMENTS.rose, 0.3), 0.22, AEGEAN.rose);
      break;
    }
    case 'night': {
      // deep granulating blue, paler over the sea's horizon where the last light lingers
      p.wetInWet(sky, mix(AEGEAN.night, PIGMENTS.ultramarine, 0.15), mix(PIGMENTS.ultramarine, PIGMENTS.cerulean, 0.4), {
        rng,
        angle: Math.PI / 2,
        split: 0.6,
        softness: 0.65,
        opacity: 0.46,
        deform: 0.03,
        edge: 0.08,
        centreLift: 0.04,
        granulation: 0.18,
        flow: 0.4,
        flowScale: 300,
      });
      p.glaze(band(SKY_TOP - 40, 120), mix(AEGEAN.night, AEGEAN.ink, 0.3), { rng, opacity: 0.24, fade: { angle: Math.PI / 2, start: 0.4, amount: 1, ragged: 0.4 } });
      for (const s of stars(30, 'stars', COAST_SKY_LAYOUT)) reserveStar(p.ctx, s);
      for (const s of COAST_NIGHT_STARS) reserveStar(p.ctx, s);
      break;
    }
  }
}

/** Each phase's colour on the far shore (the hill and the headlands): air between it and us. */
const DISTANCE: Record<DayPhase, { pigment: Pigment; opacity: number }> = {
  midday: { pigment: mix(AEGEAN.zenith, AEGEAN.haze, 0.6), opacity: 0.12 },
  sunrise: { pigment: mix(AEGEAN.lilac, AEGEAN.peach, 0.3), opacity: 0.2 },
  sunset: { pigment: mix(AEGEAN.rose, PIGMENTS.violet, 0.35), opacity: 0.26 },
  night: { pigment: mix(AEGEAN.night, PIGMENTS.ultramarine, 0.4), opacity: 0.18 },
};

/** The far hill and the headlands take the sky's colour; the village under it keeps most of its white. */
function paintDistance(p: Painter, rng: Rng, phase: DayPhase): void {
  const d = DISTANCE[phase];
  for (const shape of [FAR_HILL, ...HEADLANDS]) {
    p.glaze(shape.map((q) => ({ x: q.x, y: q.y - 1 })), d.pigment, { rng, opacity: d.opacity, deform: 0.04, spread: 0.3, edge: 0, fade: { angle: Math.PI / 2, start: 0.5, amount: 0.5, ragged: 0.4 } });
  }
}

/** Each phase's mirrored sky on the sea: the horizon's colour far out, the cove's own turquoise near. */
export const COAST_WATER_SKY: Record<DayPhase, { far: Pigment; near: Pigment }> = {
  midday: { far: mix(AEGEAN.turquoise, PIGMENTS.cerulean, 0.45), near: AEGEAN.turquoise },
  sunrise: { far: mix(AEGEAN.pearl, AEGEAN.peach, 0.4), near: mix(mix(AEGEAN.turquoise, AEGEAN.pearl, 0.5), AEGEAN.lilac, 0.25) },
  sunset: { far: mix(AEGEAN.apricot, AEGEAN.ember, 0.3), near: mix(AEGEAN.teal, PIGMENTS.violet, 0.2) },
  night: { far: mix(AEGEAN.night, PIGMENTS.ultramarine, 0.45), near: AEGEAN.ink },
};

/** The sea's mirrored sky, and the low sun's broken path toward the beach. */
export function paintCoastWaterSky(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void {
  const far = box.y;
  const near = box.y + box.h;
  const whole: Pt[] = [
    { x: box.x - 20, y: far - 10 },
    { x: box.x + box.w + 20, y: far - 10 },
    { x: box.x + box.w + 20, y: near + 10 },
    { x: box.x - 20, y: near + 10 },
  ];
  const w = COAST_WATER_SKY[phase];
  // two washes kept apart (laid wet into each other, apricot and teal grey out): the near water's
  // colour lost upward, the horizon's lost downward
  const wet = { rng, deform: 0.02, edge: 0.03, sharpness: 0.3, centreLift: 0, granulation: 0.05, flow: 0.5, flowScale: 80 };
  p.wash([{ x: box.x - 20, y: far + 90 }, { x: box.x + box.w + 20, y: far + 90 }, whole[2]!, whole[3]!], w.near, { ...wet, opacity: 0.9, fade: { angle: -Math.PI / 2, start: 0.75, amount: 1, ragged: 0.4 } });
  p.wash([whole[0]!, whole[1]!, { x: box.x + box.w + 20, y: far + 200 }, { x: box.x - 20, y: far + 200 }], w.far, { ...wet, opacity: 0.9, fade: { angle: Math.PI / 2, start: 0.35, amount: 1, ragged: 0.4 } });
  const { sunriseX, sunsetX, moonArc } = COAST_SKY_LAYOUT;
  if (phase === 'sunrise') sunPath(p, rng, sunriseX, far, 260, lighten(PIGMENTS.gold, 0.55), 0.95, 1);
  if (phase === 'sunset') sunPath(p, rng, sunsetX, far, near - far - 50, lighten(AEGEAN.ember, 0.5), 1, 1);
  if (phase === 'night') sunPath(p, rng, moonArc[1]!.x - 16, far + 30, 300, lighten(PIGMENTS.bellflower, 0.75), 1, 1);
  // a few lifted wind lanes, more far out
  for (let i = 0; i < 8; i++) {
    const y = far + rng.next() ** 1.4 * (near - far) * 0.7;
    const len = rng.range(80, 220);
    p.lift({ cx: rng.range(box.x, box.x + box.w * 0.7), cy: y, rx: len / 2, ry: rng.range(1, 2) }, { rng, amount: rng.range(0.15, 0.3), deform: 0.25, spread: 0.3, layers: 5 });
  }
  thinToShore(p, box, WATER_NEAR[phase]);
}

/** How much of the mirrored sky the near shallows keep, against the far water's 1. */
export const WATER_NEAR: Record<DayPhase, number> = { midday: 0.4, sunrise: 0.42, sunset: 0.34, night: 0.6 };
/** Over how many units from the horizon the mirror thins to the near shallows' share. */
export const WATER_FALLOFF = 280;

/** Thin the plate toward the viewer: open water far out mirrors the sky, the shallows show their floor. */
function thinToShore(p: Painter, box: Rect, keep: number): void {
  const ctx = p.ctx;
  const y0 = box.y;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + WATER_FALLOFF);
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    const s = u * u * (3 - 2 * u);
    g.addColorStop(u, `rgba(0,0,0,${((1 - keep) * s).toFixed(3)})`);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(box.x - 40, y0 - 20, box.w + 80, box.h + 60);
  ctx.restore();
}

/**
 * A broken path of light on the water under a low sun (or the moon), widening toward the viewer:
 * a soft sheen of the light's colour, then glitter, each touch a few dashes side by side.
 */
function sunPath(p: Painter, rng: Rng, x: number, y0: number, length: number, pigment: Pigment, k: number, sheen: number): void {
  p.lift(
    [
      { x: x - 14, y: y0 },
      { x: x + 14, y: y0 },
      { x: x + 70, y: y0 + length },
      { x: x - 70, y: y0 + length },
    ],
    { rng, amount: 0.45 * sheen, deform: 0.4, spread: 0.6, layers: 5, sharpness: 0.05, paper: pigment, fade: { angle: Math.PI / 2, start: 0.3, amount: 0.8, ragged: 0.6 } },
  );
  // the glitter's dashes are a pixel or two high on the plate: plain soft strokes, no wash
  const { r, g, b } = hexToRgb(pigment);
  const rgb = `${r},${g},${b}`;
  for (let y = y0 + 2; y < y0 + length; y += rng.range(3, 7)) {
    const d = (y - y0) / length;
    const spread = 10 + d * 64;
    for (let n = rng.int(2, 3); n > 0; n--) {
      const cx = x + rng.range(-1, 1) * spread;
      const half = (4 + d * 18) * rng.range(0.5, 1.2) * (1 - (Math.abs(cx - x) / spread) * 0.5);
      dash(p.ctx, cx, y + rng.range(-1, 1), half, rng.range(1.5, 2.6), Math.min(1, k * (1.15 - d * 0.6) * rng.range(0.7, 1)), rgb);
    }
  }
}

/** One glint: a soft-ended dash of the light's colour laid over the water. */
function dash(ctx: Painter['ctx'], x: number, y: number, rx: number, ry: number, a: number, rgb: string): void {
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(0.3, `rgba(${rgb},${a.toFixed(3)})`);
  g.addColorStop(0.7, `rgba(${rgb},${a.toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The coast's sky plates (its painter chunk, ADR 0341). */
export const COAST_SKY_PAINTERS: SkyPainters = { paint: paintCoastSky, paintWater: paintCoastWaterSky };
