/**
 * FaunaSim: the creatures, their world and their pacing, independent of the renderer (the garden
 * system and the studio stages both drive one). Time comes in through `update`, randomness from
 * one seeded stream.
 */
import { createRng, hashString, type Rng } from '../core/rng';
import type { PlantInstance } from '../core/state';
import { createSimplex2D, PIGMENTS } from '../paint';
import type { Drawable, LayerId } from '../render/types';
import type { Pt, Rect } from '../render/viewport';
import type { SceneGeometry } from '../scene/geometry';
import { creatureDef, creatureDefs } from './creatures/registry';
import { easeOut, localHour, polygonBounds, polygonCentroid, rangeOf, toPlane } from './math';
import { rosterFor, type Roster, type RosterRow } from './roster';
import { CALM_MODE, dueVisits, groupSize, isNight, residentTarget, visitTuning, type Census, type FaunaMode, type Schedule } from './schedule';
import { ArtCache, drawSprite, paintSprite, type Sprite } from './sprite';
import { flowerTargets, heronStands, lilyPads, perchesOf, perspectiveFit, type Stand, type TargetLookup } from './targets';
import { FAUNA_TUNING, type FaunaKind, type VisitorKind } from './tuning';
import type { Creature, Ctx, FaunaWorld, PondInfo, WaterInfo } from './types';

interface Ripple {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
  strength: number;
  variant: number;
}

export interface SimOptions {
  scene: SceneGeometry;
  seed: number;
  reducedMotion?: boolean;
  /** keep residents and schedule visits (false: only what is spawned by hand — studio stages) */
  auto?: boolean;
  view?: Rect;
}

export interface SpawnOptions {
  /** ignore the visitor cap, the night and the schedule (dev / studio); default true */
  forced?: boolean;
  /** group size (swallows, bees); default 1 when forced */
  count?: number;
}

export interface FaunaListing {
  id: number;
  kind: FaunaKind;
  x: number;
  y: number;
  layer: LayerId;
  state: string;
  visitor: boolean;
  variant?: string;
}

function waterInfo(scene: SceneGeometry): WaterInfo {
  const moving = scene.streams.map((s) => s.map((p) => ({ x: p.x, y: p.y })));
  return { moving, clip: [scene.pond, ...moving].filter((p) => p.length >= 3) };
}

/** Resident kinds, in the order upkeep keeps them (`CreatureDef.rank`). */
const RESIDENTS: readonly FaunaKind[] = creatureDefs()
  .filter((d) => d.role === 'resident')
  .sort((a, b) => (a.rank ?? 10) - (b.rank ?? 10) || a.kind.localeCompare(b.kind))
  .map((d) => d.kind);

function pondInfo(scene: SceneGeometry): PondInfo {
  const world = scene.pond.map((p) => ({ x: p.x, y: p.y }));
  const centre = world.length ? polygonCentroid(world) : { x: 800, y: 560 };
  const squash = FAUNA_TUNING.pondSquash;
  const cy = centre.y;
  return { world, plane: world.map((p) => toPlane(p, cy, squash)), cy, squash, centre, bounds: polygonBounds(world) };
}

export class FaunaSim {
  readonly world: FaunaWorld;
  creatures: Creature[] = [];
  readonly schedule: Schedule = new Map();
  roster: Roster = rosterFor([]);
  /** null: follow the clock */
  hourOverride: number | null = null;
  /** the garden's daylight phases decide when it is night (ADR 0141); null: `nightHours` on the clock */
  nightSource: ((now: number) => boolean) | null = null;
  readonly auto: boolean;
  readonly reduced: boolean;
  private ripples: Ripple[] = [];
  private plants: readonly PlantInstance[] = [];
  private lookup: TargetLookup = () => undefined;
  private lively = false;
  private readonly seed: number;
  private nightApplied = false;
  /** simulation seconds (advanced by update; dev `step` and studio presimulation share it) */
  time = 0;
  private lastId = 0;
  readonly rng: Rng;

