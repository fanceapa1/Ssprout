/**
 * The waterfall's wildlife (ADR 0248, B0 §3–4): its unlock table and where creatures live (still
 * pool, moving stream, ledge perches, heron stands, the cliff's perspective).
 * docs/systems/scenery.md › Waterfall › Wildlife. Rows whose creature module does not exist yet are skipped.
 */
import type { FaunaTable } from '../../core/fauna-unlocks';
import type { SceneryFauna } from '../../fauna/habitat';
import { pointInPolygon } from '../../fauna/math';
import { ledgePerch, perchesOf, type Stand } from '../../fauna/targets';
import { perspectiveScale } from '../../scene/slots';
import { FALLS, POOL, ROCKS, STREAM, WATERLINE } from './geometry';
import { CLIFF, CROWN_SCALE, LEDGES, skylineAt } from './layout';

export const WATERFALL_FAUNA: FaunaTable = [
  {
    id: 'striders',
    kind: 'strider',
    variant: 'margin',
    rule: 'always',
    arrival: 'Water striders skate along the edge of the pool.',
    announce: false,
    unlocked: () => true,
  },
  {
    id: 'dipper',
    kind: 'dipper',
    rule: 'always',
    arrival: 'A brown dipper bobs on a wet stone.',
    announce: false,
    unlocked: () => true,
  },
  {
    id: 'leaf',
    kind: 'leaf',
    variant: 'maple',
    rule: 'always',
    arrival: 'A maple leaf turns slowly on the pool.',
    announce: false,
    unlocked: () => true,
  },
  {
    id: 'damselfly',
    kind: 'damselfly',
    rule: '2 plants',
    arrival: 'A damselfly flutters over the stream.',
    announce: true,
    unlocked: (c) => c.plants >= 2,
  },
  {
    id: 'iwana-1',
    kind: 'iwana',
    variant: 'iwana',
    rule: '3 plants',
    arrival: 'A char holds still in the cold of the pool.',
    announce: true,
    unlocked: (c) => c.plants >= 3,
  },
  {
    id: 'butterflies',
    kind: 'butterfly',
    variant: 'swallowtail',
    rule: '4 pollinator flowers',
    arrival: 'A swallowtail drifts down the gorge.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 4,
  },
  {
    id: 'dragonfly',
    kind: 'dragonfly',
    variant: 'aka',
    rule: '5 plants',
    arrival: 'A red dragonfly hovers over the pool.',
    announce: true,
    unlocked: (c) => c.plants >= 5,
  },
  {
    id: 'bees',
    kind: 'bee',
    rule: '6 pollinator flowers',
    arrival: 'Bees have found the flowers by the falls.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 6,
  },
  {
    id: 'wagtail',
    kind: 'bird',
    variant: 'wagtail',
    rule: '6 plants',
    arrival: 'A wagtail runs along the wet stones.',
    announce: true,
    unlocked: (c) => c.plants >= 6,
  },
  {
    id: 'iwana-2',
    kind: 'iwana',
    variant: 'yamame',
    rule: '7 plants',
    arrival: 'A yamame joins the char in the pool.',
    announce: true,
    unlocked: (c) => c.plants >= 7,
  },
  {
    id: 'sawagani',
    kind: 'sawagani',
    rule: '8 plants',
    arrival: 'A small red crab sidles out from under a stone.',
    announce: true,
    unlocked: (c) => c.plants >= 8,
  },
  {
    // it sings from a stone in the current: no water plant needed
    id: 'kajika',
    kind: 'kajika',
    rule: '10 plants',
    arrival: 'A kajika frog sings from a stone in the stream.',
    announce: true,
    unlocked: (c) => c.plants >= 10,
  },
  {
    id: 'iwatsubame',
    kind: 'iwatsubame',
    rule: '14 plants',
    arrival: 'House martins sweep along the cliff face.',
    announce: true,
    unlocked: (c) => c.plants >= 14,
  },
  {
    id: 'fireflies',
    kind: 'firefly',
    rule: '16 plants, at night',
    arrival: 'Fireflies drift over the stream after dark.',
    announce: true,
    unlocked: (c) => c.plants >= 16,
  },
  {
    id: 'heron',
    kind: 'heron',
    rule: '18 plants',
    arrival: 'A grey heron fishes at the edge of the pool.',
    announce: true,
    unlocked: (c) => c.plants >= 18,
  },
  {
    id: 'yamasemi',
    kind: 'yamasemi',
    rule: '20 plants, rare',
    arrival: 'A crested kingfisher watches the pool from a branch.',
    announce: true,
    unlocked: (c) => c.plants >= 20,
  },
];

/** The foam at the falls' foot: an 84-unit disc on the water, seen at the pool's squash (0.36). */
export const FOAM = { x: FALLS.foot.x, y: FALLS.foot.y + 6, rx: 84, ry: 30 };

/** Boulders in or at the water's edge: the dipper's and the wagtail's. */
const WET_ROCKS = new Set(['rock-foot', 'rock-pool-left', 'rock-outflow', 'rock-stream']);

/** Wading spots on the pool's back edge right of the falls, clear of the spray and the foot boulder. */
const STANDS: Stand[] = [
  { x: 830, y: 620, facing: -1 },
  { x: 880, y: 628, facing: -1 },
  { x: 940, y: 646, facing: -1 },
];

/** Cliff scale knots (y, scale): each shelf height's mean edge y and its scale, top to bottom. */
const SHELVES: readonly { y: number; s: number }[] = [...new Set(LEDGES.map((l) => l.scale))]
  .sort((a, b) => a - b)
  .map((scale) => {
    const edges = LEDGES.filter((l) => l.scale === scale).flatMap((l) => l.edge);
    return { y: edges.reduce((sum, q) => sum + q.y, 0) / edges.length, s: scale };
  });

/**
 * Perspective at a world point: the ground's `perspectiveScale(y)`, but inside the cliff the scale
 * of what stands there, from the crown under the skyline through the shelves to the cliff's foot.
 */
export function waterfallPerspective(x: number, y: number): number {
  if (!pointInPolygon({ x, y }, CLIFF)) return perspectiveScale(y);
  const knots = [{ y: skylineAt(x), s: CROWN_SCALE }, ...SHELVES, { y: WATERLINE, s: perspectiveScale(WATERLINE) }];
  if (y <= knots[0]!.y) return knots[0]!.s;
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1]!;
    const b = knots[i]!;
    if (y <= b.y) return a.s + ((b.s - a.s) * (y - a.y)) / (b.y - a.y || 1);
  }
  return knots[knots.length - 1]!.s;
}

/** What the waterfall tells its wildlife: still pool minus the foam, the stream, ledges and wet rocks, heron stands. */
export const WATERFALL_WILDLIFE: SceneryFauna = {
  unlocks: WATERFALL_FAUNA,
  water: { still: POOL, moving: [STREAM], avoid: [FOAM] },
  perches: [
    ...perchesOf({ rocks: ROCKS.filter((r) => WET_ROCKS.has(r.id)), path: [] }),
    ...LEDGES.map((l) => ledgePerch(`ledge-${l.id}`, l.edge[0], l.edge[1])),
  ],
  stands: STANDS,
  perspective: waterfallPerspective,
};
