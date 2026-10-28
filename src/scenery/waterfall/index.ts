/**
 * The rocky waterfall as a scenery (phase 10): its rock (S6), water (S7), vegetation (S8) and
 * daylight (S10: sky and light plates).
 * Hidden behind `?dev&scenery=waterfall`. docs/systems/scenery.md › Waterfall.
 */
import { createRng } from '../../core/rng';
import type { PaintStep, SceneArt } from '../../scene/background';
import { paintMargins, paintStones } from '../../scene/paint-land';
import type { Scenery, SceneryView } from '../types';
import { TRAIL, waterfallScene } from './geometry';
import { FOCUS, WATERFALL_AMBIENCE } from './layout';
import type { LightArt } from '../../ambience/cast';
import { WATERFALL_SKY_LAYOUT } from './layout';

const WATERFALL_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: WATERFALL_SKY_LAYOUT };
import { paintButtress, paintCliff, paintGorge, paintLedges } from './paint-rocks';
import { paintFalls, paintPool, paintStream } from './paint-water';
import { paintBanks, paintCrownWoods, paintFarRidge, paintFerns, paintForeground, paintOverhang, paintWaterfallGrass, paintWaterfallMeadow } from './paint-veg';
import { WATERFALL_SKY } from './sky';
import { WATERFALL_ROCKS } from './sprites';

export { WATERFALL_LIGHT_ART, WATERFALL_SKY };

/** Is the waterfall offered under these URL flags? Only to developers until it is painted. */
export function waterfallAvailable(flags: URLSearchParams): boolean {
  return flags.has('dev') && flags.get('scenery') === 'waterfall';
}

/** The painting's elements, a filter for studio views (the sky is the daylight's plates). */
type Element = 'ridge' | 'banks' | 'gorge' | 'cliff' | 'ledges' | 'woods' | 'ferns' | 'water' | 'falls' | 'near' | 'path';

/** The paint steps, back to front, on white: the sky plates are multiplied over them. */
export function waterfallSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const root = createRng(art.seed);
  const r = (label: string) => root.fork(label);
  const { scene } = art;
  const steps: (PaintStep & { el: Element })[] = [
    // the land (S8): the far ridge, the banks and the meadow, under the cliff's reserved paper
    { el: 'ridge', name: 'far-ridge', soft: true, run: (p) => paintFarRidge(p, r('far-ridge')) },
    { el: 'banks', name: 'banks', soft: true, run: (p) => paintBanks(p, r('banks')) },
    { el: 'banks', name: 'meadow', run: (p) => paintWaterfallMeadow(p, r('meadow')) },
    { el: 'banks', name: 'grass', run: (p) => paintWaterfallGrass(p, r('grass')) },
    // the rock (S6), back to front: the gorge behind the lip, the cliff, the buttress, the ledges
    { el: 'gorge', name: 'gorge', run: (p) => paintGorge(p, r('gorge')) },
    { el: 'cliff', name: 'cliff', run: (p) => paintCliff(p, r('cliff')) },
    { el: 'cliff', name: 'buttress', run: (p) => paintButtress(p, r('buttress')) },
    { el: 'ledges', name: 'ledges', run: (p) => paintLedges(p, r('ledges')) },
    // the vegetation on the rock (S8): the crown woods, the trees over the edge, moss and ferns
    { el: 'woods', name: 'crown-woods', run: (p) => paintCrownWoods(p, r('crown-woods')) },
    { el: 'woods', name: 'overhang', run: (p) => paintOverhang(p, r('overhang')) },
    { el: 'ferns', name: 'ferns', run: (p) => paintFerns(p, r('ferns')) },
    // the water (S7): the pool and the stream, then the falls over the cliff and the pool's back edge
    { el: 'water', name: 'pool', run: (p) => paintPool(p, r('pool')) },
    { el: 'water', name: 'stream', run: (p) => paintStream(p, r('stream')) },
    { el: 'falls', name: 'falls', run: (p) => paintFalls(p, r('falls')) },
    // the near foreground and the paper margins (S8), before the stones as in the garden
    { el: 'near', name: 'foreground', run: (p) => paintForeground(p, r('foreground')) },
    { el: 'near', name: 'margins', soft: true, run: (p) => paintMargins(p, r('margins')) },
    // the trail's stepping stones (S6), over the banks
    { el: 'path', name: 'stones', run: (p) => paintStones(p, r('stones'), scene.path) },
  ];
  return only ? steps.filter((s) => only.includes(s.el)) : steps;
}

export const WATERFALL_ART: SceneArt = {
  scenery: 'waterfall',
  scene: waterfallScene,
  trees: [],
  shrubs: [],
  tufts: [],
  foregroundTufts: [],
  seed: 11,
  steps: waterfallSteps,
  rockSprites: WATERFALL_ROCKS,
};

export const WATERFALL_VIEW: SceneryView = {
  focus: FOCUS,
  // the stepping stones' near edges, nearest first (ADR 0202)
  pathOut: TRAIL.map((s) => ({ x: s.x, y: s.y + s.ry })),
};

export const WATERFALL: Scenery = {
  id: 'waterfall',
  name: 'Rocky waterfall',
  blurb: 'Falls over mossy ledges into a plunge pool, and a stream winding down to you.',
  order: 1,
  available: waterfallAvailable,
  geometry: waterfallScene,
  art: WATERFALL_ART,
  sky: WATERFALL_SKY,
  light: WATERFALL_LIGHT_ART,
  ambience: WATERFALL_AMBIENCE,
  view: WATERFALL_VIEW,
};
