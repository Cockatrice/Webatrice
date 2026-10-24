
import type { SeatSelection } from '../../../hooks/useSeatSelection';
import { applyPTDelta, parsePT } from '../../context-menus/CardContextMenu/cardAttributeEdits';
import { MAX_COUNTER_VALUE } from './counterLimits';
import type { BattlefieldCardViewModel, CardCloneSource } from './playerBoard.types';

export interface BattlefieldTargets {
  cards: readonly BattlefieldCardViewModel[];
  anchor: BattlefieldCardViewModel;
}

type PrintedPT = (cardName: string) => string;

export function resolveTargets(
  cards: readonly BattlefieldCardViewModel[],
  selection: SeatSelection | null,
  anchorId?: string,
): BattlefieldTargets | null {
  const battlefieldSelection = selection?.zone === 'battlefield' ? selection.ids : null;
  if (anchorId != null) {
    const anchor = cards.find((c) => c.id === anchorId);
    if (!anchor) {
      return null;
    }
    return battlefieldSelection?.has(anchor.id)
      ? { cards: cards.filter((c) => battlefieldSelection.has(c.id)), anchor }
      : { cards: [anchor], anchor };
  }
  if (!battlefieldSelection) {
    return null;
  }
  const selected = cards.filter((c) => battlefieldSelection.has(c.id));
  return selected.length > 0 ? { cards: selected, anchor: selected[0] } : null;
}

export function selectionOrAll(
  cards: readonly BattlefieldCardViewModel[],
  selection: SeatSelection | null,
): readonly BattlefieldCardViewModel[] {
  return selection?.zone === 'battlefield' && selection.ids.size > 0
    ? cards.filter((c) => selection.ids.has(c.id))
    : cards;
}

export function cardIdsOf(cards: readonly BattlefieldCardViewModel[]): number[] {
  return cards.map((c) => Number(c.id)).filter((id) => Number.isFinite(id));
}

export function currentPT(card: BattlefieldCardViewModel, printedPT: PrintedPT): string {
  return card.pt || printedPT(card.name);
}

export function ptDeltaEntries(
  cards: readonly BattlefieldCardViewModel[],
  printedPT: PrintedPT,
  deltaP: number,
  deltaT: number,
): { cardId: number; pt: string }[] {
  return withIds(cards).map(([cardId, card]) => ({
    cardId,
    pt: applyPTDelta(currentPT(card, printedPT) || '0/0', deltaP, deltaT),
  }));
}

export function resetPTEntries(
  cards: readonly BattlefieldCardViewModel[],
  printedPT: PrintedPT,
): { cardId: number; pt: string }[] {
  return withIds(cards).flatMap(([cardId, card]) => {
    const pt = card.faceDown ? '' : printedPT(card.name);
    return pt === (card.pt ?? '') ? [] : [{ cardId, pt }];
  });
}

export function counterStepEntries(
  cards: readonly BattlefieldCardViewModel[],
  counterId: number,
  step: 1 | -1,
): { cardId: number; counterId: number; value: number }[] {
  return withIds(cards).flatMap(([cardId, card]) => {
    const value = counterValue(card, counterId) + step;
    return value < 0 || value > MAX_COUNTER_VALUE ? [] : [{ cardId, counterId, value }];
  });
}

export function incrementAllCounterEntries(
  cards: readonly BattlefieldCardViewModel[],
): { cardId: number; counterId: number; value: number }[] {
  return withIds(cards).flatMap(([cardId, card]) =>
    (card.counters ?? [])
      .filter((counter) => counter.value < MAX_COUNTER_VALUE)
      .map((counter) => ({ cardId, counterId: counter.id, value: counter.value + 1 })),
  );
}

export function counterValue(card: BattlefieldCardViewModel, counterId: number): number {
  return card.counters?.find((counter) => counter.id === counterId)?.value ?? 0;
}

export function totalPower(cards: readonly BattlefieldCardViewModel[]): number {
  let total = 0;
  for (const card of cards) {
    const first = parsePT(card.pt ?? '')[0];
    if (first == null) {
      continue;
    }
    const power = typeof first === 'number' ? first : parseInt(first, 10);
    if (Number.isFinite(power)) {
      total += Math.max(power, 0);
    }
  }
  return total;
}

export function cloneSource(card: BattlefieldCardViewModel): CardCloneSource {
  return {
    name: card.name,
    providerId: card.scryfallId,
    color: card.color ?? '',
    pt: card.pt ?? '',
    annotation: card.annotation ?? '',
    y: card.slot.row,
  };
}

export function sameSlotIds(
  cards: readonly BattlefieldCardViewModel[],
  anchor: BattlefieldCardViewModel,
  field: 'row' | 'col',
): Set<string> {
  return new Set(cards.filter((c) => c.slot[field] === anchor.slot[field]).map((c) => c.id));
}

function withIds(cards: readonly BattlefieldCardViewModel[]): [number, BattlefieldCardViewModel][] {
  return cards.flatMap((card) => {
    const id = Number(card.id);
    return Number.isFinite(id) ? [[id, card]] : [];
  });
}
