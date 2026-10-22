import { describe, expect, it } from 'vitest';
import { browserLocation, DEFAULT_LAT, locationForZone, ZONES } from './zones';

describe('locationForZone', () => {
  it('knows common zones', () => {
    expect(locationForZone('Europe/London', 0)).toMatchObject({ lat: 51.51, lon: -0.13, source: 'zone' });
    expect(locationForZone('Asia/Tokyo', 540)).toMatchObject({ source: 'zone' });
    expect(locationForZone('Australia/Sydney', 600).lat).toBeLessThan(-30);
    expect(locationForZone('America/New_York', -300).lon).toBeLessThan(-70);
  });

  it('every table entry is a plausible point on Earth', () => {
    for (const [zone, [lat, lon]] of Object.entries(ZONES)) {
      expect(Math.abs(lat), zone).toBeLessThanOrEqual(90);
      expect(Math.abs(lon), zone).toBeLessThanOrEqual(180);
    }
  });

  it('falls back to the longitude of the UTC offset and a mid latitude of the region', () => {
    const l = locationForZone('Europe/Nowhere', 120);
    expect(l.source).toBe('offset');
    expect(l.lon).toBeCloseTo(30, 6);
    expect(l.lat).toBeGreaterThan(40);
    expect(locationForZone('America/Somewhere', -360).lon).toBeCloseTo(-90, 6);
    expect(locationForZone('Australia/Somewhere', 570).lat).toBeLessThan(0); // southern hemisphere
    expect(locationForZone('Pacific/Kiritimati', 840).lon).toBeCloseTo(-150, 6); // +14 h wraps west
  });

  it('copes with no zone at all', () => {
    const l = locationForZone(null, 0);
    expect(l).toMatchObject({ lat: DEFAULT_LAT, lon: 0, source: 'offset', zone: null });
    expect(locationForZone(undefined, Number.NaN).lon).toBe(0);
  });

  it('browserLocation reads the runtime zone without asking for anything', () => {
    const l = browserLocation(Date.parse('2024-06-21T12:00:00Z'));
    expect(Number.isFinite(l.lat)).toBe(true);
    expect(Number.isFinite(l.lon)).toBe(true);
  });
});
