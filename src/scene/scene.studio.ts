/**
 * Studio entries for the painted scene: the full garden, the slot overlay, each element alone
 * and the animated water surface. Same pipeline as the app: paint on white, draw the
 * foreground sprites, multiply the washi paper last.
 */
import { paperTexture, type AnyCanvas } from '../paint';
import { WORLD_H, WORLD_W, type Rect } from '../render/viewport';
import type { StudioEntry, StudioSection } from '../studio/types';
import { GARDEN_ART, paintSceneSync, type ElementId, type PaintResult } from './background';
import { drawSlotOverlay } from './overlay';
import { createWaterSurface } from './water';

const WORLD: Rect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
const cache = new Map<string, PaintResult>();
const papers = new Map<string, AnyCanvas>();

function painted(seed: number, rect: Rect, scale: number, only?: readonly ElementId[], sprites = true): PaintResult {
  const key = `${seed}|${rect.x},${rect.y},${rect.w},${rect.h}|${scale.toFixed(4)}|${only?.join(',') ?? 'all'}|${sprites}`;
  let r = cache.get(key);
  if (!r) {
    r = paintSceneSync({ ...GARDEN_ART, seed }, { rect, scale }, { only, sprites });
    cache.set(key, r);
  }
  return r;
}

function paper(w: number, h: number): AnyCanvas {
  const key = `${w}x${h}`;
  let p = papers.get(key);
  if (!p) {
    p = paperTexture(w, h, 1);
    papers.set(key, p);
  }
  return p;
}

/** Composite a painted view (+ sprites) onto the studio canvas, optionally with extras, then paper. */
function compose(
  canvas: HTMLCanvasElement,
  res: PaintResult,
  extra?: (ctx: CanvasRenderingContext2D) => void,
  spriteFilter: (id: string) => boolean = () => true,
): void {
  const ctx = canvas.getContext('2d')!;
  const { rect, scale } = res.view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const k = canvas.width / (rect.w * scale);
  ctx.setTransform(scale * k, 0, 0, scale * k, -rect.x * scale * k, -rect.y * scale * k);
  extra?.(ctx);
  for (const s of [...res.sprites].sort((a, b) => a.depth - b.depth)) {
    if (!spriteFilter(s.id)) continue;
    ctx.drawImage(s.canvas as CanvasImageSource, s.box.x, s.box.y, s.box.w, s.box.h);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(paper(canvas.width, canvas.height) as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

function region(id: string, label: string, rect: Rect, only: readonly ElementId[] | undefined, spriteFilter?: (id: string) => boolean, w = 560): StudioEntry {
  const h = Math.round((w * rect.h) / rect.w);
  return {
    id,
    label,
    w,
    h,
    render(canvas, { seed }) {
      const scale = canvas.width / rect.w;
      const res = painted(seed, rect, scale, only, spriteFilter !== undefined);
      compose(canvas, res, undefined, spriteFilter);
    },
  };
}

const full: StudioEntry = {
  id: 'full',
  label: 'full garden (world 1600×1000)',
  w: 800,
  h: 500,
  render(canvas, { seed }) {
    compose(canvas, painted(seed, WORLD, canvas.width / WORLD_W));
  },
};

const slots: StudioEntry = {
  id: 'slots',
  label: 'garden with slot overlay (habitat · id · max size)',
  w: 800,
  h: 500,
  render(canvas, { seed }) {
    const res = painted(seed, WORLD, canvas.width / WORLD_W);
    compose(canvas, res);
    const ctx = canvas.getContext('2d')!;
    const k = canvas.width / WORLD_W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawSlotOverlay(ctx, GARDEN_ART.scene);
  },
};

const waterSurface = createWaterSurface(GARDEN_ART.scene);
const water: StudioEntry = {
  id: 'water',
  label: 'animated water surface (shimmer, ripple rings, glints)',
  w: 640,
  h: 320,
  animated: true,
  render(canvas, { seed, t }) {
    const rect: Rect = { x: 440, y: 430, w: 960, h: 480 };
    const scale = canvas.width / rect.w;
    const res = painted(seed, rect, scale, ['pond', 'reflections', 'banks', 'path'], true);
    compose(canvas, res, (ctx) => waterSurface.draw(ctx, t));
  },
};

const section: StudioSection = {
  id: 'scene',
  title: 'Scene · painted garden',
  order: 100,
  entries: [
    full,
    slots,
    water,
    region('pond', 'pond with reflections', { x: 420, y: 420, w: 980, h: 330 }, ['pond', 'reflections'], () => true),
    region('pavilion', 'pavilion (engawa corner, lantern)', { x: 1230, y: 130, w: 370, h: 560 }, ['pavilion'], undefined, 320),
    region('boulders', 'boulder set (foreground sprites)', { x: 400, y: 420, w: 1000, h: 340 }, [], () => true),
    region('trees-left', 'tree group, left', { x: 0, y: 40, w: 640, h: 470 }, ['trees'], undefined, 480),
    region('trees-right', 'tree group, right', { x: 980, y: 80, w: 340, h: 400 }, ['trees'], undefined, 300),
    region('path', 'stepping-stone path + tufts', { x: 560, y: 700, w: 480, h: 300 }, ['path', 'tufts'], (id) => id.startsWith('tuft')),
  ],
};

export default section;
