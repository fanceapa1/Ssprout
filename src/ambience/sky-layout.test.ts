import { describe, expect, it } from 'vitest';
import { gardenScene } from '../scene/geometry';
import { blendWeights, only, pinnedState } from './daylight';
import { castShadow, HORIZON_Y, moonDisc, rimLight, stars, sunDisc } from './sky-layout';

const state = (p: Parameters<typeof only>[0]) => pinnedState(only(p));

describe('the sun', () => {
  it('rises low over the right-hand hills and sets over the left-hand ones', () => {
    const rise = sunDisc(state('sunrise'));
    const set = sunDisc(state('sunset'));
    expect(rise.x).toBeGreaterThan(1000);
    expect(set.x).toBeLessThan(700);
    for (const d of [rise, set]) {
      expect(d.y).toBeLessThan(HORIZON_Y);
      expect(d.y).toBeGreaterThan(HORIZON_Y - 80);
      expect(d.alpha).toBeGreaterThan(0.5);
    }
  });

  it('climbs with its altitude and is gone at midday (overhead) and at night', () => {
    const low = sunDisc({ ...state('sunrise'), sunAltitude: 1 });
    const high = sunDisc({ ...state('sunrise'), sunAltitude: 8 });
    expect(high.y).toBeLessThan(low.y);
    expect(sunDisc(state('midday')).alpha).toBe(0);
    expect(sunDisc(state('night')).alpha).toBe(0);
    expect(sunDisc({ ...state('sunset'), sunAltitude: -5 }).alpha).toBe(0);
  });

  it('its reflection lands on the pond at sunrise and sunset', () => {
    for (const d of [sunDisc(state('sunrise')), sunDisc(state('sunset'))]) {
      const mirror = 2 * gardenScene.waterline - d.y;
      const xs = gardenScene.pond.map((p) => p.x);
      expect(d.x).toBeGreaterThan(Math.min(...xs));
      expect(d.x).toBeLessThan(Math.max(...xs));
      expect(mirror).toBeGreaterThan(gardenScene.waterline);
    }
  });
});

describe('the moon', () => {
  it('is up at night only, and arcs from east (right) to west (left) through the tree gap', () => {
    expect(moonDisc(state('midday')).alpha).toBe(0);
    expect(moonDisc(state('night')).alpha).toBe(1);
    const n = state('night');
    const start = moonDisc({ ...n, moonProgress: 0 });
    const mid = moonDisc({ ...n, moonProgress: 0.5 });
    const end = moonDisc({ ...n, moonProgress: 1 });
    expect(start.x).toBeGreaterThan(mid.x);
    expect(mid.x).toBeGreaterThan(end.x);
    expect(mid.y).toBeLessThan(start.y);
    for (const d of [start, mid, end]) {
      expect(d.x).toBeGreaterThan(680);
      expect(d.x).toBeLessThan(960);
      // below the band a wide canvas crops (cover scaling around the pond: top ≈ 120 at 2:1)
      expect(d.y).toBeGreaterThan(165);
      expect(d.y).toBeLessThan(290);
    }
  });

  it('fades in through the dusk blend', () => {
    const half = moonDisc(pinnedState(blendWeights('sunset', 'night', 0.5)));
    expect(half.alpha).toBeGreaterThan(0);
    expect(half.alpha).toBeLessThan(1);
  });
});

describe('shadows and rims', () => {
  it('shadows fall away from the sun: left at sunrise, right at sunset, short at midday', () => {
    const rise = castShadow(state('sunrise'));
    const set = castShadow(state('sunset'));
    const noon = castShadow(state('midday'));
    expect(rise.dx).toBeLessThan(-1);
    expect(set.dx).toBeGreaterThan(1);
    expect(Math.abs(noon.dx)).toBeLessThan(0.2);
    expect(castShadow(state('night')).alpha).toBeLessThan(noon.alpha / 3);
  });

  it('blends move the shadow continuously', () => {
    const half = castShadow(pinnedState(blendWeights('midday', 'sunset', 0.5)));
    expect(half.dx).toBeGreaterThan(castShadow(state('midday')).dx);
    expect(half.dx).toBeLessThan(castShadow(state('sunset')).dx);
  });

  it('rim light: right and peach at sunrise, left and gold at sunset, none at midday or night', () => {
    expect(rimLight(state('sunrise'))).toMatchObject({ side: 1 });
    expect(rimLight(state('sunset'))).toMatchObject({ side: -1, strength: 1 });
    expect(rimLight(state('midday')).strength).toBe(0);
    expect(rimLight(state('night')).strength).toBe(0);
    const [r, , b] = rimLight(state('sunset')).rgb;
    expect(r).toBeGreaterThan(b);
  });
});

describe('stars', () => {
  it('are a few, seeded, high in the sky and clear of the moon', () => {
    const s = stars();
    expect(s).toEqual(stars());
    expect(s.length).toBe(30);
    for (const st of s) {
      expect(st.y).toBeLessThan(300);
      expect(st.y).toBeGreaterThan(20);
      expect(Math.abs(st.x - 806) < 130 && st.y > 140 && st.y < 300).toBe(false);
    }
  });
});
