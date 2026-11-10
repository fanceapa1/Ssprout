/**
 * Studio: the oasis's composition map over its painting (shapes, terraces, the footpath, slots
 * with their 1.25× plant boxes, the sun's and the moon's paths, the stars, the portrait crop), and
 * the painting alone under the placeholder sky's midday tint.
 */
import type { DaylightState } from '../../ambience/daylight';
import { moonDisc, stars, sunDisc } from '../../ambience/sky-layout';
import { createRng } from '../../core/rng';
import { createPainter, paperTexture } from '../../paint';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import { drawSlotOverlay } from '../../scene/overlay';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { OASIS } from '.';
import { BASIN_STONE, BASIN_WATER } from './geometry';
import { KSAR_SHAPES } from './ksar';
import { BACK_BEDS, BACK_RUNNEL, BLUFF, BUNDS, FOOTPATH, NEAR_PLOTS, openSky, OASIS_SKY_LAYOUT, WALLS } from './layout';

const scene = OASIS.geometry;

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

/** The painting with its paper, scaled into the canvas (world units → px by `k`). */
function painting(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, seed: number, sky: boolean): void {
  const scale = canvas.width / WORLD_W;
  const res = paintSceneSync({ ...OASIS.art, seed }, { rect: { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, scale });
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
    OASIS.sky.paint(p, createRng('oasis-map-sky'), 'midday');
    ctx.drawImage(plate, 0, 0);
  }
  ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

function drawMap(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 2;
  poly(ctx, openSky(), 'rgba(170,200,230,0.25)', 'rgba(60,90,160,0.6)');
  poly(ctx, BLUFF, null, '#8f4a3e');
  for (const s of KSAR_SHAPES) for (const q of [s.front, s.flank]) if (q.length) poly(ctx, q, null, '#8f4a3e');
  for (const plot of NEAR_PLOTS) poly(ctx, plot, null, '#8a6a3a');
  for (const b of BUNDS) poly(ctx, b, null, '#8a6a3a', false);
  // the beds behind the basin and their head ditch (O12)
  for (const bed of BACK_BEDS) poly(ctx, bed, null, '#8a6a3a');
  poly(ctx, BACK_RUNNEL, null, '#2b5d66', false);
  poly(ctx, BASIN_STONE, null, '#6d5a44');
  poly(ctx, BASIN_WATER, 'rgba(80,150,170,0.2)', '#2b5d66');
  for (const s of scene.streams) poly(ctx, s, 'rgba(80,150,170,0.25)', '#3f7f8f');
  ctx.lineWidth = 5;
  for (const w of WALLS) poly(ctx, w.edge, null, '#b0703c', false);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  poly(ctx, FOOTPATH, null, '#8a6a3a', false);
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  // the sun's paths (rising, setting), the moon's arc and the stars
  const sky = OASIS_SKY_LAYOUT;
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
  // the portrait crop (MIN_VISIBLE_W wide round the focus) and the focus
  const { focus } = OASIS.view;
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = '#d9623d';
  ctx.lineWidth = 3;
  ctx.strokeRect(focus.x - MIN_VISIBLE_W / 2, 2, MIN_VISIBLE_W, WORLD_H - 4);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(focus.x - 16, focus.y);
  ctx.lineTo(focus.x + 16, focus.y);
  ctx.moveTo(focus.x, focus.y - 16);
  ctx.lineTo(focus.x, focus.y + 16);
  ctx.stroke();
  label(ctx, 'basin', 770, 604, '#2b5d66');
  label(ctx, 'oued', 1420, 700, '#2b5d66');
  label(ctx, 'footpath', 850, 990, '#8a6a3a');
  label(ctx, 'ksar', 610, 120, '#8f4a3e');
  label(ctx, 'sunset', 860, 290, '#c2414f');
  label(ctx, 'sunrise', 990, 300, '#b07a2a');
  label(ctx, 'portrait crop', focus.x - MIN_VISIBLE_W / 2 + 10, 30, '#d9623d');
}

const map: StudioEntry = {
  id: 'map',
  label: 'composition map over the painting: shapes, walls, footpath, the beds behind the basin, slots (habitat · id · max size, 1.25× boxes), sun, moon, stars, portrait crop',
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
  label: "draft A's painting as the oasis paints it, under the placeholder midday sky plate",
  w: 800,
  h: 500,
  render(canvas, { seed }) {
    painting(canvas.getContext('2d')!, canvas, seed, true);
  },
};

const section: StudioSection = {
  id: 'oasis-map',
  title: 'Scenery · oasis map',
  order: 141,
  entries: [map, painted],
};

export default section;
