import { createRng } from '../core/rng';
import { createValueNoise2D } from '../paint/noise';
import type { AnyCanvas } from '../paint';
import type { DaylightState } from './daylight';

/**
 * Where a dark light stops (ADR 0182). The stage's CSS mask (src/ui/stage-edge.ts, ADR 0132)
 * dissolves the painting into the page with a soft alpha gradient. Over the pale midday garden that
 * reads as a wash thinning out; over the night's indigo it read as a grey, milky haze, because a
 * dark colour fading in opacity over cream paper *is* haze. A watercolourist's night wash does
 * not fade like that: it is laid up to a line, where it stops with a ragged, slightly pooled edge
 * that breaks up on the paper's grain, and beyond it is paper.
 *
 * So in dark light the lighting layer lifts the painting back to white (the paper layer multiplies
 * last, so white becomes the page's paper) in a band just inside the mask's dissolve, with that
 * kind of edge: a thin darker rim where the wash pooled, then a short, granulated break into paper.
 * By midday the lift is gone and the soft dissolve is left as it was.
 *
 * Pure parts (band geometry, the alpha fields) are unit-tested; `createNightEdge` builds the two
 * screen-sized canvases once per size and draws them in screen space.
 */

/** The mask's bands for a stage of this size, in CSS px (same formulas as src/ui/stage-edge.ts). */
export function edgeBand(cssW: number, cssH: number): { feather: number; fade: number } {
  return {
    feather: Math.round(Math.min(44, Math.max(14, Math.min(cssW, cssH) * 0.04))),
    fade: Math.round(Math.min(190, Math.max(64, cssH * 0.15))),
  };
}

/** How strongly the edge is held back for this light: the darker the grade, the more (0 at midday). */
export function edgeStrength(light: Pick<DaylightState, 'weights'>): number {
  const w = light.weights;
  return Math.max(0, Math.min(1, w.night + 0.35 * w.sunset + 0.15 * w.sunrise));
}

