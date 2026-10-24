import type { BattlefieldCardViewModel } from '../../ui/PlayerBoard/playerBoard.types';
import { BATTLEFIELD_ROWS, type BattlefieldSlotFull } from './battlefieldLayout';

export interface BattlefieldSlots {
  slots: BattlefieldSlotFull[];
  childrenByParent: Map<number, BattlefieldCardViewModel[]>;
}

const attachedHere = (card: BattlefieldCardViewModel, playerId: number) =>
  card.attachTargetCardId != null && card.attachTargetPlayerId === playerId;

export function battlefieldSlots(
  cards: readonly BattlefieldCardViewModel[],
  playerId: number,
  mirrored: boolean,
): BattlefieldSlots {
  const childrenByParent = new Map<number, BattlefieldCardViewModel[]>();
  for (const card of cards) {
    const parent = card.attachTargetCardId;
    if (parent != null && card.attachTargetPlayerId === playerId) {
      childrenByParent.set(parent, [...(childrenByParent.get(parent) ?? []), card]);
    }
  }
  const slots = cards
    .filter((card) => !attachedHere(card, playerId))
    .map((card) => ({
      row: mirrored ? BATTLEFIELD_ROWS - 1 - card.slot.row : card.slot.row,
      col: card.slot.col,
      subSlot: card.subSlot,
      attachedChildCount: childrenByParent.get(Number(card.id))?.length ?? 0,
    }));
  return { slots, childrenByParent };
}
