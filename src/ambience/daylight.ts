/**
 * Daylight phases — pure. The garden has four painted lights — sunrise, midday, sunset, night —
 * placed on the real clock from today's sun times (solar.ts) at the location guessed from the
 * time zone (zones.ts). Each change is a 40-minute blend centred on a boundary:
 *
 *   night ─┤civil dawn├─ sunrise ─┤sunrise + 60 min├─ midday ─┤sunset − 60 min├─ sunset ─┤civil dusk├─ night
 *
 * Short winter days keep midday at least around solar noon; white nights (no civil dusk) blend
 * sunset straight into sunrise at solar midnight; polar day is midday all day; a polar night with
 * civil twilight runs sunrise into sunset at noon; a polar night without it stays night.
 * docs/systems/daylight.md › Phases, ADR 0141.
 */
import { moonPhase, sunAltitude, sunTimes, type GeoPoint, type SunTimes } from './solar';

export type DayPhase = 'sunrise' | 'midday' | 'sunset' | 'night';
export const PHASES: readonly DayPhase[] = ['sunrise', 'midday', 'sunset', 'night'];
export type PhaseWeights = Record<DayPhase, number>;

const MIN = 60_000;
const DAY = 86_400_000;
/** length of a blend between two phases */
export const BLEND_MS = 40 * MIN;
/** the sunrise light lasts this long after sunrise; the sunset light starts this long before sunset */
export const GOLDEN_MS = 60 * MIN;

export interface Boundary {
  at: number;
  from: DayPhase;
  to: DayPhase;
}

/** What a solar day is when it has no boundaries at all. */
export type DayKind = 'normal' | 'white-nights' | 'polar-day' | 'polar-twilight' | 'polar-night';

export function dayKind(t: SunTimes): DayKind {
  if (t.sunrise !== null && t.sunset !== null) return t.dawn !== null && t.dusk !== null ? 'normal' : 'white-nights';
  if (t.noonAltitude > 0) return 'polar-day';
  return t.dawn !== null && t.dusk !== null ? 'polar-twilight' : 'polar-night';
}

/** The phase boundaries of one solar day, in time order. */
export function dayBoundaries(t: SunTimes): Boundary[] {
  const kind = dayKind(t);
  if (kind === 'polar-day' || kind === 'polar-night') return [];
  if (kind === 'polar-twilight') {
    return [
      { at: t.dawn!, from: 'night', to: 'sunrise' },
      { at: t.noon, from: 'sunrise', to: 'sunset' },
      { at: t.dusk!, from: 'sunset', to: 'night' },
    ];
  }
  // midday always keeps at least one blend's width around solar noon
  const toMidday = Math.min(t.sunrise! + GOLDEN_MS, t.noon - BLEND_MS / 2);
  const fromMidday = Math.max(t.sunset! - GOLDEN_MS, t.noon + BLEND_MS / 2);
  const day: Boundary[] = [
    { at: toMidday, from: 'sunrise', to: 'midday' },
    { at: fromMidday, from: 'midday', to: 'sunset' },
  ];
  if (kind === 'white-nights') {
    // no real night: the evening light turns into the morning light at solar midnight
    return [{ at: t.midnight, from: 'sunset', to: 'sunrise' }, ...day];
  }
  return [{ at: t.dawn!, from: 'night', to: 'sunrise' }, ...day, { at: t.dusk!, from: 'sunset', to: 'night' }];
}

/** Boundaries of yesterday, today and tomorrow (solar days) around `now`. */
export function boundariesAround(now: number, at: GeoPoint): { boundaries: Boundary[]; today: SunTimes } {
  const today = sunTimes(now, at);
  const list: Boundary[] = [];
  for (const k of [-1, 0, 1]) list.push(...dayBoundaries(k === 0 ? today : sunTimes(today.noon + k * DAY, at)));
  list.sort((a, b) => a.at - b.at);
  return { boundaries: list, today };
}

export const NO_WEIGHTS: PhaseWeights = { sunrise: 0, midday: 0, sunset: 0, night: 0 };
export const only = (p: DayPhase): PhaseWeights => ({ ...NO_WEIGHTS, [p]: 1 });

const smooth = (u: number) => {
  const k = u <= 0 ? 0 : u >= 1 ? 1 : u;
  return k * k * (3 - 2 * k);
};

/** A blend between two phases: `t` 0 = all `from`, 1 = all `to`. */
export function blendWeights(from: DayPhase, to: DayPhase, t: number): PhaseWeights {
  const w = { ...NO_WEIGHTS };
  const k = Math.max(0, Math.min(1, t));
  w[from] += 1 - k;
  w[to] += k;
  return w;
}

export interface PhaseAt {
  weights: PhaseWeights;
  /** the dominant phase */
  phase: DayPhase;
  /** the blend in progress, if any (`t` already eased) */
  blend: { from: DayPhase; to: DayPhase; t: number } | null;
}

