import { describe, expect, it } from 'vitest';
import { createManualClock } from '../core/clock';
import { createEventBus } from '../core/events';
import { createDefaultState, type ActiveSession, type GardenState, type PlantInstance } from '../core/state';
import type { AudioBackend } from './backend';
import { createGardenAudio, MAX_CHIMES, type Timers } from './garden-audio';
import { FADE_S, MASTER_LEVEL, type MixParams } from './params';
import type { SoundSpec } from './recipes';

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

  it('limits overlapping chimes', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    for (let i = 0; i < 5; i++) s.audio.playBloom();
    expect(s.fake.played.filter((p) => p.bus === 'chime')).toHaveLength(MAX_CHIMES);
  });

  it('reacts to session events: rain during a session, thinner when paused, clear afterwards', () => {
    const s = setup({}, { muted: false });
    s.audio.unlock();
    s.bus.emit('session:start', { session: session({ weather: 'rain' }) });
    expect(s.fake.mixes.at(-1)!.rain).toBeGreaterThan(0);
    expect(s.fake.mixes.at(-1)!.bed).toBeGreaterThan(1);
    s.bus.emit('session:pause', { sessionId: 's1', at: 0 });
    expect(s.fake.mixes.at(-1)!.bed).toBeLessThan(1);
    s.bus.emit('session:resume', { sessionId: 's1', at: 0 });
    expect(s.fake.mixes.at(-1)!.bed).toBeGreaterThan(1);
    s.bus.emit('session:cancel', { sessionId: 's1', at: 0 });
    expect(s.fake.mixes.at(-1)!.rain).toBe(0);
    expect(s.fake.mixes.at(-1)!.bed).toBe(1);
  });

  it('picks up a session already running at load (reload mid-session)', () => {
    const s = setup({ session: session({ weather: 'mist', pausedAt: 5 }) }, { muted: false });
    s.audio.unlock();
    const mix = s.fake.mixes.at(-1)!;
    expect(mix.airHz).toBeLessThan(5000);
    expect(mix.bed).toBeLessThan(1);
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
