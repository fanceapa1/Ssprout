import { planProblem, type StudyPlan } from './plans';
import { noteProblem, scheduleProblem, type OccurrenceNote, type Schedule } from './schedule';
import { clampGoalMinutes, DEFAULT_TASK_NAME, MINUTE_MS, normalizeTaskName } from './session';
import { backfillLog } from './session-log';
import { DEFAULT_SCENERY, SCENERY_IDS, type SceneryId } from './sceneries';
import { readSoundscape } from './soundscape';
import {
  createDefaultState,
  MAX_SESSIONS,
  STATE_VERSION,
  type ActiveSession,
  type GardenState,
  type PlantInstance,
  type PressedFlower,
  type SessionLogEntry,
  type Settings,
  type Weather,
} from './state';

/**
 * Persistence (SPEC §9, ADRs 0033/0034, 0154, 0213, 0240): localStorage load/save with schema migrations,
 * corrupt-data recovery, and JSON export/import with structural validation.
 *
 * The storage key stays `studysprout:v1` for the life of the app; the `version` field inside
 * the stored JSON drives migrations.
 */

export const STORAGE_KEY = 'studysprout:v1';
export const CORRUPT_KEY_PREFIX = 'studysprout:corrupt:';
export const EXPORT_FORMAT = 'study-sprout-garden';
export const EXPORT_FORMAT_VERSION = 1;

/** The subset of the Web Storage API we use (tests pass a Map-backed fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type PersistErrorCode =
  | 'invalid-json'
  | 'not-a-garden'
  | 'unsupported-version'
  | 'migration-failed'
  | 'invalid-state'
  | 'storage-failed';

export interface PersistError {
  code: PersistErrorCode;
  message: string;
  /** where validation failed, e.g. `plants[3].seed` */
  path?: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: PersistError };

const fail = (code: PersistErrorCode, message: string, path?: string): { ok: false; error: PersistError } => ({
  ok: false,
  error: path === undefined ? { code, message } : { code, message, path },
});

// ---------------------------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;
/** Upgrades a document from version `n` (its key) to `n + 1`. Must not mutate its input. */
export type Migration = (doc: Json) => Json;
export type Migrations = Readonly<Record<number, Migration>>;

/** Every garden before v4 was the Japanese garden. */
const V3_SCENERY: SceneryId = 'japanese-garden';

/**
 * v1 → v2 (ADRs 0150, 0151): parallel sessions and the session log. The single session stays
 * the active one (it keeps running or stays paused exactly as it was) with no automatic
 * watering done yet; nothing waits; the log is back-filled from the finished plants (v1 kept no
 * history). Pure: no clock, never mutates its input; malformed parts are left for validation.
 */
export function migrateV1toV2(doc: Json): Json {
  const plants = Array.isArray(doc.plants) ? doc.plants : [];
  const readable = plants.flatMap((x): PlantInstance[] => {
    if (!isObject(x)) return [];
    const { id, speciesId, slotId, seed, plantedAt, sessionMinutes } = x;
    if (typeof id !== 'string' || typeof speciesId !== 'string' || typeof slotId !== 'string') return [];
    if (![seed, plantedAt, sessionMinutes].every((n) => typeof n === 'number' && Number.isFinite(n))) return [];
    const completedAt = typeof x.completedAt === 'number' && Number.isFinite(x.completedAt) ? x.completedAt : (plantedAt as number);
    return [{
      id,
      speciesId,
      sceneryId: V3_SCENERY,
      slotId,
      seed: seed as number,
      plantedAt: plantedAt as number,
      sessionMinutes: sessionMinutes as number,
      taskName: normalizeTaskName(x.taskName),
      completedAt,
    }];
  });
  const session = isObject(doc.session) ? { ...doc.session, focusWaterings: 0 } : (doc.session ?? null);
  return { ...doc, version: 2, session, waiting: [], log: backfillLog(readable) };
}

/** v2 → v3 reserves the sound preferences contract without changing any existing choices. */
export function migrateV2toV3(doc: Json): Json {
  return { ...doc, version: 3 };
}

