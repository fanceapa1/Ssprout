/**
 * Every pacing and scale constant for the wildlife lives here (docs/systems/fauna.md › Pacing).
 * Times are in seconds of animation time, distances in world units at perspective scale 1.
 */

/** Creatures that come and go on a schedule (residents — koi, striders, frog — are not here). */
export type VisitorKind = 'leaf' | 'dragonfly' | 'butterfly' | 'bee' | 'bird' | 'swallow' | 'heron';
export type ResidentKind = 'strider' | 'koi' | 'frog';
export type FaunaKind = VisitorKind | ResidentKind;

export const VISITOR_KINDS: readonly VisitorKind[] = ['leaf', 'dragonfly', 'butterfly', 'bee', 'bird', 'swallow', 'heron'];
export const RESIDENT_KINDS: readonly ResidentKind[] = ['strider', 'koi', 'frog'];
export const FAUNA_KINDS: readonly FaunaKind[] = [...RESIDENT_KINDS, ...VISITOR_KINDS];

export type Range = readonly [number, number];

export interface VisitTuning {
  /** quiet gap between the end of one visit's spawn and the next (s) */
  gap: Range;
  /** the first visit after the creature is unlocked (or the page loads) comes sooner (s) */
  first: Range;
  /** how long a visit lasts before the creature leaves (s) */
  stay: Range;
  /** individuals per visit */
  group: Range;
  /** most individuals of this kind on screen at once */
  max: number;
  /** rests at night (no new visits; present ones leave) */
  diurnal: boolean;
  /** counts against FAUNA_TUNING.maxVisitors (falling leaves don't) */
  visitor: boolean;
}

export const VISITS: Record<VisitorKind, VisitTuning> = {
  leaf: { gap: [120, 300], first: [20, 90], stay: [50, 90], group: [1, 1], max: 2, diurnal: false, visitor: false },
  dragonfly: { gap: [100, 260], first: [15, 60], stay: [25, 55], group: [1, 1], max: 1, diurnal: true, visitor: true },
  butterfly: { gap: [80, 200], first: [20, 70], stay: [35, 70], group: [1, 2], max: 2, diurnal: true, visitor: true },
  bee: { gap: [60, 150], first: [20, 60], stay: [30, 60], group: [1, 2], max: 3, diurnal: true, visitor: true },
  bird: { gap: [130, 320], first: [30, 90], stay: [16, 45], group: [1, 2], max: 2, diurnal: true, visitor: true },
  swallow: { gap: [240, 600], first: [60, 180], stay: [0, 0], group: [1, 3], max: 3, diurnal: true, visitor: true },
  heron: { gap: [900, 1800], first: [120, 400], stay: [90, 220], group: [1, 1], max: 1, diurnal: true, visitor: true },
};

export const FAUNA_TUNING = {
  /** most visiting individuals (not koi, striders, frog, leaves) on screen at once */
  maxVisitors: 3,
  /** when a visit is due but blocked (cap, night), try again after this long (s) */
  retry: [8, 20] as Range,
  /** during an active (unpaused) session the garden is a little livelier: gaps × this */
  livelyGap: 0.75,
  /** prefers-reduced-motion: gaps × this, speeds × reducedSpeed, cap 1 visitor */
  reducedGap: 3,
  reducedSpeed: 0.6,
  reducedMaxVisitors: 1,
  /** koi-3 (25 plants): "more frequent birds" — bird gaps × this */
  birdBoostGap: 0.6,
  /** local hours when diurnal creatures rest: [from, to) wrapping midnight */
  nightHours: [20, 5] as Range,
  /** resident water striders */
  striders: 3,
  reducedStriders: 1,
  /** the pond is seen at an angle: plane y = world y / squash (koi, striders and leaves move in the plane) */
  pondSquash: 0.42,
  /** world units: margins kept from the pond edge */
  koiMargin: 26,
  striderMargin: 14,
  /** frog hops into the water every so often, comes back after a while (s) */
  frogDive: [240, 700] as Range,
  frogAway: [30, 90] as Range,
  /** ripple rings alive at once */
  maxRipples: 14,
  /** off-screen margin for entries and exits */
  offscreen: 60,
} as const;

/** Body sizes (world units at perspective 1). */
export const SIZES = {
  strider: 13,
  leaf: 14,
  dragonfly: 30,
  koi: 60,
  butterfly: 24,
  swallowtail: 30,
  bee: 7,
  sparrow: 17,
  wagtail: 24,
  frog: 17,
  swallow: 26,
  heron: 150,
} as const;

/** Cruise speeds (world units / s). */
export const SPEEDS = {
  koi: [7, 14] as Range,
  koiTurn: 0.45, // rad/s
  striderBurst: [38, 70] as Range,
  dragonflyCruise: 140,
  butterfly: [26, 40] as Range,
  bee: [55, 85] as Range,
  birdFlight: 150,
  swallow: [230, 320] as Range,
  heronFlight: 70,
  leafFall: 22,
  leafDrift: [2, 5] as Range,
} as const;
