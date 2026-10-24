import { games } from '@cockatrice/datatrice';
import { ZoneName } from '@cockatrice/sockatrice';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@app/store';
import { sortHandCards } from './sortHandCards';
import { CardDTO } from '../../../../services/dexie/DexieDTOs/CardDTO';
import type { GameDialogsActions, HandSortKey } from './gameDialogs.types';
import type { GameDialogEnv } from './gameDialogEnv';
import type { GameDialogSetters } from './useGameDialogState';

export type HandDialogActions = Pick<
  GameDialogsActions,
  | 'handleRequestChooseMulligan'
  | 'handleRequestSortHandBy'
>;

export interface UseHandDialogActionsArgs {
  env: GameDialogEnv;
  set: Pick<GameDialogSetters, 'setPrompt'>;
}

export function useHandDialogActions({
  env,
  set,
}: UseHandDialogActionsArgs): HandDialogActions {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { gameId, webClient, readGame, readLocalPlayer } = env;
  const { setPrompt } = set;

  const handleRequestChooseMulligan = useCallback(() => {
    if (gameId == null) {
      return;
    }
    // Mulligan accepts [-handSize, handSize + deckSize]; ≤0 is relative-to-hand-size (desktop parity).
    const localPlayer = readLocalPlayer();
    const handSize = localPlayer?.zones[ZoneName.HAND]?.cardCount ?? 0;
    const deckSize = localPlayer?.zones[ZoneName.DECK]?.cardCount ?? 0;
    const min = -handSize;
    const max = handSize + deckSize;
    setPrompt({
      title: t('GamePrompt.mulligan.title'),
      label: t('GamePrompt.library.numberOfCards'),
      initialValue: '7',
      helperText: t('GamePrompt.mulligan.helper'),
      validate: (v) => {
        if (!/^-?\d+$/.test(v)) {
          return t('GamePrompt.validation.integer');
        }
        const n = Number(v);
        if (n < min || n > max) {
          return t('GamePrompt.validation.integerRange', { min, max });
        }
        return null;
      },
      onSubmit: (value) => {
        const input = Number(value);
        const resolved = input < 1 ? handSize + input : input;
        webClient.request.game.mulligan(gameId, { number: resolved });
        setPrompt(null);
      },
    });
  }, [gameId, readLocalPlayer, webClient, setPrompt, t]);

  const handleRequestSortHandBy = useCallback(
    (key: HandSortKey) => {
      const game = readGame();
      const localPlayer = readLocalPlayer();
      if (gameId == null || game == null || localPlayer == null) {
        return;
      }
      const handZone = localPlayer.zones[ZoneName.HAND];
      if (!handZone || handZone.order.length < 2) {
        return;
      }
      const cards = handZone.order.map((id) => handZone.byId[id]).filter(Boolean);
      if (cards.length < 2) {
        return;
      }
      void (async () => {
        const entries = await Promise.all(cards.map(async (card) => ({
          card,
          metadata: key === 'name' ? undefined : await CardDTO.get(card.name).catch(() => undefined),
        })));
        dispatch(games.Actions.zoneOrderReplacedLocally({
          gameId,
          playerId: game.localPlayerId,
          zoneName: ZoneName.HAND,
          order: sortHandCards(entries, key),
        }));
      })();
    },
    [readGame, gameId, readLocalPlayer, dispatch],
  );

  return useMemo(
    () => ({
      handleRequestChooseMulligan,
      handleRequestSortHandBy,
    }),
    [
      handleRequestChooseMulligan,
      handleRequestSortHandBy,
    ],
  );
}
