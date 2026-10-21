/**
 * Studio entries for the paint engine: every primitive (several seeds side by side), the
 * recipes, and small test vignettes composed only from the engine.
 */
import { createRng, type Rng } from '../core/rng';
import type { StudioEntry, StudioSection } from '../studio/types';
import {
  FOLIAGE_GREEN,
  PIGMENTS,
  createPainter,
  createSimplex2D,
  fbm,
  lighten,
  mix,
  paperGrain,
  paperTexture,
  shade,
  type AnyCanvas,
  type Painter,
  type Pt,
} from './index';

const paperCache = new Map<string, AnyCanvas>();

/**
 * Same pipeline as the garden: paint on white, then multiply the washi texture over the
 * finished frame (renderer `paper` layer). Returns a painter in logical units and `finish`.
 */
function ground(canvas: HTMLCanvasElement, seed: number, pixelRatio: number): { p: Painter; rng: Rng; finish: () => void } {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const p = createPainter(canvas, { seed });
  p.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const finish = () => {
    const key = `${canvas.width}x${canvas.height}`;
    let paper = paperCache.get(key);
    if (!paper) {
      paper = paperTexture(canvas.width, canvas.height, 1);
      paperCache.set(key, paper);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(paper as CanvasImageSource, 0, 0);
    ctx.restore();
  };
  return { p, rng: createRng(seed), finish };
}

/** Draw `n` variants side by side, each with its own forked rng; `cell(p, rng, cx, cy, w, h)`. */
function variants(
  id: string,
  label: string,
  n: number,
  cell: (p: Painter, rng: Rng, x: number, y: number, w: number, h: number, i: number) => void,
  w = 760,
  h = 200,
): StudioEntry {
  return {
    id,
    label,
    w,
    h,
    render(canvas, { seed, pixelRatio }) {
      const { p, rng, finish } = ground(canvas, seed, pixelRatio);
      const cw = w / n;
      for (let i = 0; i < n; i++) cell(p, rng.fork(`${id}-${i}`), cw * i + cw / 2, h / 2, cw, h, i);
      finish();
    },
  };
}

function scene(id: string, label: string, w: number, h: number, paint: (p: Painter, rng: Rng) => void): StudioEntry {
  return {
    id,
    label,
    w,
    h,
    render(canvas, { seed, pixelRatio }) {
      const { p, rng, finish } = ground(canvas, seed, pixelRatio);
      paint(p, rng);
      finish();
    },
  };
}

const ROUND = (cx: number, cy: number, rx: number, ry: number) => ({ cx, cy, rx, ry });

// ---------------------------------------------------------------------------------------------
// primitives

const primitives: StudioEntry[] = [
  {
    id: 'paper',
    label: 'paperTexture — washi ground (multiply over the frame)',
    w: 760,
    h: 200,
    render(canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
    },
  },
  {
    id: 'noise',
    label: 'fbm noise (left) · paper grain tile (right)',
    w: 760,
    h: 200,
    render(canvas, { seed }) {
      const ctx = canvas.getContext('2d')!;
      const W = canvas.width;
      const H = canvas.height;
      const img = ctx.createImageData(W, H);
      const n = createSimplex2D(createRng(seed));
      const g = paperGrain(1);
      const sx = 760 / W;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = x < W / 2 ? fbm(n, (x * sx) / 60, (y * sx) / 60) * 0.5 + 0.5 : g.sample(x, y);
          const i = (y * W + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
  },
  {
    id: 'palette',
    label: 'pigments — the palette as small washes',
    w: 760,
    h: 230,
    render(canvas, { seed, pixelRatio }) {
      const { p, rng, finish } = ground(canvas, seed, pixelRatio);
      const names = Object.keys(PIGMENTS) as (keyof typeof PIGMENTS)[];
      const cols = 9;
      names.forEach((name, i) => {
        const x = 45 + (i % cols) * 84;
        const y = 50 + Math.floor(i / cols) * 70;
        p.wash(ROUND(x, y, 30, 18), PIGMENTS[name], { rng: rng.fork(name), opacity: 0.9 });
        p.ctx.fillStyle = PIGMENTS.sumi;
        p.ctx.font = '11px Georgia, serif';
        p.ctx.textAlign = 'center';
        p.ctx.fillText(name, x, y + 33);
      });
      finish();
    },
  },
  variants('wash', 'wash — plain · lost edge · 2 blooms · wet-in-wet drops', 4, (p, rng, x, y, _w, _h, i) => {
    const pig = [PIGMENTS.sap, PIGMENTS.celadon, PIGMENTS.stoneWarm, PIGMENTS.sakuraLight][i]!;
    p.wash(ROUND(x, y, 70, 55), pig, {
      rng,
      fade: i === 1 ? { angle: 0.3, start: 0.35 } : undefined,
      blooms: i === 2 ? 2 : 0,
      drops: i === 3 ? [{ pigment: PIGMENTS.iris, size: 0.45 }] : undefined,
    });
  }),
  variants('wash-seeds', 'wash — same call, four seeds (sage)', 4, (p, rng, x, y) => {
    p.wash(ROUND(x, y, 72, 50), PIGMENTS.sage, { rng, opacity: 0.7 });
  }),
  variants('glaze', 'glaze — transparent layers over a wash (shadow fading up)', 3, (p, rng, x, y, _w, _h, i) => {
    p.wash(ROUND(x, y, 80, 55), [PIGMENTS.sageLight, PIGMENTS.celadon, PIGMENTS.stone][i]!, { rng, opacity: 0.7 });
    p.glaze(ROUND(x + 25, y + 20, 70, 40), shade(PIGMENTS.stone, 0.4), { rng, fade: -Math.PI / 2, opacity: 0.45 });
  }),
  variants('wet-in-wet', 'wetInWet — stone→moss · celadon→sage · sakura→iris · sky', 4, (p, rng, x, y, _w, _h, i) => {
    const pairs: [string, string, number][] = [
      [PIGMENTS.stone, PIGMENTS.sage, -Math.PI / 2],
      [PIGMENTS.celadon, PIGMENTS.sap, Math.PI / 2],
      [PIGMENTS.sakura, PIGMENTS.iris, 0.4],
      [lighten(PIGMENTS.bellflower, 0.3), PIGMENTS.washiDeep, Math.PI / 2],
    ];
    const [a, b, ang] = pairs[i]!;
    p.wetInWet(ROUND(x, y, 72, 55), a, b, { rng, angle: ang });
  }),
  variants('granulate', 'granulate — strength 0.3 · 0.6 · 0.9 over a stone wash', 3, (p, rng, x, y, _w, _h, i) => {
    const s = ROUND(x, y, 80, 55);
    p.wash(s, PIGMENTS.stone, { rng, opacity: 0.6, granulation: 0.2 });
    p.granulate(s, PIGMENTS.stoneDark, { rng, strength: 0.3 + i * 0.3 });
  }),
  variants('dab', 'dab — leaf · petal · blade · needle · round', 5, (p, rng, x, y, _w, _h, i) => {
    const variant = (['leaf', 'petal', 'blade', 'needle', 'round'] as const)[i]!;
    const pig = [PIGMENTS.sage, PIGMENTS.sakura, PIGMENTS.sap, PIGMENTS.olive, PIGMENTS.sageLight][i]!;
    const count = variant === 'needle' ? 14 : variant === 'petal' ? 5 : 6;
    const len = { leaf: 38, petal: 30, blade: 70, needle: 34, round: 22 }[variant];
    const base = { x, y: variant === 'blade' || variant === 'needle' ? y + 60 : y + (variant === 'petal' ? 0 : 30) };
    for (let k = 0; k < count; k++) {
      const a =
        variant === 'petal'
          ? (k / count) * Math.PI * 2 + rng.range(-0.15, 0.15)
          : -Math.PI / 2 + ((k - (count - 1) / 2) / count) * (variant === 'needle' ? 1.6 : 1.9);
      const at: Pt = variant === 'round' ? { x: x + rng.range(-40, 30), y: y + rng.range(-45, 30) } : base;
      p.dab(at, pig, { rng, variant, angle: a, length: len * rng.range(0.8, 1.1), curve: variant === 'blade' ? rng.range(-0.35, 0.35) : rng.range(-0.15, 0.15) });
    }
    if (variant === 'petal') p.dab({ x: x - 3, y: y - 3 }, PIGMENTS.gold, { rng, variant: 'round', length: 8, angle: 0 });
  }),
  variants('stroke', 'stroke — wet · pressure swell · wobbly · dry-ish', 4, (p, rng, x, y, _w, _h, i) => {
    const pts: Pt[] = [
      { x: x - 70, y: y + 40 },
      { x: x - 20, y: y - 10 },
      { x: x + 30, y: y + 10 },
      { x: x + 70, y: y - 45 },
    ];
    p.stroke(pts, {
      rng,
      pigment: [PIGMENTS.sage, PIGMENTS.iris, PIGMENTS.celadonDeep, PIGMENTS.wood][i],
      width: [10, 14, 7, 12][i],
      wetness: [0.9, 0.5, 0.4, 0.2][i],
      pressure: i === 1 ? [0.3, 1, 0.6, 1.1, 0.2] : undefined,
      wobble: i === 2 ? 1 : 0.4,
      dryness: i === 3 ? 0.3 : 0,
    });
  }),
  variants('ink-line', 'inkLine — stems, a trunk, eaves (sumi #4a443c, broken, tapered)', 4, (p, rng, x, y, _w, _h, i) => {
    if (i === 0) {
      for (let k = 0; k < 3; k++) p.inkLine([{ x: x - 30 + k * 25, y: y + 80 }, { x: x - 25 + k * 22, y: y }, { x: x - 35 + k * 30, y: y - 75 }], { rng, width: 1.3 });
    } else if (i === 1) {
      p.inkLine([{ x, y: y + 85 }, { x: x + 6, y: y + 20 }, { x: x - 4, y: y - 30 }, { x: x + 10, y: y - 80 }], { rng, width: 4.5, pressure: [1.2, 1, 0.7, 0.4] });
      p.inkLine([{ x: x + 3, y: y + 5 }, { x: x + 30, y: y - 25 }, { x: x + 55, y: y - 35 }], { rng, width: 2 });
      p.inkLine([{ x: x - 2, y: y - 20 }, { x: x - 30, y: y - 50 }, { x: x - 45, y: y - 52 }], { rng, width: 1.6 });
    } else if (i === 2) {
      for (let k = 0; k < 4; k++) p.inkLine([{ x: x - 80, y: y - 40 + k * 22 }, { x: x + 80, y: y - 48 + k * 24 }], { rng, width: 1.2 + k * 0.3, breaks: 0.3 });
    } else {
      p.inkLine([{ x: x - 70, y: y + 50 }, { x: x - 20, y: y + 20 }, { x: x + 20, y: y - 30 }, { x: x + 75, y: y - 60 }], { rng, width: 2.4, wobble: 0.8, pressureVar: 0.6 });
    }
  }),
  variants('dry-brush', 'dryBrush — grass bank · bark · path edge', 3, (p, rng, x, y, _w, _h, i) => {
    if (i === 0) {
      for (let k = 0; k < 4; k++) p.dryBrush([{ x: x - 100, y: y - 30 + k * 18 }, { x: x - 10, y: y - 36 + k * 18 }, { x: x + 100, y: y - 28 + k * 19 }], { rng, pigment: k % 2 ? PIGMENTS.sage : PIGMENTS.sap, width: 16 });
    } else if (i === 1) {
      p.dryBrush([{ x: x - 8, y: y + 85 }, { x: x + 2, y: y }, { x: x - 6, y: y - 85 }], { rng, pigment: PIGMENTS.wood, width: 22, dryness: 0.55 });
      p.inkLine([{ x: x - 16, y: y + 85 }, { x: x - 8, y: y }, { x: x - 16, y: y - 85 }], { rng, width: 1.4, opacity: 0.7 });
    } else {
      p.dryBrush([{ x: x - 110, y: y + 20 }, { x: x, y: y + 10 }, { x: x + 110, y: y + 25 }], { rng, pigment: PIGMENTS.stoneWarm, width: 26, dryness: 0.7 });
    }
  }, 760, 200),
  variants('splatter', 'splatter — rare, subtle', 3, (p, rng, x, y, _w, _h, i) => {
    p.splatter({ x, y }, { rng, pigment: [PIGMENTS.sage, PIGMENTS.sakura, PIGMENTS.stoneDark][i], count: 7, radius: 40 });
  }),
  {
    id: 'ripple',
    label: 'ripple — over a celadon wash',
    w: 760,
    h: 200,
    render(canvas, { seed, pixelRatio }) {
      const { p, rng, finish } = ground(canvas, seed, pixelRatio);
      p.wash([{ x: 20, y: 40 }, { x: 740, y: 30 }, { x: 745, y: 170 }, { x: 15, y: 175 }], PIGMENTS.celadon, { rng, opacity: 0.7, edge: 0.3 });
      for (let i = 0; i < 4; i++) p.ripple({ x: 110 + i * 180, y: 100 + (i % 2) * 20 }, { rng: rng.fork(`r${i}`), width: 90 + i * 15, count: 2 + (i % 2) });
      finish();
    },
  },
  variants('lift', 'lift — lifting pigment back to paper (highlights)', 3, (p, rng, x, y, _w, _h, i) => {
    p.wash(ROUND(x, y, 90, 60), [PIGMENTS.celadonMid, PIGMENTS.sage, PIGMENTS.stone][i]!, { rng, opacity: 0.85 });
    p.lift(ROUND(x - 10, y - 15, 55, i === 0 ? 5 : 18), { rng, amount: 0.6 });
  }),
];

// ---------------------------------------------------------------------------------------------
// recipes

const recipes: StudioEntry[] = [
  variants('foliage-clump', 'foliageClump — sage · pale spring · dark pine', 3, (p, rng, x, y, _w, _h, i) => {
    const pigs = [
      FOLIAGE_GREEN,
      { light: lighten(PIGMENTS.sageLight, 0.1), mid: PIGMENTS.sageLight, shadow: PIGMENTS.sap },
      { light: PIGMENTS.sap, mid: PIGMENTS.sage, shadow: PIGMENTS.olive, dark: mix(PIGMENTS.olive, PIGMENTS.sumi, 0.4) },
    ][i]!;
    p.foliageClump({ x, y }, 85 - i * 8, pigs, { rng });
  }, 760, 220),
  variants('grass-tuft', 'grassTuft — five seeds', 5, (p, rng, x, y) => {
    p.grassTuft({ x, y: y + 60 }, { rng, height: rng.range(40, 70) });
  }),
  variants('stone', 'stone — mossy · bare · flat stepping stone', 3, (p, rng, x, y, _w, _h, i) => {
    const box = [
      { x, y: y + 60, w: 170, h: 105 },
      { x, y: y + 55, w: 140, h: 80 },
      { x, y: y + 40, w: 190, h: 50 },
    ][i]!;
    p.stone(box, { rng, moss: [0.55, 0, 0.1][i], ink: [0.3, 0.35, 0.15][i] });
  }, 760, 220),
  {
    id: 'water-body',
    label: 'waterBody — pond strip',
    w: 760,
    h: 240,
    render(canvas, { seed, pixelRatio }) {
      const { p, rng, finish } = ground(canvas, seed, pixelRatio);
      p.waterBody(pondShape(380, 120, 340, 90, rng), { rng, ripples: 3 });
      finish();
    },
  },
];

function pondShape(cx: number, cy: number, rx: number, ry: number, rng: Rng): Pt[] {
  const pts: Pt[] = [];
  const n = 40;
  const ph = rng.range(0, 6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.07 * Math.sin(a * 2 + ph) + 0.04 * Math.sin(a * 5 + ph * 2);
    pts.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r * (Math.sin(a) < 0 ? 0.8 : 1) });
  }
  return pts;
}

// ---------------------------------------------------------------------------------------------
// vignettes — proof that the engine alone can carry the look

const vignettes: StudioEntry[] = [
  scene('boulder-pond', 'vignette — mossy boulder at the pond edge', 560, 380, (p, rng) => {
    // bank
    p.wash([{ x: -20, y: 150 }, { x: 300, y: 130 }, { x: 590, y: 160 }, { x: 590, y: 400 }, { x: -20, y: 400 }], PIGMENTS.sageLight, { rng, opacity: 0.6, edge: 0.3, fade: { angle: Math.PI / 2, start: 0.55, amount: 0.8 } });
    p.dryBrush([{ x: 0, y: 165 }, { x: 250, y: 150 }, { x: 560, y: 170 }], { rng, pigment: PIGMENTS.sap, width: 14, dryness: 0.55 });
    // water
    p.waterBody(pondShape(370, 280, 230, 70, rng.fork('pond')), { rng, ripples: 2 });
    // boulder sitting into the water's edge
    p.stone({ x: 190, y: 315, w: 210, h: 130 }, { rng, moss: 0.5 });
    p.stone({ x: 470, y: 232, w: 90, h: 42 }, { rng, moss: 0.15 });
    for (const [x, y, h] of [[60, 310, 50], [100, 345, 40], [330, 372, 34], [530, 200, 30]] as const) p.grassTuft({ x, y }, { rng, height: h });
  }),
  scene('tree-crown', 'vignette — foliage tree crown with a thin ink trunk', 560, 380, (p, rng) => {
    p.glaze({ cx: 280, cy: 352, rx: 220, ry: 24 }, PIGMENTS.sageLight, { rng, opacity: 0.4, fade: { angle: -Math.PI / 2, start: 0.3 } });
    const bark = mix(PIGMENTS.wood, PIGMENTS.sumi, 0.2);
    // trunk: forks low into two limbs, like a garden maple
    const trunk: Pt[] = [{ x: 270, y: 354 }, { x: 274, y: 300 }, { x: 266, y: 252 }];
    const limbs: Pt[][] = [
      [{ x: 266, y: 252 }, { x: 250, y: 200 }, { x: 236, y: 150 }, { x: 246, y: 108 }],
      [{ x: 266, y: 252 }, { x: 296, y: 214 }, { x: 318, y: 176 }, { x: 330, y: 150 }],
    ];
    const pads: [number, number, number][] = [
      [250, 92, 64],
      [160, 150, 50],
      [365, 128, 58],
      [120, 212, 38],
      [410, 196, 42],
      [300, 176, 34],
    ];
    p.stroke(trunk, { rng, pigment: bark, width: 7, wetness: 0.3, wobble: 0.2, taper: [0, 0], pressure: [1.25, 1.05, 0.95] });
    for (const l of limbs) p.stroke(l, { rng, pigment: bark, width: 5, wetness: 0.3, wobble: 0.2, taper: [0, 0.6], pressure: [1, 0.8, 0.6, 0.4] });
    // branches reach the underside of each pad, with a twig or two into it
    for (const [x, y, r] of pads) {
      const from = (x < 266 ? limbs[0]! : limbs[1]!)[rng.int(1, 2)]!;
      const end = { x: x + rng.range(-0.15, 0.15) * r, y: y + r * 0.18 };
      const mid = { x: (from.x + end.x) / 2 + rng.range(-6, 6), y: Math.min(from.y, end.y) + Math.abs(end.x - from.x) * 0.05 + 6 };
      p.inkLine([from, mid, end], { rng, width: 1.7, pressure: [1.2, 0.8, 0.35], pigment: bark });
      for (let k = 0; k < 2; k++) {
        const tx = end.x + rng.range(-0.5, 0.5) * r;
        p.inkLine([end, { x: (end.x + tx) / 2, y: end.y - r * 0.12 }, { x: tx, y: end.y - r * rng.range(0.15, 0.3) }], { rng, width: 1, pressure: [1, 0.4], pigment: bark, opacity: 0.7 });
      }
    }
    for (const [x, y, r] of pads) p.foliageClump({ x, y }, r, FOLIAGE_GREEN, { rng, flatness: 0.56 });
    // shadow-side accent on the trunk, broken
    p.inkLine(trunk.map((q) => ({ x: q.x - 2.4, y: q.y })), { rng, width: 1.3, opacity: 0.6, breaks: 0.4 });
    p.grassTuft({ x: 252, y: 356 }, { rng, height: 30 });
    p.grassTuft({ x: 298, y: 354 }, { rng, height: 22 });
  }),
  scene('grass-bank', 'vignette — grass tufts on a bank', 560, 380, (p, rng) => {
    const bank: Pt[] = [{ x: -20, y: 170 }, { x: 140, y: 140 }, { x: 330, y: 150 }, { x: 590, y: 120 }, { x: 590, y: 400 }, { x: -20, y: 400 }];
    p.wetInWet(bank, PIGMENTS.sageLight, PIGMENTS.sap, { rng, angle: Math.PI / 2, split: 0.45, opacity: 0.65, edge: 0.35, fade: { angle: Math.PI / 2, start: 0.6, amount: 0.9 } });
    p.dryBrush([{ x: -10, y: 160 }, { x: 150, y: 140 }, { x: 320, y: 152 }, { x: 570, y: 128 }], { rng, pigment: PIGMENTS.sage, width: 12, dryness: 0.6 });
    p.glaze({ cx: 400, cy: 230, rx: 160, ry: 40 }, PIGMENTS.sage, { rng, opacity: 0.25 });
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 58 + rng.range(-15, 15);
      const y = 190 + rng.range(0, 140);
      p.grassTuft({ x, y }, { rng, height: 30 + (y - 180) * 0.25 + rng.range(0, 15) });
    }
    p.splatter({ x: 420, y: 300 }, { rng, pigment: PIGMENTS.sage, count: 4 });
  }),
  scene('pond-strip', 'vignette — strip of pond water with ripples', 560, 380, (p, rng) => {
    p.wash([{ x: -20, y: -20 }, { x: 590, y: -20 }, { x: 590, y: 90 }, { x: -20, y: 105 }], PIGMENTS.sageLight, { rng, opacity: 0.55, edge: 0.3 });
    const pond: Pt[] = [{ x: -20, y: 95 }, { x: 200, y: 82 }, { x: 420, y: 92 }, { x: 590, y: 80 }, { x: 590, y: 330 }, { x: 380, y: 318 }, { x: 150, y: 330 }, { x: -20, y: 320 }];
    p.waterBody(pond, { rng, ripples: 4, bands: 6 });
    p.wash([{ x: -20, y: 325 }, { x: 590, y: 318 }, { x: 590, y: 400 }, { x: -20, y: 400 }], PIGMENTS.sap, { rng, opacity: 0.5, edge: 0.35 });
    p.stone({ x: 470, y: 120, w: 110, h: 55 }, { rng, moss: 0.25 });
  }),
];

const sections: StudioSection[] = [
  { id: 'paint', title: 'Paint · primitives', order: 10, entries: primitives },
  { id: 'paint-recipes', title: 'Paint · recipes', order: 20, entries: recipes },
  { id: 'paint-vignettes', title: 'Paint · test vignettes', order: 30, entries: vignettes },
];

export default sections;
