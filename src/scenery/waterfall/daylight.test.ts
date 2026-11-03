/**
 * The waterfall's daylight (S10, ADR 0247): the lights stay in its open sky in every phase, the
 * plates' washes never reach the plate's lower edge, and the plate keys carry the scenery.
 */
import { describe, expect, it } from 'vitest';
import { lightPlateKey } from '../../ambience/cast';
import { only, PHASES, pinnedState } from '../../ambience/daylight';
import { moonDisc, stars, sunDisc } from '../../ambience/sky-layout';
import { skyPlateKey } from '../../scene/sky-light';
import { WATERFALL } from '.';
import { skylineAt, WATERFALL_SKY_LAYOUT } from './layout';
import { WATERFALL_LIGHT_ART } from './light';
import { plateSky, WATERFALL_SKY, WATERFALL_SKY_RECT, WATERFALL_SUN_SKY, WATERFALL_SUNSET_X } from './sky';
import { createViewport } from '../../render/viewport';

describe('the waterfall daylight', () => {
  it('is wired as the scenery’s sky and light, on one sky layout', () => {
    expect(WATERFALL.sky).toBe(WATERFALL_SKY);
    expect(WATERFALL.light).toBe(WATERFALL_LIGHT_ART);
    expect(WATERFALL.light.sky).toBe(WATERFALL_SUN_SKY);
    expect(WATERFALL_SUN_SKY).toEqual({ ...WATERFALL_SKY_LAYOUT, sunsetX: WATERFALL_SUNSET_X, sunSide: { sunrise: 1, sunset: 1 } });
    expect(WATERFALL.light.shadows).toBeTypeOf('function');
    expect(WATERFALL.light.lights).toBeTypeOf('function');
  });

  it('keeps the sun’s centre and the moon’s whole disc in the open sky in every phase', () => {
    for (const phase of PHASES) {
      const state = pinnedState(only(phase));
      const sun = sunDisc(state, WATERFALL_SUN_SKY);
      if (sun.alpha > 0) expect(sun.y, `${phase} sun`).toBeLessThan(skylineAt(sun.x));
      const moon = moonDisc(state, WATERFALL_SKY_LAYOUT);
      if (moon.alpha > 0) expect(moon.y + moon.r, `${phase} moon`).toBeLessThan(skylineAt(moon.x));
    }
    expect(sunDisc(pinnedState(only('sunrise')), WATERFALL_SUN_SKY).alpha).toBeGreaterThan(0);
    expect(sunDisc(pinnedState(only('sunset')), WATERFALL_SUN_SKY).alpha).toBeGreaterThan(0);
    expect(moonDisc(pinnedState(only('night')), WATERFALL_SKY_LAYOUT).alpha).toBeGreaterThan(0);
    for (let u = 0; u <= 1; u += 0.1) {
      const moon = moonDisc({ ...pinnedState(only('night')), moonProgress: u }, WATERFALL_SKY_LAYOUT);
      expect(moon.y + moon.r, `moon at ${u.toFixed(1)}`).toBeLessThan(skylineAt(moon.x));
    }
  });

  it('keeps the whole setting sun inside a phone’s overview crop (S19)', () => {
    // a deckled paper edge of about 18 CSS px (≈ 28 units at 0.65 px/unit) frames the stage
    const EDGE = 24;
    for (const [w, h] of [[390, 844], [360, 740], [375, 667], [430, 932], [768, 1024]] as const) {
      const vis = createViewport(w, h, 1, WATERFALL.view.focus).visible;
      for (let alt = -3; alt <= 16; alt += 0.25) {
        const sun = sunDisc({ ...pinnedState(only('sunset')), sunAltitude: alt, sunRising: false }, WATERFALL_SUN_SKY);
        if (sun.alpha <= 0.01 || sun.y - sun.r > skylineAt(sun.x)) continue; // faded, or set behind the ridge
        expect(sun.x - sun.r, `${w}×${h} at ${alt}°`).toBeGreaterThanOrEqual(vis.x + EDGE);
        expect(sun.x + sun.r, `${w}×${h} at ${alt}°`).toBeLessThanOrEqual(vis.x + vis.w - EDGE);
      }
    }
  });

  it('reserves its stars in the open sky, on the plate', () => {
    for (const s of stars(30, 'stars', WATERFALL_SKY_LAYOUT)) {
      expect(s.y + s.r * 2, `${s.x}`).toBeLessThan(skylineAt(s.x) - 10);
      expect(s.y).toBeGreaterThan(WATERFALL_SKY_RECT.y);
    }
  });

  it('never lets a sky wash reach the plate’s lower edge (ADR 0206)', () => {
    const bottom = WATERFALL_SKY_RECT.y + WATERFALL_SKY_RECT.h;
    for (const q of plateSky()) expect(q.y, `${q.x}`).toBeLessThan(bottom - 60);
    for (const q of WATERFALL_SKY.shape(40)) expect(q.y, `${q.x}`).toBeLessThan(bottom);
  });

  it('keys its sky and light plates by the waterfall', () => {
    const rect = { x: 0, y: 0, w: 10, h: 10 };
    for (const phase of PHASES) {
      expect(skyPlateKey(WATERFALL.id, WATERFALL.art.seed, phase, { w: 1, h: 1 }, rect, { w: 1, h: 1 })).toContain('waterfall');
      expect(lightPlateKey(WATERFALL.id, 'cast', phase, 1, 1, 'x')).toContain('waterfall');
    }
  });
});
