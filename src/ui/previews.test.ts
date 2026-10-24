import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { placeholderSprout } from '../dev/placeholder-sprout';
import type { SpriteBounds, WorkerLike, WorkerReply, WorkerRequest } from '../plants/sprites';
import { FakeCanvas, installFakeOffscreenCanvas } from '../plants/test-canvas';
import type { SpeciesDef } from '../plants/types';
import { plantViewStats, setPlantViewCacheOptions, setPlantViewSpecies, whenPlantViewsReady } from '../plants/view';
import { createPreviewCache, fitSprite, pressPixels, previewPixels, previewSeed, type PreviewOptions } from './previews';

describe('previews', () => {
  it('fits tall sprites by height and wide sprites by width, base near the bottom', () => {
    const tall = fitSprite({ size: { w: 40, h: 100 }, anchor: { x: 0.5, y: 0.95 } }, 200, 200);
    expect(tall.sh).toBe(180);
    expect(tall.sw).toBe(72);
    expect(tall.x + tall.sw * 0.5).toBeCloseTo(100, 0);
    expect(tall.y + tall.sh * 0.95).toBeCloseTo(190, 0);
    const wide = fitSprite({ size: { w: 300, h: 100 }, anchor: { x: 0.5, y: 1 } }, 200, 200);
    expect(wide.sw).toBe(184);
    expect(wide.sh).toBe(61);
  });

  it('presses colour towards a faded sepia of the same lightness', () => {
    const px = new Uint8ClampedArray([200, 60, 120, 255, 255, 255, 255, 0]);
    pressPixels(px);
    // less saturated: channels closer together than before
    expect(Math.max(px[0]!, px[1]!, px[2]!) - Math.min(px[0]!, px[1]!, px[2]!)).toBeLessThan(140 * 0.7);
    expect(px[3]).toBeLessThan(255);
    expect(px[7]).toBe(0); // transparent stays transparent
  });

  it('sizes a preview in device pixels (dpr clamped 1..2) and turns a label into a stable seed', () => {
    expect(previewPixels({ w: 96, h: 92, dpr: 2 })).toEqual({ width: 192, height: 184 });
    expect(previewPixels({ w: 96, h: 92, dpr: 3 })).toEqual({ width: 192, height: 184 });
    expect(previewPixels({ w: 96, h: 92 })).toEqual({ width: 96, height: 92 });
    expect(previewSeed('preview:violet')).toBe(previewSeed('preview:violet'));
    expect(previewSeed(42)).toBe(42);
  });
});

/**
 * The non-blocking previews of the planting sheet (ADR 0222): a card is drawn only from sprites
 * the plant view's worker painted; nothing is painted on the main thread for it. The worker is
 * faked (it answers when told to), the species is the cheap unit-test sprout.
 */
