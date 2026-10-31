/**
 * The Japanese garden's wildlife (SPEC §4): its unlock table, moved verbatim from core (ADR 0248).
 * Tune the thresholds here; `kind` names the creature module in `src/fauna/creatures/`.
 */
import type { FaunaTable } from '../../core/fauna-unlocks';

export const JAPANESE_FAUNA: FaunaTable = [
  {
    id: 'striders',
    kind: 'strider',
    rule: 'always',
    arrival: 'Water striders skate across the pond.',
    announce: false,
    unlocked: () => true,
  },
  {
    id: 'dragonfly',
    kind: 'dragonfly',
    rule: '2 plants',
    arrival: 'A dragonfly hovers over the water.',
    announce: true,
    unlocked: (c) => c.plants >= 2,
  },
  {
    id: 'koi-1',
    kind: 'koi',
    rule: '3 plants',
    arrival: 'A koi has found your pond.',
    announce: true,
    unlocked: (c) => c.plants >= 3,
  },
  {
    id: 'butterflies',
    kind: 'butterfly',
    rule: '4 pollinator flowers',
    arrival: 'Butterflies drift in among the flowers.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 4,
  },
  {
    id: 'bees',
    kind: 'bee',
    rule: '6 pollinator flowers',
    arrival: 'Bees have started visiting your flowers.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 6,
  },
  {
    id: 'koi-2',
    kind: 'koi',
    rule: '7 plants',
    arrival: 'A second koi joins the first.',
    announce: true,
    unlocked: (c) => c.plants >= 7,
  },
  {
    id: 'small-birds',
    kind: 'bird',
    rule: '8 plants',
    arrival: 'Small birds come to rest on the stones.',
    announce: true,
    unlocked: (c) => c.plants >= 8,
  },
  {
    id: 'frog',
    kind: 'frog',
    rule: 'a water plant + 10 plants',
    arrival: 'A frog has settled on a lily pad.',
    announce: true,
    unlocked: (c) => c.waterPlants >= 1 && c.plants >= 10,
  },
  {
    id: 'swallows',
    kind: 'swallow',
    rule: '14 plants',
    arrival: 'Swallows pass high over the garden.',
    announce: true,
    unlocked: (c) => c.plants >= 14,
  },
  {
    id: 'heron',
    kind: 'heron',
    rule: '20 plants',
    arrival: 'A grey heron visits the pond edge.',
    announce: true,
    unlocked: (c) => c.plants >= 20,
  },
  {
    id: 'koi-3',
    kind: 'koi',
    rule: '25 plants (and more frequent birds)',
    arrival: 'A third koi glides beneath the lilies.',
    announce: true,
    unlocked: (c) => c.plants >= 25,
    boost: 'bird',
  },
  {
    // the falling leaf came with the striders before the tables were data; last, so visits keep their order
    id: 'leaf',
    kind: 'leaf',
    rule: 'always',
    arrival: 'A leaf settles on the pond.',
    announce: false,
    unlocked: () => true,
  },
];
