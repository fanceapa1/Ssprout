/**
 * Studio: oasis draft A, "Ksar & palmeraie" (phase 13): the whole world, the phone crop round the
 * focus, the composition map with the plantable zones, and a close view of the ksar.
 */
import { createPainter, makeCanvas, paperTexture, type AnyCanvas } from '../../../../paint';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt, type Rect } from '../../../../render/viewport';
import type { StudioEntry, StudioSection } from '../../../../studio/types';
import { BASIN, BLUFF, DUNE_BASE, FAR_RANGE, FOCUS, KSAR, OUED, SEGUIA, WALLS, ZONES } from './layout';
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

const map: StudioEntry = {
  id: 'map',
  label: 'composition map: landforms, the 25 plantable places (zones · slot count), focus and the phone crop',
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
    ctx.strokeStyle = '#b07a2a';
    ctx.beginPath();
    ctx.moveTo(500, DUNE_BASE);
    ctx.lineTo(1600, DUNE_BASE - 10);
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
    path(ctx, SEGUIA, false);
    ctx.stroke();
    // plantable zones with their slot counts
    let total = 0;
    for (const z of ZONES) {
      total += z.n;
      ctx.beginPath();
      ctx.ellipse(z.cx, z.cy, z.rx, z.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(122,150,60,0.25)';
      ctx.fill();
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#4f6a1c';
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < z.n; i++) {
        const x = z.cx + (z.n === 1 ? 0 : (i / (z.n - 1) - 0.5) * z.rx * 1.5);
        ctx.beginPath();
        ctx.arc(x, z.cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#4f6a1c';
        ctx.fill();
      }
      label(ctx, `${z.label} · ${z.n}`, z.cx - z.rx * 0.6, z.cy - z.ry - 6, '#3d5214');
    }
    // focus and phone crop
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
    label(ctx, 'ksar', KSAR[3]!.x - 10, 100);
    label(ctx, 'red-ochre bluff', 120, 400, '#8f4a3e');
    label(ctx, 'lilac ranges', 1180, 230, '#5d4c80');
    label(ctx, 'golden dunes', 1260, 330, '#8a5a1a');
    label(ctx, 'palm grove', 1300, 470, '#3d5214');
    label(ctx, 'seguia', 480, 530, '#235b78');
    label(ctx, 'basin', 760, 580, '#235b78');
    label(ctx, 'oued', 1460, 860, '#235b78');
    label(ctx, 'sun (open sky)', 1250, 120, '#b07a2a');
    label(ctx, `phone crop · focus · ${total} slots`, FOCUS.x - MIN_VISIBLE_W / 2 + 10, 30, '#d9623d');
  },
};

const section: StudioSection = {
  id: 'oasis-draft-a',
  title: 'Oasis draft A · Ksar & palmeraie',
  order: 140,
  entries: [
    view('world', 'the whole world: ksar on the red bluff, palm terraces, seguia and basin, the oued bend', WHOLE, 1600),
    view('phone', 'phone crop: 600 wide round the focus (the basin)', { x: FOCUS.x - 300, y: 0, w: 600, h: WORLD_H }, 600),
    map,
    view('ksar', 'close view: the ksar on the bluff, its lit flanks, pisé courses and chevron bands', { x: 60, y: 100, w: 640, h: 300 }, 1280, true),
  ],
};

export default section;
