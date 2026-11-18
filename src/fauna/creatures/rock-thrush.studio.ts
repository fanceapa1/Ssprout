/**
 * Studio: the blue rock thrush, close. Its poses on white (standing, the tail flick, the song, the
 * snatch, the flight frames), and the real behaviour on a close crop of the temple and the cliff top.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { drawFlying, drawPerched, paintThrush, songPose, STAND, type ThrushPose } from './rock-thrush';

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
        stage = new Stage(spec, seed, 'rock-thrush', 'coast');
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

type Item = { x: number; q?: ThrushPose; fly?: { flap: number; glide: boolean } };

const poses: StudioEntry = {
  id: 'poses',
  label: 'standing · tail flicked up · singing (bill parted, bill open) · the snatch · flight: up, mid, down, glide',
  w: 1100,
  h: 260,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = 5.5;
    const parts = paintThrush(k * pixelRatio, 3910 + (seed % 7));
    const items: Item[] = [
      { x: 60, q: STAND },
      { x: 175, q: { ...STAND, tail: 0.75 } },
      { x: 290, q: songPose(0.18) },
      { x: 405, q: songPose(0.02) },
      { x: 520, q: { ...STAND, pitch: 0.7, tail: 0.15 } },
      { x: 660, fly: { flap: 0, glide: false } },
      { x: 790, fly: { flap: 0.025, glide: false } },
      { x: 920, fly: { flap: 0.05, glide: false } },
      { x: 1040, fly: { flap: 0, glide: true } },
    ];
    for (const it of items) {
      ctx.setTransform(pixelRatio * k, 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * 200);
      if (it.q) drawPerched(ctx, parts, it.q);
      else drawFlying(ctx, parts, it.fly!.flap, 0, it.fly!.glide);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    multiplyPaper(canvas);
  },
};

const section: StudioSection = {
  id: 'fauna-rock-thrush-close',
  title: 'Fauna · blue rock thrush, close',
  order: 346,
  entries: [poses, close('temple', 'the temple and the cliff top: perching, singing, dropping for an insect and back', { x: 670, y: 250, w: 240, h: 150 }, 640)],
};

export default section;
