import { faunaRow } from '../core/fauna-unlocks';
import type { SceneryId } from '../core/sceneries';
import { faunaTable } from '../scenery/fauna';
import { formatClock, MINUTE_MS } from '../core/session';
import { fitsSite, SITES, type Habitat, type Site, type SpeciesDef, type Tier } from '../plants/types';
import { GARDEN_HABITAT_WORDS } from '../scenery/japanese-garden/flora';

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

/** "on the water · at the pond’s edge" */
export function habitatPhrase(habitats: readonly Habitat[], words: Readonly<Record<Habitat, string>> = GARDEN_HABITAT_WORDS): string {
  return habitats.map((h) => words[h]).join(' · ');
}

/** How a site is named where a habitat's word is too broad for it (ADR 0386). */
export const SITE_WORDS: Readonly<Record<Site, string>> = {
  wall: 'on the walls',
  ledge: 'on the rock ledge',
  'sea-rock': 'on the splash rocks',
  beach: 'on the beach',
};

/** Where a slot is, in the garden's words: its site's when it has one, else its habitat's. */
export function slotPlace(slot: { habitat: Habitat; site?: Site }, words: Readonly<Record<Habitat, string>> = GARDEN_HABITAT_WORDS): string {
  return slot.site ? SITE_WORDS[slot.site] : words[slot.habitat];
}

/**
 * The planting sheet's habitat line: each habitat with a slot the species fits, in the garden's
 * words; a habitat whose sites it takes only some of is named by those sites (ADR 0386).
 */
export function placesPhrase(
  def: Pick<SpeciesDef, 'habitats' | 'sites'>,
  slots: readonly { habitat: Habitat; site?: Site }[],
  words: Readonly<Record<Habitat, string>> = GARDEN_HABITAT_WORDS,
): string {
  const parts: string[] = [];
  for (const habitat of def.habitats) {
    const all = slots.filter((s) => s.habitat === habitat);
    const fit = all.filter((s) => fitsSite(def, s));
    if (fit.length === 0) continue;
    const sites = new Set(fit.map((s) => s.site));
    const some = !sites.has(undefined) && [...new Set(all.map((s) => s.site))].some((s) => !sites.has(s));
    if (some) parts.push(...SITES.filter((s) => sites.has(s)).map((s) => SITE_WORDS[s]));
    else parts.push(words[habitat]);
  }
  return [...new Set(parts)].join(' · ');
}

/** Timer face: `24:13`, `1:05:09`. */
export const formatTimer = formatClock;

/** Proper words a name keeps capitalised inside a sentence. */
const PROPER = new Set(['Japanese', 'Greek', 'Mediterranean', 'Aleppo', 'Jerusalem']);

/**
 * A species or garden name inside a sentence: "your japanese iris" reads wrong, "your Japanese
 * iris" right. Lower-cases the common words, keeps proper adjectives and names (`PROPER`).
 */
export function inSentence(name: string): string {
  return name
    .split(' ')
    .map((w) => (PROPER.has(w) ? w : w.toLowerCase()))
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

/** The single quiet line for a creature's first appearance in a garden, or null if it is not announced. */
export function faunaArrivalLine(sceneryId: SceneryId, id: string): string | null {
  const f = faunaRow(faunaTable(sceneryId), id);
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
