/**
 * The Ksar oasis as a scenery (phase 13): its painters (O2–O4) on the scenery contract, with its
 * slots, flora, wildlife and placeholder sky and light. Daylight (O5), motion (O6) and sound (O7)
 * replace the seams below. Offered to everyone since its release (O8).
 * docs/systems/scenery.md › Oasis.
 */
import { createRng } from '../../core/rng';
import type { PaintStep, SceneArt } from '../../scene/background';
import type { Scenery, SceneryView } from '../types';
import { OASIS_WILDLIFE } from './wildlife';
import { OASIS_FLORA } from './flora';
import { oasisScene } from './geometry';
import { FOCUS, FOOTPATH, OASIS_AMBIENCE, OASIS_HABITAT_WORDS } from './layout';
import { OASIS_LIGHT_ART } from './light';
import { createOasisMotion } from './motion';
import { paintDunes, paintFootpath, paintForeground, paintGround, paintPlots, paintRanges, paintTerraces, paintWalls } from './paint-land';
import { paintBluff, paintKsar } from './paint-rocks';
import { paintBasin, paintOued, paintSeguia } from './paint-water';
import { paintBigPalms, paintGrove } from './paint-veg';
import { paintMargins } from '../../scene/paint-land';
import { OASIS_SKY } from './sky';

export { OASIS_LIGHT_ART, OASIS_SKY };

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
type Element = keyof typeof OASIS_ELEMENTS;
type Step = (typeof OASIS_ELEMENTS)[Element][number];

/** The paint steps, back to front, on white: the sky plates are multiplied over them. */
export function oasisSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const r = (label: string) => createRng(art.seed).fork(label);
  const run: Record<Step, PaintStep['run']> = {
    ranges: (p) => paintRanges(p, r('far-ranges')),
    dunes: (p) => paintDunes(p, r('far-dunes')),
    ground: (p) => paintGround(p, r('land-ground')),
    terraces: (p) => paintTerraces(p, r('land-terraces')),
    plots: (p) => paintPlots(p, r('land-plots')),
    footpath: (p) => paintFootpath(p, r('land-footpath')),
    grove: (p) => paintGrove(p, r('veg-grove')),
    bluff: (p) => paintBluff(p, r('rock-bluff')),
    ksar: (p) => paintKsar(p, r('rock-ksar')),
    walls: (p) => paintWalls(p, r('land-walls')),
    basin: (p) => paintBasin(p, r('water-basin')),
    seguia: (p) => paintSeguia(p, r('water-seguia')),
    oued: (p) => paintOued(p, r('water-oued')),
    'big-palms': (p) => paintBigPalms(p, r('veg-big-palms')),
    foreground: (p) => paintForeground(p, r('land-foreground')),
    margins: (p) => paintMargins(p, r('margins')),
  };
  const steps: PaintStep[] = [];
  for (const el of Object.keys(OASIS_ELEMENTS) as Element[]) {
    if (only && !only.includes(el)) continue;
    for (const name of OASIS_ELEMENTS[el]) steps.push({ name, soft: el === 'far' || name === 'margins', run: run[name] });
  }
  return steps;
}

export const OASIS_ART: SceneArt = {
  scenery: 'oasis',
  scene: oasisScene,
  trees: [],
  shrubs: [],
  tufts: [],
  foregroundTufts: [],
  seed: 13,
  steps: oasisSteps,
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
  motion: () => createOasisMotion({ seed: OASIS_ART.seed }),
  // the basin is a still mirror: only the inlet's rings move on it (ADR 0302)
  pondSurface: 0,
  // the seguia's trickle, palms in the wind, doves and buntings, a gecko after dark (O7, ADR 0303)
  sound: 'oasis',
};
