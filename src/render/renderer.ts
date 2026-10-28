import type { Clock } from '../core/clock';
import type { EventBus } from '../core/events';
import type { Store } from '../core/state';
import type { SceneGeometry } from '../scene/geometry';
import type { Scenery } from '../scenery/types';
import { createCamera, MAX_ZOOM, type Camera } from './camera';
import { CACHED_LAYERS, LAYERS, type Drawable, type FrameInfo, type LayerId, type System, type SystemContext } from './types';
import { createViewport, DEFAULT_FOCUS, type Pt, type Viewport } from './viewport';

/**
 * One visible canvas. `background` and `paper` are painted once per resize into offscreen
 * canvases; every other layer is redrawn each frame, in LAYERS order. A camera (camera.ts) zooms
 * and pans over the overview: every world layer is drawn through its view; the background is
 * cached twice — at the overview, blitted as a sub-rect while the camera moves, and at the
 * resting view once it settles (ADR 0161). The paper stays screen-fixed. See docs/systems/render.md.
 */
export interface RendererOptions {
  canvas: HTMLCanvasElement;
  store: Store;
  bus: EventBus;
  clock: Clock;
  scene: SceneGeometry;
  /** the scenery on view at start (its geometry replaces `scene`, its focus `focus`) */
  scenery?: Scenery;
  reducedMotion?: boolean;
  /** world point kept centred when the screen crops (default: the scenery's focus, else the pond centre) */
  focus?: Pt;
  /** debounce for resize-triggered re-init (ms, default 200) */
  resizeDebounceMs?: number;
  /** camera zoom limit (default MAX_ZOOM) */
  maxZoom?: number;
  /** upper bound for FrameInfo.dt in seconds (default 0.1) */
  maxDt?: number;
  /** canvas size in CSS px + device pixel ratio (default: canvas client rect + window.devicePixelRatio) */
  measure?: () => { w: number; h: number; dpr: number };
  /** factory for offscreen cache canvases (default: document.createElement('canvas')) */
  createCanvas?: () => HTMLCanvasElement;
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  /** called when a system throws; default logs once per system+phase */
  onSystemError?: (systemId: string, phase: string, err: unknown) => void;
}

export interface Renderer {
  /** what the stage shows this frame: the overview composed with the camera (world ↔ stage CSS px) */
  readonly viewport: Viewport;
  /** the overview (cover) viewport, zoom 1: what systems size their caches from */
  readonly baseViewport: Viewport;
  readonly camera: Camera;
  readonly frozen: boolean;
  readonly running: boolean;
  /** false while the stage is scrolled out of view: the loop draws nothing (ADR 0224) */
  readonly visible: boolean;
  /** Resolves once every system has initialised for the current size and caches are built. */
  whenReady(): Promise<void>;
  /** Register a system (initialised immediately if the renderer is already sized). */
  add(system: System): Promise<void>;
  remove(id: string): void;
  systems(): readonly System[];
  start(): void;
  stop(): void;
  /** Stop animating (t stops advancing) and draw one stable frame. */
  freeze(): void;
  unfreeze(): void;
  /** Draw a single frame now with dt = 0 (updates systems with dt = 0 too). Works while hidden. */
  renderOnce(): void;
  /**
   * Pause (false) or resume (true) the frame loop for an off-screen stage (ADR 0224). Hidden, no
   * frame is updated or drawn; `renderOnce`, `freeze` and resize re-inits still work. Resuming
   * keeps the last frame's timestamp, so the first frame back gets the usual clamped `dt`.
   */
  setVisible(visible: boolean): void;
  /**
   * Drive `setVisible` from an IntersectionObserver on `target` (the garden stage), resuming
   * `margin` before it scrolls into view. Returns a disconnect; a no-op without IntersectionObserver.
   */
  pauseWhenOffscreen(target: Element, margin?: string): () => void;
  /** the scenery on view (null when the renderer was made without one) */
  readonly scenery: Scenery | null;
  /**
   * Show another garden (ADR 0243): keep the last frame, cut the camera to the new overview,
   * re-init every system with it, then cross-fade (a cut under reduced motion). Resolves when ready.
   */
  setScenery(scenery: Scenery): Promise<void>;
  /** 0..1 how much of the previous garden's last frame still shows (0: no switch under way) */
  sceneryFade(): number;
  /** Re-measure and re-initialise immediately (resize events call this debounced). */
  resize(): Promise<void>;
  /** Rebuild a cached layer before the next frame (e.g. when the scene changes). */
  invalidate(layer?: LayerId): void;
  /** Main-thread cost of recent frames (update + composite) and the intervals between them, in ms. */
  frameStats(): FrameStats;
  resetFrameStats(): void;
  dispose(): void;
}

