import { useMemo } from 'react';
import { ZoneName } from '@cockatrice/sockatrice';

import type { SeatSelection } from '../../../hooks/useSeatSelection';
import { playCardMoves } from '../../context-menus/CardContextMenu/handCardMenu.actions';
import type { PlayerCardViewModel, PlayerZoneCommands, SeatMoveDestination } from './playerBoard.types';
import { moveSelectedCards } from './selectionMoves';
import type { SeatCardMeta } from './useSeatCardMetadata';
import { usePreference } from '@app/hooks';

export interface UseHandCardOpsArgs {
  cards: readonly PlayerCardViewModel[];
  selection: SeatSelection | null;
  cardMetaByName: ReadonlyMap<string, SeatCardMeta>;
  zoneCommands: PlayerZoneCommands;
}

export interface HandCardOps {
  play(faceDown: boolean): void;
  move(to: SeatMoveDestination): void;
}

export interface HandCardActions {
  forSelection(): HandCardOps | null;
}

export function useHandCardOps({ cards, selection, cardMetaByName, zoneCommands }: UseHandCardOpsArgs): HandCardActions {
  const playToStack = usePreference('playToStack');
  return useMemo(() => ({
    forSelection: () => {
      if (selection?.zone !== 'hand') {
        return null;
      }
      const targets = Array.from(selection.ids)
        .map((id) => cards.find((c) => c.id === id))
        .filter((c): c is PlayerCardViewModel => c != null && Number.isFinite(Number(c.id)));
      if (targets.length === 0) {
        return null;
      }
      return {
        play: (faceDown) => {
          for (const { card, to } of playCardMoves(targets, (name) => cardMetaByName.get(name), { faceDown, playToStack })) {
            zoneCommands.moveCards(ZoneName.HAND, [card], to);
          }
        },
        move: (to) => moveSelectedCards(zoneCommands.moveCards, ZoneName.HAND, targets, to, (name) => cardMetaByName.get(name)),
      };
    },
  }), [cards, selection, cardMetaByName, zoneCommands, playToStack]);
}
