/**
 * `window.sprout.fauna` (?dev): force creatures in for screenshots and tests, step the
 * simulation without waiting, pin the hour, and measure the per-frame cost.
 */
import { extendDebug } from '../dev/debug';
import { makeCanvas } from '../paint';
import { LAYERS } from '../render/types';
import type { Pt, Rect } from '../render/viewport';
import { pointInPolygon } from './math';
import { faunaRow } from '../core/fauna-unlocks';
import type { FaunaListing } from './sim';
import type { FaunaSystem } from './system';
import { creatureDef, creatureKinds } from './creatures/registry';

export interface FaunaDebugListing extends FaunaListing {
  /** for koi and striders: is it inside the pond polygon */
  inPond: boolean;
}

export interface FaunaBench {
  frames: number;
  creatures: number;
  /** mean ms per frame */
  update: number;
  draw: number;
  total: number;
}

export interface FaunaDebug {
  /** creature kinds with a module (`spawn` also takes the garden on view's unlock ids) */
  kinds(): string[];
  /** Bring a creature in now (ignores schedule, cap and night), in this garden's variant. Returns the new ids. */
  spawn(id: string, count?: number): number[];
  list(): FaunaDebugListing[];
  /** Remove every creature and forget the schedule. */
  clear(): void;
  /** Advance the simulation by `seconds` in fixed steps (default 1/30 s) without rendering. */
  step(seconds: number, dt?: number): void;
  /** Whether the creatures are in their night rest (from the daylight phases, or the pinned hour). */
  night(): boolean;
  /** Pin the local hour (0–24) for day/night behaviour; null follows the daylight. */
  setHour(hour: number | null): void;
  /**
   * The garden on view's wildlife: its unlocked rows (`ids`), resident counts by kind, visiting
   * kinds enabled now, every kind its rows bring that has a module (`kinds`), and its variants.
   */
  roster(): { scenery: string; ids: string[]; residents: Record<string, number>; visitors: string[]; kinds: string[]; variants: Record<string, string[]> };
  /** Seconds until each scheduled visit. */
  schedule(): Record<string, number>;
  /** Pond polygon and visible world rect (bounds checks in tests). */
  pond(): Pt[];
  /** Where creatures go right now: flower heads, lily pads, perches, heron wading spots. */
  targets(): { flowers: Pt[]; pads: Pt[]; perches: Pt[]; stands: Pt[] };
  view(): Rect;
  /** The painted parts' cache: resolution (px per unit), parts waiting to be painted sharper, parts painted so far. */
  art(): { res: number; pending: number; painted: number };
  /** Paint every part waiting for a sharper resolution now (screenshots; normally idle time does it). */
  settleArt(): void;
  /** Time update + draw of all fauna layers over `frames` simulated frames at the real canvas size. */
  bench(frames?: number): FaunaBench;
}

declare module '../dev/debug' {
  interface SproutDebug {
    fauna: FaunaDebug;
  }
}

export function installFaunaDebug(system: FaunaSystem): void {
  const sim = () => {
    if (!system.sim) throw new Error('fauna system not initialised yet');
    return system.sim;
  };
  const api: FaunaDebug = {
    kinds: () => creatureKinds(),
    spawn(id, count) {
      const kind = creatureDef(id) ? id : (faunaRow(system.habitat().unlocks, id)?.kind ?? id);
      const def = creatureDef(kind);
      if (!def) throw new Error(`unknown creature "${id}" (try ${creatureKinds().join(', ')})`);
      return sim()
        .spawn(kind, { forced: true, count: count ?? def.spawnCount ?? 1 })
        .map((c) => c.id);
    },
    list() {
      const s = sim();
      const pond = s.world.pond.world;
      return s.list().map((c) => ({ ...c, inPond: pointInPolygon(c, pond) }));
    },
    clear: () => sim().clear(),
    step(seconds, dt = 1 / 30) {
      const s = sim();
      for (let t = 0; t < seconds; t += dt) s.update(dt, system.now());
    },
    night: () => sim().world.mode.night,
    setHour(hour) {
      sim().hourOverride = hour;
    },
    roster() {
      const r = sim().roster;
      const kinds = [...new Set(system.unlocked().map((u) => u.kind))].filter((k) => creatureDef(k));
      return {
        scenery: system.sceneryId(),
        ids: system.unlocked().map((u) => u.id),
        residents: Object.fromEntries(r.residents),
        visitors: [...sim().enabledVisitors()],
        kinds,
        variants: Object.fromEntries(r.variants),
      };
    },
    schedule() {
      const s = sim();
      return Object.fromEntries([...s.schedule.entries()].map(([k, due]) => [k, Math.max(0, due - s.time)]));
    },
    pond: () => sim().world.pond.world.map((p) => ({ ...p })),
    targets() {
      const w = sim().world;
      const xy = (p: Pt) => ({ x: p.x, y: p.y });
      return { flowers: w.flowers.map(xy), pads: w.pads.map(xy), perches: w.perches.map(xy), stands: sim().heronStands().map(xy) };
    },
    view: () => ({ ...sim().world.view }),
    art: () => {
      const a = sim().world.art;
      return { res: a.res, pending: a.pending, painted: a.painted };
    },
    settleArt: () => {
      sim().world.art.paintPending(Infinity);
    },
    bench(frames = 120) {
      const s = sim();
      const vp = system.viewport;
      const canvas = makeCanvas(vp?.pixelW ?? 1600, vp?.pixelH ?? 1000);
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      let update = 0;
      let draw = 0;
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now();
        s.update(1 / 60, system.now());
        const t1 = performance.now();
        if (vp) vp.applyTo(ctx);
        for (const layer of LAYERS) {
          if (layer === 'entities') {
            for (const d of s.entities().sort((a, b) => a.depth - b.depth)) {
              ctx.save();
              d.draw(ctx, { t: s.time, dt: 1 / 60, now: 0 });
              ctx.restore();
            }
          } else {
            ctx.save();
            s.draw(layer, ctx);
            ctx.restore();
          }
        }
        draw += performance.now() - t1;
        update += t1 - t0;
      }
      return { frames, creatures: s.creatures.length, update: update / frames, draw: draw / frames, total: (update + draw) / frames };
    },
  };
  extendDebug({ fauna: api });
}
