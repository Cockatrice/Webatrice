import { Phase } from '@cockatrice/datatrice';
import type { ActionId } from '@app/feature-widgets/shortcuts';

export const PHASE_COUNT = 11;

export const PHASE_SHORTCUT_ACTIONS = [
  'game.setPhase0',
  'game.setPhase1',
  'game.setPhase2',
  'game.setPhase3',
  'game.setPhase4',
  'game.setPhase5',
  'game.setPhase6',
  'game.setPhase7',
  'game.setPhase8',
  'game.setPhase9',
  'game.setPhase10',
] as const satisfies readonly ActionId[];

export function nextPhase(current: number): Phase {
  return current >= 0 ? (current + 1) % PHASE_COUNT : Phase.Untap;
}

export function previousPhase(current: number): Phase {
  return current > 0 ? current - 1 : PHASE_COUNT - 1;
}

export type PhaseFollowUp = 'untapAll' | 'drawOne' | null;

export interface NextPhaseActionPlan {
  advance: 'nextTurn' | { phase: Phase };
  then: PhaseFollowUp;
}

export function nextPhaseActionPlan(current: number): NextPhaseActionPlan {
  const phase = nextPhase(current);
  return {
    advance: phase === Phase.Untap ? 'nextTurn' : { phase },
    then: phaseFollowUp(phase),
  };
}

function phaseFollowUp(phase: Phase): PhaseFollowUp {
  switch (phase) {
    case Phase.Untap:
      return 'untapAll';
    case Phase.Draw:
      return 'drawOne';
    default:
      return null;
  }
}
