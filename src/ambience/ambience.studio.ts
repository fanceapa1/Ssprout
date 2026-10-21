/**
 * Studio: every ambience effect over a small painted test garden (same pipeline as the
 * renderer: background → water effects → ambience → lighting → paper multiplied last).
 */
import { createRng, type Rng } from '../core/rng';
import type { SessionPhase } from '../core/session';
import type { Weather } from '../core/state';
import { createPainter, lighten, mix, paperTexture, PIGMENTS, shade, type AnyCanvas, type Painter } from '../paint';
import { WORLD_H, WORLD_W } from '../render/viewport';
import { placeholderScene } from '../scene/geometry';
import type { StudioEntry, StudioSection } from '../studio/types';
import { createAmbience, type Ambience } from './ambience';
import type { Emitter } from './motes';
import { NAMED_HOURS } from './timeofday';
import { wind } from './wind';

const scene = placeholderScene;
const W = 800;
const H = 500;

/** A quick painted garden on the scene geometry (the real scene replaces this in the app). */
function paintBackdrop(p: Painter, rng: Rng): void {
  const r = (l: string) => rng.fork(l);
  p.wetInWet(
    [{ x: 0, y: 0 }, { x: 1600, y: 0 }, { x: 1600, y: 470 }, { x: 0, y: 470 }],
    lighten(PIGMENTS.bellflower, 0.55),
    PIGMENTS.washiDeep,
    { rng: r('sky'), opacity: 0.28, edge: 0.1, angle: Math.PI / 2 },
  );
  const hill = (y0: number, amp: number, pig: string, op: number, label: string) => {
    const hr = r(label);
    const pts = [{ x: -40, y: 520 }];
    for (let x = -40; x <= 1640; x += 80) pts.push({ x, y: y0 - amp * Math.sin(x / 420 + hr.range(0, 1)) - hr.range(0, 20) });
    pts.push({ x: 1640, y: 520 });
    p.wash(pts, pig, { rng: hr, opacity: op, fade: { angle: -Math.PI / 2, start: 0.5 } });
  };
  hill(330, 40, lighten(PIGMENTS.sage, 0.35), 0.35, 'hill-far');
  hill(400, 25, PIGMENTS.sageLight, 0.5, 'hill-near');
  p.wash([{ x: -40, y: 430 }, { x: 1640, y: 420 }, { x: 1640, y: 1040 }, { x: -40, y: 1040 }], PIGMENTS.sageLight, {
    rng: r('bank'),
    opacity: 0.45,
    fade: { angle: Math.PI / 2, start: 0.6, amount: 0.6 },
  });
  for (const [x, y, rad] of [[230, 360, 95], [380, 330, 70], [1130, 350, 85], [980, 380, 55]] as const) {
    p.inkLine([{ x: x + 4, y: y + rad * 1.4 }, { x, y: y + rad * 0.5 }], { rng: r(`trunk${x}`), width: 3, pigment: mix(PIGMENTS.wood, PIGMENTS.sumi, 0.4) });
    p.foliageClump({ x, y }, rad, undefined, { rng: r(`tree${x}`), opacity: 0.75 });
  }
  p.waterBody([...scene.pond], { rng: r('pond') });
  // pavilion corner
  const pv = scene.pavilion;
  p.wash([{ x: pv.x, y: pv.y + 90 }, { x: pv.x + pv.w + 20, y: pv.y + 90 }, { x: pv.x + pv.w + 20, y: pv.y + pv.h }, { x: pv.x + 10, y: pv.y + pv.h }], PIGMENTS.woodLight, {
    rng: r('pav'),
    opacity: 0.6,
  });
  p.wash([{ x: pv.x - 70, y: pv.y + 110 }, { x: pv.x + 60, y: pv.y + 20 }, { x: pv.x + pv.w + 30, y: pv.y }, { x: pv.x + pv.w + 30, y: pv.y + 110 }], shade(PIGMENTS.wood, 0.3), {
    rng: r('roof'),
    opacity: 0.8,
  });
  p.inkLine([{ x: pv.x - 70, y: pv.y + 112 }, { x: pv.x + pv.w + 20, y: pv.y + 102 }], { rng: r('eave'), width: 2.4 });
  const L = pv.lantern;
  p.wash({ cx: L.x, cy: L.y + 14, rx: 12, ry: 22 }, PIGMENTS.stone, { rng: r('lantern'), opacity: 0.8 });
  p.wash({ cx: L.x, cy: L.y - 8, rx: 18, ry: 7 }, PIGMENTS.stoneDark, { rng: r('lantern-cap'), opacity: 0.8 });
  for (const rock of scene.rocks) p.stone({ x: rock.x, y: rock.y, w: rock.w, h: rock.h }, { rng: r(rock.id) });
  for (const s of scene.path) p.stone({ cx: s.x, cy: s.y, rx: s.rx, ry: s.ry }, { rng: r(`step${s.x}${s.y}`), moss: 0, groundShadow: false });
  // a few plants
  p.foliageClump({ x: 300, y: 740 }, 55, undefined, { rng: r('shrub') });
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    p.dab({ x: 300 + Math.cos(a) * 38, y: 720 + Math.sin(a) * 18 }, PIGMENTS.sakuraLight, { rng: r(`petal${k}`), variant: 'petal', length: 12, angle: a });
  }
  p.grassTuft({ x: 560, y: 625 }, { rng: r('iris'), height: 70, pigments: [PIGMENTS.sageLight, PIGMENTS.sage, PIGMENTS.olive] });
  for (let k = 0; k < 3; k++) p.dab({ x: 548 + k * 12, y: 570 - k * 6 }, PIGMENTS.iris, { rng: r(`iris${k}`), variant: 'petal', length: 14 });
  p.foliageClump({ x: 1250, y: 780 }, 60, undefined, { rng: r('shrub2') });
  for (let i = 0; i < 14; i++) {
    const g = r(`tuft${i}`);
    p.grassTuft({ x: g.range(80, 1520), y: g.range(660, 980) }, { rng: g, height: g.range(20, 40) });
  }
}

