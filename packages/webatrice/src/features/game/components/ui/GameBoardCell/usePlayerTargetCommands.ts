import { useMemo } from 'react';
import { useStore } from 'react-redux';

import { games } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { usePreference, useSettings } from '@app/hooks';
import { ArrowColor } from '@app/types';
import type { RootState } from '@app/store';

import { autoPlayCard } from '../../../hooks/playCard';
import { useJudgeTarget } from '../../../hooks/useJudgeTarget';
import { useGameId } from '../GameIdContext';
import { arrowLifetime } from '../../../utils/arrowLifetime';
import type { PlayerTargetCommands } from '../PlayerBoard/playerBoard.types';

type AttachCardParams = Parameters<ReturnType<typeof useWebClient>['request']['game']['attachCard']>[1];
type CreateArrowParams = Parameters<ReturnType<typeof useWebClient>['request']['game']['createArrow']>[1];

export type TargetCommandsFor = (playerId: number) => PlayerTargetCommands;

export function useTargetCommandsFor(gameId: number | undefined): TargetCommandsFor | undefined {
  const webClient = useWebClient();
  const store = useStore<RootState>();
  const judgeTarget = useJudgeTarget(gameId);
  const { value: settings } = useSettings();
  const invertVerticalCoordinate = settings?.invertVerticalCoordinate ?? false;
  const playToStack = usePreference('playToStack');

  return useMemo(() => {
    if (gameId == null) {
      return undefined;
    }
    const id = gameId;
    return (playerId: number): PlayerTargetCommands => {
      const game = webClient.request.game;
      const zone = (name: string) => games.Selectors.getZone(store.getState(), id, playerId, name);
      const createArrow: PlayerTargetCommands['createArrow'] = (sourceCardId, sourceZone, target, color = ArrowColor.RED) => {
        const base = {
          startPlayerId: playerId,
          startZone: sourceZone,
          startCardId: sourceCardId,
          targetPlayerId: target.playerId,
          arrowColor: color,
          ...arrowLifetime(games.Selectors.getActivePhase(store.getState(), id)),
        };
        const params = target.kind === 'card'
          ? { ...base, targetZone: target.zone, targetCardId: target.cardId }
          : base;
        game.createArrow(id, params as CreateArrowParams);
      };
      return {
        attach: (sourceCardId, target) => {
          game.attachCard(id, {
            startZone: ZoneName.TABLE,
            cardId: sourceCardId,
            targetPlayerId: target.playerId,
            targetZone: ZoneName.TABLE,
            targetCardId: target.cardId,
          }, judgeTarget(playerId));
        },
        unattach: (sourceCardId) => {
          game.attachCard(id, { startZone: ZoneName.TABLE, cardId: sourceCardId } as AttachCardParams, judgeTarget(playerId));
        },
        createArrow,
        playAndCreateArrow: (handCardId, target, color) => {
          const card = zone(ZoneName.HAND)?.byId[handCardId];
          if (!card) {
            return;
          }
          void autoPlayCard({
            webClient,
            gameId: id,
            sourcePlayerId: playerId,
            sourceZone: ZoneName.HAND,
            card,
            faceDown: false,
            isInverted: invertVerticalCoordinate,
            judgeTargetId: judgeTarget(playerId),
            playToStack,
          }).then((playedZone) => createArrow(handCardId, playedZone, target, color));
        },
        clearOwnArrows: () => {
          const arrows = games.Selectors.getPlayer(store.getState(), id, playerId)?.arrows ?? {};
          for (const key of Object.keys(arrows)) {
            const arrowId = Number(key);
            if (Number.isFinite(arrowId)) {
              game.deleteArrow(id, { arrowId });
            }
          }
        },
      };
    };
  }, [gameId, webClient, store, judgeTarget, invertVerticalCoordinate, playToStack]);
}

export function usePlayerTargetCommands(playerId: number): PlayerTargetCommands | undefined {
  const commandsFor = useTargetCommandsFor(useGameId());
  return useMemo(() => commandsFor?.(playerId), [commandsFor, playerId]);
}
