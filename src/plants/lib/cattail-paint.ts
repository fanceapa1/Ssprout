/**
 * Painting helpers for the southern cattail (docs/devlog/113-cattail.md): flat twisting strap
 * leaves batched in one wet layer, and the spike pair on a stalk (the velvet female cigar, a bare
 * gap, the thin straw male spike that frays). New helpers, so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { pathLen, pointAt } from './small-structure';

export function bounds(pts: readonly Pt[], pad: number): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/** Unit normals of a path (the average of the two neighbouring segments). */
function normals(pts: readonly Pt[]): Pt[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
}

export interface StrapLeaf {
  key: string;
  /** the midline at its current length, base first */
  pts: Pt[];
  /** full width at the base */
  width: number;
  /** twist: phase at the base and half-turns along the blade */
  twist: number;
  turns: number;
  tone: Pigment;
  deep: Pigment;
  /** straw at the tip: how far down it reaches (0..1 of the blade) and how strong */
  straw: number;
  strawK: number;
}

/** Width factor and face (+1 front, −1 back) of a twisting strap at `t`. */
export function strapFace(l: Pick<StrapLeaf, 'twist' | 'turns'>, t: number): { f: number; face: number } {
  const c = Math.cos(l.twist + l.turns * Math.PI * t);
  return { f: 0.3 + 0.7 * Math.abs(c), face: c >= 0 ? 1 : -1 };
}

/** Half-width profile of a strap: parallel-sided, narrowing only in its last third to a point. */
const strapHalf = (t: number) => 0.5 * (t < 0.62 ? 1 - t * 0.12 : (1 - 0.62 * 0.12) * Math.sqrt(clamp01((1 - t) / 0.38)));

function edges(l: StrapLeaf, scale: number): { left: Pt[]; right: Pt[] } {
  const n = normals(l.pts);
  const left: Pt[] = [];
  const right: Pt[] = [];
  const N = l.pts.length - 1;
  l.pts.forEach((q, i) => {
    const t = i / N;
    const hw = l.width * scale * strapHalf(t) * strapFace(l, t).f;
    left.push({ x: q.x + n[i]!.x * hw, y: q.y + n[i]!.y * hw });
    right.push({ x: q.x - n[i]!.x * hw, y: q.y - n[i]!.y * hw });
  });
  return { left, right };
}

const band = (left: Pt[], right: Pt[], i0: number, i1: number): Pt[] => [...left.slice(i0, i1 + 1), ...right.slice(i0, i1 + 1).reverse()];

/**
 * Strap leaves in one wet layer: a flat band whose width breathes as it twists, the back face a
 * deeper, cooler green, straw creeping down from the tip, dried with a crisp edge.
 */
export function strapLeaves(p: Painter, leaves: readonly StrapLeaf[], o: { opacity: number; straw: Pigment }): void {
  const live = leaves.filter((l) => l.pts.length > 1 && pathLen(l.pts) > 0.6);
  if (!live.length) return;
  const all = live.flatMap((l) => l.pts);
  const L = p.layer(bounds(all, 6));
  for (const l of live) {
    const len = pathLen(l.pts);
    const scale = smooth(len / 10);
    const { left, right } = edges(l, scale);
    const N = l.pts.length - 1;
    L.fill(band(left, right, 0, N), l.tone, 0.62);
    // the back face, segment runs where the strap has turned over
    let run = -1;
    for (let i = 0; i <= N; i++) {
      const back = i < N && strapFace(l, (i + 0.5) / N).face < 0;
      if (back && run < 0) run = i;
      if (!back && run >= 0) {
        L.fill(band(left, right, run, i), l.deep, 0.42);
        run = -1;
      }
    }
    // straw at the tip, then a paler wash just below it
    if (l.strawK > 0.01) {
      const i0 = Math.max(0, Math.min(N - 1, Math.round(N * (1 - l.straw))));
      L.fill(band(left, right, i0, N), o.straw, 0.55 * l.strawK);
      const i1 = Math.max(0, Math.round(N * (1 - l.straw * 1.7)));
      if (i1 < i0) L.fill(band(left, right, i1, N), o.straw, 0.22 * l.strawK);
    }
  }
  L.dry({ opacity: o.opacity, edge: 0.55, edgeWidth: 0.28, sharpness: 0.75, centreLift: 0.15, granulation: 0.12, flow: 0.25, flowScale: 3, darken: 0.3 });
}