describe('previews without painting on the main thread', () => {
  let restore: () => void;
  beforeAll(() => {
    restore = installFakeOffscreenCanvas();
  });
  afterAll(() => restore());
  afterEach(() => {
    setPlantViewCacheOptions(null);
    setPlantViewSpecies(null);
    vi.restoreAllMocks();
  });

  const SP = placeholderSprout.id;
  const OPTS: PreviewOptions = { w: 96, h: 92, dpr: 2, seed: `preview:${SP}` };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const canvas = () => new FakeCanvas(1, 1);
  const asCanvas = (c: FakeCanvas) => c as unknown as HTMLCanvasElement;
  const factory = (w: number, h: number) => asCanvas(new FakeCanvas(w, h));

  /** a worker that records requests and answers when told to */
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
    const bounds: SpriteBounds = { left: 0.2, top: 0.1, right: 0.8, bottom: 0.95 };
    return {
      posted,
      factory: () => worker,
      /** answer every request so far (and those they lead to) */
      async doneAll() {
        for (let i = 0; i < 20; i++) {
          const open = posted.splice(0);
          if (!open.length) return;
          for (const req of open) onMessage({ data: { type: 'done', id: req.id, bitmap: new FakeCanvas(req.w, req.h) as unknown as ImageBitmap, bounds } });
          await flush();
        }
      },
    };
  }

  /** the test sprout, with its draw spied on: any call is a main-thread paint */
  function setup() {
    const draw = vi.fn(placeholderSprout.draw);
    const def = { ...placeholderSprout, draw } as SpeciesDef;
    const get = (id: string) => (id === SP ? def : undefined);
    setPlantViewSpecies(get);
    const worker = fakeWorker();
    setPlantViewCacheOptions({ createWorker: worker.factory });
    return { draw, worker, previews: createPreviewCache(get, factory) };
  }

  it('a card with nothing painted yet stays blank, sized, and its sprite is queued in the worker', () => {
    const { draw, worker, previews } = setup();
    const target = canvas();
    expect(previews.paintReady(asCanvas(target), SP, OPTS)).toBe(false);
    expect([target.width, target.height]).toEqual([192, 184]);
    expect(target.ctx.count('drawImage')).toBe(0);
    expect(worker.posted.length).toBeGreaterThan(0);
    expect(draw).not.toHaveBeenCalled();
    expect(plantViewStats().syncPaints).toBe(0);
  });

  it('once the prewarm lands the card is drawn from the worker’s sprite, still without a main-thread paint', async () => {
    const { draw, worker, previews } = setup();
    const ready = previews.prewarm(SP, OPTS);
    await worker.doneAll();
    expect(await ready).toBe(true);
    const target = canvas();
    expect(previews.paintReady(asCanvas(target), SP, OPTS)).toBe(true);
    expect(target.ctx.count('drawImage')).toBe(1); // the composed preview, blitted
    expect(draw).not.toHaveBeenCalled();
    expect(plantViewStats().syncPaints).toBe(0);
    await whenPlantViewsReady();
  });

  it('whenReady hurries a card that was not prewarmed, and resolves once it can be drawn', async () => {
    const { draw, worker, previews } = setup();
    const target = canvas();
    expect(previews.paintReady(asCanvas(target), SP, OPTS)).toBe(false);
    const ready = previews.whenReady(SP, OPTS);
    expect(previews.whenReady(SP, OPTS)).toBe(ready); // one hurry per preview
    await worker.doneAll();
    expect(await ready).toBe(true);
    expect(previews.paintReady(asCanvas(target), SP, OPTS)).toBe(true);
    expect(draw).not.toHaveBeenCalled();
  });

  it('a species the plant view does not know is painted the old way, after the click', async () => {
    const draw = vi.fn(placeholderSprout.draw);
    const def = { ...placeholderSprout, id: 'only-ui', draw } as SpeciesDef;
    setPlantViewCacheOptions({ createWorker: fakeWorker().factory });
    const previews = createPreviewCache((id) => (id === 'only-ui' ? def : undefined), factory);
    const target = canvas();
    expect(previews.paintReady(asCanvas(target), 'only-ui', OPTS)).toBe(false);
    expect(draw).not.toHaveBeenCalled();
    expect(await previews.prewarm('only-ui', OPTS)).toBe(false);
    expect(previews.paintReady(asCanvas(target), 'only-ui', OPTS)).toBe(true);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('the waiting plot is a pale wash painted once per pixel size', () => {
    const { previews } = setup();
    const a = canvas();
    const b = canvas();
    expect(previews.paintPlot(asCanvas(a), OPTS)).toBe(true);
    expect(previews.paintPlot(asCanvas(b), OPTS)).toBe(true);
    expect([a.width, a.height]).toEqual([192, 184]);
    // each target gets one blit of the same cached plot
    const src = a.ctx.calls.find((c) => c.name === 'drawImage')!.args[0];
    expect(b.ctx.calls.find((c) => c.name === 'drawImage')!.args[0]).toBe(src);
    expect((src as FakeCanvas).ctx.calls.length).toBeGreaterThan(5); // the washes
  });
});
