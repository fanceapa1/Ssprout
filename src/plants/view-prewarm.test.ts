import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { placeholderSprout } from '../dev/placeholder-sprout';
import { getSpecies } from './registry';
import { createSpriteCache, PRIORITY, renderSpriteSync, spriteKey, type IdleDeadlineLike, type SpriteBounds, type SpriteCache, type SpriteSpec, type WorkerLike, type WorkerReply, type WorkerRequest } from './sprites';
import { FakeCanvas, installFakeOffscreenCanvas } from './test-canvas';
import type { SpeciesDef } from './types';
import { drawPlantView, plantLayout, plantViewSprites, plantViewStats, prewarmPlantView, renderPlantView, setPlantViewCacheOptions, setPlantViewSpecies, whenPlantViewsReady } from './view';

/**
 * Preview prewarm (ADRs 0220, 0221): the view's sprite cache paints in a worker, a prewarm
 * queues exactly the sprites a later draw looks up, at idle priority behind the garden's sprites,
 * and `drawPlantView` never paints on the main thread. Workers are faked; one test runs the real
 * worker module in-process to check it paints what the main thread paints.
 */

let restore: () => void;
beforeAll(() => {
  restore = installFakeOffscreenCanvas();
});
afterAll(() => restore());
/** caches a test made: disposed after it, so a failed test cannot leave one busy (it would hold the next one's prewarms) */
const made: SpriteCache[] = [];
const track = (c: SpriteCache): SpriteCache => (made.push(c), c);
afterEach(() => {
  for (const c of made.splice(0)) c.dispose();
  setPlantViewCacheOptions(null);
  setPlantViewSpecies(null);
});

const flush = () => new Promise((r) => setTimeout(r, 0));

function manualIdle() {
  const queue: Array<(d: IdleDeadlineLike) => void> = [];
  return {
    schedule: (cb: (d: IdleDeadlineLike) => void) => void queue.push(cb),
    run(n = 1) {
      for (let i = 0; i < n; i++) queue.shift()?.({ timeRemaining: () => 0 });
    },
    get pending() {
      return queue.length;
    },
  };
}

/** A worker that records requests and answers when told to. */
function fakeWorker() {
  const posted: WorkerRequest[] = [];
  let onMessage: (e: { data: WorkerReply }) => void = () => {};
  const worker: WorkerLike = {
    postMessage: (m) => void posted.push(m as WorkerRequest),
    addEventListener: (type, fn) => {
      if (type === 'message') onMessage = fn as typeof onMessage;
    },
    terminate: () => {},
  };
  let created = 0;
  return {
    posted,
    factory: () => (created++, worker),
    get created() {
      return created;
    },
    done(req: WorkerRequest, bounds: SpriteBounds | null = { left: 0.2, top: 0.1, right: 0.8, bottom: 0.95 }) {
      onMessage({ data: { type: 'done', id: req.id, bitmap: new FakeCanvas(req.w, req.h) as unknown as ImageBitmap, bounds } });
    },
    unknown(req: WorkerRequest) {
      onMessage({ data: { type: 'error', id: req.id, reason: 'unknown' } });
    },
  };
}

const keyOf = (r: SpriteSpec) => spriteKey({ speciesId: r.speciesId, seed: r.seed, step: r.step, w: r.w, h: r.h });
const SP = placeholderSprout.id;
const useSprout = () => setPlantViewSpecies((id) => (id === SP ? placeholderSprout : undefined));
const target = (w = 120, h = 120) => new FakeCanvas(w, h);
const asCanvas = (c: FakeCanvas) => c as unknown as HTMLCanvasElement;

