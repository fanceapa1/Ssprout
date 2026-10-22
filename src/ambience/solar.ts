/**
 * Sun times — pure. NOAA's solar equations (the "General Solar Position Calculations" used by the
 * NOAA Solar Calculator): solar declination and the equation of time from the Julian century,
 * then the hour angle at which the sun's centre crosses a given zenith. Accurate to about a
 * minute away from the poles, which is far more than a painted garden needs.
 *
 * Everything works on epoch milliseconds and a longitude/latitude, with no time zone: the "day"
 * is the local *solar* day around `now` (the one whose solar noon is nearest), so the result does
 * not depend on the machine's zone and is the same in a worker, a test or the browser.
 * docs/systems/daylight.md › Sun times, ADR 0140.
 */

export interface GeoPoint {
  /** degrees north (negative = south) */
  lat: number;
  /** degrees east (negative = west) */
  lon: number;
}

/**
 * The sun's events around one solar noon (epoch ms). A missing event is `null`:
 * - no `sunrise`/`sunset`: the sun never crosses the horizon that day (polar day or night);
 * - no `dawn`/`dusk`: it never reaches 6° below the horizon (white nights, polar day) or never
 *   rises above it (deep polar night).
 */
export interface SunTimes {
  noon: number;
  /** solar midnight before `noon` (12 h earlier) */
  midnight: number;
  dawn: number | null;
  sunrise: number | null;
  sunset: number | null;
  dusk: number | null;
  /** sun altitude at solar noon / midnight (degrees) — tells polar day from polar night */
  noonAltitude: number;
  midnightAltitude: number;
}

const DAY_MS = 86_400_000;
const rad = Math.PI / 180;
const deg = 180 / Math.PI;

/** Zenith of sunrise/sunset: the upper limb on the horizon, with refraction (90° 50′). */
export const ZENITH_SUNRISE = 90.833;
/** Zenith of civil twilight (the sun 6° below the horizon). */
export const ZENITH_CIVIL = 96;

export function julianDay(epochMs: number): number {
  return epochMs / DAY_MS + 2440587.5;
}

/** Declination (degrees) and equation of time (minutes) at an instant. */
export function solarCoordinates(epochMs: number): { declination: number; eqTime: number } {
  const T = (julianDay(epochMs) - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * rad) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const declination = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) * deg;
  const y = Math.tan((eps / 2) * rad) ** 2;
  const eqTime =
    4 *
    deg *
    (y * Math.sin(2 * L0 * rad) -
      2 * e * Math.sin(M * rad) +
      4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
      0.5 * y * y * Math.sin(4 * L0 * rad) -
      1.25 * e * e * Math.sin(2 * M * rad));
  return { declination, eqTime };
}

/** The sun's altitude above the horizon (degrees, geometric — no refraction) at an instant. */
export function sunAltitude(epochMs: number, at: GeoPoint): number {
  const { declination, eqTime } = solarCoordinates(epochMs);
  const utcMinutes = (((epochMs % DAY_MS) + DAY_MS) % DAY_MS) / 60_000;
  const trueSolarMinutes = utcMinutes + eqTime + 4 * at.lon;
  const hourAngle = trueSolarMinutes / 4 - 180;
  const cosZenith =
    Math.sin(at.lat * rad) * Math.sin(declination * rad) + Math.cos(at.lat * rad) * Math.cos(declination * rad) * Math.cos(hourAngle * rad);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) * deg;
}

/** Solar noon (epoch ms) of the solar day nearest `epochMs` at longitude `lon`. */
export function solarNoon(epochMs: number, lon: number): number {
  // the mean-solar-time day containing `now`, then its noon refined by the equation of time
  const day = Math.floor((epochMs + (lon / 360) * DAY_MS) / DAY_MS);
  let noon = day * DAY_MS + (720 - 4 * lon) * 60_000;
  for (let i = 0; i < 2; i++) noon = day * DAY_MS + (720 - 4 * lon - solarCoordinates(noon).eqTime) * 60_000;
  return noon;
}

/**
 * Minutes from solar noon at which the sun crosses `zenith`, or null if it never does that day
 * (`'above'`: always higher, `'below'`: always lower).
 */
export function hourAngleMinutes(declination: number, lat: number, zenith: number): number | 'above' | 'below' {
  const cosH = Math.cos(zenith * rad) / (Math.cos(lat * rad) * Math.cos(declination * rad)) - Math.tan(lat * rad) * Math.tan(declination * rad);
  if (cosH > 1) return 'below';
  if (cosH < -1) return 'above';
  return 4 * Math.acos(cosH) * deg;
}

/** One event: noon ∓ hour angle, refined once with the declination at the event itself. */
function event(noon: number, at: GeoPoint, zenith: number, side: -1 | 1): number | null {
  let h = hourAngleMinutes(solarCoordinates(noon).declination, at.lat, zenith);
  if (typeof h !== 'number') return null;
  const first = noon + side * h * 60_000;
  h = hourAngleMinutes(solarCoordinates(first).declination, at.lat, zenith);
  if (typeof h !== 'number') return null;
  return noon + side * h * 60_000;
}

/** Sunrise, sunset, civil dawn and dusk of the solar day around `epochMs` at `at`. */
export function sunTimes(epochMs: number, at: GeoPoint): SunTimes {
  // keep latitudes off the exact poles (tan(90°) is infinite); 89.9° behaves the same
  const p = { lat: Math.max(-89.9, Math.min(89.9, at.lat)), lon: at.lon };
  const noon = solarNoon(epochMs, p.lon);
  return {
    noon,
    midnight: noon - DAY_MS / 2,
    dawn: event(noon, p, ZENITH_CIVIL, -1),
    sunrise: event(noon, p, ZENITH_SUNRISE, -1),
    sunset: event(noon, p, ZENITH_SUNRISE, 1),
    dusk: event(noon, p, ZENITH_CIVIL, 1),
    noonAltitude: sunAltitude(noon, p),
    midnightAltitude: sunAltitude(noon - DAY_MS / 2, p),
  };
}

/**
 * Moon phase 0..1 (0 = new, 0.5 = full) from the mean synodic month — good to about a day, all a
 * painted moon needs.
 */
export function moonPhase(epochMs: number): number {
  const SYNODIC = 29.530588853;
  const KNOWN_NEW = 2451550.1; // 2000-01-06 18:14 UTC
  const k = (julianDay(epochMs) - KNOWN_NEW) / SYNODIC;
  return ((k % 1) + 1) % 1;
}
