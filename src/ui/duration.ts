import { tierForMinutes } from '../core/rewards';
import { clampGoalMinutes, GOAL_PRESETS, GOAL_STEP_MINUTES, MAX_GOAL_MINUTES, MIN_GOAL_MINUTES } from '../core/session';
import { TIERS } from '../plants/types';
import { h, setText } from './dom';
import { spokenMinutes, TIER_SWATCH, TIER_WORDS } from './format';

/**
 * Total-time picker: big serif numeral + "min", a thin ink slider (10–180, step 5), quick picks
 * 25/50/90 and the tier the time earns ("wildflower · perennial · flowering shrub · centrepiece").
 */
export interface DurationControl {
  readonly el: HTMLElement;
  value(): number;
  set(minutes: number): void;
}

export function createDurationControl(initial: number, onChange: (minutes: number, committed: boolean) => void): DurationControl {
  let goal = clampGoalMinutes(initial);
  const goalValue = h('span.goal-value', { 'aria-hidden': 'true' });
  const slider = h('input.duration', {
    type: 'range',
    min: MIN_GOAL_MINUTES,
    max: MAX_GOAL_MINUTES,
    step: GOAL_STEP_MINUTES,
    'aria-label': 'Total time',
    'data-anchor': 'duration',
  });
  const presets = GOAL_PRESETS.map((m) =>
    h('button.preset', { type: 'button', 'data-minutes': m, 'aria-label': `${m} minutes`, onclick: () => set(m, true) }, String(m)),
  );
  const tierWords = TIERS.map((t) =>
    h('span.tier-word', { 'data-tier': t }, h('span.swatch', { style: { background: TIER_SWATCH[t] }, 'aria-hidden': 'true' }), TIER_WORDS[t]),
  );
  const tierSr = h('span.visually-hidden');
  const tierLine = h('p.tier-scale', {}, tierSr, ...tierWords);
  const el = h(
    'div.duration-control',
    {},
    h('p.goal', {}, goalValue, h('span.goal-unit', { 'aria-hidden': 'true' }, 'min')),
    slider,
    h('div.presets', { role: 'group', 'aria-label': 'Quick picks' }, ...presets),
    tierLine,
  );
  slider.addEventListener('input', () => set(Number(slider.value), false));
  slider.addEventListener('change', () => set(Number(slider.value), true));

  function render(): void {
    slider.value = String(goal);
    slider.setAttribute('aria-valuetext', spokenMinutes(goal));
    slider.style.setProperty('--fill', String((goal - MIN_GOAL_MINUTES) / (MAX_GOAL_MINUTES - MIN_GOAL_MINUTES)));
    setText(goalValue, String(goal));
    const tier = tierForMinutes(goal);
    for (const p of presets) p.setAttribute('aria-pressed', String(Number(p.dataset.minutes) === goal));
    for (const w of tierWords) w.classList.toggle('is-current', Number(w.dataset.tier) === tier);
    setText(tierSr, `Grows up to a ${TIER_WORDS[tier]}: `);
    tierLine.dataset.tier = String(tier);
  }

  function set(minutes: number, committed: boolean): void {
    const next = clampGoalMinutes(minutes);
    const changed = next !== goal;
    goal = next;
    render();
    if (changed || committed) onChange(goal, committed);
  }

  render();
  return {
    el,
    value: () => goal,
    set: (m) => {
      goal = clampGoalMinutes(m);
      render();
    },
  };
}
