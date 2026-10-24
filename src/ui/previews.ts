import { createRng } from '../core/rng';
import { createPainter, mix, PIGMENTS } from '../paint';
import { drawPlantView, prewarmPlantView, renderPlantView } from '../plants/view';
import type { SpeciesDef } from '../plants/types';

/**
 * Species previews for the planting sheet's cards and the herbarium. Each preview is drawn once
 * into an offscreen canvas and cached by species + seed + size + treatment; cards just blit the
 * cached canvas. Plain previews are the shared PlantView; pressed ones are painted here.
 *
 * Two ways in (ADR 0222): `get`/`paint` draw now, painting on this thread whatever is missing
 * (the herbarium); `prewarm`/`paintReady`/`whenReady` never paint a plant sprite on this thread:
 * the sprites are painted ahead in the plant view's worker and a card fills in once they land
 * (the planting sheet).
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
  /**
   * Queue the preview's sprites in the plant view's worker at idle priority (behind the garden's
   * own sprites), and compose the preview once they land. Resolves true once `paintReady` will
   * draw it; false when it cannot be painted there (then `paintReady` paints it the old way).
   * Pressed previews resolve true at once.
   */
  prewarm(speciesId: string, opts: PreviewOptions): Promise<boolean>;
  /**
   * Size `target` to the preview and draw it if that needs no sprite painted on this thread: it
   * is cached, its prewarm has landed, or it cannot use the worker at all (an unknown species,
   * no worker sprite: drawn the old way). Otherwise leaves `target` blank, starts the prewarm
   * and returns false; call `whenReady` to hurry it.
   */
  paintReady(target: HTMLCanvasElement, speciesId: string, opts: PreviewOptions): boolean;
  /**
   * Size `target` to the preview and lay the waiting plot in it (ADR 0222): a faint wash of bare
   * earth where the plant will stand, the same ground its preview stands on. Painted once per
   * pixel size and blitted. Returns false when it could not be painted.
   */
  paintPlot(target: HTMLCanvasElement, opts: PreviewOptions): boolean;
  /**
   * Hurry the preview to the front of the worker's queue (a card on screen). Resolves once
   * `paintReady` draws it (true), or false when there is nothing to draw.
   */
  whenReady(speciesId: string, opts: PreviewOptions): Promise<boolean>;
  readonly size: number;
  clear(): void;
}

/** The pixel size a preview of these options is painted at (`w·dpr × h·dpr`, dpr clamped 1..2). */
export function previewPixels(opts: Pick<PreviewOptions, 'w' | 'h' | 'dpr'>): { width: number; height: number } {
  const dpr = Math.min(2, Math.max(1, opts.dpr ?? 1));
  return { width: Math.max(1, Math.round(opts.w * dpr)), height: Math.max(1, Math.round(opts.h * dpr)) };
}

/** The plant seed a preview uses: a number as is, a label hashed through the seeded rng. */
export function previewSeed(seed: number | string): number {
  return typeof seed === 'number' ? seed : createRng(seed).int(0, 0x7fffffff);
}

/**
 * The waiting plot (ADR 0222) into a `W×H` canvas: a small pale patch of turned earth on grass
 * at the base, where the preview's own ground wash will be (src/plants/view.ts), so the plant
 * seems to rise from ground that was already there. Nothing moves and nothing reads as loading.
 */
