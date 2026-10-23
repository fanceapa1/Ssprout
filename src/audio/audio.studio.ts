import { realClock } from '../core/clock';
import { createEventBus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import { createDefaultState, type Weather } from '../core/state';
import type { StudioEntry, StudioRenderContext, StudioSection } from '../studio/types';
import { createWebAudioBackend, type AudioBackend, type SoundBus } from './backend';
import { createGardenAudio, type GardenAudio } from './garden-audio';
import { BIRD_CURVE, CRICKET_CURVE, MASTER_LEVEL, sampleCurve, SWALLOW_CURVE, WARBLER_CURVE } from './params';
import { EPS, RECIPES, type Point, type RecipeName, type SoundSpec, type Voice } from './recipes';

/**
 * Studio · Audio. Each entry draws its sound as an ink sketch — pitch contours as brush strokes
 * whose weight follows loudness, noise as stipple, the summed envelope as a pale wash — and
 * plays it when the canvas is clicked (the click is the user gesture that unlocks audio).
 */

const W = 360;
const H = 150;
const PAD = { l: 12, r: 12, t: 14, b: 24 };
const F_LO = 150;
const F_HI = 9000;

const ink = (a: number) =>
  typeof document !== 'undefined' && document.body?.dataset.bg === 'dark' ? `rgba(232,224,210,${a})` : `rgba(40,35,30,${a})`;

// ---------------------------------------------------------------------------------------------
// click handling (one listener per canvas; the latest render decides what a click plays)
// ---------------------------------------------------------------------------------------------

const bound = new WeakSet<HTMLCanvasElement>();
const onClick = new WeakMap<HTMLCanvasElement, () => void>();

function clickable(canvas: HTMLCanvasElement, action: () => void) {
  onClick.set(canvas, action);
  if (bound.has(canvas)) return;
  bound.add(canvas);
  canvas.style.cursor = 'pointer';
  canvas.title = 'Click to play';
  canvas.addEventListener('click', () => onClick.get(canvas)?.());
}

let player: AudioBackend | null | undefined;
function play(spec: SoundSpec, bus: SoundBus) {
  if (player === undefined) player = createWebAudioBackend('studio');
  if (!player) return;
  void player.resume();
  player.setMaster(MASTER_LEVEL, 0.05);
  player.play(spec, player.now() + 0.05, bus);
}

// ---------------------------------------------------------------------------------------------
// ink sketch of a SoundSpec
// ---------------------------------------------------------------------------------------------

/** Value of an envelope at time t (exponential interpolation, like the Web Audio ramps). */
export function envAt(pts: readonly Point[], t: number): number {
  const first = pts[0];
  if (!first || t < first[0]) return 0;
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i]!;
    const [t0, v0] = pts[i - 1]!;
    if (t <= t1) {
      if (t1 === t0) return v1;
      const a = Math.max(EPS, v0);
      const b = Math.max(EPS, v1);
      return a * (b / a) ** ((t - t0) / (t1 - t0));
    }
  }
  return 0;
}

/** Pitch at time t, held flat before the first and after the last contour point. */
function freqAt(pts: readonly Point[], t: number): number {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  return envAt(pts, t);
}

