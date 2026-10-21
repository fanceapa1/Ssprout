/**
 * Mute / unlock gating as a pure state machine. Sound runs only when the user has unmuted
 * AND a user gesture has unlocked audio (browser autoplay policy), and never after dispose.
 * Each input yields the commands the engine must execute, in order.
 */

export interface GateState {
  muted: boolean;
  unlocked: boolean;
  disposed: boolean;
}

export type GateInput = { type: 'mute'; muted: boolean } | { type: 'unlock' } | { type: 'dispose' };

export type GateCommand =
  /** create the AudioContext if it does not exist yet (only ever from unlock) */
  | 'ensure-context'
  /** resume the AudioContext (inside the gesture, satisfies autoplay policies) */
  | 'resume'
  /** start beds if needed, fade master in, start scheduling */
  | 'fade-in'
  /** fade master out, stop scheduling */
  | 'fade-out'
  /** suspend the context once any fade has finished (saves CPU while muted) */
  | 'suspend-after-fade'
  /** release everything */
  | 'close';

export const isAudible = (s: GateState): boolean => !s.muted && s.unlocked && !s.disposed;

export function initialGate(muted: boolean): GateState {
  return { muted, unlocked: false, disposed: false };
}

export function gateStep(state: GateState, input: GateInput): { state: GateState; commands: GateCommand[] } {
  if (state.disposed) return { state, commands: [] };
  const was = isAudible(state);
  switch (input.type) {
    case 'dispose': {
      return { state: { ...state, disposed: true }, commands: ['close'] };
    }
    case 'unlock': {
      const next = { ...state, unlocked: true };
      const commands: GateCommand[] = ['ensure-context', 'resume'];
      if (isAudible(next) && !was) commands.push('fade-in');
      // unlocked while muted: the context was woken only to satisfy the gesture rule
      if (!isAudible(next)) commands.push('suspend-after-fade');
      return { state: next, commands };
    }
    case 'mute': {
      if (input.muted === state.muted) return { state, commands: [] };
      const next = { ...state, muted: input.muted };
      const now = isAudible(next);
      if (now && !was) return { state: next, commands: ['resume', 'fade-in'] };
      if (!now && was) return { state: next, commands: ['fade-out', 'suspend-after-fade'] };
      return { state: next, commands: [] };
    }
  }
}
