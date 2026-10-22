import type { PlanBlock, StudyPlan } from './plans';
import { createRng, type Rng } from './rng';
import type { ActiveSession, GardenState, Weather } from './state';

/**
 * Session maths (SPEC §2, ADR 0036). Pure functions of an `ActiveSession` and an explicit `now`;
 * time always comes from the injected Clock at the call site.
 *
 * Two time axes:
 * - session time = wall time since start minus pauses (`elapsedMs`);
 * - plan position = session time + skipped break remainders (`planPositionMs`), capped at the
 *   total. Blocks, growth and completion are measured on the plan position.
 */

export const MIN_GOAL_MINUTES = 10;
export const MAX_GOAL_MINUTES = 180;
export const GOAL_STEP_MINUTES = 5;
export const GOAL_PRESETS: readonly number[] = [25, 50, 90];
/** After this long paused the UI offers "Still with us?" (Resume / End session). */
export const LONG_PAUSE_MS = 30 * 60_000;
export const MINUTE_MS = 60_000;

/** Snap to the 5-minute grid and clamp to 10–180. Non-finite input falls back to `fallback`. */
export function clampGoalMinutes(minutes: number, fallback = 25): number {
  const m = Number.isFinite(minutes) ? minutes : fallback;
  const snapped = Math.round(m / GOAL_STEP_MINUTES) * GOAL_STEP_MINUTES;
  return Math.min(MAX_GOAL_MINUTES, Math.max(MIN_GOAL_MINUTES, snapped));
}

/** True when `minutes` is already a valid goal (on the grid and in range). */
export function isValidGoalMinutes(minutes: number): boolean {
  return Number.isFinite(minutes) && clampGoalMinutes(minutes) === minutes;
}

export function goalMinutesOf(s: Pick<ActiveSession, 'goalMs'>): number {
  return Math.round(s.goalMs / MINUTE_MS);
}

/** Session time so far, pauses excluded (the current one included). Never negative. */
export function elapsedMs(s: ActiveSession, now: number): number {
  return Math.max(0, (s.pausedAt ?? now) - s.startedAt - s.pausedTotalMs);
}

/** Position in the plan: session time plus skipped break time, capped at the total. */
export function planPositionMs(s: ActiveSession, now: number): number {
  return Math.min(s.goalMs, elapsedMs(s, now) + s.skippedMs);
}

/** Time left until the plan ends. */
export function remainingMs(s: ActiveSession, now: number): number {
  return s.goalMs - planPositionMs(s, now);
}

/** The plan has run to its end (skipped breaks count as passed). */
export function isComplete(s: ActiveSession, now: number): boolean {
  return elapsedMs(s, now) + s.skippedMs >= s.goalMs;
}

/** 0..1 of the whole plan. */
export function progress(s: ActiveSession, now: number): number {
  if (s.goalMs <= 0) return 1;
  return planPositionMs(s, now) / s.goalMs;
}

export function isPaused(s: ActiveSession): boolean {
  return s.pausedAt !== null;
}

/** How long the current pause has lasted (0 when running). */
export function pausedFor(s: ActiveSession, now: number): number {
  return s.pausedAt === null ? 0 : Math.max(0, now - s.pausedAt);
}

export function isLongPause(s: ActiveSession, now: number): boolean {
  return pausedFor(s, now) >= LONG_PAUSE_MS;
}

/**
 * The instant the plan reached its end, assuming no further pauses or skips. `null` while paused
 * short of it. Used to stamp a session that finished while the app was closed.
 */
export function completionTime(s: ActiveSession): number | null {
  const at = s.startedAt + s.pausedTotalMs + s.goalMs - s.skippedMs;
  if (s.pausedAt !== null && at > s.pausedAt) return null;
  return at;
}

/** Start offset (ms into the plan) of every block. */
export function blockStartsMs(plan: Pick<StudyPlan, 'blocks'>): number[] {
  let t = 0;
  return plan.blocks.map((b) => {
    const start = t;
    t += b.minutes * MINUTE_MS;
    return start;
  });
}

/** Plan offset (ms) at which block `index` starts, or null if out of range. */
export function blockStartMs(plan: Pick<StudyPlan, 'blocks'>, index: number): number | null {
  const starts = blockStartsMs(plan);
  return Number.isInteger(index) && index >= 0 && index < starts.length ? starts[index]! : null;
}

export interface SessionTimeline {
  /** plan position, ms (session time excluding pauses, plus skipped break time) */
  elapsedMs: number;
  blockIndex: number;
  block: PlanBlock;
  blockElapsedMs: number;
  blockRemainingMs: number;
  totalRemainingMs: number;
  focusDoneMs: number;
  focusTotalMs: number;
  /** focusDone ÷ focusTotal: 0 = seed … 1 = full bloom; breaks don't grow */
  growth: number;
  /** 0..1 of the whole plan */
  progress: number;
  /** the current block is a break that has been watered */
  watered: boolean;
  complete: boolean;
}

