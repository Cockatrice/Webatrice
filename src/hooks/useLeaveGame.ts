import { games } from 'datatrice';
import { useAppDispatch } from '@app/store';

import { useWebClient } from 'datatrice/react';

export function useLeaveGame(): (gameId: number) => void {
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  return (gameId: number) => {
    webClient.request.game.leaveGame(gameId);
    // @critical Servatrice strips the leaver from the broadcast list before Event_Leave; dispatch locally.
    // See .github/instructions/root.instructions.md#ui--server-layering-invariant.
    dispatch(games.Actions.gameLeft({ gameId }));
  };
}
