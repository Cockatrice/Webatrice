import { useCallback, useMemo } from 'react';

import { games } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';

import { useGameReadOnly } from '../../components/ui/GameReadOnlyContext';

type HandCard = { id: string; name: string; scryfallId: string };

export function useIncomingReveal() {
  const reveal = useAppSelector(games.Selectors.getIncomingReveal);
  const dispatch = useAppDispatch();
  const gameReadOnly = useGameReadOnly();
  const readOnly = gameReadOnly || !reveal?.grantWriteAccess;

  const sourceName = useAppSelector((state) =>
    reveal
      ? games.Selectors.getPlayer(state, reveal.gameId, reveal.sourceOwnerId)?.properties.userInfo?.name
      : undefined,
  );

  const liveCards = useAppSelector((state) =>
    reveal ? games.Selectors.getRevealedCards(state, reveal.gameId, reveal.sourceOwnerId, reveal.zoneName) : undefined,
  );
  const cards = useMemo<HandCard[]>(
    () => (liveCards ?? []).map((c, i) => ({ id: String(c.id ?? i), name: c.name, scryfallId: c.providerId })),
    [liveCards],
  );

  const localPlayerId = useAppSelector((state) =>
    reveal ? games.Selectors.getLocalPlayerId(state, reveal.gameId) : undefined,
  );
  const isSpectator = useAppSelector((state) => (reveal ? games.Selectors.isSpectator(state, reveal.gameId) : false));

  const canDragLent =
    reveal != null &&
    !readOnly &&
    localPlayerId != null &&
    !isSpectator &&
    reveal.sourceOwnerId !== localPlayerId;

  const close = useCallback(() => {
    if (reveal) {
      dispatch(games.Actions.zoneViewCleared({
        gameId: reveal.gameId,
        playerId: reveal.sourceOwnerId,
        zoneName: reveal.zoneName,
      }));
    }
    dispatch(games.Actions.incomingRevealDismissed());
  }, [dispatch, reveal]);

  return { reveal, sourceName, cards, localPlayerId, canDragLent, readOnly, close };
}
