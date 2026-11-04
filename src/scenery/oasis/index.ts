/**
 * The Ksar oasis as a scenery (phase 13, O1): draft A's painting on the scenery contract, with
 * its slots, flora, wildlife and placeholder sky and light. The painters (O2–O4), daylight (O5),
 * motion (O6) and sound (O7) replace the seams below. Hidden behind `?dev&scenery=oasis`.
 * docs/systems/scenery.md › Oasis.
 */
import { createRng } from '../../core/rng';
import type { PaintStep, SceneArt } from '../../scene/background';
import type { Scenery, SceneryView } from '../types';
import { STEPS as DRAFT_STEPS, paintDraftA } from './drafts/a/paint';
import { OASIS_WILDLIFE } from './fauna';
import { OASIS_FLORA } from './flora';
import { oasisScene } from './geometry';
import { FOCUS, FOOTPATH, OASIS_AMBIENCE, OASIS_HABITAT_WORDS } from './layout';
import { OASIS_LIGHT_ART } from './light';
import { paintBluff, paintKsar } from './paint-rocks';
import { paintBasin, paintOued, paintSeguia } from './paint-water';
import { OASIS_SKY } from './sky';

export { OASIS_LIGHT_ART, OASIS_SKY };

/** Is the oasis offered under these URL flags? Only to developers until it is painted. */
export function oasisAvailable(flags: URLSearchParams): boolean {
  return flags.has('dev') && flags.get('scenery') === 'oasis';
}

/**
 * The painting's elements and the steps each one runs, back to front. The rock is O2's own
 * (`paint-rocks.ts`), the water O3's (`paint-water.ts`); O4 (veg) swaps its element's draft steps the same way.
 */
export const OASIS_ELEMENTS = {
  far: ['ranges', 'dunes'],
  ground: ['ground'],
  grove: ['grove'],
  rock: ['bluff', 'ksar'],
  walls: ['walls'],
  water: ['basin', 'seguia', 'oued'],
  palms: ['big-palms'],
  near: ['edges', 'margins'],
} as const;
type Element = keyof typeof OASIS_ELEMENTS;

/** The paint steps, back to front, on white: the sky plates are multiplied over them. */
export function oasisSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const steps: PaintStep[] = [];
  const own: Record<string, PaintStep['run']> = {
    bluff: (p) => paintBluff(p, createRng(art.seed).fork('rock-bluff')),
    ksar: (p) => paintKsar(p, createRng(art.seed).fork('rock-ksar')),
    basin: (p) => paintBasin(p, createRng(art.seed).fork('water-basin')),
    seguia: (p) => paintSeguia(p, createRng(art.seed).fork('water-seguia')),
    oued: (p) => paintOued(p, createRng(art.seed).fork('water-oued')),
  };
  for (const el of Object.keys(OASIS_ELEMENTS) as Element[]) {
    if (only && !only.includes(el)) continue;
    for (const name of OASIS_ELEMENTS[el]) {
      // the draft forks each step's rng from its seed by name, so a step paints the same alone
      steps.push({ name, soft: el === 'far', run: own[name] ?? ((p) => paintDraftA(p, art.seed, [name])) });
    }
  }
  return steps;
}

/** The draft's steps that are painted (all but its placeholder sky). */
export const OASIS_DRAFT_STEPS: readonly string[] = DRAFT_STEPS.map((s) => s.name).filter((n) => n !== 'sky');

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
  available: oasisAvailable,
  geometry: oasisScene,
  art: OASIS_ART,
  sky: OASIS_SKY,
  light: OASIS_LIGHT_ART,
  ambience: OASIS_AMBIENCE,
  view: OASIS_VIEW,
  flora: OASIS_FLORA,
  habitatWords: OASIS_HABITAT_WORDS,
  fauna: OASIS_WILDLIFE,
  // the pond garden's bed (still water, wind, birds) until O7 makes the oasis's own
  sound: 'pond',
};
