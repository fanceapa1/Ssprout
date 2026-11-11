/**
 * The rocky waterfall as a scenery (phase 10): its rock (S6), water (S7), vegetation (S8) and
 * daylight (S10: sky and light plates) and moving falls (S9), its painters and falls in lazy
 * chunks (ADR 0341). Offered to everyone since S17.
 * docs/systems/scenery.md › Waterfall.
 */
import type { LightArt } from '../../ambience/cast';
import type { SceneArt } from '../../scene/background';
import { lazyPainters } from '../painters';
import type { GardenPainters, Scenery, ScenerySky, SceneryView } from '../types';
import { WATERFALL_FLORA } from './flora';
import { WATERFALL_WILDLIFE } from './fauna';
import { TRAIL, waterfallScene } from './geometry';
import { FOCUS, openSky, WATERFALL_AMBIENCE, WATERFALL_HABITAT_WORDS, WATERFALL_SKY_RECT, WATERFALL_SUN_SKY } from './layout';

/** Its painters (`painters.ts`), loaded the first time one of its paints has to run (ADR 0341). */
export const WATERFALL_PAINTERS = lazyPainters<GardenPainters>(() => import('./painters').then((m) => m?.WATERFALL_PAINTERS_LOADED));

/** The waterfall's sky: its layout and open-sky shape (ADR 0241, 0247). */
export const WATERFALL_SKY: ScenerySky = { layout: WATERFALL_SUN_SKY, rect: WATERFALL_SKY_RECT, shape: openSky, painters: WATERFALL_PAINTERS };

/** What its light plates throw shadows from (the rock's own marks are in its painters). */
export const WATERFALL_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: WATERFALL_SUN_SKY, painters: WATERFALL_PAINTERS };


export const WATERFALL_ART: SceneArt = {
  scenery: 'waterfall',
  scene: waterfallScene,
  trees: [],
  shrubs: [],
  tufts: [],
  foregroundTufts: [],
  seed: 11,
  painters: WATERFALL_PAINTERS,
};

export const WATERFALL_VIEW: SceneryView = {
  focus: FOCUS,
  // the stepping stones' near edges, nearest first (ADR 0202)
  pathOut: TRAIL.map((s) => ({ x: s.x, y: s.y + s.ry })),
};

export const WATERFALL: Scenery = {
  id: 'waterfall',
  name: 'Rocky waterfall',
  blurb: 'Falls over mossy ledges into a plunge pool, and a stream winding down to you.',
  order: 1,
  available: () => true,
  geometry: waterfallScene,
  art: WATERFALL_ART,
  sky: WATERFALL_SKY,
  light: WATERFALL_LIGHT_ART,
  ambience: WATERFALL_AMBIENCE,
  view: WATERFALL_VIEW,
  flora: WATERFALL_FLORA,
  habitatWords: WATERFALL_HABITAT_WORDS,
  fauna: WATERFALL_WILDLIFE,
  sound: 'waterfall',
  painters: WATERFALL_PAINTERS,
  // the falls, foam and spray in motion (S9, ADR 0282)
  motion: () => import('./falls').then((m) => m?.createFallsMotion({ seed: WATERFALL_ART.seed })),
};
