/**
 * Unlock ids (core/fauna-unlocks.ts, the contract) → what the fauna system keeps alive.
 */
import type { FaunaKind, VisitorKind } from './tuning';

export interface Roster {
  /** resident koi (0–3) */
  koi: number;
  /** resident water striders (and the occasional drifting leaf) */
  striders: boolean;
  /** a frog on a pad — only when a pad actually exists (see targets.lilyPads) */
  frog: boolean;
  /** visiting kinds that may be scheduled */
  visitors: Set<VisitorKind>;
  /** koi-3 (25 plants): "more frequent birds" */
  birdBoost: boolean;
  /** resident kind → how many to keep alive for it */
  residents: Map<string, number>;
  /** kind → the variants the garden allows (none: any) */
  variants: Map<string, string[]>;
}

const VISITOR_OF: Record<string, VisitorKind> = {
  dragonfly: 'dragonfly',
  butterflies: 'butterfly',
  bees: 'bee',
  'small-birds': 'bird',
  swallows: 'swallow',
  heron: 'heron',
};

export function rosterFor(unlocked: readonly string[]): Roster {
  const ids = new Set(unlocked);
  const visitors = new Set<VisitorKind>();
  for (const id of ids) {
    const v = VISITOR_OF[id];
    if (v) visitors.add(v);
  }
  const striders = ids.has('striders');
  if (striders) visitors.add('leaf');
  const koi = ['koi-1', 'koi-2', 'koi-3'].filter((k) => ids.has(k)).length;
  const frog = ids.has('frog');
  const residents = new Map([['koi', koi], ['strider', striders ? 1 : 0], ['frog', frog ? 1 : 0]]);
  return { koi, striders, frog, visitors, birdBoost: ids.has('koi-3'), residents, variants: new Map() };
}

const KIND_ALIASES: Record<string, FaunaKind> = {
  striders: 'strider',
  strider: 'strider',
  leaf: 'leaf',
  dragonfly: 'dragonfly',
  koi: 'koi',
  'koi-1': 'koi',
  'koi-2': 'koi',
  'koi-3': 'koi',
  butterflies: 'butterfly',
  butterfly: 'butterfly',
  bees: 'bee',
  bee: 'bee',
  'small-birds': 'bird',
  bird: 'bird',
  frog: 'frog',
  swallows: 'swallow',
  swallow: 'swallow',
  heron: 'heron',
};

/** Accepts creature kinds and unlock ids (`koi-2`, `small-birds`, …). */
export function kindOf(id: string): FaunaKind | undefined {
  return KIND_ALIASES[id];
}
