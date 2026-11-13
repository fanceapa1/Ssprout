/**
 * Studio: Hermann's tortoise close. Every pose side by side, the walk cycle frame by frame, a turn
 * through the front view, and the real behaviour on close crops of the coast's terraces.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { drawTortoise, drawTortoiseFront, drawTurn, paintTortoise, STAND_POSE, type TortoisePose } from './tortoise';

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
        stage = new Stage(spec, seed, 'tortoise', 'coast');
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

type Item = { x: number; q?: Partial<TortoisePose>; flip?: boolean; front?: boolean; turn?: number };

/** Draw poses in rows on white, `k` px per unit, each at its feet's point. */
function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, rows: { y: number; items: Item[] }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const parts = paintTortoise(k * pixelRatio, 5300 + (seed % 7));
  ctx.strokeStyle = 'rgba(120,110,100,0.3)';
  for (const row of rows) {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.beginPath();
    ctx.moveTo(20, row.y);
    ctx.lineTo(canvas.width / pixelRatio - 20, row.y);
    ctx.stroke();
    for (const it of row.items) {
      ctx.setTransform(pixelRatio * k, 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * row.y);
      const q = { ...STAND_POSE, ...it.q };
      if (it.front) drawTortoiseFront(ctx, parts);
      else if (it.turn !== undefined) drawTurn(ctx, parts, q, 1, it.turn);
      else {
        ctx.scale(it.flip ? -1 : 1, 1);
        drawTortoise(ctx, parts, q, !it.flip);
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const POSES: Record<string, Partial<TortoisePose>> = {
  stand: {},
  walk: { walk: 0.15, gait: 1, neck: 1.12, neckAngle: 0.1 },
  graze: { neck: 1.4, neckAngle: 0.45, head: 0.3, drop: 0.25 },
  bask: { neck: 1.5, neckAngle: -0.14, head: -0.05, legs: 1.3, drop: 1.1, sleep: true },
  doze: { neck: 0.38, neckAngle: 0.28, head: 0.15, legs: 0.55, drop: 1.25, sleep: true },
  peek: { neck: 0.55, neckAngle: 0, head: -0.05, legs: 0.25, drop: 1.3 },
  withdrawn: { neck: 0, legs: 0, drop: 1.4 },
};

const poses: StudioEntry = {
  id: 'poses',
  label: 'standing · plodding · grazing · basking (neck and legs stretched) · dozing in the shade · peeking out · withdrawn · facing left (lit from the left still) · the front view · a turn round',
  w: 1200,
  h: 330,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 5, [
      {
        y: 140,
        items: [
          { x: 90, q: POSES.stand },
          { x: 250, q: POSES.walk },
          { x: 420, q: POSES.graze },
          { x: 600, q: POSES.bask },
          { x: 780, q: POSES.doze },
          { x: 940, q: POSES.peek },
          { x: 1100, q: POSES.withdrawn },
        ],
      },
      {
        y: 300,
        items: [
          { x: 100, q: POSES.stand, flip: true },
          { x: 260, q: POSES.graze, flip: true },
          { x: 420, front: true },
          { x: 590, turn: 0.2 },
          { x: 740, turn: 0.4 },
          { x: 890, turn: 0.6 },
          { x: 1050, turn: 0.85 },
        ],
      },
    ]);
  },
};

const walk: StudioEntry = {
  id: 'walk',
  label: 'the walk cycle: eight frames of one stride (the diagonal gait: near fore with far hind, then the other pair; the shell rocks)',
  w: 1200,
  h: 150,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 4, [{ y: 120, items: Array.from({ length: 8 }, (_, i) => ({ x: 80 + i * 148, q: { ...POSES.walk, walk: i / 8 } })) }]);
  },
};

const section: StudioSection = {
  id: 'fauna-tortoise-close',
  title: "Fauna · Hermann's tortoise, close",
  order: 344,
  entries: [
    poses,
    walk,
    close('middle', 'the middle terrace’s walk and the scrub at its west end: out of the scrub, basking, plodding, grazing', { x: 790, y: 570, w: 300, h: 110 }, 840),
    close('lower', 'the lower terrace by the scrub in its middle', { x: 980, y: 700, w: 320, h: 120 }, 840),
  ],
};

export default section;
