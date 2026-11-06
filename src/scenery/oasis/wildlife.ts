/**
 * Where the oasis's wildlife lives (ADR 0248, 0304): the still basin, the moving channels and
 * oued, perches on the terrace walls, the basin's rim, the palms' fronds, a ksar tower, the gate
 * posts and stones, the damp plots, the wall faces and the heron's stands, and the terrace-aware
 * perspective. docs/systems/fauna.md › The oasis.
 */
import type { SceneryFauna } from '../../fauna/habitat';
import { closestOnPolygon, pointInPolygon } from '../../fauna/math';
import { perchesOf, wallTopAt, type GroundSpot, type Perch, type Stand, type WallFace } from '../../fauna/targets';
import type { Pt } from '../../render/viewport';
import { perspectiveScale } from '../../scene/slots';
import { OASIS_FAUNA } from './fauna';
import { BASIN_WATER, OUED_WATER, SEGUIA, SLUICE_WATER } from './geometry';
import { FOOTING, KSAR_SHAPES } from './ksar';
import { BAR, BASIN, BASIN_RIM, BASIN_VP, LIFT, SEGUIA_FALLS, towardVp, WALLS, type Terrace } from './layout';
import { FALLEN_STONES, NEAR_STONES, WALL_FACES } from './paint-land';
import { BASIN_STEPS, SLUICE_GATE } from './paint-water';
import { BIG_PALM_SHAPES, GROVE_PALMS, type PalmShape } from './paint-veg';
import { OASIS_SLOTS } from './slots';

// ── perspective ─────────────────────────────────────────────────────────────────────────────

/** The terrace walls' faces, each with the terrace its coping holds (ADR 0300). */
const TERRACE_WALLS: readonly { id: string; face: WallFace; terrace: Terrace }[] = (
  [
    [1, 'high'],
    [2, 'middle'],
    [0, 'grove'],
  ] as const
).map(([i, terrace]) => {
  const outline = WALL_FACES[i]!;
  return { id: `wall-${terrace}`, terrace, face: { id: `wall-${terrace}`, outline: outline.map((q) => ({ ...q })), top: outline.slice(0, outline.length / 2), h: WALLS[i]!.h } };
});

const [FL, , NR, NL] = BASIN as readonly [Pt, Pt, Pt, Pt];

/** The basin's near face: the stone a lizard can sit on above the plots. */
const BASIN_FACE: WallFace = {
  id: 'basin-face',
  outline: [NL, NR, { x: NR.x - 3, y: NR.y + BASIN_RIM.face }, { x: NL.x + 3, y: NL.y + BASIN_RIM.face }].map((q) => ({ ...q })),
  top: [{ ...NL }, { ...NR }],
  h: BASIN_RIM.face,
};

/**
 * Perspective at a world point, as the slots take it: the basin terrace's `perspectiveScale(y)`,
 * a raised terrace (and its wall's coping) `perspectiveScale(y + lift)`, a wall face its coping's
 * scale all the way down, the basin's near face its rim's. Continuous: each lift is the wall's drop.
 */
export function oasisPerspective(x: number, y: number): number {
  for (const w of TERRACE_WALLS) {
    const t = w.face.top;
    if (x < t[0]!.x || x > t[t.length - 1]!.x) continue;
    const top = wallTopAt(w.face, x);
    if (y <= top) return perspectiveScale(y + LIFT[w.terrace]);
    if (y <= top + w.face.h) return perspectiveScale(top + LIFT[w.terrace]);
  }
  if (x >= NL.x && x <= NR.x && y > NL.y && y <= NL.y + BASIN_RIM.face) return perspectiveScale(NL.y);
  return perspectiveScale(y);
}

/**
 * The ksar's own measure (ADR 0304): its middle tower (150 units) reads as a pisé tower of about
 * 8 m, so a stork about a metre tall stands at this scale on it, not at the ground's 0.55.
 */
export const KSAR_SCALE = 0.15;

// ── perches ─────────────────────────────────────────────────────────────────────────────────

const round = (v: number) => Math.round(v * 10) / 10;

/** A palm's ground scale: its foot's, lifted when it stands on the grove's terrace. */
function palmScale(palm: PalmShape): number {
  return oasisPerspective(palm.base.x, palm.base.y);
}

/** Is `q` hidden by a big palm (painted over everything behind it but the near ground), other than `except`? */
function behindPalm(q: Pt, except?: PalmShape): boolean {
  for (const s of BIG_PALM_SHAPES) {
    if (s === except) continue;
    if (pointInPolygon(q, s.crown)) return true;
    if (s.trunk.some((t) => Math.abs(t.x - q.x) < s.width * 0.9 + 6 && Math.abs(t.y - q.y) < 12)) return true;
  }
  return false;
}

