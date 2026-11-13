import { describe, expect, it } from 'vitest';
import { defaultSoundscape, levelsWith, silentLevels } from '../core/soundscape';
import {
  BEEEATER_CURVE,
  BIRD_CURVE,
  BUNTING_CURVE,
  CICADA_CURVE,
  CRICKET_CURVE,
  DOVE_CURVE,
  EVENT_KINDS,
  FROG_CURVE,
  GECKO_CURVE,
  OASIS_WIND_CURVE,
  PLACE_EVENTS,
  eventLayer,
  localHour,
  mixParams,
  sameMix,
  sampleCurve,
  wrapHour,
  type MixInput,
} from './params';

const base: MixInput = {
  hour: 12,
  weather: null,
  activity: { sessionActive: false, paused: false },
  fauna: new Set(),
};
const at = (patch: Partial<MixInput>) => mixParams({ ...base, ...patch });

describe('time-of-day curves', () => {
  it('wraps hours into [0, 24)', () => {
    expect(wrapHour(25)).toBe(1);
    expect(wrapHour(-1)).toBe(23);
    expect(wrapHour(Number.NaN)).toBe(12);
  });

  it('interpolates linearly between points and wraps midnight', () => {
    expect(sampleCurve([[0, 0], [10, 1], [24, 0]], 5)).toBeCloseTo(0.5);
    expect(sampleCurve(BIRD_CURVE, 24 + 6.5)).toBeCloseTo(sampleCurve(BIRD_CURVE, 6.5));
  });

  it('every curve stays within [0, 1] and is continuous across midnight', () => {
    for (const curve of [BIRD_CURVE, CRICKET_CURVE, DOVE_CURVE, BUNTING_CURVE, BEEEATER_CURVE, CICADA_CURVE, GECKO_CURVE, FROG_CURVE, OASIS_WIND_CURVE]) {
      expect(curve[0]![1]).toBeCloseTo(curve[curve.length - 1]![1]);
      for (let h = 0; h < 24; h += 0.25) {
        const v = sampleCurve(curve, h);
        expect(v).toBeGreaterThanOrEqual(-1e-12);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reads the local hour from an epoch instant', () => {
    const d = new Date(2026, 3, 1, 7, 30, 0);
    expect(localHour(d.getTime())).toBeCloseTo(7.5);
  });
});

describe('mixParams', () => {
  it('has more birds in the morning than at noon, and almost none at night', () => {
    const morning = at({ hour: 7 }).rates.chirp;
    const noon = at({ hour: 13 }).rates.chirp;
    const night = at({ hour: 1 }).rates.chirp;
    expect(morning).toBeGreaterThan(noon);
    expect(noon).toBeGreaterThan(night * 5);
  });

  it('sings the bush warbler mostly in the morning', () => {
    expect(at({ hour: 6.5 }).rates.warbler).toBeGreaterThan(at({ hour: 15 }).rates.warbler * 3);
    expect(at({ hour: 22 }).rates.warbler).toBe(0);
  });

  it('has crickets at night only', () => {
    expect(at({ hour: 23 }).rates.cricket).toBeGreaterThan(0);
    expect(at({ hour: 12 }).rates.cricket).toBe(0);
  });

  it('adds birds as fauna unlocks', () => {
    const none = at({ hour: 8 });
    const small = at({ hour: 8, fauna: new Set(['small-birds']) });
    expect(small.rates.chirp).toBeGreaterThan(none.rates.chirp * 2);
    expect(none.rates.swallow).toBe(0);
    expect(at({ hour: 10, fauna: new Set(['swallows']) }).rates.swallow).toBeGreaterThan(0);
    expect(at({ hour: 1, fauna: new Set(['swallows']) }).rates.swallow).toBe(0);
  });

  it('rain brings patter and drips, quietens birds; no rain otherwise', () => {
    const rain = at({ weather: 'rain' });
    expect(rain.rain).toBeGreaterThan(0);
    expect(rain.rates.drip).toBeGreaterThan(0);
    expect(rain.rates.chirp).toBeLessThan(at({}).rates.chirp);
    expect(at({ weather: 'sun' }).rain).toBe(0);
    expect(at({}).rates.drip).toBe(0);
  });

  it('mist muffles everything with a low-pass', () => {
    expect(at({ weather: 'mist' }).airHz).toBeLessThan(at({ weather: 'sun' }).airHz / 4);
  });

  it('a running session is slightly fuller and warmer; paused thins the bed', () => {
    const idle = at({});
    const running = at({ activity: { sessionActive: true, paused: false } });
    const paused = at({ activity: { sessionActive: true, paused: true } });
    expect(running.bed).toBeGreaterThan(idle.bed);
    expect(running.bed).toBeLessThan(idle.bed * 1.25); // "very slightly"
    expect(running.warmthDb).toBeGreaterThan(0);
    expect(paused.bed).toBeLessThan(idle.bed);
    expect(paused.rates.plip).toBeLessThan(idle.rates.plip);
  });

  it('keeps every level low (the whole mix sits quietly)', () => {
    for (const weather of [null, 'sun', 'rain', 'mist'] as const) {
      for (let hour = 0; hour < 24; hour += 3) {
        const m = at({ hour, weather, activity: { sessionActive: true, paused: false } });
        expect(m.water + m.wind + m.rain).toBeLessThan(0.2);
      }
    }
  });
});

describe('sameMix', () => {
  it('notices changes to individual channel gains and Standard beds', () => {
    const s = defaultSoundscape();
    s.collection = 'standard';
    s.standard = levelsWith({ cafe: 45, birds: 20 });
    const a = at({ soundscape: s });
    expect(sameMix(a, at({ soundscape: { ...s, standard: { ...s.standard, cafe: 60 } } }))).toBe(false);
    expect(sameMix(a, at({ soundscape: { ...s, standard: { ...s.standard, birds: 30 } } }))).toBe(false);
  });
  it('ignores sub-percent changes and notices real ones', () => {
    const a = at({ hour: 12 });
    expect(sameMix(null, a)).toBe(false);
    expect(sameMix(a, at({ hour: 12.01 }))).toBe(true);
    expect(sameMix(a, at({ weather: 'mist' }))).toBe(false);
    expect(sameMix(a, at({ fauna: new Set(['small-birds']) }))).toBe(false); // rates only
  });
});

describe('personal mixes', () => {
  it('lets rain, birds and crickets play independently of weather, hour and fauna', () => {
    const s = defaultSoundscape();
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ rain: 80, birds: 40, crickets: 50 }) };
    const a = at({ hour: 12, weather: 'sun', soundscape: s });
    const b = at({ hour: 0, weather: 'mist', soundscape: s });
    expect(a).toEqual(b);
    expect(a.rain).toBeGreaterThan(0);
    expect(a.rates.cricket).toBeGreaterThan(0);
    expect(a.rates.chirp).toBeGreaterThan(0);
    expect(a.rates.plip).toBe(0);
    expect(a.water).toBe(0);
  });
  it('silences all ambience when every layer is zero', () => {
    const s = defaultSoundscape();
    s.collection = 'standard'; s.standard = silentLevels();
    const m = at({ weather: 'rain', soundscape: s });
    expect(m.water + m.wind + m.rain).toBe(0);
    expect(Object.values(m.rates).every((v) => v === 0)).toBe(true);
    expect(Object.values(m.extra).every((v) => v === 0)).toBe(true);
  });
  it('uses the active scenery and excludes sounds from another scenery', () => {
    const s = defaultSoundscape();
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ water: 90, cafe: 100 }) };
    s.sceneries.coast = { mode: 'custom', levels: levelsWith({ sea: 80, waves: 50, water: 100 }) };
    expect(at({ soundscape: s }).extra.cafe).toBe(0);
    const coast = at({ soundscape: s, scenery: 'coast' });
    expect(coast.extra.sea).toBe(80);
    expect(coast.extra.waves).toBe(0);
    expect(coast.water).toBe(0);
    const automatic = at({ scenery: 'coast' });
    expect(automatic.extra.sea).toBeGreaterThan(0);
    expect(automatic.rates.plip).toBe(0);
  });
});