describe('sprite cache: readiness, lazy workers and the idle lane', () => {
  const def = { id: 'sp', size: { w: 10, h: 10 }, anchor: { x: 0.5, y: 0.9 } } as unknown as SpeciesDef;
  const get = (id: string) => (id === 'sp' ? def : undefined);
  const spec = (step: number, seed = 1): SpriteSpec => ({ speciesId: 'sp', seed, step, w: 10, h: 10 });

  it('whenReady resolves true when the sprite lands, false when it is dropped, fails or was never asked for', async () => {
    const w = fakeWorker();
    const idle = manualIdle();
    const cache = track(createSpriteCache({ getSpecies: get, createWorker: w.factory, workers: 1, scheduleIdle: idle.schedule, renderSync: () => null }));
    expect(await cache.whenReady(spec(1))).toBe(false); // never requested
    cache.request(spec(1), PRIORITY.now);
    cache.request(spec(2), PRIORITY.now);
    cache.request(spec(3), PRIORITY.now);
    expect(cache.pending(spec(1))).toBe(true);
    const one = cache.whenReady(spec(1));
    const two = cache.whenReady(spec(2));
    const three = cache.whenReady(spec(3));
    w.done(w.posted[0]!);
    expect(await one).toBe(true);
    expect(await cache.whenReady(spec(1))).toBe(true); // cached: at once
    cache.dropQueued((s) => s.step === 3);
    expect(await three).toBe(false);
    w.unknown(w.posted[1]!); // the worker cannot: the main thread tries, and fails
    idle.run();
    expect(await two).toBe(false);
    cache.dispose();
  });

  it('spawns its workers lazily, on the first queued sprite', () => {
    const w = fakeWorker();
    const cache = track(createSpriteCache({ getSpecies: get, createWorker: w.factory, workers: 1, lazyWorkers: true }));
    expect(w.created).toBe(0);
    cache.get(spec(1));
    expect(w.created).toBe(0);
    cache.request(spec(1), PRIORITY.idle);
    expect(w.created).toBe(1);
    expect(w.posted).toHaveLength(1);
    cache.dispose();
  });

  it('holds idle-priority work while another cache paints, and runs it once that one is quiet', () => {
    const garden = fakeWorker();
    const view = fakeWorker();
    const gardenCache = track(createSpriteCache({ getSpecies: get, createWorker: garden.factory, workers: 1 }));
    const viewCache = track(createSpriteCache({ getSpecies: get, createWorker: view.factory, workers: 1 }));
    gardenCache.request(spec(24, 1), PRIORITY.visible);
    gardenCache.request(spec(24, 2), PRIORITY.ahead);
    viewCache.request(spec(24, 9), PRIORITY.idle);
    expect(view.posted).toHaveLength(0); // the garden has sprites to paint
    garden.done(garden.posted[0]!);
    expect(view.posted).toHaveLength(0); // still one queued
    garden.done(garden.posted[1]!);
    expect(view.posted.map((r) => r.seed)).toEqual([9]);
    // a draw raising it to `now` does not wait for the garden
    gardenCache.request(spec(24, 3), PRIORITY.visible);
    viewCache.request(spec(12, 9), PRIORITY.idle);
    view.done(view.posted[0]!);
    expect(view.posted).toHaveLength(1);
    viewCache.request(spec(12, 9), PRIORITY.now);
    expect(view.posted.map((r) => r.step)).toEqual([24, 12]);
    gardenCache.dispose();
    viewCache.dispose();
  });

  it('wakes held work when the busy cache is disposed', () => {
    const garden = fakeWorker();
    const view = fakeWorker();
    const gardenCache = track(createSpriteCache({ getSpecies: get, createWorker: garden.factory, workers: 1 }));
    const viewCache = track(createSpriteCache({ getSpecies: get, createWorker: view.factory, workers: 1 }));
    gardenCache.request(spec(24, 1), PRIORITY.now);
    viewCache.request(spec(24, 9), PRIORITY.idle);
    expect(view.posted).toHaveLength(0);
    gardenCache.dispose();
    expect(view.posted).toHaveLength(1);
    viewCache.dispose();
  });
});

