import { Phase } from '@cockatrice/datatrice';

import { nextPhase, nextPhaseActionPlan, previousPhase } from './phaseActions';

describe('phaseActions', () => {
  it.each([
    [-1, Phase.Untap, Phase.EndCleanup],
    [Phase.Untap, Phase.Upkeep, Phase.EndCleanup],
    [Phase.FirstMain, Phase.BeginCombat, Phase.Draw],
    [Phase.EndCleanup, Phase.Untap, Phase.SecondMain],
  ])('steps from %i to %i and back to %i', (current, next, previous) => {
    expect(nextPhase(current)).toBe(next);
    expect(previousPhase(current)).toBe(previous);
  });

  it.each([
    [-1, 'nextTurn', 'untapAll'],
    [Phase.Untap, { phase: Phase.Upkeep }, null],
    [Phase.Upkeep, { phase: Phase.Draw }, 'drawOne'],
    [Phase.Draw, { phase: Phase.FirstMain }, null],
    [Phase.FirstMain, { phase: Phase.BeginCombat }, null],
    [Phase.BeginCombat, { phase: Phase.DeclareAttackers }, null],
    [Phase.DeclareAttackers, { phase: Phase.DeclareBlockers }, null],
    [Phase.DeclareBlockers, { phase: Phase.CombatDamage }, null],
    [Phase.CombatDamage, { phase: Phase.EndCombat }, null],
    [Phase.EndCombat, { phase: Phase.SecondMain }, null],
    [Phase.SecondMain, { phase: Phase.EndCleanup }, null],
    [Phase.EndCleanup, 'nextTurn', 'untapAll'],
  ] as const)('plans next phase with action from %i', (current, advance, then) => {
    expect(nextPhaseActionPlan(current)).toEqual({ advance, then });
  });
});
