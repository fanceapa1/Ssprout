/**
 * Creature factory: one entry per kind. Add a creature by writing `creatures/<kind>.ts` (art +
 * behaviour) and wiring its spawn (and optional art warm-up) here.
 */
import { hashString } from '../../core/rng';
import type { Roster } from '../roster';
import type { Stand } from '../targets';
import type { FaunaKind } from '../tuning';
import type { Pt } from '../../render/viewport';
import type { Creature, FaunaWorld } from '../types';
import { Bee } from './bee';
import { Bird } from './bird';
import { Butterfly } from './butterfly';
import { Dragonfly } from './dragonfly';
import { Frog } from './frog';
import { Heron } from './heron';
import { KOI_PATTERNS, Koi } from './koi';
import { Leaf } from './leaf';
import { Strider } from './strider';
import { Swallow } from './swallow';

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
    case 'butterfly':
      for (let i = 0; i < s.count; i++) out.push(new Butterfly(w, (s.stay || 50) * w.rng.range(0.8, 1.1)));
      break;
    case 'bee':
      for (let i = 0; i < s.count; i++) out.push(new Bee(w, (s.stay || 45) * w.rng.range(0.8, 1.1), i * w.rng.range(1.5, 5)));
      break;
    case 'bird': {
      const taken: Pt[] = [];
      for (const c of w.creatures) if (c instanceof Bird && !c.done) taken.push(...(c.spot() ? [c.spot()!] : []));
      for (let i = 0; i < s.count; i++) {
        const b = new Bird(w, (s.stay || 30) * w.rng.range(0.8, 1.2), taken);
        if (b.done) break;
        const spot = b.spot();
        if (spot) taken.push(spot);
        out.push(b);
      }
      break;
    }
    case 'frog': {
      const used = new Set(w.creatures.filter((c): c is Frog => c instanceof Frog && !c.done).map((f) => f.pad.plantId));
      const pad = w.pads.find((p) => !used.has(p.plantId));
      if (pad) out.push(new Frog(w, pad));
      break;
    }
    case 'swallow': {
      const side = w.rng.chance(0.5) ? -1 : 1;
      for (let i = 0; i < s.count; i++) out.push(new Swallow(w, side, i, i === 0 ? 0 : w.rng.range(0.15, 0.9) * i));
      break;
    }
    case 'heron': {
      if (s.stands.length === 0) break;
      out.push(new Heron(w, w.rng.pick(s.stands), s.stay || 120));
      break;
    }
    default:
      break;
  }
  return out;
}

/** Paint the parts of unlocked creatures ahead of their first appearance (one kind per call). */
export function warmArt(_roster: Roster, _w: FaunaWorld): void {}
