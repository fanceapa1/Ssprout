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
import { spawnCreatures, warmArt } from './creatures';
import { easeOut, localHour, polygonBounds, polygonCentroid, rangeOf, toPlane } from './math';
import { rosterFor, type Roster } from './roster';
import { CALM_MODE, dueVisits, groupSize, isNight, residentTarget, type Census, type FaunaMode, type Schedule } from './schedule';
import { ArtCache, drawSprite, paintSprite, type Sprite } from './sprite';
import { flowerTargets, heronStands, lilyPads, perchesOf, perspectiveFit, type TargetLookup } from './targets';
import { FAUNA_TUNING, VISITS, type FaunaKind, type VisitorKind } from './tuning';
import type { Creature, Ctx, FaunaWorld, PondInfo } from './types';

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
}

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
  readonly auto: boolean;
  readonly reduced: boolean;
  private ripples: Ripple[] = [];
  private plants: readonly PlantInstance[] = [];
  private lookup: TargetLookup = () => undefined;
  private lively = false;
  private koiSeed: number;
  private nightApplied = false;
  readonly rng: Rng;

  constructor(opts: SimOptions) {
    this.rng = createRng(opts.seed).fork('fauna');
    this.koiSeed = hashString(`koi-${opts.seed}`);
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
      view: opts.view ?? { x: 0, y: 0, w: 1600, h: 1000 },
      mode,
      speed: this.reduced ? FAUNA_TUNING.reducedSpeed : 1,
      flowers: [],
      perches: perchesOf(scene),
      pads: [],
      art: new ArtCache(),
      perspective: perspectiveFit(scene.slots),
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
    w.perches = perchesOf(scene);
    w.perspective = perspectiveFit(scene.slots);
    this.refreshTargets();
  }

  setView(view: Rect): void {
    this.world.view = { ...view };
  }

  /** Paint resolution in device px per world unit. */
  setResolution(pxPerUnit: number): void {
    this.world.art.setRes(pxPerUnit);
  }

  setGarden(plants: readonly PlantInstance[], unlocked: readonly string[], lookup: TargetLookup): void {
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
  }

  /** Where a heron could wade right now (away from pads and rocks). */
  heronStands() {
    const avoid: Pt[] = [...this.world.pads, ...this.world.scene.rocks.map((r) => ({ x: r.x, y: r.y - r.h * 0.4 }))];
    return heronStands(this.world.pond.world, avoid);
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
      if ((k === 'bee' || k === 'butterfly') && w.flowers.length === 0) continue;
      if (k === 'bird' && w.perches.length === 0) continue;
      if (k === 'heron' && this.heronStands().length === 0) continue;
      if ((k === 'leaf' || k === 'heron') && w.pond.world.length < 3) continue;
      out.add(k);
    }
    return out;
  }

  update(dt: number, t: number, now: number): void {
    const w = this.world;
    w.t = t;
    w.mode = { reduced: this.reduced, lively: this.lively, night: isNight(this.hour(now)), birdBoost: this.roster.birdBoost };
    if (dt <= 0) return;
    if (this.auto) {
      this.upkeepResidents();
      if (w.mode.night && !this.nightApplied) {
        for (const c of this.creatures) if (c.kind !== 'leaf' && c.visitor && VISITS[c.kind as VisitorKind]?.diurnal) c.leave(w);
      }
      this.nightApplied = w.mode.night;
      for (const kind of dueVisits(this.schedule, t, this.enabledVisitors(), w.mode, this.census(), this.rng)) {
        const n = Math.max(1, groupSize(kind, this.rng, w.mode, this.census()));
        this.spawn(kind, { forced: false, count: n });
      }
      warmArt(this.roster, w);
    }
    for (const c of this.creatures) c.update(dt, w);
    this.creatures = this.creatures.filter((c) => !c.done);
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < r.life);
  }

  private upkeepResidents(): void {
    const w = this.world;
    const live = (k: FaunaKind) => this.creatures.filter((c) => c.kind === k && !c.forced && !c.done && !(c as { leaving?: boolean }).leaving);
    // koi: one per unlocked koi, each with its own seeded pattern
    const koi = live('koi');
    const wantKoi = residentTarget('koi', this.roster.koi, w.mode);
    if (koi.length < wantKoi) this.spawn('koi', { forced: false });
    else if (koi.length > wantKoi) koi[koi.length - 1]!.leave(w);
    const striders = live('strider');
    const wantS = residentTarget('strider', this.roster.striders ? 1 : 0, w.mode);
    if (striders.length < wantS && w.pond.world.length >= 3) this.spawn('strider', { forced: false });
    else if (striders.length > wantS) striders[striders.length - 1]!.leave(w);
    const frogs = live('frog');
    const wantFrog = this.roster.frog && w.pads.length > 0 ? 1 : 0;
    if (frogs.length < wantFrog) this.spawn('frog', { forced: false });
    else if (frogs.length > wantFrog) frogs[0]!.leave(w);
  }

  /** Bring a creature (or a small group) into the garden now. Returns those spawned. */
  spawn(kind: FaunaKind, opts: SpawnOptions = {}): Creature[] {
    const forced = opts.forced ?? true;
    const count = opts.count ?? 1;
    const koiIndex = this.creatures.filter((c) => c.kind === 'koi').length;
    const made = spawnCreatures(kind, this.world, {
      count,
      koiSeed: this.koiSeed,
      koiIndex,
      stands: kind === 'heron' ? this.heronStands() : [],
      stay: kind in VISITS ? rangeOf(this.rng, VISITS[kind as VisitorKind].stay) * (this.reduced ? 1.5 : 1) : 0,
    });
    for (const c of made) {
      c.forced = forced;
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
    return this.creatures.map((c) => ({ id: c.id, kind: c.kind, x: c.x, y: c.y, layer: c.layer, state: c.state, visitor: c.visitor }));
  }

  // -------------------------------------------------------------------------------------------
  // drawing

  private clipPond(ctx: Ctx): void {
    const pond = this.world.pond.world;
    ctx.beginPath();
    pond.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
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
      if (w.pond.world.length < 3) return;
      ctx.save();
      this.clipPond(ctx);
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
