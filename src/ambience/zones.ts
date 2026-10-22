/**
 * Where is the user, roughly? — pure. The garden follows the real sun without asking for a
 * location: the IANA time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) names a city
 * for most people, so a compact table of common zones gives a latitude/longitude good to a few
 * minutes of sunrise. Unknown zones fall back to the longitude implied by the UTC offset
 * (15° per hour) and a mid latitude for the zone's region. No permission prompt, no network.
 * docs/systems/daylight.md › Location, ADR 0140.
 */
import type { GeoPoint } from './solar';

/** Common zones → [lat, lon] of the zone's city (degrees north, east). */
export const ZONES: Readonly<Record<string, readonly [number, number]>> = {
  // Europe
  'Europe/London': [51.51, -0.13],
  'Europe/Dublin': [53.35, -6.26],
  'Europe/Lisbon': [38.72, -9.14],
  'Europe/Madrid': [40.42, -3.7],
  'Europe/Paris': [48.86, 2.35],
  'Europe/Brussels': [50.85, 4.35],
  'Europe/Amsterdam': [52.37, 4.9],
  'Europe/Luxembourg': [49.61, 6.13],
  'Europe/Zurich': [47.38, 8.54],
  'Europe/Berlin': [52.52, 13.4],
  'Europe/Copenhagen': [55.68, 12.57],
  'Europe/Oslo': [59.91, 10.75],
  'Europe/Stockholm': [59.33, 18.07],
  'Europe/Helsinki': [60.17, 24.94],
  'Europe/Tallinn': [59.44, 24.75],
  'Europe/Riga': [56.95, 24.11],
  'Europe/Vilnius': [54.69, 25.28],
  'Europe/Warsaw': [52.23, 21.01],
  'Europe/Prague': [50.08, 14.44],
  'Europe/Vienna': [48.21, 16.37],
  'Europe/Budapest': [47.5, 19.04],
  'Europe/Bratislava': [48.15, 17.11],
  'Europe/Ljubljana': [46.06, 14.51],
  'Europe/Zagreb': [45.81, 15.98],
  'Europe/Belgrade': [44.79, 20.45],
  'Europe/Sarajevo': [43.86, 18.41],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Malta': [35.9, 14.51],
  'Europe/Athens': [37.98, 23.73],
  'Europe/Sofia': [42.7, 23.32],
  'Europe/Bucharest': [44.43, 26.1],
  'Europe/Chisinau': [47.01, 28.86],
  'Europe/Kiev': [50.45, 30.52],
  'Europe/Kyiv': [50.45, 30.52],
  'Europe/Minsk': [53.9, 27.56],
  'Europe/Istanbul': [41.01, 28.98],
  'Europe/Moscow': [55.76, 37.62],
  'Atlantic/Reykjavik': [64.15, -21.94],
  'Atlantic/Canary': [28.12, -15.43],
  'Atlantic/Azores': [37.74, -25.67],
  // Africa & Middle East
  'Africa/Casablanca': [33.57, -7.59],
  'Africa/Algiers': [36.75, 3.06],
  'Africa/Tunis': [36.81, 10.18],
  'Africa/Cairo': [30.04, 31.24],
  'Africa/Lagos': [6.52, 3.38],
  'Africa/Accra': [5.6, -0.19],
  'Africa/Nairobi': [-1.29, 36.82],
  'Africa/Addis_Ababa': [9.03, 38.74],
  'Africa/Johannesburg': [-26.2, 28.05],
  'Asia/Jerusalem': [31.77, 35.21],
  'Asia/Beirut': [33.89, 35.5],
  'Asia/Amman': [31.95, 35.93],
  'Asia/Baghdad': [33.31, 44.36],
  'Asia/Riyadh': [24.71, 46.68],
  'Asia/Dubai': [25.2, 55.27],
  'Asia/Qatar': [25.29, 51.53],
  'Asia/Tehran': [35.69, 51.39],
  // Asia
  'Asia/Karachi': [24.86, 67.0],
  'Asia/Tashkent': [41.3, 69.24],
  'Asia/Almaty': [43.24, 76.89],
  'Asia/Kolkata': [22.57, 88.36],
  'Asia/Calcutta': [22.57, 88.36],
  'Asia/Kathmandu': [27.72, 85.32],
  'Asia/Dhaka': [23.81, 90.41],
  'Asia/Yangon': [16.87, 96.2],
  'Asia/Bangkok': [13.76, 100.5],
  'Asia/Ho_Chi_Minh': [10.82, 106.63],
  'Asia/Jakarta': [-6.21, 106.85],
  'Asia/Kuala_Lumpur': [3.14, 101.69],
  'Asia/Singapore': [1.35, 103.82],
  'Asia/Manila': [14.6, 120.98],
  'Asia/Hong_Kong': [22.32, 114.17],
  'Asia/Shanghai': [31.23, 121.47],
  'Asia/Taipei': [25.03, 121.57],
  'Asia/Seoul': [37.57, 126.98],
  'Asia/Tokyo': [35.68, 139.65],
  'Asia/Vladivostok': [43.12, 131.89],
  // Oceania
  'Australia/Perth': [-31.95, 115.86],
  'Australia/Adelaide': [-34.93, 138.6],
  'Australia/Darwin': [-12.46, 130.84],
  'Australia/Brisbane': [-27.47, 153.03],
  'Australia/Sydney': [-33.87, 151.21],
  'Australia/Melbourne': [-37.81, 144.96],
  'Australia/Hobart': [-42.88, 147.33],
  'Pacific/Auckland': [-36.85, 174.76],
  'Pacific/Honolulu': [21.31, -157.86],
  // Americas
  'America/Anchorage': [61.22, -149.9],
  'America/Vancouver': [49.28, -123.12],
  'America/Los_Angeles': [34.05, -118.24],
  'America/Phoenix': [33.45, -112.07],
  'America/Denver': [39.74, -104.99],
  'America/Edmonton': [53.55, -113.49],
  'America/Winnipeg': [49.9, -97.14],
  'America/Chicago': [41.88, -87.63],
  'America/Mexico_City': [19.43, -99.13],
  'America/Toronto': [43.65, -79.38],
  'America/Detroit': [42.33, -83.05],
  'America/New_York': [40.71, -74.01],
  'America/Halifax': [44.65, -63.57],
  'America/St_Johns': [47.56, -52.71],
  'America/Havana': [23.11, -82.37],
  'America/Bogota': [4.71, -74.07],
  'America/Caracas': [10.48, -66.9],
  'America/Lima': [-12.05, -77.04],
  'America/Santiago': [-33.45, -70.67],
  'America/La_Paz': [-16.5, -68.15],
  'America/Sao_Paulo': [-23.55, -46.63],
  'America/Argentina/Buenos_Aires': [-34.6, -58.38],
  'America/Buenos_Aires': [-34.6, -58.38],
  'America/Montevideo': [-34.9, -56.16],
  // neutral zones: Greenwich
  UTC: [51.48, 0],
  'Etc/UTC': [51.48, 0],
  GMT: [51.48, 0],
  'Etc/GMT': [51.48, 0],
};

