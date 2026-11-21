/**
 * Studio: the common octopus, close. Its poses and the colour change on a stand-in for the pool's
 * floor, and the real behaviour in the coast's rock pools.
 */
import { createRng } from '../../core/rng';
import { blob, createPainter, makeCanvas, type AnyCanvas } from '../../paint';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { ARMS, armPoints, armQuirks, armRoot, armShape, layOctopus, paintOctopus, POSE_SIT, skinOf, type OctopusPose, type SkinWeights } from './octopus';

const stages = new Map<string, Stage>();

function alive(id: string, label: string, spec: StageSpec, w: number): StudioEntry {
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
        stage = new Stage(spec, seed, 'octopus', 'coast');
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

/** A stand-in for a pool's floor: clear aquamarine over a few stones. */
function floor(canvas: HTMLCanvasElement, pixelRatio: number, seed: number): void {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width / pixelRatio;
  const H = canvas.height / pixelRatio;
  const p = createPainter(canvas, { seed });
  const rng = createRng(seed);
  p.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  p.wash([{ x: 8, y: 8 }, { x: W - 8, y: 8 }, { x: W - 8, y: H - 8 }, { x: 8, y: H - 8 }], '#a9d2c6', { rng, opacity: 0.75, edge: 0.3, deform: 0.02 });
  for (let i = 0; i < 26; i++) {
    const x = rng.range(20, W - 20);
    const y = rng.range(20, H - 20);
    p.glaze(blob(x, y, rng.range(10, 30), rng.range(5, 12), rng, { irregularity: 0.3 }), rng.pick(['#8e9a86', '#b7a98a', '#6f8f86']), { rng, opacity: 0.3, edge: 0.3 });
  }
}

const quirks = armQuirks(createRng(11));

function arms(q: OctopusPose, t: number) {
  return ARMS.map((_, i) => armPoints(armRoot(i), armShape(i, q, quirks[i]!, t, i === 1), quirks[i]!.phase, t));
}

/** Octopuses in a row on the floor, `k` px a plan unit, each facing `heading`. */
function row(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, items: { x: number; y: number; q: OctopusPose; skin: SkinWeights; heading?: number; t?: number }[]): void {
  floor(canvas, pixelRatio, seed);
  const ctx = canvas.getContext('2d')!;
  const parts = paintOctopus(k * pixelRatio * 1.1, 6230 + (seed % 5));
  let sc: AnyCanvas | null = null;
  const scratch = (px: number) => {
    if (!sc || sc.width < px) sc = makeCanvas(px, px);
    const c = sc.getContext('2d') as CanvasRenderingContext2D;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, sc.width, sc.height);
    return { canvas: sc, ctx: c };
  };
  for (const it of items) {
    const t = it.t ?? 2;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, pixelRatio * it.x, pixelRatio * it.y);
    layOctopus(ctx, scratch, parts, arms(it.q, t), { flat: it.q.flat, breath: 0, look: 0 }, skinOf(it.skin), pixelRatio, k, it.heading ?? -0.5, 1, it.q.move);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const W0: SkinWeights = { stone: 0, sand: 0, flush: 0, pale: 0 };
const skin = (s: Partial<SkinWeights>): SkinWeights => ({ ...W0, ...s });
const MOVE: OctopusPose = { ...POSE_SIT, sit: 0, move: 1 };
const FLAT: OctopusPose = { ...POSE_SIT, sit: 0, flat: 1 };
const REACH: OctopusPose = { ...POSE_SIT, reachArm: 0, reachDir: -0.9, reachLen: 24, reach: 1 };

const poses: StudioEntry = {
  id: 'poses',
  label: 'camouflaged on the stones · crawling, arms streaming · the red-brown flush · pale and flat (something big over the pool) · an arm into a crack',
  w: 1200,
  h: 230,
  render(canvas, { seed, pixelRatio }) {
    row(canvas, pixelRatio, seed, 4.2, [
      { x: 120, y: 115, q: POSE_SIT, skin: skin({ stone: 1 }) },
      { x: 360, y: 115, q: MOVE, skin: skin({ sand: 1 }), heading: -0.2, t: 1.3 },
      { x: 600, y: 115, q: MOVE, skin: skin({ flush: 0.85, sand: 0.15 }), heading: 0.3, t: 2.1 },
      { x: 840, y: 115, q: FLAT, skin: skin({ pale: 1 }) },
      { x: 1070, y: 125, q: REACH, skin: skin({ stone: 0.75, sand: 0.25 }), heading: 0.2 },
    ]);
  },
};

const close: StudioEntry = {
  id: 'close',
  label: 'close (11 px a unit): camouflaged on the stones · crawling, arms streaming behind',
  w: 1200,
  h: 330,
  render(canvas, { seed, pixelRatio }) {
    row(canvas, pixelRatio, seed, 11, [
      { x: 300, y: 165, q: POSE_SIT, skin: skin({ stone: 1 }) },
      { x: 880, y: 165, q: MOVE, skin: skin({ sand: 1 }), heading: -0.2, t: 1.3 },
    ]);
  },
};

const change: StudioEntry = {
  id: 'colour',
  label: 'the colour and texture change, a smooth blend: stone → sand (it sets off) → a flush → sand → stone (it settles) → pale (fright)',
  w: 1200,
  h: 170,
  render(canvas, { seed, pixelRatio }) {
    const steps: SkinWeights[] = [
      skin({ stone: 1 }),
      skin({ stone: 0.5, sand: 0.5 }),
      skin({ sand: 1 }),
      skin({ sand: 0.4, flush: 0.6 }),
      skin({ flush: 0.85, sand: 0.15 }),
      skin({ sand: 0.6, stone: 0.4 }),
      skin({ stone: 1 }),
      skin({ stone: 0.4, pale: 0.6 }),
      skin({ pale: 1 }),
    ];
    row(canvas, pixelRatio, seed, 2.6, steps.map((s, i) => ({ x: 70 + i * 132, y: 85, q: POSE_SIT, skin: s })));
  },
};

const section: StudioSection = {
  id: 'fauna-octopus-close',
  title: 'Fauna · common octopus, close',
  order: 347,
  entries: [
    close,
    poses,
    change,
    alive('pool-2', 'the middle rock pool: out of its den, sitting camouflaged, crawling, feeling into the rim', { x: 336, y: 880, w: 128, h: 44 }, 640),
    alive('pool-3', 'the small pool by the steps', { x: 526, y: 870, w: 80, h: 32 }, 500),
  ],
};

export default section;