  constructor(opts: SimOptions) {
    this.rng = createRng(opts.seed).fork('fauna');
    this.seed = opts.seed;
    this.auto = opts.auto ?? true;
    this.reduced = opts.reducedMotion ?? false;
    const scene = opts.scene;
    const pond = pondInfo(scene);
    const mode: FaunaMode = { ...CALM_MODE, reduced: this.reduced };
    const sim = this;
    this.world = {
      t: 0,
      rng: this.rng,
      noise: createSimplex2D(this.rng.fork('noise')),
      scene,
      pond,
      water: waterInfo(scene),
      view: opts.view ?? { x: 0, y: 0, w: 1600, h: 1000 },
      mode,
      speed: this.reduced ? FAUNA_TUNING.reducedSpeed : 1,
      flowers: [],
      perches: perchesOf(scene),
      pads: [],
      art: new ArtCache(),
      perspective: perspectiveFit(scene.slots),
      stands: () => sim.heronStands(),
      ripple: (x, y, size, strength = 1) => sim.addRipple(x, y, size, strength),
      get creatures() {
        return sim.creatures;
      },
    };
  }

  /** Swap in new scene geometry (keeps creatures; residents are re-contained on their next step). */
  setScene(scene: SceneGeometry): void {
    const w = this.world;
    w.scene = scene;
    w.pond = pondInfo(scene);
    w.water = waterInfo(scene);
    w.perches = perchesOf(scene);
    w.perspective = perspectiveFit(scene.slots);
    this.refreshTargets();
  }

  /** Send every creature away at once (another garden on view, ADR 0243); the roster refills it. */
  resetResidents(): void {
    this.creatures = [];
    this.ripples = [];
  }

  setView(view: Rect): void {
    this.world.view = { ...view };
  }

  /** Paint resolution in device px per world unit. */
  setResolution(pxPerUnit: number): void {
    this.world.art.setRes(pxPerUnit);
  }

  /** The garden's plants and its unlocked rows (`unlockedFauna`). */
  setGarden(plants: readonly PlantInstance[], unlocked: readonly RosterRow[], lookup: TargetLookup): void {
    this.plants = plants;
    this.lookup = lookup;
    this.roster = rosterFor(unlocked);
    this.refreshTargets();
  }

  setLively(lively: boolean): void {
    this.lively = lively;
  }

  private refreshTargets(): void {
    const slots = this.world.scene.slots;
    this.world.flowers = flowerTargets(this.plants, slots, this.lookup);
    this.world.pads = lilyPads(this.plants, slots, this.lookup);
    this.stands = null;
  }

  private stands: Stand[] | null = null;

  /** Where a heron could wade right now (away from pads, rocks and far-bank plants; cached). */
  heronStands(): Stand[] {
    this.stands ??= this.computeStands();
    return this.stands;
  }

  private computeStands(): Stand[] {
    const w = this.world;
    const avoid: Pt[] = [...w.pads, ...w.scene.rocks.map((r) => ({ x: r.x, y: r.y - r.h * 0.4 }))];
    // plants growing on the far bank would stand in its way; if they fill it, wade among them
    const slots = new Map(w.scene.slots.map((s) => [s.id, s]));
    const planted = this.plants.map((p) => slots.get(p.slotId)).filter((s): s is NonNullable<typeof s> => !!s && (s.habitat === 'shore' || s.habitat === 'back'));
    const clear = heronStands(w.pond.world, [...avoid, ...planted]);
    return clear.length > 0 ? clear : heronStands(w.pond.world, avoid);
  }

  private addRipple(x: number, y: number, size: number, strength: number): void {
    if (this.ripples.length >= FAUNA_TUNING.maxRipples) this.ripples.shift();
    this.ripples.push({ x, y, age: 0, life: 2.2 + size * 0.03, size, strength, variant: this.rng.int(0, 2) });
  }

  census(): Census {
    const byKind: Census['byKind'] = {};
    let visitors = 0;
    for (const c of this.creatures) {
      if (c.done) continue;
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
      if (c.visitor) visitors++;
    }
    return { byKind, visitors };
  }

  hour(now: number): number {
    return this.hourOverride ?? localHour(now);
  }

  /** Visiting kinds whose targets exist right now. */
  enabledVisitors(): Set<VisitorKind> {
    const w = this.world;
    const out = new Set<VisitorKind>();
    for (const k of this.roster.visitors) {
      const def = creatureDef(k);
      if (!def?.visit || (def.needs && !def.needs(w))) continue;
      out.add(k);
    }
    return out;
  }

