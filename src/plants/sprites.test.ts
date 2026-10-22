import { describe, expect, it } from 'vitest';
import {
  contentBounds,
  createSpriteCache,
  crossFadeAlphas,
  GROWTH_STEPS,
  growthStep,
  MAX_SPRITE_RES,
  MAX_SPRITE_SIDE,
  PRIORITY,
  quantiseGrowth,
  resolutionBucket,
  significantScaleChange,
  spriteKey,
  SpriteLru,
  spritePixelSize,
  stagePair,
  stepGrowth,
  type IdleDeadlineLike,
  type Sprite,
  type SpriteSpec,
  type WorkerLike,
} from './sprites';
import type { SpeciesDef } from './types';

const def = { id: 'sp', size: { w: 100, h: 160 } } as unknown as SpeciesDef;
const spec = (step: number, w = 10, h = 10, seed = 1): SpriteSpec => ({ speciesId: 'sp', seed, step, w, h });
const sprite = (s: SpriteSpec): Sprite => ({ key: spriteKey(s), spec: s, image: {} as CanvasImageSource, bytes: s.w * s.h * 4, bounds: null });

describe('growth quantisation', () => {
  it('has 24 steps and snaps to the nearest', () => {
    expect(GROWTH_STEPS).toBe(24);
    expect(growthStep(0)).toBe(0);
    expect(growthStep(1)).toBe(24);
    expect(growthStep(0.5)).toBe(12);
    expect(growthStep(0.5 + 0.4 / 24)).toBe(12);
    expect(growthStep(0.5 + 0.6 / 24)).toBe(13);
    expect(growthStep(-1)).toBe(0);
    expect(growthStep(7)).toBe(24);
    expect(growthStep(Number.NaN)).toBe(0);
    expect(quantiseGrowth(0.51)).toBe(stepGrowth(12));
  });

  it('pairs the two nearest steps with a cross-fade weight', () => {
    expect(stagePair(0)).toEqual({ lo: 0, hi: 1, weight: 0 });
    expect(stagePair(1)).toEqual({ lo: 24, hi: 24, weight: 0 });
    const p = stagePair(10.25 / 24);
    expect(p.lo).toBe(10);
    expect(p.hi).toBe(11);
    expect(p.weight).toBeCloseTo(0.25, 9);
    // exactly on a step: only that step
    expect(stagePair(12 / 24)).toEqual({ lo: 12, hi: 13, weight: 0 });
  });

  it('is continuous: lo + weight reconstructs growth everywhere', () => {
    for (let g = 0; g <= 1; g += 0.0137) {
      const p = stagePair(g);
      expect((p.lo + p.weight) / 24).toBeCloseTo(g, 9);
    }
  });

  it('cross-fade alphas sum to one (an exact lerp under lighter)', () => {
    for (const w of [0, 0.2, 0.5, 0.99, 1]) {
      const a = crossFadeAlphas(w);
      expect(a.lo + a.hi).toBeCloseTo(1, 12);
      expect(a.hi).toBeCloseTo(w, 12);
    }
    expect(crossFadeAlphas(2)).toEqual({ lo: 0, hi: 1 });
  });
});

describe('sprite sizing', () => {
  it('buckets the resolution so small resizes reuse sprites', () => {
    expect(resolutionBucket(1)).toBe(1);
    expect(resolutionBucket(2)).toBe(2);
    expect(resolutionBucket(1.05)).toBe(1);
    expect(significantScaleChange(1.8, 1.82)).toBe(false);
    expect(significantScaleChange(0.9, 1.8)).toBe(true);
    expect(resolutionBucket(10)).toBe(MAX_SPRITE_RES);
    expect(resolutionBucket(0)).toBe(1);
  });

  it('is species size × slot scale × resolution', () => {
    expect(spritePixelSize(def.size, 0.5, 2)).toEqual({ w: 100, h: 160 });
    expect(spritePixelSize(def.size, 1.2, 1.5)).toEqual({ w: 180, h: 288 });
    expect(spritePixelSize({ w: 0.1, h: 0.1 }, 0.1, 0.25)).toEqual({ w: 1, h: 1 });
  });

  it('follows the zoomed scale up to the closest camera view, then caps the long side of a sprite', () => {
    // 3× zoom at DPR 2 on a desktop stage ≈ 5.4 device px per world unit
    expect(resolutionBucket(5.4)).toBeGreaterThan(4.5);
    expect(MAX_SPRITE_RES).toBeGreaterThanOrEqual(5.4);
    // a tree at full zoom would be ~3500 px tall: shrunk to the cap, aspect kept
    const tree = spritePixelSize({ w: 380, h: 460 }, 1.44, 5.6);
    expect(Math.max(tree.w, tree.h)).toBe(MAX_SPRITE_SIDE);
    expect(tree.w / tree.h).toBeCloseTo(380 / 460, 2);
  });

  it('keys by species, seed, step and pixel size', () => {
    const k = spriteKey(spec(3, 20, 30, 7));
    expect(k).toBe('sp|7|3|20x30');
    expect(spriteKey(spec(3, 20, 30, 8))).not.toBe(k);
    expect(spriteKey(spec(4, 20, 30, 7))).not.toBe(k);
    expect(spriteKey(spec(3, 21, 30, 7))).not.toBe(k);
  });

  it('finds painted content bounds as fractions', () => {
    const w = 10;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    const set = (x: number, y: number) => (data[(y * w + x) * 4 + 3] = 200);
    set(2, 3);
    set(6, 7);
    expect(contentBounds(data, w, h)).toEqual({ left: 0.2, top: 3 / 8, right: 0.7, bottom: 1 });
    expect(contentBounds(new Uint8ClampedArray(w * h * 4), w, h)).toBeNull();
  });
});

