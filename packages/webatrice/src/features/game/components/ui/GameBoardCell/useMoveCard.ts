import { useMemo } from 'react';
import { useStore } from 'react-redux';

import { games, type ZoneEntry } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { ZoneName } from '@cockatrice/sockatrice';
import type { MoveCardParams } from '@cockatrice/sockatrice/generated';
import { useAppDispatch, type RootState } from '@app/store';

export function resolveBattlefieldDropX(params: MoveCardParams, targetBattlefield: ZoneEntry): number {
  const x = params.x ?? 0;
  if (x < 0) {
    return x;
  }
  const requestedCol = Math.floor(x / 3);
  const row = params.y;
  const excludeIds = new Set((params.cardsToMove?.card ?? []).map((c) => c.cardId));
  const sameZoneSource = params.startPlayerId === params.targetPlayerId && params.startZone === ZoneName.TABLE;
  const occupiedByCol = new Map<number, Set<number>>();
  for (const id of targetBattlefield.order) {
    if (sameZoneSource && excludeIds.has(id)) {
      continue;
    }
    const c = targetBattlefield.byId[id];
    if (!c || c.y !== row) {
      continue;
    }
    const col = Math.floor(c.x / 3);
    let slots = occupiedByCol.get(col);
    if (!slots) {
      slots = new Set();
      occupiedByCol.set(col, slots);
    }
    slots.add(c.x % 3);
  }
  const freeSubSlotAt = (col: number): number | null => {
    const slots = occupiedByCol.get(col);
    if (!slots) {
      return 0;
    }
    for (let sub = 0; sub < 3; sub++) {
      if (!slots.has(sub)) {
        return sub;
      }
    }
    return null;
  };
  const requestedFree = freeSubSlotAt(requestedCol);
  if (requestedFree != null) {
    return requestedCol * 3 + requestedFree;
  }
  for (let step = 1; step < 32; step++) {
    for (const dir of [1, -1]) {
      const col = requestedCol + step * dir;
      if (col < 0) {
        continue;
      }
      const free = freeSubSlotAt(col);
      if (free != null) {
        return col * 3 + free;
      }
    }
  }
  return requestedCol * 3;
}

export function useMoveCard(gameId: number | undefined): ((params: MoveCardParams) => void) | undefined {
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  return useMemo(() => {
    if (gameId == null) {
      return undefined;
    }
    const game = webClient.request.game;

    return (baseParams: MoveCardParams) => {
      let params = baseParams;
      if (baseParams.targetZone === ZoneName.TABLE) {
        const targetBattlefield = games.Selectors.getZone(
          store.getState(),
          gameId,
          baseParams.targetPlayerId,
          ZoneName.TABLE,
        );
        if (targetBattlefield) {
          params = { ...baseParams, x: resolveBattlefieldDropX(baseParams, targetBattlefield) };
        }
      }

      const { startPlayerId, startZone, cardsToMove, targetPlayerId, targetZone, x, y } = params;

      const cardIdsFromParams = cardsToMove?.card ?? [];
      const isHiddenSource = startZone === ZoneName.DECK || startZone === ZoneName.SIDEBOARD;
      if (isHiddenSource || cardIdsFromParams.length !== 1) {
        game.moveCard(gameId, params);
        return;
      }

      const cardId = cardIdsFromParams[0].cardId;
      const sourceZoneEntry = games.Selectors.getZone(store.getState(), gameId, startPlayerId, startZone);
      const sourceCard = sourceZoneEntry?.byId[cardId];
      const sourceIndex = sourceZoneEntry?.order.indexOf(cardId) ?? -1;
      if (!sourceCard || sourceIndex < 0) {
        game.moveCard(gameId, params);
        return;
      }

      const leavingBattlefield = startZone === ZoneName.TABLE && targetZone !== ZoneName.TABLE;
      if (sourceCard.destroyOnZoneChange && leavingBattlefield) {
        game.moveCard(gameId, params);
        return;
      }

      const sameZone = startPlayerId === targetPlayerId && startZone === targetZone;
      const isPositionalReorderZone =
        targetZone === ZoneName.HAND
        || targetZone === ZoneName.STACK
        || targetZone === ZoneName.GRAVE
        || targetZone === ZoneName.EXILE;

      const optimisticCard = leavingBattlefield
        ? {
          ...sourceCard,
          x, y,
          tapped: false,
          attacking: false,
          doesntUntap: false,
          pt: '',
          color: '',
          annotation: targetZone === ZoneName.STACK ? sourceCard.annotation : '',
          counterList: [],
        }
        : { ...sourceCard, x, y };
      const opKey = games.moveOpKey(startPlayerId, cardId);

      if (sameZone && isPositionalReorderZone) {
        dispatch(games.Actions.cardMovedInSameZone({
          gameId,
          playerId: startPlayerId,
          zoneName: startZone,
          cardId,
          toIndex: x,
          card: optimisticCard,
        }));
        games.beginOptimistic(opKey, () => {
          dispatch(games.Actions.cardMovedInSameZone({
            gameId,
            playerId: startPlayerId,
            zoneName: startZone,
            cardId,
            toIndex: sourceIndex,
            card: sourceCard,
          }));
        });
      } else {
        dispatch(games.Actions.cardMovedBetweenZones({
          gameId,
          fromPlayerId: startPlayerId,
          fromZone: startZone,
          fromCardId: cardId,
          toPlayerId: targetPlayerId,
          toZone: targetZone,
          card: optimisticCard,
        }));
        games.beginOptimistic(opKey, () => {
          dispatch(games.Actions.cardMovedBetweenZones({
            gameId,
            fromPlayerId: targetPlayerId,
            fromZone: targetZone,
            fromCardId: cardId,
            toPlayerId: startPlayerId,
            toZone: startZone,
            card: sourceCard,
          }));
        });
      }

      game.moveCard(gameId, params, undefined, {
        onError: (responseCode) => {
          console.warn(`Command_MoveCard rejected with code ${responseCode}; rolling back cardId ${cardId}`);
          games.rollbackOptimistic(opKey);
        },
      });
    };
  }, [gameId, webClient, dispatch, store]);
}
