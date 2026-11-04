/**
 * Studio: the oasis's land (O4): the far ranges and dunes, the terraces and their pisé walls,
 * the near plots, bund and footpath, the foreground's jar and stone channel, and the whole land.
 */
import { paperTexture } from '../../paint';
import { WORLD_H, WORLD_W, type Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { OASIS } from '.';

function region(id: string, label: string, rect: Rect, only: readonly string[] | undefined, w = 800): StudioEntry {
  return {
    id,
    label,
    w,
    h: Math.round((w * rect.h) / rect.w),
    render(canvas, { seed }) {
      const scale = canvas.width / rect.w;
      const res = paintSceneSync({ ...OASIS.art, seed }, { rect, scale }, { only, sprites: false });
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const LAND = ['far', 'ground', 'walls', 'near'];
const IN_PLACE = ['far', 'ground', 'rock', 'walls', 'water', 'near'];

const section: StudioSection = {
  id: 'oasis-land',
  title: 'Scenery · oasis land',
  order: 145,
  entries: [
    region('land', 'the land alone: ranges, dunes, sand, terraces, walls, plots, footpath, foreground', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, LAND),
    region('far', 'the far flat-topped ranges and the golden dunes behind the grove', { x: 780, y: 280, w: 840, h: 220 }, ['far']),
    region('terraces', 'the terraces under the bluff: worked soil along the contours, the pisé walls with crumbled caps and damp feet', { x: 0, y: 440, w: 560, h: 240 }, IN_PLACE),
    region('near', 'the near ground: the plots and their bund, the stone channel at the seguia, the footpath, the broken jar, dry grass', { x: 200, y: 700, w: 1100, h: 320 }, IN_PLACE),
    region('scene', 'the painting with the land in it', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined),
  ],
};

export default section;
