/**
 * Studio: the marbled rock crab, close. Its poses and gait frames on white, the claws picking in
 * turn, and the real behaviour on close crops of two splash rocks and a rock pool's rim.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { CRAB_REST, drawRockCrab, feedPose, paintRockCrab, type RockCrabPose } from './rock-crab';

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
        stage = new Stage(spec, seed, 'rock-crab', 'coast');
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

/** Draw poses in a row on white, `k` px per unit, each at its body centre. */
function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, y: number, items: { x: number; q: RockCrabPose }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const parts = paintRockCrab(k * pixelRatio, 6120 + (seed % 7));
  for (const it of items) {
    ctx.setTransform(pixelRatio * k, 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * y);
    drawRockCrab(ctx, parts, it.q);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const poses: StudioEntry = {
  id: 'poses',
  label: 'standing · picking (left claw) · picking (right claw) · frozen flat · half under a swell',
  w: 1000,
  h: 240,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 9, 100, [
      { x: 110, q: CRAB_REST },
      { x: 300, q: feedPose(0.11) },
      { x: 490, q: feedPose(0.34) },
      { x: 690, q: { ...CRAB_REST, flat: 1 } },
      { x: 890, q: { ...CRAB_REST, wash: 1 } },
    ]);
  },
};

const gait: StudioEntry = {
  id: 'gait',
  label: 'the sideways gait: stand, A, B, A, B (alternate legs lift and reach)',
  w: 1000,
  h: 200,
  render(canvas, { seed, pixelRatio }) {
    const frames: (0 | 1 | 2)[] = [0, 1, 2, 1, 2];
    sheet(canvas, pixelRatio, seed, 8, 80, frames.map((g, i) => ({ x: 110 + i * 195, q: { ...CRAB_REST, gait: g } })));
  },
};

const section: StudioSection = {
  id: 'fauna-rock-crab-close',
  title: 'Fauna · marbled rock crab, close',
  order: 346,
  entries: [
    poses,
    gait,
    close('splash-2', 'a splash rock: out of its crack, sideways runs, stops, picking at the rock', { x: 345, y: 690, w: 80, h: 50 }, 520),
    close('splash-3', 'the tall splash rock by the shore', { x: 550, y: 630, w: 90, h: 60 }, 520),
  ],
};

export default section;
