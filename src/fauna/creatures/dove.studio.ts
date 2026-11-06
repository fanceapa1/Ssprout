/**
 * Studio: the laughing dove close. Its poses side by side (rest, bow and coo, the nodding walk,
 * pecking, drinking, the clatter, the glide, the landing), and the real behaviour on close crops
 * of the oasis's painting: a palm crown, the basin's far rim, a plot.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { lerp, TAU } from '../math';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { drawDove, paintDove, REST_POSE, type DovePose } from './dove';

const stages = new Map<string, Stage>();

function close(id: string, label: string, spec: StageSpec, w: number): StudioEntry {
  const h = Math.round((w * spec.h) / spec.w);
  return {
    id,
    label,
    w,
    h,
    animated: true,
    render(canvas, { t, dt, seed, frame }) {
      const key = `${id}:${seed}`;
      let stage = stages.get(key);
      if (!stage || frame === 0) {
        stage = new Stage(spec, seed, 'dove', 'oasis');
        stages.set(key, stage);
        for (let s = 0; s < t; s += 1 / 30) {
          stage.tickRespawn(s);
          stage.sim.update(1 / 30, 0);
        }
      }
      stage.render(canvas, t, dt);
    },
  };
}

const walk = (ph: number): Partial<DovePose> => {
  const s = ph % 1;
  const thrust = s < 0.3 ? 0.5 - 0.5 * Math.cos((Math.PI * s) / 0.3) : 1 - (s - 0.3) / 0.7;
  const sw = Math.sin(ph * Math.PI);
  return { pitch: 0.1, tail: 0.05, headX: 1.3 * thrust - 0.4, headY: 0.3 * Math.sin(s * TAU), legNear: 0.42 * sw, legFar: -0.42 * sw, liftNear: Math.max(0, sw), liftFar: Math.max(0, -sw) };
};

/** Each pose, and where its feet (or body centre in flight) sit in the row. */
const POSES: { q: Partial<DovePose>; fly?: boolean }[] = [
  { q: {} },
  { q: { pitch: 0.43, headRot: 0.75, headY: 1, tail: -0.4, crouch: 0.4 } },
  { q: walk(0.1) },
  { q: walk(0.55) },
  { q: walk(1.1) },
  { q: { pitch: 0.55, headRot: 1.1, headX: 0.6, headY: 1.4, tail: -0.25 } },
  { q: { pitch: 0.73, crouch: 1, headRot: 1.25, headX: 1.6, headY: 1.5, tail: -0.45, legNear: 0.25, legFar: -0.05 } },
  { q: { wing: 1.15, fan: 0.75, tail: -0.1, pitch: -0.35 }, fly: true },
  { q: { wing: -0.85, fan: 0.75, tail: -0.1, pitch: -0.35 }, fly: true },
  { q: { wing: -0.3, fan: 0.35, pitch: 0.1 }, fly: true },
  { q: { wing: 0.6, fan: 1, tail: -0.25, legsDown: 1, headRot: -0.5, pitch: -0.7 }, fly: true },
];

const poses: StudioEntry = {
  id: 'poses',
  label: 'rest · bow and coo · the nodding walk (3 steps) · peck · drinking (head held down) · clatter up, down · glide · landing, tail fanned',
  w: 1100,
  h: 300,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = 3.2;
    const parts = paintDove(k * pixelRatio, 2900 + (seed % 7));
    const cols = 6;
    POSES.forEach((p, i) => {
      const x = 80 + (i % cols) * 175;
      const y = i < cols ? 115 : 235;
      ctx.setTransform(pixelRatio * k, 0, 0, pixelRatio * k, pixelRatio * x, pixelRatio * (p.fly ? y - 30 : y));
      drawDove(ctx, parts, { ...REST_POSE, ...p.q, fly: !!p.fly });
    });
    // the line it stands on, for the standing poses
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.strokeStyle = 'rgba(120,110,100,0.35)';
    ctx.beginPath();
    ctx.moveTo(30, 116);
    ctx.lineTo(lerp(30, 1080, 1), 116);
    ctx.moveTo(30, 236);
    ctx.lineTo(240, 236);
    ctx.stroke();
    multiplyPaper(canvas);
  },
};

const section: StudioSection = {
  id: 'fauna-dove-close',
  title: 'Fauna · laughing dove, close',
  order: 341,
  entries: [
    poses,
    close('palms', 'a palm crown: a pair on the fronds, bowing and cooing', { x: 1030, y: 20, w: 320, h: 300 }, 640),
    close('rim', 'the basin’s far rim: down to drink, the head held down', { x: 600, y: 500, w: 420, h: 160 }, 840),
    close('plot', 'a plot: the nodding walk, pecking', { x: 440, y: 790, w: 260, h: 130 }, 780),
  ],
};

export default section;
