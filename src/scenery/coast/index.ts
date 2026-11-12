/**
 * The Greek coast as a scenery (phase 15, G1): draft B's clifftop terraces over an Ionian cove on
 * the scenery contract, with its slots, flora, an empty wildlife table, and placeholder painting,
 * sky and light in a lazy chunk (ADR 0341). Hidden behind `?dev&scenery=coast`.
 * docs/systems/scenery.md › Coast.
 */
import type { LightArt } from '../../ambience/cast';
import type { SceneArt } from '../../scene/background';
import { lazyPainters } from '../painters';
import type { GardenPainters, Scenery, ScenerySky, SceneryView } from '../types';
import { COAST_WILDLIFE } from './fauna';
import { COAST_FLORA } from './flora';
import { coastScene } from './geometry';
import { COAST_AMBIENCE, COAST_HABITAT_WORDS, COAST_SKY_LAYOUT, COAST_SKY_RECT, FOCUS, PATH, openSky } from './layout';

/** Is the coast offered under these URL flags? Only to developers until it is painted. */
export function coastAvailable(flags: URLSearchParams): boolean {
  return flags.has('dev') && flags.get('scenery') === 'coast';
}

/** Its painters (`painters.ts`), loaded the first time one of its paints has to run (ADR 0341). */
export const COAST_PAINTERS = lazyPainters<GardenPainters>(() => import('./painters').then((m) => m?.COAST_PAINTERS_LOADED));

/** The coast's sky: its layout with both low suns on the left over the sea (ADR 0360), and its open-sky shape. */
export const COAST_SKY: ScenerySky = { layout: COAST_SKY_LAYOUT, rect: COAST_SKY_RECT, shape: openSky, painters: COAST_PAINTERS };

/** No trees or shrubs of its own on the light plates yet; its own marks are placeholders. */
export const COAST_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: COAST_SKY_LAYOUT, painters: COAST_PAINTERS };

/**
 * The painting's elements and the placeholder steps each one runs, back to front: the seams the
 * painter tasks swap (rock, water, land and vegetation). The sky is the plates'.
 */
export const COAST_ELEMENTS = {
  far: ['far-hill'],
  sea: ['sea', 'caique'],
  rock: ['village', 'promontory', 'temple'],
  shore: ['shore'],
  beach: ['beach', 'pools'],
  land: ['land', 'walls', 'beds'],
  // the shore's rock over the land's edge and the water: shelf, pool rims, boulders, splash rocks
  stones: ['shore-rocks'],
  trees: ['maquis', 'olive', 'pine'],
  near: ['margins'],
} as const;

export const COAST_ART: SceneArt = {
  scenery: 'coast',
  scene: coastScene,
  trees: [],
  shrubs: [],
  tufts: [],
  foregroundTufts: [],
  seed: 15,
  painters: COAST_PAINTERS,
};

export const COAST_VIEW: SceneryView = {
  focus: FOCUS,
  // the gravel path up the terraces, nearest first (ADR 0202)
  pathOut: PATH,
};

export const COAST: Scenery = {
  id: 'coast',
  name: 'Greek coast',
  blurb: 'Dry-stone terraces under an old olive, stepping down to a turquoise cove below a ruined temple.',
  order: 3,
  available: coastAvailable,
  geometry: coastScene,
  art: COAST_ART,
  sky: COAST_SKY,
  light: COAST_LIGHT_ART,
  ambience: COAST_AMBIENCE,
  view: COAST_VIEW,
  flora: COAST_FLORA,
  habitatWords: COAST_HABITAT_WORDS,
  fauna: COAST_WILDLIFE,
  // waves, wind and birds: the seaside profile that waited for this scenery (ADR 0283)
  sound: 'coast',
  painters: COAST_PAINTERS,
};
