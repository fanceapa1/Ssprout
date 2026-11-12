/**
 * Studio: the coast's water (G3): the sea alone and in place, the shoreline and the waterline close
 * up, the beach, the rock pools, the caique, and the painting so far.
 */
import { paperTexture } from '../../paint';
import { WORLD_H, WORLD_W, type Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST } from '.';

// the studio loads only the released gardens' painters; the coast is behind its flag
await COAST.painters.load();

function region(id: string, label: string, rect: Rect, only: readonly string[] | undefined, w = 800): StudioEntry {
  return {
    id,
    label,
    w,
    h: Math.round((w * rect.h) / rect.w),
    render(canvas, { seed }) {
      const scale = canvas.width / rect.w;
      const res = paintSceneSync({ ...COAST.art, seed }, { rect, scale }, { only, sprites: false });
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

const IN_PLACE = ['far', 'sea', 'rock', 'shore', 'beach', 'land', 'stones'];

const section: StudioSection = {
  id: 'coast-water',
  title: 'Scenery · coast water',
  order: 153,
  entries: [
    region('sea', 'the water alone: the sea from the deep through turquoise to the shallows, the seabed, the beach, the pools and the caique', { x: 0, y: 380, w: 940, h: 560 }, ['sea', 'beach']),
    region('cove', 'the cove in place: the far hill and the cliff mirrored, the shallows against the broken shoreline', { x: 0, y: 380, w: 960, h: 520 }, IN_PLACE),
    region('shoreline', 'the waterline close up: the water thinning over the sand, lacy foam, wet sand, splash rocks', { x: 300, y: 690, w: 300, h: 150 }, IN_PLACE),
    region('seat', 'a splash rock seated in the shallows: its broken reflection, the dark wet foot with weed, the foam ring and lap mark', { x: 530, y: 625, w: 130, h: 72 }, IN_PLACE),
    region('beach', 'the beach and pools: shingle graded wet to dry, the wrack line and shells, still pools in the shelf', { x: 120, y: 730, w: 520, h: 210 }, IN_PLACE),
    region('pool', 'a rock pool close up: clear water, a darker middle, the bottom, the far rim mirrored', { x: 330, y: 870, w: 140, h: 64 }, IN_PLACE),
    region('caique', 'the moored caique close up: hull bands, mast and furled sail, mooring line and buoy, its reflection', { x: 330, y: 440, w: 150, h: 90 }, IN_PLACE),
    region('scene', 'the painting so far, with the water in it', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined),
  ],
};

export default section;
