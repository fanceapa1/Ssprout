/**
 * Studio: the Sahara frog close. Its parts in their poses side by side (sitting green and olive,
 * calling, half under on a step, afloat, afloat calling, the plop, under the water), and the real
 * behaviour on close crops of the oasis's basin by day and in the evening chorus.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { FROG_SIZE, MOUTH, paintSaharaFrog, type FrogParts } from './sahara-frog';

const stages = new Map<string, Stage>();

function close(id: string, label: string, spec: StageSpec, w: number, hour: number): StudioEntry {
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
        stage = new Stage(spec, seed, 'sahara-frog', 'oasis');
        stage.sim.hourOverride = hour;
        stage.sim.update(0, 0);
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

const L = FROG_SIZE;

function put(ctx: CanvasRenderingContext2D, s: FrogParts['sit'], x: number, y: number, k: number, alpha = 1, flip = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(k * flip, k);
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  ctx.restore();
}

function sacs(ctx: CanvasRenderingContext2D, p: FrogParts, at: { x: number; y: number }, x: number, y: number, k: number, full: number): void {
  put(ctx, p.sac, x + (at.x - 0.05) * L * k, y + (at.y - 0.04) * L * k, k * full * 0.75, 0.7);
  put(ctx, p.sac, x + at.x * L * k, y + at.y * L * k, k * full, 0.9);
}

const poses: StudioEntry = {
  id: 'poses',
  label: 'sitting (green · olive) · calling · half under on a step · afloat · afloat calling · the plop · under the water',
  w: 1120,
  h: 230,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = 7;
    const g = paintSaharaFrog(k * pixelRatio, 3300 + (seed % 7), 'green');
    const o = paintSaharaFrog(k * pixelRatio, 3340 + (seed % 7), 'olive');
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const water = (x0: number, x1: number, y: number) => {
      ctx.fillStyle = 'rgba(126,180,172,0.35)';
      ctx.fillRect(x0, y, x1 - x0, 60);
    };
    const row = 110;
    // sitting, two tones, with their shadows
    put(ctx, g.shadow, 80, row + 2, k);
    put(ctx, g.sit, 80, row, k);
    put(ctx, o.shadow, 220, row + 2, k);
    put(ctx, o.sit, 220, row, k);
    // calling, the sacs full
    put(ctx, g.shadow, 360, row + 2, k);
    put(ctx, g.sit, 360, row, k);
    sacs(ctx, g, MOUTH.sit, 360, row, k, 1);
    // half under on a step
    put(ctx, g.sit, 500, row, k, 0.28);
    ctx.save();
    ctx.beginPath();
    ctx.rect(400, 0, 200, row - 0.35 * L * 0.3 * k);
    ctx.clip();
    put(ctx, g.sit, 500, row, k);
    ctx.restore();
    water(440, 580, row - 0.35 * L * 0.3 * k);
    // afloat, and afloat calling
    water(600, 900, row);
    put(ctx, g.hang, 660, row + 1.5 * k, k, 0.45);
    put(ctx, g.float, 660, row, k);
    put(ctx, o.hang, 800, row + 1.5 * k, k, 0.45);
    put(ctx, o.float, 800, row, k);
    sacs(ctx, o, MOUTH.float, 800, row, k, 1);
    // the plop and the hang under water
    put(ctx, g.leap, 990, row - 40, k);
    put(ctx, g.hang, 990, row + 60, k, 0.6);
    multiplyPaper(canvas);
  },
};

const section: StudioSection = {
  id: 'fauna-sahara-frog-close',
  title: 'Fauna · Sahara frog, close',
  order: 342,
  entries: [
    poses,
    close('basin', 'the basin by day: basking on the coping, afloat among the lilies, plopping in', { x: 800, y: 548, w: 280, h: 100 }, 1120, 12),
    close('chorus', 'the basin after dark: three frogs afloat and on the steps, calling in a chorus', { x: 700, y: 548, w: 380, h: 100 }, 1140, 21),
  ],
};

export default section;
