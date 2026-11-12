/**
 * The Greek coast's geometry in world units (1600 × 1000): the sea as its still water, the rock
 * pools, and the slots. No streams, boulder sprites or stepping stones yet (the painters G2–G4 may
 * add them). docs/systems/scenery.md › Coast.
 */
import type { Pt } from '../../render/viewport';
import type { SceneGeometry } from '../../scene/geometry';
import { HORIZON, POOLS, PROMONTORY, SHORE_EDGE, WATERLINE_EDGE } from './layout';
import { COAST_SLOTS } from './slots';

/** Where the beach's waterline meets the shoreline, at the foot of the beach steps. */
const STEPS_FOOT = WATERLINE_EDGE[WATERLINE_EDGE.length - 1]!;

/** The promontory's foot, from its point to where the top terrace begins. */
const FOOT = PROMONTORY.slice(PROMONTORY.findIndex((q) => q.x === 900)).concat(PROMONTORY[0]!).reverse();

/** The sea in view: the horizon, the promontory's foot, the broken shoreline and the beach's waterline. */
export const SEA_WATER: Pt[] = [
  { x: -20, y: HORIZON },
  { x: PROMONTORY[0]!.x, y: HORIZON },
  ...FOOT,
  ...SHORE_EDGE.slice(1, SHORE_EDGE.findIndex((q) => q.x === STEPS_FOOT.x && q.y === STEPS_FOOT.y)),
  ...WATERLINE_EDGE.slice().reverse(),
].map((q) => ({ ...q }));

/** The rock pools in the shelf, as closed outlines. */
export const POOL_WATER: Pt[][] = POOLS.map((e) =>
  Array.from({ length: 28 }, (_, i) => ({ x: e.cx + Math.cos((i / 28) * Math.PI * 2) * e.rx, y: e.cy + Math.sin((i / 28) * Math.PI * 2) * e.ry })),
);

/** The coast's geometry (its scenery: `./index.ts`). No building, lantern or eave. */
export const coastScene: SceneGeometry = {
  pond: SEA_WATER,
  // the far water edge: the sea's horizon
  waterline: HORIZON,
  streams: [],
  falls: null,
  rocks: [],
  path: [],
  structure: null,
  lights: [],
  eave: null,
  slots: COAST_SLOTS,
  // over the bay, the temple's point and the terraces
  skyBand: { top: 40, bottom: 300 },
};
