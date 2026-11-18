/**
 * Studio: the cicada close. Its poses on a strip of bark-coloured paper-white, the song's shimmer
 * frame by frame, and the real behaviour on close crops of the olive's and the pine's trunks.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { drawCicada, flightPose, paintCicada, REST, songPose, type CicadaPose } from './cicada';

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
        stage = new Stage(spec, seed, 'cicada', 'coast');
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

/** Draw poses in a row on white, `k` px per unit, each at its wing base, head up. */
function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, y: number, items: { x: number; q: CicadaPose; angle?: number }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const parts = paintCicada(k * pixelRatio, 7210 + (seed % 7));
  for (const it of items) {
    ctx.setTransform(pixelRatio * k, 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * y);
    ctx.rotate(it.angle ?? 0);
    drawCicada(ctx, parts, it.q);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const poses: StudioEntry = {
  id: 'poses',
  label: 'at rest (wings a roof) · singing (the abdomen throbs, the wings tremble) · flattened for a bird · in flight · on a leaning trunk',
  w: 1000,
  h: 300,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 17, 100, [
      { x: 110, q: REST },
      { x: 300, q: songPose(0.011) },
      { x: 490, q: { ...REST, flat: 1 } },
      { x: 700, q: flightPose(1.3), angle: 1.1 },
      { x: 890, q: REST, angle: -0.2 },
    ]);
  },
};

const song: StudioEntry = {
  id: 'song',
  label: 'the song: eight frames of the shimmer, 1/60 s apart',
  w: 1000,
  h: 220,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 10, 60, Array.from({ length: 8 }, (_, i) => ({ x: 70 + i * 122, q: songPose(i / 60) })));
  },
};

const section: StudioSection = {
  id: 'fauna-cicada-close',
  title: 'Fauna · cicada, close',
  order: 345,
  entries: [
    poses,
    song,
    close('olive', 'the olive’s trunk: in on a buzzing line, singing, shuffling, still', { x: 1225, y: 420, w: 100, h: 130 }, 520),
    close('pine', 'the leaning pine’s trunk', { x: 90, y: 450, w: 110, h: 320 }, 300),
  ],
};

export default section;
