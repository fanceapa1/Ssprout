import { describe, expect, it } from 'vitest';
import { createManualClock } from '../core/clock';
import { createEventBus } from '../core/events';
import type { StudyPlan } from '../core/plans';
import { createDefaultState, createStore, reducer, type GardenState, type PlantInstance } from '../core/state';
import type { FrameInfo, SystemContext } from '../render/types';
import { createViewport } from '../render/viewport';
import { createCamera } from '../render/camera';
import type { SceneGeometry, Slot } from '../scene/geometry';
import { plantWorldBounds } from './bounds';
import { dabAlpha } from './highlight';
import { spriteKey, type Sprite, type SpriteCache, type SpriteSpec } from './sprites';
import { APPEAR_SECONDS, createPlantSystem, DISPLACE_IN_SECONDS, DISPLACE_OUT_SECONDS, type PlantSystem } from './system';
import { FakeCanvas, installFakeOffscreenCanvas } from './test-canvas';
import type { SpeciesDef } from './types';
import { GARDEN_PLANT_SCALE } from '../scene/slots';
import { WATERING_SECONDS, WET_LINGER_SECONDS } from './watering';

const MIN = 60_000;

/** A small local geometry (an oval pond and a few slots), independent of the painted scene. */
const POND_WOBBLE = [1, 0.94, 1.05, 0.98, 0.9, 1.04, 1.08, 0.97, 1, 0.93, 1.02, 1.06, 0.95, 1, 1.03, 0.96];
const placeholderScene: SceneGeometry = {
  pond: POND_WOBBLE.map((k, i) => {
    const a = (i / POND_WOBBLE.length) * Math.PI * 2;
    return { x: 800 + Math.cos(a) * 300 * k, y: 560 + Math.sin(a) * 115 * k };
  }),
  waterline: 560,
  rocks: [],
  path: [],
  streams: [],
  falls: null,
  structure: { x: 1280, y: 260, w: 320, h: 380 },
  lights: [{ id: 'lantern', at: { x: 1260, y: 610 }, r: 78 }],
  eave: null,
  slots: [
    { id: 'water-1', x: 740, y: 560, habitat: 'water', maxSize: 'medium', scale: 0.9 },
    { id: 'meadow-1', x: 300, y: 780, habitat: 'meadow', maxSize: 'large', scale: 1.05 },
    { id: 'path-2', x: 900, y: 930, habitat: 'path', maxSize: 'small', scale: 1.15 },
    { id: 'back-1', x: 380, y: 420, habitat: 'back', maxSize: 'tree', scale: 0.6 },
  ],
  skyBand: { top: 40, bottom: 300 },
};

const species = (id: string, sizeClass: SpeciesDef['sizeClass'], w: number, h: number): SpeciesDef =>
  ({ id, name: id, tier: 1, habitats: ['meadow', 'shore', 'water', 'back', 'path', 'rock'], sizeClass, size: { w, h }, anchor: { x: 0.5, y: 0.95 }, description: '', bloomColor: '#fff', pollinators: false, draw() {} }) as SpeciesDef;

const DEFS = new Map([species('small', 'small', 70, 70), species('tree', 'tree', 380, 460)].map((d) => [d.id, d]));
const getSpecies = (id: string) => DEFS.get(id);

