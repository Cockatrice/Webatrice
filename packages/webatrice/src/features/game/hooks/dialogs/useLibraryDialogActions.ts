import { ZoneName } from '@cockatrice/sockatrice';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameDialogsActions } from './gameDialogs.types';
import type { GameDialogEnv } from './gameDialogEnv';
import type { GameDialogSetters } from './useGameDialogState';

export type LibraryDialogActions = Pick<
  GameDialogsActions,
  | 'handleRequestDrawN'
  | 'handleRequestUndoDraw'
  | 'handleRequestMoveTopCardToZone'
  | 'handleRequestPlayTop'
  | 'handleRequestMoveTopNToZone'
>;

export interface UseLibraryDialogActionsArgs {
  env: GameDialogEnv;
  set: Pick<GameDialogSetters, 'setPrompt'>;
}

// Hidden-zone command addressing is positional. See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.

export function useLibraryDialogActions({ env, set }: UseLibraryDialogActionsArgs): LibraryDialogActions {
  const { t } = useTranslation();
  const { gameId, webClient, readGame } = env;
  const { setPrompt } = set;

  const handleRequestDrawN = useCallback(() => {
    if (gameId == null) {
      return;
    }
    setPrompt({
      title: t('GamePrompt.draw.cardsTitle'),
      label: t('GamePrompt.library.numberOfCards'),
      initialValue: '1',
      validate: (v) => (/^[1-9]\d*$/.test(v) ? null : t('GamePrompt.validation.positiveInteger')),
      onSubmit: (value) => {
        webClient.request.game.drawCards(gameId, { number: Number(value) });
        setPrompt(null);
      },
    });
  }, [gameId, webClient, setPrompt, t]);

  const handleRequestUndoDraw = useCallback(() => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.undoDraw(gameId);
  }, [gameId, webClient]);

  const handleRequestMoveTopCardToZone = useCallback(
    (targetZone: string, options?: { x?: number }) => {
      const game = readGame();
      if (gameId == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const deck = game.players[localPlayerId]?.zones[ZoneName.DECK];
      if ((deck?.cardCount ?? 0) === 0) {
        return;
      }
      // card_id = 0 for top.
      webClient.request.game.moveCard(gameId, {
        startPlayerId: localPlayerId,
        startZone: ZoneName.DECK,
        cardsToMove: { card: [{ cardId: 0 }] },
        targetPlayerId: localPlayerId,
        targetZone,
        x: options?.x ?? 0,
        y: 0,
        isReversed: false,
      });
    },
    [readGame, gameId, webClient],
  );

  const handleRequestPlayTop = useCallback(
    (faceDown: boolean) => {
      const game = readGame();
      if (gameId == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const deck = game.players[localPlayerId]?.zones[ZoneName.DECK];
      if ((deck?.cardCount ?? 0) === 0) {
        return;
      }
      // Play-from-top deliberately ignores tablerow. See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
      webClient.request.game.moveCard(gameId, {
        startPlayerId: localPlayerId,
        startZone: ZoneName.DECK,
        cardsToMove: { card: [{ cardId: 0, faceDown }] },
        targetPlayerId: localPlayerId,
        targetZone: faceDown ? ZoneName.TABLE : ZoneName.STACK,
        x: -1,
        y: 0,
        isReversed: false,
      });
    },
    [readGame, gameId, webClient],
  );

  const handleRequestMoveTopNToZone = useCallback(
    (targetZone: string) => {
      const game = readGame();
      if (gameId == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const zoneLabelKey = targetZone === ZoneName.GRAVE ? 'grave' : targetZone;
      const zoneLabel = t(`ZoneLabel.inline.${zoneLabelKey}`);
      setPrompt({
        title: t('ZoneMenu.promptMoveTop', { target: zoneLabel }),
        label: t('GamePrompt.library.numberOfCards'),
        initialValue: '1',
        validate: (v) => (/^[1-9]\d*$/.test(v) ? null : t('GamePrompt.validation.positiveInteger')),
        onSubmit: (value) => {
          const requested = Number(value);
          const deck = game.players[localPlayerId]?.zones[ZoneName.DECK];
          const cardCount = deck?.cardCount ?? 0;
          if (cardCount === 0) {
            setPrompt(null);
            return;
          }
          const n = Math.min(requested, cardCount);
          // Positional indices [n-1, ..., 0]; server resolves against deck ordering.
          const cards: { cardId: number }[] = [];
          for (let i = n - 1; i >= 0; i--) {
            cards.push({ cardId: i });
          }
          webClient.request.game.moveCard(gameId, {
            startPlayerId: localPlayerId,
            startZone: ZoneName.DECK,
            cardsToMove: { card: cards },
            targetPlayerId: localPlayerId,
            targetZone,
            x: 0,
            y: 0,
            isReversed: false,
          });
          setPrompt(null);
        },
      });
    },
    [readGame, gameId, webClient, setPrompt, t],
  );

  return useMemo(
    () => ({
      handleRequestDrawN,
      handleRequestUndoDraw,
      handleRequestMoveTopCardToZone,
      handleRequestPlayTop,
      handleRequestMoveTopNToZone,
    }),
    [
      handleRequestDrawN,
      handleRequestUndoDraw,
      handleRequestMoveTopCardToZone,
      handleRequestPlayTop,
      handleRequestMoveTopNToZone,
    ],
  );
}
