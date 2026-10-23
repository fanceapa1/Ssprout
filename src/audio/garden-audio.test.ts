import { describe, expect, it } from 'vitest';
import { createManualClock } from '../core/clock';
import { createEventBus } from '../core/events';
import { createSessionController, type StartOptions, type Ticker } from '../core/controller';
import {
  createDefaultState,
  createReducer,
  createStore,
  type ActiveSession,
  type GardenState,
  type PlantInstance,
  type Weather,
} from '../core/state';
import type { SpeciesDef } from '../plants/types';
import type { Slot } from '../scene/geometry';
import type { AudioBackend } from './backend';
import { createGardenAudio, MAX_CHIMES, type Timers } from './garden-audio';
import { FADE_S, MASTER_LEVEL, type MixParams } from './params';
import type { SoundSpec } from './recipes';
import { defaultSoundscape, levelsWith } from '../core/soundscape';

/** Records every call; the audio clock only moves when the test says so. */
function fakeBackend() {
  const calls: string[] = [];
  const played: { spec: SoundSpec; when: number; bus: string }[] = [];
  const mixes: MixParams[] = [];
  const masters: [number, number][] = [];
  let t = 0;
  const backend: AudioBackend = {
    now: () => t,
    resume: async () => void calls.push('resume'),
    suspend: async () => void calls.push('suspend'),
    startBeds: () => void calls.push('startBeds'),
    setMaster: (level, seconds) => void masters.push([level, seconds]),
    applyMix: (mix) => void mixes.push(mix),
    play: (spec, when, bus) => void played.push({ spec, when, bus }),
    gust: () => void calls.push('gust'),
    close: () => void calls.push('close'),
  };
  return { backend, calls, played, mixes, masters, advance: (s: number) => (t += s) };
}

/** Manual timers: run intervals/timeouts explicitly. */
function fakeTimers() {
  let id = 0;
  const intervals = new Map<number, () => void>();
  const timeouts = new Map<number, { fn: () => void; ms: number }>();
  const timers: Timers = {
    setInterval: (fn) => (intervals.set(++id, fn), id),
    clearInterval: (h) => void intervals.delete(h as number),
    setTimeout: (fn, ms) => (timeouts.set(++id, { fn, ms }), id),
    clearTimeout: (h) => void timeouts.delete(h as number),
  };
  return {
    timers,
    intervals,
    timeouts,
    tick: () => [...intervals.values()].forEach((fn) => fn()),
    flushTimeouts: () => {
      const all = [...timeouts.values()];
      timeouts.clear();
      all.forEach((t) => t.fn());
    },
  };
}

function setup(state: Partial<GardenState> = {}, settings: Partial<GardenState['settings']> = {}) {
  const base = createDefaultState(0);
  const garden: GardenState = { ...base, ...state, settings: { ...base.settings, ...settings } };
  const bus = createEventBus();
  const fake = fakeBackend();
  const t = fakeTimers();
  let created = 0;
  const audio = createGardenAudio({
    bus,
    getState: () => garden,
    clock: createManualClock(new Date(2026, 4, 1, 12, 0).getTime()),
    seed: 1,
    createBackend: () => (created++, fake.backend),
    timers: t.timers,
  });
  return { audio, bus, fake, t, created: () => created, garden };
}

const session = (patch: Partial<ActiveSession> = {}): ActiveSession => ({
  id: 's1',
  taskName: 'Task',
  goalMs: 25 * 60_000,
  plan: { id: 'unbroken', name: 'Unbroken', blocks: [{ kind: 'focus', minutes: 25 }] },
  speciesId: 'x',
  slotId: 'a',
  seed: 1,
  displacedPlantId: null,
  startedAt: 0,
  pausedAt: null,
  pausedTotalMs: 0,
  skippedMs: 0,
  weather: 'sun',
  waterings: [],
  focusWaterings: 0,
  ...patch,
});
const plant: PlantInstance = {
  id: 'p',
  speciesId: 'x',
  slotId: 'a',
  seed: 1,
  plantedAt: 0,
  sessionMinutes: 25,
  taskName: 'Task',
  completedAt: 0,
};

/** Run the scheduler for `seconds` of audio time. */
function runFor(s: ReturnType<typeof setup>, seconds: number) {
  for (let i = 0; i < seconds * 4; i++) {
    s.fake.advance(0.25);
    s.t.tick();
  }
}

