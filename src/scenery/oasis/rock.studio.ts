/**
 * Studio: the oasis's rock (O2): the whole rock element (bluff and ksar), the ksar close up (horns,
 * incised bands, windows, the seat in the rock), the bluff's shoulder, and the painting so far.
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

const section: StudioSection = {
  id: 'oasis-rock',
  title: 'Scenery · oasis rock',
  order: 142,
  entries: [
    region('rock', 'the rock element: the bluff (conglomerate, sandstone beds, runnels) and the ksar on it', { x: -20, y: 120, w: 1060, h: 380 }, ['rock']),
    region('ksar', 'the ksar close up: tapering pisé towers, horned merlons, incised chevrons and diamonds, the seat in the rock', { x: 420, y: 130, w: 490, h: 240 }, ['rock']),
    region('shoulder', 'the bluff’s rounded, broken shoulder: lit face to the sun, core shade, beds wrapping round', { x: 820, y: 290, w: 240, h: 200 }, ['rock']),
    region('scene', 'the painting so far, with the rock in it', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined),
  ],
};

export default section;
