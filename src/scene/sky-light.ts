/**
 * The painted sky of the daylight phases (ADR 0145): one watercolour plate per phase (painted on
 * demand, then kept), blended by the phase weights into a composite with the sun and moon left
 * as paper. The composite is multiplied over the landscape in the cached `background` layer and
 * rebuilt only when the blend or the sun/moon moved perceptibly (every few seconds at most).
 * The same skies, mirrored, lie on the pond (`drawWater`, every frame — a cheap blit).
 * A phase's plates are looked up in the persistent paint cache before they are painted, and
 * stored once painted (ADR 0236); the composites are always built here.
 */
import { createRng } from '../core/rng';
import { PHASES, whenIdle, type DayPhase, type DaylightState, type PhaseWeights } from '../ambience/daylight';
import { moonDisc, reserveStar, stars, sunDisc, type Disc } from '../ambience/sky-layout';
import { createPlateCache, cutImage, defaultPlateCache } from '../ambience/plate-cache';
import { bounds, createPainter, createSimplex2D, insetPolygon, makeCanvas, type AnyCanvas } from '../paint';
import type { PaintCache } from '../paint/persist';
import type { Pt, Rect } from '../render/viewport';
import { DEFAULT_SCENERY, type SceneryId } from '../scenery/ids';
import type { ScenerySky } from '../scenery/types';
import { GARDEN_SKY, SKY_SCALE } from './paint-sky';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** How strongly each phase's sky lies on the water (source-over opacity). */
export const WATER_SKY_ALPHA: Readonly<Record<DayPhase, number>> = { sunrise: 0.34, midday: 0.22, sunset: 0.42, night: 0.36 };
/** Water plates are painted at this many px per world unit. */
const WATER_SCALE = 0.5;
/** A zoomed-in view composes its own sky at up to this many px per world unit (ADR 0163). */
export const SKY_DETAIL_MAX = 3;

export interface SkyLight {
  /** recompose for this state if it changed enough (or `force`); true when it did */
  update(state: DaylightState, force?: boolean): boolean;
  /**
   * Multiply the sky over the landscape (world-unit context). With the visible world rect of a
   * zoomed view that the detail covers, the sharp detail composite is drawn instead.
   */
  drawSky(ctx: Ctx, visible?: Rect): void;
  /**
   * Keep a sharp composite for a zoomed view (its visible world rect and device px per unit), or
   * none (null). Composed lazily: the plates' part under the view upscaled, then the sun, moon
   * and stars punched at full resolution — the hard edges are what looks soft when zoomed.
   */
  setDetail(visible: Rect | null, pixelScale: number): void;
  /** lay the mirrored sky on the pond (world-unit context; clips itself) */
  drawWater(ctx: Ctx): void;
  /** whether a phase's plates are there (painted or taken from the paint cache) */
  has(phase: DayPhase): boolean;
  /**
   * Get the plates for these phases ready ahead of time: looked up in the paint cache, and
   * painted (in idle time) when it does not hold them; painted now when the cache is off.
   */
  prepare(phases: readonly DayPhase[]): void;
  stats(): SkyStats;
}

export interface SkyStats {
  /** phases whose plates are there, painted or taken from the paint cache */
  plates: number;
  /** phases whose plates were painted here */
  painted: number;
  composes: number;
  paintMs: number;
  /** plates taken from the persistent paint cache, and lookups that found nothing (ADR 0236) */
  cacheHits: number;
  cacheMisses: number;
  detail: { rect: Rect; scale: number } | null;
}

/** The paint-cache kind of a phase's plates (the sky above, its water plate packed below it). */
export const SKY_PLATE_KIND = 'sky-plate';

interface Size {
  w: number;
  h: number;
}

/**
 * The paint-cache key of a phase's sky and water plates: everything their pixels depend on
 * besides the code (the cache version): the scenery, the garden seed, the phase, the plates' pixel
 * sizes and the water plate's world rect (from the pond). Numbers are exact (`String`, ADR 0242).
 */
export function skyPlateKey(scenery: SceneryId, seed: number, phase: DayPhase, sky: Size, waterRect: Rect, water: Size): string {
  const r = waterRect;
  return `${scenery}|s${seed}|${phase}|${sky.w}x${sky.h}|${r.x},${r.y},${r.w},${r.h}@${water.w}x${water.h}`;
}

