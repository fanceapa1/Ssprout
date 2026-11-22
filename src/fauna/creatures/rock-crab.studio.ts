/**
 * Studio: the marbled rock crab, close. Its poses and gait frames on white, the claws picking in
 * turn, and the real behaviour on close crops of two splash rocks and a rock pool's rim.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { CRAB_REST, drawRockCrab, feedPose, paintRockCrab, ROCK_CRAB_SIZE, wavePose, type RockCrabPose } from './rock-crab';

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

/** px a unit that draws the crab as large as a carapace of `px` pixels */
const at = (px: number) => px / ROCK_CRAB_SIZE;

const portrait: StudioEntry = {
  id: 'portrait',
  label: 'close portrait: standing (the marbling, the eyes on their stalks) · waving its right claw',
  w: 1000,
  h: 300,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, at(150), 130, [
      { x: 260, q: CRAB_REST },
      { x: 740, q: wavePose(0.45, 1.8, 1) },
    ]);
  },
};

const poses: StudioEntry = {
  id: 'poses',
  label: 'standing · picking (left claw) · picking (right claw) · waving a claw · frozen flat · half under a swell',
  w: 1000,
  h: 240,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, at(64), 110, [
      { x: 90, q: CRAB_REST },
      { x: 250, q: feedPose(0.11) },
      { x: 410, q: feedPose(0.34) },
      { x: 570, q: wavePose(0.3, 1.8, -1) },
      { x: 740, q: { ...CRAB_REST, flat: 1 } },
      { x: 910, q: { ...CRAB_REST, wash: 1 } },
    ]);
  },
};

const wave: StudioEntry = {
  id: 'wave',
  label: 'a claw wave, frame by frame: raised up and out, swung, lowered',
  w: 1000,
  h: 200,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, at(52), 110, Array.from({ length: 7 }, (_, i) => ({ x: 80 + i * 140, q: wavePose((i + 0.5) / 7, 1.8, 1) })));
  },
};

const gait: StudioEntry = {
  id: 'gait',
  label: 'the sideways gait: stand, A, B, A, B (alternate legs lift and reach)',
  w: 1000,
  h: 200,
  render(canvas, { seed, pixelRatio }) {
    const frames: (0 | 1 | 2)[] = [0, 1, 2, 1, 2];
    sheet(canvas, pixelRatio, seed, at(58), 90, frames.map((g, i) => ({ x: 110 + i * 195, q: { ...CRAB_REST, gait: g } })));
  },
};

const section: StudioSection = {
  id: 'fauna-rock-crab-close',
  title: 'Fauna · marbled rock crab, close',
  order: 346,
  entries: [
    portrait,
    poses,
    wave,
    gait,
    close('splash-2', 'a splash rock: out of its crack, sideways runs, stops, picking at the rock', { x: 345, y: 690, w: 80, h: 50 }, 520),
    close('splash-3', 'the tall splash rock by the shore', { x: 550, y: 630, w: 90, h: 60 }, 520),
  ],
};

export default section;
