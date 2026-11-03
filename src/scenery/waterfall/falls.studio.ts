/**
 * Studio: the falls in motion (S9, ADR 0282): the sheet and the foot animated over the still
 * painting, and the motion's sprite set. Pause the studio to hold a frame.
 */
import { makeCanvas, paperTexture, type AnyCanvas } from '../../paint';
import type { Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { WATERFALL } from '.';
import { createFallsMotion, type FallsMotion } from './falls';

const motions = new Map<number, FallsMotion>();
const motionFor = (seed: number): FallsMotion => {
  let m = motions.get(seed);
  if (!m) {
    m = createFallsMotion({ seed });
    for (const _ of m.prepare());
    motions.set(seed, m);
  }
  return m;
};

/** the still painting of `rect` at the canvas's scale, painted once per seed and size */
const stills = new Map<string, AnyCanvas>();
function still(rect: Rect, seed: number, width: number, height: number): AnyCanvas {
  const key = `${rect.x},${rect.y},${rect.w}:${seed}:${width}`;
  let c = stills.get(key);
  if (!c) {
    const scale = width / rect.w;
    const res = paintSceneSync({ ...WATERFALL.art, seed }, { rect, scale }, { sprites: true });
    c = makeCanvas(width, height);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, width, height);
    ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
    for (const s of [...res.sprites].sort((a, b) => a.depth - b.depth)) ctx.drawImage(s.canvas as CanvasImageSource, s.box.x, s.box.y, s.box.w, s.box.h);
    stills.set(key, c);
  }
  return c;
}

function moving(id: string, label: string, rect: Rect, w: number): StudioEntry {
  return {
    id,
    label,
    w,
    h: Math.round((w * rect.h) / rect.w),
    animated: true,
    render(canvas, { seed, t }) {
      const ctx = canvas.getContext('2d')!;
      const scale = canvas.width / rect.w;
      ctx.drawImage(still(rect, seed, canvas.width, canvas.height) as CanvasImageSource, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
      motionFor(seed).draw(ctx, t);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const spriteSheet: StudioEntry = {
  id: 'falls-sprites',
  label: 'the motion sprites on a wet-rock grey: surges, lights, threads, foam puffs, churn shades, mist',
  w: 800,
  h: 400,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = '#9a968c';
    ctx.fillRect(0, 0, 800, 400);
    const all = motionFor(seed).sprites();
    const falling = new Set(['surge', 'light', 'thread']);
    for (const [row, y, k] of [[all.filter((s) => falling.has(s.kind)), 12, 1.5], [all.filter((s) => !falling.has(s.kind)), 250, 1]] as const) {
      let x = 10;
      for (const s of row) {
        ctx.drawImage(s.image, x, y, s.w * k, s.h * k);
        x += s.w * k + 10;
      }
    }
  },
};

const section: StudioSection = {
  id: 'waterfall-falls-motion',
  title: 'Scenery · waterfall falls in motion',
  order: 107,
  entries: [
    moving('falls-sheet', 'the sheet falling: pale surges and lifted lights over the still streaks, threads, the foot churning', { x: 500, y: 270, w: 240, h: 380 }, 480),
    moving('falls-foot', 'the plunge close up: white puffs swelling, cool shades rolling in the foam, mist drifting off', { x: 500, y: 520, w: 260, h: 130 }, 800),
    spriteSheet,
  ],
};

export default section;
