/**
 * Dev overlay (`?dev&slots`): every slot as a habitat-coloured marker with its id and max size,
 * the pond polygon, the rocks (perches marked) and the sky band — for reviewing placement.
 */
import type { Habitat } from '../plants/types';
import type { SceneGeometry } from './geometry';
import { PLANT_SIZES } from './slots';

export const HABITAT_COLOURS: Record<Habitat, string> = {
  water: '#3f7f8f',
  shore: '#6a4fa8',
  meadow: '#5c7a2e',
  path: '#8a6a3a',
  back: '#2f4a6a',
  rock: '#c0452a',
};

const SIZE_LABEL = { small: 'S', medium: 'M', large: 'L', tree: 'T' } as const;

export function drawSlotOverlay(ctx: CanvasRenderingContext2D, scene: SceneGeometry, opts: { boxes?: boolean } = {}): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = 'rgba(40,90,110,0.6)';
  ctx.beginPath();
  scene.pond.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,60,160,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, scene.skyBand.top);
  ctx.lineTo(1600, scene.skyBand.top);
  ctx.moveTo(0, scene.skyBand.bottom);
  ctx.lineTo(1600, scene.skyBand.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const r of scene.rocks) {
    ctx.strokeStyle = r.perch ? 'rgba(200,60,40,0.7)' : 'rgba(80,80,80,0.5)';
    ctx.strokeRect(r.x - r.w / 2, r.y - r.h, r.w, r.h);
  }
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const s of scene.slots) {
    const c = HABITAT_COLOURS[s.habitat];
    if (opts.boxes ?? true) {
      // the box a plant of the slot's max size would occupy (base at the slot)
      const size = PLANT_SIZES[s.maxSize];
      const w = size.w * s.scale;
      const h = size.h * s.scale;
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.28;
      ctx.strokeRect(s.x - w / 2, s.y - h, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = c;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const label = `${s.id} ${SIZE_LABEL[s.maxSize]}`;
    ctx.lineWidth = 3;
    ctx.strokeText(label, s.x + 10, s.y);
    ctx.fillText(label, s.x + 10, s.y);
  }
  ctx.restore();
}
