/**
 * Studio: the oasis's vegetation (O4): the grove in its three storeys, a big palm's trunk and
 * crown close up, the notch palm, and the painting with them in place.
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

const IN_PLACE = ['far', 'ground', 'grove', 'rock', 'walls', 'water', 'palms'];

const section: StudioSection = {
  id: 'oasis-veg',
  title: 'Scenery · oasis vegetation',
  order: 144,
  entries: [
    region('veg', 'the vegetation alone: the grove (palms over fruit trees over crops) and the big palms', { x: 900, y: -100, w: 760, h: 700 }, ['grove', 'palms']),
    region('grove', 'the grove close up: hazy back palms, a nearer row, fig, pomegranate and olive masses, the crops', { x: 1040, y: 240, w: 420, h: 260 }, IN_PLACE),
    region('big-palm', 'a big palm: the leaf-base lattice, the sun on its right flank, its crown and dates', { x: 1300, y: -40, w: 320, h: 640 }, IN_PLACE, 500),
    region('notch-palm', 'the small notch palm right of the low suns, over the grove', { x: 1020, y: 100, w: 300, h: 400 }, IN_PLACE, 500),
    region('scene', 'the painting with the vegetation in it', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined),
  ],
};

export default section;