describe('the waterfall (ADR 0283)', () => {
  const falls = (patch: Partial<MixInput> = {}) => at({ scenery: 'waterfall', ...patch });

  it('the falls bed replaces the pond water; no plips, a soft splash now and then', () => {
    const m = falls();
    expect(m.water).toBe(0);
    expect(m.extra.falls).toBe(70);
    expect(m.rates.plip).toBe(0);
    expect(m.rates.splash).toBeGreaterThan(0);
    expect(m.wind).toBeLessThan(at({}).wind);
    const pond = at({});
    expect(pond.extra.falls).toBe(0);
    expect(pond.rates.splash + pond.rates.dipper + pond.rates.kajika).toBe(0);
  });

  it('the dipper sings by day, the kajika after dusk and only once it has been seen there', () => {
    expect(falls({ hour: 7 }).rates.dipper).toBeGreaterThan(falls({ hour: 13 }).rates.dipper);
    expect(falls({ hour: 23 }).rates.dipper).toBe(0);
    expect(falls({ hour: 20 }).rates.kajika).toBe(0);
    const seen = new Set(['waterfall:kajika']);
    expect(falls({ hour: 20, fauna: seen }).rates.kajika).toBeGreaterThan(falls({ hour: 12, fauna: seen }).rates.kajika * 5);
    // a kajika seen in the garden is not one seen at the falls
    expect(falls({ hour: 20, fauna: new Set(['kajika']) }).rates.kajika).toBe(0);
  });

  it('the roar hides distant birds; a wagtail there adds some back, martins bring their twitter', () => {
    expect(falls({ hour: 7 }).rates.chirp).toBeLessThan(at({ hour: 7 }).rates.chirp);
    expect(falls({ hour: 7, fauna: new Set(['waterfall:wagtail']) }).rates.chirp).toBeGreaterThan(falls({ hour: 7 }).rates.chirp);
    expect(falls({ hour: 12 }).rates.swallow).toBe(0);
    expect(falls({ hour: 12, fauna: new Set(['waterfall:iwatsubame']) }).rates.swallow).toBeGreaterThan(0);
  });

  it('rain quietens the splashes and wakes the frogs', () => {
    const seen = new Set(['waterfall:kajika']);
    expect(falls({ weather: 'rain' }).rates.splash).toBeLessThan(falls().rates.splash);
    expect(falls({ hour: 20, weather: 'rain', fauna: seen }).rates.kajika).toBeGreaterThan(falls({ hour: 20, fauna: seen }).rates.kajika);
  });

  it('a custom mix there plays the falls and never brings another place’s voices', () => {
    const s = defaultSoundscape();
    s.sceneries.waterfall = { mode: 'custom', levels: levelsWith({ falls: 80, water: 90, birds: 50, crickets: 40, waves: 60 }) };
    const m = falls({ soundscape: s });
    expect(m.extra.falls).toBe(80);
    expect(m.water).toBe(0);
    expect(m.extra.waves).toBe(0);
    expect(m.rates.plip).toBe(0);
    expect(m.rates.dipper).toBeGreaterThan(0);
    expect(m.rates.kajika).toBeGreaterThan(0);
    // the pond's custom mix keeps its own events: no dipper, no splash
    s.sceneries.pond = { mode: 'custom', levels: levelsWith({ water: 60, birds: 50, crickets: 40, falls: 80 }) };
    const pond = at({ soundscape: s });
    expect(pond.extra.falls).toBe(0);
    expect(pond.rates.dipper + pond.rates.splash + pond.rates.kajika).toBe(0);
  });

  it('every event belongs to some place, and each place lists only known kinds', () => {
    const listed = new Set(Object.values(PLACE_EVENTS).flat());
    for (const kind of EVENT_KINDS) expect(listed.has(kind)).toBe(true);
  });
});