export interface EdgeFieldOptions {
  /** field size in its own pixels */
  w: number;
  h: number;
  /** CSS px per field pixel */
  cssPerPx: number;
  seed?: number | string;
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * Two alpha fields (0..1, row-major): `lift` — how much of the painting is lifted back to paper
 * (0 inside, 1 at the margin), and `rim` — the pooled pigment just inside the line.
 */
export function nightEdgeFields(o: EdgeFieldOptions): { lift: Float32Array; rim: Float32Array; w: number; h: number } {
  const W = Math.max(1, Math.round(o.w));
  const H = Math.max(1, Math.round(o.h));
  const k = o.cssPerPx > 0 ? o.cssPerPx : 1;
  const { feather, fade } = edgeBand(W * k, H * k);
  const rng = createRng(o.seed ?? 'night-edge');
  const broad = createValueNoise2D(rng.fork('broad'), 64);
  const fine = createValueNoise2D(rng.fork('fine'), 128);
  const grain = createValueNoise2D(rng.fork('grain'), 256);
  // the wash line, as a distance in from each side (CSS px): ragged with long swells and small tears
  const lineTop = new Float32Array(W);
  const lineBottom = new Float32Array(W);
  const lineSide = new Float32Array(H * 2);
  for (let x = 0; x < W; x++) {
    const cx = x * k;
    lineTop[x] = feather * (1.05 + 0.3 * broad(cx / 120, 3.5) + 0.15 * fine(cx / 22, 8.5));
    lineBottom[x] = fade * (0.66 + 0.14 * broad(cx / 150, 21.5) + 0.06 * fine(cx / 26, 2.5));
  }
  for (let y = 0; y < H; y++) {
    const cy = y * k;
    lineSide[y * 2] = feather * (1.05 + 0.3 * broad(5.5, cy / 120) + 0.15 * fine(9.5, cy / 22));
    lineSide[y * 2 + 1] = feather * (1.05 + 0.3 * broad(31.5, cy / 120) + 0.15 * fine(41.5, cy / 22));
  }
  const lift = new Float32Array(W * H);
  const rim = new Float32Array(W * H);
  const rimW = 3.2; // CSS px of pooled pigment
  for (let y = 0; y < H; y++) {
    const cy = y * k;
    for (let x = 0; x < W; x++) {
      const cx = x * k;
      // how far inside the wash line this pixel is (CSS px; < 0 = beyond it, toward the margin)
      const dBottom = H * k - cy - lineBottom[x]!;
      const d = Math.min(cy - lineTop[x]!, dBottom, cx - lineSide[y * 2]!, W * k - cx - lineSide[y * 2 + 1]!);
      // how far the wash may run on past its line: most of the margin, so the very edge is always
      // paper; the bottom, where the garden meets the page, thins out more slowly than the sides
      const reach = d === dBottom ? fade * 0.55 : feather * 0.9;
      const g = grain(cx / 2.6, cy / 2.6) * 0.5 + 0.5; // paper grain 0..1
      let l = 0;
      if (d < 0) {
        // beyond the line the wash thins into paper over a width that changes along the edge (it
        // ran on into damp paper here, stopped on dry paper there), breaking up on the grain
        const breakW = Math.max(6, reach * (0.3 + 0.7 * (0.5 + 0.5 * broad(cx / 70 + 40.5, cy / 70 + 9.5))));
        const t = -d / breakW;
        l = smooth(t * 1.1 - (0.5 - g) * 0.55 * (1 - Math.min(1, t)));
      }
      lift[y * W + x] = Math.max(0, Math.min(1, l));
      if (d > -1.5 && d < rimW * 2.5) {
        // pooled where the wash stopped: strongest right at the line, broken here and there
        const r = Math.exp(-Math.max(0, d) / rimW) * (d < 0 ? Math.max(0, 1 + d / 1.5) : 1);
        rim[y * W + x] = r * (0.65 + 0.35 * g) * (0.75 + 0.25 * fine(cx / 14, cy / 14));
      }
    }
  }
  return { lift, rim, w: W, h: H };
}

export interface NightEdge {
  /** draw over the lit frame, in screen space, at `strength` (0..1) */
  draw(ctx: CanvasRenderingContext2D, strength: number): void;
}

/** Rim pigment: the night's indigo where it pooled (multiplied). */
const RIM = [58, 64, 110] as const;

export function createNightEdge(seed = 'night-edge'): NightEdge {
  let key = '';
  let liftCanvas: AnyCanvas | null = null;
  let rimCanvas: AnyCanvas | null = null;

  const make = (w: number, h: number): AnyCanvas | null => {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    return null;
  };

  function build(pw: number, ph: number, cssPerPx: number): void {
    // fields at about one CSS px per pixel (crisp enough for the break, cheap to build once)
    const fw = Math.max(1, Math.round(pw / cssPerPx));
    const fh = Math.max(1, Math.round(ph / cssPerPx));
    const f = nightEdgeFields({ w: fw, h: fh, cssPerPx: 1, seed });
    const lc = make(fw, fh);
    const rc = make(fw, fh);
    const lctx = lc?.getContext('2d') as CanvasRenderingContext2D | null;
    const rctx = rc?.getContext('2d') as CanvasRenderingContext2D | null;
    if (!lc || !rc || !lctx || !rctx) return;
    const li = lctx.createImageData(fw, fh);
    const ri = rctx.createImageData(fw, fh);
    for (let i = 0; i < f.lift.length; i++) {
      const j = i * 4;
      li.data[j] = 255;
      li.data[j + 1] = 255;
      li.data[j + 2] = 255;
      li.data[j + 3] = Math.round(f.lift[i]! * 255);
      ri.data[j] = RIM[0];
      ri.data[j + 1] = RIM[1];
      ri.data[j + 2] = RIM[2];
      ri.data[j + 3] = Math.round(f.rim[i]! * 255);
    }
    lctx.putImageData(li, 0, 0);
    rctx.putImageData(ri, 0, 0);
    liftCanvas = lc;
    rimCanvas = rc;
  }

  return {
    draw(ctx, strength) {
      if (strength <= 0.01) return;
      const canvas = ctx.canvas as HTMLCanvasElement | undefined;
      if (!canvas || !(canvas.width > 0) || !(canvas.height > 0)) return;
      const pw = canvas.width;
      const ph = canvas.height;
      const cssW = canvas.clientWidth || pw;
      const cssPerPx = Math.max(0.5, pw / Math.max(1, cssW));
      const k = `${pw}x${ph}@${cssPerPx.toFixed(3)}`;
      if (k !== key) {
        key = k;
        liftCanvas = null;
        rimCanvas = null;
        build(pw, ph, cssPerPx);
      }
      if (!liftCanvas || !rimCanvas) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.2 * strength;
      ctx.drawImage(rimCanvas as CanvasImageSource, 0, 0, pw, ph);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = strength;
      ctx.drawImage(liftCanvas as CanvasImageSource, 0, 0, pw, ph);
      ctx.restore();
    },
  };
}