describe('SpriteLru', () => {
  it('evicts least recently used entries beyond the byte budget', () => {
    const evicted: string[] = [];
    const lru = new SpriteLru(1000, (s) => evicted.push(s.key));
    lru.epoch = 1;
    lru.set(sprite(spec(1)));
    lru.set(sprite(spec(2)));
    lru.epoch = 2;
    lru.get(spriteKey(spec(1))); // touch 1 → 2 is the oldest
    lru.epoch = 3;
    lru.set(sprite(spec(3)));
    expect(lru.bytes).toBeLessThanOrEqual(1000);
    expect(evicted).toEqual([spriteKey(spec(2))]);
    expect(lru.has(spriteKey(spec(1)))).toBe(true);
    expect(lru.evicted).toBe(1);
  });

  it('never evicts what was used in the current frame (it may overshoot instead)', () => {
    const lru = new SpriteLru(500);
    lru.set(sprite(spec(1)));
    lru.set(sprite(spec(2)));
    expect(lru.size).toBe(2);
    lru.epoch++;
    lru.trim();
    expect(lru.size).toBe(1);
  });

  it('finds the closest resolution of an instance step', () => {
    const lru = new SpriteLru(1e9);
    lru.set(sprite(spec(5, 40, 40)));
    lru.set(sprite(spec(5, 100, 100)));
    lru.set(sprite(spec(6, 90, 90)));
    expect(lru.best('sp', 1, 5, 90)?.spec.w).toBe(100);
    expect(lru.best('sp', 1, 5, 45)?.spec.w).toBe(40);
    expect(lru.best('sp', 2, 5, 45)).toBeUndefined();
    lru.remove(spriteKey(spec(5, 40, 40)));
    expect(lru.best('sp', 1, 5, 45)?.spec.w).toBe(100);
  });

  it('evicts what a predicate picks (far-off high-resolution sprites), but not what this frame used', () => {
    const lru = new SpriteLru(1e9);
    lru.set(sprite(spec(5, 40, 40)));
    lru.set(sprite(spec(5, 400, 400)));
    lru.set(sprite(spec(6, 400, 400)));
    lru.epoch++;
    lru.get(spriteKey(spec(6, 400, 400)));
    expect(lru.evictWhere((s) => s.w > 100)).toBe(1);
    expect(lru.has(spriteKey(spec(5, 400, 400)))).toBe(false);
    expect(lru.has(spriteKey(spec(6, 400, 400)))).toBe(true);
    expect(lru.has(spriteKey(spec(5, 40, 40)))).toBe(true);
  });
});

/** idle scheduler driven by the test */
function manualIdle() {
  const queue: Array<(d: IdleDeadlineLike) => void> = [];
  return {
    schedule: (cb: (d: IdleDeadlineLike) => void) => queue.push(cb),
    run(n = 1) {
      for (let i = 0; i < n; i++) queue.shift()?.({ timeRemaining: () => 0 });
    },
    get pending() {
      return queue.length;
    },
  };
}

