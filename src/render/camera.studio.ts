import { createRng } from '../core/rng';
import { gardenScene } from '../scene/geometry';
import type { StudioSection } from '../studio/types';
import { composeView, easeGlide, framePose, glidePath, glideSeconds, overviewPose, type CameraPose } from './camera';
import { createViewport, WORLD_H, WORLD_W, type Viewport } from './viewport';

/**
 * Camera playground (ADRs 0160, 0162): the garden's geometry as a map with the camera's view
 * drawn on it, and the same garden through the camera on a small stage, gliding between the
 * overview, a framed plant spot (left and right of the garden), the closest view and back. The
 * path eases out on long moves and breathes in and out in time; the framed spot sits a little
 * off-centre and low. The seed picks the spots.
 */
const STAGE = { w: 300, h: 190 };
const HOLD_S = 0.9;

function drawGarden(ctx: CanvasRenderingContext2D, v: Viewport, highlight: Set<string>): void {
  ctx.save();
  v.applyTo(ctx);
  ctx.fillStyle = '#f3ecd9';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = 'rgba(126,180,172,0.55)';
  ctx.beginPath();
  gardenScene.pond.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(157,151,135,0.8)';
  for (const r of gardenScene.rocks) {
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of gardenScene.slots) {
    ctx.fillStyle = highlight.has(s.id) ? '#ad452d' : 'rgba(109,124,68,0.85)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9 * s.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function track(base: Viewport, seed: number): { poses: CameraPose[]; slots: string[] } {
  const rng = createRng(`camera-studio:${seed}`);
  const left = gardenScene.slots.filter((s) => s.x < 700);
  const right = gardenScene.slots.filter((s) => s.x > 900);
  const a = rng.pick(left);
  const b = rng.pick(right);
  const box = (s: (typeof gardenScene.slots)[number]) => ({ x: s.x - 50 * s.scale, y: s.y - 110 * s.scale, w: 100 * s.scale, h: 115 * s.scale });
  const pa = framePose(base, box(a));
  const pb = framePose(base, box(b));
  return { poses: [overviewPose(base), pa, pb, { ...pb, zoom: 3 }, overviewPose(base)], slots: [a.id, b.id] };
}

/** The pose at time t (s) along the looping track. */
function poseAt(base: Viewport, poses: CameraPose[], t: number): CameraPose {
  const legs = poses.slice(1).map((to, i) => {
    const path = glidePath(base, poses[i]!, to);
    return { path, dur: glideSeconds(path.length) };
  });
  const total = legs.reduce((a, l) => a + l.dur + HOLD_S, 0);
  let u = ((t % total) + total) % total;
  for (const leg of legs) {
    if (u < HOLD_S) return leg.path.at(0);
    u -= HOLD_S;
    if (u < leg.dur) return leg.path.at(easeGlide(u / leg.dur));
    u -= leg.dur;
  }
  return poses[poses.length - 1]!;
}

const section: StudioSection = {
  id: 'camera',
  title: 'Camera · playground',
  order: 60,
  entries: [
    {
      id: 'playground',
      label: 'map with the view (left) and the stage through the camera (right): overview → plant → plant → closest → overview',
      w: 640,
      h: 220,
      animated: true,
      render(canvas, { t, seed, pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        const base = createViewport(STAGE.w, STAGE.h, 1);
        const { poses, slots } = track(base, seed);
        const pose = poseAt(base, poses, t);
        const view = composeView(base, pose);
        const hl = new Set(slots);
        // the map (top left), with the view's rect
        const map = createViewport(320, 200, pixelRatio);
        drawGarden(ctx, map, hl);
        ctx.save();
        map.applyTo(ctx);
        ctx.strokeStyle = '#3b352e';
        ctx.lineWidth = 6;
        const v = view.visible;
        ctx.strokeRect(v.x, v.y, v.w, v.h);
        ctx.restore();
        // the stage through the camera (right)
        const off = document.createElement('canvas');
        off.width = STAGE.w * pixelRatio;
        off.height = STAGE.h * pixelRatio;
        drawGarden(off.getContext('2d')!, composeView(createViewport(STAGE.w, STAGE.h, pixelRatio), pose), hl);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(off, 330 * pixelRatio, 10 * pixelRatio);
        ctx.fillStyle = '#3b352e';
        ctx.font = `${11 * pixelRatio}px serif`;
        ctx.fillText(`zoom ${pose.zoom.toFixed(2)}`, 336 * pixelRatio, 216 * pixelRatio);
      },
    },
  ],
};

export default section;
