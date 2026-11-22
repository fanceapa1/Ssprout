import type { Rng } from '../core/rng';
import type { SceneryId } from '../core/sceneries';
import type { Painter } from '../paint';
import type { Range } from './biomes';

export type Tier = 1 | 2 | 3 | 4;
export type Habitat = 'water' | 'shore' | 'meadow' | 'path' | 'back' | 'rock';
export type SizeClass = 'small' | 'medium' | 'large' | 'tree';

/** A particular kind of place inside a habitat, set on a slot only where the habitat word is too broad (ADR 0383). */
export type Site = 'wall' | 'ledge' | 'sea-rock' | 'beach';

export const TIERS: readonly Tier[] = [1, 2, 3, 4];
export const HABITATS: readonly Habitat[] = ['water', 'shore', 'meadow', 'path', 'back', 'rock'];
export const SITES: readonly Site[] = ['wall', 'ledge', 'sea-rock', 'beach'];
/** Ordered small → large; a slot with maxSize X accepts X and everything smaller. */
export const SIZE_CLASSES: readonly SizeClass[] = ['small', 'medium', 'large', 'tree'];

export interface SpeciesDrawOptions {
  w: number;
  h: number;
  /** 0 = seedling … 1 = full bloom */
  growth: number;
}

export interface SpeciesDef {
  /** kebab-case, equals the file name in src/plants/species/ */
  id: string;
  /** "Japanese Iris" */
  name: string;
  /** "Hanashōbu" */
  nativeName?: string;
  /** BCP 47 language of `nativeName` (default `'ja-Latn'`, `nativeLang(def)`) */
  nativeLang?: string;
  /** where it grows wild and where it is planted: decides the sceneries that offer it (ADR 0250) */
  range: Range;
  tier: Tier;
  habitats: Habitat[];
  /** the sites it grows on: a slot with a site takes only species that list it (ADR 0383) */
  sites?: Site[];
  sizeClass: SizeClass;
  /** sprite box in world units at slot scale 1 */
  size: { w: number; h: number };
  /** base point as a fraction of the box */
  anchor: { x: number; y: number };
  /** one short poetic line for the reward card */
  description: string;
  /** hex, for UI swatch, petals, bee targeting */
  bloomColor: string;
  /** attracts bees/butterflies */
  pollinators: boolean;
  /** default true when habitats include shore/water */
  reflect?: boolean;
  /** false: no sunrise/sunset rim light (a plant under the water, ADR 0281); default true */
  rimLight?: boolean;
  /** a garden's own words for a species shared between gardens, each falling back to the above (ADR 0385) */
  in?: Partial<Record<SceneryId, SpeciesWords>>;
  /** paint the plant into p's canvas (w×h px); base at anchor; growth 0..1 */
  draw(p: Painter, rng: Rng, opts: SpeciesDrawOptions): void;
}

/** One garden's card words for a shared species: a native name always comes with its language. */
export type SpeciesWords = { description?: string } & (
  | { nativeName: string; nativeLang: string }
  | { nativeName?: undefined; nativeLang?: undefined }
);

/** What the cards say of a species in a garden: that garden's words where it has them, else the species' own. */
export function speciesWords(
  def: Pick<SpeciesDef, 'nativeName' | 'nativeLang' | 'description' | 'in'>,
  sceneryId?: SceneryId,
): { nativeName: string | undefined; nativeLang: string; description: string } {
  const own = sceneryId ? def.in?.[sceneryId] : undefined;
  return {
    nativeName: own?.nativeName ?? def.nativeName,
    nativeLang: own?.nativeName ? own.nativeLang : nativeLang(def),
    description: own?.description ?? def.description,
  };
}

export function fitsSize(species: SizeClass, slotMax: SizeClass): boolean {
  return SIZE_CLASSES.indexOf(species) <= SIZE_CLASSES.indexOf(slotMax);
}

/** A slot without a site takes any species of its habitat; one with a site only those listing it. */
export function fitsSite(species: Pick<SpeciesDef, 'sites'>, slot: { site?: Site }): boolean {
  return slot.site === undefined || (species.sites?.includes(slot.site) ?? false);
}

/** The language of a species' native name, for the `lang` attribute. */
export function nativeLang(def: Pick<SpeciesDef, 'nativeLang'>): string {
  return def.nativeLang ?? 'ja-Latn';
}

export function reflects(def: SpeciesDef): boolean {
  return def.reflect ?? def.habitats.some((h) => h === 'shore' || h === 'water');
}
