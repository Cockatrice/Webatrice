import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useToast } from '@app/components';
import { RouteEnum } from '@app/types';
import { useGameLifecycle } from './useGameLifecycle';

export function useGameLifecycleNavigation(gameId: number | undefined): void {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const kickedToast = useToast({
    key: 'game-kicked',
    children: t('Game.toast.kicked'),
  });
  const gameClosedToast = useToast({
    key: 'game-closed',
    children: t('Game.toast.closed'),
  });

  useGameLifecycle(gameId, {
    onKicked: () => {
      kickedToast.openToast();
      navigate(RouteEnum.SERVER);
    },
    onGameClosed: () => {
      gameClosedToast.openToast();
      navigate(RouteEnum.SERVER);
    },
    onGameLeft: () => {
      navigate(RouteEnum.SERVER);
    },
  });
}
