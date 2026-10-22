import type { Clock } from '../core/clock';
import type { SessionController } from '../core/controller';
import type { EventBus } from '../core/events';
import type { Store } from '../core/state';
import type { SpeciesDef } from '../plants/types';
import type { Viewport } from '../render/viewport';
import type { Slot } from '../scene/geometry';
import type { Dock } from './dock';
import type { PlantViewState } from './plant-section';
import type { ScrollOptions, ScrollState } from './smooth-scroll';

/**
 * Contracts between the DOM UI (`src/ui`) and the rest of the app. See docs/systems/ui.md.
 */

/**
 * Optional floating-timer integration, provided by the widget task (`src/widget`).
 * When passed to `createUI` and `supported` is true, the corner menu shows a "floating timer"
 * button that calls `open()` (from the click, so it counts as a user gesture) and retires the
 * `widget` tip.
 */
export interface WidgetIntegration {
  /** Document Picture-in-Picture (or equivalent) is available in this browser. */
  readonly supported: boolean;
  /** Open the floating timer. Called synchronously inside the button's click handler. */
  open(): void | Promise<void>;
  /** Whether the floating timer is currently open (drives the button's pressed state). */
  isOpen(): boolean;
  /** Optional: call `fn` whenever the widget opens or closes. Returns an unsubscribe. */
  onChange?(fn: () => void): () => void;
}

/** The slice of `GardenAudio` (src/audio) the UI needs. */
export interface AudioIntegration {
  /** Create/resume the AudioContext — must run inside a user gesture. */
  unlock(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

export type NotificationAnswer = 'granted' | 'denied' | 'default';

/** Asking for notification permission on the first Begin (SPEC §2). Injected for tests. */
export interface NotificationIntegration {
  readonly supported: boolean;
  /** Current browser permission. */
  permission(): NotificationAnswer;
  /** Ask (must be called from the Begin click). */
  request(): Promise<NotificationAnswer>;
}

export interface UIDeps {
  /**
   * The page (`#ui`): the garden stage, the dock below it, and the fixed layers (tips, scrollbar,
   * dialogs). The UI root class and the garden-light custom properties live on it.
   */
  root: HTMLElement;
  /**
   * The garden stage: the element holding the canvas (`#stage`). Defaults to `root`'s `.stage`;
   * without one, a stage is created at the top of `root`.
   */
  stage?: HTMLElement;
  controller: SessionController;
  /** read-only use + `state/replace` for imports (core.md › Persistence) */
  store: Store;
  bus: EventBus;
  clock: Clock;
  getSpecies(id: string): SpeciesDef | undefined;
  /** scene slots (to position placement markers) */
  slots: readonly Slot[];
  /** the renderer's current viewport (`() => renderer.viewport`); re-read on every reposition */
  viewport(): Viewport;
  audio?: AudioIntegration;
  widget?: WidgetIntegration;
  notifications?: NotificationIntegration;
  isKnownSpecies?(id: string): boolean;
  reducedMotion?: boolean;
  /** Multiplies every UI delay (idle fade, fauna line). Dev/tests only; default 1. */
  timeScale?: number;
}

/** What the renderer may draw in-canvas while the gardener is choosing a spot. */
export interface PlacementHighlight {
  active: boolean;
  speciesId: string | null;
  slots: Array<{ id: string; x: number; y: number; occupied: boolean }>;
  /** slot under the pointer / keyboard focus */
  focused: string | null;
  /** the spot chosen for the new plant (before Begin) */
  selected: string | null;
}

/** What the gardener is putting together in the planting sheet (kept across Back). */
export interface PlantingDraft {
  taskName: string;
  goalMinutes: number;
  planId: string | null;
  speciesId: string | null;
  slotId: string | null;
}

export type UIMode = 'garden' | 'planting' | 'placement';

/** Snapshot for tests (`window.sprout.ui.state()`). */
export interface UIState {
  mode: UIMode;
  /** session controls view (the dock's Study section) */
  panel: 'idle' | 'focus' | 'break' | 'paused' | 'longPause';
  /** the timer pill on the garden */
  pill: 'idle' | 'focus' | 'break' | 'paused' | 'longPause';
  /** the dock's "Your plant" view */
  plantView: PlantViewState;
  /** inline confirmation currently shown in the panel */
  confirm: 'cancel' | null;
  /** the controls on the painting (pill, corner icons) rest while focusing */
  resting: boolean;
  /** open dialogs by name */
  dialogs: string[];
  /** visible tooltip ids */
  tips: string[];
  /** placement marker slot ids */
  markers: string[];
  /** quiet line currently shown at the top (completion or fauna arrival) */
  line: string | null;
  /** finished-plant label currently shown (hover/tap) */
  plantLabel: string | null;
  /** the planting draft */
  draft: PlantingDraft;
}

/** The page's scrolling, as the UI exposes it (custom smooth scroll, ADR 0131). */
export interface UIScroll {
  state(): ScrollState;
  /** glide to a scroll position, or to a dock section by id; resolves on arrival */
  to(target: number | string, opts?: ScrollOptions): Promise<void>;
}

/** The garden stage, as later features (the camera) see it. */
export interface UIStage {
  readonly el: HTMLElement;
  /** reserve ctrl/⌘ + wheel and trackpad pinch over the garden (the page never scrolls on them) */
  onZoomGesture(fn: (e: WheelEvent) => void): () => void;
}

export interface UI {
  /** sections below the garden: `ui.dock.addSection({ id, title, order, span, mount })` */
  readonly dock: Dock;
  readonly stage: UIStage;
  readonly scroll: UIScroll;
  /** the dock's live plant view: `water()` plays the watering animation (automatic watering hook) */
  readonly plantView: { water(): boolean; state(): PlantViewState };
  readonly placement: {
    current(): PlacementHighlight;
    /** called whenever markers appear/disappear/move or focus changes */
    subscribe(fn: (h: PlacementHighlight) => void): () => void;
  };
  state(): UIState;
  /** Re-read status/state and re-render (the controller ticks once a second anyway). */
  refresh(): void;
  setTimeScale(scale: number): void;
  /** show the finished-plant label for the plant at a world point (as a hover would); returns its text */
  showPlantLabel(world: { x: number; y: number }): string | null;
  dispose(): void;
}
