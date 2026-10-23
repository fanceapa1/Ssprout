/**
 * Studio: what a close camera view gains (ADR 0163). Each entry shows a small part of the world
 * at the camera's closest zoom, left as the overview plates draw it (upscaled), right with the
 * detail composed for that view: the moon's edge and the stars punched at full resolution in the
 * sky, and the light plate's marks (cast shadows, crown lights) repainted at the detail scale.
 */
import { createCastLight } from '../ambience/cast';
import { only, pinnedState, type DayPhase } from '../ambience/daylight';
import { moonDisc } from '../ambience/sky-layout';
import { WORLD_H, WORLD_W, type Rect } from '../render/viewport';
import type { StudioSection } from '../studio/types';
import { GARDEN_ART } from './background';
import { SHRUBS, TREES } from './layout';
import { createSkyLight } from './sky-light';

const PANEL = 300;

/** Draw `draw` (world units) into a PANEL² panel at x showing `rect`, on white paper. */
function panel(ctx: CanvasRenderingContext2D, x: number, pr: number, rect: Rect, draw: (c: CanvasRenderingContext2D) => void): void {
  const k = (PANEL * pr) / rect.w;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(x * pr, 0, PANEL * pr, PANEL * pr);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x * pr, 0, PANEL * pr, PANEL * pr);
  ctx.setTransform(k, 0, 0, k, x * pr - rect.x * k, -rect.y * k);
  draw(ctx);
  ctx.restore();
}

let skyLight: ReturnType<typeof createSkyLight> | null = null;
/** created on first render (never at import: the studio registry is also loaded by unit tests) */
const skyOf = () => (skyLight ??= createSkyLight({ pond: GARDEN_ART.scene.pond, seed: GARDEN_ART.seed }));

function castFor(phase: DayPhase, rect: Rect) {
  const cast = createCastLight(GARDEN_ART.scene, { trees: TREES, shrubs: SHRUBS }, `studio-detail-${phase}`);
  cast.update(pinnedState(only(phase)), true);
  cast.setDetail(rect, 2);
  while (cast.paintDetailStep()) {
    /* paint every phase now */
  }
  return cast;
}

const section: StudioSection = {
  id: 'camera-detail',
  title: 'Camera · detail of a close view',
  order: 61,
  entries: [
    {
      id: 'moon',
      label: 'night sky round the moon at 3×: overview plate (left), detail (right)',
      w: PANEL * 2 + 10,
      h: PANEL,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        const state = pinnedState(only('night'));
        const sky = skyOf();
        sky.update(state, true);
        const m = moonDisc(state);
        const rect = { x: m.x - 60, y: m.y - 60, w: 120, h: 120 };
        sky.setDetail(null, 1);
        panel(ctx, 0, pixelRatio, rect, (c) => sky.drawSky(c));
        sky.setDetail(rect, 5.4);
        panel(ctx, PANEL + 10, pixelRatio, rect, (c) => sky.drawSky(c, rect));
      },
    },
    {
      id: 'shadows',
      label: 'sunset light plate by a shrub at 3× (its long shadow): overview plate (left), marks repainted (right)',
      w: PANEL * 2 + 10,
      h: PANEL,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        const sh = SHRUBS[(seed - 1 + SHRUBS.length * 10) % SHRUBS.length]!;
        const rect = { x: Math.max(0, sh.x - 90), y: Math.max(0, sh.y - 150), w: 240, h: 240 };
        const cast = castFor('sunset', rect);
        panel(ctx, 0, pixelRatio, rect, (c) => {
          c.drawImage(cast.canvas as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
        });
        panel(ctx, PANEL + 10, pixelRatio, rect, (c) => {
          const d = cast.detail();
          if (d) c.drawImage(d.canvas as CanvasImageSource, d.rect.x, d.rect.y, d.rect.w, d.rect.h);
        });
      },
    },
  ],
};

export default section;
