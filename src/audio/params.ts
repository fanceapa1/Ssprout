import type { Weather } from '../core/state';
import { SCENERIES, selectedMix, levelsWith, SOUND_LAYERS, STANDARD_LAYERS, type SoundSceneryId, type SoundLayer, type SoundLevels, type SoundscapeSettings } from '../core/soundscape';

/**
 * Pure parameter mapping: garden situation (time of day, weather, session activity, unlocked
 * fauna) → mix levels and event rates. No Web Audio here; see docs/systems/audio.md › Tuning.
 */

/** Kinds of scheduled one-shot events in the soundscape. `gust` is a wind swell, not a voice. */
export type EventKind = 'plip' | 'chirp' | 'warbler' | 'swallow' | 'cricket' | 'drip' | 'gust' | 'splash' | 'dipper' | 'kajika' |
  'dove' | 'bunting' | 'beeeater' | 'cicada' | 'gecko' | 'frogs';

export const EVENT_KINDS: readonly EventKind[] = ['plip', 'chirp', 'warbler', 'swallow', 'cricket', 'drip', 'gust', 'splash', 'dipper', 'kajika',
  'dove', 'bunting', 'beeeater', 'cicada', 'gecko', 'frogs'];

/** The events that belong to each place; a custom mix never brings another place's voices. */
export const PLACE_EVENTS: Readonly<Record<SoundSceneryId | 'standard', readonly EventKind[]>> = {
  pond: ['plip', 'chirp', 'warbler', 'swallow', 'cricket', 'drip', 'gust'],
  coast: ['chirp', 'warbler', 'swallow', 'drip', 'gust'],
  waterfall: ['splash', 'chirp', 'warbler', 'swallow', 'dipper', 'kajika', 'cricket', 'drip', 'gust'],
  oasis: ['dove', 'bunting', 'beeeater', 'chirp', 'swallow', 'cicada', 'cricket', 'gecko', 'frogs', 'drip', 'gust'],
  standard: ['chirp', 'warbler', 'drip', 'gust'],
};

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
  soundscape?: SoundscapeSettings;
  scenery?: SoundSceneryId;
}

export interface MixParams {
  /** continuous bed levels (linear gain, pre-master) */
  water: number;
  wind: number;
  rain: number;
  extra: SoundLevels;
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
  /** Event channel levels in percent; beds carry their own gains. */
  eventLevels: SoundLevels;
}

export const EVENT_LAYER: Record<EventKind, SoundLayer> = {
  plip: 'water', gust: 'wind', chirp: 'birds', warbler: 'birds', swallow: 'birds', cricket: 'crickets', drip: 'rain',
  splash: 'falls', dipper: 'birds', kajika: 'crickets',
  dove: 'birds', bunting: 'birds', beeeater: 'birds', cicada: 'crickets', gecko: 'crickets', frogs: 'crickets',
};

/** Where a place moves an event to another layer: the oasis's gusts blow through the palms. */
export const PLACE_EVENT_LAYER: Readonly<Partial<Record<SoundSceneryId, Partial<Record<EventKind, SoundLayer>>>>> = {
  oasis: { gust: 'palms' },
};
export const eventLayer = (kind: EventKind, scenery: SoundSceneryId = 'pond'): SoundLayer =>
  PLACE_EVENT_LAYER[scenery]?.[kind] ?? EVENT_LAYER[kind];

/** Overall loudness of the finished mix (master gain into a gentle limiter). Keep it low. */
export const MASTER_LEVEL = 0.8;
/** Master fade in/out, seconds. Never abrupt. */
export const FADE_S = 2;

export const BED = { water: 0.06, wind: 0.032, rain: 0.055 } as const;

