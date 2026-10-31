/**
 * The garden's fauna as a render System: it follows the store (plants → unlocked creatures and
 * their targets), the session (a running session is a little livelier) and the clock (night),
 * and draws creatures into the underwater, waterSurface, entities and air layers.
 */
import type { EventBus } from '../core/events';
import { faunaSeenIn, faunaSeenKey, unlockedFauna, type FaunaUnlock } from '../core/fauna-unlocks';
import type { SceneryId } from '../core/sceneries';
import { plantsIn, type GardenState, type Store } from '../core/state';
import type { Drawable, LayerId, System, SystemContext } from '../render/types';
import type { Rect, Viewport } from '../render/viewport';
import { JAPANESE_FAUNA } from '../scenery/japanese-garden/fauna';
import { creatureDef } from './creatures/registry';
import type { SceneryFauna } from './habitat';
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

type SightRow = Pick<FaunaUnlock, 'id' | 'kind' | 'variant'>;

/**
 * Unlock rows whose creatures are in sight right now: each row claims one creature of its kind
 * (and variant, if it names one), in table order, so a second koi is `koi-2`. Hand-spawned
 * dev/studio creatures and leaving ones don't count.
 */
export function sightedFauna(creatures: readonly Creature[], view: Rect, rows: readonly SightRow[]): Set<string> {
  const inView = creatures.filter((c) => !c.forced && !c.done && c.x >= view.x && c.x <= view.x + view.w && c.y >= view.y && c.y <= view.y + view.h);
  const claimed = new Set<Creature>();
  const ids = new Set<string>();
  for (const r of rows) {
    const c = inView.find((o) => !claimed.has(o) && o.kind === r.kind && (!r.variant || o.variant === r.variant));
    if (!c) continue;
    claimed.add(c);
    ids.add(r.id);
  }
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
  /** the garden on view's wildlife (its unlock table and targets) */
  habitat(): SceneryFauna;
  /** that garden's unlocked rows, in table order */
  unlocked(): readonly FaunaUnlock[];
  /** the garden on view */
  sceneryId(): SceneryId;
}

/** Without a scenery in the context (unit tests), the Japanese garden's wildlife. */
const DEFAULT_HABITAT: SceneryFauna = { unlocks: JAPANESE_FAUNA };

const LAYERS_DRAWN: ReadonlySet<LayerId> = new Set(['underwater', 'waterSurface', 'air']);

export function createFaunaSystem(opts: FaunaSystemOptions): FaunaSystem {
  let sim: FaunaSim | null = null;
  let store: Store | null = null;
  let viewport: Viewport | null = null;
  let unsubscribe: (() => void) | null = null;
  let clock: SystemContext['clock'] | null = null;
  let bus: EventBus | null = null;
  const lookup = opts.species;
  let unlocked: FaunaUnlock[] = [];
  let habitat: SceneryFauna = DEFAULT_HABITAT;
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

  /** the garden on view (the store's until a scenery comes in the context) */
  let sceneryId: SceneryId | null = null;
  const viewed = (state: GardenState): SceneryId => sceneryId ?? state.scenery;
  const follow = (state: GardenState) => {
    const id = viewed(state);
    unlocked = unlockedFauna(state, lookup, id, habitat.unlocks);
    sim?.setGarden(plantsIn(state, id), unlocked, lookup);
  };

  /**
   * SPEC §4: "when a new creature first appears" — a newly unlocked creature is announced
   * (`fauna:arrived`) the first time it is actually in view, not when it unlocks (ADR 0120).
   */
  const lookForArrivals = () => {
    if (!sim || !store || !bus || !viewport) return;
    const state = store.get();
    const sc = viewed(state);
    const waiting = unlocked.filter((r) => r.announce && creatureDef(r.kind) && !emitted.has(faunaSeenKey(sc, r.id)) && !faunaSeenIn(state, sc, r.id));
    if (waiting.length === 0) return;
    const sighted = sightedFauna(sim.creatures, viewport.visible, unlocked);
    for (const r of waiting) {
      if (!sighted.has(r.id)) continue;
      emitted.add(faunaSeenKey(sc, r.id));
      bus.emit('fauna:arrived', { id: r.id, sceneryId: sc });
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
    habitat: () => habitat,
    unlocked: () => unlocked,
    sceneryId: () => sceneryId ?? store?.get().scenery ?? 'japanese-garden',
    init(ctx: SystemContext) {
      const switched = !!ctx.scenery && ctx.scenery.id !== sceneryId;
      if (ctx.scenery) {
        sceneryId = ctx.scenery.id;
        habitat = ctx.scenery.fauna;
      }
      if (!sim) {
        sim = new FaunaSim({ scene: ctx.scene, seed: opts.seed ?? ctx.clock.now(), reducedMotion: ctx.reducedMotion, habitat });
        const daylight = opts.daylight;
        if (daylight) sim.nightSource = (now) => daylight.at(now).night >= 0.5;
        store = ctx.store;
        unsubscribe = ctx.store.subscribe((next, prev) => {
          if (next.plants !== prev.plants) follow(next);
        });
        follow(ctx.store.get());
      } else {
        if (sim.world.scene !== ctx.scene || switched) sim.setScene(ctx.scene, habitat);
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
      if (!sim) return;
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
      if (sim && LAYERS_DRAWN.has(layer)) sim.draw(layer, ctx);
    },
    entities(): Drawable[] {
      return sim ? sim.entities() : [];
    },
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      sim = null;
    },
  };
}