/**
 * v3 → v4 (ADR 0240): per-scenery gardens. Every plant, pressed flower, session in progress and
 * log entry grew in the Japanese garden, which is also the one on view. `faunaSeen` keeps its ids
 * (Japanese ones are not namespaced). Pure; non-object entries are left for validation.
 */
export function migrateV3toV4(doc: Json): Json {
  const tag = (x: unknown): unknown => (isObject(x) ? { ...x, sceneryId: V3_SCENERY } : x);
  const out: Json = { ...doc, version: 4, scenery: V3_SCENERY };
  for (const key of ['plants', 'pressed', 'waiting', 'log'] as const) {
    if (Array.isArray(doc[key])) out[key] = (doc[key] as unknown[]).map(tag);
  }
  if (isObject(doc.session)) out.session = tag(doc.session);
  return out;
}

export const MIGRATIONS: Migrations = { 1: migrateV1toV2, 2: migrateV2toV3, 3: migrateV3toV4 };

export interface MigrateOptions {
  migrations?: Migrations;
  target?: number;
}

export interface Migrated {
  doc: Json;
  /** the version the document had before migrating */
  from: number;
}

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Bring a parsed document up to `target` (default: the current schema) one step at a time. */
export function migrate(raw: unknown, { migrations = MIGRATIONS, target = STATE_VERSION }: MigrateOptions = {}): Result<Migrated> {
  if (!isObject(raw)) return fail('not-a-garden', 'expected a garden object');
  const from = raw.version;
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 0) {
    return fail('not-a-garden', 'missing or invalid schema version', 'version');
  }
  if (from > target) return fail('unsupported-version', `garden version ${from} is newer than this app (${target})`);
  let doc = raw;
  for (let v = from; v < target; v++) {
    const step = migrations[v];
    if (!step) return fail('unsupported-version', `no migration from version ${v}`);
    try {
      doc = step(doc);
    } catch (err) {
      return fail('migration-failed', `migration ${v}→${v + 1} threw: ${String(err)}`);
    }
    if (!isObject(doc) || doc.version !== v + 1) {
      return fail('migration-failed', `migration ${v}→${v + 1} did not produce version ${v + 1}`);
    }
  }
  return { ok: true, value: { doc, from } };
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

export interface ValidateOptions {
  /** Species ids not known here are kept but reported in `warnings.unknownSpecies`. */
  isKnownSpecies?: (id: string) => boolean;
  /** used for `createdAt` when it is missing */
  now?: number;
}

export interface ValidationWarnings {
  /** sorted, unique species ids referenced by the garden but not known to this app */
  unknownSpecies: string[];
}

export interface Validated {
  state: GardenState;
  warnings: ValidationWarnings;
}

class Invalid extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(message);
    this.path = path;
  }
}

const WEATHERS: readonly Weather[] = ['sun', 'rain', 'mist'];
const NOTIFICATIONS: readonly Settings['notifications'][] = ['unasked', 'granted', 'denied'];

function obj(v: unknown, path: string): Json {
  if (!isObject(v)) throw new Invalid(path, 'expected an object');
  return v;
}
function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new Invalid(path, 'expected an array');
  return v;
}
function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new Invalid(path, 'expected a non-empty string');
  return v;
}
function num(v: unknown, path: string, min = -Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) {
    throw new Invalid(path, min === -Infinity ? 'expected a finite number' : `expected a number >= ${min}`);
  }
  return v;
}
function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') throw new Invalid(path, 'expected a boolean');
  return v;
}
function oneOf<T extends string | number>(v: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(v as T)) throw new Invalid(path, `expected one of ${allowed.join(', ')}`);
  return v as T;
}
/** Absent keys take the default; present keys must be valid. */
function opt<T>(o: Json, key: string, fallback: T, read: (v: unknown, path: string) => T, path: string): T {
  return o[key] === undefined ? fallback : read(o[key], path);
}

/** Absent: the default scenery (documents written by hand or by a dev `setState`). */
function sceneryId(o: Json, path: string): SceneryId {
  return opt(o, 'sceneryId', DEFAULT_SCENERY, (v, p) => oneOf(v, SCENERY_IDS, p), path);
}

/** One key per garden slot: slots are unique within a scenery, not across them. */
const slotKey = (x: { sceneryId: SceneryId; slotId: string }): string => `${x.sceneryId}/${x.slotId}`;

