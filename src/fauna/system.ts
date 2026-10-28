/**
 * The garden's fauna as a render System: it follows the store (plants → unlocked creatures and
 * their targets), the session (a running session is a little livelier) and the clock (night),
 * and draws creatures into the underwater, waterSurface, entities and air layers.
 */
import type { EventBus } from '../core/events';
import { faunaUnlock, unlockedFauna } from '../core/fauna-unlocks';
import { DEFAULT_SCENERY, type SceneryId } from '../core/sceneries';
import { plantsIn, type GardenState, type Store } from '../core/state';
import type { Drawable, LayerId, System, SystemContext } from '../render/types';
import type { Rect, Viewport } from '../render/viewport';
import { FaunaSim } from './sim';
import type { TargetLookup } from './targets';
import type { Creature } from './types';
import type { DaylightSource } from '../ambience/daylight-source';
import type { CameraView } from '../render/camera';

/** ms of idle time spent painting sharper parts per callback (ADR 0188) */
const PART_BUDGET_MS = 8;

/**
 * The pixel scale creatures should be painted at: the overview's, or — once a closer camera
 * rests — its view's, so a bee on the flower you are looking at is as sharp as the flower.
 */
export function faunaResolution(overview: Viewport, camera: CameraView | null): number {
  if (!camera || camera.isOverview()) return overview.pixelScale;
  return Math.max(overview.pixelScale, camera.detailView().pixelScale);
}

const idle = (fn: () => void) => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 500 });
  else setTimeout(fn, 16);
};

/** Creature kind → the unlock id it announces (koi are counted: koi-1, koi-2, koi-3). */
const ARRIVAL_OF: Partial<Record<Creature['kind'], string>> = {
  dragonfly: 'dragonfly',
  butterfly: 'butterflies',
  bee: 'bees',
  bird: 'small-birds',
  frog: 'frog',
  swallow: 'swallows',
  heron: 'heron',
};

/** Unlock ids whose creatures are in sight right now (hand-spawned dev/studio creatures don't count). */
export function sightedFauna(creatures: readonly Creature[], view: Rect): Set<string> {
  const ids = new Set<string>();
  let koi = 0;
  for (const c of creatures) {
    if (c.forced || c.done) continue;
    if (c.x < view.x || c.x > view.x + view.w || c.y < view.y || c.y > view.y + view.h) continue;
    if (c.kind === 'koi') koi++;
    else {
      const id = ARRIVAL_OF[c.kind];
      if (id) ids.add(id);
    }
  }
  for (let i = 1; i <= Math.min(3, koi); i++) ids.add(`koi-${i}`);
  return ids;
}

/** How often (s) to look for first sightings. */
const SIGHT_EVERY = 0.5;

export interface FaunaSystemOptions {
  /** species lookup (pollinators, habitats, size, anchor) — e.g. `getSpecies` */
  species: TargetLookup;
  /** rng seed (default: the clock at first init) */
  seed?: number;
  /** the garden's daylight: diurnal creatures rest while its night phase dominates */
  daylight?: Pick<DaylightSource, 'at'>;
}

export interface FaunaSystem extends System {
  /** the running simulation (null before the first init) */
  readonly sim: FaunaSim | null;
  /** last viewport the system was initialised with */
  readonly viewport: Viewport | null;
  /** the app clock's now (epoch ms) */
  now(): number;
}

const LAYERS_DRAWN: ReadonlySet<LayerId> = new Set(['underwater', 'waterSurface', 'air']);

