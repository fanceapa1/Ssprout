import type { SoundLayer, SoundSceneryId } from '../core/soundscape';
import { defaultSoundscape, levelsWith } from '../core/soundscape';
import { createRng } from '../core/rng';
import { extendDebug } from '../dev/debug';
import { createWebAudioBackend } from './backend';
import { RECIPE_FOR, type GardenAudio } from './garden-audio';
import type { Weather } from '../core/state';
import { eventLayer, MASTER_LEVEL, mixParams, type EventKind } from './params';
import { createPlanner } from './planner';
import { chirp, cricket, drip, plip, RECIPES } from './recipes';

declare module '../dev/debug' {
  interface SproutDebug {
    audio: GardenAudio & {
      /** Render the real graph offline for loudness, layer isolation and quiet-boundary checks. */
      measure(layers: Partial<Record<SoundLayer, number>>, eventLevel?: number): Promise<{ rms: number; peak: number; tailRms: number }>;
      /**
       * Render a scenery's own garden beds offline, gliding to `to` at `switchAt` as `setScenery` does; dB per 250 ms.
       * `events` also plays its planned voices; `wav` returns the render as a base64 16-bit WAV.
       */
      scene(o: SceneRender): Promise<{ rms: number; peak: number; windowsDb: number[]; wav?: string }>;
    };
  }
}

interface SceneRender {
  scenery: SoundSceneryId;
  to?: SoundSceneryId;
  switchAt?: number;
  seconds?: number;
  hour?: number;
  events?: boolean;
  wav?: boolean;
  weather?: Weather | null;
  /** voices to play at given seconds, besides any planned ones (to hear rare events close together) */
  play?: readonly (readonly [seconds: number, kind: Exclude<EventKind, 'gust'>])[];
}

const SR = 22050;

/** Stereo 16-bit PCM WAV, base64. */
function wavBase64(l: Float32Array, r: Float32Array, rate: number): string {
  const n = l.length, view = new DataView(new ArrayBuffer(44 + n * 4));
  const text = (at: number, t: string) => { for (let i = 0; i < t.length; i++) view.setUint8(at + i, t.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + n * 4, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, n * 4, true);
  const pcm = (x: number) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
  for (let i = 0; i < n; i++) { view.setInt16(44 + i * 4, pcm(l[i]!), true); view.setInt16(46 + i * 4, pcm(r[i]!), true); }
  const bytes = new Uint8Array(view.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function renderScene(o: SceneRender) {
  const seconds = o.seconds ?? 8;
  const rate = o.wav ? 44100 : SR;
  const ctx = new OfflineAudioContext(2, rate * seconds, rate);
  const backend = createWebAudioBackend('measure-scene', { context: ctx })!;
  const mixFor = (scenery: SoundSceneryId) =>
    mixParams({ hour: o.hour ?? 12, weather: o.weather ?? null, activity: { sessionActive: false, paused: false }, fauna: new Set(), scenery });
  backend.startBeds(); backend.applyMix(mixFor(o.scenery), 0); backend.setMaster(MASTER_LEVEL, 0);
  const to = o.to, switchAt = o.switchAt ?? seconds / 2;
  if (o.events) {
    // plan a second at a time, as the live ticker does; the switch lands on the first second at or after `switchAt`
    const planner = createPlanner({ rng: createRng('scene-events') });
    let scenery = o.scenery;
    const plan = (from: number) => {
      if (to && scenery !== to && from >= switchAt) { scenery = to; backend.applyMix(mixFor(to), 2); }
      for (const ev of planner.step(1, mixFor(scenery).rates, from + 1)) {
        const g = createRng(ev.seed);
        if (ev.kind === 'gust') backend.gust(from + ev.at, g.range(5, 8), g.range(1.5, 2.3));
        else backend.play(RECIPES[RECIPE_FOR[ev.kind]](g, ev.pan), from + ev.at, 'events', eventLayer(ev.kind, scenery));
      }
    };
    plan(0);
    for (let t = 1; t < seconds; t++) void ctx.suspend(t).then(() => { plan(t); return ctx.resume(); });
  } else if (to) void ctx.suspend(switchAt).then(() => { backend.applyMix(mixFor(to), 2); return ctx.resume(); });
  for (const [k, [at, kind]] of (o.play ?? []).entries()) {
    const g = createRng(`scene-play-${k}`);
    backend.play(RECIPES[RECIPE_FOR[kind]](g, g.range(-0.5, 0.5)), at, 'events', eventLayer(kind, to && at >= switchAt ? to : o.scenery));
  }
  const rendered = await ctx.startRendering();
  const [l, r] = [rendered.getChannelData(0), rendered.getChannelData(1)];
  const w = Math.floor(rate / 4), windowsDb: number[] = [];
  let square = 0, peak = 0;
  for (let i = 0; i + w <= l.length; i += w) {
    let sq = 0;
    for (let j = i; j < i + w; j++) {
      sq += (l[j]! ** 2 + r[j]! ** 2) / 2;
      peak = Math.max(peak, Math.abs(l[j]!), Math.abs(r[j]!));
    }
    square += sq;
    windowsDb.push(10 * Math.log10(sq / w + 1e-20));
  }
  backend.close();
  return { rms: Math.sqrt(square / (windowsDb.length * w)), peak, windowsDb, ...(o.wav ? { wav: wavBase64(l, r, rate) } : {}) };
}

export function installAudioDebug(audio: GardenAudio): void {
  extendDebug({ audio: { ...audio, scene: renderScene, async measure(layers, eventLevel = 100) {
    const ctx = new OfflineAudioContext(2, 22050 * 8, 22050);
    const backend = createWebAudioBackend('measure-soundscape', { context: ctx })!;
    const settings = defaultSoundscape();
    settings.collection = 'standard'; settings.standard = levelsWith(layers);
    const mix = mixParams({ hour: 12, weather: null, activity: { sessionActive: false, paused: false }, fauna: new Set(), soundscape: settings });
    backend.startBeds(); backend.applyMix(mix, 0); backend.setMaster(MASTER_LEVEL, 0);
    const recipes = { water: plip, birds: chirp, crickets: cricket, rain: drip };
    for (const [id, recipe] of Object.entries(recipes)) {
      if (!layers[id as SoundLayer]) continue;
      backend.play(recipe(createRng(id)), 1, 'events', id as SoundLayer);
    }
    // A zero event level verifies that even already scheduled events use their channel's gain.
    if (eventLevel !== 100) backend.applyMix({ ...mix, eventLevels: levelsWith(
      Object.fromEntries(Object.keys(recipes).map((id) => [id, eventLevel])),
    ) }, 0);
    const rendered = await ctx.startRendering();
    let square = 0, peak = 0, tail = 0;
    const data = rendered.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      square += data[i]! ** 2; peak = Math.max(peak, Math.abs(data[i]!));
      if (i >= data.length / 2) tail += data[i]! ** 2;
    }
    backend.close();
    return { rms: Math.sqrt(square / data.length), peak, tailRms: Math.sqrt(tail / (data.length / 2)) };
  } } });
}
