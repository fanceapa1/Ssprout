/**
 * Studio: the four daylight phases and their blends over the painted garden (sky plate,
 * mirrored sky on the pond, boulder rims, the light plate, paper last — the app's pipeline),
 * each plate alone, and the moon through its phases. docs/systems/daylight.md.
 */
import { createCastLight, type CastLight } from '../ambience/cast';
import { blendWeights, only, pinnedState, PINNED_MOON_PHASE, type DayPhase, type DaylightState } from '../ambience/daylight';
import { rimLight } from '../ambience/sky-layout';
import { paperTexture, type AnyCanvas } from '../paint';
import { createRimCache, drawRim } from '../paint/rim';
import { WORLD_H, WORLD_W, type Rect } from '../render/viewport';
import type { StudioEntry, StudioSection } from '../studio/types';
import { GARDEN_ART, paintSceneSync, type PaintResult } from './background';
import { SHRUBS, TREES } from './layout';
import { SKY_RECT } from './paint-sky';
import { createSkyLight, type SkyLight } from './sky-light';

const WORLD: Rect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
const paintings = new Map<string, PaintResult>();
const papers = new Map<string, AnyCanvas>();
const rims = createRimCache();
let sky: SkyLight | null = null;
let cast: CastLight | null = null;

function painting(seed: number, scale: number): PaintResult {
  const key = `${seed}|${scale.toFixed(4)}`;
  let r = paintings.get(key);
  if (!r) paintings.set(key, (r = paintSceneSync({ ...GARDEN_ART, seed }, { rect: WORLD, scale })));
  return r;
}

function paper(w: number, h: number): AnyCanvas {
  const key = `${w}x${h}`;
  let p = papers.get(key);
  if (!p) papers.set(key, (p = paperTexture(w, h, 1)));
  return p;
}

const lights = () => {
  sky ??= createSkyLight({ pond: GARDEN_ART.scene.pond, seed: GARDEN_ART.seed });
  cast ??= createCastLight(GARDEN_ART.scene, { trees: TREES, shrubs: SHRUBS }, 'studio-cast');
  return { sky, cast };
};

/** The garden in one light, the way the renderer layers it. */
function drawGarden(canvas: HTMLCanvasElement, seed: number, state: DaylightState): void {
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / WORLD_W;
  const res = painting(seed, k);
  const { sky: s, cast: c } = lights();
  s.update(state, true);
  c.update(state, true);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
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

const garden = (id: string, label: string, state: () => DaylightState): StudioEntry => ({
  id,
  label,
  w: 800,
  h: 500,
  render(canvas, { seed }) {
    drawGarden(canvas, seed, state());
  },
});

const phase = (p: DayPhase) => garden(`garden-${p}`, `${p} — the garden in its light`, () => pinnedState(only(p)));
const blend = (from: DayPhase, to: DayPhase, label: string) =>
  garden(`blend-${from}-${to}`, `blend ${from} → ${to} (halfway): ${label}`, () => pinnedState(blendWeights(from, to, 0.5), { from, to, t: 0.5 }));

/** One plate on white (no landscape): what each phase paints. */
const plate = (kind: 'sky' | 'cast', p: DayPhase): StudioEntry => ({
  id: `${kind}-${p}`,
  label: `${kind} plate · ${p}`,
  w: 560,
  h: kind === 'sky' ? Math.round((560 * SKY_RECT.h) / SKY_RECT.w) : 350,
  render(canvas) {
    const ctx = canvas.getContext('2d')!;
    const { sky: s, cast: c } = lights();
    const state = pinnedState(only(p));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (kind === 'sky') {
      s.update(state, true);
      const k = canvas.width / SKY_RECT.w;
      ctx.setTransform(k, 0, 0, k, -SKY_RECT.x * k, -SKY_RECT.y * k);
      s.drawSky(ctx);
    } else {
      c.update(state, true);
      ctx.drawImage(c.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
});

/** The moon through its phases (waxing crescent → full → waning) over the night sky. */
const moons: StudioEntry = {
  id: 'moon-phases',
  label: 'the moon: crescent, quarter, gibbous, full, waning (reserved paper, glazed dark side)',
  w: 800,
  h: 200,
  render(canvas, { seed }) {
    const phases = [0.12, 0.25, PINNED_MOON_PHASE, 0.5, 0.62, 0.75, 0.88];
    const ctx = canvas.getContext('2d')!;
    const cw = canvas.width / phases.length;
    const tmp = document.createElement('canvas');
    tmp.width = 800;
    tmp.height = 500;
    phases.forEach((mp, i) => {
      drawGarden(tmp, seed, { ...pinnedState(only('night')), moonPhase: mp });
      // crop around the moon's place in the sky
      ctx.drawImage(tmp, (806 - 90) * 0.5, (182 - 70) * 0.5, 90, 70, i * cw, 0, cw, canvas.height);
    });
  },
};

const section: StudioSection = {
  id: 'daylight',
  title: 'Daylight · four painted phases',
  order: 105,
  entries: [
    phase('sunrise'),
    phase('midday'),
    phase('sunset'),
    phase('night'),
    blend('night', 'sunrise', 'dawn'),
    blend('sunrise', 'midday', 'morning'),
    blend('midday', 'sunset', 'late afternoon'),
    blend('sunset', 'night', 'dusk'),
    moons,
    ...(['sunrise', 'midday', 'sunset', 'night'] as const).flatMap((p) => [plate('sky', p), plate('cast', p)]),
  ],
};

export default section;
