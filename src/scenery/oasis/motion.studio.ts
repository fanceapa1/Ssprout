/**
 * Studio: the oasis's water in motion (O6, ADR 0282): each element animated over the still
 * painting, three frames 0.4 s apart, and the motion's sprite set. Pause the studio to hold a frame.
 */
import { makeCanvas, paperTexture, type AnyCanvas } from '../../paint';
import type { Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { OASIS } from '.';
import { createOasisMotion, type OasisMotion } from './motion';

const motions = new Map<number, OasisMotion>();
const motionFor = (seed: number): OasisMotion => {
  let m = motions.get(seed);
  if (!m) {
    m = createOasisMotion({ seed });
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
    const res = paintSceneSync({ ...OASIS.art, seed }, { rect, scale }, { sprites: true });
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

/** one view of the water at `t`, the paper multiplied over it */
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
  motionFor(seed).draw(ctx, t);
  ctx.restore();
}

/** the water moving (`animated`), or three frames at t, t + 0.4 and t + 0.8 side by side */
function moving(id: string, label: string, rect: Rect, w: number, frames = 1): StudioEntry {
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
      for (let i = 0; i < frames; i++) frame(canvas as AnyCanvas, rect, i * (fw + gap * pixelRatio), Math.round(fw), seed, t + i * 0.4);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const spriteSheet: StudioEntry = {
  id: 'oasis-motion-sprites',
  label: 'the motion sprites on a clay grey: fall sheens, shades, threads, splash puffs and pool, gate glass, rings, glints, riffles, bar-head partings',
  w: 800,
  h: 300,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = '#9a8c80';
    ctx.fillRect(0, 0, 800, 300);
    const all = motionFor(seed).sprites();
    const falling = new Set(['sheen', 'shade', 'thread']);
    for (const [row, y, k] of [[all.filter((s) => falling.has(s.kind)), 10, 4], [all.filter((s) => !falling.has(s.kind) && s.kind !== 'ring'), 150, 3], [all.filter((s) => s.kind === 'ring'), 240, 1]] as const) {
      let x = 10;
      for (const s of row) {
        ctx.drawImage(s.image, x, y, s.w * k, s.h * k);
        x += s.w * k + 10;
      }
    }
  },
};

const FALLS_RECT = { x: 430, y: 470, w: 130, h: 150 };
const OUED_RECT = { x: 1280, y: 640, w: 300, h: 260 };
const GATE_RECT = { x: 1070, y: 585, w: 70, h: 50 };
const INLET_RECT = { x: 520, y: 560, w: 220, h: 80 };

const section: StudioSection = {
  id: 'oasis-motion',
  title: 'Scenery · oasis water in motion',
  order: 147,
  entries: [
    moving('falls', 'the seguia’s two small falls: sheens and shades sliding down, threads, the splash pulsing at each foot', FALLS_RECT, 360),
    moving('falls-frames', 'the falls at t, t + 0.4 s and t + 0.8 s', FALLS_RECT, 260, 3),
    moving('oued', 'the oued: glints and riffles drifting downstream, livelier at the bars’ heads, sparse over the braids', OUED_RECT, 600),
    moving('oued-frames', 'the oued at t, t + 0.4 s and t + 0.8 s', OUED_RECT, 300, 3),
    moving('gate', 'the sluice gate: a thin glassy sheet slipping over the board', GATE_RECT, 420),
    moving('inlet', 'the basin’s inlet: slow rings spreading from the notch, the rest a mirror', INLET_RECT, 660),
    moving('inlet-frames', 'the inlet at t, t + 2 s… (0.4 s apart: the rings are slow)', INLET_RECT, 300, 3),
    spriteSheet,
  ],
};

export default section;
