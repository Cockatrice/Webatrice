import { useCallback } from 'react';
import { createSelector } from '@reduxjs/toolkit';
import { rooms, type Game, type GameSortField, type SortDirection } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';

export interface OpenGames {
  sortBy: { field: string; order: string };
  games: Game[];
  gameKeys: string[];
  selectedGameId: number | undefined;
  setSort: (field: string, order: SortDirection) => void;
  handleSelect: (gameId: number) => void;
  handleActivate: (gameId: number) => void;
}

const selectGameKeys = createSelector(
  [(state: Parameters<typeof rooms.Selectors.getFilteredRoomGames>[0], roomId: number) =>
    rooms.Selectors.getFilteredRoomGames(state, roomId)],
  (games) => games.map((game) => String(game.info.gameId)),
  {
    memoizeOptions: {
      resultEqualityCheck: (a: string[], b: string[]) =>
        a.length === b.length && a.every((key, index) => key === b[index]),
    },
  },
);

export interface UseOpenGamesArgs {
  roomId: number;
  onActivateGame?: (gameId: number) => void;
}

export function useOpenGames({ roomId, onActivateGame }: UseOpenGamesArgs): OpenGames {
  const dispatch = useAppDispatch();
  const sortBy = useAppSelector((state) => rooms.Selectors.getSortGamesBy(state));
  const games = useAppSelector((state) => rooms.Selectors.getFilteredRoomGames(state, roomId));
  const gameKeys = useAppSelector((state) => selectGameKeys(state, roomId));
  const selectedGameId = useAppSelector((state) => rooms.Selectors.getSelectedGameId(state, roomId));

  const setSort = useCallback((field: string, order: SortDirection) => {
    dispatch(rooms.Actions.sortGames({ roomId, field: field as GameSortField, order }));
  }, [dispatch, roomId]);

  const handleSelect = useCallback((gameId: number) => {
    dispatch(rooms.Actions.selectGame({ roomId, gameId }));
  }, [dispatch, roomId]);

  const handleActivate = useCallback((gameId: number) => {
    dispatch(rooms.Actions.selectGame({ roomId, gameId }));
    onActivateGame?.(gameId);
  }, [dispatch, roomId, onActivateGame]);

  return { sortBy, games, gameKeys, selectedGameId, setSort, handleSelect, handleActivate };
}
