/**
 * A recording stand-in for `Painter` (tests only): every engine call is logged with its
 * arguments, and rng streams are replaced by their seeds, so a species' draw can be compared
 * across seeds and growth values without a canvas (Vitest runs in node).
 */
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';

export interface PaintCall {
  method: string;
  /** stable identity of the mark: method + rng seed + occurrence (null when no rng is passed) */
  key: string | null;
  args: unknown[];
}

const isRng = (v: unknown): v is Rng => typeof v === 'object' && v !== null && typeof (v as Rng).fork === 'function' && typeof (v as Rng).seed === 'number';

function clean(v: unknown): unknown {
  if (isRng(v)) return `rng:${v.seed}`;
  if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) out[k] = clean((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** A 2D context that accepts any call or property write and does nothing. */
function nullContext(w: number, h: number): CanvasRenderingContext2D {
  const target: Record<string | symbol, unknown> = { canvas: { width: w, height: h } };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return () => undefined;
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export function recordingPainter(w = 300, h = 400): { painter: Painter; calls: PaintCall[] } {
  const calls: PaintCall[] = [];
  const seen = new Map<string, number>();
  const ctx = nullContext(w, h);
  const log = (method: string, args: unknown[]) => {
    const opts = args.find((a) => a && typeof a === 'object' && !Array.isArray(a) && isRng((a as { rng?: unknown }).rng)) as { rng: Rng } | undefined;
    let key: string | null = null;
    if (opts) {
      const base = `${method}:${opts.rng.seed}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      key = `${base}:${n}`;
    }
    calls.push({ method, key, args: args.map(clean) });
  };
  let layers = 0;
  const method =
    (name: string) =>
    (...args: unknown[]) => {
      log(name, args);
    };
  const painter = {
    ctx,
    w,
    h,
    rng: undefined,
    quality: 'normal',
    paper: undefined,
    env: undefined,
    wash: method('wash'),
    glaze: method('glaze'),
    wetInWet: method('wetInWet'),
    granulate: method('granulate'),
    dab: method('dab'),
    stroke: method('stroke'),
    inkLine: method('inkLine'),
    dryBrush: method('dryBrush'),
    splatter: method('splatter'),
    ripple: method('ripple'),
    lift: method('lift'),
    foliageClump: method('foliageClump'),
    grassTuft: method('grassTuft'),
    stone: method('stone'),
    waterBody: method('waterBody'),
    layer: (area?: unknown) => {
      const id = layers++;
      log('layer', [id, area]);
      const marks: PaintCall[] = [];
      return {
        id,
        marks,
        ctx: nullContext(w, h),
        scale: 1,
        empty: false,
        fill: (...a: unknown[]) => log('layer.fill', [id, ...a]),
        lift: (...a: unknown[]) => log('layer.lift', [id, ...a]),
        clip: (...a: unknown[]) => log('layer.clip', [id, ...a]),
        dry: (...a: unknown[]) => {
          log('layer.dry', [id, ...a]);
          // a mark in a layer is only as strong as the layer's dried opacity
          const o = a[0] as { opacity?: number } | undefined;
          const opacity = o?.opacity ?? 0.85;
          for (const m of marks) m.args.push({ opacity: Math.round(opacity * 1e6) / 1e6 });
        },
        discard: () => log('layer.discard', [id]),
      };
    },
    dabInto: (layer: { marks?: PaintCall[] }, ...args: unknown[]) => {
      log('dabInto', args);
      layer.marks?.push(calls[calls.length - 1]!);
    },
  };
  return { painter: painter as unknown as Painter, calls };
}

/**
 * The numbers that describe a call's mark, for continuity checks: every scalar option, and the
 * first/last points of point lists (point counts may legitimately vary with length).
 */
export function callNumbers(c: PaintCall): number[] {
  const out: number[] = [];
  const walk = (v: unknown, depth: number) => {
    if (typeof v === 'number') out.push(v);
    else if (Array.isArray(v)) {
      if (v.length && typeof v[0] === 'object' && v[0] !== null && 'x' in (v[0] as object)) {
        const a = v[0] as { x: number; y: number };
        const b = v[v.length - 1] as { x: number; y: number };
        out.push(a.x, a.y, b.x, b.y);
      } else v.forEach((x) => walk(x, depth + 1));
    } else if (v && typeof v === 'object' && depth < 3) {
      for (const k of Object.keys(v).sort()) walk((v as Record<string, unknown>)[k], depth + 1);
    }
  };
  for (const a of c.args) walk(a, 0);
  return out;
}

/** The size/strength of a newly appearing mark: its largest length-like option, scaled by opacity. */
export function callMagnitude(c: PaintCall): number {
  let size = 0;
  let opacity = 1;
  for (const a of c.args) {
    if (Array.isArray(a) && a.length > 1 && typeof a[0] === 'object' && a[0] && 'x' in (a[0] as object)) {
      let L = 0;
      for (let i = 1; i < a.length; i++) {
        const p = a[i - 1] as { x: number; y: number };
        const q = a[i] as { x: number; y: number };
        L += Math.hypot(q.x - p.x, q.y - p.y);
      }
      size = Math.max(size, L);
    } else if (a && typeof a === 'object' && !Array.isArray(a)) {
      const o = a as Record<string, unknown>;
      for (const k of ['length', 'rx', 'ry', 'width', 'radius', 'height']) if (typeof o[k] === 'number') size = Math.max(size, o[k] as number);
      if (typeof o.opacity === 'number') opacity = o.opacity as number;
    }
  }
  return size * opacity;
}
