import { useNavigate } from 'react-router-dom';

import { useToast } from '@app/components';
import { App } from '@app/types';

import { useGameLifecycle } from './useGameLifecycle';

export function useGameLifecycleNavigation(gameId: number | undefined): void {
  const navigate = useNavigate();

  const kickedToast = useToast({
    key: 'game-kicked',
    children: 'You were kicked from the game',
  });
  const gameClosedToast = useToast({
    key: 'game-closed',
    children: 'The game was closed by the host',
  });

  useGameLifecycle(gameId, {
    onKicked: () => {
      kickedToast.openToast();
      navigate(App.RouteEnum.SERVER);
    },
    onGameClosed: () => {
      gameClosedToast.openToast();
      navigate(App.RouteEnum.SERVER);
    },
    onGameLeft: () => {
      navigate(App.RouteEnum.SERVER);
    },
  });
}
