import { useMemo } from 'react';
import { useWebClient } from '@cockatrice/datatrice/react';
import { ZoneName } from '@cockatrice/sockatrice';
import type { MoveCardParams } from '@cockatrice/sockatrice/generated';

import { useGameId } from '../GameIdContext';
import type {
  PlayerZoneCommands,
  RevealRecipient,
  RevealSelection,
  SeatMoveCard,
  SeatMoveDestination,
} from '../PlayerBoard/playerBoard.types';
import { useMoveCard } from './useMoveCard';

const RANDOM_CARD_FROM_ZONE = -2;

export function usePlayerZoneCommands(playerId: number): PlayerZoneCommands | undefined {
  const gameId = useGameId();
  const webClient = useWebClient();
  const moveCard = useMoveCard(gameId);

  return useMemo(() => {
    if (gameId == null || !moveCard) {
      return undefined;
    }
    const game = webClient.request.game;

    const reveal = (zoneName: string, to: RevealRecipient, cards: RevealSelection = 'zone') => {
      const params: { zoneName: string; topCards?: number; cardId?: number[]; playerId?: number } = { zoneName };
      if (cards === 'random') {
        params.cardId = [RANDOM_CARD_FROM_ZONE];
      } else if (cards !== 'zone' && 'cardIds' in cards) {
        params.cardId = [...cards.cardIds];
      } else if (cards !== 'zone') {
        params.topCards = cards.top;
        params.cardId = [0];
      }
      if (to !== 'all') {
        params.playerId = to;
      }
      game.revealCards(gameId, params);
    };

    // Command_MoveCard between two of this player's zones. `x = -1` appends
    // (desktop's "bottom" / "any free column"); is_reversed is sent only when
    // the caller asks, as the menus always have.
    //
    // `shuffleMoved` into the library sends Command_Shuffle over the moved
    // block with the move, in one container: [0, N-1] on top, [-N, -1] at
    // the bottom (player_actions.cpp:1853-1888).
    const moveCards = (from: string, cards: readonly SeatMoveCard[], to: SeatMoveDestination) => {
      const params: MoveCardParams = {
        startPlayerId: playerId,
        startZone: from,
        cardsToMove: {
          card: cards.map((c) => (typeof c === 'number' ? { cardId: c } : {
            cardId: c.id,
            ...(c.faceDown && { faceDown: true }),
            ...(c.pt && { pt: c.pt }),
            ...(c.tapped && { tapped: true }),
          })),
        },
        targetPlayerId: playerId,
        targetZone: to.zone,
        x: to.index === 'end' ? -1 : (to.index ?? 0),
        y: to.row ?? 0,
        ...(to.reversed !== undefined && { isReversed: to.reversed }),
      };
      if (to.shuffleMoved && to.zone === ZoneName.DECK && cards.length > 1) {
        const atBottom = to.reversed || to.index === 'end';
        const start = atBottom ? -cards.length : (params.x ?? 0);
        game.moveCardAndShuffle(gameId, params, { zoneName: ZoneName.DECK, start, end: start + cards.length - 1 });
        return;
      }
      moveCard(params);
    };

    return {
      move: moveCard,
      moveCards,
      draw: (count) => game.drawCards(gameId, { number: count }),
      undoDraw: () => game.undoDraw(gameId),
      mulligan: (handSize) => game.mulligan(gameId, { number: handSize }),
      shuffleLibrary: (range = { start: 0, end: -1 }) =>
        game.shuffle(gameId, { zoneName: ZoneName.DECK, start: range.start, end: range.end }),
      reveal,
      lendLibrary: (to) =>
        game.revealCards(gameId, { zoneName: ZoneName.DECK, playerId: to, grantWriteAccess: true }),
      setAlwaysRevealTopCard: (value) =>
        game.changeZoneProperties(gameId, { zoneName: ZoneName.DECK, alwaysRevealTopCard: value }),
      setAlwaysLookAtTopCard: (value) =>
        game.changeZoneProperties(gameId, { zoneName: ZoneName.DECK, alwaysLookAtTopCard: value }),
    };
  }, [gameId, webClient, moveCard, playerId]);
}