function taskName(o: Json, path: string): string {
  return normalizeTaskName(opt(o, 'taskName', DEFAULT_TASK_NAME, (v, p) => {
    if (typeof v !== 'string') throw new Invalid(p, 'expected a string');
    return v;
  }, path));
}

function readPlant(v: unknown, path: string): PlantInstance {
  const o = obj(v, path);
  const plantedAt = num(o.plantedAt, `${path}.plantedAt`);
  return {
    id: str(o.id, `${path}.id`),
    speciesId: str(o.speciesId, `${path}.speciesId`),
    sceneryId: sceneryId(o, `${path}.sceneryId`),
    slotId: str(o.slotId, `${path}.slotId`),
    seed: num(o.seed, `${path}.seed`),
    plantedAt,
    sessionMinutes: num(o.sessionMinutes, `${path}.sessionMinutes`, 0),
    taskName: taskName(o, `${path}.taskName`),
    completedAt: opt(o, 'completedAt', plantedAt, num, `${path}.completedAt`),
  };
}

function readPressed(v: unknown, path: string): PressedFlower {
  const o = obj(v, path);
  return {
    speciesId: str(o.speciesId, `${path}.speciesId`),
    sceneryId: sceneryId(o, `${path}.sceneryId`),
    seed: num(o.seed, `${path}.seed`),
    plantedAt: num(o.plantedAt, `${path}.plantedAt`),
    removedAt: num(o.removedAt, `${path}.removedAt`),
    taskName: taskName(o, `${path}.taskName`),
  };
}

