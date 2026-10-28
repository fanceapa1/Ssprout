/**
 * The rocky waterfall as a scenery (phase 10). Its rock (S6), water (S7) and vegetation (S8) are
 * painted; the sky is a flat placeholder until its painter lands (S10).
 * Hidden behind `?dev&scenery=waterfall`. docs/systems/scenery.md › Waterfall.
 */
import type { DayPhase } from '../../ambience/daylight';
import type { LightArt } from '../../ambience/cast';
import { createRng } from '../../core/rng';
import type { Painter } from '../../paint';
import { lighten, PIGMENTS } from '../../paint';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import type { PaintStep, SceneArt } from '../../scene/background';
import { paintMargins, paintStones } from '../../scene/paint-land';
import type { Scenery, ScenerySky, SceneryView } from '../types';
import { TRAIL, waterfallScene } from './geometry';
import { FOCUS, openSky, SKY_TOP, WATERFALL_AMBIENCE, WATERFALL_SKY_LAYOUT } from './layout';
import { paintButtress, paintCliff, paintGorge, paintLedges } from './paint-rocks';
import { paintFalls, paintPool, paintStream } from './paint-water';
import { paintBanks, paintCrownWoods, paintFarRidge, paintFerns, paintForeground, paintOverhang, paintWaterfallGrass, paintWaterfallMeadow } from './paint-veg';
import { WATERFALL_ROCKS } from './sprites';

/** Is the waterfall offered under these URL flags? Only to developers until it is painted. */
export function waterfallAvailable(flags: URLSearchParams): boolean {
  return flags.has('dev') && flags.get('scenery') === 'waterfall';
}

function fill(p: Painter, shape: readonly Pt[], colour: string, alpha: number): void {
  const { ctx } = p;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  shape.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The painting's elements, a filter for studio views. The sky is a placeholder. */
type Element = 'sky' | 'ridge' | 'banks' | 'gorge' | 'cliff' | 'ledges' | 'woods' | 'ferns' | 'water' | 'falls' | 'near' | 'path';

/** The paint steps, back to front. A flat placeholder marks where S10 slots in the sky. */
export function waterfallSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const root = createRng(art.seed);
  const r = (label: string) => root.fork(label);
  const { scene } = art;
  const steps: (PaintStep & { el: Element })[] = [
    // placeholder: the sky (S10)
    { el: 'sky', name: 'sky', run: (p) => fill(p, openSky(), lighten(PIGMENTS.cerulean, 0.7), 1) },
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

const SKY_RECT: Rect = { x: 0, y: SKY_TOP, w: WORLD_W, h: 740 };

const PHASE_SKY: Record<DayPhase, string> = {
  sunrise: PIGMENTS.apricot,
  midday: PIGMENTS.cerulean,
  sunset: PIGMENTS.ochre,
  night: PIGMENTS.indigo,
};

/** Placeholder sky: one flat wash per phase over the open sky (S10 paints the real plates). */
export const WATERFALL_SKY: ScenerySky = {
  layout: WATERFALL_SKY_LAYOUT,
  rect: SKY_RECT,
  shape: openSky,
  paint: (p, _rng, phase) => fill(p, openSky(40), PHASE_SKY[phase], 0.3),
  paintWater: (p, _rng, phase, box) =>
    fill(p, [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }], PHASE_SKY[phase], 0.5),
};

export const WATERFALL_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: WATERFALL_SKY_LAYOUT };

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