/** The intersection of two rects, or null when they do not overlap. */
export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  return r > x && bt > y ? { x, y, w: r - x, h: bt - y } : null;
}

/** Whether `outer` contains `inner` (half a unit of slack). */
export const covers = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.w <= outer.x + outer.w + 0.5 && inner.y + inner.h <= outer.y + outer.h + 0.5;

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

export interface SkyLightOptions {
  pond: readonly Pt[];
  seed: number;
  /** whose sky (default: the Japanese garden's) and the scenery id its plates are stored under */
  sky?: ScenerySky;
  scenery?: SceneryId;
  /** where the plates are looked up and stored (default: the app's paint cache; null: none) */
  cache?: PaintCache | null;
}

export function createSkyLight(opts: SkyLightOptions): SkyLight {
  const plates = new Map<DayPhase, Plate>();
  const spec = opts.sky ?? GARDEN_SKY;
  const skyRect = spec.rect;
  const scenery = opts.scenery ?? DEFAULT_SCENERY;
  const pondBox = bounds(opts.pond);
  const waterRect: Rect = { x: pondBox.x - 10, y: pondBox.y - 10, w: pondBox.w + 20, h: pondBox.h + 20 };
  const sw = Math.ceil(skyRect.w * SKY_SCALE);
  const sh = Math.ceil(skyRect.h * SKY_SCALE);
  const composite = makeCanvas(sw, sh);
  const cctx = composite.getContext('2d') as Ctx;
  const ww = Math.ceil(waterRect.w * WATER_SCALE);
  const wh = Math.ceil(waterRect.h * WATER_SCALE);
  const waterComposite = makeCanvas(ww, wh);
  const wctx = waterComposite.getContext('2d') as Ctx;
  let waterMask: AnyCanvas | null | undefined;
  let waterAlpha = 0;
  let key = '';
  let last: { state: DaylightState; sun: Disc; moon: Disc } | null = null;
  let detailWant: { rect: Rect; scale: number } | null = null;
  let detail: { rect: Rect; scale: number; canvas: AnyCanvas; key: string } | null = null;
  let composes = 0;
  let paintMs = 0;
  let painted = 0;
  let pondPath: Path2D | null = null;
  let skyPath: Path2D | null = null;
  /** the light changed while a needed plate was still being looked up: composed when it answers (or when drawn) */
  let deferred = false;
  /** phases `prepare` asked for whose lookup has not answered yet */
  const preparing = new Set<DayPhase>();
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  // the paint cache's copy: the sky plate on top, the water plate below it, in one image
  const atlasW = Math.max(sw, ww);
  const atlasH = sh + wh;
  const pack = (plate: Plate): AnyCanvas => {
    const c = makeCanvas(atlasW, atlasH);
    const x = c.getContext('2d') as Ctx;
    x.imageSmoothingEnabled = false;
    x.drawImage(plate.sky as CanvasImageSource, 0, 0);
    x.drawImage(plate.water as CanvasImageSource, 0, sh);
    return c;
  };
  const store = createPlateCache<DayPhase>({
    cache: opts.cache === undefined ? defaultPlateCache() : opts.cache,
    kind: SKY_PLATE_KIND,
    key: (phase) => skyPlateKey(scenery, opts.seed, phase, { w: sw, h: sh }, waterRect, { w: ww, h: wh }),
    load(phase, image) {
      if (image.width !== atlasW || image.height !== atlasH) return false;
      if (!plates.has(phase)) plates.set(phase, { sky: cutImage(image, 0, 0, sw, sh), water: cutImage(image, 0, sh, ww, wh) });
      return true;
    },
    answered(phase) {
      if (preparing.delete(phase) && !plates.has(phase)) whenIdle(() => void paint(phase));
      if (deferred && last && !waiting(last.state)) flush();
    },
  });
  /** whether a plate the blend needs is still being looked up */
  const waiting = (state: DaylightState) => blendOrder(state.weights).some(({ phase }) => !plates.has(phase) && store.pending(phase));

  const paint = (phase: DayPhase): Plate => {
    const known = plates.get(phase);
    if (known) return known;
    const t0 = now();
    const sky = makeCanvas(sw, sh);
    const sp = createPainter(sky, { seed: `${opts.seed}:sky:${phase}` });
    sp.ctx.fillStyle = '#ffffff';
    sp.ctx.fillRect(0, 0, sw, sh);
    sp.ctx.setTransform(SKY_SCALE, 0, 0, SKY_SCALE, -skyRect.x * SKY_SCALE, -skyRect.y * SKY_SCALE);
    spec.paint(sp, createRng(`${opts.seed}:sky:${phase}`), phase);
    const water = makeCanvas(ww, wh);
    const wp = createPainter(water, { seed: `${opts.seed}:water-sky:${phase}` });
    wp.ctx.fillStyle = '#ffffff';
    wp.ctx.fillRect(0, 0, ww, wh);
    wp.ctx.setTransform(WATER_SCALE, 0, 0, WATER_SCALE, -waterRect.x * WATER_SCALE, -waterRect.y * WATER_SCALE);
    spec.paintWater(wp, createRng(`${opts.seed}:water-sky:${phase}`), phase, pondBox);
    const plate = { sky, water };
    plates.set(phase, plate);
    paintMs += now() - t0;
    painted++;
    store.painted(phase, () => pack(plate));
    return plate;
  };

  /** compose a deferred light change now (its missing plates painted) */
  const flush = () => {
    if (!deferred || !last) return;
    deferred = false;
    compose(last.state, last.sun, last.moon);
  };

  const skyClip = () => {
    if (!skyPath && typeof Path2D !== 'undefined') {
      skyPath = new Path2D();
      spec.shape(0).forEach((q, i) => (i ? skyPath!.lineTo(q.x, q.y) : skyPath!.moveTo(q.x, q.y)));
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
    // the reflected sky dies away just inside the painted water's ragged rim instead of stopping
    // at the pond outline (a hard pink line along the near edge, seen close)
    if (waterMask === undefined) waterMask = feathered(opts.pond, waterRect, ww, wh, opts.seed);
    if (waterMask) {
      wctx.globalCompositeOperation = 'destination-in';
      wctx.drawImage(waterMask as CanvasImageSource, 0, 0);
      wctx.globalCompositeOperation = 'source-over';
    }
    // world units from here on
    cctx.setTransform(SKY_SCALE, 0, 0, SKY_SCALE, -skyRect.x * SKY_SCALE, -skyRect.y * SKY_SCALE);
    if (sun.alpha > 0.01) punchSun(cctx, sun, skyClip());
    if (moon.alpha > 0.01) punchMoon(cctx, moon, state.moonPhase);
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    composes++;
  };

  /** the detail composite for the wanted view and the current light (rebuilt when either changed) */
  const composeDetail = () => {
    if (!detailWant || !last) return (detail = null);
    const { rect, scale } = detailWant;
    const dkey = `${key}|${rect.x},${rect.y},${rect.w},${rect.h}@${scale}`;
    if (detail?.key === dkey) return detail;
    const w = Math.max(1, Math.ceil(rect.w * scale));
    const h = Math.max(1, Math.ceil(rect.h * scale));
    const canvas = detail && detail.canvas.width === w && detail.canvas.height === h ? detail.canvas : makeCanvas(w, h);
    const dctx = canvas.getContext('2d') as Ctx;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.globalAlpha = 1;
    dctx.clearRect(0, 0, w, h);
    dctx.imageSmoothingEnabled = true;
    // the plates' part under the view (soft washes upscale well)
    const sx = (rect.x - skyRect.x) * SKY_SCALE;
    const sy = (rect.y - skyRect.y) * SKY_SCALE;
    for (const { phase, alpha } of blendOrder(last.state.weights)) {
      dctx.globalAlpha = alpha;
      dctx.drawImage(paint(phase).sky as CanvasImageSource, sx, sy, rect.w * SKY_SCALE, rect.h * SKY_SCALE, 0, 0, w, h);
    }
    dctx.globalAlpha = 1;
    dctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
    // the hard edges at full resolution: the stars' paper flecks, the sun and the moon
    const night = last.state.weights.night;
    if (night > 0.01) for (const st of stars(30, 'stars', spec.layout)) if (st.x > rect.x - 6 && st.x < rect.x + rect.w + 6 && st.y > rect.y - 6 && st.y < rect.y + rect.h + 6) reserveStar(dctx, st, night);
    if (last.sun.alpha > 0.01) punchSun(dctx, last.sun, skyClip());
    if (last.moon.alpha > 0.01) punchMoon(dctx, last.moon, last.state.moonPhase);
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    detail = { rect, scale, canvas, key: dkey };
    return detail;
  };

  return {
    update(state, force = false) {
      const sun = sunDisc(state, spec.layout);
      const moon = moonDisc(state, spec.layout);
      const k = skyKey(state.weights, sun, moon);
      if (!force && k === key) return false;
      key = k;
      last = { state, sun, moon };
      if (store.enabled) {
        // plates the blend lacks are looked up first; the composite follows their answers, or
        // the first draw, whichever comes first (a draw never shows a stale composite)
        for (const { phase } of blendOrder(state.weights)) if (!plates.has(phase)) store.request(phase);
        if (waiting(state)) {
          deferred = true;
          return true;
        }
      }
      deferred = false;
      compose(state, sun, moon);
      return true;
    },
    setDetail(visible, pixelScale) {
      const rect = visible ? intersect(visible, skyRect) : null;
      const scale = Math.min(SKY_DETAIL_MAX, Math.max(SKY_SCALE, pixelScale));
      if (!rect || scale <= SKY_SCALE * 1.3) {
        detailWant = null;
        detail = null;
        return;
      }
      // whole units, a little margin: small pans reuse it
      const m = 24;
      const r = { x: Math.floor(rect.x - m), y: Math.floor(rect.y - m), w: Math.ceil(rect.w + 2 * m), h: Math.ceil(rect.h + 2 * m) };
      const clipped = intersect(r, skyRect)!;
      detailWant = { rect: clipped, scale: Math.round(scale * 100) / 100 };
    },
    drawSky(ctx, visible) {
      if (!key) return;
      flush();
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      const inSky = visible ? intersect(visible, skyRect) : null;
      const d = visible && detailWant && (!inSky || covers(detailWant.rect, inSky)) ? composeDetail() : null;
      if (d && inSky) ctx.drawImage(d.canvas as CanvasImageSource, d.rect.x, d.rect.y, d.rect.w, d.rect.h);
      else if (!visible || inSky) ctx.drawImage(composite as CanvasImageSource, skyRect.x, skyRect.y, skyRect.w, skyRect.h);
      ctx.restore();
    },
    drawWater(ctx) {
      flush();
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
      for (const p of phases) {
        if (plates.has(p)) continue;
        if (!store.enabled) paint(p);
        else if (!store.pending(p)) {
          preparing.add(p);
          store.request(p);
          // asked before: its answer has come (a miss), so paint it now
          if (!store.pending(p)) {
            preparing.delete(p);
            paint(p);
          }
        }
      }
    },
    has: (p) => plates.has(p),
    stats: () => {
      const c = store.stats();
      return { plates: plates.size, painted, composes, paintMs, cacheHits: c.hits, cacheMisses: c.misses, detail: detail ? { rect: { ...detail.rect }, scale: detail.scale } : null };
    },
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

/** How far inside the pond outline the sky's reflection has faded out (world units). */
export const WATER_SKY_INSET = 7;

/**
 * The pond as a soft mask for the reflected sky: the outline pulled in by `WATER_SKY_INSET`, its
 * edge wandering a little (the painted rim is ragged) and blurred over a few units. Null without
 * canvas support.
 */
function feathered(pond: readonly Pt[], rect: Rect, w: number, h: number, seed: number): AnyCanvas | null {
  let c: AnyCanvas;
  try {
    c = makeCanvas(w, h);
  } catch {
    return null;
  }
  const ctx = c.getContext('2d') as Ctx | null;
  if (!ctx) return null;
  const noise = createSimplex2D(createRng(`${seed}:water-mask`));
  const inner = insetPolygon(pond, WATER_SKY_INSET).map((q) => {
    const k = 2.5 * noise(q.x / 40, q.y / 40);
    return { x: q.x, y: q.y - Math.abs(k) };
  });
  const sx = w / rect.w;
  const sy = h / rect.h;
  ctx.setTransform(sx, 0, 0, sy, -rect.x * sx, -rect.y * sy);
  ctx.filter = `blur(${(3 * sx).toFixed(2)}px)`;
  const supported = ctx.filter !== 'none' && ctx.filter !== '';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  inner.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
  if (supported) ctx.filter = 'none';
  return c;
}
