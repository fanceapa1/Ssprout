import { describe, expect, it } from 'vitest';
import { SCENE_CACHE, paintingKey, spritesKey, type SceneArt } from '../scene/background';
import { SKY_PLATE_KIND, skyPlateKey } from '../scene/sky-light';
import { LIGHT_PLATE_KIND, lightPlateKey } from '../ambience/cast';
import { THUMB_KIND, thumbKey } from '../scenery/thumbnail';
import { TIER, TIER_KINDS, spritesKeyOf, tiers, victims } from './evict';
import type { EntryMeta } from './persist';

const MB = 1_000_000;
const art = (scenery: string, seed: number) => ({ scenery, seed }) as unknown as SceneArt;
const view = (w: number, h: number, scale: number) => ({ rect: { x: 0, y: 0, w, h }, scale });
const detailView = (x: number, scale: number) => ({ rect: { x, y: 300, w: 880, h: 560 }, scale });

let used = 0;
const entry = (kind: string, key: string, bytes: number): EntryMeta => ({ id: `v:${kind}:${key}`, version: 'v', kind, key, bytes, used: ++used });

describe('paint cache eviction tiers (ADR 0351)', () => {
  it('knows the kinds and key shapes the app stores', () => {
    expect(TIER_KINDS.overview).toBe(SCENE_CACHE.overview);
    expect(TIER_KINDS.sprites).toBe(SCENE_CACHE.sprites);
    expect(TIER_KINDS.thumb).toBe(THUMB_KIND);
    expect(TIER_KINDS.plates).toEqual([SKY_PLATE_KIND, LIGHT_PLATE_KIND]);
    const a = art('oasis', 13);
    expect(spritesKeyOf(paintingKey(a, view(1600, 1000, 1.5), 'normal'))).toBe(spritesKey(a, 1.5, 'normal'));
    expect(spritesKeyOf(paintingKey(a, detailView(60, 2.8), 'normal'))).toBe(spritesKey(a, 2.8, 'normal'));
    expect(spritesKeyOf('a')).toBeNull();
    for (const k of [skyPlateKey('oasis', 13, 'night', { w: 10, h: 5 }, { x: 0, y: 0, w: 4, h: 2 }, { w: 4, h: 2 }), lightPlateKey('oasis', 'cast', 'night', 640, 400, 'g1'), thumbKey('oasis', 448, 280)])
      expect(k.split('|')[0]).toBe('oasis');
  });

  it('a garden landscape (the overviews and sprites of its latest scale, the thumbnail) is the top tier', () => {
    const a = art('japanese-garden', 7);
    const old = entry('scene', paintingKey(a, view(1600, 1000, 1), 'normal'), 4 * MB);
    const scene = entry('scene', paintingKey(a, view(1600, 1000, 1.5), 'normal'), 6 * MB);
    const strip = entry('scene', paintingKey(a, { rect: { x: 439, y: 0, w: 721, h: 1000 }, scale: 1.5 }, 'normal'), 2 * MB);
    const sprites = entry('scene-sprites', spritesKey(a, 1.5, 'normal'), MB);
    const oldSprites = entry('scene-sprites', spritesKey(a, 1, 'normal'), MB);
    const detail = entry('scene-detail', paintingKey(a, detailView(60, 2.8), 'normal'), 7 * MB);
    const detailSprites = entry('scene-sprites', spritesKey(a, 2.8, 'normal'), MB);
    const sky = entry('sky-plate', 'japanese-garden|s7|night|1120x518', MB);
    const light = entry('light-plate', 'japanese-garden|cast|night|640x400|g1', MB);
    const thumb = entry('scenery-thumb', thumbKey('japanese-garden', 448, 280), MB);
    const other = entry('something-new', 'japanese-garden|x', MB);
    const t = tiers([old, strip, scene, sprites, oldSprites, detail, detailSprites, sky, light, thumb, other]);
    // a phone's strip and the full overview it extends to share the scale: both are kept
    expect([strip, scene, sprites, thumb].map((m) => t.get(m.id))).toEqual(Array(4).fill(TIER.LANDSCAPE));
    expect([sky, light].map((m) => t.get(m.id))).toEqual([TIER.PLATES, TIER.PLATES]);
    expect([old, oldSprites, detail, detailSprites, other].map((m) => t.get(m.id))).toEqual(Array(5).fill(TIER.DETAIL));
  });

  // the order measured at 1440x900 @2 before this change evicted the garden on view first (devlog 164)
  it('evicts close views, then plates least recently used first, and the landscapes last', () => {
    const [j, o, w] = ['japanese-garden', 'oasis', 'waterfall'].map((g, i) => entry('scene', paintingKey(art(g, i), view(1600, 1000, 1.5), 'normal'), 6 * MB)) as [EntryMeta, EntryMeta, EntryMeta];
    const plates = ['sunrise', 'midday', 'sunset', 'night'].map((p) => entry('sky-plate', `japanese-garden|s0|${p}|1120x518`, MB));
    const [rise, noon, dusk, night] = plates as [EntryMeta, EntryMeta, EntryMeta, EntryMeta];
    const [d1, d2] = [60, 600].map((x) => entry('scene-detail', paintingKey(art('japanese-garden', 0), detailView(x, 2.8), 'normal'), 7 * MB)) as [EntryMeta, EntryMeta];
    const held = [j, o, w, ...plates, d1, d2]; // 36 MB
    const ids = (...ms: EntryMeta[]) => ms.map((m) => m.id);
    expect(victims(held, 40 * MB)).toEqual([]);
    expect(victims(held, 30 * MB)).toEqual(ids(d1));
    expect(victims(held, 20 * MB)).toEqual(ids(d1, d2, rise, noon));
    expect(victims(held, 12 * MB)).toEqual(ids(d1, d2, rise, noon, dusk, night, j));
    // a plate used again outlives the others
    rise.used = ++used;
    expect(victims(held, 20 * MB)).toEqual(ids(d1, d2, noon, dusk));
  });

  it('a put evicts only its own tier or lower, and is refused when that cannot make room', () => {
    const scene = entry('scene', paintingKey(art('oasis', 13), view(1600, 1000, 1.5), 'normal'), 30 * MB);
    const sky = entry('sky-plate', 'oasis|s13|midday|1120x518', MB);
    const detail = entry('scene-detail', paintingKey(art('oasis', 13), detailView(60, 2.8), 'normal'), 7 * MB);
    const held = [scene, sky, detail];
    const newDetail = entry('scene-detail', paintingKey(art('oasis', 13), detailView(600, 2.8), 'normal'), 7 * MB);
    expect(victims(held, 40 * MB, newDetail)).toEqual([detail.id]);
    const bigDetail = { ...newDetail, bytes: 12 * MB };
    expect(victims(held, 40 * MB, bigDetail)).toBeNull();
    const plate = entry('light-plate', 'oasis|cast|night|640x400|g1', 4 * MB);
    expect(victims(held, 40 * MB, plate)).toEqual([detail.id]);
    // a new window size: the new overview is the garden's landscape now, the old one may go
    const resized = entry('scene', paintingKey(art('oasis', 13), view(1600, 1000, 1), 'normal'), 20 * MB);
    expect(victims(held, 40 * MB, resized)).toEqual([scene.id]);
    // replacing an entry counts its bytes once
    expect(victims(held, 38 * MB, { ...detail, used: ++used })).toEqual([]);
  });

  it('on open (no incoming entry) every tier may go, lowest first', () => {
    const scene = entry('scene', 'oasis|s1|normal|0,0,1,1@1|1x1', 10);
    const sky = entry('sky-plate', 'oasis|s1|midday|1x1', 10);
    expect(victims([scene, sky], 5)).toEqual([sky.id, scene.id]);
    expect(victims([scene, sky], 20)).toEqual([]);
  });
});