function readPlan(v: unknown, path: string, goalMinutes: number): StudyPlan {
  const o = obj(v, path);
  const plan: StudyPlan = {
    id: str(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    blocks: arr(o.blocks, `${path}.blocks`).map((b, i) => {
      const bo = obj(b, `${path}.blocks[${i}]`);
      return {
        kind: oneOf(bo.kind, ['focus', 'break'] as const, `${path}.blocks[${i}].kind`),
        minutes: num(bo.minutes, `${path}.blocks[${i}].minutes`),
      };
    }),
  };
  const problem = planProblem(plan, goalMinutes);
  if (problem) throw new Invalid(path, problem);
  return plan;
}

function readSession(v: unknown, path: string): ActiveSession | null {
  if (v === null) return null;
  return readInProgress(v, path);
}

function readInProgress(v: unknown, path: string): ActiveSession {
  const o = obj(v, path);
  const goalMs = num(o.goalMs, `${path}.goalMs`, 1);
  if (goalMs % MINUTE_MS !== 0) throw new Invalid(`${path}.goalMs`, 'expected whole minutes');
  const plan = readPlan(o.plan, `${path}.plan`, goalMs / MINUTE_MS);
  const pausedAt = o.pausedAt ?? null;
  const displaced = o.displacedPlantId ?? null;
  const waterings = [
    ...new Set(
      opt(o, 'waterings', [] as number[], (w, p) => arr(w, p).map((x, i) => {
        const n = num(x, `${p}[${i}]`, 0);
        if (!Number.isInteger(n) || plan.blocks[n]?.kind !== 'break') {
          throw new Invalid(`${p}[${i}]`, 'expected the index of a break block');
        }
        return n;
      }), `${path}.waterings`),
    ),
  ];
  return {
    id: str(o.id, `${path}.id`),
    taskName: taskName(o, `${path}.taskName`),
    goalMs,
    plan,
    speciesId: str(o.speciesId, `${path}.speciesId`),
    sceneryId: sceneryId(o, `${path}.sceneryId`),
    slotId: str(o.slotId, `${path}.slotId`),
    seed: num(o.seed, `${path}.seed`),
    displacedPlantId: displaced === null ? null : str(displaced, `${path}.displacedPlantId`),
    startedAt: num(o.startedAt, `${path}.startedAt`),
    pausedAt: pausedAt === null ? null : num(pausedAt, `${path}.pausedAt`),
    pausedTotalMs: num(o.pausedTotalMs ?? 0, `${path}.pausedTotalMs`, 0),
    skippedMs: num(o.skippedMs ?? 0, `${path}.skippedMs`, 0),
    weather: oneOf(o.weather, WEATHERS, `${path}.weather`),
    waterings,
    focusWaterings: opt(o, 'focusWaterings', 0, (x, p) => {
      const n = num(x, p, 0);
      if (!Number.isInteger(n)) throw new Invalid(p, 'expected a whole number');
      return n;
    }, `${path}.focusWaterings`),
  };
}

function readWaiting(v: unknown, path: string): ActiveSession[] {
  return arr(v, path).map((x, i) => {
    const s = readInProgress(x, `${path}[${i}]`);
    if (s.pausedAt === null) throw new Invalid(`${path}[${i}].pausedAt`, 'a waiting session must be paused');
    return s;
  });
}

const OUTCOMES: readonly SessionLogEntry['outcome'][] = ['completed', 'cancelled'];

function readLogEntry(v: unknown, path: string): SessionLogEntry {
  const o = obj(v, path);
  const goalMinutes = num(o.goalMinutes, `${path}.goalMinutes`, 0);
  const startedAt = num(o.startedAt, `${path}.startedAt`);
  const entry: SessionLogEntry = {
    id: str(o.id, `${path}.id`),
    outcome: oneOf(o.outcome, OUTCOMES, `${path}.outcome`),
    taskName: taskName(o, `${path}.taskName`),
    speciesId: str(o.speciesId, `${path}.speciesId`),
    sceneryId: sceneryId(o, `${path}.sceneryId`),
    slotId: str(o.slotId, `${path}.slotId`),
    seed: num(o.seed, `${path}.seed`),
    plan: o.plan === null || o.plan === undefined ? null : readPlan(o.plan, `${path}.plan`, goalMinutes),
    goalMinutes,
    focusedMinutes: num(o.focusedMinutes, `${path}.focusedMinutes`, 0),
    startedAt,
    endedAt: num(o.endedAt, `${path}.endedAt`, startedAt),
  };
  if (o.backfilled !== undefined) {
    if (o.backfilled !== true) throw new Invalid(`${path}.backfilled`, 'expected true');
    entry.backfilled = true;
  }
  return entry;
}

/**
 * A scheduled session (ADR 0170). Absent in v2 documents written before phase 8: the key is
 * optional (default `[]`), so no schema bump. Present schedules must be valid.
 */
function readSchedule(v: unknown, path: string): Schedule {
  const o = obj(v, path);
  const notesRaw = opt(o, 'notes', {} as Json, obj, `${path}.notes`);
  const notes: Record<string, OccurrenceNote> = {};
  for (const [date, n] of Object.entries(notesRaw)) {
    const no = obj(n, `${path}.notes.${date}`);
    // known keys only (unknown ones are dropped, like everywhere else in the state)
    const note: OccurrenceNote = {};
    for (const k of ['skipped', 'dismissed', 'sessionId', 'name', 'time', 'lengthMinutes', 'planId'] as const) {
      if (no[k] !== undefined) (note as Record<string, unknown>)[k] = no[k];
    }
    const p = noteProblem(note);
    if (p) throw new Invalid(`${path}.notes.${date}`, p);
    notes[date] = note;
  }
  const s: Schedule = {
    id: str(o.id, `${path}.id`),
    name: normalizeTaskName(str(o.name, `${path}.name`)),
    date: str(o.date, `${path}.date`),
    time: str(o.time, `${path}.time`),
    lengthMinutes: o.lengthMinutes === undefined || o.lengthMinutes === null ? null : num(o.lengthMinutes, `${path}.lengthMinutes`),
    planId: o.planId === undefined || o.planId === null ? null : str(o.planId, `${path}.planId`),
    repeat: oneOf(o.repeat ?? 'none', ['none', 'daily', 'weekdays', 'weekly'] as const, `${path}.repeat`),
    until: o.until === undefined || o.until === null ? null : str(o.until, `${path}.until`),
    notes,
    createdAt: opt(o, 'createdAt', 0, num, `${path}.createdAt`),
  };
  const problem = scheduleProblem(s);
  if (problem) throw new Invalid(path, problem);
  return s;
}

function readSchedules(v: unknown, path: string): Schedule[] {
  const list = arr(v, path).map((x, i) => readSchedule(x, `${path}[${i}]`));
  const ids = new Set<string>();
  list.forEach((s, i) => {
    if (ids.has(s.id)) throw new Invalid(`${path}[${i}].id`, `duplicate schedule id "${s.id}"`);
    ids.add(s.id);
  });
  return list;
}

function readState(raw: unknown, now: number): GardenState {
  const o = obj(raw, '$');
  if (o.version !== STATE_VERSION) throw new Invalid('version', `expected version ${STATE_VERSION}`);
  const createdAt = opt(o, 'createdAt', now, num, 'createdAt');
  const d = createDefaultState(createdAt);

  const plants = opt(o, 'plants', d.plants, (v, p) => arr(v, p).map((x, i) => readPlant(x, `${p}[${i}]`)), 'plants');
  const ids = new Set<string>();
  const slots = new Set<string>();
  plants.forEach((pl, i) => {
    if (ids.has(pl.id)) throw new Invalid(`plants[${i}].id`, `duplicate plant id "${pl.id}"`);
    if (slots.has(slotKey(pl))) throw new Invalid(`plants[${i}].slotId`, `two plants in slot "${slotKey(pl)}"`);
    ids.add(pl.id);
    slots.add(slotKey(pl));
  });

  const statsRaw = opt(o, 'stats', {}, obj, 'stats');
  const settingsRaw = opt(o, 'settings', {}, obj, 'settings');
  const tipsRaw = opt(o, 'tips', {}, obj, 'tips');
  const tips: Record<string, 'seen'> = {};
  for (const [k, v] of Object.entries(tipsRaw)) {
    if (v !== 'seen') throw new Invalid(`tips.${k}`, 'expected "seen"');
    tips[k] = 'seen';
  }

  const state: GardenState = {
    version: STATE_VERSION,
    createdAt,
    scenery: opt(o, 'scenery', d.scenery, (v, p) => oneOf(v, SCENERY_IDS, p), 'scenery'),
    plants,
    pressed: opt(o, 'pressed', d.pressed, (v, p) => arr(v, p).map((x, i) => readPressed(x, `${p}[${i}]`)), 'pressed'),
    session: opt(o, 'session', null, readSession, 'session'),
    waiting: opt(o, 'waiting', [] as ActiveSession[], readWaiting, 'waiting'),
    log: opt(o, 'log', [] as SessionLogEntry[], (v, p) => arr(v, p).map((x, i) => readLogEntry(x, `${p}[${i}]`)), 'log'),
    schedules: opt(o, 'schedules', [] as Schedule[], readSchedules, 'schedules'),
    stats: {
      totalMinutes: opt(statsRaw, 'totalMinutes', 0, (v, p) => num(v, p, 0), 'stats.totalMinutes'),
      completed: opt(statsRaw, 'completed', 0, (v, p) => num(v, p, 0), 'stats.completed'),
      cancelled: opt(statsRaw, 'cancelled', 0, (v, p) => num(v, p, 0), 'stats.cancelled'),
    },
    faunaSeen: [
      ...new Set(opt(o, 'faunaSeen', d.faunaSeen, (v, p) => arr(v, p).map((x, i) => str(x, `${p}[${i}]`)), 'faunaSeen')),
    ],
    tips,
    settings: {
      ...('soundscape' in settingsRaw ? {
        soundscape: (() => {
          const read = readSoundscape(settingsRaw.soundscape);
          if (!read) throw new Invalid('settings.soundscape', 'expected a sound mix with levels from 0 to 100');
          return read;
        })(),
      } : {}),
      muted: opt(settingsRaw, 'muted', d.settings.muted, bool, 'settings.muted'),
      lastGoalMinutes: clampGoalMinutes(
        opt(settingsRaw, 'lastGoalMinutes', d.settings.lastGoalMinutes, num, 'settings.lastGoalMinutes'),
      ),
      notifications: opt(
        settingsRaw,
        'notifications',
        d.settings.notifications,
        (v, p) => oneOf(v, NOTIFICATIONS, p),
        'settings.notifications',
      ),
    },
  };
  // sessions in progress: at most MAX_SESSIONS, unique ids not used by a plant or the log, one per garden slot
  const inProgress: Array<[ActiveSession, string]> = [
    ...(state.session ? [[state.session, 'session'] as [ActiveSession, string]] : []),
    ...state.waiting.map((w, i) => [w, `waiting[${i}]`] as [ActiveSession, string]),
  ];
  if (inProgress.length > MAX_SESSIONS) throw new Invalid('waiting', `at most ${MAX_SESSIONS} sessions in progress`);
  const logged = new Set(state.log.map((e) => e.id));
  const sessionIds = new Set<string>();
  const heldSlots = new Set<string>();
  for (const [s, path] of inProgress) {
    if (ids.has(s.id)) throw new Invalid(`${path}.id`, 'the session id is already used by a finished plant');
    if (logged.has(s.id)) throw new Invalid(`${path}.id`, 'the session id is already in the log (it has ended)');
    if (sessionIds.has(s.id)) throw new Invalid(`${path}.id`, `duplicate session id "${s.id}"`);
    if (heldSlots.has(slotKey(s))) throw new Invalid(`${path}.slotId`, `two sessions in slot "${slotKey(s)}"`);
    sessionIds.add(s.id);
    heldSlots.add(slotKey(s));
  }
  return state;
}

/** Referenced species ids (plants, pressed flowers, the growing session) unknown to `isKnown`. */
export function unknownSpeciesIds(state: GardenState, isKnown: (id: string) => boolean): string[] {
  const ids = new Set<string>();
  for (const p of state.plants) ids.add(p.speciesId);
  for (const p of state.pressed) ids.add(p.speciesId);
  if (state.session) ids.add(state.session.speciesId);
  for (const w of state.waiting) ids.add(w.speciesId);
  for (const e of state.log) ids.add(e.speciesId);
  return [...ids].filter((id) => !isKnown(id)).sort();
}

/**
 * Structural validation + normalisation of a current-version document. Absent keys get their
 * defaults, present keys must have the right shape, unknown keys are dropped, invariants
 * (unique plant ids, one plant per garden slot, a valid plan for the session) are enforced.
 */
export function validateState(raw: unknown, opts: ValidateOptions = {}): Result<Validated> {
  try {
    const state = readState(raw, opts.now ?? 0);
    const unknownSpecies = opts.isKnownSpecies ? unknownSpeciesIds(state, opts.isKnownSpecies) : [];
    return { ok: true, value: { state, warnings: { unknownSpecies } } };
  } catch (err) {
    if (err instanceof Invalid) return fail('invalid-state', `${err.path}: ${err.message}`, err.path);
    throw err;
  }
}

/** Parse → migrate → validate. */
export function parseGarden(json: string, opts: ValidateOptions & MigrateOptions = {}): Result<Validated & { from: number }> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail('invalid-json', 'not valid JSON');
  }
  return decodeGarden(raw, opts);
}

