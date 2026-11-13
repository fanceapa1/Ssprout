/**
 * Studio: the yellow-legged gull close. Every standing pose, the wingbeat frame by frame, the glide,
 * the soar and the landing, afloat, and the real behaviour on close crops of the coast: the caique, the rocks, the temple.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { drawGull, paintGull, REST_POSE, wingsAt, type GullPose } from './gull';

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
        stage = new Stage(spec, seed, 'gull', 'coast');
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

type Item = { x: number; q: Partial<GullPose>; flip?: boolean };

/** Draw poses in rows on white, `k` px per unit, each at its feet's point (afloat: the waterline, in flight: the body). */
function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, rows: { y: number; water?: boolean; items: Item[] }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const parts = paintGull(k * pixelRatio, 4100 + (seed % 7));
  for (const row of rows) {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (row.water) {
      // a pale sea under the waterline, so the white bird shows
      ctx.fillStyle = 'rgba(126,180,172,0.35)';
      ctx.fillRect(0, row.y, canvas.width / pixelRatio, 34);
    } else if (row.water === false) {
      ctx.fillStyle = 'rgba(126,160,190,0.22)';
      ctx.fillRect(0, row.y - 90, canvas.width / pixelRatio, 150);
    } else {
      ctx.strokeStyle = 'rgba(120,110,100,0.3)';
      ctx.beginPath();
      ctx.moveTo(20, row.y);
      ctx.lineTo(canvas.width / pixelRatio - 20, row.y);
      ctx.stroke();
    }
    for (const it of row.items) {
      ctx.setTransform(pixelRatio * k * (it.flip ? -1 : 1), 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * row.y);
      drawGull(ctx, parts, { ...REST_POSE, ...it.q });
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const poses: StudioEntry = {
  id: 'poses',
  label: 'standing · looking · shifting its feet · preening the back · preening the breast · stretching a wing · the long call, bowing · the long call, head thrown up · afloat · afloat, preening',
  w: 1200,
  h: 360,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 2, [
      {
        y: 150,
        items: [
          { x: 80, q: { shadow: 0.7 } },
          { x: 230, q: { headRot: -0.2, headY: -0.6 } },
          { x: 380, q: { liftNear: 0.8, pitch: -0.03 } },
          { x: 530, q: { back: true, headRot: 0.75, pitch: -0.02 } },
          { x: 680, q: { headRot: 1.15, headX: -2.4, headY: 3.6 } },
          { x: 840, q: { stretch: 1, liftNear: 0.5, pitch: 0.06 } },
          { x: 1000, q: { headRot: 0.9, headX: 1.2, headY: 3.6, pitch: 0.16 } },
          { x: 1130, q: { headRot: -1.35, headX: -2.2, headY: -3.4, open: true, pitch: -0.14 } },
        ],
      },
      {
        y: 300,
        water: true,
        items: [
          { x: 120, q: { shape: 'float', pitch: -0.1 } },
          { x: 300, q: { shape: 'float', pitch: -0.08, back: true, headRot: 0.75 } },
          { x: 480, q: { shape: 'float', pitch: -0.1, headRot: -0.2 }, flip: true },
        ],
      },
    ]);
  },
};

const flight: StudioEntry = {
  id: 'flight',
  label: 'the wingbeat: eight frames of one slow, deep stroke (the far wing behind the body, the near one in front)',
  w: 1200,
  h: 230,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 1.5, [{ y: 120, water: false, items: Array.from({ length: 8 }, (_, i) => ({ x: 75 + i * 150, q: { shape: 'fly' as const, ...wingsAt(i / 8, 0) } })) }]);
  },
};

const glide: StudioEntry = {
  id: 'glide',
  label: 'gliding on set wings · soaring, banked · braking to land, legs down · the pattering take-off from the water',
  w: 1200,
  h: 230,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 1.7, [
      {
        y: 120,
        water: false,
        items: [
          { x: 140, q: { shape: 'fly', ...wingsAt(0, 1) } },
          { x: 430, q: { shape: 'fly', ...wingsAt(0, 1), farArm: 0.72, farHand: 0.5, nearArm: -0.58, pitch: 0.16 } },
          { x: 730, q: { shape: 'fly', farArm: 0.85, farHand: 0.75, nearArm: 0.45, nearHand: 0.35, legsDown: 1, pitch: -0.3 } },
          { x: 1030, q: { shape: 'fly', ...wingsAt(0.6, 0, 1.1), legsDown: 1, pitch: -0.18 } },
        ],
      },
    ]);
  },
};

const section: StudioSection = {
  id: 'fauna-gull-close',
  title: 'Fauna · yellow-legged gull, close',
  order: 344,
  entries: [
    poses,
    flight,
    glide,
    close('boat', 'the caique: on the mast top or a rail, riding the boat', { x: 340, y: 400, w: 200, h: 120 }, 840),
    close('rocks', 'the cove: a splash rock, afloat in the shallows, the flights between', { x: 300, y: 560, w: 420, h: 240 }, 840),
    close('temple', 'the temple: a fleck on the architrave or a broken column', { x: 640, y: 240, w: 260, h: 170 }, 840),
  ],
};

export default section;
