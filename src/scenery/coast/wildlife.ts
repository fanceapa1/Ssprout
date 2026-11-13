/**
 * Where the coast's wildlife lives (ADR 0248, 0373), read by name from the coast's data modules:
 * perches (copings, the olive's and pine's limbs, the jars, the splash rocks, the temple, the
 * caique, the far pines and the cliff's ledges), walks and scrub, the wall and splash-rock faces,
 * the shallows, the rock pools, the far bay, the air over the cove and the bark, the heron's stands,
 * the caique as a carrier, and the terrace-aware perspective. docs/systems/fauna.md › The coast.
 */
import type { SceneryFauna } from '../../fauna/habitat';
import { distanceToPolygon, pointInPolygon, polygonBounds } from '../../fauna/math';
import { wallTopAt, type Carrier, type GroundSpot, type Perch, type Region, type Stand, type WallFace } from '../../fauna/targets';
import type { Pt } from '../../render/viewport';
import { perspectiveScale } from '../../scene/slots';
import { COAST_FAUNA } from './fauna';
import { POOL_WATER, SEA_WATER } from './geometry';
import {
  ARCHITRAVE, BEACH, CAIQUE, COAST_SKY_LAYOUT, COLUMN_W, COLUMNS, DRUM, HORIZON, LAND, LIFT, OLIVE, PATH, PINE, PROMONTORY, SHORE_SCRUB, skylineAt,
  STYLOBATE, TEMPLE_SHAPES, WALL_TERRACE, WALLS, WATERLINE_EDGE,
} from './layout';
import { CAIQUE_BOX, CAIQUE_SHAPES, DEPTH, shoreContour } from './sea';
import {
  BEDS, copingY, FLIGHTS, JARS, MAQUIS, OLIVE_LIMBS, PHRYGANA, PINE_BRANCHES, PINE_PADS, PINE_ROCK, PINE_TRUNK, PROMONTORY_PINE_SHAPES, promontoryTop, SHORE_BOULDER_SHAPES,
  SPLASH_ROCK_SHAPES, WALL_TOPS, wallDrop,
} from './shapes';
import { COAST_SLOTS } from './slots';

const round = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

// ── perspective ─────────────────────────────────────────────────────────────────────────────

/**
 * Perspective at a world point, as the slots take it (ADR 0360): on the land a terrace and its
 * coping take the terrace's lift, a wall face its coping's scale down to its foot; the sea, the
 * beach, the shelf and the foreground `perspectiveScale(y)`. Left of a wall's seaward end (the
 * shelf, the bastion) the terrace runs down to where the wall's foot would be.
 */
export function coastPerspective(x: number, y: number): number {
  if (!pointInPolygon({ x, y }, LAND)) return perspectiveScale(y);
  for (let i = 0; i < WALLS.length; i++) {
    const lift = LIFT[WALL_TERRACE[i]!];
    const top = copingY(i, x);
    if (y <= top) return perspectiveScale(y + lift);
    if (x >= WALLS[i]!.edge[0]!.x) {
      if (y <= top + wallDrop(i, x)) return perspectiveScale(top + lift);
    } else if (y <= top + WALLS[i]!.h) return perspectiveScale(y + lift);
  }
  return perspectiveScale(y);
}

/**
 * The far things' own measure (ADR 0373), as the oasis's `KSAR_SCALE` (0.15 for 18.75 units a
 * metre): a creature's scale is 0.008 per unit a metre of what it stands on.
 */
const measure = (units: number, metres: number) => round2((units / metres) * 0.008);

/** The temple and its promontory: the tall columns read as Doric shafts about 6 m high. */
export const TEMPLE_SCALE = measure(Math.max(...COLUMNS.map((c) => c.h)), 6);

/** The caique: its hull reads as a 7 m fishing boat. */
const HULL = polygonBounds(CAIQUE_SHAPES.hull);
export const CAIQUE_MEASURE = measure(HULL.w, 7);

/** The sea plane's scale at y (far out): the caique's measure, falling to nothing at the horizon. */
export const seaScale = (y: number): number => round2((CAIQUE_MEASURE * Math.max(0, y - HORIZON)) / (CAIQUE.y - HORIZON));

