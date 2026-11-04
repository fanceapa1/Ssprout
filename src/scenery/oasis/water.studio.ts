/**
 * Studio: the oasis's water (O3): the whole water element, the basin's steps and sluice gate close
 * up, a seguia fall, the oued's sand bar, and the painting so far.
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

const IN_PLACE = ['ground', 'rock', 'walls', 'water'];

const section: StudioSection = {
  id: 'oasis-water',
  title: 'Scenery · oasis water',
  order: 143,
  entries: [
    region('water', 'the water element: the basin, the seguia with its falls, the sluice and the oued', { x: 260, y: 420, w: 1360, h: 600 }, ['water']),
    region('basin-corner', 'the basin’s far-right corner and overflow: the steps into the water, the sluice gate in its stone slots', { x: 940, y: 470, w: 200, h: 190 }, IN_PLACE),
    region('fall', 'a seguia fall over the middle terrace wall: the spill, the wet pisé, the splash and the inlet ripples', { x: 440, y: 540, w: 180, h: 110 }, IN_PLACE),
    region('oued-bar', 'the oued’s bend: milky water over gold sand, the braids round the bar, pebbles, lost-and-found edges', { x: 1220, y: 640, w: 380, h: 380 }, IN_PLACE),
    region('scene', 'the painting so far, with the water in it', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined),
  ],
};

export default section;
