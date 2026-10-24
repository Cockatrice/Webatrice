import { useCallback, useEffect, useMemo } from 'react';
import { createSelector } from '@reduxjs/toolkit';
import { generatePath, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { games, rooms } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useAppSelector } from '@app/store';
import { useDocumentTitle, useLeaveGame, useOpenedReplays, useUnreadCounts } from '@app/hooks';
import { closeReplay } from '@app/services';
import { RouteEnum, type DeckRouteState } from '@app/types';

import {
  addStickyTab, detectTransientTab, isPlaceTab, isStickyTabType, routeMatches, stripGroups, tabTitle, tabUnread,
  withDeckNames, type StripGroup, type Tab,
} from '../topBarTabs';
import { useBackendDeckNames } from './useBackendDeckNames';
import { useIdentityChange } from './useIdentityChange';
import { usePersistLastRoute } from './usePersistLastRoute';
import { useStickyTabs } from './useStickyTabs';

export interface SessionRoomTab {
  roomId: number;
  name: string;
}

export interface SessionGameTab {
  gameId: number;
  description: string;
  spectator: boolean;
}

function roomTabsEqual(a: SessionRoomTab[], b: SessionRoomTab[]): boolean {
  return a.length === b.length
    && a.every((room, index) => room.roomId === b[index].roomId && room.name === b[index].name);
}

function gameTabsEqual(a: SessionGameTab[], b: SessionGameTab[]): boolean {
  return a.length === b.length
    && a.every((game, index) => game.gameId === b[index].gameId
      && game.description === b[index].description
      && game.spectator === b[index].spectator);
}

export const selectSessionRoomTabs = createSelector(
  [rooms.Selectors.getJoinedRooms],
  (joinedRooms): SessionRoomTab[] => joinedRooms.map(({ info }) => ({
    roomId: info.roomId,
    name: info.name,
  })),
  { memoizeOptions: { resultEqualityCheck: roomTabsEqual } },
);

export const selectSessionGameTabs = createSelector(
  [games.Selectors.getActiveGames],
  (activeGames): SessionGameTab[] => activeGames.map(({ info, spectator }) => ({
    gameId: info.gameId,
    description: info.description,
    spectator,
  })),
  { memoizeOptions: { resultEqualityCheck: gameTabsEqual } },
);

export interface SessionTabs {
  groups: StripGroup[];
  activeKey: string;
  close: (tab: Tab) => void;
  unreadOf: (tab: Tab) => number;
}

export function titleTabFor(tabs: readonly Tab[], pathname: string): Tab | null {
  return tabs.find((tab) => routeMatches(pathname, tab.route))
    ?? detectTransientTab(pathname)
    ?? tabs.find((tab) => tab.key === 'server')
    ?? null;
}

export function useSessionTabs(): SessionTabs {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const webClient = useWebClient();
  const leaveGameRequest = useLeaveGame();
  const unreadCounts = useUnreadCounts();
  const roomTabs = useAppSelector(selectSessionRoomTabs);
  const gameTabs = useAppSelector(selectSessionGameTabs);
  const openedReplays = useOpenedReplays();

  const [stickyTabs, setStickyTabs] = useStickyTabs();
  useEffect(() => {
    const transient = detectTransientTab(location.pathname);
    if (!transient || !isStickyTabType(transient.type) || isPlaceTab(transient)) {
      return;
    }
    const replacesDeckId = transient.type === 'deck'
      ? (location.state as DeckRouteState | null)?.replacesDeckId
      : undefined;
    setStickyTabs((prev) => addStickyTab(prev, transient, replacesDeckId));
  }, [location.pathname, location.state, setStickyTabs]);

  usePersistLastRoute();
  const deckIdToName = useBackendDeckNames();

  useIdentityChange(() => {
    setStickyTabs((prev) => prev.filter((tab) => tab.type !== 'deck' && tab.type !== 'decks'));
    if (location.pathname.startsWith('/deck/') || location.pathname === RouteEnum.DECKS) {
      navigate(generatePath(RouteEnum.SERVER));
    }
  });

  useEffect(() => {
    if (deckIdToName.size === 0) {
      return;
    }
    setStickyTabs((prev) => withDeckNames(prev, deckIdToName));
  }, [deckIdToName, setStickyTabs]);

  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [
      {
        key: 'server',
        type: 'server',
        title: t('TopBar.tab.lobby'),
        route: generatePath(RouteEnum.SERVER),
        closeable: false,
      },
    ];

    for (const room of roomTabs) {
      const roomId = room.roomId;
      list.push({
        key: `room:${roomId}`,
        type: 'room',
        title: room.name || t('TopBar.tab.room', { id: String(roomId) }),
        route: generatePath(RouteEnum.ROOM, { roomId: roomId.toString() }),
        closeable: true,
        onClose: () => {
          webClient.request.rooms.leaveRoom(roomId);
        },
      });
    }

    for (const game of gameTabs) {
      const gameId = game.gameId;
      list.push({
        key: `game:${gameId}`,
        type: 'game',
        title: game.description || t('TopBar.tab.game', { id: String(gameId) }),
        route: generatePath(RouteEnum.GAME, { gameId: gameId.toString() }),
        closeable: true,
        spectating: game.spectator,
        onClose: () => leaveGameRequest(gameId),
      });
    }

    for (const replay of openedReplays) {
      list.push({
        key: `replay:${replay.key}`,
        type: 'replay',
        title: replay.title,
        route: generatePath(RouteEnum.REPLAY, { replayKey: replay.key }),
        closeable: true,
        onClose: () => closeReplay(replay.key),
      });
    }

    list.push(...withDeckNames(stickyTabs, deckIdToName));

    const transient = detectTransientTab(location.pathname);
    if (
      transient
      && transient.type !== 'decks'
      && transient.type !== 'deck'
      && !list.some((tab) => tab.key === transient.key)
    ) {
      list.push(transient);
    }

    return list;
  }, [roomTabs, gameTabs, openedReplays, location.pathname, webClient, leaveGameRequest, stickyTabs, deckIdToName, t]);

  const activeKey = useMemo(
    () => tabs.find((tab) => routeMatches(location.pathname, tab.route))?.key ?? 'server',
    [tabs, location.pathname],
  );
  const titleTab = titleTabFor(tabs, location.pathname);
  useDocumentTitle(titleTab ? tabTitle(titleTab, t) : null);

  const close = useCallback((tab: Tab) => {
    tab.onClose?.();
    if (isStickyTabType(tab.type)) {
      setStickyTabs((prev) => prev.filter((other) => other.key !== tab.key));
    }
    if (activeKey === tab.key) {
      navigate(generatePath(RouteEnum.SERVER));
    }
  }, [activeKey, navigate, setStickyTabs]);

  const groups = useMemo(() => stripGroups(tabs), [tabs]);
  const unreadOf = useCallback((tab: Tab) => tabUnread(tab, unreadCounts), [unreadCounts]);

  return { groups, activeKey, close, unreadOf };
}