/** Where the session is in its plan at `now`. At the very end it reports the last block, full. */
export function sessionTimeline(s: ActiveSession, now: number): SessionTimeline {
  const pos = planPositionMs(s, now);
  const blocks = s.plan.blocks;
  let start = 0;
  let index = -1;
  let indexStart = 0;
  let focusDone = 0;
  let focusTotal = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const len = b.minutes * MINUTE_MS;
    if (b.kind === 'focus') {
      focusTotal += len;
      focusDone += Math.min(len, Math.max(0, pos - start));
    }
    if (index < 0 && pos < start + len) {
      index = i;
      indexStart = start;
    }
    start += len;
  }
  if (index < 0) {
    index = blocks.length - 1;
    indexStart = start - blocks[index]!.minutes * MINUTE_MS;
  }
  const block = blocks[index]!;
  const blockLen = block.minutes * MINUTE_MS;
  const blockElapsed = Math.min(blockLen, Math.max(0, pos - indexStart));
  return {
    elapsedMs: pos,
    blockIndex: index,
    block,
    blockElapsedMs: blockElapsed,
    blockRemainingMs: blockLen - blockElapsed,
    totalRemainingMs: s.goalMs - pos,
    focusDoneMs: focusDone,
    focusTotalMs: focusTotal,
    growth: focusTotal > 0 ? focusDone / focusTotal : 1,
    progress: s.goalMs > 0 ? pos / s.goalMs : 1,
    watered: block.kind === 'break' && s.waterings.includes(index),
    complete: isComplete(s, now),
  };
}

// ---------------------------------------------------------------------------------------------
// Automatic focus watering (SPEC §2, ADR 0153). The schedule lives on the focus-time axis: the
// k-th watering happens once `k` seeded intervals of 4–10 focused minutes have passed, so
// pauses and breaks never bring one closer. None falls in the last minute of focus (the bloom
// comes then).
// ---------------------------------------------------------------------------------------------

export const FOCUS_WATER_MIN_MS = 4 * MINUTE_MS;
export const FOCUS_WATER_MAX_MS = 10 * MINUTE_MS;
/** no automatic watering this close to the end of the focus time */
export const FOCUS_WATER_TAIL_MS = MINUTE_MS;

/**
 * Focus-time offsets (ms of focused time) of every automatic watering for a session with this
 * seed and total focus time. Deterministic: the same seed always gives the same schedule.
 */
export function focusWateringTimes(seed: number, focusTotalMs: number): number[] {
  const rng = createRng(seed >>> 0).fork('focus-water');
  const out: number[] = [];
  const end = focusTotalMs - FOCUS_WATER_TAIL_MS;
  for (let t = rng.range(FOCUS_WATER_MIN_MS, FOCUS_WATER_MAX_MS); t < end; t += rng.range(FOCUS_WATER_MIN_MS, FOCUS_WATER_MAX_MS)) {
    out.push(Math.round(t));
  }
  return out;
}

/** How many automatic waterings the focused time so far has reached (paused time excluded). */
export function dueFocusWaterings(s: ActiveSession, now: number): number {
  const t = sessionTimeline(s, now);
  const times = focusWateringTimes(s.seed, t.focusTotalMs);
  let n = 0;
  while (n < times.length && times[n]! <= t.focusDoneMs) n++;
  return n;
}

/**
 * Focused time still to go before the next automatic watering (ms), or null when none is left.
 * While focusing this is also wall time; breaks and pauses do not count down.
 */
export function nextFocusWateringIn(s: ActiveSession, now: number): number | null {
  const t = sessionTimeline(s, now);
  const next = focusWateringTimes(s.seed, t.focusTotalMs).find((x) => x > t.focusDoneMs);
  return next === undefined ? null : next - t.focusDoneMs;
}

/** Live growth of the session's plant, 0..1. */
export function growth(s: ActiveSession, now: number): number {
  return sessionTimeline(s, now).growth;
}

export type SessionPhase = 'idle' | 'focus' | 'break' | 'paused';

/** Where the garden is in the session state machine at `now` (docs/systems/core.md). */
export function sessionPhase(state: Pick<GardenState, 'session'>, now: number): SessionPhase {
  const s = state.session;
  if (!s) return 'idle';
  if (s.pausedAt !== null) return 'paused';
  return sessionTimeline(s, now).block.kind;
}

export const MAX_TASK_NAME = 40;
export const DEFAULT_TASK_NAME = 'Study session';

/** Collapse whitespace, trim, cap at 40 characters; empty → "Study session". */
export function normalizeTaskName(name: unknown): string {
  const t = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  if (t === '') return DEFAULT_TASK_NAME;
  return [...t].slice(0, MAX_TASK_NAME).join('').trimEnd();
}

export const WEATHERS: readonly Weather[] = ['sun', 'rain', 'mist'];
/** sun 60 %, rain 25 %, mist 15 %. */
export const WEATHER_WEIGHTS: Readonly<Record<Weather, number>> = { sun: 0.6, rain: 0.25, mist: 0.15 };

export function pickWeather(rng: Rng): Weather {
  const r = rng.next();
  if (r < WEATHER_WEIGHTS.sun) return 'sun';
  if (r < WEATHER_WEIGHTS.sun + WEATHER_WEIGHTS.rain) return 'rain';
  return 'mist';
}

/** "24:13", or "1:05:09" for an hour or more. Rounds up so 0:00 only shows at the very end. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
