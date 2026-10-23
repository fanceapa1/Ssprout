/**
 * Studio: creatures seen close (ADR 0188). Each creature at the camera's closest zoom on a DPR-2
 * desktop: left, its parts painted at the overview's resolution and upscaled (what a close view
 * showed before); right, the parts a resting close view paints in idle time.
 */
import type { StudioSection } from '../studio/types';
import { paintBee } from './creatures/bee';
import { paintBird } from './creatures/bird';
import { paintButterfly } from './creatures/butterfly';
import { paintDragonfly } from './creatures/dragonfly';
import { paintFrog } from './creatures/frog';
import { ArtCache, drawSprite, type Sprite } from './sprite';

const PANEL = 260;
/** device px per world unit: the overview on a 1440×900 DPR-2 desktop, and 3× that */
const OVERVIEW = ArtCache.bucket(1.8);
const CLOSE = ArtCache.bucket(5.4);

interface Pose {
  /** world units across the panel */
  span: number;
  parts(res: number): { s: Sprite; x: number; y: number }[];
}

const POSES: Record<string, Pose> = {
  bee: {
    span: 26,
    parts: (r) => {
      const p = paintBee(r, 600);
      return [
        { s: p.wings, x: 0, y: 0 },
        { s: p.body, x: 0, y: 0 },
      ];
    },
  },
  butterfly: {
    span: 46,
    parts: (r) => {
      const p = paintButterfly(r, 505, 'swallowtail');
      return [
        { s: p.wingL, x: 0, y: 0 },
        { s: p.wingR, x: 0, y: 0 },
        { s: p.body, x: 0, y: 0 },
      ];
    },
  },
  dragonfly: {
    span: 46,
    parts: (r) => {
      const p = paintDragonfly(r, 400, 0);
      return [
        { s: p.wings, x: 0, y: 0 },
        { s: p.body, x: 0, y: 0 },
      ];
    },
  },
  sparrow: {
    span: 36,
    parts: (r) => {
      const p = paintBird(r, 812, 'sparrow');
      return [
        { s: p.tail, x: 0, y: 0 },
        { s: p.body, x: 0, y: 0 },
      ];
    },
  },
  frog: { span: 30, parts: (r) => [{ s: paintFrog(r, 1200).sit, x: 0, y: 0 }] },
};

const cache = new Map<string, { s: Sprite; x: number; y: number }[]>();

const section: StudioSection = {
  id: 'close-view-fauna',
  title: 'Close view · creatures (overview parts | close parts)',
  order: 362,
  entries: Object.entries(POSES).map(([id, pose]) => ({
    id,
    label: `${id} at 3×: overview parts upscaled (left), close parts (right)`,
    w: PANEL * 2 + 10,
    h: PANEL,
    render(canvas: HTMLCanvasElement, { pixelRatio }: { pixelRatio: number }) {
      const ctx = canvas.getContext('2d')!;
      [OVERVIEW, CLOSE].forEach((res, i) => {
        const key = `${id}@${res}`;
        let parts = cache.get(key);
        if (!parts) cache.set(key, (parts = pose.parts(res)));
        const x = i * (PANEL + 10);
        const k = (PANEL * pixelRatio) / pose.span;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x * pixelRatio, 0, PANEL * pixelRatio, PANEL * pixelRatio);
        ctx.beginPath();
        ctx.rect(x * pixelRatio, 0, PANEL * pixelRatio, PANEL * pixelRatio);
        ctx.clip();
        ctx.setTransform(k, 0, 0, k, (x + PANEL / 2) * pixelRatio, (PANEL / 2) * pixelRatio);
        ctx.imageSmoothingEnabled = true;
        for (const p of parts) drawSprite(ctx, p.s, p.x, p.y);
        ctx.restore();
      });
    },
  })),
};

export default section;
