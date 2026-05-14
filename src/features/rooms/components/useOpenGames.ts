import { rooms, SortUtil } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';
import { Game, GameSortField } from '@cockatrice/datatrice';
export interface OpenGames {
  sortBy: { field: string; order: string };
  games: Game[];
  selectedGameId: number | undefined;
  handleSort: (sortByField: string) => void;
  handleSelect: (gameId: number) => void;
  handleActivate: (gameId: number) => void;
}

export interface UseOpenGamesArgs {
  roomId: number;
  onActivateGame?: (gameId: number) => void;
}

export function useOpenGames({ roomId, onActivateGame }: UseOpenGamesArgs): OpenGames {
  const dispatch = useAppDispatch();
  const sortBy = useAppSelector((state) => rooms.Selectors.getSortGamesBy(state));
  const games = useAppSelector((state) => rooms.Selectors.getFilteredRoomGames(state, roomId));
  const selectedGameId = useAppSelector((state) => rooms.Selectors.getSelectedGameId(state, roomId));

  const handleSort = (sortByField: string) => {
    const { field, order } = SortUtil.toggleSortBy(sortByField as GameSortField, sortBy);
    dispatch(rooms.Actions.sortGames({ roomId, field, order }));
  };

  const handleSelect = (gameId: number) => {
    dispatch(rooms.Actions.selectGame({ roomId, gameId }));
  };

  const handleActivate = (gameId: number) => {
    dispatch(rooms.Actions.selectGame({ roomId, gameId }));
    onActivateGame?.(gameId);
  };

  return { sortBy, games, selectedGameId, handleSort, handleSelect, handleActivate };
}