describe('the oasis (ADR 0303)', () => {
  const oasis = (patch: Partial<MixInput> = {}) => at({ scenery: 'oasis', ...patch });
  type Mix = ReturnType<typeof at>;
  const sum = (m: Mix, kinds: readonly (keyof Mix['rates'])[]) => kinds.reduce((s, k) => s + m.rates[k], 0);

  it('the seguia and the palms replace the pond water; no plips, no Japanese warbler', () => {
    const m = oasis();
    expect(m.water).toBe(0);
    expect(m.extra.seguia).toBe(60);
    expect(m.extra.palms).toBeGreaterThan(0);
    expect(m.extra.falls + m.extra.waves).toBe(0);
    expect(m.rates.plip + m.rates.warbler + m.rates.splash + m.rates.dipper + m.rates.kajika).toBe(0);
    // a little of the open air stays under the fronds, so a switch never dips
    expect(m.wind).toBeGreaterThan(0);
    expect(m.wind).toBeLessThan(at({}).wind);
    const pond = at({});
    expect(pond.extra.seguia + pond.extra.palms).toBe(0);
    expect(sum(pond, ['dove', 'bunting', 'beeeater', 'cicada', 'gecko', 'frogs'])).toBe(0);
  });

  it('day voices by day: doves and buntings in the morning, the insect shimmer at midday', () => {
    expect(oasis({ hour: 7.5 }).rates.dove).toBeGreaterThan(oasis({ hour: 13 }).rates.dove);
    expect(oasis({ hour: 7.5 }).rates.bunting).toBeGreaterThan(0);
    expect(oasis({ hour: 13 }).rates.cicada).toBeGreaterThan(oasis({ hour: 9.5 }).rates.cicada * 2);
    expect(oasis({ hour: 13 }).rates.beeeater).toBeGreaterThan(0);
    for (const hour of [23, 2]) expect(sum(oasis({ hour }), ['dove', 'bunting', 'beeeater', 'cicada'])).toBe(0);
  });

  it('night voices after dark: crickets, a rare gecko, a distant frog chorus in the evening', () => {
    const night = oasis({ hour: 22 });
    expect(night.rates.cricket).toBeGreaterThan(0);
    expect(night.rates.gecko).toBeGreaterThan(0);
    expect(night.rates.gecko).toBeLessThan(0.6);
    expect(oasis({ hour: 20.5 }).rates.frogs).toBeGreaterThan(oasis({ hour: 2 }).rates.frogs);
    for (const hour of [9, 13]) expect(sum(oasis({ hour }), ['cricket', 'gecko', 'frogs'])).toBe(0);
    // a gecko seen there clicks a little more often; one seen in the garden does not count
    expect(oasis({ hour: 22, fauna: new Set(['oasis:gecko']) }).rates.gecko).toBeGreaterThan(night.rates.gecko);
    expect(oasis({ hour: 22, fauna: new Set(['gecko']) }).rates.gecko).toBe(night.rates.gecko);
  });

  it('the palms rustle more in the afternoon breeze than in the still night, and gust more often', () => {
    expect(oasis({ hour: 14 }).extra.palms).toBeGreaterThan(oasis({ hour: 2 }).extra.palms);
    expect(oasis({ hour: 14 }).rates.gust).toBeGreaterThan(oasis({ hour: 2 }).rates.gust);
    expect(oasis({ weather: 'mist' }).extra.palms).toBeLessThan(oasis().extra.palms);
    expect(oasis({ activity: { sessionActive: true, paused: true } }).extra.palms).toBeLessThan(oasis().extra.palms);
  });

  it('rain hushes the insects and the bee-eaters and wakes the frogs; the garden’s unlocks stay in the garden', () => {
    expect(oasis({ hour: 13, weather: 'rain' }).rates.cicada).toBe(0);
    expect(oasis({ hour: 13, weather: 'rain' }).rates.beeeater).toBe(0);
    expect(oasis({ hour: 20.5, weather: 'rain' }).rates.frogs).toBeGreaterThan(oasis({ hour: 20.5 }).rates.frogs);
    expect(oasis({ hour: 7, fauna: new Set(['small-birds', 'swallows']) }).rates).toEqual(oasis({ hour: 7 }).rates);
    expect(oasis({ hour: 12, fauna: new Set(['oasis:swallows']) }).rates.swallow).toBeGreaterThan(0);
  });

  it('a custom mix there plays its own beds and voices; gusts follow the palms slider', () => {
    const s = defaultSoundscape();
    s.sceneries.oasis = { mode: 'custom', levels: levelsWith({ seguia: 70, palms: 50, birds: 40, crickets: 30, water: 90, falls: 80 }) };
    const m = oasis({ soundscape: s });
    expect(m.extra.seguia).toBe(70);
    expect(m.extra.palms).toBe(50);
    expect(m.water + m.extra.falls).toBe(0);
    expect(m.rates.gust).toBeGreaterThan(0);
    expect(m.rates.dove + m.rates.gecko).toBeGreaterThan(0);
    expect(m.rates.plip + m.rates.dipper + m.rates.kajika + m.rates.warbler).toBe(0);
    expect(eventLayer('gust', 'oasis')).toBe('palms');
    expect(eventLayer('gust', 'pond')).toBe('wind');
    s.sceneries.oasis.levels.palms = 0;
    expect(oasis({ soundscape: s }).rates.gust).toBe(0);
    // the other places' custom mixes never bring the oasis's voices or beds
    s.sceneries.waterfall = { mode: 'custom', levels: levelsWith({ falls: 60, birds: 50, crickets: 50, seguia: 80, palms: 80 }) };
    const falls = at({ scenery: 'waterfall', soundscape: s });
    expect(falls.extra.seguia + falls.extra.palms).toBe(0);
    expect(sum(falls, ['dove', 'bunting', 'beeeater', 'cicada', 'gecko', 'frogs'])).toBe(0);
  });
});