function decodeGarden(raw: unknown, opts: ValidateOptions & MigrateOptions): Result<Validated & { from: number }> {
  const m = migrate(raw, opts);
  if (!m.ok) return m;
  const v = validateState(m.value.doc, opts);
  if (!v.ok) return v;
  return { ok: true, value: { ...v.value, from: m.value.from } };
}

// ---------------------------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------------------------

export type LoadStatus =
  /** nothing stored yet */
  | 'fresh'
  | 'loaded'
  /** stored under an older schema; upgraded and re-saved */
  | 'migrated'
  /** stored data was unreadable; backed up under `backupKey`, starting fresh */
  | 'recovered'
  /** storage is unavailable (private mode, blocked); nothing will persist */
  | 'unavailable';

export interface LoadResult {
  state: GardenState;
  status: LoadStatus;
  warnings: ValidationWarnings;
  error?: PersistError;
  backupKey?: string;
}

export interface LoadOptions extends ValidateOptions, MigrateOptions {
  key?: string;
}

const noWarnings = (): ValidationWarnings => ({ unknownSpecies: [] });

/** Read the garden from storage. Never throws; always returns a usable state. */
export function loadState(storage: StorageLike | null, now: number, opts: LoadOptions = {}): LoadResult {
  const key = opts.key ?? STORAGE_KEY;
  if (!storage) return { state: createDefaultState(now), status: 'unavailable', warnings: noWarnings() };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch (err) {
    return {
      state: createDefaultState(now),
      status: 'unavailable',
      warnings: noWarnings(),
      error: { code: 'storage-failed', message: String(err) },
    };
  }
  if (raw === null) return { state: createDefaultState(now), status: 'fresh', warnings: noWarnings() };

  const parsed = parseGarden(raw, { ...opts, now });
  if (parsed.ok) {
    const { state, warnings, from } = parsed.value;
    if (from === STATE_VERSION) return { state, status: 'loaded', warnings };
    saveState(storage, state, key);
    return { state, status: 'migrated', warnings };
  }

  const state = createDefaultState(now);
  const backupKey = `${CORRUPT_KEY_PREFIX}${now}`;
  let backedUp = false;
  try {
    storage.setItem(backupKey, raw);
    backedUp = true;
  } catch {
    // no room for a backup; keep the original in place rather than lose it
  }
  if (backedUp) saveState(storage, state, key);
  const result: LoadResult = { state, status: 'recovered', warnings: noWarnings(), error: parsed.error };
  if (backedUp) result.backupKey = backupKey;
  return result;
}

