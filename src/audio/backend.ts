import { createRng } from '../core/rng';
import { brownNoise, impulseResponse, makeLoopable, pinkNoise, whiteNoise } from './noise';
import type { MixParams } from './params';
import { EPS, type Point, type SoundSpec, type Voice } from './recipes';

/**
 * The only module that touches Web Audio. The controller (garden-audio.ts) talks to this
 * narrow facade, so everything above it is testable with a fake backend.
 *
 *   water  (brown → HP 80 → LP 520, slow lapping LFO) ─┐
 *   wind   (pink → BP, LFO-swept; gust swell)          ├─ bed (gain) → warmth (low-shelf) ─┐
 *   rain   (pink → HP 900 → LP 7k)                     ─┘                                  │
 *   events (plip/chirp/warbler/swallow/cricket/drip) → panner → eventsBus ────────────────┤
 *                                       └─ send ─→ convolver (procedural IR) → return ─────┤
 *                                                                                          ▼
 *                                                                          air (LP; mist muffles)
 *   chimes (rin bowl, completion phrase) → panner → chimeBus ─────┐  (+ send → convolver)   │
 *                                                                 ▼                          ▼
 *                                                        master (fade) → limiter → destination
 */

export type SoundBus = 'events' | 'chime';

export interface AudioBackend {
  /** audio clock, seconds */
  now(): number;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  /** start the looping beds (idempotent) */
  startBeds(): void;
  /** ramp the master gain to `level` over `seconds` (from wherever it currently is) */
  setMaster(level: number, seconds: number): void;
  /** smoothly move bed levels and filters; `seconds` ≈ time constant */
  applyMix(mix: MixParams, seconds: number): void;
  /** schedule a one-shot sound at audio time `when` */
  play(spec: SoundSpec, when: number, bus: SoundBus): void;
  /** swell the wind for `duration` seconds by factor `amount` */
  gust(when: number, duration: number, amount: number): void;
  close(): void;
}

export type BackendFactory = () => AudioBackend | null;

