import type { SpeedClock } from '../core/clock';
import type { Pt, Viewport } from '../render/viewport';
import type { Slot } from '../scene/geometry';
import type { UI, UIState, WidgetIntegration } from '../ui';
import { extendDebug } from './debug';

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
      /** CSS-pixel screen position of a slot (for real pointer hovers in tests) */
      slotScreen(slotId: string): Pt | null;
      /** the fake widget (only with `?widget=fake`) */
      widget: { readonly opened: number; isOpen(): boolean; close(): void } | null;
    };
    /** Jump the dev clock forward by `ms` (e.g. into a break or a long pause) and refresh the UI. */
    advance(ms: number): void;
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
        return s ? viewport().worldToScreen(s) : null;
      },
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
  });
}
