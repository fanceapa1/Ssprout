/**
 * Shared shapes for creatures and the world they live in (`sim.ts` builds the world).
 */
import type { Rng } from '../core/rng';
import type { Noise2D } from '../paint';
import type { LayerId } from '../render/types';
import type { Pt, Rect } from '../render/viewport';
import type { SceneGeometry } from '../scene/geometry';
import type { FaunaMode } from './schedule';
import type { ArtCache } from './sprite';
import type { FlowerTarget, Pad, Perch, Stand } from './targets';
import type { FaunaKind } from './tuning';

export type Ctx = CanvasRenderingContext2D;

export interface PondInfo {
  /** pond polygon (world) */
  world: Pt[];
  /** the same polygon in the pond plane (y stretched by 1 / squash about cy) */
  plane: Pt[];
  cy: number;
  squash: number;
  centre: Pt;
  bounds: Rect;
}

/** All the water a garden has (ADR 0248): the still `pond` above, moving streams, and the clip for water layers. */
export interface WaterInfo {
  /** streams and runs: no striders, no reflections */
  moving: Pt[][];
  /** the water layers draw inside these (the whole pool, foam included, and the streams) */
  clip: Pt[][];
}

export interface FaunaWorld {
  /** animation seconds */
  t: number;
  rng: Rng;
  noise: Noise2D;
  scene: SceneGeometry;
  /** the still water creatures live on (a pool minus its foam) */
  pond: PondInfo;
  water: WaterInfo;
  /** visible world rect: creatures enter and leave beyond it */
  view: Rect;
  mode: FaunaMode;
  /** global speed factor (reduced motion slows everything) */
  speed: number;
  flowers: FlowerTarget[];
  perches: Perch[];
  pads: Pad[];
  art: ArtCache;
  /** where a heron could wade right now (cached) */
  stands(): Stand[];
  /** perspective scale at a world point (far = smaller); `x` matters where the ground is not a plane (a cliff) */
  perspective(y: number, x?: number): number;
  /** a ring on the water at a world point (size ≈ outer width in world units) */
  ripple(x: number, y: number, size: number, strength?: number): void;
  creatures: readonly Creature[];
}

export interface Creature {
  /** unique within its sim (assigned on spawn; also salts per-creature noise) */
  id: number;
  readonly kind: FaunaKind;
  /** world position: feet / body centre */
  x: number;
  y: number;
  /** the layer the creature is mostly on right now (for list / tests) */
  layer: LayerId;
  /** the variant it took (`FaunaUnlock.variant`: 'aka', 'wagtail'…), if its kind has any */
  variant?: string;
  /** behaviour state name (for list / tests / studio) */
  state: string;
  /** remove me */
  done: boolean;
  /** counts against the visitor cap */
  readonly visitor: boolean;
  /** spawned by hand (dev / studio): resident upkeep leaves it alone */
  forced: boolean;
  update(dt: number, w: FaunaWorld): void;
  /** called for every per-frame layer and for 'entities' when `depth()` is not null */
  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void;
  /** entities depth while on the ground, else null */
  depth(): number | null;
  /** go away now (night, unlocked no more…): exit naturally */
  leave(w: FaunaWorld): void;
}

let nextId = 1;

export abstract class BaseCreature implements Creature {
  id = nextId++;
  abstract readonly kind: FaunaKind;
  x = 0;
  y = 0;
  layer: LayerId = 'air';
  variant?: string;
  state = 'enter';
  done = false;
  forced = false;
  abstract readonly visitor: boolean;
  /** 0..1 fade (in when arriving from cover, out when soaking / sinking away) */
  alpha = 1;
  /** seconds in the current state */
  timer = 0;
  leaving = false;

  abstract update(dt: number, w: FaunaWorld): void;
  abstract draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void;
  depth(): number | null {
    return null;
  }
  leave(_w: FaunaWorld): void {
    this.leaving = true;
  }
  protected go(state: string): void {
    this.state = state;
    this.timer = 0;
  }
}
