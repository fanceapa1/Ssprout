/** Studio: the house bunting's poses and flight frames, close and at garden size, and a pair alive
 * on the oasis's middle wall and basin corner, close. docs/devlog/128-house-bunting.md */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage } from '../stage';
import { drawFlying, drawPerched, paintBunting, SIP_DOWN, SIP_UP, type BuntingParts } from './bunting';

type Pose = (ctx: CanvasRenderingContext2D, m: BuntingParts, f: BuntingParts) => void;

const POSES: [string, Pose][] = [
  ['perched', (c, m) => drawPerched(c, m, 0)],
  ['peck', (c, m) => drawPerched(c, m, 0.62)],
  ['sip', (c, m) => drawPerched(c, m, SIP_DOWN)],
  ['swallow', (c, m) => drawPerched(c, m, SIP_UP)],
  ['flick', (c, m) => drawPerched(c, m, 0, 0.4)],
  ['hen', (c, _m, f) => drawPerched(c, f, 0)],
  ['up', (c, m) => drawFlying(c, m, 0, 0, false)],
  ['mid', (c, m) => drawFlying(c, m, 1 / 36, 0, false)],
  ['down', (c, m) => drawFlying(c, m, 2 / 36, 0, false)],
  ['glide', (c, m) => drawFlying(c, m, 0, 0, true)],
];

const poses: StudioEntry = {
  id: 'poses',
  label: 'poses and flight frames: close (top), garden size ×0.8 (bottom)',
  w: 900,
  h: 330,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [k, y] of [
      [4.6, 190],
      [1.6, 290],
    ] as const) {
      const m = paintBunting(k * pixelRatio, seed, 'male');
      const f = paintBunting(k * pixelRatio, seed + 20, 'female');
      POSES.forEach(([, draw], i) => {
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.translate(55 + i * 88, y);
        ctx.scale(k * (k < 2 ? 0.8 : 1), k * (k < 2 ? 0.8 : 1));
        draw(ctx, m, f);
      });
    }
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = '#8a7f72';
    ctx.font = '11px serif';
    POSES.forEach(([name], i) => ctx.fillText(name, 40 + i * 88, 320));
    multiplyPaper(canvas);
  },
};

const stages = new Map<number, Stage>();

/** A close crop of the middle wall's end, the stones and the basin's left corner. */
const onWall: StudioEntry = {
  id: 'on-wall',
  label: 'a pair alive, close: the middle wall’s coping, the stones and the basin’s left corner',
  w: 640,
  h: 360,
  animated: true,
  render(canvas, { t, dt, seed, frame }) {
    let stage = stages.get(seed);
    if (!stage || frame === 0) {
      stage = new Stage({ x: 300, y: 500, w: 320, h: 180 }, seed, 'bunting', 'oasis');
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
  id: 'fauna-bunting-close',
  title: 'Fauna · house bunting, close',
  order: 352,
  entries: [poses, onWall],
};

export default section;