/** Every sprite is "painted" instantly; requests are recorded. */
function instantCache(): SpriteCache & { requested: SpriteSpec[]; images: Set<unknown> } {
  const store = new Map<string, Sprite>();
  const requested: SpriteSpec[] = [];
  const images = new Set<unknown>();
  const make = (s: SpriteSpec): Sprite => {
    const key = spriteKey(s);
    let sp = store.get(key);
    if (!sp) {
      // painted in the middle of the box: the ink (any paint, padded) is a little wider than the bounds
      const x0 = Math.floor(s.w * 0.18);
      const y0 = Math.floor(s.h * 0.28);
      const ink = { x: x0, y: y0, w: Math.ceil(s.w * 0.82) - x0, h: Math.ceil(s.h * 0.96) - y0 };
      const image = new FakeCanvas(s.w, s.h);
      images.add(image);
      store.set(key, (sp = { key, spec: s, image: image as unknown as CanvasImageSource, bytes: s.w * s.h * 4, bounds: { left: 0.2, top: 0.3, right: 0.8, bottom: 0.95, ink } }));
    }
    return sp;
  };
  return {
    requested,
    images,
    get: (s) => store.get(spriteKey(s)),
    best: (id, seed, step) => [...store.values()].find((s) => s.spec.speciesId === id && s.spec.seed === seed && s.spec.step === step),
    has: (s) => store.has(spriteKey(s)),
    request: (s) => {
      requested.push(s);
      make(s);
    },
    pending: () => false,
    whenReady: (s) => Promise.resolve(store.has(spriteKey(s))),
    ensureSync: (s) => make(s),
    beginFrame() {},
    whenIdle: () => Promise.resolve(),
    stats: () => ({ entries: store.size, bytes: 0, budget: 0, queued: 0, inFlight: 0, rendered: store.size, evicted: 0, workers: 0, failed: 0 }),
    setBudget() {},
    evictWhere: (pick) => {
      let n = 0;
      for (const [k, sp] of [...store]) if (pick(sp.spec)) (store.delete(k), n++);
      return n;
    },
    dropQueued() {},
    clear: () => store.clear(),
    dispose() {},
  };
}

const PLAN: StudyPlan = {
  id: 'pomodoro',
  name: 'Two pomodoros',
  blocks: [
    { kind: 'focus', minutes: 25 },
    { kind: 'break', minutes: 10 },
    { kind: 'focus', minutes: 25 },
  ],
};

const plant = (id: string, slotId: string, speciesId = 'small'): PlantInstance => ({
  id,
  speciesId,
  sceneryId: 'japanese-garden',
  slotId,
  seed: id.length * 97,
  plantedAt: 0,
  sessionMinutes: 25,
  taskName: id,
  completedAt: 1,
});

function setup(opts: { plants?: PlantInstance[]; scene?: SceneGeometry; reducedMotion?: boolean; cache?: ReturnType<typeof instantCache>; camera?: boolean } = {}) {
  const clock = createManualClock(1_000_000);
  const state: GardenState = { ...createDefaultState(clock.now()), plants: opts.plants ?? [] };
  const store = createStore(state, reducer);
  const bus = createEventBus();
  const scene = opts.scene ?? placeholderScene;
  const cache = opts.cache ?? instantCache();
  const system = createPlantSystem({ getSpecies, cache, wind: (t) => ({ sway: Math.sin(t), gust: 0 }) });
  const viewport = createViewport(1600, 1000, 1);
  const camera = opts.camera ? createCamera({ base: viewport }) : undefined;
  const ctx: SystemContext = { viewport, camera, store, bus, clock, scene, reducedMotion: !!opts.reducedMotion };
  let t = 0;
  const frame = (dt = 1 / 60): FrameInfo => {
    t += dt;
    const f = { t, dt, now: clock.now() };
    system.update!(f);
    return f;
  };
  const start = (slotId: string, speciesId = 'small') =>
    store.dispatch({ type: 'session/start', id: 'session-1', taskName: 'Task', goalMinutes: 60, plan: PLAN, speciesId, slotId, seed: 42, now: clock.now(), weather: 'sun' });
  return { clock, store, bus, scene, cache, system, ctx, camera, frame, start, run: (seconds: number) => {
    for (let s = 0; s < seconds; s += 0.1) frame(0.1);
  } };
}

const slot = (id: string): Slot => placeholderScene.slots.find((s) => s.id === id)!;

async function ready(env: ReturnType<typeof setup>): Promise<PlantSystem> {
  await env.system.init!(env.ctx);
  env.frame(0);
  return env.system;
}