  /** Advance by `dt` seconds; `now` (epoch ms, from the Clock) only feeds the time of day. */
  update(dt: number, now: number): void {
    const w = this.world;
    const step = Math.max(0, Math.min(dt, 0.1));
    this.time += step;
    const t = this.time;
    w.t = t;
    const night = this.hourOverride === null && this.nightSource ? this.nightSource(now) : isNight(this.hour(now));
    w.mode = { reduced: this.reduced, lively: this.lively, night, boost: this.roster.boosts };
    if (step <= 0) return;
    if (this.auto) {
      this.upkeepResidents();
      if (w.mode.night !== this.nightApplied) {
        // nightfall sends the diurnal visitors away, daybreak the nocturnal ones
        for (const c of this.creatures) {
          const t = visitTuning(c.kind);
          if (c.visitor && (w.mode.night ? t.diurnal : t.nocturnal)) c.leave(w);
        }
      }
      this.nightApplied = w.mode.night;
      for (const kind of dueVisits(this.schedule, t, this.enabledVisitors(), w.mode, this.census(), this.rng)) {
        const n = Math.max(1, groupSize(kind, this.rng, w.mode, this.census()));
        this.spawn(kind, { forced: false, count: n });
      }
    }
    for (const c of this.creatures) c.update(step, w);
    this.creatures = this.creatures.filter((c) => !c.done);
    for (const r of this.ripples) r.age += step;
    this.ripples = this.ripples.filter((r) => r.age < r.life);
  }

  private upkeepResidents(): void {
    const w = this.world;
    for (const kind of RESIDENTS) {
      const def = creatureDef(kind)!;
      const live = this.creatures.filter((c) => c.kind === kind && !c.forced && !c.done && !(c as { leaving?: boolean }).leaving);
      const want = def.needs && !def.needs(w) ? 0 : residentTarget(kind, this.roster.residents.get(kind) ?? 0, w.mode);
      if (live.length < want) this.spawn(kind, { forced: false });
      else if (live.length > want) live[live.length - 1]!.leave(w);
    }
  }

  /** Bring a creature (or a small group) into the garden now. Returns those spawned. */
  spawn(kind: FaunaKind, opts: SpawnOptions = {}): Creature[] {
    const forced = opts.forced ?? true;
    const count = opts.count ?? 1;
    const def = creatureDef(kind);
    if (!def) return [];
    const made = def.spawn(this.world, {
      count,
      index: this.creatures.filter((c) => c.kind === kind).length,
      seed: hashString(`${kind}-${this.seed}`),
      stay: def.visit ? rangeOf(this.rng, def.visit.stay) * (this.reduced ? 1.5 : 1) : 0,
      variants: this.roster.variants.get(kind) ?? [],
    });
    for (const c of made) {
      c.forced = forced;
      c.id = ++this.lastId;
      this.creatures.push(c);
    }
    return made;
  }

  clear(): void {
    this.creatures = [];
    this.ripples = [];
    this.schedule.clear();
  }

  list(): FaunaListing[] {
    return this.creatures.map((c) => ({ id: c.id, kind: c.kind, x: c.x, y: c.y, layer: c.layer, state: c.state, visitor: c.visitor, variant: c.variant }));
  }

  // -------------------------------------------------------------------------------------------
  // drawing

  private clipWater(ctx: Ctx): void {
    ctx.beginPath();
    for (const poly of this.world.water.clip) {
      poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    }
    ctx.clip();
  }

  private rippleSprite(v: number): Sprite {
    return this.world.art.get(`ripple:${v}`, (res) =>
      paintSprite(res, { w: 72, h: 18, ox: 36, oy: 7 }, 900 + v, (p, rng) => {
        p.ripple({ x: 0, y: 0 }, { rng, width: 62, count: 2, squash: 0.2, opacity: 0.55, light: 0, lineWidth: 1.2, pigment: PIGMENTS.celadonDeep });
      }),
    );
  }

  draw(layer: LayerId, ctx: Ctx): void {
    const w = this.world;
    if (layer === 'underwater' || layer === 'waterSurface') {
      if (w.water.clip.length === 0) return;
      ctx.save();
      this.clipWater(ctx);
      if (layer === 'waterSurface') {
        for (const r of this.ripples) {
          const k = r.age / r.life;
          const s = (r.size / 62) * (0.3 + 0.7 * easeOut(k));
          drawSprite(ctx, this.rippleSprite(r.variant), r.x, r.y, 0, s, s, r.strength * (1 - k) ** 1.4);
        }
      }
      for (const c of this.creatures) c.draw(layer, ctx, w);
      ctx.restore();
      return;
    }
    if (layer === 'air') for (const c of this.creatures) c.draw(layer, ctx, w);
  }

  entities(): Drawable[] {
    const out: Drawable[] = [];
    const w = this.world;
    for (const c of this.creatures) {
      const d = c.depth();
      if (d !== null) out.push({ depth: d, draw: (ctx) => c.draw('entities', ctx, w) });
    }
    return out;
  }
}
