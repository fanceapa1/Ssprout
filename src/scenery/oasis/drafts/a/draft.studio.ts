/**
 * Studio: oasis draft A, "Ksar & palmeraie" (phase 13, round 2): the whole world, the world with
 * ghost plants, the phone crop, the composition map with true-size plant boxes, the ksar close up.
 */
import { createPainter, makeCanvas, paperTexture, type AnyCanvas } from '../../../../paint';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt, type Rect } from '../../../../render/viewport';
import type { StudioEntry, StudioSection } from '../../../../studio/types';
import { GARDEN_PLANT_SCALE, PLANT_SIZES, perspectiveScale } from '../../../../scene/slots';
import { BASIN, BLUFF, FAR_RANGE, FOCUS, OUED, SEGUIA_RUNS, SLOTS, WALLS, type DraftSlot } from './layout';
import { paintDraftA } from './paint';

const cache = new Map<string, AnyCanvas>();

/** The painting of `rect` at `scale` canvas pixels per world unit, on white (no paper yet). */
function painting(rect: Rect, scale: number, seed: number): AnyCanvas {
  const key = `${seed}:${scale}:${rect.x},${rect.y},${rect.w},${rect.h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = makeCanvas(Math.round(rect.w * scale), Math.round(rect.h * scale));
  const p = createPainter(canvas, { seed, quality: 'normal' });
  p.ctx.fillStyle = '#ffffff';
  p.ctx.fillRect(0, 0, canvas.width, canvas.height);
  p.ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
  paintDraftA(p, seed);
  p.ctx.setTransform(1, 0, 0, 1, 0, 0);
  cache.set(key, canvas);
  return canvas;
}

function withPaper(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

const WHOLE: Rect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };

function view(id: string, label: string, rect: Rect, w: number, own = false): StudioEntry {
  return {
    id,
    label,
    w,
    h: Math.round((w * rect.h) / rect.w),
    render(canvas, { seed }) {
      const ctx = canvas.getContext('2d')!;
      const scale = canvas.width / rect.w;
      if (own) {
        ctx.drawImage(painting(rect, scale, seed) as CanvasImageSource, 0, 0);
      } else {
        // crops share one painting of the whole world at this scale
        const world = painting(WHOLE, scale, seed);
        ctx.drawImage(world as CanvasImageSource, rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale, 0, 0, canvas.width, canvas.height);
      }
      withPaper(canvas);
    },
  };
}

function path(ctx: CanvasRenderingContext2D, pts: readonly Pt[], close: boolean): void {
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  if (close) ctx.closePath();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour = '#3a2a22'): void {
  ctx.font = 'italic 600 22px Georgia, serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/** A slot's plant box in world units: size class × perspective × the garden's 1.25, base-anchored. */
function plantBox(s: DraftSlot): Rect {
  const k = perspectiveScale(s.y) * GARDEN_PLANT_SCALE;
  const { w, h } = PLANT_SIZES[s.size];
  return { x: s.x - (w * k) / 2, y: s.y - h * k, w: w * k, h: h * k };
}

/** A faint plant silhouette filling its box: a canopy on a trunk for trees, a tuft otherwise. */
function ghost(ctx: CanvasRenderingContext2D, s: DraftSlot): void {
  const b = plantBox(s);
  ctx.fillStyle = 'rgba(70,110,40,0.42)';
  ctx.beginPath();
  if (s.size === 'tree') {
    ctx.ellipse(b.x + b.w / 2, b.y + b.h * 0.36, b.w * 0.48, b.h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(b.x + b.w * 0.46, b.y + b.h * 0.6, b.w * 0.08, b.h * 0.4);
    return;
  }
  ctx.ellipse(b.x + b.w / 2, b.y + b.h * 0.55, b.w * 0.46, b.h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,80,110,0.5)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(b.x + b.w * (0.3 + i * 0.2), b.y + b.h * (0.25 + (i % 2) * 0.12), Math.min(b.w, b.h) * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

const ghosts: StudioEntry = {
  id: 'ghosts',
  label: 'the world with ghost plants: the 25 slots as faint silhouettes at true plant size',
  w: 1600,
  h: 1000,
  render(canvas, { seed }) {
    const ctx = canvas.getContext('2d')!;
    const k = canvas.width / WORLD_W;
    ctx.drawImage(painting(WHOLE, k, seed) as CanvasImageSource, 0, 0);
    withPaper(canvas);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    for (const s of [...SLOTS].sort((a, b) => a.y - b.y)) ghost(ctx, s);
  },
};

const map: StudioEntry = {
  id: 'map',
  label: 'composition map: landforms, the 25 slots as true-size plant boxes (size class × perspective × 1.25), UI corners, focus and phone crop',
  w: 1200,
  h: 750,
  render(canvas, { seed }) {
    const ctx = canvas.getContext('2d')!;
    const k = canvas.width / WORLD_W;
    ctx.globalAlpha = 0.45;
    ctx.drawImage(painting(WHOLE, k, seed) as CanvasImageSource, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#8f4a3e';
    path(ctx, BLUFF, true);
    ctx.stroke();
    ctx.strokeStyle = '#7d6aa0';
    path(ctx, FAR_RANGE, false);
    ctx.stroke();
    ctx.strokeStyle = '#9a5c4e';
    for (const w of WALLS) {
      path(ctx, w.edge, false);
      ctx.stroke();
    }
    ctx.strokeStyle = '#235b78';
    path(ctx, OUED, true);
    ctx.stroke();
    path(ctx, BASIN, true);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (const r of SEGUIA_RUNS) {
      path(ctx, r, false);
      ctx.stroke();
    }
    // UI corners (button top-left, icons top-right) in world units
    ctx.fillStyle = 'rgba(80,80,90,0.18)';
    ctx.fillRect(0, 0, 290, 100);
    ctx.fillRect(1210, 22, 370, 68);
    // slots: base-anchored boxes, back to front
    for (const s of [...SLOTS].sort((a, b) => a.y - b.y)) {
      const b = plantBox(s);
      ctx.fillStyle = 'rgba(122,150,60,0.22)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#4f6a1c';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#4f6a1c';
      ctx.fill();
      ctx.font = 'italic 600 16px Georgia, serif';
      ctx.fillText(s.size, b.x + 4, b.y + 16);
    }
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = '#d9623d';
    ctx.lineWidth = 3;
    ctx.strokeRect(FOCUS.x - MIN_VISIBLE_W / 2, 2, MIN_VISIBLE_W, WORLD_H - 4);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(FOCUS.x - 18, FOCUS.y);
    ctx.lineTo(FOCUS.x + 18, FOCUS.y);
    ctx.moveTo(FOCUS.x, FOCUS.y - 18);
    ctx.lineTo(FOCUS.x, FOCUS.y + 18);
    ctx.stroke();
    label(ctx, 'ksar on the red bluff', 300, 330, '#8f4a3e');
    label(ctx, 'stone basin', 760, 560, '#235b78');
    label(ctx, 'oued', 1420, 700, '#235b78');
    label(ctx, 'seguia falls', 330, 540, '#235b78');
    label(ctx, 'big palms', 1300, 300, '#3d5214');
    label(ctx, `phone crop · focus · ${SLOTS.length} slots`, FOCUS.x - MIN_VISIBLE_W / 2 + 10, 130, '#d9623d');
  },
};

const section: StudioSection = {
  id: 'oasis-draft-a',
  title: 'Oasis draft A · Ksar & palmeraie',
  order: 140,
  entries: [
    view('world', 'the whole world from the basin terrace: the ksar bluff close behind, big palms, the basin, seguia falls and the oued', WHOLE, 1600),
    ghosts,
    view('phone', 'phone crop: 600 wide round the focus (the basin\'s near rim)', { x: FOCUS.x - 300, y: 0, w: 600, h: WORLD_H }, 600),
    map,
    view('ksar', 'close view: the ksar on the bluff, its lit flanks, pisé courses and chevron bands', { x: 220, y: 0, w: 640, h: 340 }, 1280, true),
  ],
};

export default section;
