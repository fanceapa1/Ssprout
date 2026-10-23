import { createRng } from '../core/rng';
import { allSpecies } from '../plants/registry';
import { renderPlantView } from '../plants/view';
import { WATERING_SECONDS } from '../plants/watering';
import type { StudioSection } from '../studio/types';
import { brushStrokePath } from './brush-path';
import { drawIcon, drawSproutMark, ICON_STROKES, type IconName } from './icons';
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
      h: 24 + Math.ceil(Object.keys(ICON_STROKES).length / 9) * 56,
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
      id: 'marks',
      label: 'marks, not dots (ADR 0194): the inked sprout beside what begins a planting and what grows now, at 12–22 px, on paper and on the seal; the brush mark under a chosen chip',
      w: 560,
      h: 150,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        ctx.fillStyle = '#f3ecd9';
        ctx.fillRect(0, 0, 560, 150);
        [12, 16, 20, 22].forEach((size, i) => drawSproutMark(ctx, 14 + i * 34, 30 - size / 2, size, '#5c5449'));
        slip(ctx, 'dense-1', 160, 10, 200, 46);
        drawSproutMark(ctx, 176, 23, 20, '#5c5449');
        text(ctx, 'Start studying', 204, 34, '18px "Shippori Mincho", serif');
        // on the vermilion seal: drawn in the cream of the words
        ctx.fillStyle = VERMILION;
        ctx.fillRect(380, 12, 170, 42);
        drawSproutMark(ctx, 394, 23, 20, '#f7f0e1', 'rgba(247, 240, 225, 0.35)');
        text(ctx, 'Start studying', 420, 34, '17px "Shippori Mincho", serif', '#f7f0e1');
        // a chosen chip: paper and a brush mark under the words
        slip(ctx, 'slip-1', 14, 80, 110, 44);
        text(ctx, '50 min', 40, 101, '18px "Cormorant Garamond", serif');
        const mark = new Path2D(brushStrokePath('mark', { length: 56, width: 2.4, wobble: 0.4, steps: 18 }));
        ctx.save();
        ctx.translate(40, 113);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(173, 69, 45, 0.8)';
        ctx.fill(mark);
        ctx.restore();
        text(ctx, 'growing now', 190, 101, 'italic 16px "Cormorant Garamond", serif', '#5c5449');
        drawSproutMark(ctx, 170, 93, 16, '#5c5449');
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
        drawSproutMark(ctx, 24, 26, 20, '#5c5449');
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
      id: 'pill-more',
      label: 'timer pill with other sessions in progress: focus “+2”, idle “+1” (ADR 0156)',
      w: 330,
      h: 140,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        const rule = (x: number, y: number) => {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = INK;
          ctx.fillRect(x, y + 10, 1, 34);
          ctx.globalAlpha = 1;
        };
        // focus, two waiting
        slip(ctx, 'dense-1', 10, 10, 292, 54);
        text(ctx, '24:13', 28, 38, '24px "Shippori Mincho", serif');
        text(ctx, 'focus', 102, 40, 'italic 16px "Cormorant Garamond", serif', '#5c5449');
        drawIcon(ctx, 'pause', 150, 26, 22, INK);
        rule(190, 10);
        drawIcon(ctx, 'down', 204, 26, 22, INK);
        rule(244, 10);
        text(ctx, '+2', 256, 38, '16px "Shippori Mincho", serif', '#5c5449');
        // idle, one waiting (after a bloom)
        slip(ctx, 'dense-1', 10, 76, 250, 52);
        drawSproutMark(ctx, 24, 92, 20, '#5c5449');
        text(ctx, 'Start studying', 48, 103, '18px "Shippori Mincho", serif');
        rule(200, 75);
        text(ctx, '+1', 214, 103, '16px "Shippori Mincho", serif', '#5c5449');
      },
    },
    {
      id: 'session-thumbs',
      label: 'session thumbnails, framed on the growth: growing (0 / 0.45 / 0.85), then the same waiting (held, quieter)',
      w: 420,
      h: 160,
      render(canvas, { seed, pixelRatio }) {
        const def = species();
        if (!def) return;
        const ctx = canvas.getContext('2d')!;
        const size = Math.round(64 * pixelRatio);
        [0, 0.45, 0.85].forEach((g, i) => {
          for (const waiting of [false, true]) {
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            paintRoundWindow(c, 2);
            const p = document.createElement('canvas');
            p.width = size;
            p.height = size;
            renderPlantView(p, { speciesId: def.id, seed, growth: g, watering: null, framing: 'growth' });
            c.getContext('2d')!.drawImage(p, 0, 0);
            ctx.save();
            if (waiting) {
              ctx.filter = 'saturate(0.72)';
              ctx.globalAlpha = 0.86;
            }
            ctx.drawImage(c, (14 + i * 136 + (waiting ? 66 : 0)) * pixelRatio, (waiting ? 84 : 12) * pixelRatio);
            ctx.restore();
          }
        });
      },
    },
    {
      id: 'session-rows',
      label: 'Study › sessions in progress: a waiting row (Switch), the active row, and none active (Resume, the one left last as a seal)',
      w: 480,
      h: 330,
      render(canvas, { seed, pixelRatio }) {
        const def = species();
        if (!def) return;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        const thumb = (x: number, y: number, g: number, waiting: boolean) => {
          const size = Math.round(64 * pixelRatio);
          const c = document.createElement('canvas');
          c.width = size;
          c.height = size;
          paintRoundWindow(c, 2);
          const p = document.createElement('canvas');
          p.width = size;
          p.height = size;
          renderPlantView(p, { speciesId: def.id, seed, growth: g, watering: null });
          c.getContext('2d')!.drawImage(p, 0, 0);
          ctx.save();
          if (waiting) {
            ctx.filter = 'saturate(0.72)';
            ctx.globalAlpha = 0.86;
          }
          ctx.drawImage(c, x, y, 64, 64);
          ctx.restore();
        };
        const line = (x: number, y: number, w: number, done: number) => {
          ctx.strokeStyle = 'rgba(59, 53, 46, 0.38)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(59, 53, 46, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w * done, y);
          ctx.stroke();
        };
        const row = (y: number, task: string, meta: string, g: number, act: 'switch' | 'now' | 'resume' | 'seal') => {
          thumb(10, y, g, act !== 'now');
          text(ctx, task, 90, y + 14, '19px "Shippori Mincho", serif');
          line(90, y + 32, 170, g);
          text(ctx, meta, 90, y + 50, 'italic 16px "Cormorant Garamond", serif', '#5c5449');
          if (act === 'switch' || act === 'resume') text(ctx, act === 'switch' ? 'Switch' : 'Resume', 390, y + 32, '18px "Cormorant Garamond", serif');
          if (act === 'now') {
            drawSproutMark(ctx, 340, y + 24, 16, '#5c5449');
            text(ctx, 'growing now', 362, y + 33, 'italic 16px "Cormorant Garamond", serif', '#5c5449');
          }
          if (act === 'seal') {
            ctx.fillStyle = VERMILION;
            ctx.fillRect(374, y + 14, 92, 38);
            ctx.strokeStyle = 'rgba(247, 240, 225, 0.42)';
            ctx.strokeRect(378, y + 18, 84, 30);
            text(ctx, 'Resume', 390, y + 33, '15px "Shippori Mincho", serif', '#f7f0e1');
          }
        };
        text(ctx, 'Growing now', 10, 12, 'italic 17px "Cormorant Garamond", serif', '#5c5449');
        row(26, 'Biology ch. 4', '18:40 left · waiting', 0.3, 'switch');
        row(98, 'Essay draft', '32:05 left', 0.55, 'now');
        text(ctx, 'Waiting for you', 10, 186, 'italic 17px "Cormorant Garamond", serif', '#5c5449');
        row(200, 'Biology ch. 4', '18:40 left · waiting', 0.3, 'resume');
        row(264, 'Maths set', '9:12 left · waiting', 0.8, 'seal');
      },
    },
    {
      id: 'plant-view-window',
      label: 'Your plant: the round window wash alone, three seeds at the dock’s size (ADR 0184)',
      w: 960,
      h: 330,
      render(canvas, { seed }) {
        const ctx = canvas.getContext('2d')!;
        const cw = Math.floor(canvas.width / 3);
        for (let i = 0; i < 3; i++) {
          const c = document.createElement('canvas');
          c.width = cw;
          c.height = canvas.height;
          paintRoundWindow(c, seed + i);
          ctx.drawImage(c, i * cw, 0);
        }
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
      label: 'Your plant, framed on the growth: a seed (0), 0.5, bloom',
      w: 480,
      h: 170,
      render(canvas, { seed }) {
        const def = species();
        if (!def) return;
        const ctx = canvas.getContext('2d')!;
        const cw = Math.floor(canvas.width / 3);
        [0, 0.5, 1].forEach((g, i) => {
          const c = document.createElement('canvas');
          c.width = cw;
          c.height = canvas.height;
          paintRoundWindow(c, seed);
          const p = document.createElement('canvas');
          p.width = cw;
          p.height = canvas.height;
          renderPlantView(p, { speciesId: def.id, seed, growth: g, watering: null, framing: 'growth' });
          c.getContext('2d')!.drawImage(p, 0, 0);
          ctx.drawImage(c, i * cw, 0);
        });
      },
    },
    {
      id: 'seed-bed',
      label: 'a just-planted seed in a growth-framed view: flat seeds (pine, maple, ginkgo) on a mound of soil; 0 / 0.1 / 0.2 (the bed eases away), at 64 and 150 px',
      w: 640,
      h: 330,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ['black-pine', 'japanese-maple', 'ginkgo'].forEach((id, row) => {
          [0, 0.1, 0.2].forEach((g, col) => {
            for (const [size, x0] of [
              [64, 10],
              [150, 230],
            ] as const) {
              const px = Math.round(size * pixelRatio);
              const c = document.createElement('canvas');
              c.width = px;
              c.height = px;
              paintRoundWindow(c, 2);
              const p = document.createElement('canvas');
              p.width = px;
              p.height = px;
              renderPlantView(p, { speciesId: id, seed: 7, growth: g, watering: null, framing: 'growth' });
              c.getContext('2d')!.drawImage(p, 0, 0);
              const x = size === 64 ? x0 + col * 70 : x0 + col * 136;
              const y = size === 64 ? 12 + row * 106 : 8 + row * 108;
              ctx.drawImage(c, x * pixelRatio, y * pixelRatio, (size === 64 ? 64 : 100) * pixelRatio, (size === 64 ? 64 : 100) * pixelRatio);
            }
          });
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
    {
      id: 'tip-note',
      label: 'a tip note with its small inked × (ADR 0211): at rest, pointed at or focused (deeper ink on a lifted dab, the ink ring), and the 32 px target it hides',
      w: 600,
      h: 128,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        // a pale sky wash behind, as over the painting
        const g = ctx.createLinearGradient(0, 0, 0, 128);
        g.addColorStop(0, '#b9c9d3');
        g.addColorStop(1, '#dfe3d2');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 600, 128);
        const x = (cx: number, cy: number, color: string) => {
          // the `close` icon's own strokes at 14 px, as `.tip-x .ink-icon` draws them (stroke 2.5)
          ctx.save();
          ctx.translate(cx - 7, cy - 7);
          ctx.scale(14 / 24, 14 / 24);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          for (const st of ICON_STROKES.close) ctx.stroke(new Path2D(st.d));
          ctx.restore();
        };
        const states = ['rest', 'hover / focus', 'target'] as const;
        states.forEach((state, i) => {
          const left = 10 + i * 196;
          const top = 26;
          ctx.save();
          ctx.translate(left, top);
          ctx.rotate((-0.6 * Math.PI) / 180);
          slip(ctx, `tip-${i}`, 0, 0, 186, 62);
          text(ctx, 'Tap the speaker for', 12, 19, 'italic 15px serif');
          text(ctx, 'quiet garden sounds.', 12, 40, 'italic 15px serif');
          const cx = 186 - 17;
          const cy = 3 + 16 - (state === 'hover / focus' ? 1 : 0);
          if (state === 'hover / focus') {
            // the paper dab lifts a pixel with a soft wash under it
            ctx.fillStyle = 'rgba(74, 64, 52, 0.16)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 1.5, 12, 11.5, 0, 0, Math.PI * 2);
            ctx.fill();
            const dab = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
            dab.addColorStop(0, 'rgba(246, 240, 226, 0.82)');
            dab.addColorStop(0.62, 'rgba(246, 240, 226, 0.5)');
            dab.addColorStop(1, 'rgba(246, 240, 226, 0)');
            ctx.fillStyle = dab;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 12, 11.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.6;
            ctx.strokeRect(cx - 13, cy - 13, 26, 26);
          }
          if (state === 'target') {
            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = VERMILION;
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - 16, cy - 16, 32, 32);
            ctx.restore();
          }
          x(cx, cy, state === 'rest' ? '#5c5449' : INK);
          ctx.restore();
          text(ctx, state, left + 4, 112, 'italic 11px serif', '#5c5449');
        });
      },
    },
  ],
};

export default section;
