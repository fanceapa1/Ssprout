/**
 * Eviction tiers of the paint cache, from an entry's kind and key alone (ADR 0351).
 * The tiers and the key shapes they read are in docs/systems/paint.md › Persistence.
 */
import type { EntryMeta } from './persist';

export const TIER = { DETAIL: 0, PLATES: 1, LANDSCAPE: 2 } as const;
export type Tier = (typeof TIER)[keyof typeof TIER];

/** The cache kinds the tiers know (`SCENE_CACHE`, `SKY_PLATE_KIND`, `LIGHT_PLATE_KIND`, `THUMB_KIND`). */
export const TIER_KINDS = {
  overview: 'scene',
  sprites: 'scene-sprites',
  thumb: 'scenery-thumb',
  plates: ['sky-plate', 'light-plate'],
} as const;

const garden = (key: string): string => key.split('|', 1)[0] ?? key;

/**
 * The sprites key of an overview's scale: `garden|sSEED|quality|x,y,w,h@scale|WxH` gives
 * `garden|sSEED|quality@scale` (`paintingKey` and `spritesKey`).
 */
export function spritesKeyOf(overviewKey: string): string | null {
  const [g, seed, quality, rect] = overviewKey.split('|');
  const at = rect?.lastIndexOf('@') ?? -1;
  return rect !== undefined && at >= 0 ? `${g}|${seed}|${quality}${rect.slice(at)}` : null;
}

/** Each entry's tier, by id. */
export function tiers(entries: Iterable<EntryMeta>): Map<string, Tier> {
  const all = [...entries];
  const latest = new Map<string, EntryMeta>();
  for (const m of all) {
    if (m.kind !== TIER_KINDS.overview) continue;
    const g = garden(m.key);
    const was = latest.get(g);
    if (!was || m.used > was.used) latest.set(g, m);
  }
  const baseSprites = new Set<string>();
  for (const m of latest.values()) {
    const k = spritesKeyOf(m.key);
    if (k) baseSprites.add(k);
  }
  const out = new Map<string, Tier>();
  for (const m of all) {
    let t: Tier = TIER.DETAIL;
    if (m.kind === TIER_KINDS.overview) t = baseSprites.has(spritesKeyOf(m.key) ?? '') ? TIER.LANDSCAPE : TIER.DETAIL;
    else if (m.kind === TIER_KINDS.sprites) t = baseSprites.has(m.key) ? TIER.LANDSCAPE : TIER.DETAIL;
    else if (m.kind === TIER_KINDS.thumb) t = TIER.LANDSCAPE;
    else if ((TIER_KINDS.plates as readonly string[]).includes(m.kind)) t = TIER.PLATES;
    out.set(m.id, t);
  }
  return out;
}

/**
 * The ids to evict so `incoming` (or nothing, on open) fits: lowest tier first, then least
 * recently used. Only `incoming`'s tier or lower may go; null when that cannot make room.
 */
export function victims(entries: Iterable<EntryMeta>, maxBytes: number, incoming: EntryMeta | null = null): string[] | null {
  const held = [...entries].filter((m) => m.id !== incoming?.id);
  let total = held.reduce((s, m) => s + m.bytes, 0) + (incoming?.bytes ?? 0);
  if (total <= maxBytes) return [];
  const tier = tiers(incoming ? [...held, incoming] : held);
  const ceiling = incoming ? tier.get(incoming.id)! : TIER.LANDSCAPE;
  const order = held.filter((m) => tier.get(m.id)! <= ceiling).sort((a, b) => tier.get(a.id)! - tier.get(b.id)! || a.used - b.used);
  const out: string[] = [];
  for (const m of order) {
    if (total <= maxBytes) break;
    out.push(m.id);
    total -= m.bytes;
  }
  return total <= maxBytes ? out : null;
}
