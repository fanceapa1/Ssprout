/**
 * The landscape from the persistent paint cache (ADR 0228): the keys (everything the pixels
 * depend on), the sprite atlas, and the scene system's lookup (hit, miss, a slow store, a hit that
 * arrives while painting). The system paints on recording canvases (jsdom has no canvas).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AnyCanvas } from '../paint';
import { createNullPaintCache, type PaintCache } from '../paint/persist';
import { createManualClock } from '../core/clock';
import { createViewport } from '../render/viewport';
import type { SystemContext } from '../render/types';
import { GARDEN_ART, SCENE_CACHE, paintingKey, spriteAtlasLayout, spritesKey, type PaintView } from './background';
import { gardenScene } from './geometry';
import { PaintRecorder } from './paint-record';
import { rockBox, tuftBox } from './sprites';
import { createSceneSystem, paintViewFor } from './system';

const VIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 1.5 };

describe('scene cache keys (ADR 0228)', () => {
  it('names the seed, quality, world rect, exact scale and bitmap size', () => {
    expect(paintingKey(GARDEN_ART, VIEW, 'normal')).toBe('s7|normal|0,0,1600,1000@1.5|2400x1500');
    expect(paintingKey(GARDEN_ART, { rect: { x: 412, y: 0, w: 777, h: 1000 }, scale: 1.4123456789 }, 'draft')).toBe(
      's7|draft|412,0,777,1000@1.4123456789|1098x1413',
    );
  });

  it('changes with everything the pixels depend on', () => {
    const base = paintingKey(GARDEN_ART, VIEW, 'normal');
    const variants = [
      paintingKey({ ...GARDEN_ART, seed: 8 }, VIEW, 'normal'),
      paintingKey(GARDEN_ART, VIEW, 'high'),
      paintingKey(GARDEN_ART, { ...VIEW, rect: { ...VIEW.rect, x: 1 } }, 'normal'),
      paintingKey(GARDEN_ART, { ...VIEW, rect: { ...VIEW.rect, y: 1 } }, 'normal'),
      paintingKey(GARDEN_ART, { ...VIEW, rect: { ...VIEW.rect, w: 1599 } }, 'normal'),
      paintingKey(GARDEN_ART, { ...VIEW, rect: { ...VIEW.rect, h: 999 } }, 'normal'),
      // a scale a rounding would merge with 1.5 still paints other pixels
      paintingKey(GARDEN_ART, { ...VIEW, scale: 1.5000000001 }, 'normal'),
    ];
    expect(new Set([base, ...variants]).size).toBe(variants.length + 1);
  });

  it('is the same for the same view (a repeat visit at the same size and device pixel ratio)', () => {
    const a = paintViewFor(createViewport(1440, 900, 2), 1.5, 60);
    const b = paintViewFor(createViewport(1440, 900, 2), 1.5, 60);
    expect(paintingKey(GARDEN_ART, a, 'normal')).toBe(paintingKey(GARDEN_ART, b, 'normal'));
    // another device pixel ratio is another scale, so another painting
    const c = paintViewFor(createViewport(1440, 900, 1), 1.5, 60);
    expect(paintingKey(GARDEN_ART, c, 'normal')).not.toBe(paintingKey(GARDEN_ART, a, 'normal'));
  });

  it('keys the sprites by scale, seed and quality only, not by the painted rect', () => {
    expect(spritesKey(GARDEN_ART, 1.5, 'normal')).toBe('s7|normal@1.5');
    const keys = [spritesKey(GARDEN_ART, 1.5, 'normal'), spritesKey(GARDEN_ART, 2.8, 'normal'), spritesKey({ ...GARDEN_ART, seed: 8 }, 1.5, 'normal'), spritesKey(GARDEN_ART, 1.5, 'high')];
    expect(new Set(keys).size).toBe(4);
  });
});

describe('scene sprite atlas', () => {
  it('stacks every boulder and foreground tuft at its canvas size, in paint order', () => {
    const scale = 1.5;
    const layout = spriteAtlasLayout(GARDEN_ART, scale);
    const boxes = [...gardenScene.rocks.map(rockBox), ...GARDEN_ART.foregroundTufts.map(tuftBox)];
    expect(layout.slots.map((s) => s.id)).toEqual([...gardenScene.rocks.map((r) => r.id), ...GARDEN_ART.foregroundTufts.map((_, i) => `tuft-${i}`)]);
    let y = 0;
    for (const [i, s] of layout.slots.entries()) {
      expect(s.box).toEqual(boxes[i]);
      expect([s.w, s.h]).toEqual([Math.ceil(boxes[i]!.w * scale), Math.ceil(boxes[i]!.h * scale)]);
      expect(s.y).toBe(y);
      y += s.h;
    }
    expect(layout.height).toBe(y);
    expect(layout.width).toBe(Math.max(...layout.slots.map((s) => s.w)));
  });
});

// ---------------------------------------------------------------------------------------------
// The scene system's lookup

/** A paint cache in memory, whose `get` can be held back. */
function memoryCache() {
  const stored = new Map<string, AnyCanvas>();
  const puts: string[] = [];
  let hold: Promise<void> | null = null;
  const cache: PaintCache = {
    ...createNullPaintCache('dev'),
    async get(kind, key) {
      if (hold) await hold;
      const c = stored.get(`${kind}:${key}`);
      // a recording canvas stands in for the decoded bitmap
      return c ? (Object.assign(c, { close() {} }) as unknown as ImageBitmap) : null;
    },
    async put(kind, key, canvas) {
      puts.push(`${kind}:${key}`);
      stored.set(`${kind}:${key}`, canvas);
      return true;
    },
  };
  return {
    cache,
    stored,
    puts,
    holdGets(until: Promise<void>) {
      hold = until;
    },
  };
}

