import type { Weather } from '../core/state';

/**
 * Pure parameter mapping: garden situation (time of day, weather, session activity, unlocked
 * fauna) → mix levels and event rates. No Web Audio here; see docs/systems/audio.md › Tuning.
 */

/** Kinds of scheduled one-shot events in the soundscape. `gust` is a wind swell, not a voice. */
export type EventKind = 'plip' | 'chirp' | 'warbler' | 'swallow' | 'cricket' | 'drip' | 'gust';

export const EVENT_KINDS: readonly EventKind[] = ['plip', 'chirp', 'warbler', 'swallow', 'cricket', 'drip', 'gust'];

export interface AudioActivity {
  sessionActive: boolean;
  paused: boolean;
}

export interface MixInput {
  /** local hour, 0 ≤ hour < 24 (fractional; wraps) */
  hour: number;
  weather: Weather | null;
  activity: AudioActivity;
  /** unlocked creature ids, e.g. 'small-birds', 'swallows' */
  fauna: ReadonlySet<string>;
}

export interface MixParams {
  /** continuous bed levels (linear gain, pre-master) */
  water: number;
  wind: number;
  rain: number;
  /** centre of the wind band-pass (Hz) */
  windHz: number;
  /** bed multiplier: session active → a touch fuller, paused → thinner */
  bed: number;
  /** low-shelf boost on the bed (dB): warmth while a session runs */
  warmthDb: number;
  /** low-pass cutoff on everything except chimes (Hz); mist muffles */
  airHz: number;
  /** expected events per minute */
  rates: Record<EventKind, number>;
}

/** Overall loudness of the finished mix (master gain into a gentle limiter). Keep it low. */
export const MASTER_LEVEL = 0.55;
/** Master fade in/out, seconds. Never abrupt. */
export const FADE_S = 2;

export const BED = { water: 0.05, wind: 0.032, rain: 0.055 } as const;

/** Events per minute at full activity (before time-of-day, weather and fauna factors). */
export const BASE_RATES: Readonly<Record<EventKind, number>> = {
  plip: 3.5,
  chirp: 1.2,
  warbler: 0.12,
  swallow: 0.9,
  cricket: 7,
  drip: 10,
  gust: 0.5,
};

type Curve = readonly (readonly [hour: number, value: number])[];

/** Distant bird activity: dawn chorus, quiet afternoon, small evening peak, silent night. */
export const BIRD_CURVE: Curve = [
  [0, 0.02], [4, 0.03], [5, 0.4], [6.5, 1], [8.5, 0.9], [11, 0.5], [14, 0.4],
  [17, 0.55], [19, 0.35], [20.5, 0.05], [24, 0.02],
];
/** Share of the bush warbler's song: mostly mornings. */
export const WARBLER_CURVE: Curve = [
  [0, 0], [5, 0.2], [6.5, 1], [10, 0.6], [13, 0.25], [17, 0.2], [19, 0], [24, 0],
];
/** Swallows hunt in daylight. */
export const SWALLOW_CURVE: Curve = [
  [0, 0], [5, 0], [6, 0.3], [8, 1], [18, 1], [19.5, 0.3], [20.5, 0], [24, 0],
];
/** Crickets: soft trills from dusk until just before dawn. */
export const CRICKET_CURVE: Curve = [
  [0, 1], [4.5, 0.8], [5.5, 0.1], [6.5, 0], [18.5, 0], [19.5, 0.3], [21, 0.9], [24, 1],
];
/** Wind is a little livelier by day. */
export const WIND_CURVE: Curve = [
  [0, 0.75], [6, 0.85], [12, 1], [16, 1], [20, 0.85], [24, 0.75],
];

/** Wrap an hour into [0, 24). */
export function wrapHour(hour: number): number {
  if (!Number.isFinite(hour)) return 12;
  return ((hour % 24) + 24) % 24;
}

/** Piecewise-linear lookup in an hour curve (wraps around midnight). */
export function sampleCurve(curve: Curve, hour: number): number {
  const h = wrapHour(hour);
  for (let i = 1; i < curve.length; i++) {
    const [h1, v1] = curve[i]!;
    const [h0, v0] = curve[i - 1]!;
    if (h <= h1) return h1 === h0 ? v1 : v0 + ((v1 - v0) * (h - h0)) / (h1 - h0);
  }
  return curve[curve.length - 1]![1];
}

/** Local fractional hour of an epoch-ms instant. */
export function localHour(epochMs: number): number {
  const d = new Date(epochMs);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function mixParams({ hour, weather, activity, fauna }: MixInput): MixParams {
  const birds = sampleCurve(BIRD_CURVE, hour);
  const warblerShare = sampleCurve(WARBLER_CURVE, hour);
  const swallowDay = sampleCurve(SWALLOW_CURVE, hour);
  const night = sampleCurve(CRICKET_CURVE, hour);
  const windDay = sampleCurve(WIND_CURVE, hour);

  const smallBirds = fauna.has('small-birds');
  const swallows = fauna.has('swallows');

  const rain = weather === 'rain';
  const mist = weather === 'mist';
  const birdWeather = rain ? 0.35 : mist ? 0.7 : 1;

  const running = activity.sessionActive && !activity.paused;
  const paused = activity.sessionActive && activity.paused;
  /** paused: the garden holds its breath — fewer events, thinner bed */
  const eventActivity = paused ? 0.5 : 1;

  const rates: Record<EventKind, number> = {
    plip: BASE_RATES.plip * (rain ? 0.3 : 1) * eventActivity,
    chirp: BASE_RATES.chirp * birds * birdWeather * (smallBirds ? 2.2 : 1) * eventActivity,
    warbler: BASE_RATES.warbler * warblerShare * birdWeather * (smallBirds ? 1.5 : 1) * eventActivity,
    swallow: swallows ? BASE_RATES.swallow * swallowDay * (rain ? 0.2 : 1) * eventActivity : 0,
    cricket: BASE_RATES.cricket * night * (rain ? 0.4 : 1) * eventActivity,
    drip: rain ? BASE_RATES.drip * eventActivity : 0,
    gust: BASE_RATES.gust * windDay * (mist ? 0.5 : 1) * (paused ? 0.3 : 1),
  };

  return {
    water: BED.water * (rain ? 0.8 : 1),
    wind: BED.wind * windDay * (mist ? 0.7 : rain ? 1.15 : 1) * (paused ? 0.7 : 1),
    rain: rain ? BED.rain : 0,
    windHz: rain ? 1100 : 750 + 150 * windDay,
    bed: running ? 1.12 : paused ? 0.55 : 1,
    warmthDb: running ? 2.5 : 0,
    airHz: mist ? 2400 : 16000,
    rates,
  };
}

/** Are two mixes (levels, filters and event rates) close enough that re-applying is pointless? */
export function sameMix(a: MixParams | null, b: MixParams): boolean {
  if (!a) return false;
  const close = (x: number, y: number) => Math.abs(x - y) <= Math.max(1e-4, Math.abs(y) * 0.01);
  return (
    close(a.water, b.water) &&
    close(a.wind, b.wind) &&
    close(a.rain, b.rain) &&
    close(a.windHz, b.windHz) &&
    close(a.bed, b.bed) &&
    close(a.warmthDb, b.warmthDb) &&
    close(a.airHz, b.airHz) &&
    EVENT_KINDS.every((k) => close(a.rates[k], b.rates[k]))
  );
}
