import { describe, expect, it } from 'vitest';
import { bounds } from '../paint/geometry';
import { PAINT_ROOTS } from '../paint/paint-version';
import { DEFAULT_FOCUS, WORLD_H, WORLD_W } from '../render/viewport';
import { GARDEN_ART } from '../scene/background';
import { gardenScene, PATH } from '../scene/geometry';
import { GARDEN_SKY } from '../scene/paint-sky';
import { DEFAULT_SCENERY, isSceneryId, SCENERY_IDS } from './ids';
import { JAPANESE_GARDEN } from './japanese-garden';
import { getScenery, hasScenery, sceneries } from './registry';

describe('scenery ids', () => {
  it('lists the Japanese garden (the default) and the waterfall', () => {
    expect(SCENERY_IDS).toEqual(['japanese-garden', 'waterfall']);
    expect(DEFAULT_SCENERY).toBe('japanese-garden');
    expect(isSceneryId('waterfall')).toBe(true);
    expect(isSceneryId('coast')).toBe(false);
    expect(isSceneryId(3)).toBe(false);
  });
});

describe('the registry', () => {
  it('holds the Japanese garden only, for now', () => {
    expect(sceneries().map((s) => s.id)).toEqual(['japanese-garden']);
    expect(getScenery('japanese-garden')).toBe(JAPANESE_GARDEN);
    expect(hasScenery('waterfall')).toBe(false);
  });

  it('falls back to the default scenery for one not registered yet', () => {
    expect(getScenery('waterfall')).toBe(JAPANESE_GARDEN);
  });

  it('keeps each scenery consistent with itself', () => {
    for (const s of sceneries()) {
      expect(s.art.scenery, s.id).toBe(s.id);
      expect(s.art.scene, s.id).toBe(s.geometry);
      expect(s.light.sky, s.id).toBe(s.sky.layout);
      expect(s.available(new URLSearchParams()), s.id).toBe(true);
    }
  });
});

describe('the Japanese garden scenery', () => {
  it("is today's garden: its geometry, painting and sky", () => {
    expect(JAPANESE_GARDEN.geometry).toBe(gardenScene);
    expect(JAPANESE_GARDEN.art).toBe(GARDEN_ART);
    expect(JAPANESE_GARDEN.sky).toBe(GARDEN_SKY);
  });

  it('frames the pond and leaves by the stepping stones', () => {
    expect(JAPANESE_GARDEN.view.focus).toEqual({ x: 800, y: 560 });
    expect(DEFAULT_FOCUS).toBe(JAPANESE_GARDEN.view.focus);
    expect(JAPANESE_GARDEN.view.pathOut).toEqual(PATH.map((s) => ({ x: s.x, y: s.y + s.ry })));
  });

  it('veils the mist above the plant zone and puts the dew on the near banks', () => {
    const { ambience } = JAPANESE_GARDEN;
    expect(ambience.veilTo).toBe(bounds(gardenScene.pond).y + 140);
    for (const d of ambience.dew) {
      expect(d.x >= 0 && d.x + d.w <= WORLD_W && d.y + d.h <= WORLD_H).toBe(true);
      expect(d.y).toBeGreaterThan(bounds(gardenScene.pond).y + bounds(gardenScene.pond).h);
    }
  });
});

describe('paint cache', () => {
  it('versions the sceneries with the painters (ADR 0242)', () => {
    expect(PAINT_ROOTS).toContain('src/scenery');
  });
});
