import { createRng } from '../core/rng';
import { speciesNote } from '../plants/notes';
import { allSpecies } from '../plants/registry';
import type { StudioSection } from '../studio/types';
import { CHEVRON } from './calendar-art';
import { drawIcon, type IconName } from './icons';
import { deckledPath, deckledRoundPath } from './paper';
import { storyLines, type PlantStory } from './plant-card';

/**
 * The camera's controls on the stage and the plant card (ADRs 0164, 0167), redrawn with the
 * page's own paths so they can be judged over a painted wash: the + / − chips with "Whole
 * garden", the card beside a plant (every species' note, by seed) and docked on a phone; a long
 * card on a small phone, cut with the words thinning into the paper and a mark (ADR 0191).
 */
const INK = '#3b352e';
const SOFT = '#5c5449';
const PAPER = '#f3ecd9';

function slip(ctx: CanvasRenderingContext2D, seed: string, x: number, y: number, w: number, h: number, round = false, alpha = 0.95): void {
  const p = new Path2D(round ? deckledRoundPath(createRng(seed)) : deckledPath(createRng(seed)));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 1000, h / 1000);
  ctx.fillStyle = PAPER;
  ctx.globalAlpha = alpha;
  ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.26;
  ctx.lineWidth = 1;
  const q = new Path2D();
  q.addPath(p, new DOMMatrix().translate(x, y).scale(w / 1000, h / 1000));
  ctx.stroke(q);
  ctx.restore();
}

function wash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#b9c497');
  g.addColorStop(0.6, '#8fae9e');
  g.addColorStop(1, '#6f7a52');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Wrap `s` into lines no wider than `max` px in the current font. */
