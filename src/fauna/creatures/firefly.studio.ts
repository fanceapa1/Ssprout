/**
 * Studio: the Genji fireflies at night on the falls stage, composed in the game's order (the
 * creatures, a night light plate, the `lights` layer, paper; ADR 0280), and their painted light
 * at a few strengths over a night pool, with the body seen close.
 */
import { createRng } from '../../core/rng';
import { createPainter, makeCanvas } from '../../paint';
import { PHASE_GRADES } from '../../ambience/timeofday';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage } from '../stage';
import { paintFirefly } from './firefly';

const SPEC = { w: 420, h: 266 };
const stages = new Map<string, Stage>();

/** A flat stand-in for the night light plate: colour taken out, then the indigo glaze multiplied. */
function nightPlate(ctx: CanvasRenderingContext2D): void {
  const { width: w, height: h } = ctx.canvas;
  const g = PHASE_GRADES.night;
  const a = g.amount * 1.1;
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = 'rgb(120,124,138)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${g.tint.map((c) => Math.round(255 - a * (255 - c))).join(',')})`;
  ctx.fillRect(0, 0, w, h);
}

function nightStage(id: string, seed: number, frame: number, t: number): Stage {
  const key = `${id}:${seed}`;
  let stage = stages.get(key);
  if (!stage || frame === 0) {
    stage = new Stage(SPEC, seed, 'firefly', 'falls');
    stage.sim.hourOverride = 22;
    stages.set(key, stage);
    for (let s = 0; s < t; s += 1 / 30) {
      stage.tickRespawn(s);
      stage.sim.update(1 / 30, 0);
    }
  }
  return stage;
}

function aliveAtNight(id: string, label: string): StudioEntry {
  return {
    id,
    label,
    w: 570,
    h: 361,
    animated: true,
    render(canvas, { t, dt, seed, frame }) {
      nightStage(id, seed, frame, t).render(canvas, t, dt, nightPlate);
    },
  };
}

/** The light at four strengths through a flash over a night pool, and the body close up. */
const lights: StudioEntry = {
  id: 'lights',
  label: 'the light through a flash (dark → full), on a night pool; the body ×4 by day and at night',
  w: 640,
  h: 170,
  render(canvas, { seed, pixelRatio }) {
    const k = 3.2;
    const res = k * pixelRatio;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const p = createPainter(canvas, { seed });
    p.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    p.waterBody({ cx: 230, cy: 85, rx: 250, ry: 95 }, { rng: createRng(seed), ripples: 2, reflection: 0 });
    const parts = paintFirefly(res, 2500 + (seed % 7));
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const body = (x: number, y: number) => ctx.drawImage(parts.body.img as CanvasImageSource, x - parts.body.ox * k * 1.3, y - parts.body.oy * k * 1.3, parts.body.w * k * 1.3, parts.body.h * k * 1.3);
    body(560, 50);
    body(560, 120);
    // the night plate over everything but the light, as the game composes it
    const glazed = makeCanvas(canvas.width, canvas.height);
    const gctx = glazed.getContext('2d') as CanvasRenderingContext2D;
    gctx.drawImage(canvas, 0, 0);
    nightPlate(gctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(glazed as CanvasImageSource, 0, 0, canvas.width, canvas.height * 0.62, 0, 0, canvas.width, canvas.height * 0.62);
    ctx.drawImage(glazed as CanvasImageSource, 0, canvas.height * 0.62, canvas.width * 0.8, canvas.height * 0.38, 0, canvas.height * 0.62, canvas.width * 0.8, canvas.height * 0.38);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    [0.15, 0.4, 0.7, 1].forEach((b, i) => {
      const x = 70 + i * 110;
      const y = 85;
      ctx.save();
      ctx.globalAlpha = b;
      const h = parts.halos[i % 3]!;
      const hs = k * (0.95 + 0.35 * b);
      ctx.drawImage(h.img as CanvasImageSource, x - h.ox * hs, y - h.oy * hs, h.w * hs, h.h * hs);
      ctx.globalAlpha = Math.min(1, b * 1.25);
      const cs = k * (0.8 + 0.25 * b);
      ctx.drawImage(parts.core.img as CanvasImageSource, x - parts.core.ox * cs, y - parts.core.oy * cs, parts.core.w * cs, parts.core.h * cs);
      ctx.restore();
    });
    multiplyPaper(canvas);
  },
};

const section: StudioSection = {
  id: 'fauna-firefly-night',
  title: 'Fauna · Genji fireflies at night',
  order: 334,
  entries: [aliveAtNight('alive', 'a night swarm on the falls stage (light plate stand-in, lights layer, paper)'), lights],
};

export default section;
