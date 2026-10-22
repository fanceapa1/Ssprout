import { describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../core/clock';
import { createEventBus } from '../core/events';
import { createDefaultState, createStore, reducer } from '../core/state';
import { gardenScene } from '../scene/geometry';
import { createRenderer, type RendererOptions } from './renderer';
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
