import type { WidgetBus, WidgetController } from './contract';
import { faviconDataUrl, faviconKey, faviconModel, type FaviconModel } from './favicon';
import { titleFor } from './title';

/**
 * Always-on fallback surfaces (every browser): the tab-title countdown and the painted favicon.
 * Updates on every controller tick (1 Hz while a session exists) and on store changes, writing
 * to the document only when the text / quantised icon actually changes — so the tab is touched
 * at most once per tick. A session that completes while the user is away leaves
 * `Bloomed · Study Sprout` and a vermilion-dot icon until they come back (focus / visible).
 * `dispose()` restores the original title and icon.
 */

export interface TabSurfaces {
  /** Recompute now (normally driven by ticks and store changes). */
  update(): void;
  /** The favicon href currently applied by us (null = original icon). */
  faviconHref(): string | null;
  /** A completion the user has not seen yet. */
  bloomed(): boolean;
  dispose(): void;
}

export interface TabSurfacesDeps {
  controller: Pick<WidgetController, 'status' | 'onTick'>;
  /** anything with a store-like `subscribe` (the app Store) */
  store: { subscribe(fn: () => void): () => void };
  bus: WidgetBus;
  /** the user is looking at the page (visible and focused) */
  attended: () => boolean;
  win?: Window;
  /** Plain title (default: the document title at creation). */
  baseTitle?: string;
  /** Renders a favicon model to an href (default: 32×32 canvas → PNG data URL). */
  renderIcon?: (m: FaviconModel) => string;
}

export function createTabSurfaces(deps: TabSurfacesDeps): TabSurfaces {
  const win = deps.win ?? window;
  const doc = win.document;
  const baseTitle = deps.baseTitle ?? (doc.title || 'Study Sprout');
  const renderIcon = deps.renderIcon ?? ((m: FaviconModel) => faviconDataUrl(doc, m));

  // remember the original icon links so dispose (or idle) can put them back
  const originals = [...doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')].map((el) => ({
    el,
    href: el.getAttribute('href'),
    type: el.getAttribute('type'),
  }));
  let created: HTMLLinkElement | null = null;
  let appliedKey = 'none';
  let appliedHref: string | null = null;
  const iconCache = new Map<string, string>();
  let bloomed = false;

  const setIcon = (href: string | null): void => {
    if (href === null) {
      for (const o of originals) {
        if (o.href === null) o.el.removeAttribute('href');
        else o.el.setAttribute('href', o.href);
        if (o.type === null) o.el.removeAttribute('type');
        else o.el.setAttribute('type', o.type);
      }
      created?.remove();
      created = null;
    } else {
      let link = originals[0]?.el ?? created;
      if (!link) {
        link = created = doc.createElement('link');
        link.rel = 'icon';
        doc.head.appendChild(link);
      }
      link.setAttribute('type', 'image/png');
      link.setAttribute('href', href);
    }
    appliedHref = href;
  };

  let disposed = false;
  const update = (): void => {
    if (disposed) return;
    const st = deps.controller.status();
    const input = { phase: st.phase, timeline: st.timeline, bloomed };
    const title = titleFor(input, baseTitle);
    if (doc.title !== title) doc.title = title;

    const model = faviconModel(input);
    const key = faviconKey(model);
    if (key === appliedKey) return;
    appliedKey = key;
    if (model.kind === 'none') {
      setIcon(null);
      return;
    }
    let href = iconCache.get(key);
    if (href === undefined) {
      href = renderIcon(model);
      if (iconCache.size > 64) iconCache.clear();
      iconCache.set(key, href);
    }
    if (href) setIcon(href);
  };

  const seen = (): void => {
    if (bloomed && deps.attended()) {
      bloomed = false;
      update();
    }
  };

  const offs = [
    deps.controller.onTick(update),
    deps.store.subscribe(() => update()),
    deps.bus.on('session:start', () => {
      bloomed = false;
      update();
    }),
    deps.bus.on('session:complete', () => {
      bloomed = !deps.attended();
      update();
    }),
  ];
  win.addEventListener('focus', seen);
  doc.addEventListener('visibilitychange', seen);
  update();

  return {
    update,
    faviconHref: () => appliedHref,
    bloomed: () => bloomed,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const off of offs) off();
      win.removeEventListener('focus', seen);
      doc.removeEventListener('visibilitychange', seen);
      doc.title = baseTitle;
      setIcon(null);
    },
  };
}