describe('plant view: prewarm and deferred draws', () => {
  it('prewarms exactly the sprites a draw looks up, and the draw waits for them instead of painting', async () => {
    useSprout();
    const w = fakeWorker();
    const painted: SpriteSpec[] = [];
    setPlantViewCacheOptions({ createWorker: w.factory, renderSync: (d, s) => (painted.push(s), renderSpriteSync(d, s)) });
    const c = target(120, 96);
    const opts = { speciesId: SP, seed: 7, growth: 1 };
    const ready = prewarmPlantView(c, opts);
    expect(w.posted.map(keyOf)).toEqual(plantViewSprites(c, opts).map(spriteKey));
    expect(w.posted).toHaveLength(1);

    const r = drawPlantView(asCanvas(c), { ...opts, watering: null });
    expect(r.state).toBe('pending');
    expect(c.ctx.calls).toHaveLength(0); // untouched
    expect(w.posted).toHaveLength(1); // no second request
    w.done(w.posted[0]!);
    expect(await ready).toBe(true);
    expect(r.state === 'pending' && (await r.ready)).toBe(true);
    expect(drawPlantView(asCanvas(c), { ...opts, watering: null }).state).toBe('drawn');
    expect(c.ctx.count('drawImage')).toBeGreaterThanOrEqual(2); // ground + plant
    expect(painted).toHaveLength(0);
    expect(plantViewStats()).toMatchObject({ syncPaints: 0, workers: 1, entries: 1 });
    await whenPlantViewsReady();
  });

  it('the sync renderer asks for the same sprites (lower step now, upper step queued)', () => {
    useSprout();
    const painted: string[] = [];
    const idle = manualIdle();
    setPlantViewCacheOptions({ createWorker: null, scheduleIdle: idle.schedule, renderSync: (d, s) => (painted.push(spriteKey(s)), renderSpriteSync(d, s)) });
    const c = target(150, 110);
    for (const [seed, growth] of [1, 0.5, 0.52, 0.03].entries()) {
      painted.length = 0;
      const opts = { speciesId: SP, seed, growth };
      expect(renderPlantView(asCanvas(c), { ...opts, watering: null })).toBe(true);
      idle.run(4); // the queued upper step (and one ahead) on the main thread
      const want = plantViewSprites(c, opts).map(spriteKey);
      expect(painted.slice(0, want.length)).toEqual(want);
    }
  });

  it('renderPlantView keeps drawing now, even while a prewarm of its sprite is in flight', () => {
    useSprout();
    const w = fakeWorker();
    setPlantViewCacheOptions({ createWorker: w.factory });
    const c = target();
    void prewarmPlantView(c, { speciesId: SP, seed: 1, growth: 1 });
    expect(renderPlantView(asCanvas(c), { speciesId: SP, seed: 1, growth: 1, watering: null })).toBe(true);
    expect(plantViewStats().syncPaints).toBe(1);
    expect(c.ctx.count('drawImage')).toBeGreaterThanOrEqual(2);
  });

  it('growth framing: the prewarm follows up with the zoomed sprite once the lower step lands', async () => {
    useSprout();
    const w = fakeWorker();
    setPlantViewCacheOptions({ createWorker: w.factory });
    const c = target(64, 64);
    const opts = { speciesId: SP, seed: 5, growth: 0.25, framing: 'growth' as const };
    const ready = prewarmPlantView(c, opts);
    expect(w.posted).toHaveLength(1);
    // a seedling: small content, so the view enlarges it
    w.done(w.posted[0]!, { left: 0.45, top: 0.8, right: 0.55, bottom: 0.92 });
    await flush();
    expect(w.posted).toHaveLength(2);
    expect(w.posted[1]!.w).toBeGreaterThan(w.posted[0]!.w);
    expect(w.posted[1]!.step).toBe(w.posted[0]!.step);
    w.done(w.posted[1]!, { left: 0.3, top: 0.2, right: 0.7, bottom: 0.92 });
    expect(await ready).toBe(true);
    expect(drawPlantView(asCanvas(c), { ...opts, watering: null }).state).toBe('drawn');
    expect(plantViewStats().syncPaints).toBe(0);
    // nothing asked for again, only the usual look-ahead to a later step
    expect(w.posted.slice(2).every((r) => r.step > w.posted[0]!.step)).toBe(true);
  });

  it('a deferred draw with nothing prewarmed queues its sprite now and resolves when it lands', async () => {
    useSprout();
    const w = fakeWorker();
    setPlantViewCacheOptions({ createWorker: w.factory });
    // keep a garden cache busy: the draw's own request is `now`, so it does not wait
    const garden = fakeWorker();
    const gardenCache = track(createSpriteCache({ getSpecies: () => placeholderSprout, createWorker: garden.factory, workers: 1 }));
    gardenCache.request({ speciesId: SP, seed: 1, step: 24, w: 10, h: 10 }, PRIORITY.visible);
    const c = target();
    const r = drawPlantView(asCanvas(c), { speciesId: SP, seed: 2, growth: 1, watering: null });
    expect(r.state).toBe('pending');
    expect(w.posted).toHaveLength(1);
    w.done(w.posted[0]!);
    expect(r.state === 'pending' && (await r.ready)).toBe(true);
    expect(drawPlantView(asCanvas(c), { speciesId: SP, seed: 2, growth: 1, watering: null }).state).toBe('drawn');
    gardenCache.dispose();
  });

  it('falls back to the main thread at idle time: without workers, or for species the worker does not know', async () => {
    useSprout();
    const idle = manualIdle();
    setPlantViewCacheOptions({ createWorker: null, scheduleIdle: idle.schedule });
    const c = target();
    const ready = prewarmPlantView(c, { speciesId: SP, seed: 4, growth: 1 });
    const r = drawPlantView(asCanvas(c), { speciesId: SP, seed: 4, growth: 1, watering: null });
    expect(r.state).toBe('pending');
    expect(idle.pending).toBe(1);
    idle.run();
    expect(await ready).toBe(true);
    expect(plantViewStats()).toMatchObject({ syncPaints: 0, workers: 0 });

    const w = fakeWorker();
    const idle2 = manualIdle();
    setPlantViewCacheOptions({ createWorker: w.factory, scheduleIdle: idle2.schedule });
    useSprout();
    const ready2 = prewarmPlantView(c, { speciesId: SP, seed: 4, growth: 1 });
    w.unknown(w.posted[0]!);
    idle2.run();
    expect(await ready2).toBe(true);
    expect(plantViewStats().syncPaints).toBe(0);
  });

  it('unknown species: the prewarm resolves false and the draw reports it', async () => {
    expect(await prewarmPlantView({ width: 80, height: 80 }, { speciesId: 'nope', seed: 1, growth: 1 })).toBe(false);
    expect(plantViewSprites({ width: 80, height: 80 }, { speciesId: 'nope', seed: 1, growth: 1 })).toEqual([]);
    expect(drawPlantView(asCanvas(target()), { speciesId: 'nope', seed: 1, growth: 1, watering: null }).state).toBe('unknown');
  });
});

