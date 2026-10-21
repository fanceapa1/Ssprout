import type { PreviewCache } from './previews';
import type { UIDeps, UIMode } from './types';

/**
 * State shared by the UI components (internal to src/ui). Components never talk to each other
 * directly: they change the mode or call `changed()`, and the composition in index.ts reacts.
 */
export interface UIContext {
  readonly deps: UIDeps;
  readonly previews: PreviewCache;
  /** polite screen-reader announcement (the shared live region) */
  announce(text: string): void;
  mode(): UIMode;
  setMode(mode: UIMode): void;
  /** something visible changed (tips re-layout, dev snapshot) */
  changed(): void;
  /** a UI delay in ms, scaled by `timeScale` (dev/tests) */
  delay(ms: number): number;
  /** open a modal <dialog>, closing any other UI dialog first; focus returns to the opener on close */
  openDialog(dialog: HTMLDialogElement, opener?: HTMLElement | null): void;
  closeDialog(dialog: HTMLDialogElement): void;
  /** names of open dialogs (data-dialog attribute) */
  openDialogs(): string[];
}
