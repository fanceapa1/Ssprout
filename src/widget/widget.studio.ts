import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/shippori-mincho/latin-500.css';
import { allSpecies } from '../plants/registry';
import { renderPlantView } from '../plants/view';
import type { StudioEntry, StudioSection } from '../studio/types';
import { CARD_H, CARD_W, paintCardPreview, type CardArtState } from './card-art';
import type { WidgetPhase, WidgetStatus } from './contract';
import { drawFavicon, FAVICON_RENDER_PX, FAVICON_STEPS, type FaviconModel } from './favicon';
import { session, timeline } from './test-helpers';
import { widgetView } from './view';

/**
 * Studio · Widget: the floating card through a session (growth 0 / 0.3 / 0.7, break, watering,
 * paused, bloom, idle), with other sessions in progress (Switch; none active: Resume), the
 * generic-sprout fallback, the favicon ring, and an animated loop of a
 * whole two-pomodoro session with its watering break. Card text is painted with the widget's web
 * fonts, so card entries are animated (they repaint once the fonts have loaded).
 */

const SPECIES = allSpecies()[0]?.id ?? 'white-clover';
const speciesName = (id: string) => allSpecies().find((s) => s.id === id)?.name;
const layers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const layerFor = (c: HTMLCanvasElement) => {
  let l = layers.get(c);
  if (!l) layers.set(c, (l = document.createElement('canvas')));
  return l;
};

const PLAN = session().plan; // 25 focus · 10 break · 25 focus
const MIN = 60_000;

/** A status at a moment of the 60-minute two-pomodoro plan (minutes elapsed). */
function statusAt(minutes: number, opts: { paused?: boolean; watered?: boolean; speciesId?: string; seed: number }): WidgetStatus {
  const inBreak = minutes >= 25 && minutes < 35;
  const blockIndex = minutes < 25 ? 0 : inBreak ? 1 : 2;
  const blockEnd = [25, 35, 60][blockIndex]!;
  const focused = Math.min(minutes, 25) + Math.max(0, minutes - 35);
  const phase: WidgetPhase = opts.paused ? 'paused' : inBreak ? 'break' : 'focus';
  return {
    phase,
    session: session({ speciesId: opts.speciesId ?? SPECIES, seed: opts.seed }),
    timeline: timeline({
      blockIndex,
      block: PLAN.blocks[blockIndex]!,
      blockRemainingMs: (blockEnd - minutes) * MIN,
      totalRemainingMs: (60 - minutes) * MIN,
      growth: focused / 50,
      progress: minutes / 60,
      watered: !!opts.watered,
    }),
  };
}

function paint(canvas: HTMLCanvasElement, pixelRatio: number, status: WidgetStatus, art: Partial<CardArtState> = {}, done = false) {
  const ctx = canvas.getContext('2d')!;
  ctx.scale(pixelRatio, pixelRatio);
  const view = widgetView(status, { speciesName, completed: done ? status.session : null });
  const shown = done ? widgetView({ phase: 'idle', timeline: null, session: null }, { speciesName, completed: status.session }) : view;
  paintCardPreview(ctx, CARD_W, CARD_H, shown, { growth: art.growth ?? shown.growth, watering: art.watering ?? null }, {
    renderPlant: (layer, o) => renderPlantView(layer, o),
    plantLayer: layerFor(canvas),
    pixelRatio,
  });
}

const card = (
  id: string,
  label: string,
  make: (seed: number) => WidgetStatus,
  art: Partial<CardArtState> = {},
  done = false,
): StudioEntry => ({
  id,
  label,
  w: CARD_W,
  h: CARD_H,
  animated: true,
  render: (canvas, { seed, pixelRatio }) => paint(canvas, pixelRatio, make(seed), art, done),
});

const FAVICONS: { label: string; model: FaviconModel }[] = [
  { label: '0', model: { kind: 'progress', step: 0, tone: 'focus' } },
  { label: '25 %', model: { kind: 'progress', step: FAVICON_STEPS / 4, tone: 'focus' } },
  { label: 'break 50 %', model: { kind: 'progress', step: FAVICON_STEPS / 2, tone: 'break' } },
  { label: '90 %', model: { kind: 'progress', step: Math.round(FAVICON_STEPS * 0.9), tone: 'focus' } },
  { label: 'paused 45 %', model: { kind: 'progress', step: Math.round(FAVICON_STEPS * 0.45), tone: 'paused' } },
  { label: 'bloomed', model: { kind: 'complete' } },
];

