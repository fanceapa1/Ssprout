/**
 * The light grade of each daylight phase — pure. A grade is the colour cast the lighting layer
 * paints as a noise-mottled multiply wash (lighting.ts) underneath the painted shadows, rims and
 * glows of each phase's plate (cast.ts). The UI dims its paper slips with the same grade
 * (ADR 0121). Grades blend by the phase weights (daylight.ts). ADRs 0082, 0141.
 */
import { PHASES, phaseAt, type DayPhase, type PhaseWeights } from './daylight';

export type Rgb = readonly [number, number, number];

export interface Grade {
  /** multiply wash colour */
  tint: Rgb;
  /** wash alpha, 0 = untouched paper */
  amount: number;
  /** extra alpha toward the top of the frame (the sky deepens first), may be negative */
  sky: number;
  /** alpha multiplier at the bottom edge (< 1 keeps the foreground plants readable) */
  ground: number;
  /** warm light from a low sun / sky glow: wash thinned and shifted toward `warm` (0..1) */
  glow: number;
  warm: Rgb;
  /** light source position in the frame, 0..1 (x: left → right, y: top → bottom) */
  glowX: number;
  glowY: number;
  /** lantern: paper reserved and warmed around pavilion.lantern (0..1) */
  lantern: number;
  /** noise mottling of the wash, 0..1 */
  mottle: number;
}

/**
 * The four casts. Midday is almost bare paper (the painting at its most saturated and crisp);
 * sunrise a thin cool lavender warmed toward the rising sun on the right; sunset a warm amber,
 * glowing toward the setting sun on the left, the lantern coming on; night a moonlit indigo
 * glaze the paper still breathes through — lighter over the garden so the plants stay readable
 * (SPEC §5; an over-heavy veil was a problem before, ADR 0121).
 */
export const PHASE_GRADES: Readonly<Record<DayPhase, Grade>> = {
  sunrise: {
    tint: [204, 202, 234],
    amount: 0.2,
    sky: 0.02,
    ground: 0.85,
    glow: 0.5,
    warm: [255, 218, 190],
    glowX: 0.7,
    glowY: 0.36,
    lantern: 0.08,
    mottle: 0.16,
  },
  midday: {
    tint: [252, 248, 236],
    amount: 0.03,
    sky: 0,
    ground: 1,
    glow: 0,
    warm: [252, 246, 232],
    glowX: 0.5,
    glowY: 0.1,
    lantern: 0,
    mottle: 0.1,
  },
  sunset: {
    tint: [242, 186, 128],
    amount: 0.34,
    sky: -0.04,
    ground: 1,
    glow: 0.55,
    warm: [255, 216, 150],
    glowX: 0.35,
    glowY: 0.36,
    lantern: 0.45,
    mottle: 0.16,
  },
  night: {
    tint: [92, 106, 184],
    amount: 0.48,
    sky: 0.16,
    ground: 0.94,
    glow: 0,
    warm: [236, 214, 170],
    glowX: 0.5,
    glowY: 0.3,
    lantern: 1,
    mottle: 0.1,
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function mixGrade(a: Grade, b: Grade, t: number): Grade {
  return {
    tint: lerpRgb(a.tint, b.tint, t),
    amount: lerp(a.amount, b.amount, t),
    sky: lerp(a.sky, b.sky, t),
    ground: lerp(a.ground, b.ground, t),
    glow: lerp(a.glow, b.glow, t),
    warm: lerpRgb(a.warm, b.warm, t),
    glowX: lerp(a.glowX, b.glowX, t),
    glowY: lerp(a.glowY, b.glowY, t),
    lantern: lerp(a.lantern, b.lantern, t),
    mottle: lerp(a.mottle, b.mottle, t),
  };
}

/** The grade for a weight set (a weighted mix of the phase grades). */
export function gradeFor(weights: PhaseWeights): Grade {
  let g: Grade | null = null;
  let acc = 0;
  for (const p of PHASES) {
    const w = weights[p];
    if (w <= 0) continue;
    acc += w;
    g = g ? mixGrade(g, PHASE_GRADES[p], w / acc) : PHASE_GRADES[p];
  }
  return g ?? PHASE_GRADES.midday;
}

/**
 * A typical equinox day's boundaries (local hours) for hour-based callers that have no sun
 * times: civil dawn 5:30, midday from 7:30, sunset light from 17:30, night from 19:30.
 */
export const TYPICAL_DAY: ReadonlyArray<{ hour: number; from: DayPhase; to: DayPhase }> = [
  { hour: 5.5, from: 'night', to: 'sunrise' },
  { hour: 7.5, from: 'sunrise', to: 'midday' },
  { hour: 17.5, from: 'midday', to: 'sunset' },
  { hour: 19.5, from: 'sunset', to: 'night' },
];

/** v1 names → an hour of the typical day (kept for hour-based callers). */
export const NAMED_HOURS = { morning: 6.5, noon: 13, evening: 18.5, dusk: 19.5, night: 23 } as const;

/** Phase weights at a local hour of the typical day. */
export function weightsAtHour(hour: number): PhaseWeights {
  const H = 3_600_000;
  const list = [-24, 0, 24].flatMap((d) => TYPICAL_DAY.map((b) => ({ at: (b.hour + d) * H, from: b.from, to: b.to })));
  return phaseAt(wrapHour(hour) * H, list, 'night').weights;
}

/** The grade at a local hour of the typical day. */
export function gradeAt(hour: number): Grade {
  return gradeFor(weightsAtHour(hour));
}

/** Wrap any hour into [0, 24). */
export function wrapHour(hour: number): number {
  if (!Number.isFinite(hour)) return 12;
  return ((hour % 24) + 24) % 24;
}

/** Local fractional hour of an epoch-ms timestamp (from the injected Clock). */
export function localHour(epochMs: number): number {
  const d = new Date(epochMs);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Squared distance between grades (used to skip redundant lighting redraws). */
export function gradeDistance(a: Grade, b: Grade): number {
  let d = 0;
  for (let i = 0; i < 3; i++) {
    d += ((a.tint[i]! - b.tint[i]!) / 255) ** 2 + ((a.warm[i]! - b.warm[i]!) / 255) ** 2;
  }
  d += (a.amount - b.amount) ** 2 + (a.sky - b.sky) ** 2 + (a.ground - b.ground) ** 2 + (a.glow - b.glow) ** 2;
  d += (a.glowX - b.glowX) ** 2 + (a.glowY - b.glowY) ** 2 + (a.lantern - b.lantern) ** 2 + (a.mottle - b.mottle) ** 2;
  return d;
}