describe('personal soundscapes', () => {
  it('loads the saved master level and updates volume without restarting the context', () => {
    const prefs = defaultSoundscape(); prefs.volume = 35;
    const s = setup({}, { muted: false, soundscape: prefs });
    s.audio.unlock();
    expect(s.fake.masters.at(-1)![0]).toBeCloseTo(MASTER_LEVEL * 0.35);
    expect(s.fake.masters.at(-1)![1]).toBe(FADE_S);
    const next = { ...prefs, volume: 60 };
    s.bus.emit('settings:changed', { settings: { ...s.garden.settings, soundscape: next } });
    expect(s.fake.masters.at(-1)).toEqual([MASTER_LEVEL * 0.6, 1.5]);
    expect(s.created()).toBe(1);
    s.audio.setMuted(true);
    s.audio.setMuted(false);
    expect(s.fake.masters.at(-1)).toEqual([MASTER_LEVEL * 0.6, FADE_S]);
  });
  it('switches scenery mixes, notifies the UI and keeps Standard sounds across scenery changes', () => {
    const prefs = defaultSoundscape();
    prefs.sceneries.pond = { mode: 'custom', levels: levelsWith({ water: 85 }) };
    prefs.sceneries.coast = { mode: 'custom', levels: levelsWith({ waves: 60 }) };
    const s = setup({}, { muted: false, soundscape: prefs });
    let changes = 0;
    const off = s.audio.onSceneryChange(() => changes++);
    s.audio.unlock();
    expect(s.fake.mixes.at(-1)!.water).toBeGreaterThan(0);
    s.audio.setScenery('coast');
    expect(s.audio.getScenery()).toBe('coast');
    expect(s.fake.mixes.at(-1)!.water).toBe(0);
    expect(s.fake.mixes.at(-1)!.extra.waves).toBe(60);
    prefs.collection = 'standard'; prefs.standard = levelsWith({ cafe: 40 });
    s.bus.emit('settings:changed', { settings: { ...s.garden.settings, soundscape: prefs } });
    s.audio.setScenery('pond');
    expect(s.fake.mixes.at(-1)!.extra.cafe).toBe(40);
    expect(changes).toBe(2);
    off(); s.audio.setScenery('coast');
    expect(changes).toBe(2);
    s.audio.dispose(); s.audio.setScenery('pond');
    expect(s.audio.getScenery()).toBe('coast');
  });
  it('editing a mix while muted never creates or starts the audio backend', () => {
    const s = setup();
    const prefs = defaultSoundscape(); prefs.collection = 'standard';
    prefs.standard = levelsWith({ lofi: 50 });
    s.bus.emit('settings:changed', { settings: { ...s.garden.settings, soundscape: prefs } });
    s.audio.setScenery('coast');
    expect(s.created()).toBe(0);
    expect(s.fake.calls).toEqual([]);
    s.audio.setMuted(false); s.audio.unlock();
    expect(s.fake.mixes.at(-1)!.extra.lofi).toBe(50);
  });
});

describe('createGardenAudio gating', () => {
  it('is muted by default and creates nothing until unlocked', () => {
    const s = setup();
    expect(s.audio.isMuted()).toBe(true);
    s.audio.playBloom();
    s.audio.setMuted(false);
    expect(s.created()).toBe(0);
    expect(s.t.intervals.size).toBe(0);
  });

  it('unlock while muted wakes the context then suspends it without playing anything', () => {
    const s = setup();
    s.audio.unlock();
    expect(s.created()).toBe(1);
    expect(s.fake.calls).toEqual(['resume']);
    s.t.flushTimeouts();
    expect(s.fake.calls).toEqual(['resume', 'suspend']);
    expect(s.fake.masters).toEqual([]);
    expect(s.t.intervals.size).toBe(0);
  });

  it('unmuted + unlocked: beds start and the master fades in over ~2 s', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    expect(s.fake.calls).toEqual(['resume', 'startBeds']);
    expect(s.fake.masters).toEqual([[MASTER_LEVEL, FADE_S]]);
    expect(s.t.intervals.size).toBe(1);
  });

  it('muting fades out, stops scheduling and suspends after the fade', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.audio.setMuted(true);
    expect(s.fake.masters.at(-1)).toEqual([0, FADE_S]);
    expect(s.t.intervals.size).toBe(0);
    expect([...s.t.timeouts.values()][0]!.ms).toBeGreaterThan(FADE_S * 1000);
    s.t.flushTimeouts();
    expect(s.fake.calls.at(-1)).toBe('suspend');
  });

  it('unmuting again before the suspend fires cancels it', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.audio.setMuted(true);
    s.audio.setMuted(false);
    expect(s.t.timeouts.size).toBe(0);
    expect(s.fake.masters.at(-1)).toEqual([MASTER_LEVEL, FADE_S]);
  });

  it('follows settings:changed from the bus', () => {
    const s = setup();
    s.audio.unlock();
    s.bus.emit('settings:changed', { settings: { ...s.garden.settings, muted: false } });
    expect(s.audio.isMuted()).toBe(false);
    expect(s.t.intervals.size).toBe(1);
  });

  it('dispose closes the backend and unsubscribes', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.audio.dispose();
    expect(s.fake.calls.at(-1)).toBe('close');
    expect(s.t.intervals.size).toBe(0);
    s.bus.emit('plant:placed', { plant });
    s.audio.unlock();
    expect(s.fake.played).toEqual([]);
    expect(s.created()).toBe(1);
  });

  it('survives a missing Web Audio implementation', () => {
    const bus = createEventBus();
    const audio = createGardenAudio({
      bus,
      getState: () => ({ ...createDefaultState(0), settings: { ...createDefaultState(0).settings, muted: false } }),
      clock: createManualClock(0),
      createBackend: () => null,
      timers: fakeTimers().timers,
    });
    expect(() => {
      audio.unlock();
      audio.playBloom();
      audio.setMuted(true);
      audio.dispose();
    }).not.toThrow();
  });
});

