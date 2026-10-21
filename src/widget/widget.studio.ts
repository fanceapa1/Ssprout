import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/shippori-mincho/latin-500.css';
import type { SessionStatus } from '../core/controller';
import type { StudioEntry, StudioSection } from '../studio/types';
import { CARD_H, CARD_W, paintCardPreview } from './card-art';
import { drawFavicon, FAVICON_STEPS, type FaviconModel } from './favicon';
import { paintSprout } from './sprout';
import { widgetView } from './view';

/**
 * Studio · Widget: the floating card at several moments of a session, the favicon ring, and an
 * animated sprout growing from seed to bloom. Card text is painted with the widget's fonts, so
 * the card entries are animated (they repaint once the web fonts have loaded).
 */

const GOAL = 25 * 60_000;

function statusAt(progress: number, phase: SessionStatus['phase'], seed: number): SessionStatus {
  const id = `session-studio-${seed}`;
  return {
    phase,
    session:
      phase === 'running' || phase === 'paused'
        ? { id, goalMs: GOAL, startedAt: 0, pausedAt: phase === 'paused' ? 1 : null, pausedTotalMs: 0, weather: 'sun' }
        : null,
    pendingReward: phase === 'reward' ? { sessionId: id, goalMinutes: 25, tier: 2, options: [], chosen: null, completedAt: 0 } : null,
    goalMs: GOAL,
    elapsedMs: GOAL * progress,
    remainingMs: GOAL * (1 - progress),
    progress,
    pausedForMs: 0,
    longPause: false,
  };
}

const card = (id: string, label: string, progress: number, phase: SessionStatus['phase']): StudioEntry => ({
  id,
  label,
  w: CARD_W,
  h: CARD_H,
  animated: true,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    const view = widgetView(statusAt(progress, phase, seed));
    paintCardPreview(ctx, CARD_W, CARD_H, view, { growth: view.growth, bloom: view.bloom ? 1 : 0 });
  },
});

const FAVICONS: { label: string; model: FaviconModel }[] = [
  { label: '0', model: { kind: 'progress', step: 0, paused: false } },
  { label: '25 %', model: { kind: 'progress', step: FAVICON_STEPS / 4, paused: false } },
  { label: '60 %', model: { kind: 'progress', step: Math.round(FAVICON_STEPS * 0.6), paused: false } },
  { label: '90 %', model: { kind: 'progress', step: Math.round(FAVICON_STEPS * 0.9), paused: false } },
  { label: 'paused 45 %', model: { kind: 'progress', step: Math.round(FAVICON_STEPS * 0.45), paused: true } },
  { label: 'complete', model: { kind: 'complete' } },
];

const favicons: StudioEntry = {
  id: 'favicons',
  label: 'favicon: 8× and actual size on light / dark tab strips',
  w: 560,
  h: 220,
  render(canvas, { pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    FAVICONS.forEach(({ label, model }, i) => {
      const x = 12 + i * 92;
      ctx.save();
      ctx.translate(x, 8);
      ctx.scale(2.5, 2.5); // 80 px preview of the 32 px design
      drawFavicon(ctx, model);
      ctx.restore();
      // actual size on a light and a dark strip
      ctx.fillStyle = '#dee1e6';
      ctx.fillRect(x, 104, 80, 40);
      ctx.fillStyle = '#35363a';
      ctx.fillRect(x, 148, 80, 40);
      for (const [y] of [[108], [152]] as const) {
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

const grow: StudioEntry = {
  id: 'sprout-grow',
  label: 'sprout growing seed → bloom (8 s loop)',
  w: CARD_W,
  h: CARD_H,
  animated: true,
  render(canvas, { t, seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    const cycle = t % 8;
    const progress = Math.min(1, cycle / 6);
    const bloom = Math.max(0, Math.min(1, (cycle - 6) / 1.5));
    const phase = bloom > 0 ? 'reward' : 'running';
    const view = widgetView(statusAt(progress, phase, seed));
    paintCardPreview(ctx, CARD_W, CARD_H, view, { growth: progress, bloom }, paintSprout);
  },
};

const section: StudioSection = {
  id: 'widget',
  title: 'Widget · floating timer card & favicon',
  order: 510,
  entries: [
    card('card-idle', 'card · idle', 0, 'idle'),
    card('card-0', 'card · just started (0)', 0, 'running'),
    card('card-30', 'card · 30 %', 0.3, 'running'),
    card('card-70', 'card · 70 % (bud)', 0.7, 'running'),
    card('card-paused', 'card · paused at 45 %', 0.45, 'paused'),
    card('card-complete', 'card · complete (bloom)', 1, 'reward'),
    favicons,
    grow,
  ],
};

export default section;
