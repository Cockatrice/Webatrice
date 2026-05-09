import { GameTypes } from '@app/store';

import { useReduxEffect } from '../useReduxEffect';

export interface GameLifecycleHandlers {
  onKicked: () => void;
  onGameClosed: () => void;
  onGameLeft: () => void;
}

/**
 * Watches for `kicked` / `gameClosed` / `gameLeft` events targeting `gameId`
 * and invokes the matching handler. Consumers own toast + navigation because
 * hooks cannot import from `components/`. Mirrors desktop Cockatrice's
 * TabGame tear-down: game_event_handler.cpp eventKicked / eventGameClosed
 * emit signals that close the tab; self-leave is the local equivalent fired
 * by GameResponseImpl when Event_Leave's playerId matches the local player.
 */
export function useGameLifecycle(
  gameId: number | undefined,
  handlers: GameLifecycleHandlers,
): void {
  useReduxEffect(
    (action) => {
      if (gameId == null || action.payload?.gameId !== gameId) {
        return;
      }
      switch (action.type) {
        case GameTypes.KICKED:
          handlers.onKicked();
          return;
        case GameTypes.GAME_CLOSED:
          handlers.onGameClosed();
          return;
        case GameTypes.GAME_LEFT:
          handlers.onGameLeft();
          return;
      }
    },
    [GameTypes.KICKED, GameTypes.GAME_CLOSED, GameTypes.GAME_LEFT],
    [gameId],
  );
}
