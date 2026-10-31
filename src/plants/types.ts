import type { Rng } from '../core/rng';
import type { Painter } from '../paint';
import type { Range } from './biomes';

export type Tier = 1 | 2 | 3 | 4;
export type Habitat = 'water' | 'shore' | 'meadow' | 'path' | 'back' | 'rock';
export type SizeClass = 'small' | 'medium' | 'large' | 'tree';

export const TIERS: readonly Tier[] = [1, 2, 3, 4];
export const HABITATS: readonly Habitat[] = ['water', 'shore', 'meadow', 'path', 'back', 'rock'];
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
  /** paint the plant into p's canvas (w×h px); base at anchor; growth 0..1 */
  draw(p: Painter, rng: Rng, opts: SpeciesDrawOptions): void;
}

export function fitsSize(species: SizeClass, slotMax: SizeClass): boolean {
  return SIZE_CLASSES.indexOf(species) <= SIZE_CLASSES.indexOf(slotMax);
}

/** The language of a species' native name, for the `lang` attribute. */
export function nativeLang(def: Pick<SpeciesDef, 'nativeLang'>): string {
  return def.nativeLang ?? 'ja-Latn';
}

export function reflects(def: SpeciesDef): boolean {
  return def.reflect ?? def.habitats.some((h) => h === 'shore' || h === 'water');
}