function sketch(canvas: HTMLCanvasElement, spec: SoundSpec, { pixelRatio, seed }: StudioRenderContext) {
  const ctx = canvas.getContext('2d')!;
  ctx.scale(pixelRatio, pixelRatio);
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const dur = Math.max(0.3, spec.duration);
  const x = (t: number) => PAD.l + (t / dur) * pw;
  const y = (f: number) => PAD.t + (1 - Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * ph;
  const base = H - PAD.b;
  const rng = createRng(seed).fork('stipple');

  // summed envelope as a pale wash rising from the baseline
  const steps = 240;
  const sum = (t: number) => spec.voices.reduce((s, v) => s + envAt(v.env, t) * (v.kind === 'tone' ? 1 : 0.6), 0);
  let peak = 0;
  for (let i = 0; i <= steps; i++) peak = Math.max(peak, sum((i / steps) * dur));
  ctx.beginPath();
  ctx.moveTo(x(0), base);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * dur;
    ctx.lineTo(x(t), base - (sum(t) / (peak || 1)) * ph * 0.45);
  }
  ctx.lineTo(x(dur), base);
  ctx.closePath();
  ctx.fillStyle = ink(0.08);
  ctx.fill();

  // baseline and time ticks
  ctx.strokeStyle = ink(0.35);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(PAD.l, base + 0.5);
  ctx.lineTo(W - PAD.r, base + 0.5);
  const tick = dur > 3 ? 1 : dur > 1 ? 0.25 : 0.1;
  for (let t = 0; t <= dur + 1e-6; t += tick) {
    ctx.moveTo(x(t), base + 0.5);
    ctx.lineTo(x(t), base + 4);
  }
  ctx.stroke();
  ctx.fillStyle = ink(0.6);
  ctx.font = '10px "Cormorant Garamond", serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`${dur.toFixed(2)} s · ticks ${tick} s · gain ${spec.gain}`, PAD.l, base + 7);

  for (const v of spec.voices) drawVoice(ctx, v, x, y, rng);

  // a small "play" mark, top right
  ctx.fillStyle = ink(0.55);
  ctx.beginPath();
  ctx.moveTo(W - 20, 6);
  ctx.lineTo(W - 11, 11);
  ctx.lineTo(W - 20, 16);
  ctx.closePath();
  ctx.fill();
}

function drawVoice(
  ctx: CanvasRenderingContext2D,
  v: Voice,
  x: (t: number) => number,
  y: (f: number) => number,
  rng: Rng,
) {
  const t0 = v.env[0]?.[0] ?? 0;
  const t1 = v.env[v.env.length - 1]?.[0] ?? t0;
  const peak = Math.max(...v.env.map((p) => p[1]));
  const n = Math.max(8, Math.round((x(t1) - x(t0)) / 1.5));
  if (v.kind === 'tone') {
    // brush stroke: weight and darkness follow loudness
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ta = t0 + ((t1 - t0) * i) / n;
      const tb = t0 + ((t1 - t0) * (i + 1)) / n;
      const amp = envAt(v.env, (ta + tb) / 2) / (peak || 1);
      if (amp < 0.01) continue;
      ctx.strokeStyle = ink(0.15 + 0.7 * amp);
      ctx.lineWidth = 0.5 + 3.2 * amp * Math.sqrt(peak);
      ctx.beginPath();
      ctx.moveTo(x(ta), y(freqAt(v.freq, ta)));
      ctx.lineTo(x(tb), y(freqAt(v.freq, tb)));
      ctx.stroke();
    }
    return;
  }
  // noise: stipple around the filter frequency
  ctx.fillStyle = ink(0.5);
  for (let i = 0; i < n * 3; i++) {
    const t = t0 + (t1 - t0) * rng.next();
    const amp = envAt(v.env, t) / (peak || 1);
    if (rng.next() > amp) continue;
    const spread = v.filter.type === 'bandpass' ? 1 / v.filter.q : 1.5;
    const f = Math.min(F_HI, Math.max(F_LO, v.filter.freq * 2 ** rng.gaussian(0, spread)));
    ctx.fillRect(x(t), y(f), 1, 1);
  }
}

function soundEntry(name: RecipeName, label: string, bus: SoundBus): StudioEntry {
  return {
    id: name,
    label: `${label} — click to play`,
    w: W,
    h: H,
    render(canvas, rc) {
      const spec = RECIPES[name](createRng(rc.seed).fork(name), 0);
      sketch(canvas, spec, rc);
      clickable(canvas, () => play(RECIPES[name](createRng(rc.seed).fork(name), 0), bus));
    },
  };
}

// ---------------------------------------------------------------------------------------------
// live soundscape: the real controller, cycled through its moods by clicking
// ---------------------------------------------------------------------------------------------

type Mood = 'off' | Weather | 'night';
const MOODS: Mood[] = ['off', 'sun', 'rain', 'mist', 'night'];
let mood: Mood = 'off';
let garden: GardenAudio | null = null;

