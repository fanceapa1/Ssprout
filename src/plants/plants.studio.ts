import { createRng } from '../core/rng';
import { FIXTURE_SPECIES } from '../dev/fixture-species';
import { createPainter, makeCanvas, PIGMENTS, type Pt } from '../paint';
import type { StudioEntry, StudioSection } from '../studio/types';
import { drawPlant } from './draw';
import { DAB_BOX, dabAlpha, highlightDab } from './highlight';
import { drawReflection, reflectionImage } from './reflection';
import { allSpecies, getSpecies } from './registry';
import { FINAL_STEP, paintSprite, spriteKey } from './sprites';
import type { SpeciesDef } from './types';
import { renderPlantView, setPlantViewSpecies } from './view';
import { canSprite, WATERING_SECONDS } from './watering';
import { WITHER_SECONDS } from './wither';

/**
 * Studio · Plants: the watering moment over several species (animated, plus a strip of key
 * poses), the wither, a growth timelapse for every registered species, a pond reflection demo,
 * the painted jōro on its own and the placement highlight. The dev fixture species are included
 * so the animations can be reviewed before every real species exists.
 */

const fixtures = new Map(FIXTURE_SPECIES.map((s) => [s.id, s]));
setPlantViewSpecies((id) => fixtures.get(id));
const lookup = (id: string): SpeciesDef | undefined => getSpecies(id) ?? fixtures.get(id);

const real = allSpecies();
/** a few contrasting plants for the watering/wither reviews: real ones first, fixtures to fill */
const showcase: string[] = [...real.map((s) => s.id), 'fx-iris', 'fx-bellflower', 'fx-hydrangea', 'fx-violet', 'fx-cherry'].slice(0, 5);

const VIEW_W = 220;
const VIEW_H = 240;

/** Hold the end of a loop for a moment so the eye can rest. */
const loop = (t: number, period: number, active: number) => Math.min(1, (t % period) / active);

function viewEntry(id: string, label: string, render: (canvas: HTMLCanvasElement, t: number, seed: number) => void, animated = true): StudioEntry {
  return { id, label, w: VIEW_W, h: VIEW_H, animated, render: (canvas, { t, seed }) => render(canvas, t, seed) };
}

const watering: StudioEntry[] = showcase.map((sid) =>
  viewEntry(`water-${sid}`, `watering · ${lookup(sid)?.name ?? sid} (growth 0.55)`, (canvas, t, seed) => {
    const u = ((t % (WATERING_SECONDS + 1.1)) - 0.4) / WATERING_SECONDS;
    renderPlantView(canvas, { speciesId: sid, seed, growth: 0.55, watering: u > 0 && u < 1 ? u : null });
  }),
);

const poses = [0.12, 0.3, 0.45, 0.58, 0.72, 0.9].map((u) =>
  viewEntry(
    `pose-${u}`,
    `watering at u = ${u}`,
    (canvas, _t, seed) => renderPlantView(canvas, { speciesId: showcase[0]!, seed, growth: 0.6, watering: u }),
    false,
  ),
);

const wither: StudioEntry[] = showcase.slice(0, 3).map((sid) =>
  viewEntry(`wither-${sid}`, `wither · ${lookup(sid)?.name ?? sid} (3 s)`, (canvas, t, seed) => {
    const u = ((t % (WITHER_SECONDS + 1.4)) - 0.6) / WITHER_SECONDS;
    renderPlantView(canvas, { speciesId: sid, seed, growth: 0.45, watering: null, wilt: Math.max(0, Math.min(1, u)) });
  }),
);

const growthLoops = (defs: readonly SpeciesDef[]): StudioEntry[] =>
  defs.map((d) =>
    viewEntry(`grow-${d.id}`, `${d.name}: 0 → 1 (6 s, cross-faded steps)`, (canvas, t, seed) =>
      renderPlantView(canvas, { speciesId: d.id, seed, growth: loop(t, 7, 6), watering: null }),
    ),
  );

const pondCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
function pond(w: number, h: number, seed: number) {
  const key = `${w}x${h}:${seed}`;
  let c = pondCache.get(key);
  if (!c) {
    c = makeCanvas(w, h);
    const p = createPainter(c, { seed });
    const shore = h * 0.52;
    p.wash([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: shore + 6 }, { x: 0, y: shore + 4 }], PIGMENTS.sageLight, { opacity: 0.45, rng: createRng(seed) });
    const water: Pt[] = [{ x: -10, y: shore }, { x: w + 10, y: shore - 4 }, { x: w + 10, y: h + 10 }, { x: -10, y: h + 10 }];
    p.waterBody(water, { rng: createRng(seed).fork('w') });
    pondCache.set(key, c);
  }
  return c;
}

const reflectionDemo: StudioEntry[] = [showcase[0]!, 'fx-iris', 'fx-lotus'].map((sid, i) => ({
  id: `reflection-${i}`,
  label: `reflection · ${lookup(sid)?.name ?? sid} on the shore`,
  w: 260,
  h: 260,
  animated: true,
  render(canvas, { t, seed, pixelRatio }) {
    const def = lookup(sid);
    if (!def) return;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(pond(canvas.width, canvas.height, seed), 0, 0);
    ctx.scale(pixelRatio, pixelRatio);
    const scale = Math.min(200 / def.size.w, 120 / def.size.h);
    const w = def.size.w * scale;
    const h = def.size.h * scale;
    const axis = 260 * 0.52;
    const box = { x: 130 - def.anchor.x * w, y: axis - def.anchor.y * h, w, h };
    const spec = { speciesId: def.id, seed, step: FINAL_STEP, w: Math.round(w * pixelRatio), h: Math.round(h * pixelRatio) };
    const sprite = spriteFor(def, spec);
    if (!sprite) return;
    const refl = reflectionImage(spriteKey(spec), sprite, spec.w, spec.h, seed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, axis, 260, 260 - axis);
    ctx.clip();
    if (refl) drawReflection(ctx, { image: refl, box, axis, sway: 0, alpha: 1, phase: 0.4 }, t, false);
    ctx.restore();
    drawPlant(ctx, sprite, box, 130, axis, { lean: 0.03 * Math.sin(t * 0.7), bend: 1.3, scaleY: 1, alpha: 1 });
  },
}));

const spriteCache = new Map<string, HTMLCanvasElement | OffscreenCanvas | null>();
function spriteFor(def: SpeciesDef, spec: Parameters<typeof spriteKey>[0]) {
  const key = spriteKey(spec);
  if (!spriteCache.has(key)) spriteCache.set(key, paintSprite(def, spec)?.canvas ?? null);
  return spriteCache.get(key) ?? null;
}

const can: StudioEntry = {
  id: 'joro',
  label: 'the jōro (copper, brass rose), as painted',
  w: 320,
  h: 250,
  render(canvas, { pixelRatio }) {
    const s = canSprite(130 * pixelRatio);
    if (!s) return;
    const ctx = canvas.getContext('2d')!;
    const w = s.canvas.width / pixelRatio;
    const h = s.canvas.height / pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);
    ctx.drawImage(s.canvas, (320 - w) / 2 + 10, (250 - h) / 2, w, h);
  },
};

const dabs: StudioEntry = {
  id: 'placement-dabs',
  label: 'placement highlight: idle (breathing), focused, selected',
  w: 360,
  h: 120,
  animated: true,
  render(canvas, { t, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(pixelRatio, pixelRatio);
    const states = ['idle', 'focused', 'selected'] as const;
    states.forEach((st, i) => {
      const w = 86 * (st === 'idle' ? 1 : 1.15);
      const dab = highlightDab(w * pixelRatio);
      if (!dab) return;
      const hh = (w * DAB_BOX.h) / DAB_BOX.w;
      ctx.globalAlpha = dabAlpha(t, i, st, false);
      ctx.drawImage(dab, 60 + i * 120 - w / 2, 64 - hh / 2, w, hh);
    });
    ctx.globalAlpha = 1;
  },
};

const sections: StudioSection[] = [
  { id: 'plants-watering', title: 'Plants · watering', order: 250, entries: [...watering, can, ...poses] },
  { id: 'plants-wither', title: 'Plants · wither', order: 251, entries: wither },
  {
    id: 'plants-growth',
    title: 'Plants · growth timelapse',
    order: 252,
    entries: growthLoops([...allSpecies(), ...FIXTURE_SPECIES.slice(0, 4)]),
  },
  { id: 'plants-reflection', title: 'Plants · reflections & placement', order: 253, entries: [...reflectionDemo, dabs] },
];

export default sections;
