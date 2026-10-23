import type { CalendarView } from './calendar-model';
import type { UIState } from './types';

/**
 * The dock's quiet guidance (ADR 0201): one short helper line under each section heading that
 * says what the section is for and what to do next, in the italic voice of the page. It follows
 * the state (idle, focus, a break, paused, a planned session due, …). No guilt, no exclamation
 * marks, and nothing the tips already teach (ADR 0124): the tips explain a control; the helper
 * line says where you are and what comes next. Pure, so the copy is tested on its own.
 */
export interface GuideInput {
  panel: UIState['panel'];
  /** the end question is open */
  confirming: boolean;
  /** a planned session is waiting: its card offers Start, or (three growing) to see them */
  due: 'start' | 'limit' | null;
  /** sessions in progress (active and waiting) */
  sessions: number;
  /** a break whose plant has had its drink */
  watered: boolean;
  plant: 'growing' | 'bloom' | 'empty';
  /** the calendar's view, or null without a calendar */
  calendar: CalendarView | null;
}

export interface GuideLines {
  session: string;
  plant: string;
  calendar: string;
  tools: string;
}

export const GUIDE = {
  idle: 'Name a task, choose a plant, and watch it grow while you work.',
  waiting: 'Your seedlings wait where you left them. Resume one, or start something new.',
  due: 'A session you planned is ready. Start it, or let it pass for today.',
  dueFull: 'A session you planned is ready. It can begin once there is room in the garden.',
  focus: 'Your plant grows while you focus. Pause whenever you need to.',
  ending: 'Ending now lets this seedling go. Keep studying if you would rather.',
  break: 'A short rest. Water your plant, then carry on when you are ready.',
  watered: 'It has had its drink. Rest a little longer, or skip ahead to the next focus.',
  paused: 'Paused. Your plant waits, and so does the time.',
  longPause: 'Paused for a while. Resume when you are ready, or end the session.',
  growing: 'The seedling for this session. It grows with every minute you focus.',
  bloom: 'The last plant you grew. Each finished session adds one to the garden.',
  empty: 'Your first plant will grow here while you study.',
  calendarDay: 'Plan a session, or tap an empty hour to add one there.',
  calendarWeek: 'Plan a session, or tap a day to see what grew.',
  calendarMonth: 'Tap a day to see what grew, or plan a session.',
  tools: 'Sound, a floating timer and your keepsakes. They also wait in the garden’s corner.',
} as const;

export function guideLines(s: GuideInput): GuideLines {
  return { session: studyLine(s), plant: GUIDE[s.plant], calendar: calendarLine(s.calendar), tools: GUIDE.tools };
}

function studyLine(s: GuideInput): string {
  if (s.panel === 'longPause') return GUIDE.longPause;
  if (s.confirming) return GUIDE.ending;
  // a planned session's card is the first thing in the section: say what it asks
  if (s.due === 'start') return GUIDE.due;
  if (s.due === 'limit' && s.panel === 'idle') return GUIDE.dueFull;
  switch (s.panel) {
    case 'focus':
      return GUIDE.focus;
    case 'break':
      return s.watered ? GUIDE.watered : GUIDE.break;
    case 'paused':
      return GUIDE.paused;
    default:
      return s.sessions > 0 ? GUIDE.waiting : GUIDE.idle;
  }
}

function calendarLine(view: CalendarView | null): string {
  if (view === 'week') return GUIDE.calendarWeek;
  if (view === 'month') return GUIDE.calendarMonth;
  return GUIDE.calendarDay;
}
