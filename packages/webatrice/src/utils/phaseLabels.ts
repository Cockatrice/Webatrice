import type { TFunction } from 'i18next';
import { Phase } from '@cockatrice/datatrice';

const PHASE_KEYS: Record<Phase, string> = {
  [Phase.Untap]: 'untap', [Phase.Upkeep]: 'upkeep', [Phase.Draw]: 'draw',
  [Phase.FirstMain]: 'firstMain', [Phase.BeginCombat]: 'beginCombat',
  [Phase.DeclareAttackers]: 'declareAttackers', [Phase.DeclareBlockers]: 'declareBlockers',
  [Phase.CombatDamage]: 'combatDamage', [Phase.EndCombat]: 'endCombat',
  [Phase.SecondMain]: 'secondMain', [Phase.EndCleanup]: 'endCleanup',
};

export function phaseLabel(t: TFunction, phase: number, form: 'short' | 'log' | 'title'): string {
  const key = PHASE_KEYS[phase as Phase];
  return key ? t(`GamePhase.${key}.${form}`) : t('GamePhase.unknown', { phase });
}
