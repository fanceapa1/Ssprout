/**
 * The garden's fauna as a render System: it follows the store (plants → unlocked creatures and
 * their targets), the session (a running session is a little livelier) and the clock (night),
 * and draws creatures into the underwater, waterSurface, entities and air layers.
 */
import { unlockedFauna } from '../core/fauna-unlocks';
import type { GardenState, Store } from '../core/state';
import type { Drawable, LayerId, System, SystemContext } from '../render/types';
import type { Viewport } from '../render/viewport';
import { FaunaSim } from './sim';
import type { TargetLookup } from './targets';

export interface FaunaSystemOptions {
  /** species lookup (pollinators, habitats, size, anchor) — e.g. `getSpecies` */
  species: TargetLookup;
  /** rng seed (default: the clock at first init) */
  seed?: number;
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
  const lookup = opts.species;

  const follow = (state: GardenState) => sim?.setGarden(state.plants, unlockedFauna(state, lookup), lookup);

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
      if (!sim) {
        sim = new FaunaSim({ scene: ctx.scene, seed: opts.seed ?? ctx.clock.now(), reducedMotion: ctx.reducedMotion });
        store = ctx.store;
        unsubscribe = ctx.store.subscribe((next, prev) => {
          if (next.plants !== prev.plants) follow(next);
        });
        follow(ctx.store.get());
      } else if (sim.world.scene !== ctx.scene) {
        sim.setScene(ctx.scene);
      }
      viewport = ctx.viewport;
      clock = ctx.clock;
      sim.setView(ctx.viewport.visible);
      sim.setResolution(ctx.viewport.pixelScale);
    },
    update(f) {
      if (!sim) return;
      const session = store?.get().session;
      sim.setLively(!!session && session.pausedAt === null);
      sim.update(f.dt, f.now);
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
