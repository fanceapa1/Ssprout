/**
 * Studio: the coast's composition map over its placeholder painting (the far hill, the promontory
 * and temple, the broken shoreline, walls, path and steps, beach, shelf and pools, slots with their
 * 1.25× plant boxes, the sun's and the moon's paths, the stars, the focus and the crops), and the
 * painting alone under the placeholder midday sky.
 */
import type { DaylightState } from '../../ambience/daylight';
import { moonDisc, stars, sunDisc } from '../../ambience/sky-layout';
import { createRng } from '../../core/rng';
import { createPainter, paperTexture } from '../../paint';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import { drawSlotOverlay } from '../../scene/overlay';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { COAST } from '.';
import { POOL_WATER, SEA_WATER } from './geometry';
import { BEACH, COAST_SKY_LAYOUT, FAR_HILL, LAND, openSky, PATH, PROMONTORY, SHELF, SPLASH_ROCKS, STEPS, TEMPLE_SHAPES, WALLS } from './layout';

// the studio loads only the released gardens' painters; the coast is behind its flag
await COAST.painters.load();

const scene = COAST.geometry;

function poly(ctx: CanvasRenderingContext2D, pts: readonly Pt[], fill: string | null, stroke?: string, close = true): void {
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  if (close) ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour = '#33302a'): void {
  ctx.font = 'italic 600 22px Georgia, serif';
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/** A daylight state with only what `sunDisc`/`moonDisc` read. */
function light(alt: number, rising: boolean, moon = 0): DaylightState {
  return { sunAltitude: alt, sunRising: rising, moonProgress: moon, weights: { sunrise: 1, sunset: 1, midday: 0, night: 1 } } as unknown as DaylightState;
}

/** The painting with its paper (and the midday plate), scaled into the canvas. */
function painting(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, seed: number, sky: boolean): void {
  const scale = canvas.width / WORLD_W;
  const res = paintSceneSync({ ...COAST.art, seed }, { rect: { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, scale });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'multiply';
  if (sky) {
    const plate = document.createElement('canvas');
    plate.width = canvas.width;
    plate.height = canvas.height;
    const p = createPainter(plate);
    p.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    COAST.painters.get()!.sky.paint(p, createRng('coast-map-sky'), 'midday');
    ctx.drawImage(plate, 0, 0);
  }
  ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

function drawMap(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 2;
  poly(ctx, openSky(), 'rgba(170,200,230,0.25)', 'rgba(60,90,160,0.6)');
  poly(ctx, FAR_HILL, null, '#7a6a9a');
  poly(ctx, PROMONTORY, null, '#6f6a60');
  for (const t of TEMPLE_SHAPES) poly(ctx, t, null, '#6f6a60');
  poly(ctx, SEA_WATER, 'rgba(60,150,180,0.12)', '#2b5d66');
  for (const p of POOL_WATER) poly(ctx, p, 'rgba(60,150,180,0.25)', '#2b5d66');
  poly(ctx, LAND, null, '#8a6a3a');
  poly(ctx, BEACH, null, '#b08a4a');
  poly(ctx, SHELF, null, '#6f6a60');
  for (const r of SPLASH_ROCKS) {
    ctx.beginPath();
    ctx.ellipse(r.x, r.y - r.w * 0.2, r.w / 2, r.w * 0.28, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#6f6a60';
    ctx.stroke();
  }
  ctx.lineWidth = 5;
  for (const w of WALLS) poly(ctx, w.edge, null, '#b0703c', false);
  ctx.lineWidth = 3;
  for (const s of STEPS) poly(ctx, [{ x: s.x - 26, y: s.y }, { x: s.x + 26, y: s.y }, { x: s.x + 30, y: s.y + s.n * 15 }, { x: s.x - 30, y: s.y + s.n * 15 }], null, '#6f6a60');
  ctx.setLineDash([10, 8]);
  poly(ctx, PATH, null, '#8a6a3a', false);
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  const sky = COAST_SKY_LAYOUT;
  for (const rising of [true, false]) {
    for (let alt = -3; alt <= 16; alt += 3) {
      const d = sunDisc(light(alt, rising), sky);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.strokeStyle = rising ? '#e1a052' : '#c2414f';
      ctx.stroke();
    }
  }
  for (let u = 0; u <= 1.001; u += 0.125) {
    const d = moonDisc(light(0, true, u), sky);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.strokeStyle = '#4a59b0';
    ctx.stroke();
  }
  ctx.fillStyle = '#2e3a6e';
  for (const s of stars(30, 'stars', sky)) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // the portrait crop (MIN_VISIBLE_W wide round the focus), the 16:9 band (y 100–1000) and the focus
  const { focus } = COAST.view;
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = '#d9623d';
  ctx.lineWidth = 3;
  ctx.strokeRect(focus.x - MIN_VISIBLE_W / 2, 2, MIN_VISIBLE_W, WORLD_H - 4);
  const top = Math.max(0, Math.min(100, focus.y - 450));
  ctx.strokeStyle = '#9a4ad9';
  ctx.strokeRect(4, top, WORLD_W - 8, WORLD_H - top - 4);
  ctx.setLineDash([]);
  ctx.strokeStyle = '#d9623d';
  ctx.beginPath();
  ctx.moveTo(focus.x - 16, focus.y);
  ctx.lineTo(focus.x + 16, focus.y);
  ctx.moveTo(focus.x, focus.y - 16);
  ctx.lineTo(focus.x, focus.y + 16);
  ctx.stroke();
  label(ctx, 'sea', 300, 560, '#2b5d66');
  label(ctx, 'temple', 700, 280, '#6f6a60');
  label(ctx, 'village', 140, 290, '#7a6a9a');
  label(ctx, 'terraces', 1320, 760, '#b0703c');
  label(ctx, 'beach · pools', 200, 930, '#2b5d66');
  label(ctx, 'portrait crop', focus.x - MIN_VISIBLE_W / 2 + 10, 30, '#d9623d');
  label(ctx, '16:9', 14, top + 26, '#9a4ad9');
}

const map: StudioEntry = {
  id: 'map',
  label: 'composition map over the placeholder painting: landforms, shoreline, walls, path, steps, slots (habitat · id · max size, 1.25× boxes), sun, moon, stars, portrait crop and the 16:9 band',
  w: 1200,
  h: 750,
  render(canvas, { seed }) {
    const ctx = canvas.getContext('2d')!;
    painting(ctx, canvas, seed, false);
    const k = canvas.width / WORLD_W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawMap(ctx);
    drawSlotOverlay(ctx, scene);
  },
};

const painted: StudioEntry = {
  id: 'painting',
  label: "draft B's steps on the final layout, as the coast paints them, under the placeholder midday sky plate",
  w: 800,
  h: 500,
  render(canvas, { seed }) {
    painting(canvas.getContext('2d')!, canvas, seed, true);
  },
};

const section: StudioSection = {
  id: 'coast-map',
  title: 'Scenery · coast map',
  order: 152,
  entries: [map, painted],
};

export default section;
