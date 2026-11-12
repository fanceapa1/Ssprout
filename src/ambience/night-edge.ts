import { createRng } from '../core/rng';
import { createValueNoise2D } from '../paint/noise';
import type { AnyCanvas } from '../paint';
import { BLEND_MS, dayBoundaries, type DaylightState } from './daylight';

/**
 * Where a dark light stops (ADR 0184). The stage's CSS mask (src/ui/stage-edge.ts, ADR 0132)
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
 * screen-sized canvases per size and draws them in screen space. By day they are freed and built
 * again on idle, in parts, before the evening needs them (`keep`, `edgeWanted`, ADR 0350).
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

/** A field build that runs a band of rows at a time (the edge is rebuilt on idle in parts, ADR 0350). */
export interface EdgeFieldBuild {
  readonly w: number;
  readonly h: number;
  readonly lift: Float32Array;
  readonly rim: Float32Array;
  /** rows done so far */
  readonly y: number;
  /** run up to `rows` more rows; true once every row is done */
  step(rows: number): boolean;
}

export function edgeFieldBuild(o: EdgeFieldOptions): EdgeFieldBuild {
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
  let row = 0;
  return {
    w: W,
    h: H,
    lift,
    rim,
    get y() {
      return row;
    },
    step(rows) {
      const end = Math.min(H, row + Math.max(1, rows));
      for (let y = row; y < end; y++) {
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
      row = end;
      return row >= H;
    },
  };
}

/**
 * Two alpha fields (0..1, row-major): `lift` — how much of the painting is lifted back to paper
 * (0 inside, 1 at the margin), and `rim` — the pooled pigment just inside the line.
 */
export function nightEdgeFields(o: EdgeFieldOptions): { lift: Float32Array; rim: Float32Array; w: number; h: number } {
  const b = edgeFieldBuild(o);
  b.step(b.h);
  return { lift: b.lift, rim: b.rim, w: b.w, h: b.h };
}

/** How long before the evening's blend begins the edge is built again (clock ms, ADR 0350). */
export const EDGE_LEAD_MS = 30 * 60_000;

/**
 * Whether the edge should be kept built: the light needs it now, or the evening's blend out of
 * midday begins within `lead` of `at` (the light's clock time; null for a pinned light).
 */
export function edgeWanted(light: DaylightState, at: number | null, lead = EDGE_LEAD_MS): boolean {
  if (edgeStrength(light) > 0) return true;
  if (!light.times || at === null) return false;
  const evening = dayBoundaries(light.times).find((b) => b.from === 'midday' && b.at > at);
  return !!evening && evening.at - BLEND_MS / 2 - at <= lead;
}

/** What the edge is drawn over: a canvas's device size and, when on the page, its CSS width. */
export interface EdgeTarget {
  width: number;
  height: number;
  clientWidth?: number;
}

export interface NightEdgeStats {
  /** canvas backing bytes held (RGBA) */
  bytes: number;
  /** the built sizes, `WxH@cssPerPx` */
  sizes: string[];
  /** a build in parts is under way */
  building: boolean;
  /** the last build: its parts, the longest and the total (ms), and whether a draw finished it at once */
  last: { parts: number; longestMs: number; totalMs: number; sync: boolean } | null;
  /** how many times the canvases were freed */
  frees: number;
}

export interface NightEdge {
  /** draw over the lit frame, in screen space, at `strength` (0..1); builds the edge at once if it is missing */
  draw(ctx: CanvasRenderingContext2D, strength: number): void;
  /** while `wanted`, get the edge for `target`'s size ready in parts on idle; otherwise free it (ADR 0350) */
  keep(wanted: boolean, target: EdgeTarget | null): void;
  stats(): NightEdgeStats;
}

export interface NightEdgeOptions {
  /** run a part when the browser is idle (default: requestIdleCallback) */
  idle?: (fn: () => void) => void;
  /** ms clock for the build's own timings (stats only) */
  now?: () => number;
}

/** Rim pigment: the night's indigo where it pooled (multiplied). */
const RIM = [58, 64, 110] as const;

/** Canvas sizes an edge keeps built at once. */
const EDGE_SIZES = 3;
/** Field pixels per idle part. */
export const EDGE_PART_PX = 120_000;
const shared = new Map<string, NightEdge>();

/** One edge per seed for the page: it depends only on the canvas size, so another garden reuses it. */
export function nightEdgeFor(seed = 'night-edge'): NightEdge {
  let e = shared.get(seed);
  if (!e) shared.set(seed, (e = createNightEdge(seed)));
  return e;
}

const idleSoon = (fn: () => void) => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 1000 });
  else setTimeout(fn, 30);
};
const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

interface Built {
  pw: number;
  ph: number;
  canvases: { lift: AnyCanvas; rim: AnyCanvas } | null;
}

interface Job {
  key: string;
  pw: number;
  ph: number;
  f: EdgeFieldBuild;
  lc: AnyCanvas;
  rc: AnyCanvas;
  lctx: CanvasRenderingContext2D;
  rctx: CanvasRenderingContext2D;
  li: Uint8ClampedArray;
  ri: Uint8ClampedArray;
  parts: number;
  longestMs: number;
  totalMs: number;
}

