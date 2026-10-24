import { useMemo } from 'react';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { RequestId } from '@cockatrice/sockatrice/types';

export function useGameDeckCommands(gameId: number | undefined) {
  const client = useWebClient();
  return useMemo(() => ({
    selectDeck: (params: { deckId: number } | { deck: string }, ...correlation: [requestId?: RequestId]) => {
      if (gameId != null) {
        client.request.game.deckSelect(gameId, params, ...correlation);
      }
    },
    readyStart: (params: { ready: boolean; forceStart?: boolean }) => {
      if (gameId != null) {
        client.request.game.readyStart(gameId, params);
      }
    },
    kick: (playerId: number) => {
      if (gameId != null) {
        client.request.game.kickFromGame(gameId, { playerId });
      }
    },
  }), [client, gameId]);
}
