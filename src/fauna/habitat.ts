/**
 * What a scenery tells its wildlife (ADR 0248, 0304, 0373): the unlock table, and where the water, perches,
 * heron stands, ground, wall faces, regions, carriers and perspective differ from what `SceneGeometry` alone gives (the Japanese garden
 * needs none of them). docs/systems/fauna.md › Sceneries.
 */
import type { FaunaTable } from '../core/fauna-unlocks';
import type { Pt } from '../render/viewport';
import type { Carrier, GroundSpot, Perch, Region, Stand, WallFace } from './targets';

/** White water the still-water creatures keep out of: an ellipse in world units. */
export interface Foam {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface FaunaWaterSpec {
  /** the still water's outline (a plunge pool), foam included */
  still: Pt[];
  /** streams and runs */
  moving: Pt[][];
  /** carved out of `still` for the creatures living on it (the foam at the falls' foot) */
  avoid?: readonly Foam[];
}

export interface SceneryFauna {
  unlocks: FaunaTable;
  /** default: `geometry.pond` still, `geometry.streams` moving */
  water?: FaunaWaterSpec;
  /** default: rocks flagged `perch` and the stepping stones */
  perches?: Perch[];
  /** default: wading spots along the pond's far edge (`heronStands`) */
  stands?: Stand[];
  /** open ground a walking bird forages over (the oasis's damp plots); default none */
  ground?: GroundSpot[];
  /** upright faces a lizard clings to (the oasis's terrace walls); default none */
  walls?: WallFace[];
  /** areas to live in: shallows, rock pools, a far bay, the air, bark (the coast, ADR 0373); default none */
  regions?: Region[];
  /** moving bodies that perches ride on, by id (`Perch.carrier`: the coast's caique); default none */
  carriers?: Record<string, Carrier>;
  /** default: a line fitted through the slots' scales */
  perspective?(x: number, y: number): number;
}