/**
 * Perches along a palm's front, green fronds: on the arch where the rachis runs near level, a
 * quarter to four fifths out, at most `n` of them and 36 units apart, none hidden by a nearer palm.
 */
function frondPerches(palm: PalmShape, id: string, n: number): Perch[] {
  const depth = round(palm.base.y + 1);
  const scale = palmScale(palm);
  const best: { q: Pt; slope: number; spread: number; side: number }[] = [];
  for (const f of palm.fronds) {
    if (!f.front || f.dry > 0) continue;
    let pick: (typeof best)[number] | null = null;
    for (let i = 4; i <= 11; i++) {
      const a = f.path[i - 1]!;
      const b = f.path[i + 1]!;
      const q = f.path[i]!;
      const dx = b.x - a.x;
      if (Math.abs(dx) < 2) continue;
      const slope = (b.y - a.y) / dx;
      if (Math.abs(slope) > 0.45 || q.y < 50 || q.x < 20 || q.x > 1580 || behindPalm(q, palm)) continue;
      if (!pick || Math.abs(slope) < Math.abs(pick.slope)) pick = { q, slope, spread: Math.abs(dx) * 0.4, side: f.side };
    }
    if (pick) best.push(pick);
  }
  best.sort((a, b) => Math.abs(a.slope) - Math.abs(b.slope));
  const out: Perch[] = [];
  for (const c of best) {
    if (out.length >= n) break;
    if (out.some((p) => Math.hypot(p.x - c.q.x, p.y - c.q.y) < 36)) continue;
    out.push({ id: `${id}-${out.length + 1}`, kind: 'frond', x: round(c.q.x), y: round(c.q.y), spread: round(c.spread), dome: 0, depth, slope: Math.round(c.slope * 100) / 100, scale });
  }
  return out;
}

/** The grove's near row (the far row is haze): the palms standing behind the grove wall. */
const NEAR_GROVE = GROVE_PALMS.filter((s) => s.far < 0.5);

/** Along each terrace wall's coping every ~70 units, clear of the seguia's falls, the wall slots and nearer palms. */
function copingPerches(): Perch[] {
  const out: Perch[] = [];
  const wallSlots = OASIS_SLOTS.filter((s) => s.id.startsWith('wall-'));
  for (const w of TERRACE_WALLS) {
    const t = w.face.top;
    const [x0, x1] = [Math.max(10, t[0]!.x + 24), Math.min(1590, t[t.length - 1]!.x - 24)];
    let k = 0;
    for (let x = x0; x <= x1; x += 70) {
      const y = wallTopAt(w.face, x);
      if (SEGUIA_FALLS.some((f) => Math.abs(f.top.x - x) < 30 && Math.abs(f.top.y - y) < 20)) continue;
      if (wallSlots.some((s) => Math.abs(s.x - x) < 26 && Math.abs(s.y - y) < 20)) continue;
      if (behindPalm({ x, y: y - 6 })) continue;
      const slope = (wallTopAt(w.face, x + 10) - wallTopAt(w.face, x - 10)) / 20;
      out.push({ id: `${w.id}-${++k}`, kind: 'wall', x: round(x), y: round(y), spread: 24, dome: 0, depth: round(y + 1), slope: round(slope * 100) / 100 });
    }
  }
  return out;
}

/** The basin's coping: the near rim's top, the far rim's sliver, a stretch of each side coping (clear of the inlet and the gate). */
function rimPerches(): Perch[] {
  const near = NL.y - BASIN_RIM.near * 0.45;
  const far = FL.y + BASIN_RIM.far * 0.4;
  const out: Perch[] = [
    ...[580, 720, 880, 1030].map((x, i): Perch => ({ id: `rim-near-${i + 1}`, kind: 'rim', x, y: round(near), spread: 34, dome: 0, depth: NL.y + 1 })),
    ...[660, 800, 950].map((x, i): Perch => ({ id: `rim-far-${i + 1}`, kind: 'rim', x, y: round(far), spread: 26, dome: 0, depth: round(FL.y + BASIN_RIM.far + 1) })),
  ];
  // the side copings run toward the vanishing point: steep, so a short spread along their slope
  const side = (id: string, outer: number, y: number): Perch => {
    const mid = outer + (outer < 810 ? 1 : -1) * BASIN_RIM.side * 0.5;
    const x = towardVp(mid, y);
    const slope = (BASIN_VP.y - y) / (BASIN_VP.x - x);
    return { id, kind: 'rim', x: round(x), y, spread: 5, dome: 0, depth: y + 1, slope: Math.round(slope * 100) / 100 };
  };
  out.push(side('rim-left', NL.x, 624), side('rim-right', NR.x, 596));
  return out;
}

