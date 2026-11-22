/**
 * Studio: the Balkan green lizard, close. Its poses and run frames on white, and the real
 * behaviour on close crops of two terrace walls.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { drawGreenLizard, LIZARD_REST, lookPose, paintGreenLizard, type GreenLizardPose } from './green-lizard';

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
        stage = new Stage(spec, seed, 'green-lizard', 'coast');
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

/** Draw poses in a row on white, `k` px per unit, each at its vent. */
function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, y: number, items: { x: number; y?: number; q: GreenLizardPose }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const parts = paintGreenLizard(k * pixelRatio, 7310 + (seed % 7));
  for (const it of items) {
    ctx.setTransform(pixelRatio * k, 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * (it.y ?? y));
    drawGreenLizard(ctx, parts, it.q);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const poses: StudioEntry = {
  id: 'poses',
  label: 'basking flat · head lifted, looking round (throat) · slipping into a gap · peering back out',
  w: 1000,
  h: 220,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 6, 110, [
      { x: 160, q: LIZARD_REST },
      { x: 410, q: lookPose(0.7) },
      { x: 680, q: { ...LIZARD_REST, frame: 1, gap: { at: 2, keep: 'back' } } },
      { x: 860, q: { ...LIZARD_REST, gap: { at: 4, keep: 'front' } } },
    ]);
  },
};

const run: StudioEntry = {
  id: 'run',
  label: 'the dash: flat, S one way, S the other (legs reaching on the outside of the bend)',
  w: 1000,
  h: 200,
  render(canvas, { seed, pixelRatio }) {
    const frames: (0 | 1 | 2)[] = [0, 1, 2];
    sheet(canvas, pixelRatio, seed, 8, 100, frames.map((f, i) => ({ x: 250 + i * 320, q: { ...LIZARD_REST, frame: f } })));
  },
};

const portrait: StudioEntry = {
  id: 'portrait',
  label: 'close portrait (16 px a unit): basking, and looking round with the yellow throat',
  w: 1000,
  h: 420,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 16, 110, [
      { x: 520, q: LIZARD_REST },
      { x: 520, y: 310, q: lookPose(0.7) },
    ]);
  },
};

const section: StudioSection = {
  id: 'fauna-green-lizard-close',
  title: 'Fauna · Balkan green lizard, close',
  order: 347,
  entries: [portrait, poses, run, close('wall', 'a terrace wall: peering out, basking, looking round, dashes with stops', { x: 1090, y: 545, w: 110, h: 70 }, 520)],
};

export default section;