// ── perches ─────────────────────────────────────────────────────────────────────────────────

/** Is a perch at `q` clear of every planting slot? */
const offSlots = (q: Pt, gap = 20): boolean => COAST_SLOTS.every((s) => Math.hypot(s.x - q.x, s.y - q.y) >= gap);
const inFrame = (q: Pt): boolean => q.x >= 10 && q.x <= 1590 && q.y >= 20 && q.y <= 990;

/** The olive's crown as the layout gives it, a little larger: what stands behind it is hidden. */
const behindOlive = (q: Pt): boolean => ((q.x - OLIVE.crown.x) / (OLIVE.rx * 1.1)) ** 2 + ((q.y - OLIVE.crown.y) / (OLIVE.ry * 1.1)) ** 2 < 1;

/** The face of each wall as a `WallFace` along its coping (`WALL_TOPS`), where it stands full height. */
function terraceFace(i: number): WallFace {
  const w = WALLS[i]!;
  const x0 = w.edge[0]!.x + 60;
  const top = WALL_TOPS[i]!.filter((q) => q.x >= x0 && q.x <= 1600).map((q) => ({ ...q }));
  return { id: `wall-${WALL_TERRACE[i]}`, outline: [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + w.h }))], top, h: w.h };
}
const TERRACE_FACES: readonly WallFace[] = WALLS.map((_, i) => terraceFace(i));

/** Along each coping every ~70 units, where the wall stands full height, clear of the flights and the slots. */
function copingPerches(): Perch[] {
  const out: Perch[] = [];
  TERRACE_FACES.forEach((face) => {
    const t = face.top;
    let k = 0;
    for (let x = t[0]!.x + 12; x <= Math.min(1590, t[t.length - 1]!.x - 12); x += 70) {
      const y = wallTopAt(face, x);
      if (!offSlots({ x, y }, 26)) continue;
      if (FLIGHTS.some((f) => f.some((s) => x > s.tread[0]!.x - 12 && x < s.tread[1]!.x + 12 && Math.abs(s.tread[0]!.y - y) < 40))) continue;
      const slope = (wallTopAt(face, x + 10) - wallTopAt(face, x - 10)) / 20;
      out.push({ id: `${face.id}-${++k}`, kind: 'wall', x: round(x), y: round(y), spread: 22, dome: 0, depth: round(y + 1), slope: round2(slope) });
    }
  });
  return out;
}

/** Up to `n` perches on a limb's flattest stretches (|slope| ≤ `steep`), 24 apart, each at its tree's scale. */
function limbPerches(limb: readonly Pt[], id: string, n: number, steep: number, scale: number, depth: number): Perch[] {
  const segs: { q: Pt; slope: number; spread: number }[] = [];
  for (let i = 1; i < limb.length; i++) {
    const a = limb[i - 1]!;
    const b = limb[i]!;
    const dx = b.x - a.x;
    if (Math.abs(dx) < 4) continue;
    const slope = (b.y - a.y) / dx;
    const q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (Math.abs(slope) > steep || !inFrame(q) || !offSlots(q)) continue;
    segs.push({ q, slope, spread: Math.min(8, Math.abs(dx) * 0.35) });
  }
  segs.sort((a, b) => Math.abs(a.slope) - Math.abs(b.slope));
  const out: Perch[] = [];
  for (const s of segs) {
    if (out.length >= n) break;
    if (out.some((p) => Math.hypot(p.x - s.q.x, p.y - s.q.y) < 24)) continue;
    out.push({ id: `${id}-${out.length + 1}`, kind: 'branch', x: round(s.q.x), y: round(s.q.y), spread: round(s.spread), dome: 0, depth, slope: round2(s.slope), scale });
  }
  return out;
}

const OLIVE_SCALE = coastPerspective(OLIVE.base.x, OLIVE.base.y);
const PINE_SCALE = coastPerspective(PINE.base.x, PINE.base.y);

