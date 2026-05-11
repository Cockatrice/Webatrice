import { useReduxEffect } from '@app/hooks';
import { GameTypes } from '@app/store';

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
