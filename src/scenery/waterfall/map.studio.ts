/**
 * Studio: the waterfall's composition map (shapes, labels, slots with their 1.25× plant boxes,
 * the sun's and the moon's paths, the stars, the portrait crop) and its placeholder painting.
 */
import { moonDisc, stars, sunDisc } from '../../ambience/sky-layout';
import type { DaylightState } from '../../ambience/daylight';
import { paperTexture } from '../../paint';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt } from '../../render/viewport';
import { paintSceneSync } from '../../scene/background';
import { drawSlotOverlay } from '../../scene/overlay';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { WATERFALL } from '.';
import { FALLS, TRAIL } from './geometry';
import { CLIFF, FAR_RIDGE, LEDGES, openSky, WATERFALL_SKY_LAYOUT } from './layout';

const scene = WATERFALL.geometry;

function poly(ctx: CanvasRenderingContext2D, pts: readonly Pt[], fill: string | null, stroke?: string): void {
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
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

function drawMap(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#fbf8f0';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  poly(ctx, openSky(), '#dce9f3');
  poly(ctx, FAR_RIDGE, '#c9d3e6');
  poly(ctx, [{ x: 0, y: 470 }, { x: WORLD_W, y: 470 }, { x: WORLD_W, y: WORLD_H }, { x: 0, y: WORLD_H }], '#e3ead0');
  poly(ctx, CLIFF, '#b9b2a2', '#6d675c');
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#6f8a3c';
  for (const l of LEDGES) {
    ctx.beginPath();
    ctx.moveTo(l.edge[0].x, l.edge[0].y);
    ctx.lineTo(l.edge[1].x, l.edge[1].y);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  poly(ctx, scene.pond, '#a9d1c8', '#3f7f8f');
  for (const s of scene.streams) poly(ctx, s, '#c2e0d8', '#3f7f8f');
  poly(ctx, FALLS.outline, '#ffffff', '#5e98cc');
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2f5f9a';
  ctx.beginPath();
  FALLS.lip.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.stroke();
  ctx.lineWidth = 2;
  for (const s of TRAIL) {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#cfc2a8';
    ctx.fill();
    ctx.strokeStyle = '#8a6a3a';
    ctx.stroke();
  }
  for (const r of scene.rocks) {
    ctx.beginPath();
    ctx.ellipse(r.x, r.y - r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = r.perch ? '#8f877a' : '#a59d8f';
    ctx.fill();
  }
  // the sun's paths (rising, setting), the moon's arc and the stars
  const sky = WATERFALL_SKY_LAYOUT;
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
  const { focus } = WATERFALL.view;
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
  label(ctx, 'crown woods', 40, 300);
  label(ctx, 'falls', 584, 380, '#2f5f9a');
  label(ctx, 'buttress', 840, 300);
  label(ctx, 'far ridge', 1380, 400);
  label(ctx, 'plunge pool', 760, 736, '#2b5d66');
  label(ctx, 'stream', 1210, 1000 - 40, '#2b5d66');
  label(ctx, 'trail', 720, 990);
  label(ctx, 'sunset', 1000, 290, '#c2414f');
  label(ctx, 'sunrise', 1290, 290, '#b07a2a');
  label(ctx, 'moon', 1130, 176, '#4a59b0');
  label(ctx, 'portrait crop', focus.x - MIN_VISIBLE_W / 2 + 10, 30, '#d9623d');
}

const map: StudioEntry = {
  id: 'map',
  label: 'composition map: shapes, slots (habitat · id · max size, 1.25× boxes), sun, moon, stars, portrait crop',
  w: 960,
  h: 600,
  render(canvas) {
    const ctx = canvas.getContext('2d')!;
    const k = canvas.width / WORLD_W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawMap(ctx);
    drawSlotOverlay(ctx, scene);
  },
};

const placeholder: StudioEntry = {
  id: 'placeholder',
  label: 'the painting (the sky a flat placeholder until S10) with the painted boulders and the paper',
  w: 800,
  h: 500,
  render(canvas, { seed }) {
    const scale = canvas.width / WORLD_W;
    const res = paintSceneSync({ ...WATERFALL.art, seed }, { rect: { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, scale });
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(res.canvas as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const k = canvas.width / (WORLD_W * scale);
    ctx.setTransform(scale * k, 0, 0, scale * k, 0, 0);
    for (const s of [...res.sprites].sort((a, b) => a.depth - b.depth)) ctx.drawImage(s.canvas as CanvasImageSource, s.box.x, s.box.y, s.box.w, s.box.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  },
};

const section: StudioSection = {
  id: 'waterfall-map',
  title: 'Scenery · waterfall map',
  order: 103,
  entries: [map, placeholder],
};

export default section;
