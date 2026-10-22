import { CARD_FONTS, LAYOUT, paintCardArt, stateLine, type PlantRenderer } from './card-art';
import { paintPaper } from './paper';
import type { WidgetActionKind, WidgetView } from './view';

/**
 * The floating card as DOM, mountable into any window (the Document Picture-in-Picture window, an
 * iframe harness, a test document). Canvas for paper + plant + progress line; real text and
 * buttons on top (crisp, accessible, clickable in tests). Growth eases toward its target and a
 * watering animation plays for `WATERING_MS`; both are presentation-only (rAF time).
 */

export const WATERING_MS = 2500;
/** Seconds for the displayed growth to close ~63 % of the gap to the target. */
const GROWTH_EASE_S = 0.6;

export interface CardDeps {
  onAction(kind: WidgetActionKind): void;
  renderPlant?: PlantRenderer;
  reducedMotion?: boolean;
  /** stylesheet text for @font-face rules (copied from the opener) */
  fontCss?: string;
}

export interface CardHandle {
  readonly root: HTMLElement;
  update(view: WidgetView): void;
  /** Play the watering animation (no-op while it is already playing). */
  water(): void;
  /** Watering animation progress 0..1, null when not playing (tests/dev). */
  watering(): number | null;
  destroy(): void;
}

export const CARD_CSS = `
:root { color-scheme: light; --ink: #4a443c; --paper: #f3ecd9; --vermilion: #d0694a; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--paper); color: var(--ink); }
.ss-card { position: fixed; inset: 0; font-family: "Cormorant Garamond", Georgia, serif; user-select: none; }
.ss-art { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.ss-card p { position: absolute; left: 14px; right: 14px; margin: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-task { font: ${CARD_FONTS.task}; line-height: 1; bottom: ${LAYOUT.taskBaseline - 4}px; opacity: .72; }
.ss-time { font: ${CARD_FONTS.time}; line-height: 1; bottom: ${LAYOUT.timeBaseline - 7}px; opacity: .92;
  font-variant-numeric: lining-nums tabular-nums; letter-spacing: .01em; }
.ss-state { font: ${CARD_FONTS.state}; line-height: 1; bottom: ${LAYOUT.stateBaseline - 3}px; opacity: .66; }
.ss-card[data-mode="paused"] .ss-time { opacity: .6; }
.ss-card[data-mode="complete"] .ss-state, .ss-card[data-mode="idle"] .ss-state {
  white-space: normal; line-height: 17px; bottom: ${LAYOUT.timeBaseline - 20}px; left: 20px; right: 20px; }
.ss-time:empty, .ss-task:empty { display: none; }
.ss-actions { position: absolute; left: 8px; right: 8px; bottom: ${LAYOUT.buttonsBottom}px; display: flex; justify-content: center; gap: 7px; }
.ss-actions button {
  font: ${CARD_FONTS.button}; color: var(--ink); height: ${LAYOUT.buttonH}px; padding: 0 11px; cursor: pointer;
  background: rgba(250, 246, 238, .6); border: 1px solid rgba(74, 68, 60, .45);
  border-radius: 2px 3px 2px 4px / 3px 2px 4px 2px; display: inline-flex; align-items: center; gap: 6px;
  transition: background-color .6s ease, border-color .6s ease;
}
.ss-actions button:hover { background: rgba(255, 252, 245, .9); border-color: rgba(74, 68, 60, .7); }
.ss-actions button:focus-visible { outline: 1px dashed rgba(74, 68, 60, .7); outline-offset: 2px; }
.ss-actions button[data-primary]::before { content: ""; width: 7px; height: 7px; background: var(--vermilion); opacity: .85; transform: rotate(-3deg); }
@media (prefers-reduced-motion: reduce) { .ss-actions button { transition: none; } }
`;

