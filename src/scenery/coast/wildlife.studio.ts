/**
 * Studio: the coast's wildlife places over its painting (ADR 0373): every perch with a creature of
 * the size that would stand there, the walks and scrub, the wall and splash-rock faces, the
 * shallows, pools, far bay, sky and bark, the heron's stands, the portrait crop and the fauna
 * stage's crop. `fauna-coast/all` runs the creatures themselves.
 */
import { paperTexture } from '../../paint';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt, type Rect } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST_STAGE } from '../../fauna/stage';
import { regionScale, type Perch, type Region } from '../../fauna/targets';
import { COAST } from '.';
import { COAST_GROUND, COAST_PERCHES, COAST_REGIONS, COAST_STANDS, COAST_WALLS, coastPerspective } from './wildlife';
import { bedAt, fissureAt, fissureFoot, PROMONTORY_FORM, topAt } from './shapes';

// the studio loads only the released gardens' painters; the coast is behind its flag
await COAST.painters.load();

/** Colour and the height (world units at scale 1) of what would use each perch kind. */
const KINDS: Partial<Record<Perch['kind'], { colour: string; size: number }>> = {
  wall: { colour: '#d0662a', size: 30 },
  branch: { colour: '#3f7a2a', size: 22 },
  jar: { colour: '#b0503a', size: 19 },
  rock: { colour: '#6b4a2a', size: 40 },
  ruin: { colour: '#2a4a9a', size: 22 },
  boat: { colour: '#c0283a', size: 60 },
  crown: { colour: '#3a6a4a', size: 22 },
  ledge: { colour: '#7a3fa0', size: 110 },
};

const REGIONS: Record<Region['kind'], string> = {
  shallows: 'rgba(40,140,200,0.22)',
  pool: 'rgba(40,170,180,0.35)',
  bay: 'rgba(30,60,160,0.35)',
  sky: 'rgba(120,150,220,0.12)',
  bark: 'rgba(120,70,30,0.45)',
};

function poly(ctx: CanvasRenderingContext2D, pts: readonly Pt[]): void {
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath();
}

/** A standing figure `h` tall with its feet at (x, y). */
function figure(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, colour: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.4, Math.max(0.8, h * 0.22), Math.max(1.2, h * 0.4), 0, 0, Math.PI * 2);
  ctx.fillStyle = `${colour}cc`;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(0.5, h * 0.04);
  ctx.stroke();
}

function drawTargets(ctx: CanvasRenderingContext2D, unit: number): void {
  for (const r of COAST_REGIONS) {
    ctx.beginPath();
    poly(ctx, r.outline);
    for (const h of r.holes ?? []) poly(ctx, h.slice().reverse());
    ctx.fillStyle = REGIONS[r.kind];
    ctx.fill('evenodd');
    ctx.strokeStyle = REGIONS[r.kind].replace(/[\d.]+\)$/, '0.9)');
    ctx.lineWidth = unit;
    ctx.setLineDash([5 * unit, 3 * unit]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (r.kind === 'bay') {
      // a dolphin-length dash (2 m) at the bay's top and bottom, at its own scale
      for (const y of [r.outline[0]!.y + 4, r.outline[2]!.y - 4]) {
        const len = 250 * regionScale(r, y)!;
        ctx.fillStyle = '#1a2a4a';
        ctx.fillRect(r.outline[0]!.x + 40, y - 1, len, Math.max(1, len * 0.18));
      }
    }
  }
  for (const w of COAST_WALLS) {
    ctx.beginPath();
    poly(ctx, w.outline);
    ctx.fillStyle = w.id.startsWith('splash') ? 'rgba(160,40,40,0.3)' : 'rgba(200,120,40,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#a0521e';
    ctx.lineWidth = unit;
    ctx.setLineDash([4 * unit, 3 * unit]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const g of COAST_GROUND) {
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g.id.startsWith('scrub') ? 'rgba(90,130,40,0.35)' : 'rgba(210,150,100,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#b0603a';
    ctx.lineWidth = unit * 1.2;
    ctx.stroke();
    figure(ctx, g.x, g.y, 30 * coastPerspective(g.x, g.y), '#d39a6a');
  }
  for (const s of COAST_STANDS) {
    const h = 150 * coastPerspective(s.x, s.y);
    figure(ctx, s.x, s.y, h, '#5a6a8a');
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - h * 0.7);
    ctx.lineTo(s.x + s.facing * h * 0.3, s.y - h * 0.7);
    ctx.strokeStyle = '#1a2a4a';
    ctx.lineWidth = unit * 2;
    ctx.stroke();
  }
  for (const p of COAST_PERCHES) {
    const k = KINDS[p.kind] ?? { colour: '#000000', size: 19 };
    const slope = p.slope ?? 0;
    ctx.beginPath();
    ctx.moveTo(p.x - p.spread, p.y - slope * p.spread);
    ctx.lineTo(p.x + p.spread, p.y + slope * p.spread);
    ctx.strokeStyle = k.colour;
    ctx.lineWidth = unit * 2;
    ctx.stroke();
    figure(ctx, p.x, p.y, k.size * (p.scale ?? coastPerspective(p.x, p.y)), k.colour);
  }
}

