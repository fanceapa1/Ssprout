import type { SoundLayer } from '../core/soundscape';
import { defaultSoundscape, levelsWith } from '../core/soundscape';
import { createRng } from '../core/rng';
import { extendDebug } from '../dev/debug';
import { createWebAudioBackend } from './backend';
import type { GardenAudio } from './garden-audio';
import { MASTER_LEVEL, mixParams } from './params';
import { chirp, cricket, drip, plip } from './recipes';

declare module '../dev/debug' {
  interface SproutDebug {
    audio: GardenAudio & {
      /** Render the real graph offline for loudness, layer isolation and quiet-boundary checks. */
      measure(layers: Partial<Record<SoundLayer, number>>, eventLevel?: number): Promise<{ rms: number; peak: number; tailRms: number }>;
    };
  }
}

export function installAudioDebug(audio: GardenAudio): void {
  extendDebug({ audio: { ...audio, async measure(layers, eventLevel = 100) {
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
