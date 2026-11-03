/**
 * Garden thumbnails for the dock's Gardens cards (ADR 0285, docs/systems/ui.md › Gardens): a
 * small overview of each garden, always the whole world at the same framing, never a camera still.
 *
 * Where a thumbnail comes from, best first (`THUMB_RANK`):
 * - `live`: the garden on view, drawn by the renderer from its overview painting (`drawOverview`),
 *   with its plants and the sky of the hour; taken once the garden settles, after its plants
 *   change and just before you leave it, then kept for the rest of the visit;
 * - `stored`: the last live (or painted) thumbnail, from the paint cache (`scenery-thumb`);
 * - `painted`: a garden never seen here: its painting painted small in idle slices (no plants);
 * - `waiting`: nothing yet; the card shows a pale wash.
 */
import { paintScene, type PaintResult, type PaintView, type SceneArt } from '../scene/background';
import { makeCanvas, paperTexture, type AnyCanvas } from '../paint';
import type { PaintCache } from '../paint/persist';
import { WORLD_H, WORLD_W } from '../render/viewport';
import type { SceneryId } from './ids';

/** The paint-cache kind of a garden's thumbnail; its key is `thumbKey` (ADR 0242: the scenery first). */
export const THUMB_KIND = 'scenery-thumb';

export type ThumbSource = 'live' | 'stored' | 'painted' | 'waiting';

/** Higher wins: a lookup or a paint that answers late never replaces a live thumbnail. */
export const THUMB_RANK: Readonly<Record<ThumbSource, number>> = { waiting: 0, painted: 1, stored: 2, live: 3 };

/** Whether a thumbnail from `next` should replace one from `current`. */
export function replaces(current: ThumbSource, next: ThumbSource): boolean {
  return next === 'live' || THUMB_RANK[next] > THUMB_RANK[current];
}

export function thumbKey(id: SceneryId, w: number, h: number): string {
  return `${id}|${w}x${h}`;
}

export interface ThumbnailsOptions<Img> {
  ids: readonly SceneryId[];
  viewed(): SceneryId;
  /** the garden on view at the overview framing, or null when it cannot be drawn now */
  live(): Img | null;
  /** the stored thumbnail of a garden (the paint cache), or null */
  stored(id: SceneryId): Promise<Img | null>;
  /** keep a thumbnail for the next visit */
  store(id: SceneryId, img: Img): void;
  /** paint a garden's overview small (its painting only), or null */
  paint(id: SceneryId): Promise<Img | null>;
}

export interface Thumbnails<Img> {
  image(id: SceneryId): Img | null;
  source(id: SceneryId): ThumbSource;
  /** take the garden on view now; false when the renderer cannot draw it yet */
  takeLive(): boolean;
  /** give every garden without a thumbnail its stored one, else paint it (not the one on view) */
  fill(): Promise<void>;
  onChange(fn: (id: SceneryId) => void): () => void;
}

export function createThumbnails<Img>(opts: ThumbnailsOptions<Img>): Thumbnails<Img> {
  const got = new Map<SceneryId, { img: Img; source: ThumbSource }>();
  const listeners = new Set<(id: SceneryId) => void>();
  let filling: Promise<void> | null = null;
  const source = (id: SceneryId): ThumbSource => got.get(id)?.source ?? 'waiting';

  const set = (id: SceneryId, img: Img, from: ThumbSource): boolean => {
    if (!replaces(source(id), from)) return false;
    got.set(id, { img, source: from });
    for (const fn of listeners) fn(id);
    return true;
  };

  const fillOne = async (id: SceneryId) => {
    if (source(id) !== 'waiting') return;
    const stored = await opts.stored(id);
    if (stored && set(id, stored, 'stored')) return;
    // the garden on view gets its live thumbnail instead
    if (source(id) !== 'waiting' || opts.viewed() === id) return;
    const painted = await opts.paint(id);
    if (painted && set(id, painted, 'painted')) opts.store(id, painted);
  };

  return {
    image: (id) => got.get(id)?.img ?? null,
    source,
    takeLive() {
      const id = opts.viewed();
      const img = opts.live();
      if (!img) return false;
      set(id, img, 'live');
      opts.store(id, img);
      return true;
    },
    fill() {
      filling ??= (async () => {
        for (const id of opts.ids) await fillOne(id);
      })().finally(() => (filling = null));
      return filling;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** The paint cache as a thumbnail store: lookups and puts under `THUMB_KIND`. */
export function cacheStore(cache: PaintCache, w: number, h: number) {
  return {
    stored: (id: SceneryId) => cache.get(THUMB_KIND, thumbKey(id, w, h)),
    store: (id: SceneryId, img: AnyCanvas) => void cache.put(THUMB_KIND, thumbKey(id, w, h), img),
  };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The world fitted (cover) to a `w`×`h` thumbnail: the paint view `paintThumbnail` paints. */
export function thumbnailView(w: number, h: number): PaintView {
  const scale = Math.max(w / WORLD_W, h / WORLD_H);
  return { rect: { x: (WORLD_W - w / scale) / 2, y: (WORLD_H - h / scale) / 2, w: w / scale, h: h / scale }, scale };
}

/** A small painting made a thumbnail: on white, its boulders and tufts on it, the paper multiplied last. */
export function composeThumbnail(res: PaintResult, w: number, h: number): AnyCanvas {
  const { rect, scale } = res.view;
  const out = makeCanvas(w, h);
  const g = out.getContext('2d') as Ctx;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.drawImage(res.canvas as CanvasImageSource, 0, 0, w, h);
  g.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
  for (const s of [...res.sprites].sort((a, b) => a.depth - b.depth)) g.drawImage(s.canvas as CanvasImageSource, s.box.x, s.box.y, s.box.w, s.box.h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(paperTexture(w, h, 1) as CanvasImageSource, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return out;
}

/**
 * A garden's painting painted small (`w`×`h` px, the whole world) for a garden never seen here.
 * Cooperative: `yieldTo` between slices of `sliceMs`. No sky plate (painting one is a single long
 * task), so a sky that is all plate (the waterfall's) stays paper.
 */
export async function paintThumbnail(art: SceneArt, w: number, h: number, yieldTo: () => Promise<void>, sliceMs = 10): Promise<AnyCanvas> {
  const res = await paintScene(art, thumbnailView(w, h), { quality: 'draft', yieldTo, sliceMs });
  await yieldTo();
  return composeThumbnail(res, w, h);
}
