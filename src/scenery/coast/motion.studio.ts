/**
 * Studio: the coast's water in motion (G6, ADRs 0282, 0374): each place animated over the still
 * painting, strips of frames a second apart, and the motion's sprites. Pause the studio to hold a frame.
 */
import { makeCanvas, paperTexture, type AnyCanvas } from '../../paint';
import type { Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST } from '.';
import { createCoastMotion, type CoastMotion } from './motion';

// the studio loads only the released gardens' painters; the coast is behind its flag
await COAST.painters.load();

const motions = new Map<number, CoastMotion>();
const motionFor = (seed: number): CoastMotion => {
  let m = motions.get(seed);
  if (!m) {
    m = createCoastMotion({ seed });
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
    const res = paintSceneSync({ ...COAST.art, seed }, { rect, scale: width / rect.w }, { sprites: false });
    c = makeCanvas(width, height);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, width, height);
    stills.set(key, c);
  }
  return c;
}

/** one view of the water at `t` */
function frame(canvas: AnyCanvas, rect: Rect, x: number, w: number, seed: number, t: number): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const h = canvas.height;
  const scale = w / rect.w;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, w, h);
  ctx.clip();
  ctx.drawImage(still(rect, seed, w, h) as CanvasImageSource, x, 0);
  ctx.setTransform(scale, 0, 0, scale, x - rect.x * scale, -rect.y * scale);
  const m = motionFor(seed);
  m.under?.(ctx, t);
  m.draw(ctx, t);
  ctx.restore();
}

/** the water moving (`animated`), or `frames` frames `step` seconds apart side by side */
function moving(id: string, label: string, rect: Rect, w: number, frames = 1, step = 1): StudioEntry {
  const gap = 8;
  return {
    id,
    label,
    w: w * frames + gap * (frames - 1),
    h: Math.round((w * rect.h) / rect.w),
    animated: frames === 1,
    render(canvas, { seed, t, pixelRatio }) {
      const ctx = canvas.getContext('2d')!;
      const fw = w * pixelRatio;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < frames; i++) frame(canvas as AnyCanvas, rect, Math.round(i * (fw + gap * pixelRatio)), Math.round(fw), seed, t + i * step);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const spriteSheet: StudioEntry = {
  id: 'coast-motion-sprites',
  label: 'the motion sprites on a clay grey: swell lights and troughs, glints, rings, the waterline’s lace, wet band and film, the rocks’ foam, the laps, the boat in pieces',
  w: 900,
  h: 420,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = '#9a8c80';
    ctx.fillRect(0, 0, 900, 420);
    const all = motionFor(seed).sprites();
    let x = 10;
    let y = 10;
    let row = 0;
    for (const s of all) {
      const k = Math.min(3, 120 / s.w, 90 / s.h);
      if (x + s.w * k > 890) {
        x = 10;
        y += row + 8;
        row = 0;
      }
      ctx.drawImage(s.image, x, y, s.w * k, s.h * k);
      x += s.w * k + 8;
      row = Math.max(row, s.h * k);
    }
  },
};

const COVE = { x: 0, y: 390, w: 940, h: 470 };
const BEACH = { x: 260, y: 700, w: 300, h: 130 };
const BOAT = { x: 330, y: 440, w: 150, h: 100 };
const ROCKS = { x: 520, y: 600, w: 300, h: 200 };
const POOLS = { x: 160, y: 860, w: 460, h: 70 };

const section: StudioSection = {
  id: 'coast-motion',
  title: 'Scenery · coast water in motion',
  order: 159,
  entries: [
    moving('cove', 'the cove: the swell’s light drifting in, glints far out, the wavelets, the rocks’ foam, the caique on its mooring', COVE, 900),
    moving('cove-frames', 'the cove a second apart', COVE, 440, 4),
    moving('beach', 'the waterline: wavelets running up the shingle, the lace, the wet band left, the draw back', BEACH, 600),
    moving('beach-frames', 'the waterline a second apart', BEACH, 300, 4),
    moving('boat', 'the caique: a bob, a roll, its reflection and the mooring line following, a ring now and then', BOAT, 600),
    moving('boat-frames', 'the caique a second apart', BOAT, 300, 4),
    moving('rocks', 'the bastion: foam swelling round the splash rocks and boulders, the lap along the ledge', ROCKS, 600),
    moving('pools', 'the rock pools: still mirrors, a slow ring now and then', POOLS, 700),
    spriteSheet,
  ],
};

export default section;
