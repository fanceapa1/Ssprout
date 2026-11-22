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
    region('promontory', 'the limestone promontory: blocks in light and shade planes, beds of uneven tilt with crumbling ledges and overhangs, wandering and branching fissures, rust stains, the undercut and wet band at the sea, the cliff’s foot', { x: 600, y: 270, w: 1000, h: 260 }, undefined, 1400),
    region('point', 'the promontory’s point under the temple: the soft undercut and dark wet band at the sea, ledges and planes', { x: 620, y: 300, w: 420, h: 220 }, undefined, 1200),
    region('cliff-foot', 'the cliff’s foot behind the top terrace: the base in cool shade, an uneven foot over the gravel, its shadow, scree fans and fallen stones', { x: 900, y: 430, w: 420, h: 110 }, undefined, 1200),
    region('temple', 'the temple close up: a broken krepis, Doric shafts with drum joints and broken fluting, two capitals under the architrave, two broken columns, the fallen drum and blocks', { x: 640, y: 270, w: 270, h: 150 }, undefined, 900),
    region('village', 'the far hill across the bay in haze: gullies, old field terraces with olive groves, maquis patches, the road climbing in hairpins to the blue-domed chapel, the whitewashed village with a few tiled roofs and pastel walls, cypresses and a bell tower; a far ridge behind', { x: -20, y: 280, w: 560, h: 130 }, undefined, 900),
    region('harbour', 'the far hill’s foot at the water and the horizon’s gap: low rocky points, the quay under the lower houses, the mole and its light, small boats moored and two drawn up on the shingle; a pale far coast, a nearer island before it, a far sail', { x: 190, y: 360, w: 500, h: 52 }, undefined, 1000),
    region('ledges', 'the point’s face: the limestone’s warm and cool patches, scrub caught on the ledges, black lichen above the wet foot and orange lichen in the spray', { x: 630, y: 370, w: 420, h: 130 }, undefined, 1200),
    region('shore', 'the shore’s rock: the platform’s faces and rims, fallen blocks, the sea-worn splash rocks (dry tops where the slots stand, wet weedy feet, reflections, foam), the shelf with sand in its hollows and its pools’ rims, the beach flight', { x: 0, y: 580, w: 900, h: 440 }),
    region('platform', 'the platform above the sea (GO1, ADR 0388): the top terrace’s headland and the bastion, bedded limestone faces from the floor’s rim to the sea, lit corners and rims, wet feet with weed, foam and fallen blocks; the back edges as the floor’s rock lip over deeper water', { x: 640, y: 480, w: 280, h: 340 }, undefined, 700),
    region('beach-steps', 'the platform’s corner over the beach: the stair’s stepped side rising out of the sand, the four slabs up to the lower terrace, the lower terrace’s rim over the bastion’s cove, the lower wall’s end', { x: 600, y: 760, w: 200, h: 120 }, undefined, 1000),
    region('rock-alone', 'the rock painters alone, on white: far hill, village, promontory, temple, the cliff’s foot, the platform and shore rocks', { x: 0, y: 270, w: 1600, h: 750 }, ['far', 'rock', 'stones']),
  ],
};

export default section;
