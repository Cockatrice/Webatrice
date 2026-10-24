import { Phase } from '@cockatrice/datatrice';
import { getPreferencesSnapshot } from '@app/hooks';

const LAST_SUBPHASE: Readonly<Record<Phase, Phase>> = {
  [Phase.Untap]: Phase.Draw,
  [Phase.Upkeep]: Phase.Draw,
  [Phase.Draw]: Phase.Draw,
  [Phase.FirstMain]: Phase.FirstMain,
  [Phase.BeginCombat]: Phase.EndCombat,
  [Phase.DeclareAttackers]: Phase.EndCombat,
  [Phase.DeclareBlockers]: Phase.EndCombat,
  [Phase.CombatDamage]: Phase.EndCombat,
  [Phase.EndCombat]: Phase.EndCombat,
  [Phase.SecondMain]: Phase.SecondMain,
  [Phase.EndCleanup]: Phase.EndCleanup,
};

export function arrowDeleteInPhase(activePhase: number | undefined, keepInSubphases: boolean): number | undefined {
  if (!keepInSubphases || activePhase === undefined || !(activePhase in LAST_SUBPHASE)) {
    return undefined;
  }
  return LAST_SUBPHASE[activePhase as Phase] + 1;
}

export function arrowLifetime(activePhase: number | undefined): { deleteInPhase?: number } {
  const deleteInPhase = arrowDeleteInPhase(activePhase, getPreferencesSnapshot().doNotDeleteArrowsInSubPhases);
  return deleteInPhase === undefined ? {} : { deleteInPhase };
}