/** Hard safety cap on simultaneously scheduled sounds (the planner normally stays far below). */
const MAX_LIVE_SOUNDS = 12;

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Web Audio implementation; returns null where Web Audio is unavailable. */
export function createWebAudioBackend(seed: number | string = 'garden-audio'): AudioBackend | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: 'playback' });
  } catch {
    return null;
  }
  const rng = createRng(seed);
  const sr = ctx.sampleRate;

  const buffer = (channels: Float32Array[]): AudioBuffer => {
    const b = ctx.createBuffer(channels.length, channels[0]!.length, sr);
    channels.forEach((data, i) => b.getChannelData(i).set(data));
    return b;
  };
  // shared noise, generated once per context and reused by every layer and voice
  const fade = Math.round(sr * 0.25);
  const brown = buffer([makeLoopable(brownNoise(rng.fork('brown'), Math.round(sr * 6) + fade), fade)]);
  const pink = buffer([makeLoopable(pinkNoise(rng.fork('pink'), Math.round(sr * 7) + fade), fade)]);
  const white = buffer([whiteNoise(rng.fork('white'), Math.round(sr * 1))]);
  const [irL, irR] = impulseResponse(rng.fork('ir'), sr);

  // --- output chain --------------------------------------------------------------------------
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -18;
  limiter.knee.value = 12;
  limiter.ratio.value = 3;
  limiter.attack.value = 0.01;
  limiter.release.value = 0.4;
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(limiter);

  const air = ctx.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.value = 16000;
  air.Q.value = 0.5;
  air.connect(master);

  const reverb = ctx.createConvolver();
  reverb.normalize = true;
  reverb.buffer = buffer([irL, irR]);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.7;
  reverb.connect(reverbReturn).connect(air);

  const eventsBus = ctx.createGain();
  eventsBus.connect(air);
  // chimes stay clear of the mist muffling so they always read
  const chimeBus = ctx.createGain();
  chimeBus.connect(master);

  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowshelf';
  warmth.frequency.value = 250;
  warmth.gain.value = 0;
  warmth.connect(air);
  const bed = ctx.createGain();
  bed.connect(warmth);

  // --- beds (built lazily on first fade-in) ---------------------------------------------------
  let beds: { water: GainNode; wind: GainNode; windBand: BiquadFilterNode; swell: GainNode; rain: GainNode } | null = null;
  const sources: AudioScheduledSourceNode[] = [];

  const loop = (buf: AudioBuffer, offset: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start(ctx.currentTime, offset % buf.duration);
    sources.push(src);
    return src;
  };
  const lfo = (hz: number, depth: number, target: AudioParam) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    osc.connect(g).connect(target);
    osc.start();
    sources.push(osc);
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };

  function startBeds() {
    if (beds) return;
    // pond water: low, gently lapping
    const water = ctx.createGain();
    water.gain.value = 0;
    const lap = ctx.createGain();
    lap.gain.value = 1;
    loop(brown, 0).connect(filter('highpass', 80)).connect(filter('lowpass', 520)).connect(lap).connect(water);
    lfo(0.11, 0.25, lap.gain);
    water.connect(bed);

    // wind in leaves: pink noise through a slowly swept band-pass, with a slow breath and gusts
    const windBand = filter('bandpass', 850, 0.6);
    const breath = ctx.createGain();
    breath.gain.value = 1;
    const swell = ctx.createGain();
    swell.gain.value = 1;
    const wind = ctx.createGain();
    wind.gain.value = 0;
    loop(pink, 1.3).connect(windBand).connect(breath).connect(swell).connect(wind);
    lfo(0.06, 320, windBand.frequency);
    lfo(0.031, 0.3, breath.gain);
    wind.connect(bed);

    // rain patter: broadband pink, bright but rounded (silent unless raining)
    const rain = ctx.createGain();
    rain.gain.value = 0;
    loop(pink, 3.7).connect(filter('highpass', 900)).connect(filter('lowpass', 7000)).connect(rain);
    rain.connect(bed);

    beds = { water, wind, windBand, swell, rain };
  }

  // --- one-shots ------------------------------------------------------------------------------
  let live = 0;

  const ramp = (param: AudioParam, pts: readonly Point[], t0: number) => {
    const [first, ...rest] = pts;
    if (!first) return;
    param.setValueAtTime(Math.max(EPS, first[1]), t0 + first[0]);
    for (const [t, v] of rest) param.exponentialRampToValueAtTime(Math.max(EPS, v), t0 + t);
  };

  function voice(v: Voice, t0: number, out: AudioNode): AudioScheduledSourceNode {
    const env = ctx.createGain();
    env.gain.value = 0;
    ramp(env.gain, v.env, t0);
    env.connect(out);
    const end = t0 + (v.env[v.env.length - 1]?.[0] ?? 0) + 0.05;
    if (v.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      ramp(osc.frequency, v.freq, t0);
      if (v.fm) {
        const mod = ctx.createOscillator();
        mod.frequency.value = (v.freq[0]?.[1] ?? 440) * v.fm.ratio;
        const depth = ctx.createGain();
        depth.gain.value = v.fm.depth;
        mod.connect(depth).connect(osc.frequency);
        mod.start(t0);
        mod.stop(end);
      }
      osc.connect(env);
      osc.start(t0);
      osc.stop(end);
      return osc;
    }
    const src = ctx.createBufferSource();
    src.buffer = white;
    const f = filter(v.filter.type, v.filter.freq, v.filter.q);
    src.connect(f).connect(env);
    src.start(t0, rng.range(0, white.duration - 0.2));
    src.stop(end);
    return src;
  }

  function play(spec: SoundSpec, when: number, bus: SoundBus) {
    if (live >= MAX_LIVE_SOUNDS || spec.voices.length === 0) return;
    live++;
    const t0 = Math.max(when, ctx.currentTime);
    const out = ctx.createGain();
    out.gain.value = spec.gain;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, spec.pan));
    let head: AudioNode = out;
    if (spec.lowpass) head = out.connect(filter('lowpass', spec.lowpass));
    head.connect(pan).connect(bus === 'chime' ? chimeBus : eventsBus);
    if (spec.reverb > 0) {
      const send = ctx.createGain();
      send.gain.value = spec.reverb;
      pan.connect(send).connect(reverb);
    }
    const nodes = spec.voices.map((v) => voice(v, t0, out));
    let remaining = nodes.length;
    for (const n of nodes) {
      n.onended = () => {
        n.disconnect();
        if (--remaining === 0) {
          live--;
          out.disconnect();
          pan.disconnect();
        }
      };
    }
  }

  const glide = (param: AudioParam, value: number, seconds: number) => {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + Math.max(0.01, seconds));
  };

  return {
    now: () => ctx.currentTime,
    resume: () => (ctx.state === 'closed' ? Promise.resolve() : ctx.resume()),
    suspend: () => (ctx.state === 'running' ? ctx.suspend() : Promise.resolve()),
    startBeds,
    setMaster: (level, seconds) => glide(master.gain, level, seconds),
    applyMix(mix, seconds) {
      const t = ctx.currentTime;
      const tc = Math.max(0.01, seconds / 3);
      if (beds) {
        beds.water.gain.setTargetAtTime(mix.water, t, tc);
        beds.wind.gain.setTargetAtTime(mix.wind, t, tc);
        beds.rain.gain.setTargetAtTime(mix.rain, t, tc);
        beds.windBand.frequency.setTargetAtTime(mix.windHz, t, tc);
      }
      bed.gain.setTargetAtTime(mix.bed, t, tc);
      warmth.gain.setTargetAtTime(mix.warmthDb, t, tc);
      air.frequency.setTargetAtTime(mix.airHz, t, tc);
    },
    play,
    gust(when, duration, amount) {
      if (!beds) return;
      const g = beds.swell.gain;
      const t0 = Math.max(when, ctx.currentTime);
      g.cancelScheduledValues(t0);
      g.setValueAtTime(1, t0);
      g.linearRampToValueAtTime(amount, t0 + duration * 0.4);
      g.linearRampToValueAtTime(1, t0 + duration);
    },
    close() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // already stopped
        }
      }
      void ctx.close().catch(() => undefined);
    },
  };
}
