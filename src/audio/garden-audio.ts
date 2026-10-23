import type { Clock } from '../core/clock';
import type { EventBus } from '../core/events';
import { createRng } from '../core/rng';
import type { GardenState, Weather } from '../core/state';
import { createWebAudioBackend, type AudioBackend, type BackendFactory } from './backend';
import { gateStep, initialGate, isAudible, type GateCommand, type GateInput } from './gate';
import { FADE_S, localHour, MASTER_LEVEL, mixParams, sameMix, type AudioActivity, type MixParams } from './params';
import { createPlanner, type PlannedEvent } from './planner';
import { RECIPES, completion, pour, rinBowl, type RecipeName } from './recipes';

/**
 * The garden soundscape controller. Owns gating (muted by default, nothing starts before a
 * user-gesture unlock), listens to the event bus, runs the pure planner on a timer and drives
 * an AudioBackend. See docs/systems/audio.md.
 */
export interface GardenAudio {
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** Call from a user gesture (click/keydown/pointerdown): creates/resumes the AudioContext. */
  unlock(): void;
  /** Session weather; `null` = none (clear garden outside sessions). */
  setWeather(weather: Weather | null): void;
  setActivity(activity: AudioActivity): void;
  /** Unlocked creature ids ('small-birds', 'swallows', …) — more birds as fauna arrives. */
  setFauna(ids: readonly string[]): void;
  /** Override the local hour (0–24) used for time-of-day; `null` follows the clock again. */
  setTimeOfDay(hour: number | null): void;
  /** Soft rin-bowl chime (a plant blooms in). No-op while muted. */
  playBloom(): void;
  /** Short pentatonic phrase (session complete). No-op while muted. */
  playComplete(): void;
  /** Soft watering trickle (also on every `session:water`). No-op while muted. */
  playPour(): void;
  dispose(): void;
}

export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface GardenAudioOptions {
  bus: EventBus;
  getState: () => GardenState;
  clock: Clock;
  /** seed for the soundscape's randomness (default: a fixed label) */
  seed?: number | string;
  /** defaults to the Web Audio backend */
  createBackend?: BackendFactory;
  /** defaults to the global timers */
  timers?: Timers;
  /** scheduler tick (default 250 ms) */
  tickMs?: number;
}

/** Events are scheduled this far ahead of the audio clock so timer jitter never clips them. */
export const LOOKAHEAD_S = 0.12;
/** At most this many chimes overlap (repeated blooms never pile up). */
export const MAX_CHIMES = 2;
/** Longest audio-clock gap a tick may cover (after throttling we skip, never burst). */
const MAX_STEP_S = 1;

const globalTimers: Timers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as ReturnType<typeof setInterval>),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

const RECIPE_FOR: Record<Exclude<PlannedEvent['kind'], 'gust'>, RecipeName> = {
  plip: 'plip',
  drip: 'drip',
  chirp: 'chirp',
  warbler: 'warbler',
  swallow: 'swallow',
  cricket: 'cricket',
};