export function createFaunaSystem(opts: FaunaSystemOptions): FaunaSystem {
  let sim: FaunaSim | null = null;
  let store: Store | null = null;
  let viewport: Viewport | null = null;
  let unsubscribe: (() => void) | null = null;
  let clock: SystemContext['clock'] | null = null;
  let bus: EventBus | null = null;
  const lookup = opts.species;
  let unlocked: string[] = [];
  /** arrivals already emitted this run (the UI records them in state.faunaSeen when it says them) */
  const emitted = new Set<string>();
  let sightT = 0;
  let camera: CameraView | null = null;
  let seenDetail = -1;
  let painting = false;
  /** paint queued sharper parts a slice at a time in idle callbacks */
  const pumpParts = () => {
    if (painting || !sim || sim.world.art.pending === 0) return;
    painting = true;
    idle(() => {
      painting = false;
      if (sim && sim.world.art.paintPending(PART_BUDGET_MS) > 0) pumpParts();
    });
  };

  /** the garden on view; only the Japanese garden has wildlife until per-scenery rosters (S11) */
  let sceneryId: SceneryId | null = null;
  const wild = () => (sceneryId ?? DEFAULT_SCENERY) === DEFAULT_SCENERY;
  const follow = (state: GardenState) => {
    const id = sceneryId ?? state.scenery;
    unlocked = wild() ? unlockedFauna(state, lookup, id) : [];
    sim?.setGarden(plantsIn(state, id), unlocked, lookup);
  };

  /**
   * SPEC §4: "when a new creature first appears" — a newly unlocked creature is announced
   * (`fauna:arrived`) the first time it is actually in view, not when it unlocks (ADR 0120).
   */
  const lookForArrivals = () => {
    if (!sim || !store || !bus || !viewport) return;
    const seen = store.get().faunaSeen;
    const waiting = unlocked.filter((id) => !seen.includes(id) && !emitted.has(id) && faunaUnlock(id)?.announce);
    if (waiting.length === 0) return;
    const sighted = sightedFauna(sim.creatures, viewport.visible);
    for (const id of waiting) {
      if (!sighted.has(id)) continue;
      emitted.add(id);
      bus.emit('fauna:arrived', { id });
    }
  };

  return {
    id: 'fauna',
    get sim() {
      return sim;
    },
    get viewport() {
      return viewport;
    },
    now: () => clock?.now() ?? 0,
    init(ctx: SystemContext) {
      const switched = !!ctx.scenery && ctx.scenery.id !== sceneryId;
      if (ctx.scenery) sceneryId = ctx.scenery.id;
      if (!sim) {
        sim = new FaunaSim({ scene: ctx.scene, seed: opts.seed ?? ctx.clock.now(), reducedMotion: ctx.reducedMotion });
        const daylight = opts.daylight;
        if (daylight) sim.nightSource = (now) => daylight.at(now).night >= 0.5;
        store = ctx.store;
        unsubscribe = ctx.store.subscribe((next, prev) => {
          if (next.plants !== prev.plants) follow(next);
        });
        follow(ctx.store.get());
      } else {
        if (sim.world.scene !== ctx.scene) sim.setScene(ctx.scene);
        if (switched) {
          sim.resetResidents();
          if (store) follow(store.get());
        }
      }
      viewport = ctx.viewport;
      clock = ctx.clock;
      bus = ctx.bus;
      sim.setView(ctx.viewport.visible);
      camera = ctx.camera ?? null;
      seenDetail = -1;
      sim.setResolution(ctx.viewport.pixelScale);
    },
    update(f) {
      if (!sim || !wild()) return;
      const session = store?.get().session;
      sim.setLively(!!session && session.pausedAt === null);
      sim.update(f.dt, f.now);
      // a resting close view paints the creatures sharper (in idle time; the old parts draw meanwhile)
      if (camera && viewport && camera.detailVersion !== seenDetail && !camera.moving()) {
        seenDetail = camera.detailVersion;
        sim.setResolution(faunaResolution(viewport, camera));
      }
      pumpParts();
      sightT += f.dt;
      if (sightT >= SIGHT_EVERY) {
        sightT = 0;
        lookForArrivals();
      }
    },
    draw(layer, ctx) {
      if (sim && wild() && LAYERS_DRAWN.has(layer)) sim.draw(layer, ctx);
    },
    entities(): Drawable[] {
      return sim && wild() ? sim.entities() : [];
    },
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      sim = null;
    },
  };
}