/** The tower the stork takes (the tallest, in the middle of the skyline), and its nest: where the stork task paints it. */
const NEST_TOWER = KSAR_SHAPES.find((s) => s.block.id === 'tower-mid')!;
export const NEST = (() => {
  const b = NEST_TOWER.block;
  return { x: b.x + b.w / 2, y: b.base - b.h - 10, w: 30, towerId: b.id };
})();

const towerPerch: Perch = {
  id: 'tower-nest',
  kind: 'tower',
  x: NEST.x,
  y: NEST.y,
  spread: NEST.w * 0.35,
  dome: 0,
  depth: NEST_TOWER.block.base + FOOTING + 1,
  scale: KSAR_SCALE,
};

/** The sluice gate's two stone posts: a tip over the water for the dropwing. */
const postPerches: Perch[] = SLUICE_GATE.posts.map((post, i) => {
  const x = (post[0]!.x + post[1]!.x) / 2;
  const y = Math.min(post[0]!.y, post[1]!.y);
  return { id: `gate-post-${i + 1}`, kind: 'post', x: round(x), y: round(y), spread: 2.5, dome: 0, depth: round(Math.max(post[2]!.y, post[3]!.y) + 1) };
});

/** The painted stones a bird or a dragonfly may stand on: the basin corner's and the near ground's, not those at the frame's foot. */
const stonePerches: Perch[] = perchesOf({
  rocks: [...FALLEN_STONES.map(([x, y, w]) => ({ x, y, w, h: w * 0.6 })), ...NEAR_STONES.filter(([, y]) => y < 990).map(([x, y, w]) => ({ x, y, w, h: w * 0.52 }))].map((r) => ({ id: `stone-${r.x}-${r.y}`, ...r, perch: true })),
  path: [],
});

export const OASIS_PERCHES: Perch[] = [
  ...copingPerches(),
  ...rimPerches(),
  ...BIG_PALM_SHAPES.flatMap((s, i) => frondPerches(s, `palm-${i + 1}`, 3)),
  ...NEAR_GROVE.flatMap((s) => frondPerches(s, `grove-${Math.round(s.top.x)}`, 1)),
  towerPerch,
  ...postPerches,
  ...stonePerches,
];

// ── ground, walls, stands ───────────────────────────────────────────────────────────────────

/** Where the hoopoe walks: the watered side of each near plot, and a watered strip on each raised terrace. */
export const OASIS_GROUND: GroundSpot[] = [
  { id: 'plot-west', x: 190, y: 840, rx: 70, ry: 22 },
  { id: 'plot-mid', x: 560, y: 860, rx: 90, ry: 26 },
  { id: 'plot-east', x: 1080, y: 850, rx: 80, ry: 24 },
  { id: 'terrace-middle', x: 300, y: 560, rx: 60, ry: 10 },
  { id: 'terrace-high', x: 290, y: 478, rx: 50, ry: 7 },
];

/** The faces a gecko clings to: the three pisé terrace walls and the basin's near face (the ksar is too far: ADR 0304). */
export const OASIS_WALLS: WallFace[] = [...TERRACE_WALLS.map((w) => w.face), BASIN_FACE];

/**
 * Where the heron fishes: on the basin's submerged steps (the third and fourth treads), and in
 * the oued's shallows either side of the sand bar and above it, facing the water.
 */
export const OASIS_STANDS: Stand[] = [
  ...[2, 3].map((k): Stand => {
    const t = BASIN_STEPS[k]!.tread;
    return { x: round((t[0]!.x + t[1]!.x + t[2]!.x + t[3]!.x) / 4), y: round((t[0]!.y + t[1]!.y + t[2]!.y + t[3]!.y) / 4), facing: -1 };
  }),
  { x: 1322, y: 790, facing: 1 },
  { x: 1488, y: 792, facing: -1 },
  { x: 1450, y: 676, facing: -1 },
];

/** Is a point in the oued's water and off its sand bar? (tests, and the heron's stands) */
export function inOued(q: Pt): boolean {
  return pointInPolygon(q, OUED_WATER) && ((q.x - BAR.cx) / BAR.rx) ** 2 + ((q.y - BAR.cy) / BAR.ry) ** 2 > 1;
}

/** How far a point lies inside the basin's water (negative: outside). */
export function intoBasin(q: Pt): number {
  const d = closestOnPolygon(q, BASIN_WATER).d;
  return pointInPolygon(q, BASIN_WATER) ? d : -d;
}

/** What the oasis tells its wildlife: the basin still, the channels and the oued moving, perches, plots, walls, stands. */
export const OASIS_WILDLIFE: SceneryFauna = {
  unlocks: OASIS_FAUNA,
  water: { still: BASIN_WATER, moving: [...SEGUIA, SLUICE_WATER, OUED_WATER] },
  perches: OASIS_PERCHES,
  ground: OASIS_GROUND,
  walls: OASIS_WALLS,
  stands: OASIS_STANDS,
  perspective: oasisPerspective,
};