describe('createGardenAudio soundscape', () => {
  it('schedules sparse one-shots ahead of the audio clock', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    runFor(s, 600);
    const events = s.fake.played.filter((p) => p.bus === 'events');
    // noon, no fauna: ~4 events a minute
    expect(events.length).toBeGreaterThan(15);
    expect(events.length).toBeLessThan(80);
    expect(events.every((p) => p.when > 0)).toBe(true);
  });

  it('plays nothing while muted even if ticks happen', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    const tick = [...s.t.intervals.values()][0]!;
    s.audio.setMuted(true);
    const before = s.fake.played.length;
    for (let i = 0; i < 100; i++) {
      s.fake.advance(0.25);
      tick();
    }
    expect(s.fake.played.length).toBe(before);
  });

  it('plays a bloom chime on plant:placed and a phrase on session:complete', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.bus.emit('plant:placed', { plant });
    s.fake.advance(10);
    s.bus.emit('session:complete', { sessionId: 's1', plant });
    const chimes = s.fake.played.filter((p) => p.bus === 'chime').map((p) => p.spec.name);
    expect(chimes).toEqual(['rin', 'completion']);
  });

  it('pours softly on every watering (automatic and tapped), only when unmuted, one at a time', () => {
    const muted = setup();
    muted.audio.unlock();
    muted.bus.emit('session:water', { blockIndex: 0, sessionId: 's1', auto: true });
    expect(muted.fake.played).toHaveLength(0);

    const s = setup({}, { muted: false });
    s.audio.unlock();
    const pours = () => s.fake.played.filter((p) => p.spec.name === 'pour');
    s.bus.emit('session:water', { blockIndex: 0, sessionId: 's1', auto: true });
    expect(pours()).toHaveLength(1);
    expect(pours()[0]!.bus).toBe('events');
    // a second watering while the first still pours is dropped, never stacked into a louder one
    s.bus.emit('session:water', { blockIndex: 1, sessionId: 's1', auto: false });
    expect(pours()).toHaveLength(1);
    s.fake.advance(5);
    s.bus.emit('session:water', { blockIndex: 1, sessionId: 's1', auto: false });
    expect(pours()).toHaveLength(2);

    // muted again: silent
    s.audio.setMuted(true);
    s.fake.advance(5);
    s.bus.emit('session:water', { blockIndex: 2, sessionId: 's1', auto: true });
    expect(pours()).toHaveLength(2);
  });

  it('limits overlapping chimes', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    for (let i = 0; i < 5; i++) s.audio.playBloom();
    expect(s.fake.played.filter((p) => p.bus === 'chime')).toHaveLength(MAX_CHIMES);
  });

  it('reacts to session events: rain during a session, thinner when paused, clear afterwards', () => {
    const p = parallel();
    const a = p.start('rain');
    expect(p.heard()).toEqual({ weather: 'rain', bed: 'running' });
    p.controller.pause();
    expect(p.heard()).toEqual({ weather: 'rain', bed: 'paused' });
    expect(p.fake.mixes.at(-1)!.bed).toBeLessThan(1);
    p.controller.resume();
    expect(p.fake.mixes.at(-1)!.bed).toBeGreaterThan(1);
    p.controller.cancel(a);
    expect(p.heard()).toEqual({ weather: 'clear', bed: 'idle' });
    expect(p.fake.mixes.at(-1)!.bed).toBe(1);
  });

  it('picks up a session already running at load (reload mid-session)', () => {
    const s = setup({ session: session({ weather: 'mist', pausedAt: 5 }) }, { muted: false });
    s.audio.unlock();
    const mix = s.fake.mixes.at(-1)!;
    expect(mix.airHz).toBeLessThan(5000);
    expect(mix.bed).toBeLessThan(1);
  });

  it('waiting sessions alone are silent at load: nothing active, a clear garden', () => {
    const s = setup({ session: null, waiting: [session({ weather: 'rain', pausedAt: 5 })] }, { muted: false });
    s.audio.unlock();
    const mix = s.fake.mixes.at(-1)!;
    expect(mix.rain).toBe(0);
    expect(mix.bed).toBe(1);
  });

  it('explicit setters drive the mix (weather, time of day, fauna)', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.audio.setWeather('mist');
    expect(s.fake.mixes.at(-1)!.airHz).toBeLessThan(5000);
    s.audio.setWeather(null);
    s.audio.setTimeOfDay(23);
    expect(s.fake.mixes.at(-1)!.rates.cricket).toBeGreaterThan(0);
    s.audio.setTimeOfDay(7);
    const before = s.fake.mixes.at(-1)!.rates.chirp;
    s.audio.setFauna(['small-birds', 'swallows']);
    expect(s.fake.mixes.at(-1)!.rates.chirp).toBeGreaterThan(before);
    expect(s.fake.mixes.at(-1)!.rates.swallow).toBeGreaterThan(0);
    s.audio.setActivity({ sessionActive: true, paused: false });
    expect(s.fake.mixes.at(-1)!.warmthDb).toBeGreaterThan(0);
  });

  it('fauna:arrived adds birds', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.audio.setTimeOfDay(10);
    s.bus.emit('fauna:arrived', { id: 'swallows' });
    expect(s.fake.mixes.at(-1)!.rates.swallow).toBeGreaterThan(0);
  });

  it('caps the step after a long stall instead of bursting', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.fake.advance(3600);
    s.t.tick();
    expect(s.fake.played.length).toBeLessThan(4);
  });
});

