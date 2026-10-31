/**
 * The creature contract (ADR 0248): every `creatures/<kind>.ts` default-exports a `CreatureDef`,
 * and `creatures/registry.ts` finds it by file name. docs/systems/fauna.md › Adding a creature.
 */
import type { Rng } from '../../../core/rng';
import type { FaunaMode } from '../../schedule';
import type { Sprite } from '../../sprite';
import type { StageSpec } from '../../stage';
import type { VisitTuning } from '../../tuning';
import type { Creature, FaunaWorld } from '../../types';

export interface SpawnContext {
  /** individuals wanted (a visit's group, a hand spawn's count) */
  count: number;
  /** how many of this kind the garden already has (koi patterns) */
  index: number;
  /** stable per sim and kind (`hashString('<kind>-<sim seed>')`) */
  seed: number;
  /** visit length (s); 0 for residents */
  stay: number;
  /** the variants this garden's unlock rows allow (empty: any) */
  variants: readonly string[];
}

/** Studio sheet: the painted parts / frames side by side. */
export interface Sheet {
  make(res: number, seed: number): Sprite[];
  w: number;
  h: number;
}

/** Studio show: the creature alive on its own stage. */
export interface Show {
  /** the stage it lives on: the little pond (default) or the waterfall's pool and stream */
  stage?: 'pond' | 'falls';
  spec: StageSpec;
  w: number;
  h: number;
  /** individuals per respawn on its stage (default 1) */
  group?: number;
  /** position among the studio's fauna sections (default: after the others) */
  order?: number;
}

export interface CreatureDef {
  /** = the file name (`creatures/<kind>.ts`) */
  kind: string;
  /** studio title, plural where it comes in groups */
  title: string;
  /** resident: kept alive by upkeep; visitor: scheduled, counts against the cap; drifter: scheduled, not counted */
  role: 'resident' | 'visitor' | 'drifter';
  /** pacing for visitors and drifters */
  visit?: VisitTuning;
  /** residents: how many to keep when `unlocked` rows of this kind are unlocked */
  resident?(unlocked: number, mode: FaunaMode): number;
  /** whether its targets exist right now (no bees without flowers); default: always */
  needs?(w: FaunaWorld): boolean;
  /** residents are kept in this order, low first (default 10) */
  rank?: number;
  /** a hand spawn's default count (dev, studio); default 1 */
  spawnCount?: number;
  /** the variants it can take (`FaunaUnlock.variant`) */
  variants?: readonly string[];
  spawn(w: FaunaWorld, s: SpawnContext): Creature[];
  sheet?: Sheet;
  show?: Show;
}

/** A variant among `allowed` that the garden permits, or `fallback()` (the creature's own pick) when it permits any. */
export function variantOf<T extends string>(variants: readonly string[], allowed: readonly T[], rng: Rng, fallback: () => T): T {
  const ok = allowed.filter((v) => variants.includes(v));
  if (ok.length === 0) return fallback();
  return ok.length === 1 ? ok[0]! : rng.pick(ok);
}