const backdrops = new Map<string, AnyCanvas>();
const papers = new Map<string, AnyCanvas>();

function backdrop(cw: number, ch: number, seed: number): AnyCanvas {
  const key = `${cw}x${ch}:${seed}`;
  let c = backdrops.get(key);
  if (!c) {
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    const p = createPainter(canvas, { seed });
    p.ctx.setTransform(cw / WORLD_W, 0, 0, ch / WORLD_H, 0, 0);
    paintBackdrop(p, createRng(seed).fork('backdrop'));
    c = canvas;
    backdrops.set(key, c);
  }
  return c;
}

function paper(cw: number, ch: number): AnyCanvas {
  const key = `${cw}x${ch}`;
  let c = papers.get(key);
  if (!c) {
    c = paperTexture(cw, ch, 1);
    papers.set(key, c);
  }
  return c;
}

/** Plants painted in the backdrop, as mote emitters (the shore iris is the growing one). */
const EMITTERS: Emitter[] = [
  { x: 300, y: 760, w: 90, h: 70, weight: 1 },
  { x: 1250, y: 800, w: 100, h: 80, weight: 1 },
  { x: 560, y: 625, w: 40, h: 70, weight: 3 },
];

interface Scenario {
  phase: (t: number) => SessionPhase;
  weather: Weather | null;
  hour: (t: number) => number;
  preview?: Weather | null;
}

/** One engine per entry + seed, stepped with the studio's dt. */
const engines = new Map<string, { amb: Ambience; seed: number; frame: number }>();

