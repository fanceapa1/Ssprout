/**
 * The oasis's wildlife (ADR 0248): the creatures it shares with the other gardens by biology
 * (docs/research/oasis-biome.md) and where they live (the still basin, the moving seguia and oued).
 * Its own creatures come with the phase 13 art queue. docs/systems/scenery.md › Oasis.
 */
import type { FaunaTable } from '../../core/fauna-unlocks';
import type { SceneryFauna } from '../../fauna/habitat';
import { BASIN_WATER, OUED_WATER, SEGUIA, SLUICE_WATER } from './geometry';

export const OASIS_FAUNA: FaunaTable = [
  {
    id: 'striders',
    kind: 'strider',
    variant: 'margin',
    rule: 'always',
    arrival: 'Water striders skate along the edge of the basin.',
    announce: false,
    unlocked: () => true,
  },
  {
    // a pomegranate or fig leaf in autumn gold: palm leaflets do not drift down
    id: 'leaf',
    kind: 'leaf',
    variant: 'katsura',
    rule: 'always',
    arrival: 'A golden leaf settles on the basin.',
    announce: false,
    unlocked: () => true,
  },
  {
    id: 'butterflies',
    kind: 'butterfly',
    variant: 'white',
    rule: '4 pollinator flowers',
    arrival: 'A cabbage white flutters over the plots.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 4,
  },
  {
    id: 'bees',
    kind: 'bee',
    rule: '6 pollinator flowers',
    arrival: 'Oasis bees have found the flowers in the grove.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 6,
  },
  {
    id: 'swallowtail',
    kind: 'butterfly',
    variant: 'swallowtail',
    rule: '8 pollinator flowers',
    arrival: 'A Saharan swallowtail sails down the terraces.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 8,
  },
  {
    id: 'swallows',
    kind: 'swallow',
    rule: '14 plants',
    arrival: 'Swallows from the ksar skim over the basin.',
    announce: true,
    unlocked: (c) => c.plants >= 14,
  },
  {
    // grey herons winter along the Draa: rare here
    id: 'heron',
    kind: 'heron',
    rule: '22 plants, rare',
    arrival: 'A grey heron stands at the edge of the basin.',
    announce: true,
    unlocked: (c) => c.plants >= 22,
  },
];

/** What the oasis tells its wildlife: the basin still, the channels and the oued moving; no perches yet. */
export const OASIS_WILDLIFE: SceneryFauna = {
  unlocks: OASIS_FAUNA,
  water: { still: BASIN_WATER, moving: [...SEGUIA, SLUICE_WATER, OUED_WATER] },
  perches: [],
};