/** Mid latitude for a zone's region when the zone is not in the table. */
const REGION_LAT: Readonly<Record<string, number>> = {
  Europe: 48,
  Africa: 5,
  Asia: 30,
  America: 35,
  Australia: -30,
  Pacific: -15,
  Indian: -15,
  Atlantic: 35,
  Antarctica: -75,
  Arctic: 75,
};

/** Latitude used when nothing better is known (a temperate garden). */
export const DEFAULT_LAT = 40;

export interface Location extends GeoPoint {
  /** how it was found: the zone table, or the offset fallback */
  source: 'zone' | 'offset';
  zone: string | null;
}

/**
 * A rough location for a time zone. `utcOffsetMinutes` is the zone's current offset, east
 * positive (e.g. +60 for Paris in winter; note `Date#getTimezoneOffset()` has the opposite sign).
 */
export function locationForZone(zone: string | null | undefined, utcOffsetMinutes: number): Location {
  const known = zone ? ZONES[zone] : undefined;
  if (known) return { lat: known[0], lon: known[1], source: 'zone', zone: zone ?? null };
  const region = zone?.split('/')[0] ?? '';
  const lat = REGION_LAT[region] ?? DEFAULT_LAT;
  const offset = Number.isFinite(utcOffsetMinutes) ? utcOffsetMinutes : 0;
  // 15° of longitude per hour; wrap into ±180
  const lon = ((((offset / 60) * 15 + 180) % 360) + 360) % 360 - 180;
  return { lat, lon, source: 'offset', zone: zone ?? null };
}

/** The browser's zone and current offset (main thread or worker). */
export function browserLocation(epochMs: number): Location {
  let zone: string | null = null;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    zone = null;
  }
  return locationForZone(zone, -new Date(epochMs).getTimezoneOffset());
}