function composite(canvas: HTMLCanvasElement, amb: Ambience, seed: number) {
  const ctx = canvas.getContext('2d')!;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(backdrop(cw, ch, seed) as CanvasImageSource, 0, 0);
  const world = () => ctx.setTransform(cw / WORLD_W, 0, 0, ch / WORLD_H, 0, 0);
  for (const draw of [amb.drawWater, amb.drawAir, amb.drawLighting]) {
    ctx.save();
    world();
    draw(ctx);
    ctx.restore();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(paper(cw, ch) as CanvasImageSource, 0, 0);
  ctx.restore();
}

function entry(id: string, label: string, sc: Scenario, opts: { animated?: boolean; reducedMotion?: boolean } = {}): StudioEntry {
  return {
    id,
    label,
    w: W,
    h: H,
    animated: opts.animated ?? true,
    render(canvas, { t, dt, seed, frame }) {
      let e = engines.get(id);
      if (!e || e.seed !== seed || frame === 0 || frame < e.frame) {
        e = { amb: createAmbience({ scene, seed: `studio-${seed}`, reducedMotion: opts.reducedMotion }), seed, frame };
        e.amb.preview = sc.preview ?? null;
        engines.set(id, e);
        e.amb.settle();
      }
      e.frame = frame;
      e.amb.update({ dt, phase: sc.phase(t), weather: sc.weather, emitters: EMITTERS, hour: sc.hour(t) });
      composite(canvas, e.amb, seed);
    },
  };
}

const noon = () => NAMED_HOURS.noon;
const always = (p: SessionPhase) => () => p;

/** idle 0–6 s · focus 6–20 · break 20–28 · focus 28–36 · paused 36–44 · focus 44–52 · idle 52–60 */
const cycle = (t: number): SessionPhase => {
  const u = t % 60;
  if (u < 6) return 'idle';
  if (u < 20) return 'focus';
  if (u < 28) return 'break';
  if (u < 36) return 'focus';
  if (u < 44) return 'paused';
  if (u < 52) return 'focus';
  return 'idle';
};

const lightingEntry = (name: keyof typeof NAMED_HOURS, weather: Weather | null = null): StudioEntry =>
  entry(`light-${name}${weather ? `-${weather}` : ''}`, `${name} (${NAMED_HOURS[name]}h)${weather ? ` · ${weather}` : ''}`, {
    phase: always(weather ? 'focus' : 'idle'),
    weather,
    hour: () => NAMED_HOURS[name],
  }, { animated: false });

/** The wind field as ink stalks swaying in a row (sway) with gust strength as a faint wash. */
const windEntry: StudioEntry = {
  id: 'wind',
  label: 'wind(t, x, y): stalk lean = sway, wash = gust (idle · session boost)',
  w: W,
  h: 240,
  animated: true,
  render(canvas, { t, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = '#f3ecd9';
    ctx.fillRect(0, 0, W, 240);
    for (const [row, boost] of [[0, 0], [1, 1]] as const) {
      const base = 100 + row * 120;
      for (let i = 0; i < 40; i++) {
        const x = 10 + i * 19.5;
        const wx = (x / W) * 1600;
        const s = wind(t, wx, 600, boost);
        ctx.fillStyle = `rgba(169,179,134,${0.35 * s.gust})`;
        ctx.fillRect(x - 9, base - 80, 19, 80);
        ctx.strokeStyle = '#4a443c';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(x, base - 40, x + s.sway * 30, base - 70);
        ctx.stroke();
      }
      ctx.fillStyle = '#4a443c';
      ctx.font = '11px serif';
      ctx.fillText(boost ? 'focus (boost 1)' : 'idle', 6, base + 14);
    }
  },
};

const sections: StudioSection[] = [
  {
    id: 'ambience-weather',
    title: 'Ambience · session weather',
    order: 400,
    entries: [
      entry('sun', 'sun · focus (shafts, warm grade, glints)', { phase: always('focus'), weather: 'sun', hour: noon }),
      entry('rain', 'rain · focus (strokes ×3 depths, ripples, cool grade)', { phase: always('focus'), weather: 'rain', hour: noon }),
      entry('mist', 'mist · focus (drifting bands, far bank softened)', { phase: always('focus'), weather: 'mist', hour: noon }),
      entry('none', 'no session (reference)', { phase: always('idle'), weather: null, hour: noon }),
      entry('rain-cycle', 'rain through a session: idle → focus → break → focus → paused → focus → end (60 s loop)', { phase: cycle, weather: 'rain', hour: noon }),
      entry('sun-cycle', 'sun through a session (60 s loop)', { phase: cycle, weather: 'sun', hour: noon }),
      entry('mist-paused', 'mist · paused (held breath: still, faint)', { phase: always('paused'), weather: 'mist', hour: noon }),
      entry('rain-reduced', 'rain · reduced motion (static strokes, no motes)', { phase: always('focus'), weather: 'rain', hour: noon }, { reducedMotion: true }),
    ],
  },
  {
    id: 'ambience-motes',
    title: 'Ambience · photosynthesis motes & wind',
    order: 401,
    entries: [
      entry('motes', 'motes · focus, no weather (the shore iris is growing)', { phase: always('focus'), weather: null, hour: noon, preview: null }),
      entry('motes-evening', 'motes · evening sun', { phase: always('focus'), weather: 'sun', hour: () => NAMED_HOURS.evening }),
      windEntry,
    ],
  },
  {
    id: 'ambience-lighting',
    title: 'Ambience · time of day',
    order: 402,
    entries: [
      lightingEntry('morning'),
      lightingEntry('noon'),
      lightingEntry('evening'),
      lightingEntry('dusk'),
      lightingEntry('night'),
      lightingEntry('night', 'rain'),
      entry('day-cycle', 'a whole day in 48 s (smooth keyframe interpolation)', { phase: always('idle'), weather: null, hour: (t) => (t / 2) % 24 }),
    ],
  },
];

export default sections;
