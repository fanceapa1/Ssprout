import type { Rng } from '../core/rng';
import type { EventKind } from './params';

/**
 * Pure event scheduler. Each `step(dt)` decides which one-shot events (plips, chirps, a warbler
 * song, wind gusts …) start during the last `dt` seconds, as a Poisson process per kind with
 * the given rates, while respecting a concurrent-voice cap and per-kind minimum gaps.
 * Deterministic for a given Rng — unit-tested without any audio.
 */

export interface PlannedEvent {
  kind: EventKind;
  /** offset in seconds within the step, 0 ≤ at < dt */
  at: number;
  /** stereo position −1 … 1 */
  pan: number;
  /** seed for the recipe's own Rng (variation per event) */
  seed: number;
  /** expected length in seconds (voice budget) */
  duration: number;
}

/** Approximate lengths used for the voice budget (recipes stay within these). */
export const EVENT_DURATION_S: Readonly<Record<EventKind, number>> = {
  plip: 0.35,
  drip: 0.15,
  chirp: 0.7,
  warbler: 2.6,
  swallow: 1.3,
  cricket: 1.6,
  gust: 7,
};

/** Minimum seconds between two events of the same kind. */
export const MIN_GAP_S: Readonly<Record<EventKind, number>> = {
  plip: 0.6,
  drip: 0.15,
  chirp: 1.2,
  warbler: 25,
  swallow: 6,
  cricket: 0.9,
  gust: 9,
};

/** Stereo spread per kind: the pond sits centre, birds and insects all around. */
export const PAN_SPREAD: Readonly<Record<EventKind, number>> = {
  plip: 0.3,
  drip: 0.7,
  chirp: 0.8,
  warbler: 0.7,
  swallow: 0.9,
  cricket: 0.9,
  gust: 0,
};

/** Voices (excluding gusts, which only move the wind bed) that may sound at once. */
export const MAX_VOICES = 6;

export interface PlannerOptions {
  rng: Rng;
  maxVoices?: number;
}

export interface Planner {
  /**
   * Advance by `dt` seconds of audio time ending at `now` and return the events that start in
   * that span, ordered by `at`. `rates` are events per minute.
   */
  step(dt: number, rates: Readonly<Record<EventKind, number>>, now: number): PlannedEvent[];
  /** Voices still sounding at audio time `t`. */
  activeVoices(t: number): number;
  reset(): void;
}

export function createPlanner({ rng, maxVoices = MAX_VOICES }: PlannerOptions): Planner {
  /** end times of sounding voices */
  let voices: number[] = [];
  const lastAt = new Map<EventKind, number>();

  const activeVoices = (t: number) => voices.filter((end) => end > t).length;

  return {
    step(dt, rates, now) {
      if (!(dt > 0)) return [];
      const start = now - dt;
      voices = voices.filter((end) => end > start);
      const candidates: { kind: EventKind; at: number }[] = [];
      for (const [kind, perMinute] of Object.entries(rates) as [EventKind, number][]) {
        const lambda = perMinute / 60;
        if (!(lambda > 0)) continue;
        // exponential inter-arrival times; the process is memoryless, so restarting per step is exact
        let t = -Math.log(1 - rng.next()) / lambda;
        while (t < dt) {
          candidates.push({ kind, at: t });
          t += -Math.log(1 - rng.next()) / lambda;
        }
      }
      candidates.sort((a, b) => a.at - b.at);

      const out: PlannedEvent[] = [];
      for (const { kind, at } of candidates) {
        const abs = start + at;
        const prev = lastAt.get(kind);
        if (prev !== undefined && abs - prev < MIN_GAP_S[kind]) continue;
        const duration = EVENT_DURATION_S[kind];
        if (kind !== 'gust') {
          if (activeVoices(abs) >= maxVoices) continue;
          voices.push(abs + duration);
        }
        lastAt.set(kind, abs);
        const spread = PAN_SPREAD[kind];
        out.push({ kind, at, pan: rng.range(-spread, spread), seed: rng.int(1, 0x7fffffff), duration });
      }
      return out;
    },
    activeVoices,
    reset() {
      voices = [];
      lastAt.clear();
    },
  };
}
