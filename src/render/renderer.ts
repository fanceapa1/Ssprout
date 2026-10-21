import type { Clock } from '../core/clock';
import type { EventBus } from '../core/events';
import type { Store } from '../core/state';
import type { SceneGeometry } from '../scene/geometry';
import { CACHED_LAYERS, LAYERS, type Drawable, type FrameInfo, type LayerId, type System, type SystemContext } from './types';
import { createViewport, DEFAULT_FOCUS, type Pt, type Viewport } from './viewport';

/**
 * One visible canvas. `background` and `paper` are painted once per resize into offscreen
 * canvases; every other layer is redrawn each frame, in LAYERS order. See docs/systems/render.md.
 */
export interface RendererOptions {
  canvas: HTMLCanvasElement;
  store: Store;
  bus: EventBus;
  clock: Clock;
  scene: SceneGeometry;
  reducedMotion?: boolean;
  /** world point kept centred when the screen crops (default: pond centre) */
  focus?: Pt;
  /** debounce for resize-triggered re-init (ms, default 200) */
  resizeDebounceMs?: number;
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
  readonly viewport: Viewport;
  readonly frozen: boolean;
  readonly running: boolean;
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
  /** Draw a single frame now with dt = 0 (updates systems with dt = 0 too). */
  renderOnce(): void;
  /** Re-measure and re-initialise immediately (resize events call this debounced). */
  resize(): Promise<void>;
  /** Rebuild a cached layer before the next frame (e.g. when the scene changes). */
  invalidate(layer?: LayerId): void;
  dispose(): void;
}

interface Entry {
  system: System;
  ready: boolean;
}

export function createRenderer(opts: RendererOptions): Renderer {
  const {
    canvas,
    resizeDebounceMs = 200,
    maxDt = 0.1,
    focus = DEFAULT_FOCUS,
    reducedMotion = false,
  } = opts;
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
  let sized = false;
  let generation = 0;
  let readyPromise: Promise<void> = Promise.resolve();
  let rafId: number | null = null;
  let running = false;
  let frozen = false;
  let lastTs: number | null = null;
  let t = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const systemContext = (): SystemContext => ({
    viewport,
    store: opts.store,
    bus: opts.bus,
    clock: opts.clock,
    scene: opts.scene,
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

  const ensureCache = (layer: LayerId) => {
    let c = caches.get(layer);
    if (!c) {
      const cv = createCanvas();
      const cx = cv.getContext('2d');
      if (!cx) throw new Error('2D canvas context unavailable');
      c = { canvas: cv, ctx: cx };
      caches.set(layer, c);
    }
    if (c.canvas.width !== viewport.pixelW || c.canvas.height !== viewport.pixelH) {
      c.canvas.width = viewport.pixelW;
      c.canvas.height = viewport.pixelH;
    }
    return c;
  };

  const frameInfo = (dt: number): FrameInfo => ({ t, dt, now: opts.clock.now() });

  const rebuildCaches = (f: FrameInfo) => {
    for (const layer of CACHED_LAYERS) {
      if (!dirty.has(layer)) continue;
      const { ctx: cx } = ensureCache(layer);
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, viewport.pixelW, viewport.pixelH);
      drawLayer(cx, layer, f);
      dirty.delete(layer);
    }
  };

  const drawLayer = (cx: CanvasRenderingContext2D, layer: LayerId, f: FrameInfo) => {
    for (const e of entries) {
      const s = e.system;
      if (!e.ready || !s.draw) continue;
      cx.save();
      viewport.applyTo(cx);
      guard(s.id, `draw:${layer}`, () => s.draw!(layer, cx, f));
      cx.restore();
    }
  };

  const drawEntities = (cx: CanvasRenderingContext2D, f: FrameInfo) => {
    drawLayer(cx, 'entities', f);
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
      viewport.applyTo(cx);
      guard(id, 'draw:entity', () => d.draw(cx, f));
      cx.restore();
    }
  };

  const composite = (f: FrameInfo) => {
    rebuildCaches(f);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, viewport.pixelW, viewport.pixelH);
    for (const layer of LAYERS) {
      if (layer === 'background') {
        const c = caches.get('background');
        if (c) ctx.drawImage(c.canvas, 0, 0);
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
  };

  const frame = (dt: number) => {
    if (!sized) return;
    const f = frameInfo(dt);
    for (const e of entries) {
      if (e.ready && e.system.update) guard(e.system.id, 'update', () => e.system.update!(f));
    }
    composite(f);
  };

  const loop = (ts: number) => {
    rafId = null;
    if (!running || frozen || disposed) return;
    rafId = requestFrame(loop);
    const dt = lastTs === null ? 0 : Math.min(maxDt, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    t += dt;
    frame(dt);
  };

  const schedule = () => {
    if (running && !frozen && !disposed && rafId === null) {
      lastTs = null;
      rafId = requestFrame(loop);
    }
  };

  const resize = async (): Promise<void> => {
    if (disposed) return;
    const m = measure();
    viewport = createViewport(m.w, m.h, m.dpr, focus);
    if (canvas.width !== viewport.pixelW) canvas.width = viewport.pixelW;
    if (canvas.height !== viewport.pixelH) canvas.height = viewport.pixelH;
    sized = true;
    const gen = ++generation;
    // Systems keep drawing with their previous caches until their re-init completes.
    readyPromise = Promise.all(entries.map((e) => initEntry(e, gen))).then(() => {
      if (gen !== generation || disposed) return;
      for (const l of CACHED_LAYERS) dirty.add(l);
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
      return viewport;
    },
    get frozen() {
      return frozen;
    },
    get running() {
      return running;
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
      frame(0);
    },
    unfreeze() {
      frozen = false;
      schedule();
    },
    renderOnce() {
      frame(0);
    },
    resize,
    invalidate(layer) {
      if (layer) dirty.add(layer);
      else for (const l of CACHED_LAYERS) dirty.add(l);
    },
    dispose() {
      renderer.stop();
      disposed = true;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      for (const e of entries.splice(0)) guard(e.system.id, 'dispose', () => e.system.dispose?.());
      caches.clear();
    },
  };
  return renderer;
}
