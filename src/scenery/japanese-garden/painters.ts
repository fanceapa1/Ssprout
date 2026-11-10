/**
 * The Japanese garden's painters, its own lazy chunk (ADR 0341): the landscape's steps (the
 * painters in `src/scene/`), its boulders and tufts, the sky plates and the engawa's light.
 */
import { createRng } from '../../core/rng';
import type { Painter } from '../../paint';
import type { ElementId, PaintStep, SceneArt } from '../../scene/background';
import { pavilionOf } from '../../scene/geometry';
import { PATH_GROUND, paintBanks, paintHills, paintMargins, paintPath, paintSky, paintStones, paintTufts, reservePond } from '../../scene/paint-land';
import { paintMeadow, paintMeadowGrass } from '../../scene/paint-ground';
import { paintPavilion } from '../../scene/paint-pavilion';
import { paintReflections, paintWater, paintWaterDetail } from '../../scene/paint-pond';
import { paintSkyPlate, paintWaterSkyPlate } from '../../scene/paint-sky';
import { paintShrub, paintTree } from '../../scene/paint-trees';
import { paintRockSprite, paintTuftSprite } from '../../scene/sprites';
import type { GardenPainters } from '../types';
import { ENGAWA_LIGHT } from './light';

/** No structure: nothing is kept off its ground. */
const NO_STRUCTURE = { x: Infinity, y: 0, w: 0, h: 0 };

/** The Japanese garden's paint steps (its painters are in `src/scene/`). */
export function gardenSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const root = createRng(art.seed);
  const r = (label: string) => root.fork(label);
  const { scene } = art;
  const pavilion = pavilionOf(scene);
  const ground = { pond: scene.pond, path: PATH_GROUND, pavilion: scene.structure ?? NO_STRUCTURE };
  const steps: (PaintStep & { el: ElementId })[] = [
    { el: 'sky', name: 'sky', soft: true, run: (p) => paintSky(p, r('sky')) },
    { el: 'hills', name: 'hills', soft: true, run: (p) => paintHills(p, r('hills')) },
    { el: 'banks', name: 'banks', soft: true, run: (p) => paintBanks(p, r('banks')) },
    // the grass's close-up texture: only the cells near the painted rect (ADR 0186)
    { el: 'banks', name: 'meadow', run: (p) => paintMeadow(p, r('meadow'), ground) },
    { el: 'banks', name: 'grass', run: (p) => paintMeadowGrass(p, r('meadow'), ground) },
    ...art.trees
      .filter((t) => t.distance >= 0.4)
      .map((t) => ({ el: 'trees' as const, name: t.id, run: (p: Painter) => paintTree(p, r(t.id), t) })),
    { el: 'pond', name: 'pond-reserve', run: (p) => reservePond(p, r('reserve'), scene.pond) },
    { el: 'pond', name: 'water', run: (p) => paintWater(p, r('water'), scene.pond) },
    {
      el: 'reflections',
      name: 'reflections',
      run: (p) => paintReflections(p, r('reflections'), { scene, trees: art.trees, shrubs: art.shrubs.filter((s) => s.y < 500 && s.x > 900), seed: art.seed }),
    },
    { el: 'pond', name: 'water-detail', run: (p) => paintWaterDetail(p, r('water-detail'), scene.pond) },
    { el: 'path', name: 'path', run: (p) => paintPath(p, r('path'), scene.path) },
    ...art.shrubs.map((s, i) => ({ el: 'shrubs' as const, name: `shrub-${i}`, run: (p: Painter) => paintShrub(p, r(`shrub-${i}`), s) })),
    ...art.trees
      .filter((t) => t.distance < 0.4)
      .map((t) => ({ el: 'trees' as const, name: t.id, run: (p: Painter) => paintTree(p, r(t.id), t) })),
    { el: 'tufts', name: 'tufts', run: (p) => paintTufts(p, r('tufts'), art.tufts) },
    { el: 'margins', name: 'margins', soft: true, run: (p) => paintMargins(p, r('margins')) },
    { el: 'path', name: 'stones', run: (p) => paintStones(p, r('stones'), scene.path) },
    // after the margins: the engawa runs off the right edge of the sheet, crisp
    ...(pavilion ? [{ el: 'pavilion' as const, name: 'pavilion', run: (p: Painter) => paintPavilion(p, r('pavilion'), pavilion) }] : []),
  ];
  return only ? steps.filter((s) => only.includes(s.el)) : steps;
}

export const GARDEN_PAINTERS_LOADED: GardenPainters = {
  steps: gardenSteps,
  rock: paintRockSprite,
  tuft: paintTuftSprite,
  sky: { paint: paintSkyPlate, paintWater: paintWaterSkyPlate },
  light: ENGAWA_LIGHT,
};
