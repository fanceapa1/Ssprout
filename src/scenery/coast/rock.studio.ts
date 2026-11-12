/**
 * Studio: the coast's rock (G2): the promontory, the temple close up, the far hill and its
 * village, the shore's rock, each in the painting under the placeholder midday sky, and the rock
 * element alone.
 */
import { createRng } from '../../core/rng';
import { createPainter, paperTexture } from '../../paint';
import type { Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST } from '.';

// the studio loads only the released gardens' painters; the coast is behind its flag
await COAST.painters.load();

function region(id: string, label: string, rect: Rect, only?: readonly string[], w = 800): StudioEntry {
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
      if (!only) {
        const plate = document.createElement('canvas');
        plate.width = canvas.width;
        plate.height = canvas.height;
        const p = createPainter(plate);
        p.ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
        COAST.painters.get()!.sky.paint(p, createRng('coast-rock-sky'), 'midday');
        ctx.drawImage(plate, 0, 0);
      }
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const section: StudioSection = {
  id: 'coast-rock',
  title: 'Scenery · coast rock',
  order: 154,
  entries: [
    region('promontory', 'the limestone promontory: blocks in light and shade planes, tilted beds with lit ledges over undercuts, fissures, rust stains, the sea-cut notch and wet band, scree onto the top terrace', { x: 600, y: 270, w: 1000, h: 260 }, undefined, 1400),
    region('point', 'the promontory’s point under the temple: the notch and wet band at the sea, ledges and planes', { x: 620, y: 300, w: 420, h: 220 }, undefined, 1200),
    region('temple', 'the temple close up: a broken krepis, Doric shafts with drum joints and broken fluting, two capitals under the architrave, two broken columns, the fallen drum and blocks', { x: 640, y: 270, w: 270, h: 150 }, undefined, 900),
    region('village', 'the far hill across the bay in haze: maquis patches, cypresses, the whitewashed village stepping up the slope, the blue-domed chapel and its bell wall; a far ridge behind', { x: -20, y: 280, w: 560, h: 130 }, undefined, 900),
    region('shore', 'the shore’s rock: the shoreline’s lips and low faces, boulders, the splash rocks (dry tops where the slots stand, wet feet), the shelf with its pools’ rims, stones at the beach’s ends', { x: 0, y: 580, w: 900, h: 440 }),
    region('rock-alone', 'the rock painters alone, on white: far hill, village, promontory, temple and shore rocks', { x: 0, y: 270, w: 1600, h: 750 }, ['far', 'rock', 'stones']),
  ],
};

export default section;
