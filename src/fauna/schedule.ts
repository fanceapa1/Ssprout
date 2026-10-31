/**
 * Visit scheduling (pure): when does the next dragonfly / bird / heron come by, and may it come
 * now? Long quiet gaps, a sooner first visit, retries when blocked. Tuning: `tuning.ts`.
 */
import type { Rng } from '../core/rng';
import { inHours, rangeOf } from './math';
import { creatureDef } from './creatures/registry';
import { FAUNA_TUNING, type FaunaKind, type ResidentKind, type VisitorKind, type VisitTuning } from './tuning';

const NEVER: VisitTuning = { gap: [Infinity, Infinity], first: [Infinity, Infinity], stay: [0, 0], group: [0, 0], max: 0, diurnal: false, visitor: false };

/** A kind's visit pacing (its def's `visit`); a kind without one never visits. */
export function visitTuning(kind: VisitorKind): VisitTuning {
  return creatureDef(kind)?.visit ?? NEVER;
}

export interface FaunaMode {
  /** prefers-reduced-motion */
  reduced: boolean;
  /** a study session is running (not paused) */
  lively: boolean;
  /** diurnal creatures rest */
  night: boolean;
  /** 25 plants: more frequent birds */
  birdBoost: boolean;
}

export const CALM_MODE: FaunaMode = { reduced: false, lively: false, night: false, birdBoost: false };

export function isNight(hour: number): boolean {
  return inHours(hour, FAUNA_TUNING.nightHours);
}

/** Multiplier applied to a kind's gaps in a mode. */
export function gapScale(kind: VisitorKind, mode: FaunaMode): number {
  let k = 1;
  if (mode.lively) k *= FAUNA_TUNING.livelyGap;
  if (mode.reduced) k *= FAUNA_TUNING.reducedGap;
  if (kind === 'bird' && mode.birdBoost) k *= FAUNA_TUNING.birdBoostGap;
  return k;
}

/** Seconds until the next visit of `kind` (`first`: the first one after unlock / load). */
export function visitDelay(kind: VisitorKind, rng: Rng, mode: FaunaMode, first = false): number {
  const t = visitTuning(kind);
  return rangeOf(rng, first ? t.first : t.gap) * gapScale(kind, mode);
}

export function maxVisitors(mode: FaunaMode): number {
  return mode.reduced ? FAUNA_TUNING.reducedMaxVisitors : FAUNA_TUNING.maxVisitors;
}

/** Fast, sweeping creatures that reduced motion leaves out entirely. */
export function allowedInMode(kind: FaunaKind, mode: FaunaMode): boolean {
  return !(mode.reduced && kind === 'swallow');
}

export interface Census {
  /** individuals per kind currently present */
  byKind: Record<FaunaKind, number>;
  /** individuals that count against the visitor cap */
  visitors: number;
}

export type Refusal = 'night' | 'day' | 'cap' | 'kind-max' | 'mode' | null;

/** Why a visit of `kind` can't start now (null = it may). */
export function refuseVisit(kind: VisitorKind, mode: FaunaMode, census: Census): Refusal {
  const t = visitTuning(kind);
  if (!allowedInMode(kind, mode)) return 'mode';
  if (t.diurnal && mode.night) return 'night';
  if (t.nocturnal && !mode.night) return 'day';
  if ((census.byKind[kind] ?? 0) >= t.max) return 'kind-max';
  if (t.visitor && census.visitors >= maxVisitors(mode)) return 'cap';
  return null;
}

/** How many individuals a visit brings, never more than the room left. */
export function groupSize(kind: VisitorKind, rng: Rng, mode: FaunaMode, census: Census): number {
  const t = visitTuning(kind);
  const want = Math.round(rangeOf(rng, [t.group[0], t.group[1] + 0.49]));
  const kindRoom = t.max - (census.byKind[kind] ?? 0);
  const capRoom = t.visitor ? maxVisitors(mode) - census.visitors : Infinity;
  return Math.max(0, Math.min(want, kindRoom, capRoom, mode.reduced ? 1 : Infinity));
}

/** Due times per visiting kind (animation seconds). */
export type Schedule = Map<VisitorKind, number>;

/**
 * Advance the schedule to time `t`: kinds that became enabled get a (sooner) first visit, kinds
 * that are no longer enabled are dropped, and every due kind either starts a visit (returned, and
 * rescheduled after a quiet gap) or is retried a little later when it may not come now.
 */
export function dueVisits(
  schedule: Schedule,
  t: number,
  enabled: ReadonlySet<VisitorKind>,
  mode: FaunaMode,
  census: Census,
  rng: Rng,
): VisitorKind[] {
  for (const kind of [...schedule.keys()]) if (!enabled.has(kind)) schedule.delete(kind);
  const out: VisitorKind[] = [];
  const running: Census = { byKind: { ...census.byKind }, visitors: census.visitors };
  for (const kind of enabled) {
    const due = schedule.get(kind);
    if (due === undefined) {
      schedule.set(kind, t + visitDelay(kind, rng, mode, true));
      continue;
    }
    if (t < due) continue;
    if (refuseVisit(kind, mode, running) !== null) {
      schedule.set(kind, t + rangeOf(rng, FAUNA_TUNING.retry));
      continue;
    }
    out.push(kind);
    running.byKind[kind] = (running.byKind[kind] ?? 0) + 1;
    if (visitTuning(kind).visitor) running.visitors++;
    schedule.set(kind, t + visitDelay(kind, rng, mode));
  }
  return out;
}

/** Resident counts wanted for a mode (the def's `resident`; by default one per unlocked row). */
export function residentTarget(kind: ResidentKind, unlockedCount: number, mode: FaunaMode): number {
  const def = creatureDef(kind);
  return def?.resident ? def.resident(unlockedCount, mode) : unlockedCount;
}
