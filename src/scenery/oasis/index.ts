/**
 * The Ksar oasis as a scenery (phase 13): its slots, flora, wildlife, sky and light on the scenery
 * contract, with its painters (O2–O5, `painters.ts`) and motion (O6) in lazy chunks (ADR 0341).
 * Offered to everyone since its release (O8).
 * docs/systems/scenery.md › Oasis.
 */
import type { LightArt } from '../../ambience/cast';
import type { SceneArt } from '../../scene/background';
import { lazyPainters } from '../painters';
import type { GardenPainters, Scenery, ScenerySky, SceneryView } from '../types';
import { OASIS_WILDLIFE } from './wildlife';
import { OASIS_FLORA } from './flora';
import { oasisScene } from './geometry';
import { FOCUS, FOOTPATH, OASIS_AMBIENCE, OASIS_GRADES, OASIS_HABITAT_WORDS, OASIS_SKY_LAYOUT, OASIS_SKY_RECT, openSky } from './layout';

/** Its painters (`painters.ts`), loaded the first time one of its paints has to run (ADR 0341). */
export const OASIS_PAINTERS = lazyPainters<GardenPainters>(() => import('./painters').then((m) => m?.OASIS_PAINTERS_LOADED));

/** The oasis's sky (O5, ADR 0301): its layout with the sun on the right (ADR 0300) and open-sky shape. */
export const OASIS_SKY: ScenerySky = { layout: OASIS_SKY_LAYOUT, rect: OASIS_SKY_RECT, shape: openSky, painters: OASIS_PAINTERS };

/** What its light plates throw shadows from, and its own grades (ADR 0301). */
export const OASIS_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: OASIS_SKY_LAYOUT, grades: OASIS_GRADES, painters: OASIS_PAINTERS };

/**
 * The painting's elements and the steps each one runs, back to front: the land's (O4,
 * `paint-land.ts`), the rock's (O2, `paint-rocks.ts`), the water's (O3, `paint-water.ts`) and the
 * vegetation's (O4, `paint-veg.ts`). The draft (`drafts/a`) is kept as a record only.
 */
export const OASIS_ELEMENTS = {
  far: ['ranges', 'dunes'],
  ground: ['ground', 'terraces', 'plots', 'footpath'],
  grove: ['grove'],
  rock: ['bluff', 'ksar'],
  walls: ['walls'],
  water: ['basin', 'seguia', 'oued'],
  palms: ['big-palms'],
  near: ['foreground', 'margins'],
} as const;

export const OASIS_ART: SceneArt = {
  scenery: 'oasis',
  scene: oasisScene,
  trees: [],
  shrubs: [],
  tufts: [],
  foregroundTufts: [],
  seed: 13,
  painters: OASIS_PAINTERS,
};

export const OASIS_VIEW: SceneryView = {
  focus: FOCUS,
  // the footpath to the basin, nearest first (ADR 0202)
  pathOut: FOOTPATH,
};

export const OASIS: Scenery = {
  id: 'oasis',
  name: 'Ksar oasis',
  blurb: 'Palm terraces under a mud-brick ksar, a stone basin fed by a seguia, and the oued bending past.',
  order: 2,
  available: () => true,
  geometry: oasisScene,
  art: OASIS_ART,
  sky: OASIS_SKY,
  light: OASIS_LIGHT_ART,
  ambience: OASIS_AMBIENCE,
  view: OASIS_VIEW,
  flora: OASIS_FLORA,
  habitatWords: OASIS_HABITAT_WORDS,
  fauna: OASIS_WILDLIFE,
  // the falls, the gate's spill, the inlet's rings and the oued in motion (O6, ADR 0282)
  motion: () => import('./motion').then((m) => m?.createOasisMotion({ seed: OASIS_ART.seed })),
  // the basin is a still mirror: only the inlet's rings move on it (ADR 0302)
  pondSurface: 0,
  // the seguia's trickle, palms in the wind, doves and buntings, a gecko after dark (O7, ADR 0303)
  sound: 'oasis',
  painters: OASIS_PAINTERS,
};