function context(): SystemContext {
  return {
    // 160×100 px: the whole world at 0.1 px per unit, cheap to paint
    viewport: createViewport(160, 100, 1),
    clock: createManualClock(Date.UTC(2026, 5, 1, 12)),
    scene: gardenScene,
    reducedMotion: true,
  } as unknown as SystemContext;
}

describe('scene system and the paint cache (ADR 0228)', () => {
  let uninstall: () => void = () => {};
  beforeEach(() => {
    uninstall = new PaintRecorder().install();
  });
  afterEach(() => uninstall());

  const view = paintViewFor(createViewport(160, 100, 1), 1.5, 60);
  const opts = { yieldTo: async () => {}, extendDelayMs: -1 };

  it('paints on a miss and stores the painting and the sprites', async () => {
    const mem = memoryCache();
    const scene = createSceneSystem({ ...opts, cache: mem.cache });
    await scene.init!(context());
    expect(scene.stats()).toMatchObject({ paints: 1, cacheHits: 0, cacheMisses: 1 });
    expect(mem.puts.sort()).toEqual([`${SCENE_CACHE.overview}:${paintingKey(GARDEN_ART, view, 'normal')}`, `${SCENE_CACHE.sprites}:${spritesKey(GARDEN_ART, view.scale, 'normal')}`].sort());
  });

  it('takes a stored painting without painting a step', async () => {
    const mem = memoryCache();
    await createSceneSystem({ ...opts, cache: mem.cache }).init!(context());
    const again = createSceneSystem({ ...opts, cache: mem.cache });
    await again.init!(context());
    expect(again.stats()).toMatchObject({ paints: 0, cacheHits: 1, cacheMisses: 0, timings: [], lastView: view });
    // nothing new was stored
    expect(mem.puts).toHaveLength(2);
  });

  it('paints anyway when the store does not answer in time', async () => {
    const mem = memoryCache();
    mem.holdGets(new Promise(() => {}));
    const scene = createSceneSystem({ ...opts, cache: mem.cache, cacheWaitMs: 5 });
    await scene.init!(context());
    expect(scene.stats()).toMatchObject({ paints: 1, cacheHits: 0, cacheMisses: 1 });
    expect(scene.stats().lastLookupMs).toBeGreaterThanOrEqual(4);
  });

  it('takes a hit that arrives while it paints, and stops painting', async () => {
    const mem = memoryCache();
    await createSceneSystem({ ...opts, cache: mem.cache }).init!(context());
    let release = () => {};
    mem.holdGets(new Promise<void>((done) => (release = done)));
    let yields = 0;
    let t = 0;
    const scene = createSceneSystem({
      ...opts,
      cache: mem.cache,
      cacheWaitMs: 1,
      // every part of a step seems to take 50 ms, so the job yields after each
      now: () => (t += 50),
      // the store answers once the paint job is under way
      yieldTo: async () => {
        if (++yields === 2) release();
        await new Promise((r) => setTimeout(r, 0));
      },
    });
    await scene.init!(context());
    expect(yields).toBeGreaterThanOrEqual(2);
    expect(scene.stats()).toMatchObject({ paints: 0, cacheHits: 1, cacheMisses: 0 });
  });
});
