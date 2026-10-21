import { CARD_H, CARD_W, type PlantRenderer } from './card-art';
import { collectFontFaceCss, mountCard, type CardHandle } from './card';
import type { WidgetBus, WidgetController, WidgetSession } from './contract';
import { widgetView, type WidgetActionKind, type WidgetView } from './view';

/**
 * The floating timer (SPEC §6): a Document Picture-in-Picture window (Chrome/Edge 116+) showing
 * the card. `open()` must be called from a user gesture (the "floating timer" button); it is
 * reopen-safe and closes gracefully. Where Document PiP is missing, `supported` is false and the
 * UI hides the button (the title/favicon fallback is always on).
 */

/** What the UI's "floating timer" button needs. */
export interface FloatingWidget {
  readonly supported: boolean;
  open(): void;
  isOpen(): boolean;
  close(): void;
  /** Called with true/false when the window opens/closes. */
  onChange(fn: (open: boolean) => void): () => void;
  dispose(): void;
}

/** A window the card can live in, and how to close it. */
export interface WidgetHost {
  window: Window;
  close(): void;
}
export type HostOpener = (size: { width: number; height: number }) => Promise<WidgetHost>;

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window: Window | null;
}

export function isDocumentPipSupported(win: Window): boolean {
  const pip = (win as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
  return typeof pip?.requestWindow === 'function';
}

/** Opens a Document PiP window (call synchronously inside a user gesture). */
export function pipHostOpener(win: Window): HostOpener {
  return async (size) => {
    const pip = (win as Window & { documentPictureInPicture: DocumentPictureInPicture }).documentPictureInPicture;
    const w = await pip.requestWindow(size);
    return { window: w, close: () => w.close() };
  };
}

export interface FloatingWidgetDeps {
  controller: Pick<WidgetController, 'status' | 'onTick' | 'pause' | 'resume' | 'water' | 'skipBreak'>;
  store: { subscribe(fn: () => void): () => void };
  bus: WidgetBus;
  /** the app window (opener) */
  win?: Window;
  /** how to get a window for the card (default: Document PiP when supported) */
  openHost?: HostOpener;
  /** override `supported` (default: Document PiP present, or `openHost` given) */
  supported?: boolean;
  speciesName?: (id: string) => string | undefined;
  renderPlant?: PlantRenderer;
  reducedMotion?: boolean;
  /** bring the garden forward (default: `win.focus()`, best effort) */
  focusApp?: () => void;
}

export function createFloatingWidget(deps: FloatingWidgetDeps): FloatingWidget & {
  /** dev/tests: the current card, if open */
  card(): CardHandle | null;
  view(): WidgetView;
} {
  const win = deps.win ?? window;
  const supported = deps.supported ?? (deps.openHost !== undefined || isDocumentPipSupported(win));
  const openHost = deps.openHost ?? (supported ? pipHostOpener(win) : null);
  const focusApp = deps.focusApp ?? (() => win.focus());
  const { controller } = deps;

  let host: WidgetHost | null = null;
  let card: CardHandle | null = null;
  let opening = false;
  let disposed = false;
  let unbind: (() => void)[] = [];
  const listeners = new Set<(open: boolean) => void>();

  // remember the session: once it completes it is gone from the status, but the card blooms it
  let lastSession: WidgetSession | null = controller.status().session;
  let completed: WidgetSession | null = null;
  const remember = () => {
    const s = controller.status().session;
    if (s) lastSession = s;
  };

  const view = (): WidgetView => widgetView(controller.status(), { completed, speciesName: deps.speciesName });
  const render = () => {
    remember();
    card?.update(view());
  };

  // these run whether or not the window is open, so a widget opened later still knows
  const always = [
    controller.onTick(remember),
    deps.bus.on('session:start', () => {
      completed = null;
      render();
    }),
    deps.bus.on('session:complete', () => {
      completed = lastSession;
      render();
    }),
    deps.bus.on('session:cancel', () => {
      completed = null;
      render();
    }),
    deps.bus.on('session:water', () => card?.water()),
  ];

  const notify = (open: boolean) => {
    for (const fn of [...listeners]) fn(open);
  };

  const teardown = () => {
    for (const off of unbind) off();
    unbind = [];
    card?.destroy();
    card = null;
    const wasOpen = host !== null;
    host = null;
    if (wasOpen) notify(false);
  };

  const onAction = (kind: WidgetActionKind) => {
    switch (kind) {
      case 'pause':
        controller.pause();
        break;
      case 'resume':
        controller.resume();
        break;
      case 'water':
        controller.water();
        card?.water(); // also when the controller does not announce it
        break;
      case 'skip':
        controller.skipBreak();
        break;
      case 'open': {
        const wasComplete = view().mode === 'complete';
        focusApp();
        if (wasComplete) {
          completed = null;
          api.close();
        }
        break;
      }
    }
    render();
  };

  const attach = (h: WidgetHost) => {
    host = h;
    const w = h.window;
    let fontCss = '';
    try {
      fontCss = collectFontFaceCss(win.document);
    } catch {
      /* fonts are a nicety */
    }
    card = mountCard(w, { onAction, renderPlant: deps.renderPlant, reducedMotion: deps.reducedMotion, fontCss });
    unbind = [controller.onTick(render), deps.store.subscribe(render)];
    const onHide = () => teardown();
    w.addEventListener('pagehide', onHide, { once: true });
    unbind.push(() => w.removeEventListener('pagehide', onHide));
    render();
    notify(true);
  };

  const api = {
    supported,
    open() {
      if (disposed || !supported || !openHost) return;
      if (host) {
        try {
          host.window.focus();
        } catch {
          /* best effort */
        }
        return;
      }
      if (opening) return;
      opening = true;
      let pending: Promise<WidgetHost>;
      try {
        pending = openHost({ width: CARD_W, height: CARD_H }); // synchronously, inside the gesture
      } catch (err) {
        opening = false;
        console.warn('[widget] could not open the floating timer', err);
        return;
      }
      pending.then(
        (h) => {
          opening = false;
          if (disposed) h.close();
          else attach(h);
        },
        (err: unknown) => {
          opening = false;
          console.warn('[widget] could not open the floating timer', err);
        },
      );
    },
    isOpen: () => host !== null,
    close() {
      const h = host;
      teardown();
      try {
        h?.close();
      } catch {
        /* already closed */
      }
    },
    onChange(fn: (open: boolean) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    dispose() {
      if (disposed) return;
      api.close();
      disposed = true;
      for (const off of always) off();
      listeners.clear();
    },
    card: () => card,
    view,
  };
  return api;
}

/**
 * A host for dev/tests: an iframe in the app document (same rendering path as the PiP window).
 * Closing removes the iframe.
 */
export function iframeHostOpener(doc: Document, id = 'sprout-widget-harness'): HostOpener {
  return async (size) => {
    doc.getElementById(id)?.remove();
    const frame = doc.createElement('iframe');
    frame.id = id;
    frame.title = 'Study Sprout floating timer (harness)';
    frame.style.cssText = `position:fixed;right:12px;bottom:12px;width:${size.width}px;height:${size.height}px;border:0;z-index:2147483647;box-shadow:0 0 0 1px rgba(74,68,60,.2)`;
    doc.body.append(frame);
    const w = frame.contentWindow;
    if (!w) throw new Error('iframe has no window');
    // make sure the about:blank document exists with a head and body
    if (!w.document.body) w.document.write('<!doctype html><html><head></head><body></body></html>');
    return {
      window: w,
      close: () => {
        w.dispatchEvent(new Event('pagehide'));
        frame.remove();
      },
    };
  };
}
