/**
 * Studio: the landscape seen close (ADRs 0185, 0186). Each entry shows a small part of the world
 * at the camera's closest zoom: left, the overview painting as a close view first shows it
 * (upscaled from 1.5 px per unit); right, the detail painting that fades in once the camera rests
 * (2.8 px per unit). Both come from the same seeded marks, so the right is the left resolved, not
 * a different painting.
 */
import type { Rect } from '../render/viewport';
import type { StudioSection } from '../studio/types';
import { GARDEN_ART, paintSceneSync, type ElementId, type PaintResult } from './background';
import { TREES } from './layout';

const PANEL = 300;
const OVERVIEW_SCALE = 1.5;
const DETAIL_SCALE = 2.8;

/** Draw a painting into a PANEL² panel at x showing `rect` (on white paper). */
function panel(ctx: CanvasRenderingContext2D, x: number, pr: number, rect: Rect, res: PaintResult): void {
  const k = (PANEL * pr) / rect.w;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(x * pr, 0, PANEL * pr, PANEL * pr);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x * pr, 0, PANEL * pr, PANEL * pr);
  ctx.setTransform(k, 0, 0, k, x * pr - rect.x * k, -rect.y * k);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(res.canvas as CanvasImageSource, res.view.rect.x, res.view.rect.y, res.view.rect.w, res.view.rect.h);
  ctx.restore();
}

/**
 * The overview and the detail paintings of `rect` (only some elements: a studio entry should not
 * paint the whole garden). The overview paints a wider area at the overview's scale, as the app
 * does, so its wet layers are cut where the app's are not.
 */
function pair(rect: Rect, only: readonly ElementId[]): [PaintResult, PaintResult] {
  const wide = { x: Math.max(0, rect.x - 200), y: Math.max(0, rect.y - 150), w: rect.w + 400, h: rect.h + 300 };
  const overview = paintSceneSync(GARDEN_ART, { rect: wide, scale: OVERVIEW_SCALE }, { only, sprites: false });
  const detail = paintSceneSync(GARDEN_ART, { rect: { x: rect.x - 40, y: rect.y - 40, w: rect.w + 80, h: rect.h + 80 }, scale: DETAIL_SCALE }, { only, sprites: false });
  return [overview, detail];
}

const cache = new Map<string, [PaintResult, PaintResult]>();
const pairOf = (key: string, rect: Rect, only: readonly ElementId[]) => {
  let p = cache.get(key);
  if (!p) cache.set(key, (p = pair(rect, only)));
  return p;
};

const section: StudioSection = {
  id: 'close-view',
  title: 'Close view · landscape (overview | detail)',
  order: 62,
  entries: [
    {
      id: 'ground',
      label: 'the near meadow at 3×: wet-in-wet greens, back-runs, granulation, a few grass strokes',
      w: PANEL * 2 + 10,
      h: PANEL,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        // the seed walks along the near banks
        const spots = [
          { x: 160, y: 640 },
          { x: 330, y: 760 },
          { x: 1180, y: 820 },
          { x: 1380, y: 700 },
        ];
        const s = spots[(seed - 1 + spots.length * 10) % spots.length]!;
        const rect = { x: s.x - 90, y: s.y - 90, w: 180, h: 180 };
        const [o, d] = pairOf(`ground:${s.x},${s.y}`, rect, ['banks', 'path', 'pond', 'tufts']);
        panel(ctx, 0, pixelRatio, rect, o);
        panel(ctx, PANEL + 10, pixelRatio, rect, d);
      },
    },
    {
      id: 'margin',
      label: 'the paper margin by the left edge at 2×: one ragged lift, no bands',
      w: PANEL * 2 + 10,
      h: PANEL,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        const rect = { x: 0, y: 520, w: 280, h: 280 };
        const [o, d] = pairOf('margin', rect, ['banks', 'margins']);
        panel(ctx, 0, pixelRatio, rect, o);
        panel(ctx, PANEL + 10, pixelRatio, rect, d);
      },
    },
    {
      id: 'trunk',
      label: 'a trunk at 3×: shadow flank, bark striations, a knot, joined forks',
      w: PANEL * 2 + 10,
      h: PANEL,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        const tree = TREES[(seed - 1 + TREES.length * 10) % TREES.length]!;
        const stem = tree.stems[0]!;
        const mid = stem[Math.floor(stem.length / 2)]!;
        const rect = { x: mid.x - 70, y: mid.y - 90, w: 160, h: 160 };
        const [o, d] = pairOf(`trunk:${tree.id}`, rect, ['trees', 'banks']);
        panel(ctx, 0, pixelRatio, rect, o);
        panel(ctx, PANEL + 10, pixelRatio, rect, d);
      },
    },
  ],
};

export default section;