/** A fine ink edge down the shaded margin of a strap, the mark that makes it read flat. */
export function strapEdge(p: Painter, rng: Rng, l: StrapLeaf, ink: Pigment, opacity: number): void {
  const len = pathLen(l.pts);
  if (len < 4) return;
  const { left } = edges(l, smooth(len / 10));
  p.inkLine(left.slice(0, Math.max(2, Math.round(left.length * 0.92))), {
    rng: rng.fork('edge'),
    width: 0.32,
    pigment: ink,
    opacity: opacity * smooth((len - 4) / 12),
    breaks: 0.45,
    wobble: 0.15,
    taper: [0.15, 0.5],
  });
}

export interface SpikePaint {
  /** the stalk's points as grown now, base first */
  stalk: Pt[];
  /** 0..1 size of the spikes */
  k: number;
  female: { length: number; radius: number };
  gap: number;
  male: { length: number; radius: number };
  /** bare stalk above the male spike */
  tip: number;
  /** 0 green … 1 brown; 0 fresh gold … 1 frayed and shed; fluff halo 0..1 */
  brown: number;
  fray: number;
  fluff: number;
  frays: { t: number; side: number; len: number; a: number }[];
  flecks: { t: number; dx: number; dy: number; size: number }[];
}

/** A capsule round the stalk between two lengths along it, its radius rounding off at both ends. */
function capsule(stalk: Pt[], s0: number, s1: number, r: number, n = 10): { poly: Pt[]; axis: { x: number; y: number; angle: number }[] } {
  const total = pathLen(stalk);
  const axis: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i <= n; i++) axis.push(pointAt(stalk, clamp01(lerp(s0, s1, i / n) / total)));
  const left: Pt[] = [];
  const right: Pt[] = [];
  axis.forEach((q, i) => {
    const u = (i / n) * 2 - 1;
    const rr = r * Math.sqrt(Math.max(0.04, 1 - u ** 6));
    const nx = -Math.sin(q.angle);
    const ny = Math.cos(q.angle);
    left.push({ x: q.x + nx * rr, y: q.y + ny * rr });
    right.push({ x: q.x - nx * rr, y: q.y - ny * rr });
  });
  return { poly: [...left, ...right.reverse()], axis };
}

/**
 * The flower spikes at the top of a stalk: the female cigar, green then velvet brown with a
 * shaded flank and a lifted sheen; a bare gap; the thin male spike, gold then straw and fraying.
 */
