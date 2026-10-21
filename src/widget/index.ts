import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/shippori-mincho/latin-500.css';
import type { Clock } from '../core/clock';
import { createIntervalTicker } from '../core/controller';
import type { Store } from '../core/state';
import { getSpecies } from '../plants/registry';
import { renderPlantView } from '../plants/view';
import { looseBus, type WidgetController } from './contract';
import { faviconDataUrl } from './favicon';
import { createBrowserNotificationEnv, createNotifier, type NotificationEnv, type PermissionResult } from './notifications';
import { createFloatingWidget, type FloatingWidget, type HostOpener } from './pip';
import { createTabSurfaces } from './tab';
import { createWorkerTicker } from './ticker';

/**
 * Timer surfaces outside the garden canvas (SPEC §6), installed with one call from `main.ts`:
 * - a Web Worker ticker on the controller (background tabs keep exact time),
 * - tab title countdown + painted favicon (always on),
 * - notifications for breaks, the next focus block and completion,
 * - the Document Picture-in-Picture floating card (Chrome/Edge).
 * Wiring: docs/systems/widget.md.
 */

export interface TimerSurfacesDeps {
  /** the session controller (see contract.ts for the slice used) */
  controller: WidgetController;
  store: Pick<Store, 'get'> & { subscribe(fn: () => void): () => void };
  /** the app EventBus */
  bus: unknown;
  clock: Clock;
  win?: Window;
  /** dev/tests: replace the browser notification environment */
  notificationEnv?: NotificationEnv;
  /** dev/tests: open the card somewhere else than a PiP window */
  openHost?: HostOpener;
}

export interface TimerSurfaces {
  /** For the UI's "floating timer" button: hide it when `supported` is false. */
  widget: FloatingWidget;
  /** Call from a click handler (e.g. Begin) to ask for notification permission. */
  requestPermissionFromGesture(): Promise<PermissionResult>;
  dispose(): void;
}

export const speciesName = (id: string): string | undefined => getSpecies(id)?.name;

export function createTimerSurfaces(deps: TimerSurfacesDeps): TimerSurfaces & {
  /** dev/tests */
  internals: {
    ticker: ReturnType<typeof createWorkerTicker>;
    tab: ReturnType<typeof createTabSurfaces>;
    notifier: ReturnType<typeof createNotifier>;
    widget: ReturnType<typeof createFloatingWidget>;
  };
} {
  const win = deps.win ?? window;
  const bus = looseBus(deps.bus);
  const { controller, store, clock } = deps;
  const attended = () => win.document.visibilityState === 'visible' && win.document.hasFocus();
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const ticker = createWorkerTicker();
  controller.setTicker(ticker);

  const tab = createTabSurfaces({ controller, store, bus, attended, win });

  const env =
    deps.notificationEnv ??
    createBrowserNotificationEnv(win, {
      icon: (kind) => (kind === 'complete' ? faviconDataUrl(win.document, { kind: 'complete' }, 96) : undefined),
    });
  const notifier = createNotifier({ controller, store, bus, clock, env, speciesName });

  const widget = createFloatingWidget({
    controller,
    store,
    bus,
    win,
    openHost: deps.openHost,
    speciesName,
    reducedMotion,
    renderPlant: (canvas, o) => renderPlantView(canvas, o),
  });

  let disposed = false;
  return {
    widget,
    requestPermissionFromGesture: () => notifier.requestPermissionFromGesture(),
    dispose() {
      if (disposed) return;
      disposed = true;
      widget.dispose();
      notifier.dispose();
      tab.dispose();
      controller.setTicker(createIntervalTicker());
      ticker.dispose();
    },
    internals: { ticker, tab, notifier, widget },
  };
}

export { isDocumentPipSupported, type FloatingWidget } from './pip';
export type { PermissionResult } from './notifications';
