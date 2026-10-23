import type { AnyCanvas } from '../paint/canvas';
import { paperTexture } from '../paint/paper';
import type { StudioSection } from '../studio/types';
import { SHADOW_INK, SHEET, grainOffset, pathOf, shadowLayers, sheetFibres, sheetOutline, type SheetStyle } from './backdrop-sheet';

/**
 * The dock's section backdrops (ADR 0208), drawn on canvas from the same geometry the page lays
 * as SVG (src/ui/backdrop.ts): the page's paper, the wash pooled under a sheet, the sheet itself
 * (the paper tile at its own offset under a lift of white, cut by the torn edge and its fringe),
 * and its fibres.
 */
const TEXT = '#3b352e';
const SOFT = '#5c5449';

let tile: AnyCanvas | null = null;
const paperTile = () => (tile ??= paperTexture(512, 512, 1, { mottle: 0, vignette: 0, grainScale: 1 }));

function paperFill(ctx: CanvasRenderingContext2D, dx = 0, dy = 0): CanvasPattern | string {
  const p = ctx.createPattern(paperTile() as CanvasImageSource, 'repeat');
  if (!p) return '#f3ecd9';
  p.setTransform(new DOMMatrix().translate(dx, dy));
  return p;
}

/** One sheet at (x, y), `w × h`, as the page lays it. */
function drawSheet(ctx: CanvasRenderingContext2D, seed: string, x: number, y: number, w: number, h: number, style: SheetStyle): void {
  ctx.save();
  ctx.translate(x, y);
  // the pooled wash under it
  const layers = shadowLayers(seed, w, h, style);
  ctx.fillStyle = SHADOW_INK;
  ctx.globalAlpha = style.glaze;
  for (const l of layers) ctx.fill(new Path2D(pathOf(l)));
  ctx.globalAlpha = style.rim;
  ctx.strokeStyle = SHADOW_INK;
  ctx.lineWidth = 1;
  ctx.setLineDash([60, 40, 90, 50]);
  ctx.stroke(new Path2D(pathOf(layers[0]!)));
  ctx.setLineDash([]);
  // the leaf: the same paper at its own offset, lifted
  const g = grainOffset(seed);
  const lay = (clip: Path2D, alpha: number) => {
    ctx.save();
    ctx.clip(clip);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = paperFill(ctx, -g.x - x, -g.y - y);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(255, 253, 247, ${style.lift})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };
  lay(new Path2D(pathOf(sheetOutline(`${seed}:fringe`, w, h, { style, grow: 1.4 }))), 0.5);
  lay(new Path2D(pathOf(sheetOutline(seed, w, h, { style }))), 1);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = `rgb(250, 247, 238)`;
  ctx.lineWidth = 0.7;
  for (const [p, q] of sheetFibres(seed, w, h, style)) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo((p.x + q.x) / 2 + 0.6, (p.y + q.y) / 2 - 0.6, q.x, q.y);
    ctx.stroke();
  }
  ctx.restore();
}

function page(canvas: HTMLCanvasElement, k: number): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  ctx.fillStyle = paperFill(ctx);
  ctx.fillRect(0, 0, canvas.width / k, canvas.height / k);
  return ctx;
}

function heading(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, helper: string): void {
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = '500 25px "Shippori Mincho", serif';
  ctx.fillText(title, x, y);
  ctx.fillStyle = SOFT;
  ctx.font = 'italic 500 18px "Cormorant Garamond", serif';
  ctx.fillText(helper, x, y + 30);
}

/** A stepping stone in the lane beside a sheet (the path stays outside it). */
function stone(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(157, 151, 135, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y, 11.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(74, 68, 60, 0.42)';
  ctx.fillRect(x - 1.2, 0, 2.4, y - 10);
  ctx.fillRect(x - 1.2, y + 10, 2.4, 400);
}

const section: StudioSection = {
  id: 'ui-backdrop',
  title: 'UI · section backdrops',
  order: 87,
  entries: [
    {
      id: 'leaf',
      label: 'A section on its leaf (Study): heading on the sheet, the stone outside',
      w: 640,
      h: 300,
      render(canvas, { pixelRatio }) {
        const ctx = page(canvas, pixelRatio);
        drawSheet(ctx, 'session', 84, 30, 520, 230, SHEET.leaf);
        stone(ctx, 50, 77);
        heading(ctx, 122, 77, 'Study', 'Your plant grows while you focus.');
        ctx.fillStyle = TEXT;
        ctx.font = '500 58px "Shippori Mincho", serif';
        ctx.fillText('24:10', 122, 180);
      },
    },
    {
      id: 'firm',
      label: 'The calendar’s firm sheet beside a leaf',
      w: 640,
      h: 420,
      render(canvas, { pixelRatio }) {
        const ctx = page(canvas, pixelRatio);
        drawSheet(ctx, 'plant', 84, 24, 520, 120, SHEET.leaf);
        drawSheet(ctx, 'calendar', 84, 190, 520, 200, SHEET.firm);
        heading(ctx, 122, 62, 'Your plant', 'The seedling for this session.');
        heading(ctx, 122, 228, 'Calendar', 'Plan a session, or tap an empty hour.');
        ctx.fillStyle = 'rgba(59, 53, 46, 0.25)';
        for (let y = 300; y < 380; y += 28) for (let x = 180; x < 560; x += 7) ctx.fillRect(x, y, 1, 1);
      },
    },
    {
      id: 'edge',
      label: 'The torn edge and the pooled wash, ×4',
      w: 480,
      h: 320,
      render(canvas, { pixelRatio }) {
        const ctx = page(canvas, pixelRatio);
        ctx.scale(4, 4);
        drawSheet(ctx, 'tools', -200, -140, 300, 200, SHEET.leaf);
      },
    },
    {
      id: 'grows',
      label: 'One seed, two heights: the top and the sides keep their tear',
      w: 640,
      h: 360,
      render(canvas, { pixelRatio }) {
        const ctx = page(canvas, pixelRatio);
        drawSheet(ctx, 'session', 30, 30, 270, 150, SHEET.leaf);
        drawSheet(ctx, 'session', 340, 30, 270, 300, SHEET.leaf);
      },
    },
  ],
};

export default section;
