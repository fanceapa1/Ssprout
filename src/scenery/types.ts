/**
 * The scenery contract (ADR 0241): everything that makes one place to grow a garden, so the
 * systems take their data from the current scenery instead of module constants.
 * docs/systems/scenery.md, docs/ARCHITECTURE.md › Sceneries.
 */
import type { LightArt, LightPainters } from '../ambience/cast';
import type { DayPhase } from '../ambience/daylight';
import type { SceneryFauna } from '../fauna/habitat';
import type { SkyLayout } from '../ambience/sky-layout';
import type { Rng } from '../core/rng';
import type { SoundSceneryId } from '../core/soundscape';
import type { Painter } from '../paint';
import type { SceneryBiome } from '../plants/flora';
import type { Habitat } from '../plants/types';
import type { Pt, Rect } from '../render/viewport';
import type { ArtPainters, SceneArt } from '../scene/background';
import type { SceneGeometry } from '../scene/geometry';
import type { SceneryId } from './ids';
import type { Painters } from './painters';

/** A scenery's sky: where the light comes from, and the four painted daylight plates. */
export interface ScenerySky {
  layout: SkyLayout;
  /** the world band the sky plates cover */
  rect: Rect;
  /** the open sky (the sun is clipped to it), with `below` units hanging under its skyline */
  shape(below?: number): Pt[];
  /** the plates' painters, loaded when a plate is not in the paint cache (ADR 0341) */
  painters: Painters<{ sky: SkyPainters }>;
  /** how strongly each phase's mirrored sky lies on the water (ADR 0372); a phase left out takes `WATER_SKY_ALPHA` */
  waterAlpha?: Partial<Record<DayPhase, number>>;
}

/** How a scenery paints its sky plates (in its painter chunk, ADR 0341). */
export interface SkyPainters {
  /** one phase's sky, into a painter whose transform maps world units onto the plate */
  paint(p: Painter, rng: Rng, phase: DayPhase): void;
  /** the same sky mirrored into the still water's box (the caller clips it to the water) */
  paintWater(p: Painter, rng: Rng, phase: DayPhase, box: Rect): void;
}

/**
 * Everything a scenery paints with, in one lazy chunk per scenery (ADR 0341): the landscape's
 * steps and sprites, the sky plates and the light plates' own marks.
 */
export interface GardenPainters extends ArtPainters {
  sky: SkyPainters;
  light: LightPainters;
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

/** Water moving over the still painting, drawn each frame on `waterSurface` (ADR 0282). */
export interface SceneryMotion {
  /** paint its sprites once, in parts (the scene runs them between frames) */
  prepare(): Generator<void, void, undefined>;
  /** draw at animation time `t` (seconds) in world units: a pure function of `t` */
  draw(ctx: CanvasRenderingContext2D, t: number): void;
  /** draw under the mirrored sky and the generic water surface, pure in `t` (ADR 0374) */
  under?(ctx: CanvasRenderingContext2D, t: number): void;
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
  /** the sound profile it plays: its palette, garden mix and events (ADR 0283) */
  sound: SoundSceneryId;
  /** its painters (the same handle as `art.painters`, `sky.painters` and `light.painters`) */
  painters: Painters<GardenPainters>;
  /** moving water over the painting, from its own chunk (none under reduced motion: the painting stays still) */
  motion?: () => Promise<SceneryMotion | undefined>;
  /** how much of the scene's generic water surface (shimmer, rings, glints) plays on its pond: 1 when left out, 0 a still mirror (ADR 0302) */
  pondSurface?: number;
}
