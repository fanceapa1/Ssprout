/**
 * Studio: the oasis's wildlife targets over its painting (ADR 0304): every perch with a bird of
 * the size that would stand there, the hoopoe's plots, the gecko's wall faces, the heron's stands,
 * the portrait crop and the fauna stage's crop. `fauna-oasis/all` runs the creatures themselves.
 */
import { paperTexture } from '../../paint';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt, type Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { OASIS_STAGE } from '../../fauna/stage';
import type { Perch } from '../../fauna/targets';
import { OASIS } from '.';
import { OASIS_GROUND, OASIS_PERCHES, OASIS_STANDS, OASIS_WALLS, oasisPerspective } from './wildlife';

/** Colour and the height (world units at scale 1) of the bird that would use each perch kind. */
const KINDS: Partial<Record<Perch['kind'], { colour: string; size: number }>> = {
  wall: { colour: '#d0662a', size: 19 },
  rim: { colour: '#1f7f86', size: 19 },
  frond: { colour: '#3f7a2a', size: 28 },
  tower: { colour: '#c0283a', size: 150 },
  post: { colour: '#7a3fa0', size: 12 },
  rock: { colour: '#6b4a2a', size: 19 },
  stone: { colour: '#6b4a2a', size: 19 },
  ledge: { colour: '#6b4a2a', size: 19 },
};

function poly(ctx: CanvasRenderingContext2D, pts: readonly Pt[]): void {
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
}

/** A standing figure `h` tall with its feet at (x, y). */
function figure(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, colour: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.4, h * 0.22, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = `${colour}aa`;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(0.6, h * 0.04);
  ctx.stroke();
}

function drawTargets(ctx: CanvasRenderingContext2D, unit: number): void {
  for (const w of OASIS_WALLS) {
    poly(ctx, w.outline);
    ctx.fillStyle = 'rgba(200,120,40,0.18)';
    ctx.fill();
    ctx.strokeStyle = '#a0521e';
    ctx.lineWidth = unit;
    ctx.setLineDash([4 * unit, 3 * unit]);
    ctx.stroke();
    ctx.setLineDash([]);
    // a gecko-sized mark at the middle of each face
    const m = w.top[Math.floor(w.top.length / 2)]!;
    const s = oasisPerspective(m.x, m.y + w.h / 2);
    ctx.fillStyle = '#5a4e42';
    ctx.fillRect(m.x - 6 * s, m.y + w.h / 2 - 1.5 * s, 12 * s, 3 * s);
  }
  for (const g of OASIS_GROUND) {
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(210,150,100,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#b0603a';
    ctx.lineWidth = unit * 1.5;
    ctx.stroke();
    figure(ctx, g.x, g.y, 34 * oasisPerspective(g.x, g.y), '#d39a6a');
  }
  for (const s of OASIS_STANDS) {
    const h = 150 * oasisPerspective(s.x, s.y);
    figure(ctx, s.x, s.y, h, '#5a6a8a');
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - h * 0.7);
    ctx.lineTo(s.x + s.facing * h * 0.3, s.y - h * 0.7);
    ctx.strokeStyle = '#1a2a4a';
    ctx.lineWidth = unit * 2;
    ctx.stroke();
  }
  for (const p of OASIS_PERCHES) {
    const k = KINDS[p.kind] ?? KINDS.rock!;
    const slope = p.slope ?? 0;
    ctx.beginPath();
    ctx.moveTo(p.x - p.spread, p.y - slope * p.spread);
    ctx.lineTo(p.x + p.spread, p.y + slope * p.spread);
    ctx.strokeStyle = k.colour;
    ctx.lineWidth = unit * 2.5;
    ctx.stroke();
    figure(ctx, p.x, p.y, k.size * (p.scale ?? oasisPerspective(p.x, p.y)), k.colour);
  }
}

function painting(canvas: HTMLCanvasElement, rect: Rect, seed: number): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / rect.w;
  const res = paintSceneSync({ ...OASIS.art, seed }, { rect, scale: k });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(k, 0, 0, k, -rect.x * k, -rect.y * k);
  return ctx;
}

const whole: StudioEntry = {
  id: 'targets',
  label: 'every perch (wall orange, rim teal, frond green, tower red, gate post violet, stone brown) with a bird of its size, the hoopoe’s plots, the gecko’s wall faces, the heron’s stands; the portrait crop (orange dashes) and the fauna stage’s crop (blue)',
  w: 1200,
  h: 750,
  render(canvas, { seed }) {
    const ctx = painting(canvas, { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, seed);
    drawTargets(ctx, 1.4);
    const { focus } = OASIS.view;
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d9623d';
    ctx.strokeRect(focus.x - MIN_VISIBLE_W / 2, 2, MIN_VISIBLE_W, WORLD_H - 4);
    ctx.strokeStyle = '#3a5ab0';
    ctx.strokeRect(OASIS_STAGE.x, OASIS_STAGE.y, OASIS_STAGE.w, OASIS_STAGE.h);
    ctx.setLineDash([]);
  },
};

const close: StudioEntry = {
  id: 'targets-close',
  label: 'the same, close on the fauna stage’s crop: the middle tower, the walls’ ends, the basin and its gate, the grove’s edge, the near plots',
  w: 880,
  h: 790,
  render(canvas, { seed }) {
    drawTargets(painting(canvas, OASIS_STAGE, seed), 0.8);
  },
};

const section: StudioSection = {
  id: 'oasis-wildlife',
  title: 'Scenery · oasis wildlife targets',
  order: 142,
  entries: [whole, close],
};

export default section;