export function paintPlot(canvas: HTMLCanvasElement, W: number, H: number): void {
  const p = createPainter(canvas, { seed: 'preview-plot' });
  const rng = createRng('preview-plot');
  // a 200 × 60 unit patch whose foot sits on the view's baseline (97 % down the frame)
  const gw = W * 0.66;
  const scale = gw / 200;
  p.ctx.setTransform(scale, 0, 0, scale, (W - gw) / 2, H * 0.97 - 46 * scale);
  const earth = mix(PIGMENTS.stoneWarm, PIGMENTS.wood, 0.25);
  // grass thinning out to the sides, the turned earth on it, a paler crest where the plant will rise
  p.wash({ cx: 100, cy: 42, rx: 90, ry: 11 }, mix(PIGMENTS.sageLight, PIGMENTS.stoneWarm, 0.4), {
    rng,
    opacity: 0.3,
    edge: 0.3,
    sharpness: 0.3,
    centreLift: 0.3,
    deform: 0.45,
    granulation: 0.35,
    fade: { angle: -Math.PI / 2, start: 0.2, amount: 0.8, ragged: 0.6 },
  });
  p.wash({ cx: 100, cy: 38, rx: 54, ry: 13 }, earth, { rng, opacity: 0.26, edge: 0.45, sharpness: 0.3, centreLift: 0.15, deform: 0.4, granulation: 0.55 });
  p.wash({ cx: 98, cy: 32, rx: 30, ry: 5 }, mix(earth, PIGMENTS.washi, 0.5), { rng, opacity: 0.22, edge: 0.2, sharpness: 0.25, deform: 0.5 });
  p.ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const previewKey = (speciesId: string, opts: PreviewOptions) =>
  `${speciesId}|${opts.seed}|${opts.w}x${opts.h}@${opts.dpr ?? 1}|${opts.pressed ? 'p' : 'f'}|${opts.growth ?? 1}`;

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
  /** prewarms in flight or done, by key */
  const warming = new Map<string, Promise<boolean>>();
  /** keys whose prewarm landed (true) or could not use the worker (false) */
  const warmed = new Map<string, boolean>();
  /** hurried previews in flight, by key */
  const hurrying = new Map<string, Promise<boolean>>();

  /** waiting plots by pixel size */
  const plots = new Map<string, HTMLCanvasElement | null>();

  const plotFor = (opts: PreviewOptions): HTMLCanvasElement | null => {
    const { width, height } = previewPixels(opts);
    const key = `${width}x${height}`;
    let plot = plots.get(key);
    if (plot === undefined) {
      plot = createCanvas(width, height);
      try {
        paintPlot(plot, width, height);
      } catch {
        plot = null;
      }
      plots.set(key, plot);
    }
    return plot;
  };

  const viewOptions = (speciesId: string, opts: PreviewOptions) => ({ speciesId, seed: previewSeed(opts.seed), growth: opts.growth ?? 1, watering: null });

  const render = (def: SpeciesDef, opts: PreviewOptions): HTMLCanvasElement | null => {
    const { width: W, height: H } = previewPixels(opts);
    const out = createCanvas(W, H);
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    if (!opts.pressed) {
      // the shared PlantView (same renderer as the widget); dev fixtures aren't in its registry
      if (!renderPlantView(out, viewOptions(def.id, opts))) {
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

  /**
   * Draw a plain preview through `drawPlantView` (never painting a sprite here): the canvas once
   * drawn, `pending` while its sprites are on their way, `fallback` when the view cannot draw it.
   */
  type ViewTry = { canvas: HTMLCanvasElement } | { pending: Promise<boolean> } | { fallback: true };
  const tryView = (speciesId: string, opts: PreviewOptions): ViewTry => {
    const { width, height } = previewPixels(opts);
    const out = createCanvas(width, height);
    let r;
    try {
      r = drawPlantView(out, viewOptions(speciesId, opts));
    } catch (err) {
      console.warn(`[ui] preview for "${speciesId}" failed`, err);
      return { fallback: true };
    }
    if (r.state === 'drawn') {
      cache.set(previewKey(speciesId, opts), out);
      return { canvas: out };
    }
    return r.state === 'pending' ? { pending: r.ready } : { fallback: true };
  };

  const blit = (target: HTMLCanvasElement, src: HTMLCanvasElement): boolean => {
    if (target.width !== src.width) target.width = src.width;
    if (target.height !== src.height) target.height = src.height;
    const ctx = target.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(src, 0, 0);
    return true;
  };

  const api: PreviewCache = {
    get(speciesId, opts) {
      const key = previewKey(speciesId, opts);
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
      const src = api.get(speciesId, opts);
      return src ? blit(target, src) : false;
    },
    prewarm(speciesId, opts) {
      const key = previewKey(speciesId, opts);
      const known = warming.get(key);
      if (known) return known;
      // the waiting plot too, so a sheet opened before the sprites land does not paint it
      if (!opts.pressed) plotFor(opts);
      let p: Promise<boolean>;
      if (opts.pressed || cache.has(key)) p = Promise.resolve(true);
      else if (!getSpecies(speciesId)) p = Promise.resolve(false);
      else p = prewarmPlantView(previewPixels(opts), viewOptions(speciesId, opts)).catch(() => false);
      p = p.then((ok) => {
        warmed.set(key, ok);
        // compose the preview now, out of any click: the ground wash under it is painted on this
        // thread the first time a size needs it, and a sheet opened later only blits
        if (ok && !opts.pressed && !cache.has(key)) tryView(speciesId, opts);
        return ok;
      });
      warming.set(key, p);
      return p;
    },
    paintReady(target, speciesId, opts) {
      const key = previewKey(speciesId, opts);
      const { width, height } = previewPixels(opts);
      if (target.width !== width) target.width = width;
      if (target.height !== height) target.height = height;
      const done = cache.get(key);
      if (done) return blit(target, done);
      if (cache.has(key)) return false; // nothing to draw (unknown species, failed render)
      // pressed previews, and those the worker cannot paint, are drawn the old way
      if (opts.pressed || warmed.get(key) === false) return api.paint(target, speciesId, opts);
      if (warmed.get(key)) {
        const r = tryView(speciesId, opts);
        if ('canvas' in r) return blit(target, r.canvas);
        if ('fallback' in r) return api.paint(target, speciesId, opts);
        return false;
      }
      void api.prewarm(speciesId, opts);
      return false;
    },
    paintPlot(target, opts) {
      const plot = plotFor(opts);
      return plot ? blit(target, plot) : false;
    },
    whenReady(speciesId, opts) {
      const key = previewKey(speciesId, opts);
      if (cache.has(key)) return Promise.resolve(cache.get(key) !== null);
      if (opts.pressed || warmed.get(key) === false) return Promise.resolve(api.get(speciesId, opts) !== null);
      const known = hurrying.get(key);
      if (known) return known;
      const hurry = async (): Promise<boolean> => {
        // a pending draw raises the queued sprites to the front; the zoomed follow-up of a
        // growth framing needs a second round, so draw until it draws (bounded)
        for (let i = 0; i < 4; i++) {
          const r = tryView(speciesId, opts);
          if ('canvas' in r) return true;
          if ('fallback' in r || !(await r.pending)) break;
        }
        // the worker could not paint it: draw it the old way, now
        warmed.set(key, false);
        return api.get(speciesId, opts) !== null;
      };
      const p = hurry().finally(() => hurrying.delete(key));
      hurrying.set(key, p);
      return p;
    },
    get size() {
      return cache.size;
    },
    clear() {
      cache.clear();
      warming.clear();
      warmed.clear();
    },
  };
  return api;
}
