/**
 * The coast's daylight data outside its painter chunk (G5, ADR 0372): its grades (ADR 0301), the
 * low glows over the sea where the suns are, and how strongly its sea mirrors the sky.
 */
import type { DayPhase } from '../../ambience/daylight';
import type { Grade } from '../../ambience/timeofday';
import { COAST_SKY_LAYOUT } from './layout';

const glowX = (x: number) => x / 1600;
const glowY = COAST_SKY_LAYOUT.horizonY / 1000;

/**
 * How strongly the sky lies on the sea (`ScenerySky.waterAlpha`): stronger than on a pond, the
 * way open water far out mirrors a low sky. The plate itself thins toward the near shore
 * (`WATER_NEAR`), so the shallows keep their own colour, seagrass and sand.
 */
export const COAST_WATER_ALPHA: Record<DayPhase, number> = { sunrise: 0.6, midday: 0.34, sunset: 0.78, night: 0.55 };

export const COAST_GRADES: Record<DayPhase, Grade> = {
  sunrise: { tint: [216, 204, 234], amount: 0.2, sky: 0.02, ground: 0.85, glow: 0.55, warm: [255, 222, 196], glowX: glowX(COAST_SKY_LAYOUT.sunriseX), glowY, lantern: 0, mottle: 0.16 },
  midday: { tint: [252, 246, 232], amount: 0.04, sky: 0, ground: 1, glow: 0, warm: [252, 246, 232], glowX: 0.5, glowY: 0.1, lantern: 0, mottle: 0.1 },
  sunset: { tint: [244, 178, 132], amount: 0.34, sky: -0.04, ground: 1, glow: 0.6, warm: [255, 210, 150], glowX: glowX(COAST_SKY_LAYOUT.sunsetX), glowY, lantern: 0, mottle: 0.16 },
  night: { tint: [78, 100, 188], amount: 0.5, sky: 0.2, ground: 1.1, glow: 0, warm: [236, 214, 170], glowX: 0.5, glowY: 0.3, lantern: 0, mottle: 0.1 },
};
