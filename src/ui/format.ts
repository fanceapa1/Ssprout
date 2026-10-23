import { faunaUnlock } from '../core/fauna-unlocks';
import { formatClock, MINUTE_MS } from '../core/session';
import type { Habitat, Tier } from '../plants/types';

/**
 * Pure presentation helpers for the UI (unit-tested in format.test.ts). No DOM.
 */

/** What each reward tier is called in the UI, in tier order. */
export const TIER_WORDS: Readonly<Record<Tier, string>> = {
  1: 'wildflower',
  2: 'perennial',
  3: 'flowering shrub',
  4: 'centrepiece',
};

export const HABITAT_WORDS: Readonly<Record<Habitat, string>> = {
  water: 'on the water',
  shore: 'at the pond’s edge',
  meadow: 'in the meadow',
  path: 'beside the path',
  back: 'on the far bank',
  rock: 'among the stones',
};

/** "on the water · at the pond’s edge" */
export function habitatPhrase(habitats: readonly Habitat[]): string {
  return habitats.map((h) => HABITAT_WORDS[h]).join(' · ');
}

/** Timer face: `24:13`, `1:05:09`. */
export const formatTimer = formatClock;

/** "25 minutes", "1 hour", "1 hour 30 minutes" — for screen readers. */
/**
 * A species name inside a sentence: "your japanese iris" reads wrong, "your Japanese iris" right.
 * Lower-cases the common words, keeps proper adjectives (Japanese).
 */
export function inSentence(name: string): string {
  return name
    .split(' ')
    .map((w) => (w === 'Japanese' ? w : w.toLowerCase()))
    .join(' ');
}

export function spokenMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (rest || !hours) parts.push(`${rest} minute${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** Remaining-time milestones announced to screen readers (minutes), largest first. */
export const MILESTONES_MIN: readonly number[] = [30, 10, 5, 1];

/**
 * The milestone crossed between two readings of the remaining time, if any — so the live region
 * speaks a handful of times per session, never every second. Milestones at or above the goal are
 * skipped (a 10-minute session does not announce "10 minutes left" at its start).
 */
export function crossedMilestone(prevRemainingMs: number, remainingMs: number, goalMs: number): string | null {
  for (const m of MILESTONES_MIN) {
    const t = m * MINUTE_MS;
    if (t >= goalMs) continue;
    if (prevRemainingMs > t && remainingMs <= t) return `${spokenMinutes(m)} left`;
  }
  return null;
}

/** "21 October 2026" in the gardener's locale-neutral long form. */
export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The single quiet line for a creature's first appearance, or null if it is not announced. */
export function faunaArrivalLine(id: string): string | null {
  const f = faunaUnlock(id);
  return f && f.announce ? f.arrival : null;
}

/** Where on screen a tip's anchor lives; at most one tip per group is shown. */
export const TIP_GROUP: Readonly<Record<string, string>> = {
  task: 'sheet',
  duration: 'sheet',
  plan: 'sheet',
  notifications: 'panel',
  water: 'panel',
  switch: 'panel',
  widget: 'menu',
  placement: 'garden',
  swap: 'garden',
  pressed: 'menu',
  sound: 'menu',
  schedule: 'calendar',
};

/** Which relevant tips win when more are active than fit (first = most important); unknown ids last. */
export const TIP_PRIORITY: readonly string[] = [
  'placement',
  'swap',
  'water',
  'task',
  'duration',
  'plan',
  'notifications',
  'switch',
  'widget',
  'pressed',
  'schedule',
  'sound',
];

type Side = 'above' | 'below' | 'left' | 'right';
const TIP_SIDES: Readonly<Record<string, Side[]>> = {
  task: ['right', 'below', 'above'],
  duration: ['right', 'left', 'above'],
  plan: ['right', 'above', 'below'],
  notifications: ['above', 'right'],
  water: ['above', 'right', 'left'],
  switch: ['above', 'left', 'right'],
  widget: ['below', 'left', 'above'],
  placement: ['below', 'above'],
  swap: ['above', 'below', 'right', 'left'],
  pressed: ['below', 'left', 'above'],
  sound: ['below', 'left', 'above'],
  schedule: ['below', 'left', 'above'],
};

/** Preferred sides for a tip's note around its control, best first. */
export function tipSides(id: string): Side[] {
  return TIP_SIDES[id] ?? ['above', 'below', 'right', 'left'];
}

/**
 * Choose the tips to show: by priority, one per screen region, at most `max` (default 1: one
 * quiet note at a time, the rest wait their turn), and only those whose anchor is currently on
 * screen (`anchorAvailable`).
 */
export function pickTips<T extends string>(
  active: readonly { id: T; anchor: string }[],
  anchorAvailable: (anchor: string, id: T) => boolean,
  max = 1,
): T[] {
  const rank = (id: string) => {
    const i = TIP_PRIORITY.indexOf(id);
    return i < 0 ? TIP_PRIORITY.length : i;
  };
  const ordered = [...active].sort((a, b) => rank(a.id) - rank(b.id));
  const groups = new Set<string>();
  const out: T[] = [];
  for (const tip of ordered) {
    if (out.length >= max) break;
    if (!anchorAvailable(tip.anchor, tip.id)) continue;
    const g = TIP_GROUP[tip.id] ?? `own:${tip.id}`;
    if (groups.has(g)) continue;
    groups.add(g);
    out.push(tip.id);
  }
  return out;
}
