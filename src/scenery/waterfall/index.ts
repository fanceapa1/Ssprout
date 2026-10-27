/**
 * The rocky waterfall as a scenery (phase 10). Geometry, slots and numbers only for now: its
 * paint steps and sky are flat placeholder shapes until the painters land (S6–S8, S10). Hidden
 * behind `?dev&scenery=waterfall`. docs/systems/scenery.md › Waterfall.
 */
import type { DayPhase } from '../../ambience/daylight';
import type { LightArt } from '../../ambience/cast';
import type { Painter } from '../../paint';
import { lighten, PIGMENTS } from '../../paint';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import type { PaintStep, SceneArt } from '../../scene/background';
import type { Scenery, ScenerySky, SceneryView } from '../types';
import { TRAIL, waterfallScene } from './geometry';
import { CLIFF, FAR_RIDGE, FOCUS, LEDGES, openSky, SKY_TOP, WATERFALL_AMBIENCE, WATERFALL_SKY_LAYOUT } from './layout';

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

function ellipse(p: Painter, cx: number, cy: number, rx: number, ry: number, colour: string, alpha: number): void {
  const { ctx } = p;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const GROUND: Pt[] = [
  { x: -80, y: 470 },
  { x: 1680, y: 470 },
  { x: 1680, y: 1080 },
  { x: -80, y: 1080 },
];

type Element = 'sky' | 'ridge' | 'banks' | 'cliff' | 'ledges' | 'water' | 'falls' | 'path';

/** Placeholder steps: flat shapes in the composition's places, replaced by the painters (S6–S8). */
export function waterfallSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const { scene } = art;
  const steps: (PaintStep & { el: Element })[] = [
    { el: 'sky', name: 'sky', run: (p) => fill(p, openSky(), lighten(PIGMENTS.cerulean, 0.7), 1) },
    { el: 'ridge', name: 'far-ridge', run: (p) => fill(p, FAR_RIDGE, lighten(PIGMENTS.bellflower, 0.55), 1) },
    { el: 'banks', name: 'banks', run: (p) => fill(p, GROUND, lighten(PIGMENTS.sageLight, 0.5), 1) },
    { el: 'cliff', name: 'cliff', run: (p) => fill(p, CLIFF, lighten(PIGMENTS.stone, 0.3), 1) },
    {
      el: 'ledges',
      name: 'ledges',
      run: (p) => {
        for (const l of LEDGES) {
          const [a, b] = l.edge;
          fill(p, [a, b, { x: b.x - 8, y: b.y + 16 }, { x: a.x + 8, y: a.y + 16 }], lighten(PIGMENTS.sap, 0.2), 1);
        }
      },
    },
    { el: 'water', name: 'pool', run: (p) => fill(p, scene.pond, lighten(PIGMENTS.celadonMid, 0.3), 1) },
    { el: 'water', name: 'stream', run: (p) => scene.streams.forEach((s) => fill(p, s, lighten(PIGMENTS.celadon, 0.3), 1)) },
    {
      el: 'falls',
      name: 'falls',
      run: (p) => {
        if (!scene.falls) return;
        fill(p, scene.falls.outline, lighten(PIGMENTS.cerulean, 0.8), 1);
        ellipse(p, scene.falls.foot.x, scene.falls.foot.y, 90, 18, '#ffffff', 0.8);
      },
    },
    { el: 'path', name: 'trail', run: (p) => scene.path.forEach((s) => ellipse(p, s.x, s.y, s.rx, s.ry, lighten(PIGMENTS.stoneWarm, 0.35), 1)) },
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
