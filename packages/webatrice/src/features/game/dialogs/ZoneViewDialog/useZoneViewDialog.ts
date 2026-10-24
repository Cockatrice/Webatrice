import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ZoneName } from '@cockatrice/sockatrice';
import { games } from '@cockatrice/datatrice';

import { useAppSelector } from '@app/store';

import {
  revealedCardsToSeatCards,
  seatDisplayName,
  zoneToSeatCards,
} from '../../components/ui/GameBoardCell/usePlayerSeatViewModel';
import type { PlayerCardViewModel } from '../../components/ui/PlayerBoard/playerBoard.types';
import type { ZoneViewTarget } from '../../hooks/dialogs/gameDialogs.types';
import { zoneLabel } from '../shared/zoneLabels';
import { isOrderedView } from './zoneViewTarget';
import { isHiddenZone } from '../../utils/zones';

export interface ZoneViewData {
  cards: PlayerCardViewModel[];
  count: number;
  title: string;
  isLocal: boolean;
}

export function zoneViewTitle(t: TFunction, view: ZoneViewTarget, playerName: string, shownCount: number): string {
  if (view.zoneName === ZoneName.DECK) {
    return isOrderedView(view)
      ? t(view.isReversed ? 'ZoneViewTitle.bottom' : 'ZoneViewTitle.top', { count: shownCount, player: playerName })
      : t('ZoneViewTitle.library', { player: playerName });
  }
  return t('ZoneViewTitle.zone', { zone: zoneLabel(t, view.zoneName), player: playerName });
}

export function useZoneViewDialog(gameId: number | undefined, view: ZoneViewTarget): ZoneViewData {
  const { t } = useTranslation();
  const { playerId, zoneName } = view;
  const zone = useAppSelector((state) =>
    gameId != null ? games.Selectors.getZone(state, gameId, playerId, zoneName) : undefined,
  );
  const realName = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayer(state, gameId, playerId)?.properties.userInfo?.name : undefined,
  );
  const localPlayerId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getLocalPlayerId(state, gameId) : undefined,
  );
  const isLocal = playerId === localPlayerId;

  const cards = useMemo(
    () => (isHiddenZone(zone) ? revealedCardsToSeatCards(zone?.revealedCards) : zoneToSeatCards(zone)),
    [zone],
  );
  const count = zone?.cardCount ?? cards.length;
  const title = zoneViewTitle(t, view, seatDisplayName(t, realName, isLocal, playerId), cards.length);

  return { cards, count, title, isLocal };
}
