import { createRng } from '../core/rng';
import { allSpecies } from '../plants/registry';
import { renderPlantView } from '../plants/view';
import { WATERING_SECONDS } from '../plants/watering';
import type { StudioSection } from '../studio/types';
import { brushStrokePath } from './brush-path';
import { drawIcon, ICON_STROKES, type IconName } from './icons';
import { deckledPath, deckledRoundPath } from './paper';
import { paintEmptyBed, paintRoundWindow } from './plant-section';
import { stageEdgeCanvas } from './stage-edge';

/**
 * The app shell's visual pieces (ADRs 0130–0136): ink icons and their paper chips, the brush
 * scrollbar, the timer pill's states, the "Your plant" view's states and the garden's dissolving
 * edge. DOM pieces are redrawn here with the same paths, so they can be looked at side by side.
 */
const INK = '#3b352e';
const PAPER = '#f3ecd9';
const VERMILION = '#ad452d';

function slip(ctx: CanvasRenderingContext2D, seed: string, x: number, y: number, w: number, h: number, round = false): void {
  const p = new Path2D(round ? deckledRoundPath(createRng(seed)) : deckledPath(createRng(seed)));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 1000, h / 1000);
  ctx.fillStyle = PAPER;
  ctx.globalAlpha = 0.95;
  ctx.fill(p);
  ctx.restore();
  // the outline at a constant 1 px (as `vector-effect: non-scaling-stroke` does in the page)
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.26;
  ctx.lineWidth = 1;
  const m = new DOMMatrix().translate(x, y).scale(w / 1000, h / 1000);
  const q = new Path2D();
  q.addPath(p, m);
  ctx.stroke(q);
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color = INK): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

const species = () => allSpecies()[0];

