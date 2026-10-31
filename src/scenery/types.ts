/**
 * The scenery contract (ADR 0241): everything that makes one place to grow a garden, so the
 * systems take their data from the current scenery instead of module constants.
 * docs/systems/scenery.md, docs/ARCHITECTURE.md › Sceneries.
 */
import type { LightArt } from '../ambience/cast';
import type { DayPhase } from '../ambience/daylight';
import type { SceneryFauna } from '../fauna/habitat';
import type { SkyLayout } from '../ambience/sky-layout';
import type { Rng } from '../core/rng';
import type { Painter } from '../paint';
import type { SceneryBiome } from '../plants/flora';
import type { Habitat } from '../plants/types';
import type { Pt, Rect } from '../render/viewport';
import type { SceneArt } from '../scene/background';
import type { SceneGeometry } from '../scene/geometry';
import type { SceneryId } from './ids';

/** A scenery's sky: where the light comes from, and the four painted daylight plates. */
export interface ScenerySky {
  layout: SkyLayout;
  /** the world band the sky plates cover */
  rect: Rect;
  /** the open sky (the sun is clipped to it), with `below` units hanging under its skyline */
  shape(below?: number): Pt[];
  /** one phase's sky, into a painter whose transform maps world units onto the plate */
  paint(p: Painter, rng: Rng, phase: DayPhase): void;
  /** the same sky mirrored into the still water's box (the caller clips it to the water) */
  paintWater(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void;
}

/** Where the weather's ground effects go. */
export interface SceneryAmbience {
  /** boxes the sunrise dew twinkles in, taken in turn */
  dew: readonly Rect[];
  /** which mist bands lie on the water and the far bank at dawn */
  mistBands: readonly number[];
  /** world y the mist's veil fades out by (above the plant zone) */
  veilTo: number;
}

/** How the stage frames the scenery. */
export interface SceneryView {
  /** what stays in view when a portrait screen crops the sides */
  focus: Pt;
  /** where the guiding path leaves the painting, nearest first (the first one clear of the stage's edge is used) */
  pathOut: readonly Pt[];
}

export interface Scenery {
  id: SceneryId;
  name: string;
  blurb: string;
  /** position in lists */
  order: number;
  /** whether it can be chosen (a scenery in progress hides behind a dev flag) */
  available(flags: URLSearchParams): boolean;
  geometry: SceneGeometry;
  /** the painting: seed, layout and paint steps (`art.scene` is `geometry`) */
  art: SceneArt;
  sky: ScenerySky;
  /** what the light plates throw shadows from, the sky layout they follow, scenery marks */
  light: LightArt;
  ambience: SceneryAmbience;
  view: SceneryView;
  /** where it lies in the world: decides which species it offers (ADR 0250) */
  flora: SceneryBiome;
  /** how the planting sheet and placement name each habitat here */
  habitatWords: Readonly<Record<Habitat, string>>;
  /** its wildlife: unlock table, water, perches, heron stands, perspective (ADR 0248) */
  fauna: SceneryFauna;
}