describe('plant system', () => {
  it('contributes one drawable per finished plant, depth-sorted by its slot y', async () => {
    const env = setup({ plants: [plant('a', 'meadow-1'), plant('b', 'back-1', 'tree'), plant('c', 'path-2')] });
    const sys = await ready(env);
    const f = env.frame();
    const depths = sys.entities!(f).map((d) => d.depth).sort((x, y) => x - y);
    expect(depths).toEqual([slot('back-1').y, slot('meadow-1').y, slot('path-2').y].sort((x, y) => x - y));
    // finished plants only ever ask for the last growth step
    expect(new Set(env.cache.requested.map((r) => r.step))).toEqual(new Set([24]));
  });

  it('sizes sprites by species size × slot scale × viewport pixel scale', async () => {
    const env = setup({ plants: [plant('a', 'meadow-1')] });
    await ready(env);
    const r = env.cache.requested[0]!;
    expect(r.w).toBe(Math.round(70 * slot('meadow-1').scale * GARDEN_PLANT_SCALE * 1));
  });

  it('draws the growing plant at its slot, growing with focused time, cross-faded between steps', async () => {
    const env = setup();
    const sys = await ready(env);
    env.start('meadow-1');
    env.frame(0);
    expect(sys.debugState().growing).toMatchObject({ slotId: 'meadow-1', growth: 0, lo: 0 });
    env.clock.advance(10 * MIN);
    env.frame(0); // dt = 0 snaps the displayed growth (frozen frames are exact)
    const g = sys.debugState().growing!;
    expect(g.growth).toBeCloseTo(10 / 50, 6);
    expect(g.shown).toBeCloseTo(10 / 50, 6);
    expect(g.lo).toBe(4);
    expect(g.weight).toBeCloseTo(0.8, 6);
    // the next stages are painted ahead of time
    const steps = new Set(env.cache.requested.map((r) => r.step));
    for (const s of [4, 5, 6, 7]) expect(steps.has(s)).toBe(true);
    const ds = sys.entities!(env.frame());
    expect(ds.some((d) => d.depth === slot('meadow-1').y)).toBe(true);
  });

  it('eases the displayed growth after a jump instead of snapping (while animating)', async () => {
    const env = setup();
    const sys = await ready(env);
    env.start('meadow-1');
    env.frame(0);
    env.clock.advance(20 * MIN);
    env.frame(0.1);
    const g = sys.debugState().growing!;
    expect(g.shown).toBeGreaterThan(0);
    expect(g.shown).toBeLessThan(g.growth);
    env.run(5);
    expect(sys.debugState().growing!.shown).toBeCloseTo(g.growth, 3);
  });

  it('fades a displaced plant out at session start and back in on cancel', async () => {
    const env = setup({ plants: [plant('old', 'meadow-1')] });
    const sys = await ready(env);
    env.start('meadow-1');
    env.frame();
    expect(env.store.get().session?.displacedPlantId).toBe('old');
    env.run(DISPLACE_OUT_SECONDS / 2);
    const mid = sys.debugState().displaced!.alpha;
    expect(mid).toBeGreaterThan(0.05);
    expect(mid).toBeLessThan(0.95);
    env.run(DISPLACE_OUT_SECONDS);
    expect(sys.debugState().displaced!.alpha).toBe(0);
    env.store.dispatch({ type: 'session/cancel', now: env.clock.now() });
    env.run(DISPLACE_IN_SECONDS + 0.2);
    expect(sys.debugState().finished.find((p) => p.id === 'old')!.alpha).toBe(1);
  });

  it('withers the seedling on cancel for ~3 s, then removes it', async () => {
    const restore = installFakeOffscreenCanvas();
    try {
      const env = setup();
      const sys = await ready(env);
      env.start('meadow-1');
      env.clock.advance(10 * MIN);
      env.frame(0);
      env.store.dispatch({ type: 'session/cancel', now: env.clock.now() });
      env.frame();
      expect(sys.debugState().growing).toBeNull();
      expect(sys.debugState().withering).toHaveLength(1);
      expect(sys.entities!(env.frame()).length).toBe(1);
      env.run(1.5);
      expect(sys.debugState().withering[0]!.progress).toBeCloseTo(0.5, 1);
      env.run(1.7);
      expect(sys.debugState().withering).toHaveLength(0);
      expect(sys.entities!(env.frame())).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('plays the watering animation on session:water and keeps the soil damp afterwards', async () => {
    const env = setup();
    const sys = await ready(env);
    env.start('meadow-1');
    env.frame();
    expect(sys.debugState().watering).toBeNull();
    env.bus.emit('session:water', { blockIndex: 1, sessionId: 'session-1', auto: false });
    env.frame();
    env.run(1.25);
    const w = sys.debugState().watering!;
    expect(w.active).toBe(true);
    expect(w.progress).toBeCloseTo(0.5, 1);
    env.run(1.5);
    expect(sys.debugState().watering).toMatchObject({ active: false });
    expect(sys.debugState().watering!.wet).toBeGreaterThan(0.5);
    env.run(12);
    expect(sys.debugState().watering).toBeNull();
  });

  it('blooms the completed plant in place (growing → finished, no gap)', async () => {
    const env = setup();
    const sys = await ready(env);
    env.start('meadow-1');
    env.clock.advance(30 * MIN);
    env.frame(0);
    env.clock.advance(30 * MIN);
    env.store.dispatch({ type: 'session/complete', now: env.clock.now() });
    env.frame();
    const st = sys.debugState();
    expect(st.growing).toBeNull();
    expect(st.finished).toHaveLength(1);
    expect(st.finished[0]).toMatchObject({ id: 'session-1', slotId: 'meadow-1', blooming: true, alpha: 1 });
    expect(sys.entities!(env.frame())).toHaveLength(1);
  });

  it('reports world bounds for finished and growing plants', async () => {
    const env = setup({ plants: [plant('a', 'back-1', 'tree')] });
    const sys = await ready(env);
    expect(sys.plantBounds('a')).toEqual(plantWorldBounds(DEFS.get('tree')!, slot('back-1')));
    const b = sys.plantBounds('a')!;
    expect(b.w).toBeCloseTo(380 * slot('back-1').scale * GARDEN_PLANT_SCALE, 9);
    expect(b.y + b.h * 0.95).toBeCloseTo(slot('back-1').y, 9);
    env.start('meadow-1');
    env.frame();
    expect(sys.plantBounds('session-1')).toEqual(plantWorldBounds(DEFS.get('small')!, slot('meadow-1')));
    expect(sys.plantBounds('nope')).toBeNull();
  });

  it('marks shore and water plants as reflected, meadow plants not', async () => {
    const env = setup({ plants: [plant('w', 'water-1'), plant('m', 'meadow-1')] });
    const sys = await ready(env);
    expect(sys.debugState().reflections).toEqual(['w']);
  });

  it('draws the placement highlight and a ghost of the chosen species at the focused slot', async () => {
    const env = setup();
    const sys = await ready(env);
    let push: (h: Parameters<Parameters<Parameters<PlantSystem['connectPlacement']>[0]['subscribe']>[0]>[0]) => void = () => {};
    sys.connectPlacement({
      current: () => ({ active: false, speciesId: null, slots: [], focused: null, selected: null }),
      subscribe: (fn) => ((push = fn), () => {}),
    });
    expect(sys.debugState().highlight.active).toBe(false);
    push({ active: true, speciesId: 'small', slots: [{ id: 'meadow-1', x: 300, y: 780, occupied: false }], focused: 'meadow-1', selected: null });
    const st = sys.debugState();
    expect(st.highlight).toEqual({ active: true, slots: 1, ghost: 'small' });
    const ds = sys.entities!(env.frame());
    expect(ds.some((d) => d.depth > slot('meadow-1').y && d.depth < slot('meadow-1').y + 1)).toBe(true);
    expect(dabAlpha(0, 0, 'selected', false)).toBeGreaterThan(dabAlpha(0, 0, 'idle', false));
    expect(dabAlpha(1, 0, 'idle', true)).toBe(dabAlpha(2, 0, 'idle', true)); // reduced motion: still
  });

  it('finished plants sway with the wind, and hold still under reduced motion (SPEC §3, §10)', async () => {
    /** the geometry of two frames' draws (transforms and image placement), at different wind */
    const twoFrames = async (reducedMotion: boolean) => {
      const env = setup({ plants: [plant('a', 'meadow-1')], reducedMotion });
      const sys = await ready(env);
      const snap = (dt: number) => {
        const f = env.frame(dt);
        const c = new FakeCanvas(1600, 1000).ctx;
        for (const d of sys.entities!(f)) d.draw(c as unknown as CanvasRenderingContext2D, f);
        const geometry = c.calls
          .filter((k) => ['transform', 'setTransform', 'translate', 'scale', 'rotate', 'drawImage'].includes(k.name))
          .map((k) => [k.name, ...k.args.filter((a): a is number => typeof a === 'number').map((n) => Math.round(n * 1000) / 1000)]);
        expect(geometry.some((g) => g[0] === 'drawImage')).toBe(true);
        return JSON.stringify(geometry);
      };
      return [snap(0.4), snap(0.7)];
    };
    const [still1, still2] = await twoFrames(true);
    expect(still1).toBe(still2);
    const [sway1, sway2] = await twoFrames(false);
    expect(sway1).not.toBe(sway2);
  });

  it('ready() waits for a store change it has not seen, the sprites and the fade-in (plantsReady)', async () => {
    // a cache that paints only when told to, like the worker pool
    const inner = instantCache();
    const pending: SpriteSpec[] = [];
    let idle: Array<() => void> = [];
    const painted = new Set<string>();
    const cache: ReturnType<typeof instantCache> = {
      ...inner,
      get: (s) => (painted.has(spriteKey(s)) ? inner.get(s) : undefined),
      has: (s) => painted.has(spriteKey(s)),
      best: () => undefined,
      request: (s) => {
        if (!painted.has(spriteKey(s)) && !pending.some((p) => spriteKey(p) === spriteKey(s))) pending.push(s);
      },
      whenIdle: () => (pending.length ? new Promise<void>((r) => idle.push(r)) : Promise.resolve()),
    };
    const paintAll = () => {
      for (const s of pending.splice(0)) {
        inner.request(s, 0);
        painted.add(spriteKey(s));
      }
      for (const r of idle.splice(0)) r();
    };
    const env = setup({ cache });
    const sys = await ready(env);
    let resolved = false;
    // like `sprout.addPlants(2); await sprout.plantsReady()` with no frame in between
    env.store.dispatch({ type: 'state/replace', state: { ...env.store.get(), plants: [plant('a', 'meadow-1'), plant('b', 'path-2')] } });
    const done = sys.ready().then(() => (resolved = true));
    await Promise.resolve();
    expect(pending.length).toBeGreaterThan(0); // it asked for the new plants' sprites itself
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(false); // nothing painted yet
    paintAll();
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(false); // painted, but not yet shown (they fade in when first drawn)
    const target = new FakeCanvas(1600, 1000).ctx as unknown as CanvasRenderingContext2D;
    for (let t = 0; t <= APPEAR_SECONDS + 0.2; t += 0.1) {
      const f = env.frame(0.1);
      for (const d of sys.entities!(f)) d.draw(target, f);
    }
    env.frame(0.1);
    await done;
    expect(resolved).toBe(true);
    expect(sys.debugState().finished.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('ready() before the first init waits for it instead of resolving empty', async () => {
    const env = setup({ plants: [plant('a', 'meadow-1')] });
    let resolved = false;
    const done = env.system.ready().then(() => (resolved = true));
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(false);
    await env.system.init!(env.ctx);
    await done;
    expect(env.cache.requested.length).toBeGreaterThan(0);
  });

  it('stays within 2 ms a frame with 50 plants and a growing one (CPU side)', async () => {
    const slots: Slot[] = Array.from({ length: 51 }, (_, i) => ({ id: `s${i}`, x: 100 + (i % 10) * 140, y: 300 + Math.floor(i / 10) * 120, habitat: i % 7 === 0 ? 'shore' : 'meadow', maxSize: 'tree', scale: 0.6 + (i % 5) * 0.12 }));
    const scene = { ...placeholderScene, slots, pond: [{ x: 80, y: 900 }, { x: 1500, y: 900 }, { x: 1500, y: 990 }, { x: 80, y: 990 }] };
    const plants = slots.slice(0, 50).map((s, i) => plant(`p${i}`, s.id, i % 9 === 0 ? 'tree' : 'small'));
    const env = setup({ plants, scene });
    const sys = await ready(env);
    env.start('s50');
    const target = new FakeCanvas(1600, 1000).ctx as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < 30; i++) {
      const f = env.frame();
      sys.draw!('waterSurface', target, f);
      sys.draw!('entities', target, f);
      for (const d of sys.entities!(f)) d.draw(target, f);
      sys.draw!('air', target, f);
    }
    sys.resetPerf();
    // CPU time of this test process, not wall time: other processes on a loaded machine stretch
    // wall time several times over, but not the work done here (devlog 24)
    const cpu0 = process.cpuUsage();
    for (let i = 0; i < 120; i++) {
      const f = env.frame();
      sys.draw!('waterSurface', target, f);
      sys.draw!('entities', target, f);
      for (const d of sys.entities!(f)) d.draw(target, f);
      sys.draw!('air', target, f);
    }
    const cpu = process.cpuUsage(cpu0);
    env.frame();
    expect(sys.perf().frames).toBeGreaterThan(100);
    expect((cpu.user + cpu.system) / 1000 / 120).toBeLessThan(2);
  });

  it('composites a seedling’s cross-fade again only when its weight moves (not every frame)', async () => {
    const restore = installFakeOffscreenCanvas();
    try {
      const env = setup();
      const sys = await ready(env);
      env.start('meadow-1');
      env.clock.advance(10 * MIN); // growth 0.2: between steps 4 and 5 (weight 0.8)
      env.frame(0);
      const drawFrames = (n: number) => {
        for (let i = 0; i < n; i++) {
          const f = env.frame();
          const c = new FakeCanvas(1600, 1000).ctx as unknown as CanvasRenderingContext2D;
          for (const d of sys.entities!(f)) d.draw(c, f);
        }
      };
      sys.resetPerf();
      drawFrames(30);
      expect(sys.debugState().growing!.weight).toBeGreaterThan(0);
      expect(sys.debugState().growing!.weight).toBeLessThan(1);
      expect(sys.perf().fadeComposites).toBe(1);
      // half a focused second moves the weight by ~1/250 (a step is ~2 min of a 50-minute focus): kept
      env.clock.advance(500);
      drawFrames(30);
      expect(sys.perf().fadeComposites).toBe(1);
      // a minute moves it by half a step: composited again
      env.clock.advance(MIN);
      env.frame(0); // snap the displayed growth (it eases over ~1 s, composited as it moves)
      drawFrames(30);
      expect(sys.perf().fadeComposites).toBe(2);
    } finally {
      restore();
    }
  });
});

describe('several sessions in progress (ADRs 0150, 0155)', () => {
  /** a seedling in meadow-1 (session-1), then a second session in back-1 (session-2) after 10 min */
  async function two(opts: Parameters<typeof setup>[0] = {}) {
    const env = setup(opts);
    const sys = await ready(env);
    env.start('meadow-1');
    env.clock.advance(10 * MIN);
    env.store.dispatch({ type: 'session/start', id: 'session-2', taskName: 'Two', goalMinutes: 60, plan: PLAN, speciesId: 'small', slotId: 'back-1', seed: 7, now: env.clock.now(), weather: 'sun' });
    env.frame(0);
    return { env, sys };
  }

  it('draws each seedling at its slot and its own growth; the waiting one stands calm and does not grow', async () => {
    const { env, sys } = await two();
    const seedlings = () => Object.fromEntries(sys.debugState().seedlings.map((x) => [x.id, x]));
    expect(seedlings()['session-1']).toMatchObject({ slotId: 'meadow-1', active: false, calm: true });
    expect(seedlings()['session-1']!.growth).toBeCloseTo(10 / 50, 6);
    expect(seedlings()['session-2']).toMatchObject({ slotId: 'back-1', active: true, calm: false, growth: 0 });
    expect(sys.debugState().growing!.id).toBe('session-2');
    env.clock.advance(20 * MIN);
    env.frame(0);
    expect(seedlings()['session-1']!.shown).toBeCloseTo(10 / 50, 6);
    expect(seedlings()['session-2']!.shown).toBeCloseTo(20 / 50, 6);
    const depths = sys.entities!(env.frame()).map((d) => d.depth);
    expect(depths).toEqual(expect.arrayContaining([slot('meadow-1').y, slot('back-1').y]));
  });

  it('waters the seedling the event names (default: the active one), and only that one', async () => {
    const { env, sys } = await two();
    env.bus.emit('session:water', { blockIndex: 0, sessionId: 'session-1', auto: true });
    env.frame();
    env.run(0.5);
    expect(sys.debugState().watering).toMatchObject({ sessionId: 'session-1', active: true });
    env.run(WATERING_SECONDS + WET_LINGER_SECONDS + 1);
    env.bus.emit('session:water', { blockIndex: 0, sessionId: 'nobody', auto: true });
    env.frame();
    expect(sys.debugState().watering).toBeNull();
  });

  it('cancelling the waiting session withers only its seedling; the active one keeps growing', async () => {
    const restore = installFakeOffscreenCanvas();
    try {
      const { env, sys } = await two();
      env.store.dispatch({ type: 'session/cancel', id: 'session-1', now: env.clock.now() });
      env.frame();
      expect(sys.debugState().withering.map((w) => w.slotId)).toEqual(['meadow-1']);
      expect(sys.debugState().seedlings.map((x) => x.id)).toEqual(['session-2']);
      expect(sys.debugState().growing!.id).toBe('session-2');
    } finally {
      restore();
    }
  });

  it('a plant displaced by a waiting session stays aside', async () => {
    const { env, sys } = await two({ plants: [plant('old', 'meadow-1')] });
    env.run(DISPLACE_OUT_SECONDS + 0.5);
    expect(sys.debugState().finished.find((p) => p.id === 'old')!.alpha).toBe(0);
  });

  it('after a reload every seedling shows at its own growth at once', async () => {
    const env = setup();
    const a = { id: 'a', taskName: 'A', goalMs: 60 * MIN, plan: PLAN, speciesId: 'small', sceneryId: 'japanese-garden' as const, slotId: 'meadow-1', seed: 1, displacedPlantId: null, startedAt: env.clock.now() - 30 * MIN, pausedAt: env.clock.now() - 20 * MIN, pausedTotalMs: 0, skippedMs: 0, weather: 'sun' as const, waterings: [], focusWaterings: 0 };
    const b = { ...a, id: 'b', slotId: 'back-1', startedAt: env.clock.now() - 5 * MIN, pausedAt: null };
    env.store.dispatch({ type: 'state/replace', state: { ...env.store.get(), session: b, waiting: [a] } });
    const sys = await ready(env);
    const by = Object.fromEntries(sys.debugState().seedlings.map((x) => [x.id, x.shown]));
    expect(by.a).toBeCloseTo(10 / 50, 6);
    expect(by.b).toBeCloseTo(5 / 50, 6);
  });
});

describe('the camera (ADRs 0165, 0166)', () => {
  it('plants in the zoomed view get sprites at the zoomed resolution; the rest keep the overview resolution', async () => {
    const env = setup({ plants: [plant('near', 'meadow-1'), plant('far', 'path-2')], camera: true });
    await ready(env);
    const widthOf = (id: string) => Math.max(...env.cache.requested.filter((r) => r.seed === id.length * 97 && r.speciesId === 'small').map((r) => r.w));
    const before = widthOf('near');
    // frame the meadow plant closely (cut: no glide)
    env.camera!.focusRect(env.system.plantBounds('near')!, { animate: false });
    env.frame();
    const after = Math.max(...env.cache.requested.filter((r) => r.seed === 4 * 97).map((r) => r.w));
    expect(after).toBeGreaterThan(before * 1.8);
    // 'far' (seed 3 × 97) is out of the zoomed view: no larger sprite asked for it
    expect(Math.max(...env.cache.requested.filter((r) => r.seed === 3 * 97).map((r) => r.w))).toBe(widthOf('far'));
    expect(env.system.debugState().resolution).toBe(1);
  });

  it('drops high-resolution sprites of plants left behind once the camera rests at the overview', async () => {
    const env = setup({ plants: [plant('near', 'meadow-1')], camera: true });
    await ready(env);
    env.camera!.focusRect(env.system.plantBounds('near')!, { animate: false });
    env.frame();
    const big = env.cache.requested.filter((r) => r.seed === 4 * 97).reduce((a, r) => Math.max(a, r.w), 0);
    expect(env.cache.has({ speciesId: 'small', seed: 4 * 97, step: 24, w: big, h: big })).toBe(true);
    env.camera!.overview({ animate: false });
    env.frame();
    env.frame();
    expect(env.cache.has({ speciesId: 'small', seed: 4 * 97, step: 24, w: big, h: big })).toBe(false);
  });

  it('only plants in the camera view are drawn', async () => {
    const env = setup({ plants: [plant('near', 'meadow-1'), plant('far', 'path-2')], camera: true });
    const sys = await ready(env);
    expect(sys.entities!(env.frame()).length).toBe(2);
    env.camera!.focusRect(sys.plantBounds('near')!, { animate: false, maxZoom: 3 });
    expect(sys.entities!(env.frame()).length).toBe(1);
  });

  it('hit-tests the front-most plant, finished or growing', async () => {
    const env = setup({ plants: [plant('back', 'back-1', 'tree')] });
    const sys = await ready(env);
    env.start('meadow-1');
    env.frame();
    const tree = sys.plantBounds('back')!;
    const hitTree = sys.hitTest({ x: tree.x + tree.w / 2, y: tree.y + tree.h * 0.5 });
    expect(hitTree).toMatchObject({ id: 'back', kind: 'finished', speciesId: 'tree', slotId: 'back-1' });
    const seed = sys.plantBounds('session-1')!;
    expect(sys.hitTest({ x: seed.x + seed.w / 2, y: seed.y + seed.h * 0.6 })).toMatchObject({ id: 'session-1', kind: 'growing' });
    expect(sys.hitTest({ x: 1500, y: 60 })).toBeNull();
  });

  it('a close view blits only the painted part of each sprite (ADR 0207)', async () => {
    const env = setup({ plants: [plant('near', 'meadow-1'), plant('tree', 'back-1', 'tree')], camera: true });
    const sys = await ready(env);
    env.camera!.zoomTo(2.6, { x: 340, y: 600 }, { animate: false });
    const f = { ...env.frame(), view: env.camera!.view() };
    const c = new FakeCanvas(1600, 1000);
    const ctx = c.ctx;
    // device rows each blit can touch: its rect's rows, within the bend slice's clip band
    let fill = 0;
    let boxes = 0;
    const tf = () => (ctx.getTransform as () => DOMMatrix)();
    type Band = [number, number] | null;
    let rect: Band = null;
    let band: Band = null;
    const bands: Band[] = [];
    const wrap = (name: string, fn: (...a: number[]) => void) => {
      const orig = ctx[name] as (...a: unknown[]) => unknown;
      (ctx as Record<string, unknown>)[name] = (...a: unknown[]) => {
        fn(...(a as number[]));
        return orig(...a);
      };
    };
    wrap('save', () => bands.push(band));
    wrap('restore', () => (band = bands.pop() ?? null));
    wrap('rect', (_x, y, _w, h) => {
      const m = tf();
      rect = [m.d * y! + m.f, m.d * (y! + h!) + m.f];
    });
    wrap('clip', () => (band = rect));
    const orig = ctx.drawImage as (...a: unknown[]) => void;
    (ctx as Record<string, unknown>).drawImage = (...a: unknown[]) => {
      if (env.cache.images.has(a[0])) {
        const m = tf();
        const [, y, w, h] = (a.length === 9 ? a.slice(5) : a.slice(1)) as number[];
        const y0 = m.d * y! + m.f;
        const rows = Math.max(0, Math.min(y0 + m.d * h!, band ? band[1] : Infinity) - Math.max(y0, band ? band[0] : -Infinity));
        fill += rows * w! * Math.abs(m.a);
      }
      orig(...a);
    };
    const drawn = sys.entities!(f);
    expect(drawn.length).toBe(2);
    const c2d = ctx as unknown as CanvasRenderingContext2D;
    for (const d of drawn) {
      c2d.save();
      f.view.applyTo(c2d);
      d.draw(c2d, f);
      c2d.restore();
    }
    for (const id of ['near', 'tree']) {
      const b = sys.plantBounds(id)!;
      boxes += b.w * b.h * f.view.pixelScale ** 2;
    }
    // the ink is 64 % × 68 % (0.44) of each box, the whole box is 1: bare margins cost nothing
    expect(fill).toBeGreaterThan(0);
    expect(fill / boxes).toBeLessThan(0.5);
  });

  it('toDevice follows the camera', async () => {
    const env = setup({ camera: true });
    const sys = await ready(env);
    const r = { x: 800, y: 500, w: 10, h: 10 };
    const at1 = sys.toDevice(r)!;
    env.camera!.zoomTo(2, undefined, { animate: false });
    const at2 = sys.toDevice(r)!;
    expect(at2.w).toBeCloseTo(at1.w * 2);
  });
});

