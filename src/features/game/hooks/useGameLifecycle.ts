import { useReduxEffect } from '@app/hooks';
import { games } from 'datatrice';

export interface GameLifecycleHandlers {
  onKicked: () => void;
  onGameClosed: () => void;
  onGameLeft: () => void;
}

export function useGameLifecycle(
  gameId: number | undefined,
  handlers: GameLifecycleHandlers,
): void {
  useReduxEffect(
    (action) => {
      const payload = action.payload as { gameId?: number } | undefined;
      if (gameId == null || payload?.gameId !== gameId) {
        return;
      }
      switch (action.type) {
        case games.Types.KICKED:
          handlers.onKicked();
          return;
        case games.Types.GAME_CLOSED:
          handlers.onGameClosed();
          return;
        case games.Types.GAME_LEFT:
          handlers.onGameLeft();
          return;
      }
    },
    [games.Types.KICKED, games.Types.GAME_CLOSED, games.Types.GAME_LEFT],
    [gameId],
  );
}
