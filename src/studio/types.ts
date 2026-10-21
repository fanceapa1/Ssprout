/**
 * Studio: a dev page (studio.html) that shows every sprite, creature, effect and paint
 * primitive for visual review. Any `src/**\/*.studio.ts` file is discovered automatically; it
 * default-exports one StudioSection (or an array of them).
 */
export interface StudioRenderContext {
  /** animation time in seconds (scaled by the speed slider; frozen while paused) */
  t: number;
  /** seconds since the previous render of this entry (0 for static renders) */
  dt: number;
  /** global studio seed — derive all randomness from it, e.g. createRng(seed) */
  seed: number;
  /** number of times this entry has been rendered since its last reset */
  frame: number;
  /** canvas pixels per logical unit (canvas.width / w) — handy for drawing in logical units */
  pixelRatio: number;
}

export interface StudioEntry {
  /** unique within its section; addressed as `<sectionId>/<entryId>` */
  id: string;
  label: string;
  /** logical size (CSS px at 1×) */
  w: number;
  h: number;
  /** re-rendered every animation frame when true; otherwise once per seed/scale change */
  animated?: boolean;
  /**
   * Paint into `canvas`, filling canvas.width × canvas.height pixels. The studio resets the
   * transform and clears the canvas (transparent) before every call.
   */
  render(canvas: HTMLCanvasElement, ctx: StudioRenderContext): void;
}

export interface StudioSection {
  id: string;
  title: string;
  /** sort key; lower first (default 100), ties sorted by title */
  order?: number;
  entries: StudioEntry[];
}

export type StudioModule = { default: StudioSection | StudioSection[] };