/** The olive's fork (where the scaffold limbs leave the trunk) and its limbs' flatter stretches. */
function olivePerches(): Perch[] {
  const fork = OLIVE_LIMBS[2]![0]!;
  return [
    { id: 'olive-fork', kind: 'branch', x: fork.x, y: fork.y, spread: 4, dome: 0, depth: OLIVE.base.y + 1, scale: OLIVE_SCALE },
    ...OLIVE_LIMBS.slice(1).flatMap((limb, i) => limbPerches(limb, `olive-limb-${i + 1}`, 2, 1, OLIVE_SCALE, OLIVE.base.y + 1)),
  ];
}

/** The leaning pine's branches (its trunk leans too steeply to stand on). */
const pinePerches = (): Perch[] => PINE_BRANCHES.flatMap((b, i) => limbPerches(b, `pine-branch-${i + 1}`, 1, 0.8, PINE_SCALE, PINE.base.y + 1));

/** The pithoi's rims (`JARS`: foot, height, lean). */
const jarPerches = (): Perch[] =>
  JARS.map((j, i) => ({ id: `jar-${i + 1}`, kind: 'jar', x: round(j.x + j.h * j.lean), y: j.y - j.h, spread: round(j.h * 0.1), dome: 0, depth: j.y + 1, scale: coastPerspective(j.x, j.y) }) as Perch).filter(
    (p) => offSlots(p),
  );

/** Each splash rock's dry crown (between its top and front edge): the middle, or else either shoulder, whichever is clear of the slot on it. */
function splashPerches(): Perch[] {
  const out: Perch[] = [];
  SPLASH_ROCK_SHAPES.forEach((r, i) => {
    const cols = r.columns;
    const mid = (k: number) => (cols[k]!.top + cols[k]!.front) / 2;
    const n = cols.length - 1;
    const k = [0.5, 0.3, 0.7, 0.2, 0.8].map((u) => Math.round(u * n)).find((j) => offSlots({ x: cols[j]!.x, y: mid(j) }));
    if (k === undefined) return;
    const [a, b] = [Math.max(0, k - 2), Math.min(n, k + 2)];
    const slope = (mid(b) - mid(a)) / (cols[b]!.x - cols[a]!.x);
    out.push({ id: `rock-${i + 1}`, kind: 'rock', x: round(cols[k]!.x), y: round(mid(k)), spread: round(r.w * 0.08), dome: 0, depth: r.y + 1, slope: round2(slope), scale: coastPerspective(r.x, r.y) });
  });
  return out;
}

/** The temple: the architrave's top over the tall columns, the broken columns' slanted tops, the fallen drum. */
function templePerches(): Perch[] {
  const depth = STYLOBATE.y + 1;
  const arch = TEMPLE_SHAPES[COLUMNS.length]!;
  const out: Perch[] = [
    { id: 'architrave', kind: 'ruin', x: (ARCHITRAVE.x0 + ARCHITRAVE.x1) / 2, y: arch[0]!.y, spread: round((ARCHITRAVE.x1 - ARCHITRAVE.x0) * 0.35), dome: 0, depth, scale: TEMPLE_SCALE },
  ];
  COLUMNS.forEach((c, i) => {
    if (c.x > ARCHITRAVE.x0 && c.x < ARCHITRAVE.x1) return;
    const [a, b] = TEMPLE_SHAPES[i]! as readonly Pt[];
    out.push({ id: `column-${i + 1}`, kind: 'ruin', x: c.x, y: round((a!.y + b!.y) / 2), spread: round(COLUMN_W * 0.3), dome: 0, depth, slope: round2((b!.y - a!.y) / (b!.x - a!.x)), scale: TEMPLE_SCALE });
  });
  out.push({ id: 'drum', kind: 'ruin', x: DRUM.x, y: DRUM.y - COLUMN_W / 2, spread: 3, dome: 0, depth: DRUM.y + 1, scale: TEMPLE_SCALE });
  return out;
}

