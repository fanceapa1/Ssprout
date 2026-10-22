import { describe, expect, it } from 'vitest';
import { createManualClock } from '../core/clock';
import { createEventBus } from '../core/events';
import type { StudyPlan } from '../core/plans';
import { createDefaultState, createStore, reducer, type GardenState, type PlantInstance } from '../core/state';
import type { FrameInfo, SystemContext } from '../render/types';
import { createViewport } from '../render/viewport';
import type { SceneGeometry, Slot } from '../scene/geometry';
import { plantWorldBounds } from './bounds';
import { dabAlpha } from './highlight';
import { spriteKey, type Sprite, type SpriteCache, type SpriteSpec } from './sprites';
import { createPlantSystem, DISPLACE_IN_SECONDS, DISPLACE_OUT_SECONDS, type PlantSystem } from './system';
import { FakeCanvas, installFakeOffscreenCanvas } from './test-canvas';
import type { SpeciesDef } from './types';

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
  pavilion: { x: 1280, y: 260, w: 320, h: 380, lantern: { x: 1260, y: 610 } },
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
function instantCache(): SpriteCache & { requested: SpriteSpec[] } {
  const store = new Map<string, Sprite>();
  const requested: SpriteSpec[] = [];
  const make = (s: SpriteSpec): Sprite => {
    const key = spriteKey(s);
    let sp = store.get(key);
    if (!sp) store.set(key, (sp = { key, spec: s, image: new FakeCanvas(s.w, s.h) as unknown as CanvasImageSource, bytes: s.w * s.h * 4, bounds: { left: 0.2, top: 0.3, right: 0.8, bottom: 0.95 } }));
    return sp;
  };
  return {
    requested,
    get: (s) => store.get(spriteKey(s)),
    best: (id, seed, step) => [...store.values()].find((s) => s.spec.speciesId === id && s.spec.seed === seed && s.spec.step === step),
    has: (s) => store.has(spriteKey(s)),
    request: (s) => {
      requested.push(s);
      make(s);
    },
    ensureSync: (s) => make(s),
    beginFrame() {},
    whenIdle: () => Promise.resolve(),
    stats: () => ({ entries: store.size, bytes: 0, budget: 0, queued: 0, inFlight: 0, rendered: store.size, evicted: 0, workers: 0, failed: 0 }),
    setBudget() {},
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
  slotId,
  seed: id.length * 97,
  plantedAt: 0,
  sessionMinutes: 25,
  taskName: id,
  completedAt: 1,
});

function setup(opts: { plants?: PlantInstance[]; scene?: SceneGeometry; reducedMotion?: boolean } = {}) {
  const clock = createManualClock(1_000_000);
  const state: GardenState = { ...createDefaultState(clock.now()), plants: opts.plants ?? [] };
  const store = createStore(state, reducer);
  const bus = createEventBus();
  const scene = opts.scene ?? placeholderScene;
  const cache = instantCache();
  const system = createPlantSystem({ getSpecies, cache, wind: (t) => ({ sway: Math.sin(t), gust: 0 }) });
  const ctx: SystemContext = { viewport: createViewport(1600, 1000, 1), store, bus, clock, scene, reducedMotion: !!opts.reducedMotion };
  let t = 0;
  const frame = (dt = 1 / 60): FrameInfo => {
    t += dt;
    const f = { t, dt, now: clock.now() };
    system.update!(f);
    return f;
  };
  const start = (slotId: string, speciesId = 'small') =>
    store.dispatch({ type: 'session/start', id: 'session-1', taskName: 'Task', goalMinutes: 60, plan: PLAN, speciesId, slotId, seed: 42, now: clock.now(), weather: 'sun' });
  return { clock, store, bus, scene, cache, system, ctx, frame, start, run: (seconds: number) => {
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
    expect(r.w).toBe(Math.round(70 * slot('meadow-1').scale * 1));
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
    env.bus.emit('session:water', { blockIndex: 1 });
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
    expect(b.w).toBeCloseTo(380 * slot('back-1').scale, 9);
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
    for (let i = 0; i < 120; i++) {
      const f = env.frame();
      sys.draw!('waterSurface', target, f);
      sys.draw!('entities', target, f);
      for (const d of sys.entities!(f)) d.draw(target, f);
      sys.draw!('air', target, f);
    }
    env.frame();
    expect(sys.perf().frames).toBeGreaterThan(100);
    expect(sys.perf().avgMs).toBeLessThan(2);
  });
});
