/**
 * The Ksar oasis's painters, its own lazy chunk (ADR 0341): the landscape's steps (O2–O4), its
 * sky plates and its own marks on the light plates (O5).
 */
import { createRng } from '../../core/rng';
import type { PaintStep, SceneArt } from '../../scene/background';
import { paintMargins } from '../../scene/paint-land';
import type { GardenPainters } from '../types';
import { OASIS_ELEMENTS } from './index';
import { OASIS_LIGHT } from './light';
import { paintDunes, paintFootpath, paintForeground, paintGround, paintPlots, paintRanges, paintTerraces, paintWalls } from './paint-land';
import { paintBluff, paintKsar } from './paint-rocks';
import { paintBasin, paintOued, paintSeguia } from './paint-water';
import { paintBigPalms, paintGrove } from './paint-veg';
import { OASIS_SKY_PAINTERS } from './sky';

type Element = keyof typeof OASIS_ELEMENTS;
type Step = (typeof OASIS_ELEMENTS)[Element][number];

/** The paint steps, back to front, on white: the sky plates are multiplied over them. */
export function oasisSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  const r = (label: string) => createRng(art.seed).fork(label);
  const run: Record<Step, PaintStep['run']> = {
    ranges: (p) => paintRanges(p, r('far-ranges')),
    dunes: (p) => paintDunes(p, r('far-dunes')),
    ground: (p) => paintGround(p, r('land-ground')),
    terraces: (p) => paintTerraces(p, r('land-terraces')),
    plots: (p) => paintPlots(p, r('land-plots')),
    footpath: (p) => paintFootpath(p, r('land-footpath')),
    grove: (p) => paintGrove(p, r('veg-grove')),
    bluff: (p) => paintBluff(p, r('rock-bluff')),
    ksar: (p) => paintKsar(p, r('rock-ksar')),
    walls: (p) => paintWalls(p, r('land-walls')),
    basin: (p) => paintBasin(p, r('water-basin')),
    seguia: (p) => paintSeguia(p, r('water-seguia')),
    oued: (p) => paintOued(p, r('water-oued')),
    'big-palms': (p) => paintBigPalms(p, r('veg-big-palms')),
    foreground: (p) => paintForeground(p, r('land-foreground')),
    margins: (p) => paintMargins(p, r('margins')),
  };
  const steps: PaintStep[] = [];
  for (const el of Object.keys(OASIS_ELEMENTS) as Element[]) {
    if (only && !only.includes(el)) continue;
    for (const name of OASIS_ELEMENTS[el]) steps.push({ name, soft: el === 'far' || name === 'margins', run: run[name] });
  }
  return steps;
}

export const OASIS_PAINTERS_LOADED: GardenPainters = { steps: oasisSteps, sky: OASIS_SKY_PAINTERS, light: OASIS_LIGHT };