const section: StudioSection = {
  id: 'ui-shell',
  title: 'UI · app shell',
  order: 521,
  entries: [
    {
      id: 'icons',
      label: 'ink icons (24 px glyphs)',
      w: 560,
      h: 120,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        const names = Object.keys(ICON_STROKES) as IconName[];
        names.forEach((n, i) => {
          const x = 12 + (i % 9) * 60;
          const y = 12 + Math.floor(i / 9) * 56;
          drawIcon(ctx, n, x, y, 24, INK);
          text(ctx, n, x - 4, y + 36, 'italic 10px serif', '#5c5449');
        });
      },
    },
    {
      id: 'corner-chips',
      label: 'corner tools on paper chips, over a painted wash',
      w: 320,
      h: 90,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        // a garden-ish wash behind, to judge legibility
        const g = ctx.createLinearGradient(0, 0, 320, 0);
        g.addColorStop(0, '#a9b386');
        g.addColorStop(1, '#6f7a52');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 320, 90);
        (['soundOff', 'floating', 'book', 'data', 'info'] as IconName[]).forEach((n, i) => {
          const x = 14 + i * 58;
          slip(ctx, `chip-${i % 3}`, x, 20, 48, 48, true);
          drawIcon(ctx, n, x + 12, 32, 24, INK);
        });
      },
    },
    {
      id: 'scrollbar',
      label: 'scrollbar: faint track, brush thumbs of three lengths',
      w: 160,
      h: 300,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        ctx.fillStyle = INK;
        ctx.globalAlpha = 0.16;
        ctx.translate(20, 10);
        ctx.fill(new Path2D(brushStrokePath('scroll-track', { length: 280, width: 1.3, wobble: 0.5, steps: 40 })));
        ctx.globalAlpha = 0.58;
        [60, 140, 260].forEach((len, i) => {
          ctx.save();
          ctx.translate(30 + i * 40, 0);
          ctx.fill(new Path2D(brushStrokePath('scroll-thumb', { length: len, width: 6.2, wobble: 0.16 })));
          ctx.restore();
        });
      },
    },
    {
      id: 'pill',
      label: 'timer pill: idle, focus, break, paused',
      w: 300,
      h: 260,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        // idle
        slip(ctx, 'dense-1', 10, 10, 200, 52);
        ctx.fillStyle = VERMILION;
        ctx.beginPath();
        ctx.ellipse(34, 36, 5.5, 5, 0.4, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, 'Start studying', 48, 37, '18px "Shippori Mincho", serif');
        const states: Array<[string, string, IconName]> = [
          ['24:13', 'focus', 'pause'],
          ['4:10', 'break', 'pause'],
          ['18:40', 'paused', 'play'],
        ];
        states.forEach(([t, w, icon], i) => {
          const y = 72 + i * 62;
          slip(ctx, 'dense-1', 10, y, 236, 54);
          text(ctx, t, 28, y + 28, '24px "Shippori Mincho", serif', w === 'paused' ? '#5c5449' : INK);
          ctx.font = '24px "Shippori Mincho", serif';
          const tw = ctx.measureText(t).width;
          text(ctx, w, 36 + tw, y + 30, 'italic 16px "Cormorant Garamond", serif', '#5c5449');
          drawIcon(ctx, icon, 150, y + 16, 22, INK);
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = INK;
          ctx.fillRect(190, y + 10, 1, 34);
          ctx.globalAlpha = 1;
          drawIcon(ctx, 'down', 204, y + 16, 22, INK);
        });
      },
    },
    {
      id: 'plant-view-empty',
      label: 'Your plant: an empty bed (idle, no blooms yet)',
      w: 220,
      h: 220,
      render(canvas, { seed }) {
        const back = document.createElement('canvas');
        back.width = canvas.width;
        back.height = canvas.height;
        paintRoundWindow(back, seed);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(back, 0, 0);
        const bed = document.createElement('canvas');
        bed.width = canvas.width;
        bed.height = canvas.height;
        paintEmptyBed(bed, seed);
        ctx.drawImage(bed, 0, 0);
      },
    },
    {
      id: 'plant-view-growing',
      label: 'Your plant: growing (0.15 / 0.5 / bloom)',
      w: 480,
      h: 170,
      render(canvas, { seed }) {
        const def = species();
        if (!def) return;
        const ctx = canvas.getContext('2d')!;
        const cw = Math.floor(canvas.width / 3);
        [0.15, 0.5, 1].forEach((g, i) => {
          const c = document.createElement('canvas');
          c.width = cw;
          c.height = canvas.height;
          paintRoundWindow(c, seed);
          const p = document.createElement('canvas');
          p.width = cw;
          p.height = canvas.height;
          renderPlantView(p, { speciesId: def.id, seed, growth: g, watering: null });
          c.getContext('2d')!.drawImage(p, 0, 0);
          ctx.drawImage(c, i * cw, 0);
        });
      },
    },
    {
      id: 'plant-view-watering',
      label: 'Your plant: the watering animation (loops)',
      w: 220,
      h: 220,
      animated: true,
      render(canvas, { t, seed }) {
        const def = species();
        if (!def) return;
        const u = (t % (WATERING_SECONDS + 0.8)) / WATERING_SECONDS;
        renderPlantView(canvas, { speciesId: def.id, seed, growth: 0.7, watering: u <= 1 ? u : null });
      },
    },
    {
      id: 'stage-edge',
      label: 'the garden dissolving into the page (edge mask over a wash)',
      w: 420,
      h: 260,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const layer = document.createElement('canvas');
        layer.width = canvas.width;
        layer.height = canvas.height;
        const lx = layer.getContext('2d')!;
        const g = lx.createLinearGradient(0, 0, 0, layer.height);
        g.addColorStop(0, '#c9d2c4');
        g.addColorStop(0.55, '#a9b386');
        g.addColorStop(1, '#8d9a6c');
        lx.fillStyle = g;
        lx.fillRect(0, 0, layer.width, layer.height);
        const mask = stageEdgeCanvas(420 * pixelRatio, 260 * pixelRatio);
        if (mask) {
          lx.globalCompositeOperation = 'destination-in';
          lx.drawImage(mask, 0, 0, layer.width, layer.height);
        }
        ctx.drawImage(layer, 0, 0);
      },
    },
  ],
};

export default section;
