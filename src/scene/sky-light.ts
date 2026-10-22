/**
 * The painted sky of the daylight phases (ADR 0145): one watercolour plate per phase (painted on
 * demand, then kept), blended by the phase weights into a composite with the sun and moon left
 * as paper. The composite is multiplied over the landscape in the cached `background` layer and
 * rebuilt only when the blend or the sun/moon moved perceptibly (every few seconds at most).
 * The same skies, mirrored, lie on the pond (`drawWater`, every frame — a cheap blit).
 */
import { createRng } from '../core/rng';
import { PHASES, type DayPhase, type DaylightState, type PhaseWeights } from '../ambience/daylight';
import { moonDisc, sunDisc, type Disc } from '../ambience/sky-layout';
import { bounds, createPainter, makeCanvas, type AnyCanvas } from '../paint';
import type { Pt, Rect } from '../render/viewport';
import { SKY_RECT, SKY_SCALE, paintSkyPlate, paintWaterSkyPlate, skyShape } from './paint-sky';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** How strongly each phase's sky lies on the water (source-over opacity). */
export const WATER_SKY_ALPHA: Readonly<Record<DayPhase, number>> = { sunrise: 0.34, midday: 0.22, sunset: 0.42, night: 0.36 };
/** Water plates are painted at this many px per world unit. */
const WATER_SCALE = 0.5;

export interface SkyLight {
  /** recompose for this state if it changed enough (or `force`); true when it did */
  update(state: DaylightState, force?: boolean): boolean;
  /** multiply the sky over the landscape (world-unit context) */
  drawSky(ctx: Ctx): void;
  /** lay the mirrored sky on the pond (world-unit context; clips itself) */
  drawWater(ctx: Ctx): void;
  /** whether a phase's plates are painted */
  has(phase: DayPhase): boolean;
  /** paint the plates for these phases now (otherwise they paint when first needed) */
  prepare(phases: readonly DayPhase[]): void;
  stats(): { plates: number; composes: number; paintMs: number };
}

interface Plate {
  sky: AnyCanvas;
  water: AnyCanvas;
}

/** A stable key for "has the light moved?": weights to 1/200, discs to a world unit. */
export function skyKey(w: PhaseWeights, sun: Disc, moon: Disc): string {
  const q = (v: number) => Math.round(v * 200);
  const d = (c: Disc) => (c.alpha > 0.005 ? `${Math.round(c.x)},${Math.round(c.y)},${q(c.alpha)}` : '-');
  return `${PHASES.map((p) => q(w[p])).join(',')}|${d(sun)}|${d(moon)}`;
}

/** The phases in a weight set, heaviest first (the blend order). */
export function blendOrder(w: PhaseWeights): Array<{ phase: DayPhase; alpha: number }> {
  const list = PHASES.filter((p) => w[p] > 0.002).sort((a, b) => w[b] - w[a]);
  let acc = 0;
  return list.map((phase) => {
    acc += w[phase];
    // source-over chain: each layer covers its share of what is there so far
    return { phase, alpha: w[phase] / acc };
  });
}

