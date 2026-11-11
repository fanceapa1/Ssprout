/**
 * The oasis's shared shapes: the walls' faces, the stones, the basin's steps and sluice gate, and
 * the planned palms. Data only, read by the painters, daylight and the wildlife habitat, so the
 * painters stay in their lazy chunk (ADR 0341). docs/systems/scenery.md › Oasis.
 */
import { createRng, type Rng } from '../../core/rng';
import { resample, smoothPath } from '../../paint';
import type { Pt } from '../../render/viewport';
import { rachisPath } from '../../scene/palm-paint';
import { BASIN_WATER } from './geometry';
import { BASIN, BIG_PALMS, GROVE_FROM, SLUICE, WALLS, type Wall } from './layout';

// ── walls and stones ──────────────────────────────────────────────────────────────────────

/** A wall's coping line, extended past its ends by `ext` (so it tucks under the basin or the margins). */
export function copingLine(w: Wall, ext: readonly [number, number]): Pt[] {
  const e = w.edge.map((q) => ({ x: q.x, y: q.y }));
  const a = e[0]!;
  const b = e[1]!;
  const y = e[e.length - 1]!;
  const z = e[e.length - 2]!;
  const pre = { x: a.x - ext[0], y: a.y - ((b.y - a.y) / (b.x - a.x)) * ext[0] };
  const post = { x: y.x + ext[1], y: y.y + ((y.y - z.y) / (y.x - z.x)) * ext[1] };
  return resample(smoothPath([...(ext[0] > 0 ? [pre] : []), ...e, ...(ext[1] > 0 ? [post] : [])], 8), 6);
}

/** The pisé walls' faces, for daylight (O5): each a closed outline, coping first. */
export const WALL_FACES: readonly Pt[][] = WALLS.map((w, i) => {
  const top = copingLine(w, i === 0 ? [44, 0] : [0, 18]);
  return [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + w.h }))];
});

/** Stones fallen with the earth into the basin's near-left corner, and the near ground's stones: foot x, y, width (h = 0.6 w, 0.52 w). */
export const FALLEN_STONES: readonly (readonly [number, number, number])[] = [[500, 652, 12], [488, 640, 9], [509, 628, 8]];
export const NEAR_STONES: readonly (readonly [number, number, number])[] = [[40, 1000, 64], [1160, 1004, 46], [470, 680, 22], [1000, 990, 22], [1230, 740, 18]];

// ── the basin's steps and sluice gate ─────────────────────────────────────────────────────

const [FR, NR] = [BASIN[1]!, BASIN[2]!];
const [WFR, WNR] = [BASIN_WATER[1]!, BASIN_WATER[2]!];
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** A point on the right wall's water edge, `t` from the far corner to the near one. */
const rightWall = (t: number): Pt => lerp(WFR, WNR, t);

/** The steps down into the water, against the right wall near its far corner: tread, riser, how deep. */
export const BASIN_STEPS: readonly { tread: Pt[]; riser: Pt[]; depth: number }[] = (() => {
  const out: { tread: Pt[]; riser: Pt[]; depth: number }[] = [];
  const rise = 4;
  for (let k = 0; k < 5; k++) {
    const a = rightWall(0.07 + k * 0.085);
    const b = rightWall(0.07 + (k + 1) * 0.085);
    const d = 34 - k * 1.5;
    const y = k * rise - 3;
    out.push({
      tread: [{ x: a.x + 3, y: a.y + y }, { x: b.x + 3, y: b.y + y }, { x: b.x - d, y: b.y + y }, { x: a.x - d, y: a.y + y }],
      riser: [{ x: b.x + 3, y: b.y + y }, { x: b.x - d, y: b.y + y }, { x: b.x - d, y: b.y + y + rise }, { x: b.x + 3, y: b.y + y + rise }],
      depth: k - 1.5,
    });
  }
  return out;
})();

/** A point on the board's outer side carried `d` down the sluice's head. */
const down = (q: Pt, d: number): Pt => {
  const [a, b] = [SLUICE[0]!, SLUICE[1]!];
  const n = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: q.x + 5 + ((b.x - a.x) / n) * d, y: q.y + ((b.y - a.y) / n) * d };
};
const FOAM_DOWN = 10;

/**
 * The sluice gate near the overflow corner: a cut through the right coping between `t0` and `t1`
 * along the wall, an upright stone post either side, and the board standing in their slots.
 */
export const SLUICE_GATE = (() => {
  const [t0, t1] = [0.78, 0.955];
  const inner = (t: number) => lerp(WFR, WNR, t);
  const outer = (t: number) => lerp(FR, NR, t);
  const mid = (t: number) => lerp(inner(t), outer(t), 0.55);
  const post = (t: number): Pt[] => {
    const c = mid(t);
    return [{ x: c.x - 4, y: c.y - 10 }, { x: c.x + 4, y: c.y - 10 }, { x: c.x + 4.5, y: c.y + 3 }, { x: c.x - 4.5, y: c.y + 3 }];
  };
  const [b0, b1] = [mid(t0 + 0.005), mid(t1 - 0.005)];
  return {
    cut: [inner(t0), outer(t0), outer(t1), inner(t1)],
    posts: [post(t0 - 0.025), post(t1 + 0.025)],
    board: [{ x: b0.x - 1.5, y: b0.y - 4 }, { x: b0.x + 2, y: b0.y - 4 }, { x: b1.x + 2, y: b1.y + 1 }, { x: b1.x - 1.5, y: b1.y + 1 }],
    /** the thin spill over the board, on its outer side */
    spill: [{ x: b0.x + 2, y: b0.y - 3 }, { x: b0.x + 5, y: b0.y - 2 }, { x: b1.x + 5, y: b1.y + 2 }, { x: b1.x + 2, y: b1.y + 1 }],
    /** where the spill's foam lies: across the sluice's head, a little downstream of the spill, clear of the posts */
    foam: [down(lerp(b0, b1, 0.05), FOAM_DOWN), down(lerp(b0, b1, 0.8), FOAM_DOWN)] as [Pt, Pt],
  };
})();

