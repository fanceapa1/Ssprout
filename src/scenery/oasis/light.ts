/**
 * The oasis's light art (O5, ADR 0301): shadows from the bluff, the ksar's towers, the big palms
 * and the terrace walls, always to the left (both low suns stand right, ADR 0300); warm light on
 * the ksar's flanks, the shoulder and the palms at sunrise and sunset; moonlight on the basin at
 * night; and its own golden grades. docs/systems/daylight.md › Oasis.
 */
import type { LightArt } from '../../ambience/cast';
import type { DayPhase } from '../../ambience/daylight';
import { reserveStar, type CastShadow } from '../../ambience/sky-layout';
import type { Grade } from '../../ambience/timeofday';
import type { Rng } from '../../core/rng';
import { blob, type Painter, type Pt } from '../../paint';
import type { SceneGeometry } from '../../scene/geometry';
import { OASIS_SKY_LAYOUT, skylineAt } from './layout';
import { WALL_FACES } from './paint-land';
import { bluffTopAt, ROCK_SHAPES } from './paint-rocks';
import { VEG_SHAPES } from './paint-veg';
import { WATER_BOXES, WATER_SHAPES } from './paint-water';
import { MILKY_WAY, OASIS_NIGHT_STARS } from './sky';

/**
 * The oasis's grades: warmer and more golden than the other gardens' (midday a thin gold rather
 * than bare paper, sunset a deep amber), the glow standing over the notch; night a violet-indigo
 * a touch lighter than the garden's so the sand stays readable.
 */
export const OASIS_GRADES: Record<DayPhase, Grade> = {
  sunrise: { tint: [238, 204, 206], amount: 0.2, sky: 0, ground: 0.85, glow: 0.6, warm: [255, 214, 168], glowX: 0.62, glowY: 0.34, lantern: 0, mottle: 0.16 },
  midday: { tint: [250, 230, 188], amount: 0.09, sky: -0.06, ground: 1, glow: 0, warm: [252, 240, 214], glowX: 0.5, glowY: 0.1, lantern: 0, mottle: 0.12 },
  sunset: { tint: [244, 168, 104], amount: 0.36, sky: -0.06, ground: 1, glow: 0.62, warm: [255, 206, 128], glowX: 0.58, glowY: 0.34, lantern: 0, mottle: 0.16 },
  night: { tint: [90, 98, 178], amount: 0.5, sky: 0.2, ground: 1.15, glow: 0, warm: [236, 214, 170], glowX: 0.5, glowY: 0.3, lantern: 0, mottle: 0.1 },
};

type Rgb = readonly [number, number, number];

