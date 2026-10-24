
import { ZoneName } from '@cockatrice/sockatrice';
import { ArrowColor, type ColorRGBA } from '@app/types';

import type { ArrowTarget, PlayerTargetCommands } from '../components/ui/PlayerBoard/playerBoard.types';

export interface ArrowSource {
  playerId: number;
  zone: string;
  cardId: number;
}

export type ArrowPlan =
  | { kind: 'none' }
  | { kind: 'arrow'; source: ArrowSource; target: ArrowTarget }
  | { kind: 'playThenArrow'; source: ArrowSource; target: ArrowTarget }
  | { kind: 'attach'; sourcePlayerId: number; sourceCardIds: readonly number[]; target: { playerId: number; cardId: number } };

const isSameCard = (source: ArrowSource, target: ArrowTarget) =>
  target.kind === 'card'
  && target.playerId === source.playerId
  && target.zone === source.zone
  && target.cardId === source.cardId;

export function planArrow(source: ArrowSource, target: ArrowTarget, localPlayerId: number | undefined): ArrowPlan {
  if (isSameCard(source, target)) {
    return { kind: 'none' };
  }
  const fromLocalHand = source.zone === ZoneName.HAND && source.playerId === localPlayerId;
  const toHand = target.kind === 'card' && target.zone === ZoneName.HAND;
  return { kind: fromLocalHand && !toHand ? 'playThenArrow' : 'arrow', source, target };
}

export function planAttach(sourcePlayerId: number, sourceCardIds: readonly number[], target: ArrowTarget): ArrowPlan {
  if (
    target.kind !== 'card'
    || target.zone !== ZoneName.TABLE
    || target.attached
    || (target.playerId === sourcePlayerId && sourceCardIds.includes(target.cardId))
  ) {
    return { kind: 'none' };
  }
  return { kind: 'attach', sourcePlayerId, sourceCardIds, target: { playerId: target.playerId, cardId: target.cardId } };
}

export function arrowColorForModifiers(modifiers: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): ColorRGBA {
  if (modifiers.ctrlKey) {
    return ArrowColor.YELLOW;
  }
  if (modifiers.altKey) {
    return ArrowColor.BLUE;
  }
  if (modifiers.shiftKey) {
    return ArrowColor.GREEN;
  }
  return ArrowColor.RED;
}

export function sendArrowPlan(
  plan: ArrowPlan,
  commandsFor: (playerId: number) => PlayerTargetCommands,
  color: ColorRGBA = ArrowColor.RED,
): void {
  switch (plan.kind) {
    case 'arrow':
      commandsFor(plan.source.playerId).createArrow(plan.source.cardId, plan.source.zone, plan.target, color);
      return;
    case 'playThenArrow':
      commandsFor(plan.source.playerId).playAndCreateArrow(plan.source.cardId, plan.target, color);
      return;
    case 'attach': {
      const commands = commandsFor(plan.sourcePlayerId);
      for (const cardId of plan.sourceCardIds) {
        commands.attach(cardId, plan.target);
      }
      return;
    }
    case 'none':
      return;
  }
}
