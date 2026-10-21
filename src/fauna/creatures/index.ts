/**
 * Creature factory: one entry per kind. Add a creature by writing `creatures/<kind>.ts` (art +
 * behaviour) and wiring its spawn (and optional art warm-up) here.
 */
import { hashString } from '../../core/rng';
import type { Roster } from '../roster';
import type { Stand } from '../targets';
import type { FaunaKind } from '../tuning';
import type { Creature, FaunaWorld } from '../types';
import { Dragonfly } from './dragonfly';
import { KOI_PATTERNS, Koi } from './koi';
import { Leaf } from './leaf';
import { Strider } from './strider';

export interface SpawnContext {
  count: number;
  /** base seed for koi patterns; koi `koiIndex` gets its own */
  koiSeed: number;
  koiIndex: number;
  /** heron wading spots */
  stands: Stand[];
  /** visit length (s) */
  stay: number;
}

export function koiPattern(koiSeed: number, index: number) {
  // the first koi is a kohaku more often than not; then the others in a seeded order
  const start = koiSeed % 3 === 0 ? 1 : 0;
  return KOI_PATTERNS[(start + index) % KOI_PATTERNS.length]!;
}

export function spawnCreatures(kind: FaunaKind, w: FaunaWorld, s: SpawnContext): Creature[] {
  const out: Creature[] = [];
  if (w.pond.world.length < 3 && (kind === 'koi' || kind === 'strider' || kind === 'leaf' || kind === 'heron')) return out;
  switch (kind) {
    case 'koi':
      out.push(new Koi(w, { seed: hashString(`${s.koiSeed}:${s.koiIndex}`), pattern: koiPattern(s.koiSeed, s.koiIndex) }));
      break;
    case 'strider':
      for (let i = 0; i < s.count; i++) out.push(new Strider(w));
      break;
    case 'leaf':
      out.push(new Leaf(w, s.stay));
      break;
    case 'dragonfly':
      out.push(new Dragonfly(w, s.stay || 40));
      break;
    default:
      break;
  }
  return out;
}

/** Paint the parts of unlocked creatures ahead of their first appearance (one kind per call). */
export function warmArt(_roster: Roster, _w: FaunaWorld): void {}