export function cattailSpikes(p: Painter, rng: Rng, s: SpikePaint, c: { green: Pigment; brown: Pigment; shade: Pigment; male: Pigment; maleGreen: Pigment; fluff: Pigment; light: number }): void {
  if (!visible(s.k)) return;
  const total = pathLen(s.stalk);
  const fl = s.female.length * s.k;
  const ml = s.male.length * s.k;
  const top = total - s.tip * s.k;
  const m1 = top;
  const m0 = Math.max(0, m1 - ml);
  const f1 = Math.max(0, m0 - s.gap * s.k);
  const f0 = Math.max(0, f1 - fl);
  if (f1 - f0 < 0.4) return;
  const fr = s.female.radius * lerp(0.35, 1, smooth(s.k));
  const mr = s.male.radius * lerp(0.5, 1, smooth(s.k));
  const fem = capsule(s.stalk, f0, f1, fr);
  const mal = capsule(s.stalk, m0, m1, mr * lerp(1, 0.75, s.fray));
  const L = p.layer(bounds([...fem.poly, ...mal.poly], 8));
  // the male spike, under the female so the gap stays clean
  const maleTone = mix(c.maleGreen, c.male, smooth(s.brown * 1.3));
  if (m1 - m0 > 0.4) {
    L.fill(mal.poly, maleTone, 0.7 * lerp(1, 0.75, s.fray));
    s.frays.forEach((f, i) => {
      const q = pointAt(s.stalk, clamp01(lerp(m0, m1, f.t) / total));
      const a = q.angle + f.side * f.a;
      const len = f.len * mr * s.fray;
      if (len < 0.2) return;
      const o = { x: q.x - Math.sin(q.angle) * mr * f.side * 0.7, y: q.y + Math.cos(q.angle) * mr * f.side * 0.7 };
      p.dabInto(L, o, maleTone, { rng: rng.fork(`fray-${i}`), variant: 'needle', angle: a, length: len, width: Math.max(0.25, mr * 0.35), pool: 0, basePool: 0.2, layers: 1 });
    });
  }
  // the female cigar: colour turning, a shaded flank on the side away from the light
  const tone = mix(c.green, c.brown, s.brown);
  const deep = mix(mix(c.green, c.shade, 0.5), c.shade, s.brown);
  L.fill(fem.poly, tone, 0.92);
  const n = fem.axis.length - 1;
  const flank = (from: number, to: number, side: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const q = fem.axis[i]!;
      const u = (i / n) * 2 - 1;
      const rr = fr * Math.sqrt(Math.max(0.04, 1 - u ** 6));
      const nx = -Math.sin(q.angle) * side;
      const ny = Math.cos(q.angle) * side;
      pts.push({ x: q.x + nx * rr * from, y: q.y + ny * rr * from });
    }
    for (let i = n; i >= 0; i--) {
      const q = fem.axis[i]!;
      const u = (i / n) * 2 - 1;
      const rr = fr * Math.sqrt(Math.max(0.04, 1 - u ** 6));
      const nx = -Math.sin(q.angle) * side;
      const ny = Math.cos(q.angle) * side;
      pts.push({ x: q.x + nx * rr * to, y: q.y + ny * rr * to });
    }
    return pts;
  };
  const shadeSide = -c.light;
  L.fill(flank(0.05, 1.02, shadeSide), deep, 0.75);
  L.lift(flank(0.25, 0.62, -shadeSide), 0.32 * s.k);
  L.dry({ opacity: 0.94, edge: 0.5, edgeWidth: 0.3, sharpness: 0.55, centreLift: 0.1, granulation: 0.4, granules: 0.4, flow: 0.35, flowScale: 1.5, darken: 0.35 });
  // shed pollen drifting down beside the male spike
  s.flecks.forEach((f, i) => {
    const q = pointAt(s.stalk, clamp01(lerp(m0, m1, f.t) / total));
    const k = smooth((s.fray - 0.2) / 0.8);
    if (!visible(k)) return;
    p.dab({ x: q.x + f.dx * k, y: q.y + f.dy * k }, c.male, { rng: rng.fork(`fleck-${i}`), variant: 'round', angle: 0, length: f.size * k, width: f.size * 0.8 * k, opacity: 0.6 * k });
  });
  // late season: the cigar breaks open into a soft dry-brushed halo
  if (visible(s.fluff)) {
    const i0 = Math.round(n * 0.35);
    const pts: Pt[] = [];
    for (let i = i0; i <= n; i++) {
      const q = fem.axis[i]!;
      const nx = -Math.sin(q.angle) * c.light;
      const ny = Math.cos(q.angle) * c.light;
      pts.push({ x: q.x + nx * fr * 1.05, y: q.y + ny * fr * 1.05 });
    }
    p.dryBrush(pts, { rng: rng.fork('fluff'), pigment: c.fluff, width: fr * 1.1 * s.fluff, opacity: 0.55 * s.fluff, taper: [0.3, 0.3], wobble: 0.3 });
  }
}
