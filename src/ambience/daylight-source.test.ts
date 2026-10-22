import { describe, expect, it } from 'vitest';
import { createDaylightSource, pinnedSource } from './daylight-source';

const LONDON = { lat: 51.51, lon: -0.13 };
const noon = Date.parse('2024-06-21T12:00:00Z');

describe('the shared daylight source', () => {
  it('follows the clock at its location', () => {
    const d = createDaylightSource({ location: LONDON });
    expect(d.at(noon).phase).toBe('midday');
    expect(d.at(Date.parse('2024-06-21T23:00:00Z')).phase).toBe('night');
  });

  it('caches per second of clock time and recomputes after a change', () => {
    const d = createDaylightSource({ location: LONDON });
    const a = d.at(noon);
    expect(d.at(noon + 400)).toBe(a);
    expect(d.at(noon + 1500)).not.toBe(a);
    const v = d.version;
    d.setOverride('sunset');
    expect(d.version).toBe(v + 1);
    expect(d.at(noon + 1500).phase).toBe('sunset');
    expect(d.override()?.label).toBe('sunset');
    d.setOverride(null);
    expect(d.at(noon + 1500).phase).toBe('midday');
  });

  it('rejects bad overrides without changing anything', () => {
    const d = createDaylightSource({ location: LONDON });
    expect(() => d.setOverride('teatime' as never)).toThrow(TypeError);
    expect(d.override()).toBeNull();
  });

  it('guesses its location from the time zone unless one is set', () => {
    const d = createDaylightSource();
    expect(Number.isFinite(d.location(noon).lat)).toBe(true);
    d.setLocation({ lat: -33.87, lon: 151.21 });
    expect(d.location(noon).lat).toBeCloseTo(-33.87, 6);
    // Sydney at 12:00 UTC is 22:00 local: night
    expect(d.at(noon).phase).toBe('night');
  });

  it('a pinned source always reports its phase', () => {
    expect(pinnedSource('sunrise').at(0).phase).toBe('sunrise');
    expect(pinnedSource().at(noon).weights.midday).toBe(1);
  });
});
