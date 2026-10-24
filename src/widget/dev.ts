import { extendDebug } from '../dev/debug';
import { renderPlantView } from '../plants/view';
import { looseBus, type WidgetController } from './contract';
import type { createTimerSurfaces } from './index';
import { speciesName } from './index';
import { createFloatingWidget, iframeHostOpener } from './pip';
import type { ServiceWorkerBoot } from './service-worker';
import type { WidgetMode } from './view';

/**
 * `window.sprout.widget` (?dev only): inspection and an iframe harness that renders the floating
 * card through the same code path as the PiP window, for e2e tests in browsers (and headless
 * Chromium) without Document Picture-in-Picture. Call after `createTimerSurfaces` in main.ts.
 */

export interface WidgetDebug {
  supported(): boolean;
  isOpen(): boolean;
  open(): void;
  close(): void;
  tickerMode(): 'worker' | 'interval';
  title(): string;
  favicon(): string | null;
  bloomed(): boolean;
  lastNotification(): { kind: string; decision: string } | null;
  /** Mount the card in an iframe (#sprout-widget-harness); resolves once it is rendered. */
  mountHarness(): Promise<void>;
  closeHarness(): void;
  harnessMode(): WidgetMode | null;
  harnessWatering(): number | null;
}

/** `window.sprout.sw` (?dev only): the boot registration of the service worker (ADR 0230). */
export interface ServiceWorkerDebug {
  /**
   * Resolves once the app has tried to register the worker (after the garden's first paint, the
   * load event and an idle callback): its scope, or null (blocked, unsupported or failed).
   */
  ready(): Promise<{ scope: string } | null>;
  /** a worker controls this page */
  controlled(): boolean;
}

declare module '../dev/debug' {
  interface SproutDebug {
    widget: WidgetDebug;
    sw: ServiceWorkerDebug;
  }
}

/** Install `window.sprout.sw`. Call after `installServiceWorker` in main.ts. */
export function installServiceWorkerDebug(boot: ServiceWorkerBoot): ServiceWorkerDebug {
  const api: ServiceWorkerDebug = {
    ready: async () => {
      const reg = await boot.ready();
      return reg ? { scope: reg.scope } : null;
    },
    controlled: () => !!navigator.serviceWorker?.controller,
  };
  extendDebug({ sw: api });
  return api;
}

type Surfaces = ReturnType<typeof createTimerSurfaces>;

export function installWidgetDebug(deps: {
  surfaces: Surfaces;
  controller: WidgetController;
  store: { subscribe(fn: () => void): () => void };
  bus: unknown;
}): WidgetDebug {
  const { surfaces } = deps;
  const { ticker, tab, notifier, widget } = surfaces.internals;
  let harness: ReturnType<typeof createFloatingWidget> | null = null;

  const api: WidgetDebug = {
    supported: () => widget.supported,
    isOpen: () => widget.isOpen(),
    open: () => widget.open(),
    close: () => widget.close(),
    tickerMode: () => ticker.mode,
    title: () => document.title,
    favicon: () => tab.faviconHref(),
    bloomed: () => tab.bloomed(),
    lastNotification: () => notifier.lastDecision(),
    mountHarness() {
      harness?.dispose();
      const h = createFloatingWidget({
        controller: deps.controller,
        store: deps.store,
        bus: looseBus(deps.bus),
        win: window,
        openHost: iframeHostOpener(document),
        speciesName,
        renderPlant: (canvas, o) => renderPlantView(canvas, o),
        focusApp: () => window.focus(),
      });
      harness = h;
      return new Promise((resolve) => {
        const off = h.onChange((open) => {
          if (open) {
            off();
            resolve();
          }
        });
        h.open();
      });
    },
    closeHarness() {
      harness?.dispose();
      harness = null;
    },
    harnessMode: () => (harness?.isOpen() ? harness.view().mode : null),
    harnessWatering: () => harness?.card()?.watering() ?? null,
  };
  extendDebug({ widget: api });
  return api;
}