/**
 * Phase weights at `now` for sorted boundaries. Each boundary blends over `BLEND_MS` centred on
 * it, narrowed to half the gap to a neighbour so overlapping blends never fight. `fallback`
 * applies when there are no boundaries (polar day / night).
 */
export function phaseAt(now: number, boundaries: readonly Boundary[], fallback: DayPhase): PhaseAt {
  if (boundaries.length === 0) return { weights: only(fallback), phase: fallback, blend: null };
  const half = (i: number) => {
    const b = boundaries[i]!;
    let h = BLEND_MS / 2;
    if (i > 0) h = Math.min(h, (b.at - boundaries[i - 1]!.at) / 2);
    if (i < boundaries.length - 1) h = Math.min(h, (boundaries[i + 1]!.at - b.at) / 2);
    return Math.max(1, h);
  };
  let i = -1;
  for (let k = 0; k < boundaries.length; k++) if (boundaries[k]!.at <= now) i = k;
  const make = (b: Boundary, u: number): PhaseAt => {
    const t = smooth(u);
    return { weights: blendWeights(b.from, b.to, t), phase: t < 0.5 ? b.from : b.to, blend: t > 0 && t < 1 ? { from: b.from, to: b.to, t } : null };
  };
  if (i >= 0) {
    const h = half(i);
    if (now - boundaries[i]!.at < h) return make(boundaries[i]!, 0.5 + (now - boundaries[i]!.at) / (2 * h));
  }
  if (i + 1 < boundaries.length) {
    const h = half(i + 1);
    if (boundaries[i + 1]!.at - now < h) return make(boundaries[i + 1]!, 0.5 - (boundaries[i + 1]!.at - now) / (2 * h));
  }
  const p = i >= 0 ? boundaries[i]!.to : boundaries[0]!.from;
  return { weights: only(p), phase: p, blend: null };
}

// ---------------------------------------------------------------------------------------------
// The daylight state shared by the systems that paint with it

export interface DaylightState {
  weights: PhaseWeights;
  phase: DayPhase;
  blend: PhaseAt['blend'];
  /** the sun's altitude (degrees); below −1 it is not drawn */
  sunAltitude: number;
  /** morning sun (rising, from the right of the garden) or afternoon sun (setting, at the left) */
  sunRising: boolean;
  /** 0..1 across the night (dusk → dawn): where the moon is on its arc */
  moonProgress: number;
  /** lunar phase 0..1 (0 new, 0.5 full) */
  moonPhase: number;
  /** today's sun times (null for a pinned phase) */
  times: SunTimes | null;
  /** 0..1: how much of the night light is on (lanterns, fauna rest) */
  night: number;
}

/** Typical sky for a pinned phase: sun altitude and side, moon position. */
const PINNED: Record<DayPhase, { sunAltitude: number; sunRising: boolean; moonProgress: number }> = {
  sunrise: { sunAltitude: 5.5, sunRising: true, moonProgress: 1 },
  midday: { sunAltitude: 58, sunRising: false, moonProgress: 0 },
  sunset: { sunAltitude: 4.5, sunRising: false, moonProgress: 0 },
  night: { sunAltitude: -24, sunRising: false, moonProgress: 0.42 },
};

/** A fixed moon for pinned phases (a waxing gibbous reads best). */
export const PINNED_MOON_PHASE = 0.4;

/** The state for pinned weights (dev `setTime`, studio): typical sun / moon for the mix. */
export function pinnedState(weights: PhaseWeights, blend: PhaseAt['blend'] = null): DaylightState {
  let phase: DayPhase = 'midday';
  for (const p of PHASES) if (weights[p] > weights[phase]) phase = p;
  let alt = 0;
  for (const p of PHASES) alt += weights[p] * PINNED[p].sunAltitude;
  // the moon is near the end of its arc at dawn, near its start at dusk
  const moonProgress = weights.sunrise > 0 ? 0.9 : weights.sunset > 0 ? 0.1 : PINNED.night.moonProgress;
  return {
    weights,
    phase,
    blend,
    sunAltitude: alt,
    sunRising: weights.sunrise >= weights.sunset && weights.sunrise > 0,
    moonProgress,
    moonPhase: PINNED_MOON_PHASE,
    times: null,
    night: weights.night,
  };
}