/**
 * The real session controller and store drive the audio, so the events arrive exactly as in the
 * app (after the state changed). The weather is chosen by the controller's rng; `start` pins it.
 */
function parallel() {
  const T = new Date(2026, 4, 1, 12, 0).getTime();
  const clock = createManualClock(T);
  const species: SpeciesDef = {
    id: 'violet',
    name: 'violet',
    tier: 1,
    habitats: ['meadow'],
    sizeClass: 'small',
    size: { w: 10, h: 10 },
    anchor: { x: 0.5, y: 1 },
    description: '',
    bloomColor: '#fff',
    pollinators: true,
    draw: () => {},
  };
  const slots: Slot[] = ['meadow-1', 'meadow-2', 'meadow-3'].map((id) => ({ id, x: 0, y: 0, habitat: 'meadow', maxSize: 'large', scale: 1 }));
  const reducer = createReducer({ getSpecies: (id) => (id === species.id ? species : undefined), getSlot: (id) => slots.find((x) => x.id === id) });
  const base = createDefaultState(T);
  const store = createStore<GardenState>({ ...base, settings: { ...base.settings, muted: false } }, reducer);
  const bus = createEventBus();
  let tick: (() => void) | null = null;
  const ticker: Ticker = {
    start(fn) {
      tick = fn;
      return () => void (tick = null);
    },
  };
  const controller = createSessionController({ store, clock, bus, species: [species], slots, ticker, seed: 1 });
  const fake = fakeBackend();
  const t = fakeTimers();
  const audio = createGardenAudio({ bus, getState: store.get, clock, seed: 1, createBackend: () => fake.backend, timers: t.timers });
  audio.unlock();
  let started = 0;

  /** Start a session with this weather (the active one becomes a waiting one); returns its id. */
  const start = (weather: Weather): string => {
    const opts: StartOptions = { taskName: weather, goalMinutes: 25, speciesId: 'violet', slotId: slots[started++ % slots.length]!.id };
    expect(controller.start(opts)).toBe(true);
    const st = store.get();
    // replace the weather the rng picked (state/replace emits nothing); the audio re-reads the
    // state on the next session event, here a pause and resume of the new session
    store.dispatch({ type: 'state/replace', state: { ...st, session: { ...st.session!, weather } } });
    controller.pause();
    controller.resume();
    return st.session!.id;
  };
  /** What the garden sounds like now: the weather bed and the session activity of the mix. */
  const heard = () => {
    const m = fake.mixes.at(-1)!;
    return {
      weather: m.rain > 0 ? 'rain' : m.airHz < 5000 ? 'mist' : 'clear',
      bed: m.bed > 1 ? 'running' : m.bed < 1 ? 'paused' : 'idle',
    };
  };
  /** Finish the active session (its 25 minutes have passed). */
  const completeActive = () => {
    clock.advance(26 * 60_000);
    tick?.();
  };
  return { controller, store, fake, audio, start, heard, completeActive };
}

