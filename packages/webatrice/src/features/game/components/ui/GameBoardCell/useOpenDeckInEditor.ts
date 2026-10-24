import { useMemo } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';

import { games } from '@cockatrice/datatrice';
import { stageDeckDocument } from '@app/services';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

import { useGameId } from '../GameIdContext';

export function useOpenDeckInEditor(playerId: number, isLocal: boolean): (() => void) | undefined {
  const gameId = useGameId();
  const navigate = useNavigate();
  const deckList = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayer(state, gameId, playerId)?.deckList : undefined,
  );

  return useMemo(() => {
    if (!isLocal || !deckList) {
      return undefined;
    }
    return () => {
      navigate(generatePath(RouteEnum.DECK_DRAFT, { token: stageDeckDocument(deckList) }));
    };
  }, [isLocal, deckList, navigate]);
}
