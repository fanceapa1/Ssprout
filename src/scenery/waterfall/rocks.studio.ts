/**
 * Studio: the waterfall's rock (S6): the cliff with the gorge and the buttress, a close view of the
 * ledges, the boulder set, and the whole painting with the water and vegetation placeholders.
 */
import { paperTexture } from '../../paint';
import { WORLD_H, WORLD_W, type Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { WATERFALL } from '.';

const ROCK = ['gorge', 'cliff', 'ledges'];

export function region(id: string, label: string, rect: Rect, only: readonly string[] | undefined, sprites: boolean, w = 640): StudioEntry {
  return {
    id,
    label,
    w,
    h: Math.round((w * rect.h) / rect.w),
    render(canvas, { seed }) {
      const scale = canvas.width / rect.w;
      const res = paintSceneSync({ ...WATERFALL.art, seed }, { rect, scale }, { only, sprites });
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
      for (const s of [...res.sprites].sort((a, b) => a.depth - b.depth)) ctx.drawImage(s.canvas as CanvasImageSource, s.box.x, s.box.y, s.box.w, s.box.h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const section: StudioSection = {
  id: 'waterfall-rocks',
  title: 'Scenery · waterfall rock',
  order: 104,
  entries: [
    region('cliff', 'cliff, upper gorge and buttress (strata, wet streaks, recesses, lit faces)', { x: -40, y: 180, w: 1120, h: 480 }, ROCK, false, 800),
    region('ledges', 'ledges close up: lit shelf, undercut shadow, moss cushions', { x: 280, y: 300, w: 640, h: 300 }, ROCK, false, 800),
    region('boulders', 'boulder set: wet stones by the pool and the stream, mossy ones on the banks', { x: 220, y: 520, w: 1340, h: 480 }, [], true, 800),
    region('scene', 'the painting so far: rock and boulders over the water and vegetation placeholders', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined, true, 800),
  ],
};

export default section;