/** A feathered dab of warm or cool paper (a lifted wash at plate resolution leaves a pooled ring). */
function dab(p: Painter, x: number, y: number, rx: number, ry: number, a: number, rgb: Rgb): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const c = `${rgb[0]},${rgb[1]},${rgb[2]}`;
  g.addColorStop(0, `rgba(${c},${a})`);
  g.addColorStop(0.55, `rgba(${c},${a * 0.6})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Run `fn` with everything but the basin's water clipped away (or, `outside`, only the water). */
function aroundWater(p: Painter, outside: boolean, fn: () => void): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.beginPath();
  if (outside) ctx.rect(-1e4, -1e4, 2e4, 2e4);
  WATER_SHAPES.basin.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip(outside ? 'evenodd' : 'nonzero');
  fn();
  ctx.restore();
}

const towers = ROCK_SHAPES.ksar.filter((s) => s.block.kind === 'tower');

/**
 * Shadows. Low suns stand right of everything here, so long shadows fall left (as the shared `dx`
 * does with this sun side, ADR 0284); midday leaves short pools under the walls, palms and coping.
 */
function oasisShadows(p: Painter, rng: Rng, _scene: SceneGeometry, sh: CastShadow, pig: string): void {
  const low = Math.abs(sh.dx) > 0.6;
  const a = sh.alpha;
  const dir = Math.sign(sh.dx) || 1;
  const soft = { rng, spread: 0.5, deform: 0.35, edge: 0, edgeWidth: 0 };
  // the terrace walls: the face turned from the sun, and the shade it throws on the terrace below
  for (const face of WALL_FACES) {
    const n = face.length / 2;
    const foot = face.slice(n);
    p.glaze(face, pig, { ...soft, spread: 0.2, opacity: a * (low ? 0.3 : 0.14) });
    const depth = low ? 14 : 7;
    p.glaze([...foot, ...foot.slice().reverse().map((q) => ({ x: q.x - dir * (low ? 10 : 2), y: q.y + depth }))], pig, { ...soft, opacity: a * (low ? 0.4 : 0.28), fade: { angle: Math.PI / 2, start: 0.3, amount: 0.9, ragged: 0.6 } });
  }
  // the basin's far coping shades a strip of water; at a low sun the right coping too
  const [fl, fr, nr] = WATER_SHAPES.basin as [Pt, Pt, Pt, Pt];
  p.glaze([{ x: fl.x, y: fl.y - 2 }, { x: fr.x, y: fr.y - 2 }, { x: fr.x - 6, y: fr.y + (low ? 12 : 7) }, { x: fl.x + 6, y: fl.y + (low ? 12 : 7) }], pig, { ...soft, opacity: a * 0.32 });
  if (low) p.glaze([fr, nr, { x: nr.x - 26, y: nr.y }, { x: fr.x - 18, y: fr.y + 6 }], pig, { ...soft, opacity: a * 0.3, fade: { angle: Math.PI, start: 0.3, amount: 0.9, ragged: 0.5 } });
  // the bluff's foot along the high terrace, deeper when the sun is low
  p.glaze(blob(420, 468, 520, low ? 20 : 12, rng, { irregularity: 0.3 }), pig, { ...soft, spread: 0.8, deform: 0.6, opacity: a * (low ? 0.3 : 0.18), fade: { angle: 0, start: 0.5, amount: 0.8, ragged: 0.7 } });
  paintPalmShadows(p, rng, sh, pig, low, dir);
  if (!low) return;
  // the bluff's left ridge is turned from the low sun: a soft shade fading toward the ksar
  p.glaze([{ x: -80, y: 220 }, { x: 430, y: 300 }, { x: 440, y: 470 }, { x: -80, y: 470 }], pig, {
    ...soft,
    opacity: a * 0.24,
    fade: { angle: 0, start: 0.4, amount: 0.9, ragged: 0.6 },
  });
  // each tower throws its shade left over the house and the wall beside it, and onto the seat
  for (const t of towers) {
    const x0 = t.block.x;
    const top = t.block.base - t.block.h;
    const reach = Math.min(70, t.block.h * 0.5);
    p.glaze(
      [
        { x: x0 + 2, y: top + t.block.h * 0.3 },
        { x: x0 + 2, y: t.block.base + 18 },
        { x: x0 - reach, y: t.block.base + 24 },
        { x: x0 - reach * 0.7, y: top + t.block.h * 0.55 },
      ],
      pig,
      { ...soft, opacity: a * 0.3, fade: { angle: Math.PI, start: 0.35, amount: 0.9, ragged: 0.5 } },
    );
  }
}

/** The big palms' trunks and crowns thrown long across the sand at a low sun, short pools at midday. */
function paintPalmShadows(p: Painter, rng: Rng, sh: CastShadow, pig: string, low: boolean, dir: number): void {
  aroundWater(p, true, () => {
    for (const palm of VEG_SHAPES.bigPalms) {
      const height = palm.base.y - palm.top.y;
      if (!low) {
        p.glaze({ cx: palm.base.x - 4, cy: palm.base.y + 4, rx: palm.width * 2.4, ry: palm.width * 0.7 }, pig, { rng, opacity: sh.alpha * 0.4, deform: 0.4, spread: 0.4 });
        p.glaze({ cx: palm.base.x + 10, cy: palm.base.y + 10, rx: height * 0.2, ry: height * 0.04 }, pig, { rng, opacity: sh.alpha * 0.22, deform: 0.5, spread: 0.5 });
        continue;
      }
      // the sun stands beyond the grove, so the shadows also come toward the viewer
      const reach = Math.min(300, height * Math.abs(sh.dx) * 0.45);
      const end = { x: palm.base.x + dir * reach, y: palm.base.y + 4 + reach * 0.42 };
      p.stroke([palm.base, { x: (palm.base.x + end.x) / 2, y: (palm.base.y + end.y) / 2 + 3 }, end], {
        rng,
        pigment: pig,
        width: palm.width * 1.4,
        opacity: sh.alpha * 0.85,
        dryness: 0.3,
        wetness: 0.6,
        wobble: 0.2,
        taper: [0, 0.5],
      });
      // the crown's ragged blot at the trunk shadow's end
      p.wash({ cx: end.x + dir * height * 0.06, cy: end.y + 2, rx: height * 0.16, ry: height * 0.035 }, pig, {
        rng,
        opacity: sh.alpha * 0.6,
        deform: 0.6,
        spread: 0.35,
        edge: 0.15,
        sharpness: 0.2,
        centreLift: 0.1,
        blooms: 3,
        bloomSize: 0.2,
        fade: { angle: dir > 0 ? 0 : Math.PI, start: 0.5, amount: 0.7, ragged: 0.7 },
      });
    }
  });
}

/** Warm light on what faces the low sun; moonlight on the basin and the pisé at night. */
function oasisLights(p: Painter, rng: Rng, _scene: SceneGeometry, phase: DayPhase): void {
  if (phase === 'sunrise' || phase === 'sunset') {
    const sunset = phase === 'sunset';
    const k = sunset ? 0.62 : 0.45;
    const warm: Rgb = sunset ? [255, 226, 172] : [255, 234, 214];
    const sunX = sunset ? OASIS_SKY_LAYOUT.sunsetX : OASIS_SKY_LAYOUT.sunriseX;
    // the ksar glows: a broad warmth over its fronts, then a rim down each lit flank and parapet
    dab(p, 664, 250, 300, 90, k * 0.75, warm);
    for (const s of ROCK_SHAPES.ksar) {
      const b = s.block;
      const top = b.base - b.h;
      if (s.flank.length) for (let y = top + 8; y < b.base; y += 18) dab(p, b.x + b.w + b.side * 0.5, y, b.side * 1.3, 14, k, warm);
      dab(p, b.x + b.w * 0.75, top + 6, b.w * 0.35, 8, k * 0.7, warm);
    }
    // the shoulder's face turned to the notch, and the left ridge's crown
    for (let y = 340; y <= 470; y += 22) dab(p, 1000 - (470 - y) * 0.35, y, 30, 22, k * 0.8, warm);
    for (let x = 0; x <= 420; x += 40) dab(p, x + rng.range(-6, 6), bluffTopAt(x) + 10, 46, 14, k * 0.5 * (0.4 + x / 700), warm);
    // the far range and the haze under the sun
    dab(p, sunX + 40, skylineAt(sunX) + 10, 300, 40, k * 0.2, warm);
    // the palms: the trunks' right flanks and the crowns' sun side
    for (const palm of VEG_SHAPES.bigPalms) {
      for (let i = 2; i < palm.trunk.length - 2; i++) {
        const q = palm.trunk[i]!;
        dab(p, q.x + palm.width * 0.3, q.y, palm.width * 0.5, 22, k * 0.3, warm);
      }
      dab(p, palm.top.x + 30, palm.top.y + 10, 70, 40, k * 0.45, warm);
    }
    // the basin keeps its turquoise under the warm grade (multiplied amber greys it)
    aroundWater(p, false, () => dab(p, WATER_BOXES.basin.x + WATER_BOXES.basin.w / 2, 560, 340, 90, sunset ? 0.55 : 0.4, [246, 252, 252]));
    return;
  }
  if (phase === 'midday') {
    aroundWater(p, false, () => dab(p, WATER_BOXES.basin.x + WATER_BOXES.basin.w / 2, 560, 340, 90, 0.5, [248, 254, 254]));
    return;
  }
  // night: moonlight on the basin (a cool sheen, brightest under the moon's arc), on the pale
  // coping and the ksar's pisé, and the desert's dense stars left as paper
  const cool: Rgb = [236, 242, 255];
  aroundWater(p, false, () => {
    dab(p, 840, 540, 320, 80, 0.4, cool);
    for (let i = 0; i < 8; i++) dab(p, 900 + rng.range(-120, 120), 500 + i * 15, rng.range(60, 140), 4, 0.5, cool);
  });
  dab(p, 810, 478, 300, 14, 0.35, cool);
  dab(p, 664, 240, 260, 70, 0.22, cool);
  // the Milky Way's glow, then the desert's dense stars left as paper
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    dab(p, MILKY_WAY.x0 + t * (MILKY_WAY.x1 - MILKY_WAY.x0), Math.max(40, MILKY_WAY.y0 + t * (MILKY_WAY.y1 - MILKY_WAY.y0)), 150, 34, 0.16, cool);
  }
  for (const s of OASIS_NIGHT_STARS) if (s.y > 14) reserveStar(p.ctx, s, 0.9);
}

export const OASIS_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: OASIS_SKY_LAYOUT, shadows: oasisShadows, lights: oasisLights, grades: OASIS_GRADES };
