import { createRng } from '../core/rng';
import { brushStroke, PIGMENT, rgba, type Ctx, type P } from './brush';
import { paintPaper } from './paper';
import { paintSoil, paintSprout, type PlantPainter } from './sprout';
import type { WidgetView } from './view';

/**
 * Painting of the widget card (canvas part): washi paper, a pale wash behind the plant, soil, the
 * session's plant and the plan progress line. Text and buttons are DOM in the real widget (crisp,
 * accessible); the studio preview paints them too with the same layout (`paintCardPreview`).
 */

export const CARD_W = 260;
export const CARD_H = 340;

export const CARD_FONTS = {
  task: 'italic 500 15px "Cormorant Garamond", Georgia, serif',
  time: '500 34px "Shippori Mincho", "Cormorant Garamond", Georgia, serif',
  state: 'italic 400 13.5px "Cormorant Garamond", Georgia, serif',
  button: '600 13.5px "Cormorant Garamond", Georgia, serif',
} as const;

/**
 * Card layout (CSS px, measured from the bottom so a taller window gives the plant more room).
 * The DOM card (card.ts) positions its text and buttons with the same numbers.
 */
export const LAYOUT = {
  /** everything under the plant */
  footer: 134,
  taskBaseline: 112,
  timeBaseline: 74,
  progressY: 60,
  progressInset: 34,
  stateBaseline: 43,
  buttonsBottom: 10,
  buttonH: 26,
} as const;

/** The plant area (top of the card). */
export function plantArea(w: number, h: number): { x: number; y: number; w: number; h: number } {
  return { x: 0, y: 0, w, h: Math.max(80, h - LAYOUT.footer) };
}

/** Where the generic sprout / soil stand inside the plant area. */
export function plantBox(w: number, h: number): { x: number; y: number; h: number } {
  const a = plantArea(w, h);
  return { x: w / 2, y: a.h * 0.97, h: Math.min(a.h * 0.86, w * 0.7) };
}

/**
 * Atmosphere behind the plant: a few broken dry-brush dabs of ground and very faint large glazes
 * above that dissolve into the paper (lost edges, no outline). Tone follows the mode.
 */
export function paintBackdrop(ctx: Ctx, w: number, h: number, seed: string | number, mode: WidgetView['mode']): void {
  const rng = createRng(`backdrop:${seed}`);
  const box = plantBox(w, h);
  const tone =
    mode === 'complete' ? PIGMENT.sakuraPale : mode === 'paused' ? PIGMENT.stone : mode === 'break' ? '#8fb0ab' : PIGMENT.celadon;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = rng.fork('ground');
  for (let k = 0; k < 7; k++) {
    const len = w * g.range(0.12, 0.3) * (k < 2 ? 1.5 : 1);
    const cx = box.x + g.range(-0.24, 0.24) * w * (k < 2 ? 0.3 : 1);
    const cy = box.y + g.range(-1, 4);
    const pts: P[] = [];
    for (let i = 0; i <= 10; i++) pts.push({ x: cx - len / 2 + (len * i) / 10, y: cy + g.range(-0.6, 0.6) });
    brushStroke(ctx, pts, g.fork(`d${k}`), {
      width: (t) => Math.sin(Math.PI * t) * g.range(3, 6),
      color: k % 3 === 0 ? PIGMENT.sap : PIGMENT.sage,
      alpha: g.range(0.1, 0.18),
      edge: 0.45,
    });
  }
  const a = rng.fork('air');
  for (let k = 0; k < 4; k++) {
    const cx = box.x + a.range(-0.35, 0.35) * w * 0.5;
    const cy = box.y - box.h * a.range(0.3, 0.8);
    const r = box.h * a.range(0.35, 0.6);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, rgba(tone, mode === 'complete' ? 0.13 : 0.1));
    grad.addColorStop(0.6, rgba(tone, 0.05));
    grad.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/**
 * The thin brush progress line with plan segments: focus blocks are sage strokes (olive where
 * done), breaks are gaps holding a small water drop (filled once reached).
 */
export function paintProgressLine(ctx: Ctx, w: number, h: number, view: Pick<WidgetView, 'segments' | 'progress' | 'mode'>): void {
  if (view.segments.length === 0) return;
  const x0 = LAYOUT.progressInset;
  const x1 = w - LAYOUT.progressInset;
  const y = h - LAYOUT.progressY;
  const X = (f: number) => x0 + (x1 - x0) * f;
  const rng = createRng('progress-line');
  const gap = 4;
  const done = view.mode === 'paused' ? PIGMENT.stone : PIGMENT.olive;
  const line = (from: number, to: number): P[] => {
    const n = Math.max(2, Math.round((to - from) / 6));
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = from + ((to - from) * i) / n;
      return { x, y: y + Math.sin(x * 0.09) * 0.4 };
    });
  };
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  view.segments.forEach((seg, i) => {
    const a = X(seg.start);
    const b = X(seg.end);
    if (seg.kind === 'focus') {
      const s0 = seg.start === 0 ? a : a + gap;
      const s1 = seg.end >= 1 ? b : b - gap;
      if (s1 - s0 < 1) return;
      brushStroke(ctx, line(s0, s1), rng.fork(`t${i}`), { width: (t) => 2.2 - Math.abs(t - 0.5), color: PIGMENT.sage, alpha: 0.4, edge: 0.3 });
      const fillTo = Math.min(s1, X(view.progress));
      if (fillTo - s0 > 0.5) {
        brushStroke(ctx, line(s0, fillTo), rng.fork(`f${i}`), {
          width: (t) => 2.7 - Math.abs(t - 0.5) * 0.8,
          color: done,
          alpha: 0.72,
          edge: 0.25,
        });
      }
    } else {
      // a drop in the gap
      const cx = (a + b) / 2;
      const reached = view.progress >= seg.start;
      const r = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx, y - r * 2.1);
      ctx.bezierCurveTo(cx + r * 1.1, y - r * 0.6, cx + r, y + r, cx, y + r);
      ctx.bezierCurveTo(cx - r, y + r, cx - r * 1.1, y - r * 0.6, cx, y - r * 2.1);
      ctx.fillStyle = rgba('#6f9690', reached ? 0.7 : 0.28);
      ctx.fill();
    }
  });
  ctx.restore();
}