export function createSkyLight(opts: { pond: readonly Pt[]; seed: number }): SkyLight {
  const plates = new Map<DayPhase, Plate>();
  const pondBox = bounds(opts.pond);
  const waterRect: Rect = { x: pondBox.x - 10, y: pondBox.y - 10, w: pondBox.w + 20, h: pondBox.h + 20 };
  const sw = Math.ceil(SKY_RECT.w * SKY_SCALE);
  const sh = Math.ceil(SKY_RECT.h * SKY_SCALE);
  const composite = makeCanvas(sw, sh);
  const cctx = composite.getContext('2d') as Ctx;
  const ww = Math.ceil(waterRect.w * WATER_SCALE);
  const wh = Math.ceil(waterRect.h * WATER_SCALE);
  const waterComposite = makeCanvas(ww, wh);
  const wctx = waterComposite.getContext('2d') as Ctx;
  let waterAlpha = 0;
  let key = '';
  let composes = 0;
  let paintMs = 0;
  let pondPath: Path2D | null = null;
  let skyPath: Path2D | null = null;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  const paint = (phase: DayPhase): Plate => {
    const known = plates.get(phase);
    if (known) return known;
    const t0 = now();
    const sky = makeCanvas(sw, sh);
    const sp = createPainter(sky, { seed: `${opts.seed}:sky:${phase}` });
    sp.ctx.fillStyle = '#ffffff';
    sp.ctx.fillRect(0, 0, sw, sh);
    sp.ctx.setTransform(SKY_SCALE, 0, 0, SKY_SCALE, -SKY_RECT.x * SKY_SCALE, -SKY_RECT.y * SKY_SCALE);
    paintSkyPlate(sp, createRng(`${opts.seed}:sky:${phase}`), phase);
    const water = makeCanvas(ww, wh);
    const wp = createPainter(water, { seed: `${opts.seed}:water-sky:${phase}` });
    wp.ctx.fillStyle = '#ffffff';
    wp.ctx.fillRect(0, 0, ww, wh);
    wp.ctx.setTransform(WATER_SCALE, 0, 0, WATER_SCALE, -waterRect.x * WATER_SCALE, -waterRect.y * WATER_SCALE);
    paintWaterSkyPlate(wp, createRng(`${opts.seed}:water-sky:${phase}`), phase, pondBox);
    const plate = { sky, water };
    plates.set(phase, plate);
    paintMs += now() - t0;
    return plate;
  };

  const skyClip = () => {
    if (!skyPath && typeof Path2D !== 'undefined') {
      skyPath = new Path2D();
      skyShape(0).forEach((q, i) => (i ? skyPath!.lineTo(q.x, q.y) : skyPath!.moveTo(q.x, q.y)));
      skyPath.closePath();
    }
    return skyPath;
  };

  const compose = (state: DaylightState, sun: Disc, moon: Disc) => {
    const order = blendOrder(state.weights);
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
    cctx.globalAlpha = 1;
    cctx.clearRect(0, 0, sw, sh);
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.globalCompositeOperation = 'source-over';
    wctx.globalAlpha = 1;
    wctx.clearRect(0, 0, ww, wh);
    waterAlpha = 0;
    for (const { phase, alpha } of order) {
      const plate = paint(phase);
      cctx.globalAlpha = alpha;
      cctx.drawImage(plate.sky as CanvasImageSource, 0, 0);
      wctx.globalAlpha = alpha;
      wctx.drawImage(plate.water as CanvasImageSource, 0, 0);
      waterAlpha += state.weights[phase] * WATER_SKY_ALPHA[phase];
    }
    cctx.globalAlpha = 1;
    wctx.globalAlpha = 1;
    // world units from here on
    cctx.setTransform(SKY_SCALE, 0, 0, SKY_SCALE, -SKY_RECT.x * SKY_SCALE, -SKY_RECT.y * SKY_SCALE);
    if (sun.alpha > 0.01) punchSun(cctx, sun, skyClip());
    if (moon.alpha > 0.01) punchMoon(cctx, moon, state.moonPhase);
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    composes++;
  };

  return {
    update(state, force = false) {
      const sun = sunDisc(state);
      const moon = moonDisc(state);
      const k = skyKey(state.weights, sun, moon);
      if (!force && k === key) return false;
      key = k;
      compose(state, sun, moon);
      return true;
    },
    drawSky(ctx) {
      if (!key) return;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(composite as CanvasImageSource, SKY_RECT.x, SKY_RECT.y, SKY_RECT.w, SKY_RECT.h);
      ctx.restore();
    },
    drawWater(ctx) {
      if (!key || waterAlpha <= 0.005) return;
      if (!pondPath && typeof Path2D !== 'undefined') {
        pondPath = new Path2D();
        opts.pond.forEach((q, i) => (i ? pondPath!.lineTo(q.x, q.y) : pondPath!.moveTo(q.x, q.y)));
        pondPath.closePath();
      }
      ctx.save();
      if (pondPath) ctx.clip(pondPath);
      ctx.globalAlpha *= waterAlpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(waterComposite as CanvasImageSource, waterRect.x, waterRect.y, waterRect.w, waterRect.h);
      ctx.restore();
    },
    prepare(phases) {
      for (const p of phases) paint(p);
    },
    has: (p) => plates.has(p),
    stats: () => ({ plates: plates.size, composes, paintMs }),
  };
}

/**
 * The sun: paper left unpainted (the sky's pigment taken out with a soft edge), only above the
 * far ridge so it sinks behind the hills, with a breath of warm ochre in it.
 */
function punchSun(ctx: Ctx, sun: Disc, clip: Path2D | null): void {
  ctx.save();
  if (clip) ctx.clip(clip);
  const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.r * 1.9);
  g.addColorStop(0, `rgba(0,0,0,${sun.alpha})`);
  g.addColorStop(0.5, `rgba(0,0,0,${sun.alpha})`);
  g.addColorStop(0.58, `rgba(0,0,0,${sun.alpha * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(sun.x - sun.r * 2, sun.y - sun.r * 2, sun.r * 4, sun.r * 4);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.22 * sun.alpha;
  ctx.fillStyle = 'rgb(244,206,140)';
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, sun.r * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The moon: a reserved disc with a soft halo, a few cool grey seas, and its dark side glazed
 * back with the night's indigo for the lunar phase (lit on the right while waxing).
 */
function punchMoon(ctx: Ctx, moon: Disc, phase: number): void {
  const { x, y, r } = moon;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, `rgba(0,0,0,${moon.alpha})`);
  g.addColorStop(0.4, `rgba(0,0,0,${moon.alpha * 0.98})`);
  g.addColorStop(0.44, `rgba(0,0,0,${moon.alpha * 0.4})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
  ctx.globalCompositeOperation = 'source-over';
  // seas: faint, cool, soft
  const rng = createRng('moon-seas');
  for (let i = 0; i < 5; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0.1, 0.55) * r;
    ctx.globalAlpha = 0.11 * moon.alpha;
    ctx.fillStyle = 'rgb(150,160,190)';
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * rng.range(0.16, 0.3), r * rng.range(0.12, 0.24), rng.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  // the dark side, glazed back toward the sky (never fully: earthshine)
  const k = Math.cos(phase * Math.PI * 2); // 1 new … −1 full
  if (k > -0.97) {
    const waxing = phase < 0.5;
    ctx.globalAlpha = 0.62 * moon.alpha;
    ctx.fillStyle = 'rgb(72,82,140)';
    ctx.beginPath();
    // the unlit limb: the half-disc away from the sun, plus/minus the terminator's half-ellipse
    const side = waxing ? -1 : 1; // which half is dark (waxing: left)
    ctx.arc(x, y, r * 1.04, -Math.PI / 2, Math.PI / 2, side < 0);
    ctx.ellipse(x, y, Math.abs(k) * r * 1.04, r * 1.04, 0, Math.PI / 2, -Math.PI / 2, k > 0 ? side < 0 : side > 0);
    ctx.fill();
  }
  ctx.restore();
}
