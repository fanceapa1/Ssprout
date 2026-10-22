import { describe, expect, it } from 'vitest';
import { hourAngleMinutes, moonPhase, solarNoon, sunAltitude, sunTimes } from './solar';

const MIN = 60_000;
/** minutes between an epoch time and an ISO time (both UTC) */
const off = (t: number | null, iso: string) => (t === null ? Infinity : Math.abs(t - Date.parse(iso)) / MIN);

const LONDON = { lat: 51.51, lon: -0.13 };
const NEW_YORK = { lat: 40.71, lon: -74.01 };
const TOKYO = { lat: 35.68, lon: 139.65 };
const SYDNEY = { lat: -33.87, lon: 151.21 };
const TROMSO = { lat: 69.65, lon: 18.96 };
const LONGYEARBYEN = { lat: 78.22, lon: 15.63 };

describe('sun times for known cities (NOAA / timeanddate, ±3 min)', () => {
  it('London, midsummer: sunrise 04:43, sunset 21:21 BST; civil twilight 03:56–22:09', () => {
    const t = sunTimes(Date.parse('2024-06-21T12:00:00Z'), LONDON);
    expect(off(t.sunrise, '2024-06-21T03:43Z')).toBeLessThan(3);
    expect(off(t.sunset, '2024-06-21T20:21Z')).toBeLessThan(3);
    expect(off(t.dawn, '2024-06-21T02:56Z')).toBeLessThan(4);
    expect(off(t.dusk, '2024-06-21T21:09Z')).toBeLessThan(4);
  });

  it('London, midwinter: sunrise 08:04, sunset 15:53', () => {
    const t = sunTimes(Date.parse('2024-12-21T12:00:00Z'), LONDON);
    expect(off(t.sunrise, '2024-12-21T08:04Z')).toBeLessThan(3);
    expect(off(t.sunset, '2024-12-21T15:53Z')).toBeLessThan(3);
  });

  it('New York, midwinter: 07:16 → 16:32 EST', () => {
    const t = sunTimes(Date.parse('2024-12-21T17:00:00Z'), NEW_YORK);
    expect(off(t.sunrise, '2024-12-21T12:16Z')).toBeLessThan(3);
    expect(off(t.sunset, '2024-12-21T21:32Z')).toBeLessThan(3);
  });

  it('Tokyo, equinox: 05:45 → 17:53 JST', () => {
    const t = sunTimes(Date.parse('2024-03-20T03:00:00Z'), TOKYO);
    expect(off(t.sunrise, '2024-03-19T20:45Z')).toBeLessThan(3);
    expect(off(t.sunset, '2024-03-20T08:53Z')).toBeLessThan(3);
  });

  it('Sydney, southern midwinter: 07:00 → 16:54 AEST', () => {
    const t = sunTimes(Date.parse('2024-06-21T02:00:00Z'), SYDNEY);
    expect(off(t.sunrise, '2024-06-20T21:00Z')).toBeLessThan(3);
    expect(off(t.sunset, '2024-06-21T06:54Z')).toBeLessThan(3);
  });

  it('events come in order: dawn < sunrise < noon < sunset < dusk', () => {
    for (const [at, iso] of [[LONDON, '2024-06-21T12:00Z'], [SYDNEY, '2024-12-21T02:00Z'], [TOKYO, '2024-09-22T03:00Z']] as const) {
      const t = sunTimes(Date.parse(iso), at);
      expect(t.dawn!).toBeLessThan(t.sunrise!);
      expect(t.sunrise!).toBeLessThan(t.noon);
      expect(t.noon).toBeLessThan(t.sunset!);
      expect(t.sunset!).toBeLessThan(t.dusk!);
    }
  });
});

describe('the solar day', () => {
  it('is the one whose noon is nearest, whatever the hour', () => {
    const noon = sunTimes(Date.parse('2024-06-21T12:00:00Z'), LONDON).noon;
    for (const h of ['00:30', '06:00', '18:00', '23:30']) {
      expect(sunTimes(Date.parse(`2024-06-21T${h}:00Z`), LONDON).noon).toBe(noon);
    }
  });

  it('solar noon moves 4 minutes per degree of longitude (no time zone involved)', () => {
    const t = Date.parse('2024-03-20T12:00:00Z');
    expect((solarNoon(t, 0) - solarNoon(t, 15)) / MIN).toBeCloseTo(60, 0);
  });

  it('the sun stands at 90° − |lat − declination| at noon', () => {
    const t = sunTimes(Date.parse('2024-03-20T12:00:00Z'), { lat: 30, lon: 0 });
    expect(t.noonAltitude).toBeCloseTo(60, 0);
    expect(sunAltitude(t.noon, { lat: 30, lon: 0 })).toBeCloseTo(t.noonAltitude, 6);
    expect(t.midnightAltitude).toBeLessThan(-50);
  });
});

describe('polar edge cases', () => {
  it('polar day (Tromsø, midsummer): no sunrise, sunset or twilight; the sun stays up', () => {
    const t = sunTimes(Date.parse('2024-06-21T11:00:00Z'), TROMSO);
    expect([t.dawn, t.sunrise, t.sunset, t.dusk]).toEqual([null, null, null, null]);
    expect(t.midnightAltitude).toBeGreaterThan(0);
  });

  it('polar night with civil twilight (Tromsø, midwinter): dawn and dusk, no sunrise', () => {
    const t = sunTimes(Date.parse('2024-12-21T11:00:00Z'), TROMSO);
    expect(t.sunrise).toBeNull();
    expect(t.sunset).toBeNull();
    expect(t.dawn).not.toBeNull();
    expect(t.dusk).not.toBeNull();
    expect(t.noonAltitude).toBeLessThan(0);
    expect(t.noonAltitude).toBeGreaterThan(-6);
  });

  it('deep polar night (Svalbard, midwinter): nothing at all', () => {
    const t = sunTimes(Date.parse('2024-12-21T11:00:00Z'), LONGYEARBYEN);
    expect([t.dawn, t.sunrise, t.sunset, t.dusk]).toEqual([null, null, null, null]);
    expect(t.noonAltitude).toBeLessThan(-6);
  });

  it('the exact poles do not blow up', () => {
    const t = sunTimes(Date.parse('2024-06-21T12:00:00Z'), { lat: 90, lon: 0 });
    expect(Number.isFinite(t.noon)).toBe(true);
    expect(t.sunrise).toBeNull();
  });

  it('hourAngleMinutes reports always-above / always-below', () => {
    expect(hourAngleMinutes(23.4, 80, 90.833)).toBe('above');
    expect(hourAngleMinutes(-23.4, 80, 90.833)).toBe('below');
    expect(typeof hourAngleMinutes(0, 0, 90.833)).toBe('number');
  });
});

describe('moon phase', () => {
  it('is near 0 at a known new moon and near 0.5 at a known full moon', () => {
    const nm = moonPhase(Date.parse('2024-04-08T18:21:00Z'));
    expect(Math.min(nm, 1 - nm)).toBeLessThan(0.03);
    expect(moonPhase(Date.parse('2024-04-23T23:49:00Z'))).toBeCloseTo(0.5, 1);
  });
});