/** The caique: its mast top and the near gunwale's level stretches clear of the mast's foot; they ride it. */
function boatPerches(): Perch[] {
  const [foot, top] = CAIQUE_SHAPES.mast;
  const base = { kind: 'boat' as const, dome: 0, depth: CAIQUE.y + 1, scale: CAIQUE_MEASURE, carrier: 'caique' };
  const out: Perch[] = [{ id: 'mast-top', x: round(top.x), y: round(top.y), spread: 1.2, ...base }];
  const sheer = CAIQUE_SHAPES.sheer;
  let k = 0;
  for (let i = 1; i < sheer.length; i++) {
    const a = sheer[i - 1]!;
    const b = sheer[i]!;
    const slope = (b.y - a.y) / (b.x - a.x);
    const q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (Math.abs(slope) > 0.3 || Math.abs(q.x - foot.x) < 8) continue;
    out.push({ id: `rail-${++k}`, x: round(q.x), y: round(q.y), spread: round(Math.abs(b.x - a.x) * 0.3), slope: round2(slope), ...base });
  }
  return out;
}

/** The far pines' highest needle clouds on the promontory's back, those the olive does not hide and off the slots. */
const crownPerches = (): Perch[] =>
  PROMONTORY_PINE_SHAPES.map((s): Perch => {
    const c = s.clouds.reduce((a, b) => (b.y - b.ry < a.y - a.ry ? b : a));
    return { id: `pine-crown-${Math.round(s.x)}`, kind: 'crown', x: round(c.x), y: round(c.y - c.ry * 0.8), spread: round(c.rx * 0.4), dome: 0, depth: round(s.trunk[0]!.y + 1), scale: TEMPLE_SCALE };
  }).filter((p) => inFrame(p) && !behindOlive(p) && offSlots(p));

/** The promontory's lowest edge at x: the sea at its point, the top terrace's back further on. */
function promontoryFoot(x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < PROMONTORY.length; i++) {
    const a = PROMONTORY[i]!;
    const b = PROMONTORY[(i + 1) % PROMONTORY.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    if (best === null || y > best) best = y;
  }
  return best;
}

/**
 * Ledges across the promontory's face for the goats (ADR 0373): a little under mid-face, at the
 * temple's measure, clear of the maquis, the far pines, the olive's crown and the top terrace's lip.
 */
function cliffLedges(): Perch[] {
  const out: Perch[] = [];
  for (let x = 660; x <= 1590; x += 30) {
    const top = promontoryTop(x);
    const foot = promontoryFoot(x);
    if (top === null || foot === null || foot - top < 40) continue;
    const y = round(top + (foot - top) * 0.45);
    const q = { x, y };
    if (y > foot - 24 || behindOlive(q)) continue;
    if (MAQUIS.some((m) => Math.hypot(m.x - x, m.y - y) < m.r + 8)) continue;
    if (PROMONTORY_PINE_SHAPES.some((s) => Math.abs(s.trunk[0]!.x - x) < 12 && y < s.trunk[0]!.y + 4)) continue;
    if (out.some((p) => Math.abs(p.x - x) < 70)) continue;
    out.push({ id: `cliff-ledge-${x}`, kind: 'ledge', x, y, spread: 9, dome: 0, depth: y + 1, scale: TEMPLE_SCALE });
  }
  return out;
}

export const COAST_PERCHES: Perch[] = [
  ...copingPerches(),
  ...olivePerches(),
  ...pinePerches(),
  ...jarPerches(),
  ...splashPerches(),
  ...templePerches(),
  ...boatPerches(),
  ...crownPerches(),
  ...cliffLedges(),
];

// ── carriers ────────────────────────────────────────────────────────────────────────────────

/**
 * The caique rocks at its mooring (a later motion task): its perches ride it. That task writes its
 * pose about the waterline centre here each frame it draws the boat; until then it is at rest.
 */
export const COAST_CARRIERS: Record<string, Carrier> = {
  caique: { pivot: { x: CAIQUE.x, y: CAIQUE.y }, pose: { dx: 0, dy: 0, angle: 0 } },
};

// ── ground, walls ───────────────────────────────────────────────────────────────────────────

/** The back of terrace `i`'s walk at x: the wall above's foot, or the promontory's foot for the top one. */
function walkBack(i: number, x: number): number {
  return i === 0 ? (promontoryFoot(x) ?? 500) + 10 : copingY(i - 1, x) + wallDrop(i - 1, x) + 6;
}

