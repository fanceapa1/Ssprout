/**
 * Studio: the scops owl, close. Its poses on white (sitting, the head turned, a blink, the call's
 * puff, stretched tall, the flight frames), and the real behaviour at night on a crop of the olive.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { callPose, drawFlying, drawPerched, paintOwl, SIT, type OwlPose } from './scops-owl';

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
        stage = new Stage(spec, seed, 'scops-owl', 'coast');
        stage.sim.hourOverride = 23;
        stages.set(key, stage);
        for (let s = 0; s < t + 25; s += 1 / 30) {
          stage.tickRespawn(s);
          stage.sim.update(1 / 30, 0);
        }
      }
      stage.render(canvas, t, dt);
    },
  };
}

type Item = { x: number; q?: OwlPose; fly?: number };

const poses: StudioEntry = {
  id: 'poses',
  label: 'sitting · head turned · blink · calling (throat puffed) · tall and thin · flight: glide, up, down',
  w: 1000,
  h: 260,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = 5.5;
    const parts = paintOwl(k * pixelRatio, 4210 + (seed % 7));
    const items: Item[] = [
      { x: 60, q: SIT },
      { x: 170, q: { ...SIT, turn: 1 } },
      { x: 280, q: { ...SIT, blink: true } },
      { x: 390, q: callPose(0.23) },
      { x: 500, q: { ...SIT, tall: 1 } },
      { x: 640, fly: 0 },
      { x: 780, fly: 0.45 },
      { x: 910, fly: 0.5 },
    ];
    for (const it of items) {
      ctx.setTransform(pixelRatio * k, 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * 215);
      if (it.q) drawPerched(ctx, parts, it.q);
      else drawFlying(ctx, parts, it.fly!, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    multiplyPaper(canvas);
  },
};

const section: StudioSection = {
  id: 'fauna-scops-owl-close',
  title: 'Fauna · scops owl, close',
  order: 348,
  entries: [poses, close('olive', 'the olive at night: sitting, turning, blinking, calling, swooping to another perch', { x: 1110, y: 250, w: 360, h: 300 }, 640)],
};

export default section;
