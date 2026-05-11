import { GameDispatch } from '@app/store';

import { useWebClient } from './useWebClient';

/**
 * Sends Command_LeaveGame and optimistically dispatches `gameLeft` so local
 * state tears down immediately. Mirrors sockatrice's `leaveRoom` command,
 * which fires `response.room.leaveRoom` from an `onSuccess` callback —
 * `commands/game/leaveGame.js` ships without that callback, and Servatrice
 * removes the leaving player from the game's broadcast list before the
 * Event_Leave is sent, so the leaver receives nothing back to react to.
 * Without this dispatch, the lifecycle hook never fires and the tab stays
 * on /game/:gameId.
 */
export function useLeaveGame(): (gameId: number) => void {
  const webClient = useWebClient();
  return (gameId: number) => {
    webClient.request.game.leaveGame(gameId);
    GameDispatch.gameLeft(gameId);
  };
}
