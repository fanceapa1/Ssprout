import { createRng } from '../core/rng';
import { brushStroke, PIGMENT, rgba, wobble, type Ctx, type P } from './brush';
import { paintSoil, paintSprout, type PlantPainter } from './sprout';
import type { WidgetView } from './view';

/**
 * Painting of the widget card (canvas part): washi paper, a pale wash behind the plant, soil and
 * the plant. Text and the button are DOM in the real widget (crisp, accessible); the studio
 * preview paints them too with the same layout constants (`paintCardPreview`).
 */

/** Height (CSS px) reserved under the plant for time, state line and button. */
export const FOOTER_H = 122;
export const CARD_W = 260;
export const CARD_H = 300;

export const CARD_FONTS = {
  time: '500 40px "Shippori Mincho", "Cormorant Garamond", Georgia, serif',
  state: 'italic 400 14px "Cormorant Garamond", Georgia, serif',
  button: '600 14px "Cormorant Garamond", Georgia, serif',
} as const;

/** Paint washi paper: warm ground, mottling, fibres, grain and a deckled darker edge. */
export function paintPaper(ctx: Ctx, w: number, h: number, seed: string | number = 'washi'): void {
  const rng = createRng(`paper:${seed}`);
  ctx.save();
  ctx.fillStyle = PIGMENT.paper;
  ctx.fillRect(0, 0, w, h);

  // mottling: large soft blotches, barely there
  const m = rng.fork('mottle');
  for (let i = 0; i < 16; i++) {
    const x = m.range(0, w);
    const y = m.range(0, h);
    const r = m.range(30, 110);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = m.chance(0.55) ? PIGMENT.paperDeep : '#fbf6ea';
    g.addColorStop(0, rgba(tone, m.range(0.18, 0.32)));
    g.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // fibres: short curved hairs, light and dark
  const f = rng.fork('fibres');
  const fibres = Math.round((w * h) / 380);
  ctx.lineCap = 'round';
  for (let i = 0; i < fibres; i++) {
    const x = f.range(-10, w + 10);
    const y = f.range(-10, h + 10);
    const len = f.range(5, 20);
    const a = f.range(0, Math.PI * 2);
    const bend = f.range(-4, 4);
    ctx.strokeStyle = f.chance(0.6) ? `rgba(170,150,110,${f.range(0.05, 0.12)})` : `rgba(255,252,243,${f.range(0.2, 0.4)})`;
    ctx.lineWidth = f.range(0.35, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  // grain
  const gr = rng.fork('grain');
  const dots = Math.round((w * h) / 30);
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = `rgba(120,100,70,${gr.range(0.025, 0.07)})`;
    const s = gr.range(0.5, 1.1);
    ctx.fillRect(gr.range(0, w), gr.range(0, h), s, s);
  }

  // deckled edge: an irregular, darker rim where the slip was torn
  const e = rng.fork('edge');
  ctx.globalCompositeOperation = 'multiply';
  const ring = (inset: number, amp: number): P[] => {
    const pts: P[] = [];
    const per = 2 * (w + h);
    const step = 4;
    const nz = wobble(e);
    for (let d = 0; d < per; d += step) {
      const j = inset + amp * (0.5 + 0.5 * nz(d * 0.03)) * 1.4 + e.range(0, amp * 0.5);
      if (d < w) pts.push({ x: d, y: j });
      else if (d < w + h) pts.push({ x: w - j, y: d - w });
      else if (d < 2 * w + h) pts.push({ x: w - (d - w - h), y: h - j });
      else pts.push({ x: j, y: h - (d - 2 * w - h) });
    }
    return pts;
  };
  for (let k = 0; k < 4; k++) {
    const inner = ring(1 + k * 2.2, 3 + k * 1.5);
    ctx.fillStyle = `rgba(185,165,125,${0.06 - k * 0.012})`;
    ctx.beginPath();
    ctx.rect(-2, -2, w + 4, h + 4);
    inner.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill('evenodd');
  }
  // gentle vignette: edges dissolve
  const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(1, 'rgba(200,180,140,0.16)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Where the plant stands in a card of size w×h. */
export function plantBox(w: number, h: number): { x: number; y: number; h: number } {
  const areaH = Math.max(60, h - FOOTER_H);
  return { x: w / 2, y: areaH - 4, h: Math.min(areaH * 0.78, w * 0.6) };
}

/**
 * Atmosphere behind the plant: a low ground wash the soil sits in, and a few very faint, large
 * glazes above it that dissolve into the paper (lost edges, no outline).
 */
export function paintBackdrop(ctx: Ctx, w: number, h: number, seed: string, mode: WidgetView['mode']): void {
  const rng = createRng(`backdrop:${seed}`);
  const box = plantBox(w, h);
  const tone = mode === 'complete' ? PIGMENT.sakuraPale : mode === 'paused' ? PIGMENT.stone : PIGMENT.celadon;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // ground: a few broken horizontal dry-brush dabs, no closed outline
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
  // air: soft radial glazes, no edges at all
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

export interface CardArtState {
  growth: number;
  bloom: number;
}

/** Everything the canvas shows: paper, backdrop, soil, plant. */
export function paintCardArt(
  ctx: Ctx,
  w: number,
  h: number,
  view: WidgetView,
  art: CardArtState,
  plant: PlantPainter = paintSprout,
  paper?: CanvasImageSource,
): void {
  if (paper) ctx.drawImage(paper, 0, 0, w, h);
  else paintPaper(ctx, w, h);
  paintBackdrop(ctx, w, h, view.seed, view.mode);
  const box = plantBox(w, h);
  paintSoil(ctx, box, view.seed);
  plant(ctx, box, { growth: art.growth, bloom: art.bloom, seed: view.seed, paused: view.mode === 'paused' });
}

/**
 * Studio preview of the whole card: the art plus the DOM parts painted with the same layout
 * (time, state line, washi-slip button with a vermilion seal for the primary action).
 */
export function paintCardPreview(ctx: Ctx, w: number, h: number, view: WidgetView, art: CardArtState, plant?: PlantPainter): void {
  paintCardArt(ctx, w, h, view, art, plant);
  const top = h - FOOTER_H;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (view.time) {
    ctx.font = CARD_FONTS.time;
    ctx.fillStyle = rgba(PIGMENT.ink, view.mode === 'paused' ? 0.6 : 0.92);
    ctx.fillText(view.time, w / 2, top + 42);
  }
  ctx.font = CARD_FONTS.state;
  ctx.fillStyle = rgba(PIGMENT.ink, 0.66);
  ctx.fillText(view.state, w / 2, view.time ? top + 64 : top + 40);

  // button: a washi slip, thin ink border, label (and a seal for the primary action)
  ctx.font = CARD_FONTS.button;
  const label = view.action.label;
  const primary = view.action.kind === 'open';
  const tw = ctx.measureText(label).width;
  const bw = tw + 30 + (primary ? 14 : 0);
  const bh = 30;
  const bx = w / 2 - bw / 2;
  const by = h - 18 - bh;
  ctx.fillStyle = 'rgba(250,246,238,0.55)';
  ctx.fillRect(bx, by, bw, bh);
  const rng = createRng(`button:${label}`);
  const edge = (a: P, b: P) =>
    brushStroke(ctx, [a, { x: (a.x + b.x) / 2 + rng.range(-0.4, 0.4), y: (a.y + b.y) / 2 + rng.range(-0.4, 0.4) }, b], rng, {
      width: () => 0.9,
      color: PIGMENT.ink,
      alpha: 0.5,
      edge: 0.25,
    });
  edge({ x: bx, y: by }, { x: bx + bw, y: by + 0.5 });
  edge({ x: bx + bw, y: by + 0.5 }, { x: bx + bw - 0.5, y: by + bh });
  edge({ x: bx + bw - 0.5, y: by + bh }, { x: bx + 0.5, y: by + bh - 0.3 });
  edge({ x: bx + 0.5, y: by + bh - 0.3 }, { x: bx, y: by });
  let textX = w / 2;
  if (primary) {
    const sx = bx + 14;
    const sy = by + bh / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-0.06);
    ctx.fillStyle = rgba(PIGMENT.vermilion, 0.85);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    textX += 7;
  }
  ctx.fillStyle = rgba(PIGMENT.ink, 0.9);
  ctx.textBaseline = 'middle';
  ctx.fillText(label, textX, by + bh / 2 + 1);
  ctx.restore();
}
