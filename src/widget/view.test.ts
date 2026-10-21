import { describe, expect, it } from 'vitest';
import { session, status } from './test-helpers';
import { planSegments, widgetView } from './view';

const speciesName = (id: string) => (id === 'japanese-iris' ? 'Japanese Iris' : undefined);

describe('widgetView', () => {
  it('idle: "No session running" and an open-garden action', () => {
    expect(widgetView(status())).toEqual({
      mode: 'idle',
      task: '',
      time: '',
      total: '',
      state: 'No session running',
      growth: 0,
      progress: 0,
      segments: [],
      buttons: [{ kind: 'open', label: 'Open garden', primary: false }],
      speciesId: null,
      seed: 0,
    });
  });

  it('focus: block time big, session total small, growth from the timeline, pause action', () => {
    const v = widgetView(
      status('focus', { blockRemainingMs: (24 * 60 + 13) * 1000, totalRemainingMs: (59 * 60 + 13) * 1000, growth: 0.02, progress: 0.01 }),
      { speciesName },
    );
    expect(v).toMatchObject({
      mode: 'focus',
      task: 'Biology ch. 4',
      time: '24:13',
      total: '59:13 in all',
      state: 'focus 1 of 2',
      growth: 0.02,
      progress: 0.01,
      speciesId: 'placeholder-sprout',
      seed: 7,
    });
    expect(v.buttons.map((b) => b.kind)).toEqual(['pause']);
  });

  it('an unbroken plan shows no total line', () => {
    const v = widgetView(status('focus', {}, { plan: { id: 'unbroken', name: 'Unbroken', blocks: [{ kind: 'focus', minutes: 25 }] } }));
    expect(v.total).toBe('');
    expect(v.state).toBe('growing quietly');
  });

  it('break: thirsty plant, water (primary), skip break and pause', () => {
    const v = widgetView(status('break', { blockIndex: 1, block: { kind: 'break', minutes: 10 }, blockRemainingMs: 252_000 }, { speciesId: 'japanese-iris' }), {
      speciesName,
    });
    expect(v).toMatchObject({ mode: 'break', time: '4:12', state: 'Break — your Japanese Iris is thirsty' });
    expect(v.buttons.map((b) => [b.kind, b.primary])).toEqual([
      ['water', true],
      ['skip', false],
      ['pause', false],
    ]);
  });

  it('break after watering: no water button', () => {
    const v = widgetView(status('break', { block: { kind: 'break', minutes: 10 }, watered: true }));
    expect(v.state).toBe('Watered — your plant is resting');
    expect(v.buttons.map((b) => b.kind)).toEqual(['skip', 'pause']);
  });

  it('paused: "paused" and a resume action', () => {
    const v = widgetView(status('paused', { blockRemainingMs: 600_000, growth: 0.6 }));
    expect(v).toMatchObject({ mode: 'paused', time: '10:00', state: 'paused', growth: 0.6 });
    expect(v.buttons.map((b) => b.kind)).toEqual(['resume']);
  });

  it('complete: the finished session in full bloom with an open-garden action', () => {
    const v = widgetView(status(), { completed: session({ speciesId: 'japanese-iris' }), speciesName });
    expect(v).toMatchObject({
      mode: 'complete',
      task: 'Biology ch. 4',
      time: '',
      state: 'Your Japanese Iris has bloomed — return to your garden',
      growth: 1,
      progress: 1,
      speciesId: 'japanese-iris',
    });
    expect(v.buttons).toEqual([{ kind: 'open', label: 'Open garden', primary: true }]);
  });

  it('a running session wins over a remembered completion', () => {
    expect(widgetView(status('focus'), { completed: session() }).mode).toBe('focus');
  });

  it('clamps growth and progress', () => {
    expect(widgetView(status('focus', { growth: 3, progress: Number.NaN }))).toMatchObject({ growth: 1, progress: 0 });
  });
});

describe('planSegments', () => {
  it('maps blocks to fractions of the whole session', () => {
    expect(
      planSegments([
        { kind: 'focus', minutes: 25 },
        { kind: 'break', minutes: 10 },
        { kind: 'focus', minutes: 25 },
      ]),
    ).toEqual([
      { kind: 'focus', start: 0, end: 25 / 60 },
      { kind: 'break', start: 25 / 60, end: 35 / 60 },
      { kind: 'focus', start: 35 / 60, end: 1 },
    ]);
    expect(planSegments([])).toEqual([]);
  });
});
