import { describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../core/clock';
import { createEventBus } from '../core/events';
import { createDefaultState, createStore, reducer } from '../core/state';
import { gardenScene } from '../scene/geometry';
import { getScenery } from '../scenery/registry';
import { createRenderer, SCENERY_FADE_S, type RendererOptions } from './renderer';
import type { LayerId, System } from './types';

interface FakeCanvas {
  name: string;
  width: number;
  height: number;
  log: string[];
  getContext(): CanvasRenderingContext2D;
}

function fakeCanvas(name: string): FakeCanvas {
  const log: string[] = [];
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    setTransform: () => {},
    save: () => {},
    restore: () => {},
    clearRect: () => log.push('clear'),
    drawImage(src: FakeCanvas, ...args: number[]) {
      log.push(`drawImage:${src.name}:${(this as { globalCompositeOperation: string }).globalCompositeOperation}${args.length > 2 ? ':sub' : ''}`);
    },
  };
  const c: FakeCanvas = {
    name,
    width: 0,
    height: 0,
    log,
    getContext: () => ctx as unknown as CanvasRenderingContext2D,
  };
  return c;
}

function setup(over: Partial<RendererOptions> = {}) {
  const main = fakeCanvas('main');
  const offscreen: FakeCanvas[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const clock = createManualClock(1_000);
  const renderer = createRenderer({
    canvas: main as unknown as HTMLCanvasElement,
    store: createStore(createDefaultState(0), reducer),
    bus: createEventBus(),
    clock,
    scene: gardenScene,
    measure: () => ({ w: 800, h: 500, dpr: 2 }),
    createCanvas: () => {
      const c = fakeCanvas(`cache${offscreen.length}`);
      offscreen.push(c);
      return c as unknown as HTMLCanvasElement;
    },
    requestFrame: (cb) => {
      frames.set(nextId, cb);
      return nextId++;
    },
    cancelFrame: (id) => void frames.delete(id),
    ...over,
  });
  const tick = (ts: number) => {
    const [entry] = frames;
    if (!entry) return;
    frames.delete(entry[0]);
    entry[1](ts);
  };
  return { renderer, main, offscreen, frames, tick, clock };
}

function recorder(id: string, out: string[]): System {
  return {
    id,
    draw: (layer: LayerId) => out.push(`${id}:${layer}`),
  };
}

describe('renderer', () => {
  it('sizes the canvas from the viewport (dpr applied)', async () => {
    const { renderer, main } = setup();
    await renderer.resize();
    expect(main.width).toBe(1600);
    expect(main.height).toBe(1000);
    expect(renderer.viewport.scale).toBe(0.5);
  });

  it('draws layers back to front; caches background and paper', async () => {
    const out: string[] = [];
    const { renderer, main } = setup();
    await renderer.add(recorder('a', out));
    await renderer.resize(); // resize paints one frame when the loop isn't running
    expect(out).toEqual([
      'a:background',
      'a:paper',
      'a:underwater',
      'a:waterSurface',
      'a:entities',
      'a:air',
      'a:ambience',
      'a:lighting',
    ]);
    // cached layers are composited: background normally, paper with multiply, paper last
    expect(main.log).toEqual(['clear', 'drawImage:cache0:source-over', 'drawImage:cache1:multiply']);

    out.length = 0;
    renderer.renderOnce();
    expect(out).not.toContain('a:background');
    expect(out).not.toContain('a:paper');

    renderer.invalidate('background');
    out.length = 0;
    renderer.renderOnce();
    expect(out).toContain('a:background');
    expect(out).not.toContain('a:paper');
  });

  it('calls systems in registration order within a layer', async () => {
    const out: string[] = [];
    const { renderer } = setup();
    await renderer.add(recorder('first', out));
    await renderer.add(recorder('second', out));
    await renderer.resize();
    out.length = 0;
    renderer.renderOnce();
    expect(out.filter((s) => s.endsWith(':air'))).toEqual(['first:air', 'second:air']);
  });

  it('depth-sorts entities across systems (stable for ties)', async () => {
    const out: string[] = [];
    const mk = (id: string, depths: number[]): System => ({
      id,
      entities: () => depths.map((depth, i) => ({ depth, draw: () => out.push(`${id}${i}@${depth}`) })),
    });
    const { renderer } = setup();
    await renderer.add(mk('p', [700, 300, 500]));
    await renderer.add(mk('f', [500, 100]));
    await renderer.resize();
    out.length = 0;
    renderer.renderOnce();
    expect(out).toEqual(['f1@100', 'p1@300', 'p2@500', 'f0@500', 'p0@700']);
  });

  it('does not draw a system before its async init has resolved', async () => {
    const out: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: System = { ...recorder('slow', out), init: () => gate };
    const { renderer } = setup();
    void renderer.add(slow);
    void renderer.resize();
    renderer.renderOnce();
    expect(out).toEqual([]);
    release();
    await renderer.whenReady();
    out.length = 0;
    renderer.renderOnce();
    expect(out).toContain('slow:air');
  });

  it('re-initialises systems on resize with the new viewport', async () => {
    const scales: number[] = [];
    let size = { w: 800, h: 500, dpr: 1 };
    const { renderer } = setup({ measure: () => size });
    await renderer.add({ id: 's', init: (c) => void scales.push(c.viewport.scale) });
    await renderer.resize();
    size = { w: 1600, h: 1000, dpr: 1 };
    await renderer.resize();
    expect(scales).toEqual([0.5, 1]);
  });

  it('runs a frame loop with clamped dt; freeze stops time, unfreeze resumes', async () => {
    const seen: Array<{ t: number; dt: number; now: number }> = [];
    const { renderer, tick, clock, frames } = setup({ maxDt: 0.1 });
    await renderer.add({ id: 'u', update: (f) => void seen.push({ ...f }) });
    renderer.start();
    await renderer.whenReady();
    seen.length = 0;
    tick(1000); // first frame: dt 0
    tick(1016);
    clock.advance(5_000);
    tick(3000); // huge gap → clamped
    expect(seen.map((f) => f.dt)).toEqual([0, 0.016, 0.1]);
    expect(seen[2]?.t).toBeCloseTo(0.116);
    expect(seen[2]?.now).toBe(6_000);

    renderer.freeze();
    expect(renderer.frozen).toBe(true);
    const frozenT = seen.at(-1)?.t;
    expect(seen.at(-1)?.dt).toBe(0); // freeze renders one stable frame
    expect(frames.size).toBe(0);
    renderer.renderOnce();
    expect(seen.at(-1)?.t).toBe(frozenT);

    renderer.unfreeze();
    expect(frames.size).toBe(1);
    tick(9000);
    tick(9010);
    expect(seen.at(-1)?.t).toBeCloseTo((frozenT ?? 0) + 0.01);
    renderer.dispose();
  });

  describe('off-screen stage (ADR 0224)', () => {
    async function running() {
      const seen: Array<{ t: number; dt: number }> = [];
      const out: string[] = [];
      const env = setup({ maxDt: 0.1 });
      await env.renderer.add({ id: 'u', update: (f) => void seen.push({ t: f.t, dt: f.dt }), draw: (layer) => void out.push(layer) });
      env.renderer.start();
      await env.renderer.whenReady();
      env.tick(1000);
      env.tick(1016);
      seen.length = 0;
      out.length = 0;
      return { ...env, seen, out };
    }

    it('hidden: no frame is requested, updated or drawn', async () => {
      const { renderer, frames, tick, seen, out } = await running();
      expect(frames.size).toBe(1);
      renderer.setVisible(false);
      expect(renderer.visible).toBe(false);
      expect(frames.size).toBe(0);
      tick(1032); // nothing pending: no-op
      expect(seen).toEqual([]);
      expect(out).toEqual([]);
      // unfreezing or starting again while hidden does not restart the loop
      renderer.freeze();
      seen.length = 0;
      renderer.unfreeze();
      renderer.start();
      expect(frames.size).toBe(0);
      expect(renderer.frameStats().frames).toBeGreaterThan(0);
      renderer.resetFrameStats();
      expect(renderer.frameStats().frames).toBe(0);
      renderer.dispose();
    });

    it('visible again: the loop resumes from the last frame with a clamped dt (no jump)', async () => {
      const { renderer, frames, tick, seen, clock } = await running();
      renderer.setVisible(false);
      clock.advance(60_000);
      renderer.setVisible(true);
      expect(frames.size).toBe(1);
      tick(61_016); // a minute later: clamped to maxDt, not 0 (fades keep easing) and not 60 s
      tick(61_032);
      expect(seen.map((f) => f.dt)).toEqual([0.1, 0.016]);
      expect(seen[0]!.t).toBeCloseTo(0.016 + 0.1);
      renderer.setVisible(true); // already visible: no second loop
      expect(frames.size).toBe(1);
      renderer.dispose();
    });

    it('explicit frames still draw while hidden: renderOnce and freeze', async () => {
      const { renderer, frames, seen, out } = await running();
      renderer.setVisible(false);
      renderer.renderOnce();
      expect(seen.map((f) => f.dt)).toEqual([0]);
      expect(out).toContain('air');
      renderer.freeze();
      expect(seen).toHaveLength(2);
      expect(frames.size).toBe(0);
      // becoming visible while frozen keeps the still frame
      renderer.setVisible(true);
      expect(frames.size).toBe(0);
      renderer.unfreeze();
      expect(frames.size).toBe(1);
      renderer.dispose();
    });

    it('a resize while hidden draws nothing then; the first frame back repaints the caches', async () => {
      const { renderer, frames, tick, out, main } = await running();
      renderer.setVisible(false);
      await renderer.resize();
      expect(out).toEqual([]);
      renderer.setVisible(true);
      main.log.length = 0;
      tick(2000);
      expect(out).toContain('background');
      expect(out).toContain('paper');
      expect(main.log[0]).toBe('clear');
      expect(frames.size).toBe(1);
      renderer.dispose();
    });

    it('pauseWhenOffscreen follows an IntersectionObserver on the stage', async () => {
      const observers: Array<{ cb: IntersectionObserverCallback; target?: Element; margin?: string; off: boolean }> = [];
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          rec: (typeof observers)[number];
          constructor(cb: IntersectionObserverCallback, o?: IntersectionObserverInit) {
            this.rec = { cb, margin: o?.rootMargin, off: false };
            observers.push(this.rec);
          }
          observe(t: Element) {
            this.rec.target = t;
          }
          disconnect() {
            this.rec.off = true;
          }
        },
      );
      try {
        const { renderer, frames } = await running();
        const stage = {} as Element;
        const stopWatching = renderer.pauseWhenOffscreen(stage);
        const io = observers[0]!;
        expect(io.target).toBe(stage);
        expect(io.margin).toBe('160px 0px');
        const fire = (isIntersecting: boolean) => io.cb([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
        fire(false);
        expect(renderer.visible).toBe(false);
        expect(frames.size).toBe(0);
        fire(true);
        expect(renderer.visible).toBe(true);
        expect(frames.size).toBe(1);
        fire(false);
        stopWatching(); // no longer watched: drawn again
        expect(io.off).toBe(true);
        expect(renderer.visible).toBe(true);
        renderer.dispose();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it('isolates a failing system and reports it', async () => {
    const out: string[] = [];
    const onSystemError = vi.fn();
    const { renderer } = setup({ onSystemError });
    await renderer.add({
      id: 'bad',
      draw: () => {
        throw new Error('nope');
      },
    });
    await renderer.add(recorder('good', out));
    await renderer.resize();
    renderer.renderOnce();
    expect(out).toContain('good:air');
    expect(onSystemError).toHaveBeenCalledWith('bad', expect.stringMatching(/^draw:/), expect.any(Error));
  });

  it('rejects duplicate ids and disposes removed systems', async () => {
    const dispose = vi.fn();
    const { renderer } = setup();
    await renderer.add({ id: 'x', dispose });
    await expect(renderer.add({ id: 'x' })).rejects.toThrow(/already registered/);
    renderer.remove('x');
    expect(dispose).toHaveBeenCalled();
    expect(renderer.systems()).toHaveLength(0);
  });

  describe('camera', () => {
    function viewRecorder(out: Array<{ layer: LayerId; scale: number | undefined }>): System {
      return { id: 'v', draw: (layer, _ctx, f) => out.push({ layer, scale: f.view?.scale }) };
    }

    it('starts at the overview: the viewport is the base viewport', async () => {
      const { renderer } = setup();
      await renderer.resize();
      expect(renderer.viewport).toBe(renderer.baseViewport);
      expect(renderer.camera.isOverview()).toBe(true);
    });

    it('draws world layers through the camera view and gives systems the camera in their context', async () => {
      const out: Array<{ layer: LayerId; scale: number | undefined }> = [];
      let seen: unknown = null;
      const { renderer } = setup();
      await renderer.add({ ...viewRecorder(out), init: (c) => void (seen = c.camera) });
      await renderer.resize();
      expect(seen).toBe(renderer.camera);
      renderer.camera.zoomTo(2, undefined, { animate: false });
      out.length = 0;
      renderer.renderOnce();
      expect(renderer.viewport.scale).toBeCloseTo(1);
      expect(out.find((o) => o.layer === 'entities')?.scale).toBeCloseTo(1);
      // the init viewport stays the overview
      expect(renderer.baseViewport.scale).toBeCloseTo(0.5);
    });

    it('while the camera moves the background is the overview cache scaled up; at rest a cache at the view', async () => {
      const out: Array<{ layer: LayerId; scale: number | undefined }> = [];
      const { renderer, main, tick } = setup();
      await renderer.add(viewRecorder(out));
      await renderer.resize();
      renderer.start();
      tick(0);
      renderer.camera.zoomTo(2.5);
      main.log.length = 0;
      out.length = 0;
      tick(16);
      tick(32);
      // moving: no background repaint, a sub-rect blit of the overview cache
      expect(out.filter((o) => o.layer === 'background')).toEqual([]);
      expect(main.log).toContain('drawImage:cache0:source-over:sub');
      renderer.camera.settle();
      out.length = 0;
      main.log.length = 0;
      tick(48);
      const bg = out.filter((o) => o.layer === 'background');
      expect(bg).toHaveLength(1);
      expect(bg[0]!.scale).toBeCloseTo(1.25);
      expect(main.log.some((l) => l.endsWith(':sub'))).toBe(false);
      // a still frame reuses it
      out.length = 0;
      tick(64);
      expect(out.filter((o) => o.layer === 'background')).toEqual([]);
      // back at the overview: the overview cache again, no repaint needed
      renderer.camera.overview({ animate: false });
      out.length = 0;
      main.log.length = 0;
      tick(80);
      expect(out.filter((o) => o.layer === 'background')).toEqual([]);
      expect(main.log[1]).toBe('drawImage:cache0:source-over');
      renderer.stop();
    });

    it('the paper layer stays screen-fixed (drawn once at the overview)', async () => {
      const out: Array<{ layer: LayerId; scale: number | undefined }> = [];
      const { renderer } = setup();
      await renderer.add(viewRecorder(out));
      await renderer.resize();
      renderer.camera.zoomTo(3, undefined, { animate: false });
      renderer.camera.settle();
      out.length = 0;
      renderer.renderOnce();
      expect(out.some((o) => o.layer === 'paper')).toBe(false);
    });
  });
});

describe('renderer › switching the scenery (ADR 0243)', () => {
  const garden = getScenery('japanese-garden');
  const falls = getScenery('waterfall');
  const snapshotDraws = (log: string[]) => log.filter((l) => /^drawImage:cache\d+:source-over:sub$/.test(l));

  it('re-initialises every system with the new scenery, its geometry and focus, at the overview', async () => {
    const seen: string[] = [];
    const { renderer } = setup({ scenery: garden });
    await renderer.add({ id: 'a', init: (c) => void seen.push(`a:${c.scenery?.id}:${c.scene === c.scenery?.geometry}`) });
    await renderer.add({ id: 'b', init: (c) => void seen.push(`b:${c.scenery?.id}`) });
    await renderer.resize();
    renderer.camera.zoomTo(2, undefined, { animate: false });
    seen.length = 0;
    await renderer.setScenery(falls);
    expect(seen).toEqual(['a:waterfall:true', 'b:waterfall']);
    expect(renderer.scenery?.id).toBe('waterfall');
    expect(renderer.baseViewport.focus).toEqual(falls.view.focus);
    expect(renderer.camera.isOverview()).toBe(true);
    // the same scenery again changes nothing
    seen.length = 0;
    await renderer.setScenery(falls);
    expect(seen).toEqual([]);
  });

  it('keeps the last frame over the new garden until it is ready, then fades it out', async () => {
    let release!: () => void;
    let gated = false;
    const { renderer, tick, main } = setup({ scenery: garden });
    await renderer.add({ id: 'slow', init: () => (gated ? new Promise<void>((r) => (release = r)) : undefined) });
    renderer.start();
    await renderer.whenReady();
    tick(1000);
    gated = true;
    const ready = renderer.setScenery(falls);
    expect(renderer.sceneryFade()).toBe(1);
    main.log.length = 0;
    tick(1016);
    tick(1032);
    expect(snapshotDraws(main.log)).toHaveLength(2);
    expect(renderer.sceneryFade()).toBe(1); // not ready yet: no fade
    release();
    await ready;
    await Promise.resolve();
    tick(1100);
    const mid = renderer.sceneryFade();
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    for (let ts = 1200; ts <= 1100 + SCENERY_FADE_S * 1000 + 200; ts += 50) tick(ts);
    expect(renderer.sceneryFade()).toBe(0);
    main.log.length = 0;
    tick(3000);
    expect(snapshotDraws(main.log)).toHaveLength(0);
  });

  it('freezing ends a cross-fade under way', async () => {
    const { renderer, tick } = setup({ scenery: garden });
    await renderer.add({ id: 's', init: () => undefined });
    renderer.start();
    await renderer.whenReady();
    tick(1000);
    await renderer.setScenery(falls);
    await Promise.resolve();
    tick(1100);
    expect(renderer.sceneryFade()).toBeGreaterThan(0);
    renderer.freeze();
    expect(renderer.sceneryFade()).toBe(0);
  });

  it('cuts under reduced motion', async () => {
    const { renderer, tick } = setup({ scenery: garden, reducedMotion: true });
    await renderer.add({ id: 's', init: () => undefined });
    renderer.start();
    await renderer.whenReady();
    tick(1000);
    await renderer.setScenery(falls);
    await Promise.resolve();
    expect(renderer.sceneryFade()).toBe(0);
  });
});
