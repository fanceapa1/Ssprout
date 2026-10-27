import { focusMinutes, recommendPlans } from '../core/plans';
import { tierForMinutes } from '../core/rewards';
import type { Rng } from '../core/rng';
import { DEFAULT_SCENERY, type SceneryId } from '../core/sceneries';
import type { GardenState, SessionLogEntry } from '../core/state';
import type { SpeciesDef } from '../plants/types';
import { SAMPLE_TASKS } from './fill-garden';

/**
 * Dev helper behind `window.sprout.schedule.fillHistory(days)`: a realistic stretch of study
 * history in the session log, for looking at the calendar (screenshots, studio-like review). Most
 * days have one to three sessions at plausible hours, a few are empty, a few sessions ended early.
 * Entries belong to `sceneryId` (default: the Japanese garden) and take its `slotIds` in turn.
 * Pure: time and randomness come in.
 */

const MIN = 60_000;
const TOTALS = [25, 25, 30, 45, 50, 50, 60, 90, 120] as const;
/** start hours, weighted toward mornings and evenings */
const HOURS = [8, 9, 9, 10, 10, 11, 13, 14, 14, 15, 16, 17, 19, 20, 20, 21] as const;

export function buildHistory(
  rng: Rng,
  species: readonly Pick<SpeciesDef, 'id' | 'tier'>[],
  opts: { now: number; days: number; idPrefix?: string; sceneryId?: SceneryId; slotIds?: readonly string[] },
): SessionLogEntry[] {
  const sceneryId = opts.sceneryId ?? DEFAULT_SCENERY;
  const slotIds = opts.slotIds ?? (sceneryId === DEFAULT_SCENERY ? ['meadow-1'] : []);
  if (slotIds.length === 0) throw new Error(`buildHistory: no slots for ${sceneryId}`);
  const out: SessionLogEntry[] = [];
  const today = new Date(opts.now);
  for (let back = opts.days; back >= 0; back--) {
    if (rng.chance(0.22)) continue; // a quiet day
    const n = rng.chance(0.45) ? 1 : rng.chance(0.7) ? 2 : 3;
    let hour = rng.pick([...HOURS]) as number;
    for (let i = 0; i < n; i++) {
      const total = rng.pick([...TOTALS]) as number;
      const minute = rng.int(0, 11) * 5;
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, hour, minute).getTime();
      const plan = rng.pick(recommendPlans(total));
      const cancelled = rng.chance(0.12);
      const end = start + (cancelled ? rng.int(8, Math.max(9, total - 5)) : total) * MIN + rng.int(0, 6) * MIN;
      if (end > opts.now) break;
      const pool = species.filter((s) => s.tier <= tierForMinutes(total));
      const sp = rng.pick(pool.length ? pool : [...species]);
      out.push({
        id: `${opts.idPrefix ?? 'history'}-${back}-${i}`,
        outcome: cancelled ? 'cancelled' : 'completed',
        taskName: rng.pick([...SAMPLE_TASKS]),
        speciesId: sp.id,
        sceneryId,
        slotId: slotIds[out.length % slotIds.length]!,
        seed: rng.int(0, 0xffffff),
        plan,
        goalMinutes: total,
        focusedMinutes: cancelled ? Math.max(1, Math.round((end - start) / MIN) - 2) : focusMinutes(plan),
        startedAt: start,
        endedAt: end,
      });
      hour = Math.min(22, hour + Math.ceil(total / 60) + rng.int(0, 3));
      if (hour >= 23) break;
    }
  }
  return out;
}

/** The state with `entries` merged into its log (oldest first) and its stats grown to match. */
export function withHistory(state: GardenState, entries: readonly SessionLogEntry[]): GardenState {
  const taken = new Set(state.log.map((e) => e.id));
  const fresh = entries.filter((e) => !taken.has(e.id));
  const log = [...state.log, ...fresh].sort((a, b) => a.endedAt - b.endedAt);
  const done = fresh.filter((e) => e.outcome === 'completed');
  return {
    ...state,
    log,
    stats: {
      totalMinutes: state.stats.totalMinutes + done.reduce((n, e) => n + e.focusedMinutes, 0),
      completed: state.stats.completed + done.length,
      cancelled: state.stats.cancelled + (fresh.length - done.length),
    },
  };
}