/** The front of terrace `i`'s walk at x: the far edge of a bed there, else just behind the coping. */
function walkFront(i: number, x: number): number {
  let y = copingY(i, x) - 6;
  for (const b of BEDS) {
    if (b.wall !== i) continue;
    const bb = polygonBounds(b.poly);
    if (x >= bb.x - 4 && x <= bb.x + bb.w + 4) y = Math.min(y, bb.y - 4);
  }
  return y;
}

/** A walk on terrace `i` between x0 and x1: the widest ellipse inside its band. */
function walk(id: string, i: number, x0: number, x1: number): GroundSpot {
  let back = -Infinity;
  let front = Infinity;
  for (let x = x0; x <= x1; x += 5) {
    back = Math.max(back, walkBack(i, x));
    front = Math.min(front, walkFront(i, x));
  }
  return { id, x: (x0 + x1) / 2, y: round((back + front) / 2), rx: (x1 - x0) / 2, ry: round((front - back) / 2 - 1) };
}

/** The x on the path's centre line at y (the path climbs the terraces from the bottom edge). */
function pathX(y: number): number {
  for (let i = 1; i < PATH.length; i++) {
    const a = PATH[i - 1]!;
    const b = PATH[i]!;
    if (y <= a.y && y >= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return PATH[PATH.length - 1]!.x;
}

/** A spot on the path's middle (narrower than its narrowest painted stretch). */
const pathSpot = (id: string, y: number, ry: number): GroundSpot => ({ id, x: round(pathX(y)), y, rx: 8, ry });

/** The waterline's and the beach's back y at x. */
function lineY(line: readonly Pt[], x: number): number {
  const s = [...line].sort((a, b) => a.x - b.x);
  if (x <= s[0]!.x) return s[0]!.y;
  for (let i = 1; i < s.length; i++) if (s[i]!.x >= x) return s[i - 1]!.y + ((s[i]!.y - s[i - 1]!.y) * (x - s[i - 1]!.x)) / (s[i]!.x - s[i - 1]!.x);
  return s[s.length - 1]!.y;
}
const BEACH_BACK = BEACH.slice(WATERLINE_EDGE.length);

/** The shingle between the foam and the shelf. */
function beachSpot(id: string, x0: number, x1: number): GroundSpot {
  let back = -Infinity;
  let front = Infinity;
  for (let x = x0; x <= x1; x += 5) {
    back = Math.max(back, lineY(WATERLINE_EDGE, x) + 12);
    front = Math.min(front, lineY(BEACH_BACK, x) - 6);
  }
  return { id, x: (x0 + x1) / 2, y: round((back + front) / 2), rx: (x1 - x0) / 2, ry: round((front - back) / 2 - 1) };
}

const ellipsePts = (g: Pick<GroundSpot, 'x' | 'y' | 'rx' | 'ry'>): Pt[] =>
  Array.from({ length: 16 }, (_, i) => ({ x: g.x + Math.cos((i / 16) * Math.PI * 2) * g.rx, y: g.y + Math.sin((i / 16) * Math.PI * 2) * g.ry }));

/** A scrub spot under a clump, shrunk until it lies on the land and off the walls; null if too small. */
function scrubSpot(id: string, x: number, y: number, rx: number, ry: number): GroundSpot | null {
  for (let k = 1; k > 0.3; k -= 0.1) {
    const g = { id, x, y, rx: round(rx * k), ry: round(Math.max(3, ry * k)) };
    const pts = ellipsePts(g);
    if (pts.every((q) => pointInPolygon(q, LAND) && TERRACE_FACES.every((f) => !pointInPolygon(q, f.outline)))) return g.rx >= 8 ? g : null;
  }
  return null;
}

/**
 * Where the cat, the tortoise and the hoopoe walk: the gravel walk of each terrace between the wall
 * above and its beds (either side of the path, the olive and the jar), the path, the beach, and the
 * scrub at the terraces' ends (the shoreline's clumps and the phrygana cushions).
 */
export const COAST_GROUND: GroundSpot[] = [
  walk('walk-top-west', 0, 930, 1060),
  walk('walk-top-mid', 0, 1160, 1235),
  walk('walk-top-east', 0, 1320, 1560),
  walk('walk-middle-west', 1, 880, 980),
  walk('walk-middle-mid', 1, 1130, 1230),
  walk('walk-middle-east', 1, 1260, 1540),
  walk('walk-lower-west', 2, 800, 900),
  walk('walk-lower-mid', 2, 1040, 1280),
  walk('walk-lower-east', 2, 1370, 1560),
  pathSpot('path-foreground', 940, 30),
  pathSpot('path-lower', 790, 12),
  pathSpot('path-middle', 640, 10),
  beachSpot('beach-west', 100, 300),
  beachSpot('beach-east', 380, 620),
  ...[
    ...SHORE_SCRUB.map((s, i) => scrubSpot(`scrub-shore-${i + 1}`, s.x, s.y + s.ry * 0.2, s.rx * 0.8, s.ry * 0.5)),
    ...PHRYGANA.filter((p) => p.y < 900).map((p) => scrubSpot(`scrub-${Math.round(p.x)}`, p.x, p.y - p.r * 0.2, p.r * 1.1, p.r * 0.35)),
  ].filter((g): g is GroundSpot => g !== null),
];

/** The splash rocks' low front faces, from the top's front edge down to the water: the crab's waterline. */
const SPLASH_FACES: WallFace[] = SPLASH_ROCK_SHAPES.map((r, i) => {
  // the front edge across the crown's middle, where the face is tallest
  const cols = r.columns.filter((c) => Math.abs(c.x - r.x) <= r.w * 0.35);
  const top = cols.map((c) => ({ x: c.x, y: round(c.front) }));
  // the shortest drop, so the foot never runs below the rock
  const h = Math.floor(Math.min(...cols.map((c) => c.base - round(c.front))) * 10) / 10;
  return { id: `splash-${i + 1}`, outline: [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + h }))], top, h };
});