describe('createGardenAudio follows the active session (SPEC §2 › Parallel sessions, ADR 0150)', () => {
  it('a switch brings the weather of the session switched to', () => {
    const p = parallel();
    const a = p.start('rain');
    const b = p.start('mist');
    expect(p.heard()).toEqual({ weather: 'mist', bed: 'running' });
    p.controller.switchTo(a);
    expect(p.heard()).toEqual({ weather: 'rain', bed: 'running' });
    p.controller.switchTo(b);
    expect(p.heard()).toEqual({ weather: 'mist', bed: 'running' });
  });

  it('a switch from nothing active (after a bloom) brings that session back, running', () => {
    const p = parallel();
    const a = p.start('rain');
    p.start('sun');
    p.completeActive();
    expect(p.heard()).toEqual({ weather: 'clear', bed: 'idle' });
    p.controller.switchTo(a);
    expect(p.heard()).toEqual({ weather: 'rain', bed: 'running' });
  });

  it('cancelling a waiting session leaves the active one sounding as it was', () => {
    const p = parallel();
    const a = p.start('rain');
    const c = p.start('sun');
    p.start('mist');
    const mixes = p.fake.mixes.length;
    p.controller.cancel(a);
    p.controller.cancel(c);
    expect(p.store.get().waiting).toHaveLength(0);
    expect(p.heard()).toEqual({ weather: 'mist', bed: 'running' });
    expect(p.fake.mixes).toHaveLength(mixes); // nothing re-applied, not even a fade
  });

  it('cancelling a waiting session while the active one is paused keeps it paused', () => {
    const p = parallel();
    const a = p.start('rain');
    p.start('mist');
    p.controller.pause();
    p.controller.cancel(a);
    expect(p.heard()).toEqual({ weather: 'mist', bed: 'paused' });
  });

  it('cancelling the active one with others waiting goes quiet: the waiting ones never sound', () => {
    const p = parallel();
    p.start('rain');
    const b = p.start('mist');
    p.controller.cancel(b);
    expect(p.store.get().waiting).toHaveLength(1);
    expect(p.heard()).toEqual({ weather: 'clear', bed: 'idle' });
  });

  it('completing the active one with others waiting goes quiet, with the phrase; the waiting ones never sound', () => {
    const p = parallel();
    p.start('rain');
    p.start('mist');
    p.start('sun');
    p.completeActive();
    expect(p.store.get().session).toBeNull();
    expect(p.store.get().waiting).toHaveLength(2);
    expect(p.heard()).toEqual({ weather: 'clear', bed: 'idle' });
    expect(p.fake.played.filter((x) => x.bus === 'chime').map((x) => x.spec.name)).toContain('completion');
  });

  it('pause and resume follow the active session, also across a switch', () => {
    const p = parallel();
    const a = p.start('rain');
    p.start('mist');
    p.controller.pause();
    expect(p.heard()).toEqual({ weather: 'mist', bed: 'paused' });
    p.controller.resume();
    expect(p.heard()).toEqual({ weather: 'mist', bed: 'running' });
    p.controller.pause();
    // switching away from a paused session resumes the chosen one: it runs, in its own weather
    p.controller.switchTo(a);
    expect(p.heard()).toEqual({ weather: 'rain', bed: 'running' });
  });

  it('stays muted by default: session events change nothing audible until unmuted', () => {
    const p = parallel();
    p.audio.setMuted(true);
    const masters = p.fake.masters.length;
    const played = p.fake.played.length;
    p.start('rain');
    p.start('mist');
    p.completeActive();
    expect(p.fake.masters).toHaveLength(masters);
    expect(p.fake.played).toHaveLength(played);
    // unmuting fades in with the state as it is now: nothing active, a clear garden
    p.audio.setMuted(false);
    expect(p.fake.masters.at(-1)).toEqual([MASTER_LEVEL, FADE_S]);
    expect(p.heard()).toEqual({ weather: 'clear', bed: 'idle' });
  });
});