describe('the coast (ADR 0376)', () => {
  const coast = (patch: Partial<MixInput> = {}) => at({ scenery: 'coast', ...patch });
  type Mix = ReturnType<typeof at>;
  const sum = (m: Mix, kinds: readonly (keyof Mix['rates'])[]) => kinds.reduce((s, k) => s + m.rates[k], 0);
  const coastVoices = ['caique', 'gull', 'goatbell', 'chapel', 'scops'] as const;

  it('the sea replaces the pond water; no plips, warbler or distant chirps; the breeze is lighter and airier', () => {
    const m = coast();
    expect(m.water).toBe(0);
    expect(m.extra.sea).toBe(70);
    expect(m.extra.waves + m.extra.falls + m.extra.seguia + m.extra.palms).toBe(0);
    expect(m.rates.plip + m.rates.warbler + m.rates.chirp + m.rates.dove + m.rates.splash).toBe(0);
    expect(m.wind).toBeGreaterThan(0);
    expect(m.wind).toBeLessThan(at({}).wind);
    expect(m.windHz).toBeGreaterThan(at({}).windHz);
    const pond = at({});
    expect(pond.extra.sea + pond.extra.cicadas).toBe(0);
    expect(sum(pond, coastVoices)).toBe(0);
  });

  it('the cicadas swell toward the hot afternoon, thin at sunrise and sunset, stop at night and in rain', () => {
    const level = (hour: number, patch: Partial<MixInput> = {}) => coast({ hour, ...patch }).extra.cicadas;
    expect(level(14.5)).toBe(30);
    expect(level(14.5)).toBeGreaterThan(level(8) * 4);
    expect(level(14.5)).toBeGreaterThan(level(19) * 3);
    for (const hour of [21, 23, 2, 5.5]) expect(level(hour)).toBe(0);
    expect(level(14.5, { weather: 'rain' })).toBe(0);
    expect(level(14.5, { weather: 'mist' })).toBeLessThan(level(14.5));
    // well under the sea at their loudest
    expect(level(14.5)).toBeLessThan(coast().extra.sea / 2);
    expect(coast({ hour: 14.5, fauna: new Set(['coast:cicada']) }).extra.cicadas).toBeGreaterThan(level(14.5));
  });

  it('day voices by day: a far gull, goat bells, the caique; the chapel bell only at sunset', () => {
    const noon = coast({ hour: 12 });
    expect(noon.rates.gull).toBeGreaterThan(0);
    expect(noon.rates.goatbell).toBeGreaterThan(0);
    expect(noon.rates.caique).toBeGreaterThan(0);
    expect(noon.rates.chapel).toBe(0);
    expect(coast({ hour: 20 }).rates.chapel).toBeGreaterThan(0);
    for (const hour of [8, 12, 16, 23, 3]) expect(coast({ hour }).rates.chapel).toBe(0);
    for (const hour of [23, 2]) expect(coast({ hour }).rates.gull).toBe(0);
    // every voice is rare: under one a minute, the bell far less
    for (const hour of [7, 12, 20, 23]) for (const kind of coastVoices) expect(coast({ hour }).rates[kind]).toBeLessThan(0.6);
    expect(coast({ hour: 20 }).rates.chapel).toBeLessThan(0.02);
  });

  it('night voices after dark: the Scops owl and a few crickets, fewer than in the pond garden', () => {
    const night = coast({ hour: 22 });
    expect(night.rates.scops).toBeGreaterThan(0);
    expect(night.rates.cricket).toBeGreaterThan(0);
    expect(night.rates.cricket).toBeLessThan(at({ hour: 22 }).rates.cricket / 2);
    for (const hour of [9, 13, 17]) expect(coast({ hour }).rates.scops + coast({ hour }).rates.cricket).toBe(0);
    expect(coast({ hour: 22, fauna: new Set(['coast:scops-owl']) }).rates.scops).toBeGreaterThan(night.rates.scops);
    expect(coast({ hour: 22, fauna: new Set(['scops-owl']) }).rates.scops).toBe(night.rates.scops);
  });

  it('rain hushes the owl, the goats and the gulls, rocks the caique and lifts the sea; the garden’s unlocks stay in the garden', () => {
    const wet = (hour: number) => coast({ hour, weather: 'rain' });
    expect(wet(22).rates.scops).toBeLessThan(coast({ hour: 22 }).rates.scops);
    expect(wet(9).rates.goatbell).toBeLessThan(coast({ hour: 9 }).rates.goatbell);
    expect(wet(9).rates.gull).toBeLessThan(coast({ hour: 9 }).rates.gull);
    expect(wet(9).rates.caique).toBeGreaterThan(coast({ hour: 9 }).rates.caique);
    expect(wet(9).extra.sea).toBeGreaterThan(coast({ hour: 9 }).extra.sea);
    expect(wet(9).rain).toBeGreaterThan(0);
    expect(coast({ hour: 7, fauna: new Set(['small-birds', 'swallows']) }).rates).toEqual(coast({ hour: 7 }).rates);
    expect(coast({ hour: 12, fauna: new Set(['coast:swallows']) }).rates.swallow).toBeGreaterThan(0);
    expect(coast({ hour: 9, fauna: new Set(['coast:goats', 'coast:gull']) }).rates.goatbell).toBeGreaterThan(coast({ hour: 9 }).rates.goatbell);
    // a pause holds the breath here too
    const paused = coast({ hour: 14, activity: { sessionActive: true, paused: true } });
    expect(paused.extra.cicadas).toBeLessThan(coast({ hour: 14 }).extra.cicadas);
    expect(paused.rates.caique).toBeLessThan(coast({ hour: 14 }).rates.caique);
  });

  it('a custom mix there plays its own beds and voices, and the other places never bring them', () => {
    const s = defaultSoundscape();
    s.sceneries.coast = { mode: 'custom', levels: levelsWith({ sea: 60, cicadas: 25, birds: 40, crickets: 30, water: 90, seguia: 80 }) };
    const m = coast({ soundscape: s });
    expect(m.extra.sea).toBe(60);
    expect(m.extra.cicadas).toBe(25);
    expect(m.water + m.extra.seguia).toBe(0);
    expect(m.rates.caique + m.rates.gull + m.rates.goatbell + m.rates.scops).toBeGreaterThan(0);
    expect(m.rates.plip + m.rates.dove + m.rates.dipper + m.rates.chirp).toBe(0);
    expect(eventLayer('caique', 'coast')).toBe('sea');
    expect(eventLayer('scops', 'coast')).toBe('crickets');
    s.sceneries.coast.levels.sea = 0;
    expect(coast({ soundscape: s }).rates.caique).toBe(0);
    s.sceneries.oasis = { mode: 'custom', levels: levelsWith({ seguia: 60, birds: 50, crickets: 50, sea: 80, cicadas: 80 }) };
    const oasis = at({ scenery: 'oasis', soundscape: s });
    expect(oasis.extra.sea + oasis.extra.cicadas).toBe(0);
    expect(sum(oasis, coastVoices)).toBe(0);
    expect(PLACE_EVENTS.coast).toEqual(expect.arrayContaining([...coastVoices]));
    for (const kind of coastVoices) expect(EVENT_KINDS).toContain(kind);
  });
});

