import { PLANT_SIZES } from '../../scene/slots';

/**
 * Tier-1 ground plants (clover, violet, forget-me-not, dandelion, wild strawberry) are drawn in
 * a 70-unit design box but shown in the larger `small` garden box, so their heads still read
 * from across the garden (a 70-unit box at far-bank scale was a few dots).
 */
export const SMALL_DESIGN = { w: 70, h: 70 } as const;
export const SMALL_SIZE = PLANT_SIZES.small.w;
