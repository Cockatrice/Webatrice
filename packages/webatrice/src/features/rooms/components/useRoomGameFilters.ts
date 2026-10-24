import { useCallback } from 'react';

import { rooms, type GameFilters } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';

export interface RoomGameFilters {
  filters: GameFilters;
  isActive: boolean;
  counts: { visible: number; total: number };
  update: (patch: Partial<GameFilters>) => void;
  clear: () => void;
}

export function useRoomGameFilters(roomId: number): RoomGameFilters {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => rooms.Selectors.getGameFilters(state, roomId));
  const isActive = useAppSelector((state) => rooms.Selectors.isGameFilterActive(state, roomId));
  const counts = useAppSelector((state) => rooms.Selectors.getRoomGameCounts(state, roomId));

  const update = useCallback((patch: Partial<GameFilters>) => {
    dispatch(rooms.Actions.setGameFilters({ roomId, filters: { ...filters, ...patch } }));
  }, [dispatch, filters, roomId]);

  const clear = useCallback(() => {
    dispatch(rooms.Actions.clearGameFilters({ roomId }));
  }, [dispatch, roomId]);

  return { filters, isActive, counts, update, clear };
}
