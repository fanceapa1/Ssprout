/**
 * Studio: the coast's land (G4): the terraces' gravel and beds, the dry-stone walls and their
 * flights, the gravel path, the jars, and the whole land in place.
 */
import { paperTexture } from '../../paint';
import { WORLD_H, WORLD_W, type Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST } from '.';

// the studio loads only the released gardens' painters; the coast is behind its flag
await COAST.painters.load();

export function coastRegion(id: string, label: string, rect: Rect, only: readonly string[] | undefined, w = 800): StudioEntry {
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

const IN_PLACE = ['far', 'sea', 'rock', 'shore', 'land', 'trees', 'near'];

const section: StudioSection = {
  id: 'coast-land',
  title: 'Scenery · coast land',
  order: 156,
  entries: [
    coastRegion('land', 'the land alone: gravel terraces, beds, walls and flights, the path, the jars', { x: 600, y: 480, w: 1020, h: 540 }, ['land']),
    coastRegion('wall', 'a dry-stone wall close up with the bed above it: fitted limestone, dark joints, the lit coping, lichen, a crack slot', { x: 1180, y: 640, w: 320, h: 200 }, IN_PLACE),
    coastRegion('beds', 'the middle terrace’s empty beds side by side: each its own outline, soil and furrows, all quiet and mid-toned', { x: 760, y: 610, w: 820, h: 120 }, IN_PLACE),
    coastRegion('steps', 'the path climbing the walls by its stone flights, and the flight down to the beach', { x: 620, y: 680, w: 440, h: 320 }, IN_PLACE),
    coastRegion('scene', 'the painting with the land in it', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined),
  ],
};

export default section;