function nextMood() {
  mood = MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length]!;
  if (!garden) {
    const state = createDefaultState(realClock.now());
    garden = createGardenAudio({ bus: createEventBus(), getState: () => state, clock: realClock, seed: 'studio' });
    garden.setFauna(['small-birds', 'swallows']);
  }
  garden.unlock();
  if (mood === 'off') {
    garden.setMuted(true);
    return;
  }
  garden.setTimeOfDay(mood === 'night' ? 23 : 7.5);
  garden.setWeather(mood === 'night' ? null : mood);
  garden.setActivity({ sessionActive: mood !== 'night', paused: false });
  garden.setMuted(false);
}

function drawCurves(canvas: HTMLCanvasElement, { pixelRatio }: StudioRenderContext) {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(pixelRatio, pixelRatio);
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const base = H - PAD.b;
  const x = (h: number) => PAD.l + (h / 24) * pw;
  const curves = [
    { name: 'birds', curve: BIRD_CURVE, w: 2.6, a: 0.8, dash: [] as number[], at: 16.6 },
    { name: 'uguisu', curve: WARBLER_CURVE, w: 1.2, a: 0.6, dash: [], at: 9.6 },
    { name: 'swallows', curve: SWALLOW_CURVE, w: 1, a: 0.5, dash: [2, 3], at: 13 },
    { name: 'crickets', curve: CRICKET_CURVE, w: 1.8, a: 0.4, dash: [], at: 1 },
  ];
  ctx.font = '10px "Cormorant Garamond", serif';
  ctx.textBaseline = 'bottom';
  for (const c of curves) {
    ctx.strokeStyle = ink(c.a);
    ctx.lineWidth = c.w;
    ctx.setLineDash(c.dash);
    ctx.beginPath();
    for (let h = 0; h <= 24; h += 0.1) {
      const v = sampleCurve(c.curve, h % 24);
      const py = base - v * ph * 0.9;
      if (h === 0) ctx.moveTo(x(h), py);
      else ctx.lineTo(x(h), py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ink(0.7);
    ctx.fillText(c.name, x(c.at) + 3, base - sampleCurve(c.curve, c.at) * ph * 0.9 - 2);
  }
  ctx.strokeStyle = ink(0.35);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(PAD.l, base + 0.5);
  ctx.lineTo(W - PAD.r, base + 0.5);
  for (let h = 0; h <= 24; h += 6) {
    ctx.moveTo(x(h), base);
    ctx.lineTo(x(h), base + 4);
  }
  ctx.stroke();
  ctx.fillStyle = ink(0.6);
  ctx.textBaseline = 'top';
  for (let h = 0; h <= 24; h += 6) ctx.fillText(`${h}h`, x(h) - 6, base + 6);
  ctx.fillText(`now: ${mood}`, W - 70, 4);
}

const soundscape: StudioEntry = {
  id: 'soundscape',
  label: 'Live soundscape (event rates by hour) — click to cycle off / sun / rain / mist / night',
  w: W,
  h: H,
  render(canvas, rc) {
    drawCurves(canvas, rc);
    clickable(canvas, () => {
      nextMood();
      drawCurves(canvas, { ...rc, pixelRatio: canvas.width / W });
    });
  },
};

const section: StudioSection = {
  id: 'audio',
  title: 'Audio',
  order: 650,
  entries: [
    soundEntry('rin', 'Bloom chime (rin bowl)', 'chime'),
    soundEntry('completion', 'Session complete phrase', 'chime'),
    soundEntry('plip', 'Pond plip', 'events'),
    soundEntry('drip', 'Rain drip', 'events'),
    soundEntry('pour', 'Watering pour (focus watering, the can in a break)', 'events'),
    soundEntry('chirp', 'Distant chirp', 'events'),
    soundEntry('warbler', 'Bush warbler hō-hokekyo', 'events'),
    soundEntry('swallow', 'Swallows twitter', 'events'),
    soundEntry('cricket', 'Night cricket trill', 'events'),
    soundscape,
  ],
};

export default section;