export interface FrameStats {
  frames: number;
  workAvg: number;
  workP95: number;
  workMax: number;
  intervalAvg: number;
  intervalP95: number;
}

const STAT_FRAMES = 600;
/** Seconds the previous garden takes to fade out once the new one is ready (ADR 0243). */
export const SCENERY_FADE_S = 0.9;

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

interface Entry {
  system: System;
  ready: boolean;
}

export function createRenderer(opts: RendererOptions): Renderer {
  const {
    canvas,
    resizeDebounceMs = 200,
    maxDt = 0.1,
    reducedMotion = false,
  } = opts;
  let scenery: Scenery | null = opts.scenery ?? null;
  let focus: Pt = opts.focus ?? scenery?.view.focus ?? DEFAULT_FOCUS;
  const win: (Window & typeof globalThis) | undefined = typeof window === 'undefined' ? undefined : window;
  const measure =
    opts.measure ??
    (() => {
      const r = canvas.getBoundingClientRect();
      return {
        w: r.width || win?.innerWidth || 1,
        h: r.height || win?.innerHeight || 1,
        dpr: win?.devicePixelRatio ?? 1,
      };
    });
  const createCanvas = opts.createCanvas ?? (() => document.createElement('canvas'));
  const requestFrame = opts.requestFrame ?? ((cb) => win!.requestAnimationFrame(cb));
  const cancelFrame = opts.cancelFrame ?? ((id) => win!.cancelAnimationFrame(id));
  const reported = new Set<string>();
  const onSystemError =
    opts.onSystemError ??
    ((id, phase, err) => {
      const key = `${id}:${phase}`;
      if (reported.has(key)) return;
      reported.add(key);
      console.error(`[render] system "${id}" failed in ${phase}`, err);
    });

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const entries: Entry[] = [];
  const caches = new Map<LayerId, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();
  const dirty = new Set<LayerId>(CACHED_LAYERS);

  let viewport = createViewport(1, 1, 1, focus);
  const camera = createCamera({ base: viewport, reducedMotion, maxZoom: opts.maxZoom ?? MAX_ZOOM });
  /** the resting-view background cache: valid for this view object while not dirty */
  let viewCacheFor: Viewport | null = null;
  let viewCacheDirty = true;
  let sized = false;
  let generation = 0;
  let readyPromise: Promise<void> = Promise.resolve();
  let rafId: number | null = null;
  let running = false;
  let frozen = false;
  let visible = true;
  let visibilityObserver: IntersectionObserver | null = null;
  let lastTs: number | null = null;
  let t = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  /** the previous garden's last frame while a switch is under way, and how much of it shows */
  let snapshot: HTMLCanvasElement | null = null;
  let snapshotAlpha = 0;
  let snapshotFading = false;

  const systemContext = (): SystemContext => ({
    viewport,
    camera,
    store: opts.store,
    bus: opts.bus,
    clock: opts.clock,
    scene: scenery?.geometry ?? opts.scene,
    ...(scenery ? { scenery } : {}),
    reducedMotion,
  });

  const guard = <T>(id: string, phase: string, fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (err) {
      onSystemError(id, phase, err);
      return undefined;
    }
  };

  const initEntry = async (entry: Entry, gen: number): Promise<void> => {
    try {
      await entry.system.init?.(systemContext());
      if (gen === generation) entry.ready = true;
    } catch (err) {
      onSystemError(entry.system.id, 'init', err);
    }
  };

  const ensureCache = (layer: LayerId | 'background:view') => {
    let c = caches.get(layer as LayerId);
    if (!c) {
      const cv = createCanvas();
      const cx = cv.getContext('2d');
      if (!cx) throw new Error('2D canvas context unavailable');
      c = { canvas: cv, ctx: cx };
      caches.set(layer as LayerId, c);
    }
    if (c.canvas.width !== viewport.pixelW || c.canvas.height !== viewport.pixelH) {
      c.canvas.width = viewport.pixelW;
      c.canvas.height = viewport.pixelH;
    }
    return c;
  };

  const frameInfo = (dt: number): FrameInfo => ({ t, dt, now: opts.clock.now(), view: camera.view() });

  /** the paper (and the overview background) — both drawn at the overview */
  const rebuildCaches = (f: FrameInfo, layers: readonly LayerId[]) => {
    for (const layer of layers) {
      if (!dirty.has(layer)) continue;
      const { ctx: cx } = ensureCache(layer);
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, viewport.pixelW, viewport.pixelH);
      drawLayer(cx, layer, { ...f, view: viewport }, viewport);
      dirty.delete(layer);
    }
  };

  /** the background at the camera's resting view (rebuilt when the view or the painting changes) */
  const viewCache = (f: FrameInfo, view: Viewport) => {
    const c = ensureCache('background:view');
    if (viewCacheDirty || viewCacheFor !== view) {
      c.ctx.setTransform(1, 0, 0, 1, 0, 0);
      c.ctx.clearRect(0, 0, view.pixelW, view.pixelH);
      drawLayer(c.ctx, 'background', { ...f, view }, view);
      viewCacheFor = view;
      viewCacheDirty = false;
    }
    return c;
  };

  const drawLayer = (cx: CanvasRenderingContext2D, layer: LayerId, f: FrameInfo, vp: Viewport = camera.view()) => {
    for (const e of entries) {
      const s = e.system;
      if (!e.ready || !s.draw) continue;
      cx.save();
      vp.applyTo(cx);
      guard(s.id, `draw:${layer}`, () => s.draw!(layer, cx, f));
      cx.restore();
    }
  };

  const drawEntities = (cx: CanvasRenderingContext2D, f: FrameInfo) => {
    const view = camera.view();
    drawLayer(cx, 'entities', f, view);
    const items: { d: Drawable; id: string; i: number }[] = [];
    for (const e of entries) {
      if (!e.ready || !e.system.entities) continue;
      const list = guard(e.system.id, 'entities', () => e.system.entities!(f)) ?? [];
      for (const d of list) items.push({ d, id: e.system.id, i: items.length });
    }
    // stable depth sort: equal depths keep registration/contribution order
    items.sort((a, b) => a.d.depth - b.d.depth || a.i - b.i);
    for (const { d, id } of items) {
      cx.save();
      view.applyTo(cx);
      guard(id, 'draw:entity', () => d.draw(cx, f));
      cx.restore();
    }
  };

  /**
   * The background: at the overview its cache as is; while the camera moves, the overview cache's
   * sub-rect under the view, scaled up (one blit, no repaint); once it rests, the cache built at
   * the resting view (sharp: the scene may have painted detail for it).
   */
  /** the view lies inside the overview (its cache can serve it) */
  const insideOverview = (view: Viewport) => {
    const v = view.visible;
    const o = viewport.visible;
    return v.x >= o.x - 0.01 && v.y >= o.y - 0.01 && v.x + v.w <= o.x + o.w + 0.01 && v.y + v.h <= o.y + o.h + 0.01;
  };
  const overviewBackground = () => camera.view() === viewport || (camera.moving() && insideOverview(camera.view()));
  const drawBackground = (f: FrameInfo) => {
    const view = camera.view();
    if (overviewBackground()) {
      const c = caches.get('background');
      if (!c) return;
      if (view === viewport) {
        ctx.drawImage(c.canvas, 0, 0);
        return;
      }
      const v = view.visible;
      const k = viewport.scale * viewport.dpr;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        c.canvas,
        (v.x * viewport.scale + viewport.offsetX) * viewport.dpr,
        (v.y * viewport.scale + viewport.offsetY) * viewport.dpr,
        v.w * k,
        v.h * k,
        0,
        0,
        view.pixelW,
        view.pixelH,
      );
      return;
    }
    if (camera.moving()) {
      // moving outside the overview's crop (a phone looking at the garden's sides): draw it directly
      ctx.save();
      drawLayer(ctx, 'background', { ...f, view }, view);
      ctx.restore();
      return;
    }
    ctx.drawImage(viewCache(f, view).canvas, 0, 0);
  };

  const composite = (f: FrameInfo) => {
    rebuildCaches(f, overviewBackground() ? CACHED_LAYERS : ['paper']);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, viewport.pixelW, viewport.pixelH);
    for (const layer of LAYERS) {
      if (layer === 'background') {
        drawBackground(f);
      } else if (layer === 'paper') {
        const c = caches.get('paper');
        if (c) {
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(c.canvas, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (layer === 'entities') {
        drawEntities(ctx, f);
      } else {
        drawLayer(ctx, layer, f);
      }
    }
    if (snapshot && snapshotAlpha > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = snapshotAlpha;
      ctx.drawImage(snapshot, 0, 0, viewport.pixelW, viewport.pixelH);
      ctx.globalAlpha = 1;
    }
  };

  const endSnapshot = () => {
    snapshot = null;
    snapshotAlpha = 0;
    snapshotFading = false;
  };

  const work: number[] = [];
  const intervals: number[] = [];
  const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const frame = (dt: number) => {
    if (!sized) return;
    const t0 = perfNow();
    camera.update(dt);
    if (snapshotFading) {
      snapshotAlpha = Math.max(0, snapshotAlpha - dt / SCENERY_FADE_S);
      if (snapshotAlpha <= 0) endSnapshot();
    }
    const f = frameInfo(dt);
    for (const e of entries) {
      if (e.ready && e.system.update) guard(e.system.id, 'update', () => e.system.update!(f));
    }
    composite(f);
    work.push(perfNow() - t0);
    if (dt > 0) intervals.push(dt * 1000);
    if (work.length > STAT_FRAMES) work.shift();
    if (intervals.length > STAT_FRAMES) intervals.shift();
  };

  const loop = (ts: number) => {
    rafId = null;
    if (!running || frozen || disposed || !visible) return;
    rafId = requestFrame(loop);
    const dt = lastTs === null ? 0 : Math.min(maxDt, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    t += dt;
    frame(dt);
  };

  /** `fresh`: the next frame starts time over (dt 0); otherwise it continues from the last one */
  const schedule = (fresh = true) => {
    if (running && !frozen && !disposed && visible && rafId === null) {
      if (fresh) lastTs = null;
      rafId = requestFrame(loop);
    }
  };

  const resize = async (): Promise<void> => {
    if (disposed) return;
    const m = measure();
    viewport = createViewport(m.w, m.h, m.dpr, focus);
    camera.setBase(viewport);
    viewCacheDirty = true;
    if (canvas.width !== viewport.pixelW) canvas.width = viewport.pixelW;
    if (canvas.height !== viewport.pixelH) canvas.height = viewport.pixelH;
    sized = true;
    const gen = ++generation;
    // Systems keep drawing with their previous caches until their re-init completes.
    readyPromise = Promise.all(entries.map((e) => initEntry(e, gen))).then(() => {
      if (gen !== generation || disposed) return;
      for (const l of CACHED_LAYERS) dirty.add(l);
      viewCacheDirty = true;
      // the backing store was cleared by the resize: repaint even when frozen
      if (frozen || !running) frame(0);
    });
    return readyPromise;
  };

  const onWindowResize = () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      const m = measure();
      const next = createViewport(m.w, m.h, m.dpr, focus);
      if (next.pixelW !== viewport.pixelW || next.pixelH !== viewport.pixelH || next.dpr !== viewport.dpr) {
        void resize();
      }
    }, resizeDebounceMs);
  };

  let resizeObserver: ResizeObserver | null = null;

  const renderer: Renderer = {
    get viewport() {
      return camera.view();
    },
    get baseViewport() {
      return viewport;
    },
    camera,
    get frozen() {
      return frozen;
    },
    get running() {
      return running;
    },
    get visible() {
      return visible;
    },
    whenReady: () => readyPromise,
    add(system) {
      if (entries.some((e) => e.system.id === system.id)) {
        return Promise.reject(new Error(`system "${system.id}" already registered`));
      }
      const entry: Entry = { system, ready: false };
      entries.push(entry);
      if (!sized) return Promise.resolve();
      const gen = generation;
      const p = initEntry(entry, gen).then(() => {
        for (const l of CACHED_LAYERS) dirty.add(l);
        viewCacheDirty = true;
        if (frozen || !running) frame(0);
      });
      readyPromise = Promise.all([readyPromise, p]).then(() => undefined);
      return p;
    },
    remove(id) {
      const i = entries.findIndex((e) => e.system.id === id);
      if (i < 0) return;
      const [entry] = entries.splice(i, 1);
      if (entry) guard(id, 'dispose', () => entry.system.dispose?.());
      for (const l of CACHED_LAYERS) dirty.add(l);
      viewCacheDirty = true;
    },
    systems: () => entries.map((e) => e.system),
    start() {
      if (running || disposed) return;
      running = true;
      if (!sized) void resize();
      if (win) {
        win.addEventListener('resize', onWindowResize);
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(onWindowResize);
          resizeObserver.observe(canvas);
        }
      }
      schedule();
    },
    stop() {
      running = false;
      if (rafId !== null) cancelFrame(rafId);
      rafId = null;
      win?.removeEventListener('resize', onWindowResize);
      resizeObserver?.disconnect();
      resizeObserver = null;
    },
    freeze() {
      frozen = true;
      if (rafId !== null) cancelFrame(rafId);
      rafId = null;
      // a stable frame: a cross-fade under way ends now (a switch still loading keeps its cover)
      if (snapshotFading) endSnapshot();
      frame(0);
    },
    unfreeze() {
      frozen = false;
      schedule();
    },
    renderOnce() {
      frame(0);
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (!visible) {
        if (rafId !== null) cancelFrame(rafId);
        rafId = null;
        return;
      }
      // the first frame back: dt from the last drawn frame, clamped to maxDt (no jump); caches
      // invalidated while hidden (a resize, a new painting) are rebuilt by that frame
      schedule(false);
    },
    pauseWhenOffscreen(target, margin = '160px 0px') {
      visibilityObserver?.disconnect();
      if (typeof IntersectionObserver === 'undefined') return () => {};
      const io = new IntersectionObserver(
        (entries) => {
          const last = entries[entries.length - 1];
          if (last) renderer.setVisible(last.isIntersecting);
        },
        { rootMargin: margin },
      );
      io.observe(target);
      visibilityObserver = io;
      return () => {
        io.disconnect();
        if (visibilityObserver === io) visibilityObserver = null;
        renderer.setVisible(true);
      };
    },
    resize,
    get scenery() {
      return scenery;
    },
    sceneryFade: () => snapshotAlpha,
    setScenery(next) {
      if (disposed || next === scenery || (scenery && next.id === scenery.id)) return readyPromise;
      // keep what is on screen: it covers the new garden until that is ready
      if (sized && canvas.width > 0 && canvas.height > 0) {
        const snap = snapshot ?? createCanvas();
        if (!snapshot) {
          snap.width = canvas.width;
          snap.height = canvas.height;
          snap.getContext('2d')?.drawImage(canvas, 0, 0);
        }
        snapshot = snap;
        snapshotAlpha = 1;
        snapshotFading = false;
      }
      scenery = next;
      focus = opts.focus ?? next.view.focus;
      const ready = resize();
      camera.overview({ animate: false });
      const gen = generation;
      void ready.then(() => {
        if (gen !== generation || disposed || !snapshot) return;
        // a cut under reduced motion, or when no frame loop would carry the fade
        if (reducedMotion || frozen || !running || !visible) {
          endSnapshot();
          frame(0);
        } else snapshotFading = true;
      });
      return ready;
    },
    frameStats: () => ({
      frames: work.length,
      workAvg: r2(avg(work)),
      workP95: r2(percentile(work, 0.95)),
      workMax: r2(Math.max(0, ...work)),
      intervalAvg: r2(avg(intervals)),
      intervalP95: r2(percentile(intervals, 0.95)),
    }),
    resetFrameStats() {
      work.length = 0;
      intervals.length = 0;
    },
    invalidate(layer) {
      if (layer) dirty.add(layer);
      else for (const l of CACHED_LAYERS) dirty.add(l);
      if (!layer || layer === 'background') viewCacheDirty = true;
    },
    dispose() {
      renderer.stop();
      visibilityObserver?.disconnect();
      visibilityObserver = null;
      disposed = true;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      for (const e of entries.splice(0)) guard(e.system.id, 'dispose', () => e.system.dispose?.());
      caches.clear();
      endSnapshot();
    },
  };
  return renderer;
}
