/**
 * The plantable ground as a rock platform standing above the sea (GO1, ADR 0388), as data: the
 * headlands' faces (the floor's rim, the face's foot in the water, its outline), the back edges
 * where the floor's rim meets deeper water, and the bedding of each face. Fixed seeds; the painter
 * (`paint-platform.ts`), the motion and the wildlife read them by name.
 * docs/systems/scenery.md › Coast › Platform.
 */
import { createRng } from '../../core/rng';
import { resample } from '../../paint/geometry';
import type { Pt } from '../../render/viewport';
import { SHORE_EDGE, WALLS, type Terrace } from './layout';

/** A headland's face: the floor's rim over it and its foot in the water, both west to east. */
export interface PlatformFace {
  id: string;
  terrace: Terrace;
  /** the wall whose west end the face meets (it holds the same terrace) */
  wall: number;
  rim: readonly Pt[];
  foot: readonly Pt[];
  /** the rim, down the wall's end to its foot, the face's foot back west, up the west corner */
  outline: readonly Pt[];
}

const at = (x: number, y: number): number => SHORE_EDGE.findIndex((q) => q.x === x && q.y === y);

function face(id: string, terrace: Terrace, wall: number, corner: Pt, footFrom: Pt, footTo: Pt, rim: readonly Pt[]): PlatformFace {
  const w = WALLS[wall]!;
  const end = w.edge[0]!;
  const i0 = at(corner.x, corner.y);
  const f0 = at(footFrom.x, footFrom.y);
  const f1 = at(footTo.x, footTo.y);
  const west = SHORE_EDGE.slice(i0, f0 + 1);
  const foot = SHORE_EDGE.slice(f0, f1 + 1);
  const outline = [...rim, { x: end.x, y: end.y + w.h }, ...foot.slice().reverse(), ...west.slice(1, -1).reverse()];
  return { id, terrace, wall, rim, foot, outline };
}

/** The two headlands: the top terrace's over the upper cove, the middle terrace's bastion over the lower one. */
export const PLATFORM_FACES: readonly PlatformFace[] = [
  face('top', 'top', 0, { x: 764, y: 552 }, { x: 762, y: 620 }, { x: 848, y: 634 }, [
    { x: 764, y: 552 }, { x: 790, y: 559 }, { x: 816, y: 566 }, { x: 838, y: 573 }, { x: 856, y: 578 },
  ]),
  face('bastion', 'middle', 1, { x: 690, y: 726 }, { x: 691, y: 778 }, { x: 760, y: 789 }, [
    { x: 690, y: 726 }, { x: 716, y: 722 }, { x: 744, y: 719 }, { x: 772, y: 716 },
  ]),
];

/** The floor's rim along the edges that run away from the viewer: the floor stops at the rock's edge over deeper water. */
export const BACK_EDGES: readonly (readonly Pt[])[] = [
  SHORE_EDGE.slice(0, at(764, 552) + 1),
  SHORE_EDGE.slice(at(848, 634), at(690, 726) + 1),
  SHORE_EDGE.slice(at(760, 789), at(684, 812) + 1),
];

/** Each face's foot every 3 units, where the swell breaks on the rock (the motion's laps). */
export const FACE_FEET: readonly (readonly Pt[])[] = PLATFORM_FACES.map((f) => resample(f.foot, 3));

/** y on a line sorted by x, held flat past its ends. */
export function lineY(line: readonly Pt[], x: number): number {
  if (x <= line[0]!.x) return line[0]!.y;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    if (b.x >= x) return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return line[line.length - 1]!.y;
}

/** A bed in a face: how far down it lies (0 the rim, 1 the foot), how hard it is, and where it breaks. */
export interface FaceBed {
  f: number;
  hard: boolean;
  /** an overhang: its shadow deep under one end */
  over: boolean;
  /** the stretches (x) it shows in */
  runs: [number, number][];
}

/** A joint down a face: its x at the rim, its lean, and the beds it runs between. */
export interface FaceJoint {
  x: number;
  lean: number;
  from: number;
  to: number;
  deep: boolean;
}

/** Each face's bedding and jointing, from its own seed: beds at uneven spacing, joints in blocks of their own width. */
export const FACE_FORM: readonly { beds: FaceBed[]; joints: FaceJoint[] }[] = PLATFORM_FACES.map((pf) => {
  const rng = createRng(`coast-platform-${pf.id}`);
  const x0 = pf.rim[0]!.x;
  const x1 = pf.rim[pf.rim.length - 1]!.x;
  const beds: FaceBed[] = [];
  for (let f = rng.range(0.1, 0.16); f < 0.9; f += rng.range(0.1, 0.2)) {
    const runs: [number, number][] = [];
    for (let x = x0 + rng.range(-2, 8); x < x1; ) {
      const len = rng.range(10, 42);
      runs.push([x, Math.min(x1 + 2, x + len)]);
      x += len + rng.range(3, 18);
    }
    beds.push({ f, hard: rng.chance(0.38), over: rng.chance(0.3), runs });
  }
  const joints: FaceJoint[] = [];
  for (let x = x0 + rng.range(8, 16); x < x1 - 4; x += rng.range(9, 26)) {
    const from = rng.int(0, Math.max(0, beds.length - 2));
    joints.push({ x, lean: rng.range(-0.12, 0.12), from, to: Math.min(beds.length, from + rng.int(1, 3)), deep: rng.chance(0.5) });
  }
  return { beds, joints };
});
