/**
 * The Greek coast's painters, its own lazy chunk (ADR 0341): the placeholder landscape steps (draft
 * B's on the final layout), its placeholder sky plates and light marks.
 */
import { createRng } from '../../core/rng';
import type { PaintStep, SceneArt } from '../../scene/background';
import { paintMargins } from '../../scene/paint-land';
import type { GardenPainters } from '../types';
import { COAST_ELEMENTS } from './index';
import { COAST_LIGHT } from './light';
import { paintBeds, paintFarHill, paintLand, paintOlive, paintPine, paintPromontory, paintShore, paintTemple, paintWalls } from './paint-placeholder';
import { paintCaique } from './boat';
import { paintBeach, paintPools, paintSea } from './paint-water';
import { COAST_SKY_PAINTERS } from './sky';

type Element = keyof typeof COAST_ELEMENTS;
type Step = (typeof COAST_ELEMENTS)[Element][number];

/** The paint steps, back to front, on white: the sky plates are multiplied over them. */
export function coastSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const r = (label: string) => createRng(art.seed).fork(label);
  const run: Record<Step, PaintStep['run']> = {
    'far-hill': (p) => paintFarHill(p, r('far-hill')),
    sea: (p) => paintSea(p, r('sea')),
    caique: (p) => paintCaique(p, r('caique')),
    promontory: (p) => paintPromontory(p, r('promontory')),
    temple: (p) => paintTemple(p, r('temple')),
    shore: (p) => paintShore(p, r('shore')),
    beach: (p) => paintBeach(p, r('beach')),
    pools: (p) => paintPools(p, r('pools')),
    land: (p) => paintLand(p, r('land')),
    walls: (p) => paintWalls(p, r('walls')),
    beds: (p) => paintBeds(p, r('beds')),
    olive: (p) => paintOlive(p, r('olive')),
    pine: (p) => paintPine(p, r('pine')),
    margins: (p) => paintMargins(p, r('margins')),
  };
  const steps: PaintStep[] = [];
  for (const el of Object.keys(COAST_ELEMENTS) as Element[]) {
    if (only && !only.includes(el)) continue;
    for (const name of COAST_ELEMENTS[el]) steps.push({ name, soft: el === 'far' || name === 'margins', run: run[name] });
  }
  return steps;
}

export const COAST_PAINTERS_LOADED: GardenPainters = { steps: coastSteps, sky: COAST_SKY_PAINTERS, light: COAST_LIGHT };
