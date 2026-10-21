import { describe, expect, it } from 'vitest';
import { crossedMilestone, faunaArrivalLine, formatTimer, habitatPhrase, pickTips, spokenMinutes, TIER_WORDS } from './format';

const MIN = 60_000;

describe('ui format helpers', () => {
  it('names every tier', () => {
    expect(Object.values(TIER_WORDS)).toEqual(['wildflower', 'perennial', 'flowering shrub', 'centrepiece']);
  });

  it('formats timers via the core clock format', () => {
    expect(formatTimer(25 * MIN)).toBe('25:00');
    expect(formatTimer(65 * MIN + 9_000)).toBe('1:05:09');
  });

  it('speaks durations', () => {
    expect(spokenMinutes(1)).toBe('1 minute');
    expect(spokenMinutes(25)).toBe('25 minutes');
    expect(spokenMinutes(60)).toBe('1 hour');
    expect(spokenMinutes(90)).toBe('1 hour 30 minutes');
    expect(spokenMinutes(180)).toBe('3 hours');
  });

  it('joins habitat words', () => {
    expect(habitatPhrase(['water', 'shore'])).toBe('on the water · at the pond’s edge');
  });

  describe('crossedMilestone', () => {
    it('announces each threshold once, when crossed', () => {
      const goal = 50 * MIN;
      expect(crossedMilestone(31 * MIN, 30 * MIN, goal)).toBe('30 minutes left');
      expect(crossedMilestone(30 * MIN, 29 * MIN, goal)).toBeNull();
      expect(crossedMilestone(10 * MIN + 1, 10 * MIN, goal)).toBe('10 minutes left');
      expect(crossedMilestone(61_000, 59_000, goal)).toBe('1 minute left');
    });
    it('skips milestones at or above the goal', () => {
      expect(crossedMilestone(10 * MIN, 10 * MIN - 1000, 10 * MIN)).toBeNull();
      expect(crossedMilestone(31 * MIN, 29 * MIN, 30 * MIN)).toBeNull();
    });
    it('reports the largest milestone on a big jump', () => {
      expect(crossedMilestone(40 * MIN, 0, 60 * MIN)).toBe('30 minutes left');
    });
  });

  it('reads arrival lines from the core unlock table and skips silent creatures', () => {
    expect(faunaArrivalLine('koi-1')).toBe('A koi has found your pond.');
    expect(faunaArrivalLine('striders')).toBeNull();
    expect(faunaArrivalLine('unicorn')).toBeNull();
  });

  describe('pickTips', () => {
    const tip = (id: string) => ({ id, anchor: id });
    const all = ['sound', 'notifications', 'duration', 'task', 'plan', 'swap', 'placement', 'widget', 'mystery'].map(tip);
    it('orders by priority, one per region, at most two', () => {
      expect(pickTips(all, () => true)).toEqual(['placement', 'task']);
      const sheet = ['duration', 'plan', 'task', 'sound'].map(tip);
      expect(pickTips(sheet, () => true)).toEqual(['task', 'sound']);
    });
    it('skips tips whose anchor is not on screen', () => {
      const idle = ['notifications', 'sound', 'widget'].map(tip);
      expect(pickTips(idle, (a) => a !== 'widget')).toEqual(['notifications', 'sound']);
      expect(pickTips(idle, (a) => a === 'sound')).toEqual(['sound']);
    });
    it('respects max and ranks unknown ids last', () => {
      expect(pickTips(all, () => true, 1)).toEqual(['placement']);
      expect(pickTips([tip('mystery'), tip('sound')], () => true)).toEqual(['sound', 'mystery']);
    });
  });
});
