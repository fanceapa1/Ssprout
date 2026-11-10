/**
 * The Japanese garden's data the first view needs (ADR 0341): its sky and light without their
 * painters, and the handle that loads those painters from their own chunk.
 */
import type { LightArt } from '../../ambience/cast';
import { SHRUBS, TREES } from '../../scene/layout';
import { lazyPainters } from '../painters';
import type { ScenerySky } from '../types';
import { GARDEN_SKY_LAYOUT, SKY_RECT, skyShape } from './sky';

/** Its painters, loaded the first time one of its paints has to run. */
export const GARDEN_PAINTERS = lazyPainters(() => import('./painters').then((m) => m?.GARDEN_PAINTERS_LOADED));

/** The Japanese garden's sky: its layout, plates and open-sky shape (ADR 0241). */
export const GARDEN_SKY: ScenerySky = {
  layout: GARDEN_SKY_LAYOUT,
  rect: SKY_RECT,
  shape: skyShape,
  painters: GARDEN_PAINTERS,
};

export const GARDEN_LIGHT_ART: LightArt = { trees: TREES, shrubs: SHRUBS, sky: GARDEN_SKY_LAYOUT, painters: GARDEN_PAINTERS };