const favicons: StudioEntry = {
  id: 'favicons',
  label: 'favicon: enlarged and actual size on light / dark tab strips',
  w: 560,
  h: 220,
  render(canvas, { pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    FAVICONS.forEach(({ label, model }, i) => {
      const x = 12 + i * 92;
      ctx.save();
      ctx.translate(x, 8);
      ctx.scale(2.5, 2.5);
      drawFavicon(ctx, model);
      ctx.restore();
      ctx.fillStyle = '#dee1e6';
      ctx.fillRect(x, 104, 80, 40);
      ctx.fillStyle = '#35363a';
      ctx.fillRect(x, 148, 80, 40);
      for (const y of [108, 152]) {
        ctx.save();
        ctx.translate(x + 8, y);
        ctx.scale(0.5, 0.5); // 16 css px tab icon
        drawFavicon(ctx, model);
        ctx.restore();
        ctx.save();
        ctx.translate(x + 36, y);
        drawFavicon(ctx, model); // 32 px (retina tab)
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(74,68,60,0.8)';
      ctx.font = '12px "Cormorant Garamond", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + 40, 206);
    });
  },
};

/**
 * The favicon as a tab shows it (ADR 0194): the PNG the tab gets (`faviconDataUrl`, 64 px) scaled
 * down with smoothing to 16, 32 and 64 CSS px at 1× and 2× DPR, on light and dark tab strips.
 * A 1× cell is upscaled pixel for pixel, so the studio shows its real device pixels.
 */
const SIZES: { css: number; dpr: number }[] = [
  { css: 16, dpr: 1 },
  { css: 16, dpr: 2 },
  { css: 32, dpr: 1 },
  { css: 32, dpr: 2 },
  { css: 64, dpr: 1 },
  { css: 64, dpr: 2 },
];
const STRIPS = [
  { label: 'light', bg: '#dee1e6' },
  { label: 'dark', bg: '#35363a' },
];
const SIZE_MODELS: { label: string; model: FaviconModel }[] = [
  { label: 'bloomed', model: { kind: 'complete' } },
  { label: '60 %', model: { kind: 'progress', step: Math.round(FAVICON_STEPS * 0.6), tone: 'focus' } },
];

const faviconSizes: StudioEntry = {
  id: 'favicon-sizes',
  label: 'favicon at tab sizes: 16 / 32 / 64 px at 1× and 2× DPR, light and dark strips',
  w: 600,
  h: 380,
  render(canvas, { pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    const png = document.createElement('canvas');
    png.width = png.height = FAVICON_RENDER_PX;
    const small = document.createElement('canvas');
    const colX = (i: number) => 80 + i * 86;
    ctx.fillStyle = 'rgba(74,68,60,0.8)';
    ctx.font = '12px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    SIZES.forEach(({ css, dpr }, i) => ctx.fillText(`${css} px · ${dpr}×`, colX(i) + 39, 14));
    let y = 24;
    for (const { label, model } of SIZE_MODELS) {
      const pctx = png.getContext('2d')!;
      pctx.clearRect(0, 0, png.width, png.height);
      drawFavicon(pctx, model, FAVICON_RENDER_PX);
      for (const strip of STRIPS) {
        ctx.fillStyle = strip.bg;
        ctx.fillRect(76, y, SIZES.length * 86, 80);
        SIZES.forEach(({ css, dpr }, i) => {
          const px = css * dpr;
          small.width = small.height = px;
          const sctx = small.getContext('2d')!;
          sctx.imageSmoothingEnabled = true;
          sctx.imageSmoothingQuality = 'high';
          sctx.drawImage(png, 0, 0, px, px);
          ctx.save();
          ctx.imageSmoothingEnabled = dpr === 2; // 1×: show the real pixels, enlarged
          ctx.drawImage(small, colX(i) + (78 - css) / 2, y + (80 - css) / 2, css, css);
          ctx.restore();
        });
        ctx.fillStyle = 'rgba(74,68,60,0.8)';
        ctx.textAlign = 'right';
        ctx.fillText(`${label} · ${strip.label}`, 70, y + 44);
        y += 84;
      }
      y += 8;
    }
  },
};

/** 12 s loop: focus 0→25 min (5 s), break with a watering (3 s), focus 35→60 (3 s), bloom (1 s). */
const sessionLoop: StudioEntry = {
  id: 'session-loop',
  label: 'a whole session: grow, water in the break, grow, bloom (12 s loop)',
  w: CARD_W,
  h: CARD_H,
  animated: true,
  render(canvas, { t, seed, pixelRatio }) {
    const c = t % 12;
    if (c < 5) return paint(canvas, pixelRatio, statusAt((c / 5) * 25, { seed }));
    if (c < 8) {
      const w = (c - 5) / 2.5;
      return paint(canvas, pixelRatio, statusAt(25 + (c - 5) * 3, { seed, watered: w > 0.3 }), { watering: w <= 1 ? w : null });
    }
    if (c < 11) return paint(canvas, pixelRatio, statusAt(35 + ((c - 8) / 3) * 25, { seed }));
    return paint(canvas, pixelRatio, statusAt(60, { seed }), {}, true);
  },
};

const section: StudioSection = {
  id: 'widget',
  title: 'Widget · floating timer card & favicon',
  order: 510,
  entries: [
    card('card-0', 'focus · growth 0', (seed) => statusAt(0, { seed })),
    card('card-30', 'focus · growth 0.3', (seed) => statusAt(15, { seed })),
    card('card-70', 'focus 2 · growth 0.7', (seed) => statusAt(45, { seed })),
    card('card-break', 'break · thirsty', (seed) => statusAt(27, { seed })),
    card('card-watering', 'break · watering (mid-animation)', (seed) => statusAt(28, { seed, watered: true }), { watering: 0.55 }),
    card('card-paused', 'paused · growth 0.45', (seed) => statusAt(22.5, { seed, paused: true })),
    card('card-bloom', 'complete · growth 1', (seed) => statusAt(60, { seed }), {}, true),
    card('card-idle', 'idle', () => ({ phase: 'idle', timeline: null, session: null })),
    card('card-switch', 'focus · another session waiting (Switch)', (seed) => ({
      ...statusAt(15, { seed }),
      sessions: [
        { session: { id: 'session-test', taskName: 'Biology ch. 4' }, active: true },
        { session: { id: 'essay', taskName: 'Essay draft' }, active: false, lastLeft: true },
      ],
    })),
    card('card-waiting', 'idle · two sessions waiting (Resume)', () => ({
      phase: 'idle',
      timeline: null,
      session: null,
      sessions: [
        { session: { id: 'essay', taskName: 'Essay draft' }, active: false },
        { session: { id: 'maths', taskName: 'Maths set' }, active: false, lastLeft: true },
      ],
    })),
    card('card-fallback', 'unknown species → generic sprout (growth 0.7)', (seed) => statusAt(45, { seed, speciesId: 'not-a-species' })),
    favicons,
    faviconSizes,
    sessionLoop,
  ],
};

export default section;