describe('sprite cache scheduling', () => {
  const getSpecies = (id: string) => (id === 'sp' ? def : undefined);

  it('paints on idle callbacks, one sprite at a time, most urgent first', async () => {
    const idle = manualIdle();
    const painted: number[] = [];
    const cache = createSpriteCache({
      getSpecies,
      createWorker: null,
      scheduleIdle: idle.schedule,
      renderSync: (_d, s) => (painted.push(s.step), { image: {} as CanvasImageSource, bounds: null }),
    });
    cache.request(spec(20), PRIORITY.ahead);
    cache.request(spec(3), PRIORITY.now);
    cache.request(spec(4), PRIORITY.next);
    cache.request(spec(3), PRIORITY.now); // duplicate: ignored
    expect(painted).toEqual([]);
    const idleP = cache.whenIdle();
    idle.run();
    expect(painted).toEqual([3]);
    idle.run();
    idle.run();
    expect(painted).toEqual([3, 4, 20]);
    await idleP;
    expect(cache.get(spec(4))).toBeDefined();
    expect(cache.stats()).toMatchObject({ entries: 3, queued: 0, rendered: 3 });
    // already cached: no new work
    cache.request(spec(4), PRIORITY.now);
    expect(idle.pending).toBe(0);
  });

  it('raises the priority of a queued request', () => {
    const idle = manualIdle();
    const painted: number[] = [];
    const cache = createSpriteCache({
      getSpecies,
      createWorker: null,
      scheduleIdle: idle.schedule,
      renderSync: (_d, s) => (painted.push(s.step), { image: {} as CanvasImageSource, bounds: null }),
    });
    cache.request(spec(1), PRIORITY.ahead);
    cache.request(spec(2), PRIORITY.visible);
    cache.request(spec(1), PRIORITY.now);
    idle.run();
    expect(painted).toEqual([1]);
  });

  it('ignores unknown species and remembers failures', () => {
    const idle = manualIdle();
    let calls = 0;
    const cache = createSpriteCache({ getSpecies, createWorker: null, scheduleIdle: idle.schedule, renderSync: () => (calls++, null) });
    cache.request({ ...spec(1), speciesId: 'nope' }, 0);
    expect(cache.stats().queued).toBe(0);
    cache.request(spec(1), 0);
    idle.run();
    cache.request(spec(1), 0);
    idle.run();
    expect(calls).toBe(1);
    expect(cache.stats().failed).toBe(1);
  });

  it('paints synchronously when asked (the plant view)', () => {
    const cache = createSpriteCache({ getSpecies, createWorker: null, scheduleIdle: () => {}, renderSync: () => ({ image: {} as CanvasImageSource, bounds: null }) });
    expect(cache.ensureSync(spec(9))).toBeDefined();
    expect(cache.has(spec(9))).toBe(true);
  });

  it('sends work to workers and falls back to the main thread for species they do not know', async () => {
    const posted: Array<{ id: number; step: number }> = [];
    const listeners: Record<string, (e: unknown) => void> = {};
    const worker: WorkerLike = {
      postMessage: (m) => posted.push(m as { id: number; step: number }),
      addEventListener: (type, fn) => (listeners[type] = fn as (e: unknown) => void),
      terminate: () => {},
    };
    const idle = manualIdle();
    const mainPainted: number[] = [];
    const cache = createSpriteCache({
      getSpecies,
      createWorker: () => worker,
      workers: 1,
      scheduleIdle: idle.schedule,
      renderSync: (_d, s) => (mainPainted.push(s.step), { image: {} as CanvasImageSource, bounds: null }),
    });
    cache.request(spec(1), 0);
    cache.request(spec(2), 1);
    expect(posted.map((p) => p.step)).toEqual([1]); // one in flight per worker
    const bitmap = { close() {} } as unknown as ImageBitmap;
    listeners.message!({ data: { type: 'done', id: posted[0]!.id, bitmap, bounds: { left: 0, top: 0.5, right: 1, bottom: 1 } } });
    expect(cache.get(spec(1))?.bounds?.top).toBe(0.5);
    expect(posted.map((p) => p.step)).toEqual([1, 2]);
    listeners.message!({ data: { type: 'error', id: posted[1]!.id, reason: 'unknown' } });
    expect(cache.has(spec(2))).toBe(false);
    idle.run();
    expect(mainPainted).toEqual([2]);
    await cache.whenIdle();
    expect(cache.stats()).toMatchObject({ entries: 2, workers: 1 });
  });

  it('requeues in-flight work when a worker dies', () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    let terminated = false;
    const worker: WorkerLike = {
      postMessage: () => {},
      addEventListener: (type, fn) => (listeners[type] = fn as (e: unknown) => void),
      terminate: () => (terminated = true),
    };
    const idle = manualIdle();
    const mainPainted: number[] = [];
    const cache = createSpriteCache({
      getSpecies,
      createWorker: () => worker,
      workers: 1,
      scheduleIdle: idle.schedule,
      renderSync: (_d, s) => (mainPainted.push(s.step), { image: {} as CanvasImageSource, bounds: null }),
    });
    cache.request(spec(5), 0);
    listeners.error!(new Event('error'));
    expect(terminated).toBe(true);
    expect(cache.stats().workers).toBe(0);
    idle.run();
    expect(mainPainted).toEqual([5]);
  });

  it('respects the memory budget across many plants', () => {
    const idle = manualIdle();
    const cache = createSpriteCache({
      getSpecies,
      createWorker: null,
      budgetBytes: 100 * 100 * 4 * 10,
      scheduleIdle: idle.schedule,
      renderSync: () => ({ image: {} as CanvasImageSource, bounds: null }),
    });
    for (let seed = 0; seed < 30; seed++) {
      cache.beginFrame();
      cache.request(spec(24, 100, 100, seed), 0);
      idle.run();
    }
    expect(cache.stats().entries).toBeLessThanOrEqual(10);
    expect(cache.stats().bytes).toBeLessThanOrEqual(100 * 100 * 4 * 10);
    expect(cache.stats().evicted).toBeGreaterThanOrEqual(20);
  });
});
