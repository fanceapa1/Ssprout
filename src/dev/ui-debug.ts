import type { SpeedClock } from '../core/clock';
import type { Pt, Viewport } from '../render/viewport';
import type { Slot } from '../scene/geometry';
import type { UI, UIState, WidgetIntegration } from '../ui';
import { extendDebug } from './debug';
import { msUntilLocalTime } from './local-time';

/** UI additions to `window.sprout` (docs/systems/ui.md › Debug API). */
declare module './debug' {
  interface SproutDebug {
    ui: {
      /** what the UI is showing right now */
      state(): UIState;
      /** re-render from the current status (the controller ticks only once a second) */
      refresh(): void;
      /** multiply every UI delay (idle fade, quiet line); 0 = immediate */
      setTimeScale(scale: number): void;
      /** placement markers as the renderer would see them */
      placement(): ReturnType<UI['placement']['current']>;
      /** show the finished-plant label for the plant at a world point; returns its text */
      showPlantLabel(world: Pt): string | null;
      /**
       * Where a slot is in the browser window (client CSS pixels, for real pointer hovers and taps
       * in tests): the stage's offset and the page's scroll included.
       */
      slotScreen(slotId: string): Pt | null;
      /** the page's scroll: position, furthest position, animation target, smoothing on/off */
      scroll(): ReturnType<UI['scroll']['state']>;
      /** glide (or `{ instant: true }` jump) to a scroll position or a dock section id; resolves on arrival */
      scrollTo(target: number | string, opts?: { instant?: boolean }): Promise<void>;
      /** the dock's sections in page order */
      dock(): ReturnType<UI['dock']['sections']>;
      /** resolves once every filled dock section is laid out (fonts loaded, a frame painted) */
      dockReady(): Promise<void>;
      /**
       * Resolves once every card on the planting sheet shows its species preview (ADR 0222): the
       * sheet opens at once and its previews fill in as they land. Await it before reading them.
       */
      previewsReady(): Promise<void>;
      /**
       * The guiding path (ADR 0202), laid out now against the page as it is (unless `layout: false`):
       * its stops in page order and its centre line, in client coordinates, which stop is being read,
       * the draw-in state and how many layouts it has done.
       */
      wayfinding(opts?: { layout?: boolean }): ReturnType<UI['wayfinding']['state']>;
      /** hide or show a dock section (as a feature does when it has nothing to show) */
      setSectionHidden(id: string, hidden: boolean): boolean;
      /** play the "Your plant" watering animation (as the automatic focus watering will); false if nothing to water */
      waterPlantView(): boolean;
      /** the stage's zoom hook (ctrl/⌘ + wheel, pinch over the garden), for the camera and tests */
      onZoomGesture(fn: (e: WheelEvent) => void): () => void;
      /** the fake widget (only with `?widget=fake`) */
      widget: { readonly opened: number; isOpen(): boolean; close(): void } | null;
    };
    /** Jump the dev clock forward by `ms` (e.g. into a break or a long pause) and refresh the UI. */
    advance(ms: number): void;
    /**
     * Pin the time of day: jump the dev clock forward to the next local `HH:MM` (later today, else
     * tomorrow; the clock never goes back) and refresh the UI. Returns the new time (epoch ms).
     */
    advanceTo(hhmm: string): number;
  }
}

export interface FakeWidget extends WidgetIntegration {
  opened: number;
  close(): void;
}

/** `?dev&widget=fake`: a stand-in floating-timer integration so the menu button can be tested. */
export function createFakeWidget(): FakeWidget {
  let open = false;
  const listeners = new Set<() => void>();
  const w: FakeWidget = {
    supported: true,
    opened: 0,
    open() {
      open = true;
      w.opened++;
      for (const fn of listeners) fn();
    },
    isOpen: () => open,
    close() {
      open = false;
      for (const fn of listeners) fn();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  return w;
}

export interface UiDebugDeps {
  ui: UI;
  clock: SpeedClock;
  widget: FakeWidget | null;
  viewport(): Viewport;
  slots: readonly Slot[];
}

export function installUiDebug({ ui, clock, widget, viewport, slots }: UiDebugDeps): void {
  extendDebug({
    ui: {
      state: () => ui.state(),
      refresh: () => ui.refresh(),
      setTimeScale: (s: number) => ui.setTimeScale(s),
      placement: () => ui.placement.current(),
      showPlantLabel: (p: Pt) => ui.showPlantLabel(p),
      slotScreen(id: string) {
        const s = slots.find((x) => x.id === id);
        if (!s) return null;
        const p = viewport().worldToScreen(s);
        const r = ui.stage.el.querySelector('canvas')?.getBoundingClientRect() ?? ui.stage.el.getBoundingClientRect();
        return { x: p.x + r.left, y: p.y + r.top };
      },
      scroll: () => ui.scroll.state(),
      scrollTo: (target: number | string, opts?: { instant?: boolean }) => ui.scroll.to(target, opts),
      dock: () => ui.dock.sections(),
      async dockReady() {
        await document.fonts?.ready;
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      },
      previewsReady: () => ui.previewsReady(),
      wayfinding(opts?: { layout?: boolean }) {
        // `{ layout: false }` reads what the path last laid out on its own (tests of its triggers)
        if (opts?.layout !== false) ui.wayfinding.layout();
        return ui.wayfinding.state();
      },
      setSectionHidden(id: string, hidden: boolean) {
        const section = ui.dock.get(id);
        section?.setHidden(hidden);
        return section !== null;
      },
      waterPlantView: () => ui.plantView.water(),
      onZoomGesture: (fn: (e: WheelEvent) => void) => ui.stage.onZoomGesture(fn),
      widget: widget
        ? {
            get opened() {
              return widget.opened;
            },
            isOpen: () => widget.isOpen(),
            close: () => widget.close(),
          }
        : null,
    },
    advance(ms: number) {
      clock.advance(ms);
      ui.refresh();
    },
    advanceTo(hhmm: string) {
      clock.advance(msUntilLocalTime(clock.now(), hhmm));
      ui.refresh();
      return clock.now();
    },
  });
}