/** Every recorded call, with images reduced to their size (identities differ across paths). */
function normalised(c: FakeCanvas): string[] {
  const arg = (a: unknown): string => {
    if (typeof a === 'number') return a.toFixed(5);
    if (typeof a === 'string' || typeof a === 'boolean') return String(a);
    if (a && typeof a === 'object' && 'width' in a && 'height' in a) return `img${String((a as { width: number }).width)}x${String((a as { height: number }).height)}`;
    return typeof a;
  };
  return c.ctx.calls.map((k) => `${k.name}(${k.args.map(arg).join(',')})`);
}

describe('plant view: the worker paints what the main thread paints', () => {
  /** The real `sprite-worker.ts`, run in this thread behind a WorkerLike; delivers on `flush`. */
  async function inProcessWorker(): Promise<{ factory: () => WorkerLike; flush: () => void; canvases: Map<string, FakeCanvas> }> {
    let workerSide: ((e: { data: WorkerRequest }) => void) | null = null;
    let mainSide: (e: { data: WorkerReply }) => void = () => {};
    const inbox: WorkerRequest[] = [];
    const canvases = new Map<string, FakeCanvas>();
    const g = globalThis as { self?: unknown };
    g.self = {
      addEventListener: (_t: string, fn: typeof workerSide) => (workerSide = fn),
      postMessage: (msg: WorkerReply) => mainSide({ data: msg }),
    };
    await import('./sprite-worker');
    delete g.self;
    // keep the painted canvas (with its recorded strokes) instead of an opaque bitmap
    vi.spyOn(FakeCanvas.prototype, 'transferToImageBitmap').mockImplementation(function (this: FakeCanvas) {
      return this;
    });
    const worker: WorkerLike = {
      postMessage: (m) => void inbox.push(m as WorkerRequest),
      addEventListener: (type, fn) => {
        if (type === 'message') mainSide = (e) => {
          const r = e.data;
          if (r.type === 'done') canvases.set(String(r.id), r.bitmap as unknown as FakeCanvas);
          (fn as (e: unknown) => void)(e);
        };
      },
      terminate: () => {},
    };
    return {
      factory: () => worker,
      flush: () => {
        while (inbox.length) workerSide?.({ data: inbox.shift()! });
      },
      canvases,
    };
  }

  it('a real species: identical strokes for the sprite and the composed view', async () => {
    const id = 'violet';
    expect(getSpecies(id)).toBeDefined();
    const opts = { speciesId: id, seed: 11, growth: 1, watering: null };
    // main thread, synchronously
    const sprites: FakeCanvas[] = [];
    setPlantViewCacheOptions({ createWorker: null, scheduleIdle: () => {}, renderSync: (d, s) => {
      const r = renderSpriteSync(d, s);
      if (r) sprites.push(r.image as unknown as FakeCanvas);
      return r;
    } });
    const a = target(96, 96);
    expect(renderPlantView(asCanvas(a), opts)).toBe(true);
    expect(sprites).toHaveLength(1);

    // the worker, prewarmed
    const w = await inProcessWorker();
    setPlantViewCacheOptions({ createWorker: w.factory });
    const b = target(96, 96);
    const ready = prewarmPlantView(b, opts);
    w.flush();
    expect(await ready).toBe(true);
    expect(drawPlantView(asCanvas(b), opts).state).toBe('drawn');
    expect(plantViewStats().syncPaints).toBe(0);
    const painted = [...w.canvases.values()];
    expect(painted).toHaveLength(1);

    const sa = normalised(sprites[0]!);
    expect(sa.length).toBeGreaterThan(20);
    expect(normalised(painted[0]!)).toEqual(sa);
    expect(normalised(b)).toEqual(normalised(a));
    const L = plantLayout(getSpecies(id)!, 96, 96);
    expect([painted[0]!.width, painted[0]!.height]).toEqual([L.w, L.h]);
    vi.restoreAllMocks();
  });
});
