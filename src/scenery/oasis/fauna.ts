/**
 * The oasis's unlock table (ADR 0248, 0304): the creatures it shares with the other gardens by
 * biology and its own eight (docs/research/oasis-biome.md §3). Data only, so `scenery/fauna.ts`
 * reads it without the painting; where they live is `./wildlife.ts`. Rows whose creature module
 * does not exist yet are skipped. docs/systems/fauna.md › The oasis.
 */
import type { FaunaTable } from '../../core/fauna-unlocks';

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
    id: 'house-bunting',
    kind: 'bunting',
    rule: 'always',
    arrival: 'A house bunting hops along the top of the wall.',
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
    id: 'laughing-dove',
    kind: 'dove',
    rule: '2 plants',
    arrival: 'A laughing dove coos from the palm fronds.',
    announce: true,
    unlocked: (c) => c.plants >= 2,
  },
  {
    // its own kind, not a dragonfly variant: it perches and sallies, and the row must skip until it is painted (ADR 0304)
    id: 'violet-dropwing',
    kind: 'dropwing',
    rule: '3 plants',
    arrival: 'A violet dropwing rests on a post by the basin.',
    announce: true,
    unlocked: (c) => c.plants >= 3,
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
    // it lives in the basin itself: no water plant needed
    id: 'sahara-frog',
    kind: 'sahara-frog',
    rule: '5 plants',
    arrival: 'A Sahara frog peers out of the basin.',
    announce: true,
    unlocked: (c) => c.plants >= 5,
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
    id: 'hoopoe',
    kind: 'hoopoe',
    rule: '8 plants',
    arrival: 'A hoopoe walks the damp plots, its crest raised.',
    announce: true,
    unlocked: (c) => c.plants >= 8,
  },
  {
    id: 'gecko',
    kind: 'gecko',
    rule: '10 plants, at night',
    arrival: "A Böhme's gecko waits on the warm wall after dark.",
    announce: true,
    unlocked: (c) => c.plants >= 10,
  },
  {
    id: 'bee-eater',
    kind: 'bee-eater',
    rule: '14 plants',
    arrival: 'A blue-cheeked bee-eater watches from a frond tip.',
    announce: true,
    unlocked: (c) => c.plants >= 14,
  },
  {
    // moved from 14 so that it does not arrive with the bee-eater
    id: 'swallows',
    kind: 'swallow',
    rule: '17 plants',
    arrival: 'Swallows from the ksar skim over the basin.',
    announce: true,
    unlocked: (c) => c.plants >= 17,
  },
  {
    id: 'white-stork',
    kind: 'stork',
    rule: '20 plants, rare',
    arrival: 'A white stork stands on the tower of the ksar.',
    announce: true,
    unlocked: (c) => c.plants >= 20,
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
