/**
 * Seeded randomness. The only place randomness may come from (no Math.random elsewhere).
 * mulberry32 core; string seeds are hashed to 32 bits.
 */
export interface Rng {
  /** The 32-bit seed this stream was created from. */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** Uniformly chosen element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Shuffled copy (Fisher–Yates); the input is not modified. */
  shuffle<T>(items: readonly T[]): T[];
  /** Normally distributed value (Box–Muller). */
  gaussian(mean?: number, sd?: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /**
   * Independent sub-stream derived from this stream's *seed* and `label` (not from its current
   * position), so adding draws to one stream never shifts another.
   */
  fork(label: string): Rng;
}

/** 32-bit string hash (FNV-1a followed by a murmur3 finaliser for good avalanche). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}

function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Normalise a numeric or string seed to an unsigned 32-bit integer. */
export function toSeed(seed: number | string): number {
  if (typeof seed === 'string') return hashString(seed);
  if (!Number.isFinite(seed)) throw new RangeError(`invalid seed ${seed}`);
  // Fold the full float (including fractional/large values) into 32 bits.
  return fmix32((Math.trunc(seed) ^ Math.trunc(seed / 0x100000000)) >>> 0);
}

export function createRng(seed: number | string): Rng {
  const s32 = toSeed(seed);
  let a = s32;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(next() * (hi - lo + 1));
  };

  return {
    seed: s32,
    next,
    range: (min, max) => min + next() * (max - min),
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('pick from empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
    gaussian(mean = 0, sd = 1) {
      const u = 1 - next(); // (0, 1]
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    chance: (p) => next() < p,
    fork: (label) => createRng(fmix32((s32 ^ hashString(label)) + 0x9e3779b9)),
  };
}
