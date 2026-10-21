import { createRng } from '../core/rng';
import { createPainter } from '../paint';
import { renderPlantView } from '../plants/view';
import type { SpeciesDef } from '../plants/types';

/**
 * Species previews for the reward cards and the herbarium. Each preview is painted once with
 * `species.draw(createPainter(canvas), rng, { w, h, growth: 1 })` into an offscreen canvas and
 * cached by species + seed + size + treatment; cards just blit the cached canvas.
 */

export interface PreviewOptions {
  /** CSS size of the target box */
  w: number;
  h: number;
  /** device pixel ratio (clamped 1..2) */
  dpr?: number;
  /** plant seed (herbarium) or a stable label (reward cards) */
  seed: number | string;
  /** desaturated, flattened "pressed flower" treatment */
  pressed?: boolean;
  /** 0..1, default 1 (full bloom) */
  growth?: number;
}

export interface PreviewCache {
  /** The cached preview canvas (`w·dpr × h·dpr`), or null for an unknown/failing species. */
  get(speciesId: string, opts: PreviewOptions): HTMLCanvasElement | null;
  /** Size `target` to the preview and draw it. Returns false when there is nothing to draw. */
  paint(target: HTMLCanvasElement, speciesId: string, opts: PreviewOptions): boolean;
  readonly size: number;
  clear(): void;
}

export type CanvasFactory = (w: number, h: number) => HTMLCanvasElement;

const defaultCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Fit the species' sprite box into a W×H area, base near the bottom. */
export function fitSprite(def: Pick<SpeciesDef, 'size' | 'anchor'>, W: number, H: number): { sw: number; sh: number; x: number; y: number } {
  const aspect = def.size.w / def.size.h;
  let sh = H * 0.9;
  let sw = sh * aspect;
  if (sw > W * 0.92) {
    sw = W * 0.92;
    sh = sw / aspect;
  }
  sw = Math.max(1, Math.round(sw));
  sh = Math.max(1, Math.round(sh));
  // base point (anchor) sits at the horizontal centre, 5 % above the bottom edge
  const x = Math.round(W / 2 - def.anchor.x * sw);
  const y = Math.round(H * 0.95 - def.anchor.y * sh);
  return { sw, sh, x, y };
}

/** Pressed-flower treatment on raw RGBA: towards a warm sepia, lower saturation, a touch faded. */
export function pressPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    // sepia-tinted grey of the same lightness, lifted a little (dried pigment fades)
    const sr = Math.min(255, lum * 1.06 + 14);
    const sg = Math.min(255, lum * 0.98 + 10);
    const sb = Math.min(255, lum * 0.84 + 6);
    const keep = 0.42; // how much of the original hue survives the press
    data[i] = r * keep + sr * (1 - keep);
    data[i + 1] = g * keep + sg * (1 - keep);
    data[i + 2] = b * keep + sb * (1 - keep);
    data[i + 3] = data[i + 3]! * 0.9;
  }
}

/**
 * Paint `species` at `growth` (0 seed … 1 full bloom) into `canvas` (its pixel size), fitted
 * and standing on a baseline near the bottom. The shared start-sheet / herbarium preview helper
 * until the plants task provides a PlantView.
 */
export function renderPlantPreview(
  canvas: HTMLCanvasElement,
  species: SpeciesDef,
  seed: number | string,
  growth = 1,
  createCanvas: CanvasFactory = defaultCanvas,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { sw, sh, x, y } = fitSprite(species, canvas.width, canvas.height);
  const sprite = createCanvas(sw, sh);
  species.draw(createPainter(sprite), createRng(seed), { w: sw, h: sh, growth: Math.min(1, Math.max(0, growth)) });
  ctx.drawImage(sprite, x, y);
}

export function createPreviewCache(
  getSpecies: (id: string) => SpeciesDef | undefined,
  createCanvas: CanvasFactory = defaultCanvas,
): PreviewCache {
  const cache = new Map<string, HTMLCanvasElement | null>();

  const render = (def: SpeciesDef, opts: PreviewOptions): HTMLCanvasElement | null => {
    const dpr = Math.min(2, Math.max(1, opts.dpr ?? 1));
    const W = Math.max(1, Math.round(opts.w * dpr));
    const H = Math.max(1, Math.round(opts.h * dpr));
    const out = createCanvas(W, H);
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    if (!opts.pressed) {
      // the shared PlantView (same renderer as the widget); dev fixtures aren't in its registry
      const seed = typeof opts.seed === 'number' ? opts.seed : createRng(opts.seed).int(0, 0x7fffffff);
      if (!renderPlantView(out, { speciesId: def.id, seed, growth: opts.growth ?? 1, watering: null })) {
        renderPlantPreview(out, def, opts.seed, opts.growth ?? 1, createCanvas);
      }
      return out;
    }
    const { sw, sh, x, y } = fitSprite(def, W, H);
    const sprite = createCanvas(sw, sh);
    def.draw(createPainter(sprite), createRng(opts.seed), { w: sw, h: sh, growth: opts.growth ?? 1 });
    {
      // laid flat on the page: a small seeded tilt, slightly squashed
      const tilt = createRng(`press:${opts.seed}`).range(-0.12, 0.12);
      ctx.save();
      ctx.translate(W / 2, H * 0.55);
      ctx.rotate(tilt);
      ctx.scale(1.04, 0.94);
      ctx.translate(-W / 2, -H * 0.55);
      ctx.drawImage(sprite, x, y);
      ctx.restore();
      try {
        const img = ctx.getImageData(0, 0, W, H);
        pressPixels(img.data);
        ctx.putImageData(img, 0, 0);
      } catch {
        /* tainted/unsupported: leave the plain sprite */
      }
    }
    return out;
  };

  return {
    get(speciesId, opts) {
      const key = `${speciesId}|${opts.seed}|${opts.w}x${opts.h}@${opts.dpr ?? 1}|${opts.pressed ? 'p' : 'f'}|${opts.growth ?? 1}`;
      if (cache.has(key)) return cache.get(key) ?? null;
      const def = getSpecies(speciesId);
      let canvas: HTMLCanvasElement | null = null;
      if (def) {
        try {
          canvas = render(def, opts);
        } catch (err) {
          console.warn(`[ui] preview for "${speciesId}" failed`, err);
          canvas = null;
        }
      }
      cache.set(key, canvas);
      return canvas;
    },
    paint(target, speciesId, opts) {
      const src = this.get(speciesId, opts);
      if (!src) return false;
      if (target.width !== src.width) target.width = src.width;
      if (target.height !== src.height) target.height = src.height;
      const ctx = target.getContext('2d');
      if (!ctx) return false;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(src, 0, 0);
      return true;
    },
    get size() {
      return cache.size;
    },
    clear() {
      cache.clear();
    },
  };
}
