import { useMemo } from 'react';
import { useStore } from 'react-redux';

import { games } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { ZoneName } from '@cockatrice/sockatrice';
import {
  CardAttribute,
  Command_CreateToken_TargetMode,
  type ServerInfo_Card,
} from '@cockatrice/sockatrice/generated';
import { useAppDispatch, type RootState } from '@app/store';

import { resolveCardTableRow, tableRowToGridY } from '../../battlefield/Battlefield/cardPlacement';
import { readCardPlacement } from '../../battlefield/Battlefield/readCardPlacement';
import { useGameId } from '../GameIdContext';
import { useGameReadOnly } from '../GameReadOnlyContext';
import type { PlayerCardCommands } from '../PlayerBoard/playerBoard.types';

export function usePlayerCardCommands(playerId: number, isLocal: boolean): PlayerCardCommands | undefined {
  const gameId = useGameId();
  const readOnly = useGameReadOnly();
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  return useMemo(() => {
    if (gameId == null || readOnly) {
      return undefined;
    }
    const game = webClient.request.game;
    const setAttr = (cardId: number, attribute: CardAttribute, attrValue: string) =>
      game.setCardAttr(gameId, { zone: ZoneName.TABLE, cardId, attribute, attrValue });
    const patchCard = (cardId: number, fields: Partial<ServerInfo_Card>) =>
      dispatch(games.Actions.cardFieldsUpdated({ gameId, playerId, zoneName: ZoneName.TABLE, cardId, fields }));
    const tableCard = (cardId: number) =>
      games.Selectors.getZone(store.getState(), gameId, playerId, ZoneName.TABLE)?.byId[cardId];

    const commands: PlayerCardCommands = {
      setTapped: (cardIds, tapped) => {
        const attrValue = tapped ? '1' : '0';
        const judgeTargetId = isLocal ? undefined : playerId;
        for (const cardId of cardIds) {
          const currentCard = tableCard(cardId);
          if (currentCard == null || currentCard.tapped === tapped) {
            if (judgeTargetId == null) {
              setAttr(cardId, CardAttribute.AttrTapped, attrValue);
            } else {
              game.setCardAttr(
                gameId,
                { zone: ZoneName.TABLE, cardId, attribute: CardAttribute.AttrTapped, attrValue },
                judgeTargetId,
              );
            }
            continue;
          }
          const previousTapped = currentCard.tapped;
          patchCard(cardId, { tapped });
          const opKey = games.attrOpKey(playerId, cardId, CardAttribute.AttrTapped);
          games.beginOptimistic(opKey, () => patchCard(cardId, { tapped: previousTapped }));
          game.setCardAttr(
            gameId,
            { zone: ZoneName.TABLE, cardId, attribute: CardAttribute.AttrTapped, attrValue },
            judgeTargetId,
            {
              onError: (responseCode) => {
                console.warn(
                  `Command_SetCardAttr(tapped=${tapped}) rejected with code ${responseCode}; rolling back cardId ${cardId}`,
                );
                games.rollbackOptimistic(opKey);
              },
            },
          );
        }
      },
      untapAll: () => setAttr(-1, CardAttribute.AttrTapped, '0'),
      flip: (cardId, faceDown) => game.flipCard(gameId, { zone: ZoneName.TABLE, cardId, faceDown }),
      setDoesntUntap: (cardId, doesntUntap) => setAttr(cardId, CardAttribute.AttrDoesntUntap, doesntUntap ? '1' : '0'),
      setAnnotation: (cardId, annotation) => setAttr(cardId, CardAttribute.AttrAnnotation, annotation),
      setPT: (items) => {
        for (const { cardId, pt } of items) {
          const previousPt = tableCard(cardId)?.pt ?? '';
          if (previousPt !== pt) {
            patchCard(cardId, { pt });
          }
          game.setCardAttr(
            gameId,
            { zone: ZoneName.TABLE, cardId, attribute: CardAttribute.AttrPT, attrValue: pt },
            undefined,
            {
              onError: (code) => {
                console.warn(`setCardAttr(pt) rejected (${code}); rolling back cardId ${cardId} to "${previousPt}"`);
                patchCard(cardId, { pt: previousPt });
              },
            },
          );
        }
      },
      clone: (source) => {
        game.createToken(gameId, {
          zone: ZoneName.TABLE,
          cardName: source.name,
          cardProviderId: source.providerId,
          color: source.color,
          pt: source.pt,
          annotation: source.annotation,
          destroyOnZoneChange: true,
          x: -1,
          y: source.y,
        });
      },
      createToken: async (request) => {
        const tableRow = request.faceDown ? 2 : resolveCardTableRow(await readCardPlacement(request.name));
        const visualY = tableRowToGridY(tableRow);
        const isTransform = request.targetCardId != null && request.targetMode === 'transform_into';
        game.createToken(gameId, {
          zone: ZoneName.TABLE,
          cardName: request.name,
          cardProviderId: request.providerId ?? '',
          color: request.color,
          pt: request.pt,
          annotation: request.annotation,
          destroyOnZoneChange: request.destroyOnZoneChange,
          faceDown: request.faceDown,
          x: -1,
          y: visualY,
          ...(isTransform
            ? {
              targetZone: ZoneName.TABLE,
              targetCardId: request.targetCardId,
              targetMode: Command_CreateToken_TargetMode.TRANSFORM_INTO,
            }
            : {}),
        });
      },
    };

    if (isLocal) {
      commands.peek = (cardIds) => {
        if (cardIds.length === 0) {
          return;
        }
        const targets = cardIds.map((id) => ({
          ownerPlayerId: playerId,
          zone: ZoneName.TABLE,
          card: { id } as ServerInfo_Card,
        }));
        game.bulkPeek(gameId, targets, playerId);
      };
    }
    return commands;
  }, [gameId, readOnly, webClient, dispatch, store, playerId, isLocal]);
}
