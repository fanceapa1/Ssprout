/**
 * Studio: the coast's shore (GB2) in place: the beach (wet band, sorted shingle, the berm's cobbles,
 * the Posidonia wrack and sea balls, tufts at the back) and a rock pool close up. Each paints only
 * the steps around the shore, once per seed.
 */
import { paperTexture } from '../../paint';
import type { Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST } from '.';

await COAST.painters.load();

function region(id: string, label: string, rect: Rect, only: readonly string[], w: number): StudioEntry {
  let cache: { key: string; canvas: CanvasImageSource } | null = null;
  return {
    id,
    label,
    w,
    h: Math.round((w * rect.h) / rect.w),
    render(canvas, { seed }) {
      const key = `${seed}:${canvas.width}`;
      if (cache?.key !== key) {
        const res = paintSceneSync({ ...COAST.art, seed }, { rect, scale: canvas.width / rect.w }, { only, sprites: false });
        cache = { key, canvas: res.canvas as CanvasImageSource };
      }
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(cache.canvas, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const section: StudioSection = {
  id: 'coast-shore',
  title: 'Scenery · coast shore',
  order: 155,
  entries: [
    region('beach', 'the beach: the wet band under the waterline, fine sand low and the berm’s cobbles up the back, the Posidonia wrack and sea balls, dry tufts against the shelf', { x: 100, y: 730, w: 560, h: 130 }, ['sea', 'beach', 'stones', 'shore'], 800),
    region('pool', 'a rock pool close up: the hand-cut edge in the shelf, the shaded far wall over a dark hollow, the lit near lip, pink crusts and weed at the waterline, the floor through clear water', { x: 330, y: 846, w: 140, h: 56 }, ['beach', 'stones', 'shore'], 700),
  ],
};

export default section;
