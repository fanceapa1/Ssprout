/**
 * Studio: the waterfall's daylight (S10): the four phases over the painting the way the renderer
 * layers them (sky plate, the pool's mirrored sky, rock rims, the light plate, paper last), the
 * dusk blend, and each sky, water and light plate alone. docs/systems/daylight.md › Waterfall.
 */
import { createCastLight, type CastLight } from '../../ambience/cast';
import { blendWeights, only, pinnedState, type DayPhase, type DaylightState } from '../../ambience/daylight';
import { rimLight } from '../../ambience/sky-layout';
import { paperTexture, type AnyCanvas } from '../../paint';
import { createRimCache, drawRim } from '../../paint/rim';
import { WORLD_H, WORLD_W, type Rect } from '../../render/viewport';
import { paintSceneSync, type PaintResult } from '../../scene/background';
import { createSkyLight, type SkyLight } from '../../scene/sky-light';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { WATERFALL } from '.';
import { POOL } from './geometry';
import { WATERFALL_SKY_RECT } from './sky';

const WORLD: Rect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
const paintings = new Map<string, PaintResult>();
const papers = new Map<string, AnyCanvas>();
const rims = createRimCache();
let sky: SkyLight | null = null;
let cast: CastLight | null = null;

function painting(seed: number, scale: number): PaintResult {
  const key = `${seed}|${scale.toFixed(4)}`;
  let r = paintings.get(key);
  if (!r) paintings.set(key, (r = paintSceneSync({ ...WATERFALL.art, seed }, { rect: WORLD, scale })));
  return r;
}

function paper(w: number, h: number): AnyCanvas {
  const key = `${w}x${h}`;
  let p = papers.get(key);
  if (!p) papers.set(key, (p = paperTexture(w, h, 1)));
  return p;
}

const lights = () => {
  sky ??= createSkyLight({ pond: POOL, seed: WATERFALL.art.seed, sky: WATERFALL.sky, scenery: 'waterfall' });
  cast ??= createCastLight(WATERFALL.art.scene, WATERFALL.light, 'studio-waterfall-cast', { scenery: 'waterfall' });
  return { sky, cast };
};

function drawWaterfall(canvas: HTMLCanvasElement, seed: number, state: DaylightState): void {
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / WORLD_W;
  const res = painting(seed, k);
  const { sky: s, cast: c } = lights();
  s.update(state, true);
  c.update(state, true);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  s.drawSky(ctx);
  s.drawWater(ctx);
  const rim = rimLight(state);
  for (const sp of [...res.sprites].sort((a, b) => a.depth - b.depth)) {
    ctx.drawImage(sp.canvas as CanvasImageSource, sp.box.x, sp.box.y, sp.box.w, sp.box.h);
    if (sp.id.startsWith('rock')) drawRim(ctx, rims, sp.canvas, sp.box, rim, 0.7);
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c.canvas as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(paper(canvas.width, canvas.height) as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

const scene = (id: string, label: string, state: () => DaylightState): StudioEntry => ({
  id,
  label,
  w: 800,
  h: 500,
  render(canvas, { seed }) {
    drawWaterfall(canvas, seed, state());
  },
});

const phase = (p: DayPhase) => scene(`waterfall-${p}`, `${p}: the waterfall in its light`, () => pinnedState(only(p)));

/** One plate on white (no painting): the sky, the pool's mirrored sky, or the light plate. */
const plate = (kind: 'sky' | 'water' | 'cast', p: DayPhase): StudioEntry => ({
  id: `waterfall-${kind}-${p}`,
  label: `${kind} plate · ${p}`,
  w: 560,
  h: kind === 'sky' ? Math.round((560 * WATERFALL_SKY_RECT.h) / WATERFALL_SKY_RECT.w) : 350,
  render(canvas) {
    const ctx = canvas.getContext('2d')!;
    const { sky: s, cast: c } = lights();
    const state = pinnedState(only(p));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (kind === 'sky') {
      s.update(state, true);
      const k = canvas.width / WATERFALL_SKY_RECT.w;
      ctx.setTransform(k, 0, 0, k, -WATERFALL_SKY_RECT.x * k, -WATERFALL_SKY_RECT.y * k);
      s.drawSky(ctx);
    } else if (kind === 'water') {
      s.update(state, true);
      const k = canvas.width / WORLD_W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      s.drawWater(ctx);
    } else {
      c.update(state, true);
      ctx.drawImage(c.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
});

const PHASES = ['sunrise', 'midday', 'sunset', 'night'] as const;

const section: StudioSection = {
  id: 'waterfall-daylight',
  title: 'Scenery · waterfall daylight',
  order: 109,
  entries: [
    ...PHASES.map(phase),
    scene('waterfall-dusk', 'blend sunset → night (halfway): dusk', () => pinnedState(blendWeights('sunset', 'night', 0.5), { from: 'sunset', to: 'night', t: 0.5 })),
    ...PHASES.flatMap((p) => [plate('sky', p), plate('water', p), plate('cast', p)]),
  ],
};

export default section;
