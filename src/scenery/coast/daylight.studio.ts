/**
 * Studio: the coast's daylight (G5): the four phases over the painting the way the renderer layers
 * them (sky plate, the sea's mirrored sky, the light plate, paper last), the dusk blend, the temple
 * against the noon sky, and each sky, sea and light plate alone. docs/systems/daylight.md › Coast.
 */
import { createCastLight, type CastLight } from '../../ambience/cast';
import { blendWeights, only, pinnedState, type DayPhase, type DaylightState } from '../../ambience/daylight';
import { paperTexture } from '../../paint';
import { WORLD_H, WORLD_W, type Rect } from '../../render/viewport';
import { paintSceneSync, type PaintResult } from '../../scene/background';
import { createSkyLight, type SkyLight } from '../../scene/sky-light';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST } from '.';
import { SEA_WATER } from './geometry';
import { COAST_SKY_RECT } from './sky';

// the studio loads only the released gardens' painters; the coast is behind its flag
await COAST.painters.load();

const WORLD: Rect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
const paintings = new Map<string, PaintResult>();
let sky: SkyLight | null = null;
let cast: CastLight | null = null;

function painting(seed: number, rect: Rect, scale: number): PaintResult {
  const key = `${seed}|${rect.x},${rect.y},${rect.w}|${scale.toFixed(4)}`;
  let r = paintings.get(key);
  if (!r) paintings.set(key, (r = paintSceneSync({ ...COAST.art, seed }, { rect, scale })));
  return r;
}

const lights = () => {
  sky ??= createSkyLight({ pond: SEA_WATER, seed: COAST.art.seed, sky: COAST.sky, scenery: 'coast', cache: null });
  cast ??= createCastLight(COAST.art.scene, COAST.light, 'studio-coast-cast', { scenery: 'coast', cache: null });
  return { sky, cast };
};

/** The coast in a light, over a world rect (the whole world, or a close view). */
function drawCoast(canvas: HTMLCanvasElement, seed: number, state: DaylightState, rect: Rect = WORLD): void {
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / rect.w;
  const res = painting(seed, rect, k);
  const { sky: s, cast: c } = lights();
  s.update(state, true);
  c.update(state, true);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, -rect.x * k, -rect.y * k);
  s.drawSky(ctx);
  s.drawWater(ctx);
  for (const sp of [...res.sprites].sort((a, b) => a.depth - b.depth)) ctx.drawImage(sp.canvas as CanvasImageSource, sp.box.x, sp.box.y, sp.box.w, sp.box.h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c.canvas as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

const scene = (id: string, label: string, state: () => DaylightState, rect?: Rect): StudioEntry => ({
  id,
  label,
  w: 800,
  h: rect ? Math.round((800 * rect.h) / rect.w) : 500,
  render(canvas, { seed }) {
    drawCoast(canvas, seed, state(), rect);
  },
});

const phase = (p: DayPhase) => scene(`coast-${p}`, `${p}: the coast in its light`, () => pinnedState(only(p)));

/** One plate on white (no painting): the sky, the sea's mirrored sky, or the light plate. */
const plate = (kind: 'sky' | 'water' | 'cast', p: DayPhase): StudioEntry => ({
  id: `coast-${kind}-${p}`,
  label: `${kind === 'water' ? 'sea' : kind} plate · ${p}`,
  w: 560,
  h: kind === 'sky' ? Math.round((560 * COAST_SKY_RECT.h) / COAST_SKY_RECT.w) : 350,
  render(canvas) {
    const ctx = canvas.getContext('2d')!;
    const { sky: s, cast: c } = lights();
    const state = pinnedState(only(p));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (kind === 'sky') {
      s.update(state, true);
      const k = canvas.width / COAST_SKY_RECT.w;
      ctx.setTransform(k, 0, 0, k, -COAST_SKY_RECT.x * k, -COAST_SKY_RECT.y * k);
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
  id: 'coast-daylight',
  title: 'Scenery · coast daylight',
  order: 158,
  entries: [
    ...PHASES.map(phase),
    scene('coast-dusk', 'blend sunset → night (halfway): dusk', () => pinnedState(blendWeights('sunset', 'night', 0.5), { from: 'sunset', to: 'night', t: 0.5 })),
    scene('coast-temple', 'the temple against the noon sky, close', () => pinnedState(only('midday')), { x: 610, y: 250, w: 300, h: 180 }),
    scene('coast-village-night', 'the village at night, close: lit windows and the chapel lamp', () => pinnedState(only('night')), { x: 80, y: 270, w: 320, h: 140 }),
    ...PHASES.flatMap((p) => [plate('sky', p), plate('water', p), plate('cast', p)]),
  ],
};

export default section;
