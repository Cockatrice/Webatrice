import { useMemo } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';

import { useGameId } from '../GameIdContext';

export function useGameSay(isLocal: boolean): ((message: string) => void) | undefined {
  const gameId = useGameId();
  const webClient = useWebClient();
  return useMemo(() => {
    if (!isLocal || gameId == null) {
      return undefined;
    }
    return (message: string) => webClient.request.game.gameSay(gameId, { message });
  }, [isLocal, gameId, webClient]);
}