export interface CardArtState {
  /** displayed growth 0..1 (eases toward the view's growth) */
  growth: number;
  /** watering animation 0..1, or null */
  watering: number | null;
}

/** Draws the plant into a layer canvas; returns false when it could not (caller falls back). */
export type PlantRenderer = (
  canvas: HTMLCanvasElement,
  opts: { speciesId: string; seed: number; growth: number; watering: number | null },
) => boolean;

export interface CardArtOptions {
  renderPlant?: PlantRenderer;
  /** scratch canvas for the plant (device px), created by the caller in the target document */
  plantLayer?: HTMLCanvasElement;
  /** cached paper image (w×h CSS px) */
  paper?: CanvasImageSource;
  pixelRatio?: number;
  /** plant painter used when the species cannot be rendered (default: the generic sprout) */
  fallback?: PlantPainter;
}

/**
 * Everything the canvas shows: paper, backdrop, soil, the session's plant (via `renderPlant`
 * into `plantLayer`, else the generic sprout), the progress line. `w`/`h` are CSS px and the
 * context is already scaled to CSS px.
 */
export function paintCardArt(ctx: Ctx, w: number, h: number, view: WidgetView, art: CardArtState, opts: CardArtOptions = {}): void {
  if (opts.paper) ctx.drawImage(opts.paper, 0, 0, w, h);
  else paintPaper(ctx, w, h);
  paintBackdrop(ctx, w, h, view.seed, view.mode);
  const box = plantBox(w, h);
  paintSoil(ctx, box, String(view.seed));

  if (view.speciesId !== null) {
    const area = plantArea(w, h);
    let drawn = false;
    if (opts.renderPlant && opts.plantLayer) {
      const pr = opts.pixelRatio ?? 1;
      const layer = opts.plantLayer;
      const lw = Math.round(area.w * pr);
      const lh = Math.round(area.h * pr);
      if (layer.width !== lw || layer.height !== lh) {
        layer.width = lw;
        layer.height = lh;
      }
      drawn = opts.renderPlant(layer, { speciesId: view.speciesId, seed: view.seed, growth: art.growth, watering: art.watering });
      if (drawn) {
        ctx.save();
        if (view.mode === 'paused') ctx.globalAlpha = 0.62; // a held breath: paler, not gone
        ctx.drawImage(layer, area.x, area.y, area.w, area.h);
        ctx.restore();
      }
    }
    if (!drawn) {
      (opts.fallback ?? paintSprout)(ctx, box, {
        growth: art.growth,
        bloom: view.mode === 'complete' ? 1 : 0,
        seed: `${view.speciesId}:${view.seed}`,
        paused: view.mode === 'paused',
      });
    }
  }
  paintProgressLine(ctx, w, h, view);
}

