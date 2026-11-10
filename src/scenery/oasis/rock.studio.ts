/**
 * Studio: the oasis's rock (O2, O9, O10, O13): the whole rock element (bluff and ksar), the ksar close
 * up, its tallest tower and the seat in the rock, the bluff's two ends, and the painting so far.
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
    region('rock', 'the rock element: the bluff (beds shared across the face, overhanging caprock, buttresses lit and shaded by plane, V gullies onto scree cones, varnish) and the ksar on it', { x: -20, y: 120, w: 1060, h: 380 }, ['rock']),
    region('ksar', 'the ksar close up: tapering pisé towers with rounded horns and worn merlons, houses stepping back, ruined curtain walls, all growing out of the rock', { x: 420, y: 130, w: 490, h: 240 }, ['rock']),
    region('tower', 'the tallest tower and its seat: wet-in-wet pisé, lit flank, carved band in loose brush marks, openings with palm-wood lintels, the rock rising into its foot', { x: 590, y: 140, w: 200, h: 220 }, ['rock'], 600),
    region('shoulder', 'the bluff’s right end: the prow lit to the sun, core shade, ledges, the rock carried up into the east tower, scree at the foot', { x: 800, y: 280, w: 260, h: 210 }, ['rock']),
    region('ridge', 'the bluff’s left end: the ridge’s crown, caprock bands running on across its buttresses, V gullies notching the rim, the west face in cool shade', { x: -20, y: 200, w: 460, h: 290 }, ['rock']),
    region('scene', 'the painting so far, with the rock in it', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined),
  ],
};

export default section;
