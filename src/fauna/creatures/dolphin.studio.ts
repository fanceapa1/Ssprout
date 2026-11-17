/**
 * Studio: the common dolphins. Each roll frame by frame on a band of far sea (close and at the
 * overview's scale), and the real pod crossing the coast's bay, at noon and under a stand-in for
 * the sunset's light plate.
 */
import { createRng } from '../../core/rng';
import { createPainter } from '../../paint';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { bayOf, drawRoll, paintDolphin, planPass, Pod, type PassPlan, type RollKind } from './dolphin';

const SEA = '#2f6c96';

/** Rows of rolls on a band of sea, `k` px per unit, each body `L` units long. */
function strip(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, rows: { y: number; k: number; L: number; kind: RollKind; frames: number[] }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width / pixelRatio;
  for (const row of rows) {
    // the sea below the row's waterline
    const p = createPainter(canvas, { seed: seed + row.y });
    p.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    p.wash([{ x: 10, y: row.y }, { x: W - 10, y: row.y }, { x: W - 10, y: row.y + 26 }, { x: 10, y: row.y + 26 }], SEA, { rng: createRng(seed), opacity: 0.55, edge: 0.1, deform: 0.02 });
    const parts = paintDolphin(row.k * pixelRatio, 6100 + (seed % 7));
    const step = (W - 80) / row.frames.length;
    row.frames.forEach((u, i) => {
      ctx.setTransform(pixelRatio * row.k, 0, 0, pixelRatio * row.k, pixelRatio * (60 + i * step), pixelRatio * row.y);
      drawRoll(ctx, parts, row.kind, u, 0, 0, row.L, 1);
    });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const frames = (n: number) => Array.from({ length: n }, (_, i) => (i + 0.5) / n);

const rolls: StudioEntry = {
  id: 'roll',
  label: 'one surfacing frame by frame, close (2.5 px a unit): a low roll · a high roll (the beak) · the last roll, flukes up · a leap (at most one a pass)',
  w: 1200,
  h: 330,
  render(canvas, { seed, pixelRatio }) {
    strip(canvas, pixelRatio, seed, [
      { y: 60, k: 2.5, L: 14, kind: 'low', frames: frames(10) },
      { y: 130, k: 2.5, L: 14, kind: 'high', frames: frames(10) },
      { y: 200, k: 2.5, L: 14, kind: 'dive', frames: frames(10) },
      { y: 290, k: 2.5, L: 14, kind: 'leap', frames: frames(10) },
    ]);
  },
};

const rollsFar: StudioEntry = {
  id: 'roll-overview',
  label: 'the same at the overview’s scale (0.85 px a unit, 11 units long: the bay’s middle)',
  w: 600,
  h: 150,
  render(canvas, { seed, pixelRatio }) {
    strip(canvas, pixelRatio, seed, [
      { y: 40, k: 0.85 * 2, L: 11 / 2, kind: 'low', frames: frames(8) },
      { y: 80, k: 0.85 * 2, L: 11 / 2, kind: 'dive', frames: frames(8) },
      { y: 125, k: 0.85 * 2, L: 11 / 2, kind: 'leap', frames: frames(8) },
    ]);
  },
};

/** A warm multiply standing in for the sunset's light plate (the app's own is checked in shots). */
function sunset(ctx: CanvasRenderingContext2D): void {
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  g.addColorStop(0, '#f4b07a');
  g.addColorStop(1, '#d9a08a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

const stages = new Map<string, Stage>();

/** The real pod in the bay; `plan` overrides the pass's plan (a leap, a mill). */
function bay(id: string, label: string, spec: StageSpec, w: number, o: { plan?: Partial<PassPlan>; light?: boolean } = {}): StudioEntry {
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
      const fresh = () => {
        const b = bayOf(stage!.sim.world)!;
        const rng = createRng(seed * 31 + 7);
        const plan = { ...planPass(b, rng, { stay: 70 }), ...o.plan };
        stage!.sim.creatures.push(new Pod(b, rng.fork('pod'), plan));
      };
      if (!stage || frame === 0) {
        stage = new Stage(spec, seed, 'dolphin', 'coast');
        stages.set(key, stage);
        if (o.plan) fresh();
        for (let s = 0; s < t; s += 1 / 30) {
          stage.tickRespawn(s);
          stage.sim.update(1 / 30, 0);
        }
      }
      stage.render(canvas, t, dt, o.light ? sunset : undefined);
    },
  };
}

const BAY: StageSpec = { x: 160, y: 386, w: 400, h: 70 };
const NEAR: StageSpec = { x: 260, y: 405, w: 180, h: 42 };

const section: StudioSection = {
  id: 'fauna-dolphin-close',
  title: 'Fauna · common dolphins, close',
  order: 345,
  entries: [
    rolls,
    rollsFar,
    bay('pass', 'a pass across the bay at the overview’s scale (0.9 px a unit)', BAY, 360),
    bay('pass-close', 'a pass across the bay, close (2.1 px a unit)', BAY, 840),
    bay('leap', 'a pass with its leap, close up (4.7 px a unit)', NEAR, 840, { plan: { y: 430, dir: 1, x0: 290, x1: 420, travel: 50, leapAt: 0.06, millAt: null, millFor: 0, size: 3, calf: true } }),
    bay('sunset', 'at sunset (a warm multiply stands in for the light plate): dark arcs on gold', BAY, 840, { light: true }),
  ],
};

export default section;
