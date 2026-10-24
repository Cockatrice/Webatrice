import { ZoneName } from '@cockatrice/sockatrice';
import { games, type GameEntry } from '@cockatrice/datatrice';
import { useCallback, useEffect, useMemo } from 'react';

import { useAppDispatch, useAppSelector } from '@app/store';
import type { GameDialogsActions, ZoneViewTarget } from './gameDialogs.types';
import type { GameDialogEnv } from './gameDialogEnv';
import type { GameDialogSetters } from './useGameDialogState';
import { readShuffleOnClose } from '../../dialogs/shared/zoneViewPreferences';
import { offersShuffleOnClose } from '../../dialogs/ZoneViewDialog/zoneViewTarget';
import { isHiddenZone } from '../../utils/zones';
import { useGameReadOnly } from '../../components/ui/GameReadOnlyContext';

function viewHasZone(game: GameEntry | undefined, view: ZoneViewTarget): boolean {
  return game?.players[view.playerId]?.zones[view.zoneName] != null;
}

export type ZoneDialogActions = Pick<
  GameDialogsActions,
  | 'openZoneView'
  | 'openViewLibrary'
  | 'openViewGraveyard'
  | 'openViewSideboard'
  | 'handleCloseZoneView'
>;

export interface UseZoneDialogActionsArgs {
  env: GameDialogEnv;
  zoneViews: ZoneViewTarget[];
  hasSeat: boolean;
  set: Pick<GameDialogSetters, 'setZoneViews'>;
}

export function useZoneDialogActions({
  env,
  zoneViews,
  hasSeat,
  set,
}: UseZoneDialogActionsArgs): ZoneDialogActions {
  const { gameId, webClient, readGame, readLocalPlayer } = env;
  const { setZoneViews } = set;
  const dispatch = useAppDispatch();
  const readOnly = useGameReadOnly();

  const sendViewClosed = useCallback((view: ZoneViewTarget, shuffleOnClose?: boolean) => {
    const { playerId, zoneName } = view;
    const game = readGame();
    if (readOnly || gameId == null || playerId !== game?.localPlayerId || !isHiddenZone(game?.players[playerId]?.zones[zoneName])) {
      return;
    }
    if (offersShuffleOnClose(view) && (shuffleOnClose ?? readShuffleOnClose())) {
      webClient.request.game.shuffle(gameId, { zoneName, start: 0, end: -1 });
    }
    dispatch(games.Actions.zoneViewCleared({ gameId, playerId, zoneName }));
  }, [readOnly, gameId, readGame, webClient, dispatch]);

  const openZoneView = useCallback((view: ZoneViewTarget) => {
    const game = readGame();
    const sameZone = (v: ZoneViewTarget) => v.playerId === view.playerId && v.zoneName === view.zoneName;
    const open = zoneViews.find(sameZone);
    if (open && open.numberCards === view.numberCards && open.isReversed === view.isReversed) {
      return;
    }
    if (open) {
      sendViewClosed(open);
    }
    setZoneViews((prev) =>
      prev.some(sameZone)
        ? prev.map((v) => (sameZone(v) ? view : v))
        : [...prev, view],
    );
    const zone = game?.players[view.playerId]?.zones[view.zoneName];
    if (!readOnly && gameId != null && view.playerId === game?.localPlayerId && isHiddenZone(zone)) {
      webClient.request.game.dumpZone(gameId, {
        playerId: view.playerId,
        zoneName: view.zoneName,
        numberCards: view.numberCards ?? -1,
        isReversed: view.isReversed ?? false,
      });
    }
  }, [readOnly, zoneViews, gameId, readGame, webClient, setZoneViews, sendViewClosed]);

  const hasOrphanedView = useAppSelector((state) => {
    const game = gameId != null ? games.Selectors.getGame(state, gameId) : undefined;
    return zoneViews.some((v) => !viewHasZone(game, v));
  });
  useEffect(() => {
    if (hasOrphanedView) {
      const game = readGame();
      setZoneViews((prev) => prev.filter((v) => viewHasZone(game, v)));
    }
  }, [hasOrphanedView, readGame, setZoneViews]);

  const openOwnZoneView = useCallback((zoneName: string) => {
    const playerId = readGame()?.localPlayerId;
    if (hasSeat && playerId != null && readLocalPlayer() != null) {
      openZoneView({ playerId, zoneName });
    }
  }, [hasSeat, readGame, readLocalPlayer, openZoneView]);
  const openViewLibrary = useCallback(() => openOwnZoneView(ZoneName.DECK), [openOwnZoneView]);
  const openViewGraveyard = useCallback(() => openOwnZoneView(ZoneName.GRAVE), [openOwnZoneView]);
  const openViewSideboard = useCallback(() => openOwnZoneView(ZoneName.SIDEBOARD), [openOwnZoneView]);

  const handleCloseZoneView = useCallback((playerId: number, zoneName: string, shuffleOnClose?: boolean) => {
    const view = zoneViews.find((v) => v.playerId === playerId && v.zoneName === zoneName);
    if (!view) {
      return;
    }
    setZoneViews((prev) =>
      prev.filter((v) => !(v.playerId === playerId && v.zoneName === zoneName)),
    );
    sendViewClosed(view, shuffleOnClose);
  }, [zoneViews, setZoneViews, sendViewClosed]);

  return useMemo(
    () => ({
      openZoneView,
      openViewLibrary,
      openViewGraveyard,
      openViewSideboard,
      handleCloseZoneView,
    }),
    [
      openZoneView,
      openViewLibrary,
      openViewGraveyard,
      openViewSideboard,
      handleCloseZoneView,
    ],
  );
}
