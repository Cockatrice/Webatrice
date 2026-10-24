import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { useGameClock } from '../ChatLog/useGameClock';
import { usePhaseBar } from '../PhaseTrack/usePhaseBar';
import { summarizeStack, type StackSummaryItem } from './stackSummary';

export interface TurnBarModel {
  activePlayerName: string | undefined;
  elapsedSeconds: number;
  stack: StackSummaryItem[];
  canPassTurn: boolean;
  handlePass: () => void;
}

export function useTurnBar(gameId: number | undefined): TurnBarModel {
  const { t } = useTranslation();
  const seated = useAppSelector((state) =>
    gameId != null ? games.Selectors.getSeatedPlayers(state, gameId) : undefined,
  );
  const activePlayerId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePlayerId(state, gameId) : undefined,
  );
  const elapsedSeconds = useGameClock(gameId);
  const { canPassTurn, handlePass } = usePhaseBar(gameId);

  const active = seated?.find((p) => p.properties.playerId === activePlayerId);
  const activePlayerName = active
    ? active.properties.userInfo?.name ?? t('GameLog.player.number', { id: active.properties.playerId })
    : undefined;
  const stack = useMemo(() => summarizeStack(seated ?? []), [seated]);

  return { activePlayerName, elapsedSeconds, stack, canPassTurn, handlePass };
}