// ── the palms ─────────────────────────────────────────────────────────────────────────────

const UP = -Math.PI / 2;

export interface PalmFrond {
  path: Pt[];
  side: number;
  age: number;
  front: boolean;
  dry: number;
  len: number;
}

/** A palm's plan: its trunk (base first), width, fronds, and the crown's outline for daylight. */
export interface PalmShape {
  base: Pt;
  top: Pt;
  trunk: Pt[];
  width: number;
  fronds: PalmFrond[];
  crown: Pt[];
  /** 0 the nearest … 1 the haziest */
  far: number;
}

function trunkPath(base: Pt, top: Pt, bow: number): Pt[] {
  const ctrl = { x: (base.x + top.x) / 2 + bow, y: (base.y + top.y) / 2 };
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const a = (1 - t) * (1 - t);
    const b = 2 * t * (1 - t);
    const c = t * t;
    return { x: a * base.x + b * ctrl.x + c * top.x, y: a * base.y + b * ctrl.y + c * top.y };
  });
}

/** The crown's outline: the furthest reach of its fronds in each of 24 directions round the top. */
function crownOutline(top: Pt, fronds: readonly PalmFrond[], pad: number): Pt[] {
  const n = 24;
  const reach = new Array<number>(n).fill(pad);
  for (const f of fronds) {
    for (const q of f.path) {
      const a = Math.atan2(q.y - top.y, q.x - top.x);
      const i = ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n;
      reach[i] = Math.max(reach[i]!, Math.hypot(q.x - top.x, q.y - top.y) + pad);
    }
  }
  // fill gaps between sectors so the outline stays closed and round
  const r = reach.map((v, i) => Math.max(v, (reach[(i + n - 1) % n]! + reach[(i + 1) % n]!) * 0.4));
  return r.map((v, i) => ({ x: top.x + Math.cos((i / n) * Math.PI * 2) * v, y: top.y + Math.sin((i / n) * Math.PI * 2) * v }));
}

/** Plan a palm from its base to its crown: `len` is its longest frond. */
export function planPalm(base: Pt, top: Pt, len: number, width: number, rng: Rng, far = 0): PalmShape {
  const trunk = trunkPath(base, top, rng.range(-0.08, 0.08) * (base.y - top.y));
  const fronds: PalmFrond[] = [];
  const n = rng.int(20, 26);
  for (let i = 0; i < n; i++) {
    const age = i / (n - 1);
    const side = i === 0 ? (rng.chance(0.5) ? 1 : -1) : i % 2 === 0 ? 1 : -1;
    const tilt = (0.1 + 1.7 * age ** 0.9) * rng.range(0.82, 1.12) + rng.gaussian(0, 0.06);
    const toward = i > 2 && rng.chance(0.3);
    const l = len * rng.range(0.75, 1) * (1 - 0.2 * (1 - age) ** 2) * (toward ? rng.range(0.5, 0.72) : 1);
    const path = rachisPath({ from: top, heading: UP + side * Math.min(1.85, tilt), length: l, bend: (0.25 + 1.9 * age ** 1.5) * rng.range(0.85, 1.15) * (toward ? 1.3 : 1), side }, 14);
    fronds.push({ path, side, age, front: i === 0 || toward || rng.chance(0.5), dry: age > 0.9 && !toward ? rng.range(0.45, 0.85) : 0, len: l });
  }
  return { base, top, trunk, width, fronds, crown: crownOutline(top, fronds, len * 0.12), far };
}

/** The big palms on the right (`BIG_PALMS`), planned from fixed seeds so daylight reads the same shapes. */
export const BIG_PALM_SHAPES: readonly PalmShape[] = BIG_PALMS.map((b, i) => planPalm(b.base, b.top, 66 * b.size, 14 * b.size, createRng(`oasis-big-palm-${i}`)));

/** The grove's palms, back row first: hazy and small behind, warmer and nearer in front. */
export const GROVE_PALMS: readonly PalmShape[] = (() => {
  const rng = createRng('oasis-grove-palms');
  const rows = [
    { step: [38, 64], top: [292, 322], base: 452, len: [40, 52], far: 0.75 },
    { step: [70, 110], top: [246, 292], base: 462, len: [56, 74], far: 0.4 },
  ];
  const out: PalmShape[] = [];
  for (const row of rows) {
    for (let x = GROVE_FROM + rng.range(-10, 30); x < 1650; x += rng.range(row.step[0]!, row.step[1]!)) {
      const top = { x, y: rng.range(row.top[0]!, row.top[1]!) };
      const base = { x: x + rng.range(-16, 16), y: row.base + rng.range(-4, 6) };
      const len = rng.range(row.len[0]!, row.len[1]!);
      out.push(planPalm(base, top, len, len * 0.12, rng.fork(`palm-${Math.round(x)}`), row.far));
    }
  }
  return out;
})();