export function createGardenAudio(options: GardenAudioOptions): GardenAudio {
  const { bus, getState, clock } = options;
  const factory = options.createBackend ?? (() => createWebAudioBackend(options.seed));
  const timers = options.timers ?? globalTimers;
  const tickMs = options.tickMs ?? 250;
  const rng = createRng(options.seed ?? 'garden-audio');
  const planner = createPlanner({ rng: rng.fork('planner') });
  const chimeRng = rng.fork('chimes');
  const pourRng = rng.fork('pour');

  const initial = getState();
  let gate = initialGate(initial.settings.muted);
  let backend: AudioBackend | null = null;
  let unsupported = false;
  let weather: Weather | null = initial.session?.weather ?? null;
  let activity: AudioActivity = { sessionActive: !!initial.session, paused: initial.session?.pausedAt != null };
  let fauna = new Set<string>(initial.faunaSeen);
  let hourOverride: number | null = null;

  let interval: unknown = null;
  let suspendTimer: unknown = null;
  let lastNow: number | null = null;
  let lastMix: MixParams | null = null;
  let chimeEnds: number[] = [];

  const currentMix = () =>
    mixParams({ hour: hourOverride ?? localHour(clock.now()), weather, activity, fauna });

  const pushMix = (seconds: number) => {
    if (!backend) return;
    const mix = currentMix();
    if (seconds > 0 && sameMix(lastMix, mix)) return;
    backend.applyMix(mix, seconds);
    lastMix = mix;
  };

  function tick() {
    if (!backend || !isAudible(gate)) return;
    const now = backend.now();
    const dt = lastNow === null ? 0 : Math.min(MAX_STEP_S, Math.max(0, now - lastNow));
    lastNow = now;
    pushMix(1.5);
    const mix = lastMix ?? currentMix();
    for (const ev of planner.step(dt, mix.rates, now)) {
      const when = now + LOOKAHEAD_S + ev.at;
      if (ev.kind === 'gust') {
        const g = createRng(ev.seed);
        backend.gust(when, g.range(5, 8), g.range(1.5, 2.3));
      } else {
        backend.play(RECIPES[RECIPE_FOR[ev.kind]](createRng(ev.seed), ev.pan), when, 'events');
      }
    }
  }

  const stopTicking = () => {
    if (interval !== null) timers.clearInterval(interval);
    interval = null;
  };
  const cancelSuspend = () => {
    if (suspendTimer !== null) timers.clearTimeout(suspendTimer);
    suspendTimer = null;
  };

  function run(command: GateCommand) {
    if (command === 'ensure-context') {
      if (!backend && !unsupported) {
        backend = factory();
        unsupported = backend === null;
      }
      return;
    }
    if (!backend) return;
    const b = backend;
    switch (command) {
      case 'resume':
        cancelSuspend();
        void b.resume().catch(() => undefined);
        break;
      case 'fade-in':
        cancelSuspend();
        b.startBeds();
        pushMix(0);
        b.setMaster(MASTER_LEVEL, FADE_S);
        lastNow = null;
        planner.reset();
        stopTicking();
        interval = timers.setInterval(tick, tickMs);
        tick();
        break;
      case 'fade-out':
        stopTicking();
        b.setMaster(0, FADE_S);
        break;
      case 'suspend-after-fade':
        cancelSuspend();
        suspendTimer = timers.setTimeout(() => {
          suspendTimer = null;
          if (!isAudible(gate)) void b.suspend().catch(() => undefined);
        }, FADE_S * 1000 + 250);
        break;
      case 'close':
        stopTicking();
        cancelSuspend();
        b.close();
        backend = null;
        break;
    }
  }

  const send = (input: GateInput) => {
    const { state, commands } = gateStep(gate, input);
    gate = state;
    for (const c of commands) run(c);
  };

  function chime(kind: 'rin' | 'completion') {
    if (!backend || !isAudible(gate)) return;
    const now = backend.now();
    chimeEnds = chimeEnds.filter((end) => end > now);
    if (chimeEnds.length >= MAX_CHIMES) return;
    const spec = kind === 'rin' ? rinBowl(chimeRng, chimeRng.range(-0.15, 0.15)) : completion(chimeRng, 0);
    const when = now + 0.05;
    chimeEnds.push(when + spec.duration);
    backend.play(spec, when, 'chime');
  }

  /** The soft watering trickle (ADR 0182); one at a time, a second pour while one sounds is dropped. */
  let pourEnd = -Infinity;
  function playPour(): void {
    if (!backend || !isAudible(gate)) return;
    const now = backend.now();
    if (now < pourEnd) return;
    const spec = pour(pourRng, pourRng.range(-0.2, 0.2));
    const when = now + 0.05;
    pourEnd = when + spec.duration;
    backend.play(spec, when, 'events');
  }

  const setActivity = (a: AudioActivity) => {
    activity = { sessionActive: a.sessionActive, paused: a.sessionActive && a.paused };
    pushMix(1.5);
  };
  const setWeather = (w: Weather | null) => {
    weather = w;
    pushMix(1.5);
  };

  const offs = [
    bus.on('settings:changed', ({ settings }) => send({ type: 'mute', muted: settings.muted })),
    bus.on('session:start', ({ session }) => {
      weather = session.weather;
      setActivity({ sessionActive: true, paused: false });
    }),
    bus.on('session:pause', () => setActivity({ sessionActive: true, paused: true })),
    bus.on('session:resume', () => setActivity({ sessionActive: true, paused: false })),
    bus.on('session:cancel', () => {
      weather = null;
      setActivity({ sessionActive: false, paused: false });
    }),
    bus.on('session:complete', () => {
      weather = null;
      setActivity({ sessionActive: false, paused: false });
      chime('completion');
    }),
    bus.on('plant:placed', () => chime('rin')),
    // every watering pours, the automatic one during focus and the can tapped in a break
    bus.on('session:water', () => playPour()),
    bus.on('fauna:arrived', ({ id }) => {
      fauna.add(id);
      pushMix(1.5);
    }),
  ];

  return {
    setMuted: (muted) => send({ type: 'mute', muted }),
    isMuted: () => gate.muted,
    unlock: () => send({ type: 'unlock' }),
    setWeather,
    setActivity,
    setFauna(ids) {
      fauna = new Set(ids);
      pushMix(1.5);
    },
    setTimeOfDay(hour) {
      hourOverride = hour === null || !Number.isFinite(hour) ? null : hour;
      pushMix(1.5);
    },
    playBloom: () => chime('rin'),
    playComplete: () => chime('completion'),
    playPour,
    dispose() {
      for (const off of offs) off();
      send({ type: 'dispose' });
    },
  };
}