export function mountCard(win: Window, deps: CardDeps): CardHandle {
  const doc = win.document;
  if (!doc.querySelector('meta[charset]')) {
    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    doc.head.prepend(meta);
  }
  doc.title = 'Study Sprout';
  const style = doc.createElement('style');
  style.dataset.sprout = 'widget';
  style.textContent = `${deps.fontCss ?? ''}\n${CARD_CSS}`;
  doc.head.append(style);

  const root = doc.createElement('main');
  root.className = 'ss-card';
  root.setAttribute('aria-label', 'Study Sprout timer');
  const canvas = doc.createElement('canvas');
  canvas.className = 'ss-art';
  canvas.setAttribute('aria-hidden', 'true');
  const task = doc.createElement('p');
  task.className = 'ss-task';
  const time = doc.createElement('p');
  time.className = 'ss-time';
  time.setAttribute('role', 'timer');
  const state = doc.createElement('p');
  state.className = 'ss-state';
  state.setAttribute('aria-live', 'polite');
  const actions = doc.createElement('div');
  actions.className = 'ss-actions';
  root.append(canvas, task, time, state, actions);
  doc.body.append(root);

  const plantLayer = doc.createElement('canvas');
  let paper: { canvas: HTMLCanvasElement; key: string } | null = null;
  let view: WidgetView | null = null;
  let shownGrowth = deps.reducedMotion ? -1 : 0; // starts at 0 → the plant grows in on open
  let wateringStart: number | null = null;
  let wateringT: number | null = null;
  let frame = 0;
  let lastFrame = 0;
  let destroyed = false;
  let buttonsKey = '';

  actions.addEventListener('click', (ev) => {
    const btn = (ev.target as Element | null)?.closest?.('button');
    const kind = btn?.getAttribute('data-action') as WidgetActionKind | null;
    if (kind) deps.onAction(kind);
  });

  const size = () => ({ w: Math.max(1, win.innerWidth || canvas.clientWidth || 260), h: Math.max(1, win.innerHeight || canvas.clientHeight || 340) });
  const ratio = () => Math.min(2, win.devicePixelRatio || 1);

  const paint = (): void => {
    if (!view) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = size();
    const pr = ratio();
    const cw = Math.round(w * pr);
    const ch = Math.round(h * pr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const key = `${w}x${h}@${pr}`;
    if (!paper || paper.key !== key) {
      const c = doc.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const pctx = c.getContext('2d');
      if (pctx) {
        pctx.scale(pr, pr);
        paintPaper(pctx, w, h);
      }
      paper = { canvas: c, key };
    }
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    paintCardArt(ctx, w, h, view, { growth: Math.max(0, shownGrowth), watering: wateringT }, {
      renderPlant: deps.renderPlant,
      plantLayer,
      paper: paper.canvas,
      pixelRatio: pr,
    });
  };

  /** One animation step; keeps scheduling itself while something is still moving. */
  const step = (now: number): void => {
    frame = 0;
    if (destroyed || !view) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;
    let moving = false;
    const target = view.growth;
    if (shownGrowth < 0 || deps.reducedMotion) shownGrowth = target;
    else if (Math.abs(target - shownGrowth) > 0.002) {
      shownGrowth += (target - shownGrowth) * (1 - Math.exp(-dt / GROWTH_EASE_S));
      moving = true;
    } else shownGrowth = target;
    if (wateringStart !== null) {
      wateringT = (now - wateringStart) / WATERING_MS;
      if (wateringT >= 1) {
        wateringStart = null;
        wateringT = null;
      } else moving = true;
    }
    paint();
    if (moving) schedule();
    else lastFrame = 0;
  };

  const schedule = (): void => {
    if (frame || destroyed) return;
    frame = win.requestAnimationFrame(step);
  };

  const onResize = () => {
    paper = null;
    schedule();
  };
  win.addEventListener('resize', onResize);

  const setText = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };

  return {
    root,
    update(next) {
      if (destroyed) return;
      const prev = view;
      view = next;
      root.dataset.mode = next.mode;
      setText(task, next.task);
      setText(time, next.time);
      setText(state, stateLine(next));
      const key = next.buttons.map((b) => `${b.kind}:${b.label}${b.primary ? '*' : ''}`).join(',');
      if (key !== buttonsKey) {
        buttonsKey = key;
        actions.replaceChildren(
          ...next.buttons.map((b) => {
            const el = doc.createElement('button');
            el.type = 'button';
            el.dataset.action = b.kind;
            if (b.primary) el.dataset.primary = '';
            el.textContent = b.label;
            return el;
          }),
        );
      }
      // a new plant (another session) starts from seed again
      if (prev && (prev.seed !== next.seed || prev.speciesId !== next.speciesId) && !deps.reducedMotion) shownGrowth = 0;
      schedule();
    },
    water() {
      if (destroyed || deps.reducedMotion || wateringStart !== null) return;
      wateringStart = win.performance.now();
      wateringT = 0;
      schedule();
    },
    watering: () => wateringT,
    destroy() {
      destroyed = true;
      if (frame) win.cancelAnimationFrame(frame);
      win.removeEventListener('resize', onResize);
      root.remove();
      style.remove();
    },
  };
}

/** Rewrite relative `url(...)`s in CSS text to absolute ones (fonts copied to another document). */
export function absolutizeCssUrls(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote: string, url: string) => {
    if (/^(data:|blob:|[a-z][a-z0-9+.-]*:\/\/)/i.test(url)) return match;
    try {
      return `url(${quote}${new URL(url, base).href}${quote})`;
    } catch {
      return match;
    }
  });
}

/**
 * Every @font-face rule of `doc`'s same-origin stylesheets, with URLs made absolute, so another
 * document (the PiP window starts empty) can use the app's web fonts.
 */
export function collectFontFaceCss(doc: Document): string {
  const out: string[] = [];
  for (const sheet of [...doc.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    const base = sheet.href ?? doc.baseURI;
    for (const rule of [...rules]) {
      if (rule.cssText.startsWith('@font-face')) out.push(absolutizeCssUrls(rule.cssText, base));
    }
  }
  return out.join('\n');
}
