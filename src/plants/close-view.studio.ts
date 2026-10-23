/**
 * Studio: a plant seen close (ADR 0187). The same plant over the far bank's hill line at the
 * camera's closest zoom: left, its overview sprite (1× resolution bucket) upscaled, as a glide
 * first shows it; right, the close view's sprite. Both are laid down twice when painted, so the
 * hill line does not cross the leaves, and they should read the same — the right one sharper.
 */
import { GARDEN_ART, paintSceneSync, type PaintResult } from '../scene/background';
import { plantScale } from '../scene/slots';
import type { StudioSection } from '../studio/types';
import { allSpecies } from './registry';
import { FINAL_STEP, paintSprite, resolutionBucket, spritePixelSize } from './sprites';

const PANEL = 300;
/** a slot on the far bank: the hills and the bank's lip run behind the plant */
const SPOT = { x: 330, y: 470, scale: 0.6 };

let backdrop: PaintResult | null = null;
const backdropOf = () => (backdrop ??= paintSceneSync(GARDEN_ART, { rect: { x: 150, y: 250, w: 360, h: 300 }, scale: 2.8 }, { only: ['sky', 'hills', 'banks'], sprites: false }));

const section: StudioSection = {
  id: 'close-view-plants',
  title: 'Close view · a plant (overview sprite | close sprite)',
  order: 262,
  entries: [
    {
      id: 'solid',
      label: 'a plant over the hill line at 3×: 1× sprite upscaled (left), close sprite (right)',
      w: PANEL * 2 + 10,
      h: PANEL,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        const species = allSpecies().filter((s) => s.sizeClass !== 'tree');
        const def = species[(seed - 1 + species.length * 10) % species.length]!;
        const k = plantScale({ scale: SPOT.scale });
        const box = { w: def.size.w * k, h: def.size.h * k };
        const rect = { x: SPOT.x - box.w * 0.6, y: SPOT.y - box.h * 1.05, w: box.w * 1.2, h: box.w * 1.2 };
        const bg = backdropOf();
        const sprites = [1.8, 5.4].map((ps) => paintSprite(def, { speciesId: def.id, seed: 1000 + seed, step: FINAL_STEP, ...spritePixelSize(def.size, k, resolutionBucket(ps)) }));
        sprites.forEach((sp, i) => {
          const x = i * (PANEL + 10);
          const s = (PANEL * pixelRatio) / rect.w;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.beginPath();
          ctx.rect(x * pixelRatio, 0, PANEL * pixelRatio, PANEL * pixelRatio);
          ctx.clip();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x * pixelRatio, 0, PANEL * pixelRatio, PANEL * pixelRatio);
          ctx.setTransform(s, 0, 0, s, x * pixelRatio - rect.x * s, -rect.y * s);
          ctx.drawImage(bg.canvas as CanvasImageSource, bg.view.rect.x, bg.view.rect.y, bg.view.rect.w, bg.view.rect.h);
          if (sp) ctx.drawImage(sp.canvas as CanvasImageSource, SPOT.x - def.anchor.x * box.w, SPOT.y - def.anchor.y * box.h, box.w, box.h);
          ctx.restore();
        });
      },
    },
  ],
};

export default section;