function wrap(ctx: CanvasRenderingContext2D, s: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function card(ctx: CanvasRenderingContext2D, story: PlantStory, x: number, y: number, w: number, h: number, scale = 1): void {
  slip(ctx, 'dense-1', x, y, w, h, false, 0.97);
  const pad = 22 * scale;
  let cy = y + pad + 18 * scale;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `500 ${24 * scale}px 'Shippori Mincho', serif`;
  ctx.fillText(story.name, x + pad, cy);
  const nameW = ctx.measureText(story.name).width;
  ctx.font = `italic ${18 * scale}px 'Cormorant Garamond', serif`;
  ctx.fillStyle = SOFT;
  if (story.nativeName) ctx.fillText(story.nativeName, x + pad + nameW + 12 * scale, cy);
  drawIcon(ctx, 'close', x + w - pad - 22 * scale, y + pad - 2 * scale, 22 * scale, INK);
  cy += 30 * scale;
  ctx.fillStyle = INK;
  ctx.font = `italic ${18 * scale}px 'Cormorant Garamond', serif`;
  for (const l of wrap(ctx, story.line, w - pad * 2)) {
    ctx.fillText(l, x + pad, cy);
    cy += 23 * scale;
  }
  cy += 8 * scale;
  ctx.font = `500 ${16.5 * scale}px 'Cormorant Garamond', serif`;
  for (const l of wrap(ctx, story.note ?? '', w - pad * 2)) {
    if (cy > y + h - 90 * scale) break;
    ctx.fillText(l, x + pad, cy);
    cy += 22 * scale;
  }
  cy += 10 * scale;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(x + pad, cy - 14 * scale, 80 * scale, 1.4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = SOFT;
  ctx.font = `500 ${13 * scale}px 'Shippori Mincho', serif`;
  ctx.fillText('ITS STORY', x + pad, cy + 4 * scale);
  cy += 24 * scale;
  const lines = storyLines(story);
  ctx.fillStyle = INK;
  ctx.font = `500 ${17 * scale}px 'Cormorant Garamond', serif`;
  ctx.fillText(`${story.kind === 'growing' ? 'Growing' : 'Planted'} for “${lines.task}”`, x + pad, cy);
  ctx.fillStyle = SOFT;
  for (const f of lines.facts) {
    cy += 21 * scale;
    ctx.fillText(f, x + pad, cy);
  }
}

function storyFor(seed: number, growing = false, speciesId?: string): PlantStory {
  const all = allSpecies();
  const def = all.find((d) => d.id === speciesId) ?? all[(seed - 1 + all.length * 10) % all.length]!;
  const day = Date.UTC(2026, 9, 20 + (seed % 5));
  return {
    id: 'studio',
    kind: growing ? 'growing' : 'finished',
    speciesId: def.id,
    name: def.name,
    nativeName: def.nativeName ?? null,
    line: def.description,
    note: speciesNote(def.id),
    task: ['Kanji', 'Essay draft', 'Organic chemistry', 'Piano theory'][seed % 4]!,
    plantedAt: day,
    minutes: 25 + (seed % 4) * 25,
    completedAt: growing ? null : day + 3_600_000,
    growing: growing ? { growth: 0.42, remainingMs: 14 * 60_000, paused: false, waiting: false } : null,
    replaced: null,
  };
}

const section: StudioSection = {
  id: 'ui-camera',
  title: 'UI · camera controls and plant card',
  order: 522,
  entries: [
    {
      id: 'zoom-controls',
      label: 'zoom chips (+ / −) and "Whole garden", zoomed in and at the overview',
      w: 420,
      h: 150,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        wash(ctx, 420, 150);
        const chips = (x: number, outDisabled: boolean, whole: boolean) => {
          slip(ctx, 'chip-1', x, 18, 48, 48, true);
          drawIcon(ctx, 'zoomIn' as IconName, x + 13, 31, 22, INK);
          slip(ctx, 'chip-2', x, 72, 48, 48, true);
          ctx.globalAlpha = outDisabled ? 0.32 : 1;
          drawIcon(ctx, 'zoomOut' as IconName, x + 13, 85, 22, INK);
          ctx.globalAlpha = 1;
          if (whole) {
            slip(ctx, 'dense-0', x - 170, 74, 160, 46);
            drawIcon(ctx, 'wholeGarden' as IconName, x - 158, 86, 22, INK);
            ctx.fillStyle = INK;
            ctx.font = `italic 18px 'Cormorant Garamond', serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText('Whole garden', x - 128, 98);
          }
        };
        chips(220, false, true);
        chips(350, true, false);
      },
    },
    {
      id: 'plant-card',
      label: 'plant card beside a plant (species by seed: every note)',
      w: 420,
      h: 470,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        wash(ctx, 420, 470);
        card(ctx, storyFor(seed), 18, 14, 384, 442);
      },
    },
    {
      id: 'plant-card-growing',
      label: 'a seedling’s card: progress and time to go',
      w: 420,
      h: 470,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        wash(ctx, 420, 470);
        card(ctx, storyFor(seed + 7, true), 18, 14, 384, 442);
      },
    },
    {
      id: 'plant-card-docked',
      label: 'docked at the bottom of a phone’s stage',
      w: 390,
      h: 740,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        wash(ctx, 390, 740);
        card(ctx, storyFor(seed + 3), 8, 370, 374, 362, 0.92);
      },
    },
    {
      id: 'plant-card-docked-long',
      label: 'a long card on a 360 px phone: the rest scrolls inside, thinning at the cut under a mark',
      w: 360,
      h: 740,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        wash(ctx, 360, 740);
        const [x, y, w, h] = [8, 250, 344, 392];
        // the whole story, cut by the card's room
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h - 8);
        ctx.clip();
        card(ctx, storyFor(seed, true, 'spider-lily'), x, y, w, h + 260, 1.08);
        ctx.restore();
        // the words thin into the paper at the cut
        const fade = ctx.createLinearGradient(0, y + h - 54, 0, y + h - 8);
        fade.addColorStop(0, 'rgba(243, 236, 217, 0)');
        fade.addColorStop(0.9, 'rgba(243, 236, 217, 0.9)');
        fade.addColorStop(1, PAPER);
        ctx.fillStyle = fade;
        ctx.fillRect(x + 6, y + h - 54, w - 12, 46);
        // the torn edge along the cut, and the mark
        slip(ctx, 'dense-1', x, y, w, h, false, 0);
        ctx.save();
        ctx.translate(x + w / 2 - 13, y + h - 32);
        ctx.scale(26 / 24, 26 / 24);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(new Path2D(CHEVRON.down));
        ctx.restore();
      },
    },
  ],
};

export default section;