function painting(canvas: HTMLCanvasElement, rect: Rect, seed: number): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / rect.w;
  const res = paintSceneSync({ ...COAST.art, seed }, { rect, scale: k });
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
  label:
    'every place: perches with a creature of their size (coping orange, limbs green, jars terracotta, splash rocks brown, temple blue, caique red, far pines dark green, cliff ledges violet), walks and scrub, wall and splash-rock faces, the shallows, pools, far bay (dolphin dashes), sky and bark, the heron’s stands; the portrait crop (orange dashes) and the fauna stage’s crop (blue)',
  w: 1200,
  h: 750,
  render(canvas, { seed }) {
    const ctx = painting(canvas, { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, seed);
    drawTargets(ctx, 1.4);
    const { focus } = COAST.view;
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d9623d';
    ctx.strokeRect(focus.x - MIN_VISIBLE_W / 2, 2, MIN_VISIBLE_W, WORLD_H - 4);
    ctx.strokeStyle = '#3a5ab0';
    ctx.strokeRect(COAST_STAGE.x, COAST_STAGE.y, COAST_STAGE.w, COAST_STAGE.h);
    ctx.setLineDash([]);
  },
};

/** The promontory's face for the goats: its hard beds (red), soft beds (grey) and fissures (blue). */
function drawFace(ctx: CanvasRenderingContext2D, unit: number): void {
  for (const bed of PROMONTORY_FORM.beds) {
    ctx.beginPath();
    for (let x = 640; x <= 1640; x += 4) ctx.lineTo(x, bedAt(bed, x));
    ctx.strokeStyle = bed.hard ? 'rgba(200,40,40,0.8)' : 'rgba(80,80,80,0.35)';
    ctx.lineWidth = unit * (bed.hard ? 1 : 0.5);
    ctx.stroke();
  }
  for (const f of PROMONTORY_FORM.fissures) {
    ctx.beginPath();
    for (let y = topAt(f.x); y <= fissureFoot(f); y += 3) ctx.lineTo(fissureAt(f, y), y);
    ctx.strokeStyle = f.depth > 0.75 ? 'rgba(40,60,200,0.7)' : 'rgba(40,60,200,0.35)';
    ctx.lineWidth = unit;
    ctx.stroke();
  }
}

const CLIFF: Rect = { x: 630, y: 260, w: 1000, h: 270 };
const goats: StudioEntry = {
  id: 'goats',
  label: 'the promontory close at the garden’s own art seed, as painted (top) and with its face’s form (hard beds red, soft grey, fissures blue) and the goats’ ledges (violet, a goat’s height) (bottom)',
  w: 2000,
  h: 1088,
  render(canvas) {
    const half = document.createElement('canvas');
    half.width = canvas.width;
    half.height = Math.round((canvas.width * CLIFF.h) / CLIFF.w);
    painting(half, CLIFF, COAST.art.seed);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(half, 0, 0);
    ctx.drawImage(half, 0, half.height + 4);
    const k = canvas.width / CLIFF.w;
    ctx.setTransform(k, 0, 0, k, -CLIFF.x * k, -CLIFF.y * k + half.height + 4);
    drawFace(ctx, 0.6);
    drawTargets(ctx, 0.5);
  },
};

const crop = (id: string, label: string, rect: Rect, w: number, unit: number): StudioEntry => ({
  id,
  label,
  w,
  h: Math.round((w * rect.h) / rect.w),
  render(canvas, { seed }) {
    drawTargets(painting(canvas, rect, seed), unit);
  },
});

/** A tree's perches close: each perch's point (cross) and id over the painting, for checking against the wood. */
const trees = (id: string, label: string, rect: Rect): StudioEntry => ({
  id,
  label,
  w: 900,
  h: Math.round((900 * rect.h) / rect.w),
  render(canvas, { seed }) {
    const ctx = painting(canvas, rect, seed);
    const u = rect.w / 900;
    for (const p of COAST_PERCHES.filter((q) => q.kind === 'branch' || q.kind === 'crown')) {
      ctx.strokeStyle = '#e0204a';
      ctx.lineWidth = u * 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 4 * u, p.y);
      ctx.lineTo(p.x + 4 * u, p.y);
      ctx.moveTo(p.x, p.y - 4 * u);
      ctx.lineTo(p.x, p.y + 4 * u);
      ctx.stroke();
      ctx.fillStyle = '#e0204a';
      ctx.font = `${10 * u}px sans-serif`;
      ctx.fillText(p.id, p.x + 5 * u, p.y - 5 * u);
    }
  },
});

const section: StudioSection = {
  id: 'coast-wildlife',
  title: 'Scenery · coast wildlife places',
  order: 158,
  entries: [
    whole,
    crop('targets-close', 'the same, close on the fauna stage’s crop: the cove, the temple, the caique, the splash rocks, the terraces’ seaward ends', COAST_STAGE, 900, 0.8),
    goats,
    trees('targets-olive', 'the olive’s perches close (red crosses): each on the upper side of its painted limb', { x: 1150, y: 260, w: 300, h: 220 }),
    trees('targets-pine', 'the leaning pine’s perches close (red crosses): each on the upper side of its painted branch', { x: 0, y: 60, w: 300, h: 380 }),
    crop('targets-far', 'the far stages close: the bay under the far hill, the caique, the temple and the cliff ledges', { x: 180, y: 240, w: 760, h: 300 }, 1000, 0.5),
  ],
};

export default section;