/** The state line as shown: state plus the session total when there is one. */
export const stateLine = (view: Pick<WidgetView, 'state' | 'total'>): string => (view.total ? `${view.state} · ${view.total}` : view.state);

/**
 * Studio preview of the whole card: the art plus the DOM parts painted with the same layout
 * (task, block time, state line, washi-slip buttons; vermilion seal on the primary action).
 */
export function paintCardPreview(ctx: Ctx, w: number, h: number, view: WidgetView, art: CardArtState, opts: CardArtOptions = {}): void {
  paintCardArt(ctx, w, h, view, art, opts);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (view.task) {
    ctx.font = CARD_FONTS.task;
    ctx.fillStyle = rgba(PIGMENT.ink, 0.72);
    ctx.fillText(view.task, w / 2, h - LAYOUT.taskBaseline);
  }
  if (view.time) {
    ctx.font = CARD_FONTS.time;
    ctx.fillStyle = rgba(PIGMENT.ink, view.mode === 'paused' ? 0.6 : 0.92);
    ctx.fillText(view.time, w / 2, h - LAYOUT.timeBaseline);
  }
  ctx.font = CARD_FONTS.state;
  ctx.fillStyle = rgba(PIGMENT.ink, 0.66);
  if (view.time) ctx.fillText(stateLine(view), w / 2, h - LAYOUT.stateBaseline);
  else wrapCentered(ctx, stateLine(view), w / 2, h - LAYOUT.timeBaseline - 16, w - 40, 17);

  ctx.font = CARD_FONTS.button;
  const pad = 11;
  const gapX = 7;
  const widths = view.buttons.map((b) => ctx.measureText(b.label).width + pad * 2 + (b.primary ? 12 : 0));
  let x = w / 2 - (widths.reduce((a, b) => a + b, 0) + gapX * (widths.length - 1)) / 2;
  const by = h - LAYOUT.buttonsBottom - LAYOUT.buttonH;
  view.buttons.forEach((b, i) => {
    const bw = widths[i]!;
    paintSlip(ctx, x, by, bw, LAYOUT.buttonH, b.label);
    let tx = x + bw / 2;
    if (b.primary) {
      ctx.save();
      ctx.translate(x + pad + 3, by + LAYOUT.buttonH / 2);
      ctx.rotate(-0.06);
      ctx.fillStyle = rgba(PIGMENT.vermilion, 0.85);
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
      tx += 6;
    }
    ctx.fillStyle = rgba(PIGMENT.ink, 0.9);
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, tx, by + LAYOUT.buttonH / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    x += bw + gapX;
  });
  ctx.restore();
}

function paintSlip(ctx: Ctx, x: number, y: number, w: number, h: number, seed: string): void {
  ctx.fillStyle = 'rgba(250,246,238,0.6)';
  ctx.fillRect(x, y, w, h);
  const rng = createRng(`slip:${seed}`);
  const edge = (a: P, b: P) =>
    brushStroke(ctx, [a, { x: (a.x + b.x) / 2 + rng.range(-0.4, 0.4), y: (a.y + b.y) / 2 + rng.range(-0.4, 0.4) }, b], rng, {
      width: () => 0.9,
      color: PIGMENT.ink,
      alpha: 0.45,
      edge: 0.25,
    });
  edge({ x, y }, { x: x + w, y: y + 0.5 });
  edge({ x: x + w, y: y + 0.5 }, { x: x + w - 0.5, y: y + h });
  edge({ x: x + w - 0.5, y: y + h }, { x: x + 0.5, y: y + h - 0.3 });
  edge({ x: x + 0.5, y: y + h - 0.3 }, { x, y });
}

function wrapCentered(ctx: Ctx, text: string, cx: number, y: number, maxW: number, lineH: number): void {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
}
