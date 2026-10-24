import { useCallback, useRef, useState } from 'react';
import type { ListImperativeAPI } from 'react-window';

import { games as gamesSlice, server, rooms, type Game, type Room } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import type { MenuAnchor } from '@app/components';
import {
  useCanOverrideGameRestrictions,
  useGridRows,
  useJoinGame,
  useJoinGameErrorMessage,
  useNavigateOnGameJoined,
} from '@app/hooks';

import type { RowAction } from './GameRow';
import { rowJoinState, type RowJoinState } from './gameRowModel';
import { currentSortOption, SORT_OPTIONS, type SortOptionId } from './quickFilters';
import { useOpenGames } from './useOpenGames';

export interface RoomGamesMoreMenu {
  game: Game;
  state: RowJoinState;
  anchor: MenuAnchor;
  button: HTMLElement;
}

export interface RoomGamesPassword {
  gameId: number;
  description: string;
  action: RowAction;
}

export function useRoomGames(room: Room) {
  const roomId = room.info.roomId;
  const overrideRestrictions = useCanOverrideGameRestrictions();
  const join = useJoinGame();
  const { beginJoin, passwordRequired, passwordGame, joinPending, joinError } = join;
  const joinErrorMessage = useJoinGameErrorMessage(joinError);
  useNavigateOnGameJoined();

  const roomGames = useAppSelector((state) => rooms.Selectors.getRoomGames(state, roomId));
  const roomGamesRef = useRef(roomGames);
  roomGamesRef.current = roomGames;
  const activeGameIds = useAppSelector(gamesSlice.Selectors.getActiveGameIds);
  const isJudgeUser = useAppSelector(server.Selectors.getIsUserJudge);

  const [trigger, setTrigger] = useState<{ gameId: number; action: RowAction } | null>(null);
  const [more, setMore] = useState<{ gameId: number; anchor: MenuAnchor; button: HTMLElement } | null>(null);
  const [infoGameId, setInfoGameId] = useState<number | null>(null);

  const startJoin = useCallback((gameId: number, action: RowAction, asJudge = false) => {
    const game = roomGamesRef.current[gameId];
    if (!game) {
      return;
    }
    setTrigger({ gameId, action });
    beginJoin(roomId, game.info, action === 'spectate', asJudge);
  }, [beginJoin, roomId]);

  const activateGame = useCallback((gameId: number) => startJoin(gameId, 'join'), [startJoin]);
  const { sortBy, games: gameList, gameKeys: keys, selectedGameId, setSort, handleSelect, handleActivate } =
    useOpenGames({ roomId, onActivateGame: activateGame });

  const sort = currentSortOption(sortBy);
  const sortDescending = sortBy.order.toUpperCase() === 'DESC';
  const onSort = useCallback((id: SortOptionId) => {
    const option = SORT_OPTIONS.find((candidate) => candidate.id === id);
    if (option) {
      setSort(option.field, option.order);
    }
  }, [setSort]);

  const listRef = useRef<ListImperativeAPI>(null);
  const selectRow = useCallback((key: string) => {
    handleSelect(Number(key));
    listRef.current?.scrollToRow({ index: keys.indexOf(key), align: 'smart' });
  }, [handleSelect, keys]);
  const activateRow = useCallback((key: string) => handleActivate(Number(key)), [handleActivate]);
  const { getRowProps, onRowsRendered } = useGridRows({
    keys,
    selectedKey: selectedGameId != null ? String(selectedGameId) : null,
    onSelect: selectRow,
    onActivate: activateRow,
  });

  const onAction = useCallback((gameId: number, action: RowAction) => {
    handleSelect(gameId);
    startJoin(gameId, action);
  }, [handleSelect, startJoin]);

  const onMore = useCallback((gameId: number, button: HTMLElement) => {
    handleSelect(gameId);
    setMore({ gameId, button, anchor: { rect: button.getBoundingClientRect(), placement: 'below', align: 'end' } });
  }, [handleSelect]);

  const menuGame = more ? roomGames[more.gameId] : undefined;
  const menuState = menuGame ? rowJoinState(menuGame.info, {
    override: overrideRestrictions,
    pending: joinPending,
    alreadyJoined: activeGameIds.includes(menuGame.info.gameId),
  }) : undefined;
  const moreMenu: RoomGamesMoreMenu | null = more && menuGame && menuState
    ? { game: menuGame, state: menuState, anchor: more.anchor, button: more.button }
    : null;

  const judge = useCallback((gameId: number, action: RowAction) => startJoin(gameId, action, true), [startJoin]);
  const closeMore = useCallback(() => setMore(null), []);
  const closeInfo = useCallback(() => setInfoGameId(null), []);

  const password: RoomGamesPassword | null = passwordRequired && passwordGame
    ? {
      gameId: passwordGame.gameId,
      description: passwordGame.description,
      action: trigger?.gameId === passwordGame.gameId ? trigger.action : 'join',
    }
    : null;

  return {
    gameList,
    selectedGameId,
    sort,
    sortDescending,
    onSort,
    listRef,
    getRowProps,
    onRowsRendered,
    handleSelect,
    handleActivate,
    onAction,
    onMore,
    moreMenu,
    closeMore,
    judge,
    isJudgeUser,
    infoGame: infoGameId != null ? roomGames[infoGameId] ?? null : null,
    openInfo: setInfoGameId,
    closeInfo,
    password,
    submitPassword: join.submitPassword,
    cancelPassword: join.cancelPassword,
    spectatorConfirmationRequired: join.spectatorConfirmationRequired,
    confirmSpectatorJoin: join.confirmSpectatorJoin,
    cancelSpectatorJoin: join.cancelSpectatorJoin,
    joinError,
    joinErrorMessage,
    clearJoinError: join.clearJoinError,
  };
}