/** The live state at `now` and `at`. */
export function daylightAt(now: number, at: GeoPoint): DaylightState {
  const { boundaries, today } = boundariesAround(now, at);
  const kind = dayKind(today);
  const fallback: DayPhase = kind === 'polar-day' || kind === 'white-nights' ? 'midday' : 'night';
  const p = phaseAt(now, boundaries, fallback);
  const alt = sunAltitude(now, at);
  // the moon crosses the sky between the evening's dusk and the next dawn
  const dusk = [...boundaries].reverse().find((b) => b.to === 'night' && b.at <= now)?.at ?? null;
  const dawn = dusk === null ? null : (boundaries.find((b) => b.from === 'night' && b.at > dusk)?.at ?? null);
  const moonProgress = dusk !== null && dawn !== null ? Math.max(0, Math.min(1, (now - dusk) / (dawn - dusk))) : 0.5;
  return {
    weights: p.weights,
    phase: p.phase,
    blend: p.blend,
    sunAltitude: alt,
    sunRising: now < today.noon,
    moonProgress,
    moonPhase: moonPhase(now),
    times: today,
    night: p.weights.night,
  };
}

// ---------------------------------------------------------------------------------------------
// setTime: pinned phases, blends, hours

export type PhaseName = DayPhase;
/** v1 names kept as aliases (ADR 0141) */
export type LegacyTimeName = 'morning' | 'noon' | 'evening' | 'dusk' | 'dawn';
export type TimeOverride =
  | DayPhase
  | LegacyTimeName
  | number
  | { from: DayPhase; to: DayPhase; t: number }
  | null;

/** A parsed override: pinned weights, or an hour of today (to run through the sun times). */
export type ParsedOverride = { kind: 'pinned'; weights: PhaseWeights; blend: PhaseAt['blend']; label: string } | { kind: 'hour'; hour: number; label: string };

const ALIASES: Record<LegacyTimeName, { from: DayPhase; to: DayPhase; t: number }> = {
  morning: { from: 'sunrise', to: 'sunrise', t: 1 },
  noon: { from: 'midday', to: 'midday', t: 1 },
  evening: { from: 'sunset', to: 'sunset', t: 1 },
  dusk: { from: 'sunset', to: 'night', t: 0.5 },
  dawn: { from: 'night', to: 'sunrise', t: 0.5 },
};

const isPhase = (v: unknown): v is DayPhase => typeof v === 'string' && (PHASES as readonly string[]).includes(v);

/**
 * Validate a `setTime` argument: a phase (`'sunrise' | 'midday' | 'sunset' | 'night'`), a v1
 * alias (`'morning'`, `'noon'`, `'evening'`, `'dusk'`, `'dawn'`), a blend
 * `{ from, to, t }`, an hour 0–24 of today, or null (follow the clock). Throws on anything else.
 */
export function parseTimeOverride(value: unknown): ParsedOverride | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const hour = ((value % 24) + 24) % 24;
    return { kind: 'hour', hour, label: `${hour}h` };
  }
  if (isPhase(value)) return { kind: 'pinned', weights: only(value), blend: null, label: value };
  if (typeof value === 'string' && value in ALIASES) {
    const a = ALIASES[value as LegacyTimeName];
    const t = a.from === a.to ? 1 : a.t;
    return { kind: 'pinned', weights: blendWeights(a.from, a.to, t), blend: a.from === a.to ? null : { ...a }, label: value };
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as { from?: unknown; to?: unknown; t?: unknown };
    if (isPhase(o.from) && isPhase(o.to) && typeof o.t === 'number' && Number.isFinite(o.t)) {
      const t = Math.max(0, Math.min(1, o.t));
      return { kind: 'pinned', weights: blendWeights(o.from, o.to, t), blend: t > 0 && t < 1 ? { from: o.from, to: o.to, t } : null, label: `${o.from}>${o.to}@${t}` };
    }
  }
  throw new TypeError(`setTime expects ${[...PHASES, ...Object.keys(ALIASES)].join('|')}|{from,to,t}|hour|null, got ${String(value)}`);
}

/** Epoch ms of `hour` (local time of the machine) on the day of `now`. */
export function atLocalHour(now: number, hour: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + hour * 3_600_000;
}

/** The state for an override (or the live one for null). */
export function daylightFor(now: number, at: GeoPoint, override: ParsedOverride | null): DaylightState {
  if (!override) return daylightAt(now, at);
  if (override.kind === 'hour') return daylightAt(atLocalHour(now, override.hour), at);
  return pinnedState(override.weights, override.blend);
}

/** Squared distance between two weight sets (repaint thresholds). */
/** The phase that follows `p` in a normal day (what to paint ahead of time). */
export function nextPhase(p: DayPhase): DayPhase {
  return PHASES[(PHASES.indexOf(p) + 1) % PHASES.length]!;
}

/**
 * Run `fn` when the browser is idle (or soon, without requestIdleCallback): painting the next
 * phase's plates ahead of its blend so the change never costs a frame.
 */
export function whenIdle(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 20_000 });
  else setTimeout(fn, 1500);
}

export function weightDistance(a: PhaseWeights, b: PhaseWeights): number {
  let d = 0;
  for (const p of PHASES) d += (a[p] - b[p]) ** 2;
  return d;
}
