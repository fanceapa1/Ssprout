import type { Rng } from './rng';
import type { ActiveSession, GardenState, Weather } from './state';

/**
 * Session maths (SPEC §2). Pure functions of an `ActiveSession` and an explicit `now`; time
 * always comes from the injected Clock at the call site.
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

export function goalMinutesOf(s: ActiveSession): number {
  return Math.round(s.goalMs / MINUTE_MS);
}

/** Studied time so far; paused spans (including the current one) are excluded. Never negative. */
export function elapsedMs(s: ActiveSession, now: number): number {
  return Math.max(0, (s.pausedAt ?? now) - s.startedAt - s.pausedTotalMs);
}

export function remainingMs(s: ActiveSession, now: number): number {
  return Math.max(0, s.goalMs - elapsedMs(s, now));
}

export function isComplete(s: ActiveSession, now: number): boolean {
  return elapsedMs(s, now) >= s.goalMs;
}

/** 0..1 */
export function progress(s: ActiveSession, now: number): number {
  if (s.goalMs <= 0) return 1;
  return Math.min(1, elapsedMs(s, now) / s.goalMs);
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
 * The instant studied time reached the goal, assuming no further pauses. `null` while paused
 * short of the goal (it cannot complete until resumed). Used to stamp a session that finished
 * while the app was closed with its real completion time.
 */
export function completionTime(s: ActiveSession): number | null {
  const at = s.startedAt + s.pausedTotalMs + s.goalMs;
  if (s.pausedAt !== null && at > s.pausedAt) return null;
  return at;
}

export type SessionPhase = 'idle' | 'running' | 'paused' | 'reward';

/** Where the garden is in the session state machine (docs/systems/core.md). */
export function sessionPhase(state: Pick<GardenState, 'session' | 'pendingReward'>): SessionPhase {
  if (state.session) return state.session.pausedAt === null ? 'running' : 'paused';
  if (state.pendingReward) return 'reward';
  return 'idle';
}

export const WEATHERS: readonly Weather[] = ['sun', 'rain', 'mist'];
/** Cumulative weights: sun 60 %, rain 25 %, mist 15 %. */
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
