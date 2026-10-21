/**
 * Time-of-day keyframes — pure. The local hour picks a colour grade: cool soft morning,
 * neutral noon, warm golden evening, blue dusk, deep indigo night with the lantern lit.
 * Grades are interpolated smoothly (smoothstep between neighbouring keyframes, wrapping at
 * midnight). The lighting layer paints them as noise-mottled multiply washes (lighting.ts).
 * docs/systems/ambience.md › Time of day, ADR 0082.
 */

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

export type TimeName = 'night' | 'dawn' | 'morning' | 'noon' | 'evening' | 'dusk';

export interface Keyframe {
  hour: number;
  name: TimeName;
  grade: Grade;
}

const NIGHT: Grade = {
  tint: [70, 80, 132],
  amount: 0.68,
  sky: 0.16,
  ground: 0.8,
  glow: 0,
  warm: [236, 214, 170],
  glowX: 0.5,
  glowY: 0.3,
  lantern: 1,
  mottle: 0.2,
};
const DAWN: Grade = {
  tint: [178, 184, 210],
  amount: 0.34,
  sky: 0.08,
  ground: 0.9,
  glow: 0.3,
  warm: [244, 206, 196],
  glowX: 0.86,
  glowY: 0.3,
  lantern: 0.2,
  mottle: 0.16,
};
const MORNING: Grade = {
  tint: [208, 220, 230],
  amount: 0.2,
  sky: 0.04,
  ground: 0.9,
  glow: 0.22,
  warm: [252, 246, 232],
  glowX: 0.86,
  glowY: 0.22,
  lantern: 0,
  mottle: 0.14,
};
const NOON: Grade = {
  tint: [244, 240, 228],
  amount: 0.03,
  sky: 0,
  ground: 1,
  glow: 0,
  warm: [252, 246, 232],
  glowX: 0.5,
  glowY: 0.1,
  lantern: 0,
  mottle: 0.1,
};
const EVENING: Grade = {
  tint: [238, 196, 146],
  amount: 0.3,
  sky: -0.04,
  ground: 1,
  glow: 0.5,
  warm: [252, 220, 160],
  glowX: 0.1,
  glowY: 0.36,
  lantern: 0.12,
  mottle: 0.16,
};
const DUSK: Grade = {
  tint: [134, 146, 192],
  amount: 0.46,
  sky: 0.12,
  ground: 0.86,
  glow: 0.22,
  warm: [230, 178, 166],
  glowX: 0.1,
  glowY: 0.4,
  lantern: 0.6,
  mottle: 0.18,
};

/** Keyframes by local hour (sorted). Between 21:15 and 05:00 it is night. */
export const KEYFRAMES: readonly Keyframe[] = [
  { hour: 5, name: 'night', grade: NIGHT },
  { hour: 6.5, name: 'dawn', grade: DAWN },
  { hour: 8, name: 'morning', grade: MORNING },
  { hour: 11, name: 'noon', grade: NOON },
  { hour: 15.5, name: 'noon', grade: NOON },
  { hour: 17.75, name: 'evening', grade: EVENING },
  { hour: 19.5, name: 'dusk', grade: DUSK },
  { hour: 21.25, name: 'night', grade: NIGHT },
];

/** The hours `window.sprout.setTime(name)` jumps to (each sits on its keyframe). */
export const NAMED_HOURS: Readonly<Record<Exclude<TimeName, 'dawn'>, number>> = {
  morning: 8,
  noon: 13,
  evening: 17.75,
  dusk: 19.5,
  night: 23,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (t: number) => t * t * (3 - 2 * t);

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

/** Wrap any hour into [0, 24). */
export function wrapHour(hour: number): number {
  if (!Number.isFinite(hour)) return 12;
  return ((hour % 24) + 24) % 24;
}

/** The two keyframes around `hour` and the (unsmoothed) position between them. */
export function bracket(hour: number): { a: Keyframe; b: Keyframe; t: number } {
  const h = wrapHour(hour);
  const n = KEYFRAMES.length;
  for (let i = 0; i < n; i++) {
    const a = KEYFRAMES[i]!;
    const b = KEYFRAMES[(i + 1) % n]!;
    const end = i + 1 < n ? b.hour : b.hour + 24;
    const hh = h < a.hour ? h + 24 : h;
    if (hh >= a.hour && hh < end) return { a, b, t: (hh - a.hour) / (end - a.hour) };
  }
  // unreachable with a sorted, wrapping table
  return { a: KEYFRAMES[0]!, b: KEYFRAMES[0]!, t: 0 };
}

/** Interpolated grade at a local hour (smoothstep between keyframes). */
export function gradeAt(hour: number): Grade {
  const { a, b, t } = bracket(hour);
  return mixGrade(a.grade, b.grade, smooth(t));
}

/** The keyframe name nearest to `hour` (debug readout). */
export function timeName(hour: number): TimeName {
  const { a, b, t } = bracket(hour);
  return t < 0.5 ? a.name : b.name;
}

/** Local fractional hour of an epoch-ms timestamp (from the injected Clock). */
export function localHour(epochMs: number): number {
  const d = new Date(epochMs);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export type TimeOverride = TimeName | number | null;

/**
 * Validate a `setTime` argument: a name (`'morning' | 'noon' | 'evening' | 'dusk' | 'night'`),
 * an hour number (wrapped into 0–24) or null (follow the clock). Throws on anything else.
 */
export function parseTimeOverride(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return wrapHour(value);
  if (typeof value === 'string' && value in NAMED_HOURS) return NAMED_HOURS[value as keyof typeof NAMED_HOURS];
  throw new TypeError(`setTime expects ${Object.keys(NAMED_HOURS).join('|')}|hour|null, got ${String(value)}`);
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