/** The faces a lizard or a gecko clings to (`wall-*`: the three dry-stone walls) and the crab's (`splash-*`). */
export const COAST_WALLS: WallFace[] = [...TERRACE_FACES, ...SPLASH_FACES];

// ── regions ─────────────────────────────────────────────────────────────────────────────────

/** A band round a line, `half` either side: a trunk's bark. */
function band(line: readonly Pt[], half: number): Pt[] {
  const side = (s: number) =>
    line.map((q, i) => {
      const a = line[Math.max(0, i - 1)]!;
      const b = line[Math.min(line.length - 1, i + 1)]!;
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: round(q.x - ((b.y - a.y) / l) * half * s), y: round(q.y + ((b.x - a.x) / l) * half * s) };
    });
  return [...side(1), ...side(-1).reverse()];
}

/** The water nearer the shore than the turquoise's edge, right of the pine and left of the steps, down to the foam: the damselfish's. */
function shallows(): Region {
  const edge = shoreContour(DEPTH.turquoise, 0, 'fauna-shallows');
  const x0 = Math.max(...PINE_TRUNK.filter((q) => q.y > 560).map((q) => q.x), PINE_ROCK.x + PINE_ROCK.w / 2) + 12;
  const x1 = WATERLINE_EDGE[WATERLINE_EDGE.length - 1]!.x - 44;
  const boat = CAIQUE_BOX;
  const tops: Pt[] = [];
  const feet: Pt[] = [];
  for (let x = x0; x <= x1; x += 8) {
    const under = x >= boat.x - 8 && x <= boat.x + boat.w + 8 ? boat.y + boat.h : -Infinity;
    const top = Math.max(lineY(edge, x), under) + 4;
    const foot = lineY(WATERLINE_EDGE, x) - 6;
    if (foot - top < 8) continue;
    tops.push({ x, y: round(top) });
    feet.push({ x, y: round(foot) });
  }
  const rocks = [...SPLASH_ROCK_SHAPES, ...SHORE_BOULDER_SHAPES].map((r) => r.outline.map((q) => ({ x: round(q.x), y: round(q.y) })));
  return { id: 'shallows', kind: 'shallows', outline: [...tops, ...feet.reverse()], holes: rocks };
}

