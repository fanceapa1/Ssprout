import type { Clock } from '../core/clock';
import type { EventBus } from '../core/events';
import type { Store } from '../core/state';
import type { SceneGeometry } from '../scene/geometry';
import type { Viewport } from './viewport';

/** Back → front. `background` and `paper` are cached per resize; the rest redraw every frame. */
export type LayerId =
  | 'background'
  | 'underwater'
  | 'waterSurface'
  | 'entities'
  | 'air'
  | 'ambience'
  | 'lighting'
  | 'paper';

export const LAYERS: readonly LayerId[] = [
  'background',
  'underwater',
  'waterSurface',
  'entities',
  'air',
  'ambience',
  'lighting',
  'paper',
];

export const CACHED_LAYERS: readonly LayerId[] = ['background', 'paper'];

export interface FrameInfo {
  /** animation time in seconds since the renderer started (does not advance while frozen) */
  t: number;
  /** seconds since the previous frame, clamped (0 for the first frame and renderOnce) */
  dt: number;
  /** epoch ms via Clock */
  now: number;
}

export interface Drawable {
  /** sort key (base y in world units); lower is drawn first */
  depth: number;
  draw(ctx: CanvasRenderingContext2D, f: FrameInfo): void;
}

export interface System {
  id: string;
  /** called once and on every resize; may prerender caches at viewport.scale */
  init?(ctx: SystemContext): void | Promise<void>;
  update?(f: FrameInfo): void;
  /** draw directly into a layer (ctx already transformed to world units) */
  draw?(layer: LayerId, ctx: CanvasRenderingContext2D, f: FrameInfo): void;
  /** contribute depth-sorted drawables to the `entities` layer */
  entities?(f: FrameInfo): Drawable[];
  dispose?(): void;
}

export interface SystemContext {
  viewport: Viewport;
  store: Store;
  bus: EventBus;
  clock: Clock;
  scene: SceneGeometry;
  reducedMotion: boolean;
}