export function createNightEdge(seed = 'night-edge', opts: NightEdgeOptions = {}): NightEdge {
  const idle = opts.idle ?? idleSoon;
  const now = opts.now ?? perfNow;
  /** the built canvases by size, the last few kept (the studio draws several sizes) */
  const builds = new Map<string, Built>();
  let job: Job | null = null;
  let scheduled = false;
  let last: NightEdgeStats['last'] = null;
  let frees = 0;

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

  const sizeOf = (t: EdgeTarget) => {
    const pw = t.width;
    const ph = t.height;
    const cssPerPx = Math.max(0.5, pw / Math.max(1, t.clientWidth || pw));
    return { pw, ph, cssPerPx, key: `${pw}x${ph}@${cssPerPx.toFixed(3)}` };
  };

  const store = (key: string, b: Built) => {
    builds.set(key, b);
    if (builds.size > EDGE_SIZES) builds.delete(builds.keys().next().value!);
  };

  // fields at about one CSS px per pixel (crisp enough for the break, cheap to build once)
  function start(t: EdgeTarget): Job | null {
    const { pw, ph, cssPerPx, key } = sizeOf(t);
    const fw = Math.max(1, Math.round(pw / cssPerPx));
    const fh = Math.max(1, Math.round(ph / cssPerPx));
    const lc = make(fw, fh);
    const rc = make(fw, fh);
    const lctx = lc?.getContext('2d') as CanvasRenderingContext2D | null;
    const rctx = rc?.getContext('2d') as CanvasRenderingContext2D | null;
    if (!lc || !rc || !lctx || !rctx) {
      store(key, { pw, ph, canvases: null });
      return null;
    }
    const f = edgeFieldBuild({ w: fw, h: fh, cssPerPx: 1, seed });
    const n = fw * fh * 4;
    return { key, pw, ph, f, lc, rc, lctx, rctx, li: new Uint8ClampedArray(n), ri: new Uint8ClampedArray(n), parts: 0, longestMs: 0, totalMs: 0 };
  }

  const image = (data: Uint8ClampedArray, w: number, h: number): ImageData =>
    typeof ImageData !== 'undefined' ? new ImageData(data as Uint8ClampedArray<ArrayBuffer>, w, h) : ({ data, width: w, height: h } as ImageData);

  /** run `rows` more rows of a job (Infinity: the rest); stores the canvases once it is done */
  function run(j: Job, rows: number, sync: boolean): Built | null {
    const t0 = now();
    const { f, li, ri } = j;
    const y0 = f.y;
    const done = f.step(rows === Infinity ? f.h : rows);
    for (let i = y0 * f.w; i < f.y * f.w; i++) {
      const q = i * 4;
      li[q] = 255;
      li[q + 1] = 255;
      li[q + 2] = 255;
      li[q + 3] = Math.round(f.lift[i]! * 255);
      ri[q] = RIM[0];
      ri[q + 1] = RIM[1];
      ri[q + 2] = RIM[2];
      ri[q + 3] = Math.round(f.rim[i]! * 255);
    }
    if (done) {
      j.lctx.putImageData(image(li, f.w, f.h), 0, 0);
      j.rctx.putImageData(image(ri, f.w, f.h), 0, 0);
    }
    const ms = now() - t0;
    j.parts++;
    j.longestMs = Math.max(j.longestMs, ms);
    j.totalMs += ms;
    if (!done) return null;
    if (job === j) job = null;
    last = { parts: j.parts, longestMs: j.longestMs, totalMs: j.totalMs, sync };
    const b: Built = { pw: j.pw, ph: j.ph, canvases: { lift: j.lc, rim: j.rc } };
    store(j.key, b);
    return b;
  }

  const schedule = () => {
    if (scheduled || !job) return;
    scheduled = true;
    idle(() => {
      scheduled = false;
      const j = job;
      if (!j) return;
      run(j, Math.max(1, Math.ceil(EDGE_PART_PX / j.f.w)), false);
      if (job === j) schedule();
    });
  };

  const release = (c: AnyCanvas) => {
    c.width = 0;
    c.height = 0;
  };

  return {
    draw(ctx, strength) {
      if (strength <= 0.01) return;
      const canvas = ctx.canvas as HTMLCanvasElement | undefined;
      if (!canvas || !(canvas.width > 0) || !(canvas.height > 0)) return;
      const pw = canvas.width;
      const ph = canvas.height;
      const size = sizeOf(canvas);
      let b = builds.get(size.key);
      if (!b) {
        // not ready ahead of time (the clock jumped, a new size): finish it now, in this frame
        const j = job && job.key === size.key ? job : start(canvas);
        b = (j ? run(j, Infinity, true) : builds.get(size.key)) ?? undefined;
      }
      const c = b?.canvases;
      if (!c) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.2 * strength;
      ctx.drawImage(c.rim as CanvasImageSource, 0, 0, pw, ph);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = strength;
      ctx.drawImage(c.lift as CanvasImageSource, 0, 0, pw, ph);
      ctx.restore();
    },
    keep(wanted, target) {
      if (!wanted) {
        if (!builds.size && !job) return;
        for (const b of builds.values()) if (b.canvases) (release(b.canvases.lift), release(b.canvases.rim));
        if (job) (release(job.lc), release(job.rc));
        builds.clear();
        job = null;
        frees++;
        return;
      }
      if (!target || !(target.width > 0) || !(target.height > 0)) return;
      const same = (s: { pw: number; ph: number }) => s.pw === target.width && s.ph === target.height;
      if (job && same(job)) return;
      for (const b of builds.values()) if (same(b)) return;
      job = start(target);
      schedule();
    },
    stats() {
      let bytes = 0;
      for (const b of builds.values()) if (b.canvases) bytes += (b.canvases.lift.width * b.canvases.lift.height + b.canvases.rim.width * b.canvases.rim.height) * 4;
      if (job) bytes += (job.lc.width * job.lc.height + job.rc.width * job.rc.height) * 4;
      return { bytes, sizes: [...builds.keys()], building: job !== null, last, frees };
    },
  };
}