/** Far out in the bay, under the far hill: left of the setting sun's glitter path, above the caique, right of the pine. */
function bay(): Region {
  const sun = Math.min(COAST_SKY_LAYOUT.sunsetX, COAST_SKY_LAYOUT.sunriseX);
  // a low sun's path on the sea: 16 either side at the horizon, widening 0.5 a unit toward the viewer, and a margin
  const right = (y: number) => round(sun - 16 - (y - HORIZON) * 0.5 - 10);
  const left = Math.max(...[...PINE_TRUNK, ...PINE_BRANCHES.flat(), ...PINE_PADS.map((p) => ({ x: p.x + p.rx, y: p.y }))].filter((q) => q.y > HORIZON - 30).map((q) => q.x)) + 10;
  const top = HORIZON + 12;
  const bottom = round(CAIQUE_BOX.y - 6);
  return {
    id: 'bay',
    kind: 'bay',
    outline: [{ x: left, y: top }, { x: right(top), y: top }, { x: right(bottom), y: bottom }, { x: left, y: bottom }],
    scale: { top: seaScale(top), bottom: seaScale(bottom) },
  };
}

/** The open sky over the cove, right of the pine's crown, 14 above the skyline and the architrave. */
function skyOverCove(): Region {
  const x0 = Math.max(...PINE_PADS.map((p) => p.x + p.rx)) + 10;
  const x1 = 900;
  const archTop = TEMPLE_SHAPES[COLUMNS.length]![0]!.y;
  const low: Pt[] = [];
  for (let x = x0; x <= x1; x += 10) {
    const arch = x >= ARCHITRAVE.x0 - 6 && x <= ARCHITRAVE.x1 + 6 ? archTop : Infinity;
    low.push({ x, y: round(Math.min(skylineAt(x - 6), skylineAt(x), skylineAt(x + 6), arch) - 14) });
  }
  return { id: 'sky-cove', kind: 'sky', outline: [{ x: x0, y: 60 }, { x: x1, y: 60 }, ...low.reverse()] };
}

/** The olive's trunk up to its fork and the pine's trunk below its needles: the cicada's bark, at each tree's scale. */
const BARK: Region[] = [
  { id: 'bark-olive', kind: 'bark', outline: band(OLIVE_LIMBS[0]!, 5), scale: { top: OLIVE_SCALE, bottom: OLIVE_SCALE } },
  { id: 'bark-pine', kind: 'bark', outline: band(PINE_TRUNK.filter((q) => q.y > Math.max(...PINE_PADS.map((p) => p.y + p.ry)) + 20), 4), scale: { top: PINE_SCALE, bottom: PINE_SCALE } },
];

export const COAST_REGIONS: Region[] = [
  shallows(),
  ...POOL_WATER.map((outline, i): Region => ({ id: `pool-${i + 1}`, kind: 'pool', outline: outline.map((q) => ({ ...q })) })),
  bay(),
  skyOverCove(),
  ...BARK,
];

// ── stands ──────────────────────────────────────────────────────────────────────────────────

/** Where the heron fishes: a few units out from the beach's waterline, clear of the slots and the splash rocks, facing along the shore. */
export const COAST_STANDS: Stand[] = [
  [130, 1],
  [320, 1],
  [545, -1],
].map(([x, facing]) => ({ x: x!, y: round(lineY(WATERLINE_EDGE, x!) - 8), facing: facing! }));

/** How far a point lies inside the sea (negative: outside). */
export function intoSea(q: Pt): number {
  const d = distanceToPolygon(q, SEA_WATER);
  return pointInPolygon(q, SEA_WATER) ? d : -d;
}

/**
 * What the coast tells its wildlife: the sea still, the rock pools in the water layers' clip (no
 * coast creature reads them as streams), perches, walks, faces, regions, the caique, stands.
 */
export const COAST_WILDLIFE: SceneryFauna = {
  unlocks: COAST_FAUNA,
  water: { still: SEA_WATER, moving: POOL_WATER },
  perches: COAST_PERCHES,
  ground: COAST_GROUND,
  walls: COAST_WALLS,
  regions: COAST_REGIONS,
  carriers: COAST_CARRIERS,
  stands: COAST_STANDS,
  perspective: coastPerspective,
};
