import type { BracketSignals } from './bracket';

export type SignalTone = 'muted' | 'warn' | 'hot';

export type BracketSignalId = 'gameChangers' | 'denial' | 'turns' | 'earlyCombos' | 'lateCombos';

export interface SignalBadgeSpec {
  id: BracketSignalId;
  count: number;
  tone: SignalTone;
  items: string[];
  chainable?: string[];
}

export function bracketSignalBadges(signals: BracketSignals): SignalBadgeSpec[] {
  const gcHot = signals.gameChangers.matches.length > 3;
  const gcWarn = !gcHot && signals.gameChangers.matches.length > 0;

  const turnsHot = signals.turns.matches.length > 3 || signals.turns.restricted.length > 0;
  const turnsWarn = !turnsHot && signals.turns.matches.length > 2;

  const denialHot = signals.denial.matches.length > 0 || signals.denial.restricted.length > 0;

  const earlyHot = signals.earlyCombos.length > 0;
  const lateHot = signals.lateCombos.length > 0;

  return [
    {
      id: 'gameChangers',
      count: signals.gameChangers.matches.length,
      tone: gcHot ? 'hot' : gcWarn ? 'warn' : 'muted',
      items: signals.gameChangers.matches,
    },
    {
      id: 'denial',
      count: signals.denial.matches.length + signals.denial.restricted.length,
      tone: denialHot ? 'hot' : 'muted',
      items: [...signals.denial.matches, ...signals.denial.restricted],
    },
    {
      id: 'turns',
      count: signals.turns.matches.length,
      tone: turnsHot ? 'hot' : turnsWarn ? 'warn' : 'muted',
      items: signals.turns.matches,
      chainable: signals.turns.restricted,
    },
    {
      id: 'earlyCombos',
      count: signals.earlyCombos.length,
      tone: earlyHot ? 'hot' : 'muted',
      items: signals.earlyCombos.map((c) => c.cardNames.join(' + ')),
    },
    {
      id: 'lateCombos',
      count: signals.lateCombos.length,
      tone: lateHot ? 'warn' : 'muted',
      items: signals.lateCombos.map((c) => c.cardNames.join(' + ')),
    },
  ];
}
