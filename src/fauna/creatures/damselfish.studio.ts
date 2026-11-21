/**
 * Studio: the damselfish shoal, close. The real shoal on crops of the cove's shallows: hanging
 * loose, tight and sunk under a passing shadow, turning as one; one fish's frames on white; and the
 * shoal at the overview's scale and under a stand-in for the sunset's light.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { openHomes, paintDamselfish, Shoal, shoalExtent, shoalHomes, SQUASH } from './damselfish';

const stages = new Map<string, Stage>();

type Pose = 'loose' | 'tight' | 'turn';

/** A warm multiply standing in for the sunset's light plate (the app's own is checked in shots). */
function sunset(ctx: CanvasRenderingContext2D): void {
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#e8a678';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function shoalOf(stage: Stage): Shoal | undefined {
  return stage.sim.creatures.find((c): c is Shoal => c instanceof Shoal);
}

/** The real shoal on a crop of the shallows, presimulated, then put in a pose. */
function cove(id: string, label: string, spec: StageSpec, w: number, pose: Pose, light = false): StudioEntry {
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
        stage = new Stage(spec, seed, 'damselfish', 'coast');
        stages.set(key, stage);
        stage.tickRespawn(0);
        // past its rising into view, then the pose
        for (let s = 0; s < 14 + t; s += 1 / 30) stage.sim.update(1 / 30, 0);
        const s = shoalOf(stage);
        if (s && pose === 'tight') {
          s.startle(1e6);
          for (let k = 0; k < 3; k += 1 / 30) stage.sim.update(1 / 30, 0);
        }
        if (s && pose === 'turn') {
          s.turn(2.4);
          for (let k = 0; k < 0.4; k += 1 / 30) stage.sim.update(1 / 30, 0);
        }
      }
      stage.render(canvas, t, dt, light ? sunset : undefined);
    },
  };
}

/** One fish's parts on a band of turquoise: the three tail frames, the deep copy, the glint over a frame, the shadow. */
const fish: StudioEntry = {
  id: 'fish',
  label: 'one fish, 8 px a unit: tail flicked one way · straight · the other way · deep (near the bottom) · turning (the glint) · the shoal’s shadow (one for the shoal)',
  w: 1000,
  h: 200,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(126, 180, 172, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = 8;
    const parts = paintDamselfish(k * pixelRatio, 6230 + (seed % 7));
    const items = [parts.frames[0], parts.frames[1], parts.frames[2], parts.deep[1], parts.frames[1], parts.shadow];
    items.forEach((sp, i) => {
      // the shoal's shadow is painted shoal-sized: shown at a fifth
      const kk = i === 5 ? k * 0.2 : k;
      ctx.setTransform(pixelRatio * kk, 0, 0, pixelRatio * kk, pixelRatio * (90 + i * 165), pixelRatio * 100);
      ctx.drawImage(sp.img as CanvasImageSource, -sp.ox, -sp.oy, sp.w, sp.h);
      if (i === 4) ctx.drawImage(parts.glint.img as CanvasImageSource, -parts.glint.ox, -parts.glint.oy, parts.glint.w, parts.glint.h);
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    multiplyPaper(canvas);
  },
};

/** Where a shoal may hang: each home's centre, and the loosest shoal's rim at a few of them, over the shallows' outline. */
function homes(spec: StageSpec, w: number): StudioEntry {
  const h = Math.round((w * spec.h) / spec.w);
  return {
    id: 'homes',
    label: 'where it may hang: a dot per home (darker where it may hang loosest), the rim of a loose shoal at every fifth, the shallows’ outline and its rocks',
    w,
    h,
    render(canvas, { seed, pixelRatio }) {
      const stage = new Stage(spec, seed, 'damselfish', 'coast');
      stage.render(canvas, 0, 0);
      const world = stage.sim.world;
      const hs = shoalHomes(world);
      if (!hs) return;
      const ctx = canvas.getContext('2d')!;
      const k = canvas.width / spec.w;
      ctx.setTransform(k, 0, 0, k, -stage.view.x * k, -stage.view.y * k);
      ctx.lineWidth = 1 / pixelRatio;
      ctx.strokeStyle = 'rgba(160, 40, 30, 0.8)';
      for (const poly of [hs.region.outline, ...(hs.region.holes ?? [])]) {
        ctx.beginPath();
        poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.stroke();
      }
      openHomes(world).forEach((q, i) => {
        ctx.fillStyle = `rgba(40, 30, 90, ${0.25 + 0.6 * q.room})`;
        ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
        if (i % 5 !== 0) return;
        const e = shoalExtent(world.perspective(q.y, q.x), q.room);
        ctx.strokeStyle = 'rgba(40, 30, 90, 0.35)';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, e.rx, e.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}

/** The sea plane's foreshortening, so the studio can say how the shoal's cloud is drawn. */
const SHAPE = `the cloud is ${Math.round(SQUASH * 100)} % as deep as it is wide (the sea plane seen low)`;

const CLOSE: StageSpec = { x: 250, y: 585, w: 290, h: 130 };
const NEAR: StageSpec = { x: 300, y: 600, w: 180, h: 90 };

const section: StudioSection = {
  id: 'fauna-damselfish-close',
  title: 'Fauna · damselfish shoal, close',
  order: 349,
  entries: [
    cove('loose', `loose: hanging in mid-water, every fish facing one way, tiny corrections; ${SHAPE}`, CLOSE, 720, 'loose'),
    cove('tight', 'tight: a shadow passes over, the shoal closes up and sinks toward its shadows', CLOSE, 720, 'tight'),
    cove('turning', 'turning as one: the turn runs across the shoal, the flanks catch the light', NEAR, 720, 'turn'),
    cove('overview', 'at the overview’s scale (about 0.9 px a unit)', { x: 180, y: 540, w: 480, h: 200 }, 430, 'loose'),
    cove('sunset', 'under a stand-in for the sunset’s warm light', CLOSE, 720, 'loose', true),
    fish,
    homes({ x: 160, y: 540, w: 560, h: 270 }, 900),
  ],
};

export default section;