export function saveState(storage: StorageLike, state: GardenState, key = STORAGE_KEY): Result<void> {
  try {
    storage.setItem(key, JSON.stringify(state));
    return { ok: true, value: undefined };
  } catch (err) {
    return fail('storage-failed', String(err));
  }
}

export interface SaverOptions {
  key?: string;
  /** debounce window, ms (default 300) */
  delayMs?: number;
  onError?: (error: PersistError) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface Saver {
  /** Save `state` after the debounce window (later calls replace earlier ones). */
  schedule(state: GardenState): void;
  /** Write the pending state now (call on `pagehide`). */
  flush(): void;
  /** Drop the pending write. */
  cancel(): void;
  readonly pending: boolean;
}

export function createSaver(storage: StorageLike, opts: SaverOptions = {}): Saver {
  const delay = opts.delayMs ?? 300;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let next: GardenState | null = null;
  let timer: unknown = null;

  const flush = (): void => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (!next) return;
    const state = next;
    next = null;
    const r = saveState(storage, state, opts.key);
    if (!r.ok) opts.onError?.(r.error);
  };

  return {
    schedule(state) {
      next = state;
      if (timer === null) timer = setTimer(flush, delay);
    },
    flush,
    cancel() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      next = null;
    },
    get pending() {
      return next !== null;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------------------------

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  summary: { plants: number; pressed: number; totalMinutes: number; completed: number };
  state: GardenState;
}

/** Pretty JSON with metadata, ready to download. */
export function exportState(state: GardenState, now: number): string {
  const envelope: ExportEnvelope = {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: state.version,
    exportedAt: new Date(now).toISOString(),
    summary: {
      plants: state.plants.length,
      pressed: state.pressed.length,
      totalMinutes: state.stats.totalMinutes,
      completed: state.stats.completed,
    },
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

/** `study-sprout-garden-YYYY-MM-DD.json` in local time. */
export function exportFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `study-sprout-garden-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export type ImportResult = { ok: true; state: GardenState; warnings: ValidationWarnings } | { ok: false; error: PersistError };

/**
 * Validate an exported file (or a bare stored state). Unknown species are kept and reported in
 * `warnings.unknownSpecies` (they may come from a newer app build).
 */
export function importState(json: string, opts: ValidateOptions & MigrateOptions = {}): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: { code: 'invalid-json', message: 'not valid JSON' } };
  }
  if (isObject(raw) && 'format' in raw) {
    if (raw.format !== EXPORT_FORMAT) return { ok: false, error: { code: 'not-a-garden', message: 'not a Study Sprout garden file' } };
    if (!isObject(raw.state)) return { ok: false, error: { code: 'not-a-garden', message: 'file has no garden', path: 'state' } };
    raw = raw.state;
  }
  const r = decodeGarden(raw, opts);
  if (!r.ok) return r;
  return { ok: true, state: r.value.state, warnings: r.value.warnings };
}
