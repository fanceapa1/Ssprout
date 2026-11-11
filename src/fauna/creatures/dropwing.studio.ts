/** Studio: the violet dropwing's poses and wingbeat, close and at garden size, and one alive by the
 * sluice gate and the basin's corner, close. docs/devlog/161-violet-dropwing.md */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage } from '../stage';
import { drawDropwing, flightPose, paintDropwing, REST_POSE, type DropwingParts } from './dropwing';

type Pose = (ctx: CanvasRenderingContext2D, m: DropwingParts, f: DropwingParts) => void;

const POSES: [string, Pose][] = [
  ['perched', (c, m) => drawDropwing(c, m, REST_POSE, true)],
  ['obelisk', (c, m) => drawDropwing(c, m, REST_POSE, true, 1.15)],
  ['female', (c, _m, f) => drawDropwing(c, f, REST_POSE, true)],
  ['up', (c, m) => drawDropwing(c, m, flightPose(4.4), false)],
  ['level', (c, m) => drawDropwing(c, m, flightPose(0.3), false)],
  ['down', (c, m) => drawDropwing(c, m, flightPose(1.6), false)],
];

const poses: StudioEntry = {
  id: 'poses',
  label: 'poses and wingbeat: close (top), garden size (bottom)',
  w: 900,
  h: 330,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [k, y] of [
      [7, 150],
      [1.2, 270],
    ] as const) {
      const m = paintDropwing(k * pixelRatio, seed, 'male');
      const f = paintDropwing(k * pixelRatio, seed + 5, 'female');
      POSES.forEach(([, draw], i) => {
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.translate(110 + i * 140, y);
        ctx.scale(k, k);
        draw(ctx, m, f);
      });
    }
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = '#8a7f72';
    ctx.font = '11px serif';
    POSES.forEach(([name], i) => ctx.fillText(name, 80 + i * 140, 320));
    multiplyPaper(canvas);
  },
};

const stages = new Map<number, Stage>();

/** A close crop of the sluice gate's posts, the basin's near-right corner and the channel. */
const byGate: StudioEntry = {
  id: 'by-gate',
  label: 'alive, close: the sluice gate’s posts, the basin’s corner and the channel',
  w: 640,
  h: 360,
  animated: true,
  render(canvas, { t, dt, seed, frame }) {
    let stage = stages.get(seed);
    if (!stage || frame === 0) {
      stage = new Stage({ x: 960, y: 540, w: 240, h: 135 }, seed, 'dropwing', 'oasis');
      stages.set(seed, stage);
      for (let s = 0; s < t; s += 1 / 30) {
        stage.tickRespawn(s);
        stage.sim.update(1 / 30, 0);
      }
    }
    stage.render(canvas, t, dt);
  },
};

const section: StudioSection = {
  id: 'fauna-dropwing-close',
  title: 'Fauna · violet dropwing, close',
  order: 353,
  entries: [poses, byGate],
};

export default section;
