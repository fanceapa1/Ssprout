/**
 * Ambience intensity envelopes — pure. Each channel (one per weather, motes, motion, wind
 * boost) eases toward a target derived from the session phase with a critically damped spring,
 * so every change starts and ends softly (like a breath) and never overshoots from rest.
 * docs/systems/ambience.md › Envelopes, ADR 0081.
 */
import type { SessionPhase } from '../core/session';
import type { Weather } from '../core/state';

export const CHANNELS = ['sun', 'rain', 'mist', 'motes', 'motion', 'boost'] as const;
export type Channel = (typeof CHANNELS)[number];
export type Levels = Record<Channel, number>;

export interface EnvelopeState {
  value: Levels;
  velocity: Levels;
}

/** Tuning constants (seconds / levels). */
export const ENVELOPE = {
  /** weather crossfade at session start / end / weather change (settle time, s) */
  crossfadeS: 4,
  /** pause → stillness and resume (s) */
  pauseS: 3,
  /** motes fade (s) */
  motesS: 3,
  /** weather level during a break: it softens */
  breakLevel: 0.55,
  /** weather level while paused: a faint, still trace */
  pausedLevel: 0.3,
  /** animation speed during a break */
  breakMotion: 0.75,
  /** settle tolerance used by `settleTime` (fraction of the step) */
  tolerance: 0.02,
} as const;

/** Settle time per channel (to within 2 %). */
export const SETTLE_S: Readonly<Record<Channel, number>> = {
  sun: ENVELOPE.crossfadeS,
  rain: ENVELOPE.crossfadeS,
  mist: ENVELOPE.crossfadeS,
  motes: ENVELOPE.motesS,
  motion: ENVELOPE.pauseS,
  boost: ENVELOPE.crossfadeS,
};

/** ω·t at which a critically damped step response is within 2 % of its target. */
const OMEGA_T_2PCT = 5.834;

const zero = (): Levels => ({ sun: 0, rain: 0, mist: 0, motes: 0, motion: 0, boost: 0 });

export interface TargetOptions {
  /** dev preview weather (window.sprout.setWeather): shown even without a session */
  preview?: Weather | null;
  /** prefers-reduced-motion: no animation, no motes */
  reducedMotion?: boolean;
}

/** What every channel should settle to for this phase. */
export function targetsFor(phase: SessionPhase, weather: Weather | null, opts: TargetOptions = {}): Levels {
  const t = zero();
  const w = opts.preview ?? (phase === 'idle' ? null : weather);
  let level = 0;
  switch (phase) {
    case 'focus':
      level = 1;
      t.motes = 1;
      t.motion = 1;
      t.boost = 1;
      break;
    case 'break':
      level = ENVELOPE.breakLevel;
      t.motion = ENVELOPE.breakMotion;
      t.boost = 0.5;
      break;
    case 'paused':
      level = ENVELOPE.pausedLevel;
      t.motion = 0;
      break;
    case 'idle':
      t.motion = 1;
      break;
  }
  // a dev preview always shows the weather fully (but keeps the phase's motion)
  if (opts.preview) level = phase === 'paused' ? ENVELOPE.pausedLevel : phase === 'break' ? ENVELOPE.breakLevel : 1;
  if (w) t[w] = level;
  if (opts.reducedMotion) {
    t.motion = 0;
    t.motes = 0;
  }
  return t;
}

export function createEnvelope(initial?: Partial<Levels>): EnvelopeState {
  return { value: { ...zero(), ...initial }, velocity: zero() };
}

/** Jump straight to the targets (first frame after load, dev previews). */
export function settleEnvelope(targets: Levels): EnvelopeState {
  return { value: { ...targets }, velocity: zero() };
}

/**
 * Advance every channel by `dt` seconds toward `targets` (exact critically damped solution, so
 * any `dt` is stable). Returns a new state; values are clamped to [0, 1].
 */
export function stepEnvelope(state: EnvelopeState, targets: Levels, dt: number, settle: Readonly<Record<Channel, number>> = SETTLE_S): EnvelopeState {
  if (!(dt > 0)) return state;
  const value = zero();
  const velocity = zero();
  for (const c of CHANNELS) {
    const w = OMEGA_T_2PCT / Math.max(1e-3, settle[c]);
    const x0 = state.value[c] - targets[c];
    const v0 = state.velocity[c];
    const e = Math.exp(-w * dt);
    const k = v0 + w * x0;
    let x = (x0 + k * dt) * e;
    let v = (v0 - w * k * dt) * e;
    if (Math.abs(x) < 1e-5 && Math.abs(v) < 1e-5) {
      x = 0;
      v = 0;
    }
    value[c] = Math.min(1, Math.max(0, targets[c] + x));
    velocity[c] = v;
  }
  return { value, velocity };
}

/** True when every channel is at its target (within `eps`). */
export function isSettled(state: EnvelopeState, targets: Levels, eps = 1e-3): boolean {
  return CHANNELS.every((c) => Math.abs(state.value[c] - targets[c]) <= eps && Math.abs(state.velocity[c]) <= eps);
}