/** Events per minute at full activity (before time-of-day, weather and fauna factors). */
export const BASE_RATES: Readonly<Record<EventKind, number>> = {
  plip: 3.5,
  chirp: 1.2,
  warbler: 0.12,
  swallow: 0.9,
  cricket: 7,
  drip: 10,
  gust: 0.5,
  splash: 1.4,
  dipper: 0.3,
  kajika: 0.45,
  dove: 0.7,
  bunting: 0.6,
  beeeater: 0.25,
  cicada: 1.6,
  gecko: 0.4,
  frogs: 0.35,
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
/** The dipper sings by day, most at dawn and again in the late afternoon (winter too). */
export const DIPPER_CURVE: Curve = [
  [0, 0], [4.5, 0], [5.5, 0.5], [7, 1], [11, 0.6], [15, 0.5], [17, 0.8], [18.5, 0.3], [19.5, 0], [24, 0],
];
/** The kajika's chorus: after dusk most, on through the night, rarely by day. */
export const KAJIKA_CURVE: Curve = [
  [0, 0.5], [4, 0.35], [5.5, 0.1], [8, 0.05], [16, 0.08], [18, 0.4], [19.5, 1], [21.5, 0.8], [24, 0.5],
];
/** The laughing dove coos from first light, most in the morning and again before dusk. */
export const DOVE_CURVE: Curve = [
  [0, 0], [5, 0], [6, 0.5], [7.5, 1], [10, 0.8], [13, 0.45], [16, 0.7], [18.5, 0.8], [19.5, 0.2], [20.5, 0], [24, 0],
];
/** The house bunting sings by day, most in the early morning. */
export const BUNTING_CURVE: Curve = [
  [0, 0], [5, 0], [6, 0.6], [8, 1], [11, 0.6], [14, 0.4], [17, 0.6], [19, 0.3], [20, 0], [24, 0],
];
/** Bee-eaters hunt over the grove once the air is warm. */
export const BEEEATER_CURVE: Curve = [
  [0, 0], [7, 0], [9, 0.7], [12, 1], [17, 0.8], [19, 0.2], [20, 0], [24, 0],
];
/** The insect shimmer of the hot middle of the day. */
export const CICADA_CURVE: Curve = [
  [0, 0], [8, 0], [10, 0.4], [12, 0.9], [14, 1], [16, 0.8], [18, 0.3], [19, 0], [24, 0],
];
/** Böhme's gecko clicks only after dark, most in the first hours of the night. */
export const GECKO_CURVE: Curve = [
  [0, 0.8], [4, 0.5], [5.5, 0.05], [6.5, 0], [19, 0], [20, 0.5], [21.5, 1], [24, 0.8],
];
/** The Sahara frogs call from the basin on warm evenings. */
export const FROG_CURVE: Curve = [
  [0, 0.3], [3, 0.1], [6, 0], [17, 0], [19, 0.6], [20.5, 1], [22.5, 0.6], [24, 0.3],
];
/** The desert air: still at night, a breeze from late morning, strongest in the afternoon. */
export const OASIS_WIND_CURVE: Curve = [
  [0, 0.5], [6, 0.45], [10, 0.8], [14, 1], [17, 0.95], [20, 0.7], [24, 0.5],
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

export function mixParams({ hour, weather, activity, fauna, soundscape, scenery = 'pond' }: MixInput): MixParams {
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
    ...(Object.fromEntries(EVENT_KINDS.map((kind) => [kind, 0])) as Record<EventKind, number>),
    plip: BASE_RATES.plip * (rain ? 0.3 : 1) * eventActivity,
    chirp: BASE_RATES.chirp * birds * birdWeather * (smallBirds ? 2.2 : 1) * eventActivity,
    warbler: BASE_RATES.warbler * warblerShare * birdWeather * (smallBirds ? 1.5 : 1) * eventActivity,
    swallow: swallows ? BASE_RATES.swallow * swallowDay * (rain ? 0.2 : 1) * eventActivity : 0,
    cricket: BASE_RATES.cricket * night * (rain ? 0.4 : 1) * eventActivity,
    drip: rain ? BASE_RATES.drip * eventActivity : 0,
    gust: BASE_RATES.gust * windDay * (mist ? 0.5 : 1) * (paused ? 0.3 : 1),
  };

  const mix: MixParams = {
    water: BED.water * (rain ? 0.8 : 1),
    wind: BED.wind * windDay * (mist ? 0.7 : rain ? 1.15 : 1) * (paused ? 0.7 : 1),
    rain: rain ? BED.rain : 0,
    windHz: rain ? 1100 : 750 + 150 * windDay,
    bed: running ? 1.12 : paused ? 0.55 : 1,
    warmthDb: running ? 2.5 : 0,
    airHz: mist ? 2400 : 16000,
    rates,
    eventLevels: levelsWith({ water: 100, wind: 100, birds: 100, crickets: 100, rain: 100 }),
    extra: levelsWith(scenery === 'coast' ? { waves: 75 } : {}),
  };
  const selected = soundscape ? selectedMix(soundscape, scenery) : null;
  if (selected?.mode !== 'custom') {
    if (scenery === 'waterfall') return waterfallMix(mix, { hour, rain, birdWeather, eventActivity, fauna });
    if (scenery === 'oasis') return oasisMix(mix, { hour, rain, mist, paused, birdWeather, eventActivity, fauna });
    return scenery === 'coast' ? { ...mix, water: 0, rates: { ...rates, plip: 0, cricket: 0 } } : mix;
  }
  // Chosen sounds are independent of visual weather, wildlife unlocks and the local hour.
  const standard = soundscape!.collection === 'standard';
  const allowed = new Set<string>(standard ? STANDARD_LAYERS : SCENERIES[scenery].layers);
  const native = new Set<EventKind>(PLACE_EVENTS[standard ? 'standard' : scenery]);
  const levels = Object.fromEntries(SOUND_LAYERS.map((id) => [id, allowed.has(id) ? selected.levels[id] : 0])) as SoundLevels;
  return {
    ...mix,
    water: BED.water * levels.water / 100,
    wind: BED.wind * levels.wind / 100,
    rain: BED.rain * levels.rain / 100,
    windHz: 900,
    airHz: 16000,
    eventLevels: { ...levels },
    extra: { ...levels },
    rates: Object.fromEntries(EVENT_KINDS.map((kind) => [kind,
      levels[eventLayer(kind, standard ? 'pond' : scenery)] === 0 || !native.has(kind) ? 0 : BASE_RATES[kind] * eventActivity * (kind === 'swallow' ? 0 : 1),
    ])) as Record<EventKind, number>,
  };
}

/** `waterfall:<id>` creatures seen there (`faunaSeenKey`, ADR 0240). */
const seenAtFalls = (fauna: ReadonlySet<string>, id: string) => fauna.has(`waterfall:${id}`);

/**
 * The waterfall following the garden (ADR 0283): the falls bed instead of the pond's water, the
 * gorge's wind lower under it, a soft splash now and then, the dipper by day, the kajika after dusk.
 */
function waterfallMix(mix: MixParams, o: { hour: number; rain: boolean; birdWeather: number; eventActivity: number; fauna: ReadonlySet<string> }): MixParams {
  const { hour, rain, birdWeather, eventActivity, fauna } = o;
  const r = mix.rates;
  return {
    ...mix,
    water: 0,
    wind: mix.wind * 0.6,
    extra: levelsWith({ falls: SCENERIES.waterfall.levels.falls }),
    eventLevels: { ...mix.eventLevels, falls: 100 },
    rates: {
      ...r,
      plip: 0,
      // the garden's small birds stay there; the roar hides distant birds, a wagtail adds some back
      chirp: BASE_RATES.chirp * sampleCurve(BIRD_CURVE, hour) * birdWeather * eventActivity * (seenAtFalls(fauna, 'wagtail') ? 1.4 : 0.6),
      warbler: BASE_RATES.warbler * sampleCurve(WARBLER_CURVE, hour) * birdWeather * eventActivity * 0.8,
      swallow: seenAtFalls(fauna, 'iwatsubame') ? BASE_RATES.swallow * sampleCurve(SWALLOW_CURVE, hour) * (rain ? 0.2 : 1) * eventActivity : 0,
      cricket: r.cricket * 0.5,
      gust: r.gust * 0.6,
      splash: BASE_RATES.splash * (rain ? 0.6 : 1) * eventActivity,
      dipper: BASE_RATES.dipper * sampleCurve(DIPPER_CURVE, hour) * birdWeather * eventActivity,
      // frogs call more in the rain
      kajika: seenAtFalls(fauna, 'kajika') ? BASE_RATES.kajika * sampleCurve(KAJIKA_CURVE, hour) * (rain ? 1.3 : 1) * eventActivity : 0,
    },
  };
}

/** `oasis:<id>` creatures seen there (`faunaSeenKey`, ADR 0240). */
const seenAtOasis = (fauna: ReadonlySet<string>, id: string) => fauna.has(`oasis:${id}`);

/**
 * The Ksar oasis following the garden (ADR 0303): the seguia's trickle for water, the palms'
 * dry rustle for wind (gusts swell it), doves and buntings by day, a bee-eater over the grove,
 * a faint midday insect shimmer; after dark crickets, a rare gecko and a distant frog chorus.
 */
function oasisMix(mix: MixParams, o: { hour: number; rain: boolean; mist: boolean; paused: boolean; birdWeather: number; eventActivity: number; fauna: ReadonlySet<string> }): MixParams {
  const { hour, rain, mist, paused, birdWeather, eventActivity, fauna } = o;
  const breeze = sampleCurve(OASIS_WIND_CURVE, hour);
  const day = (curve: Curve) => sampleCurve(curve, hour) * birdWeather * eventActivity;
  const r = mix.rates;
  const { seguia, palms } = SCENERIES.oasis.levels;
  return {
    ...mix,
    water: 0,
    // a little of the open air under the fronds
    wind: mix.wind * 0.6 * breeze,
    extra: levelsWith({ seguia, palms: palms * (0.4 + 0.6 * breeze) * (mist ? 0.7 : rain ? 1.1 : 1) * (paused ? 0.7 : 1) }),
    eventLevels: { ...mix.eventLevels, seguia: 100, palms: 100 },
    rates: {
      ...r,
      plip: 0,
      // the uguisu is a Japanese bird; sparrows chirp in the ksar, fewer than in the garden
      warbler: 0,
      chirp: BASE_RATES.chirp * day(BIRD_CURVE) * 0.5,
      swallow: seenAtOasis(fauna, 'swallows') ? BASE_RATES.swallow * sampleCurve(SWALLOW_CURVE, hour) * (rain ? 0.2 : 1) * eventActivity : 0,
      cricket: r.cricket * 0.8,
      gust: BASE_RATES.gust * breeze * 1.2 * (mist ? 0.5 : 1) * (paused ? 0.3 : 1),
      dove: BASE_RATES.dove * day(DOVE_CURVE) * (seenAtOasis(fauna, 'laughing-dove') ? 1.4 : 1),
      bunting: BASE_RATES.bunting * day(BUNTING_CURVE),
      beeeater: BASE_RATES.beeeater * day(BEEEATER_CURVE) * (rain ? 0 : 1),
      cicada: BASE_RATES.cicada * sampleCurve(CICADA_CURVE, hour) * (rain ? 0 : mist ? 0.5 : 1) * eventActivity,
      gecko: BASE_RATES.gecko * sampleCurve(GECKO_CURVE, hour) * (seenAtOasis(fauna, 'gecko') ? 1.5 : 1) * eventActivity,
      frogs: BASE_RATES.frogs * sampleCurve(FROG_CURVE, hour) * (rain ? 1.3 : 1) * (seenAtOasis(fauna, 'sahara-frog') ? 1.5 : 1) * eventActivity,
    },
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
    SOUND_LAYERS.every((id) => close(a.eventLevels[id], b.eventLevels[id])) &&
    SOUND_LAYERS.every((id) => close(a.extra[id], b.extra[id])) &&
    EVENT_KINDS.every((k) => close(a.rates[k], b.rates[k]))
  );
}
