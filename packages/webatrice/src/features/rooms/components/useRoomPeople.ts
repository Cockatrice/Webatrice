import { useCallback, useMemo, useState } from 'react';

import { rooms, server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { buildRoomPeople, DEFAULT_SECTION_OPEN, peopleRows, type PeopleRow, type PeopleSection, type RoomPeople } from './roomPeople';

export interface UseRoomPeopleResult {
  people: RoomPeople;
  rows: PeopleRow[];
  query: string;
  setQuery: (query: string) => void;
  toggle: (section: PeopleSection) => void;
}

export function useRoomPeople(roomId: number): UseRoomPeopleResult {
  const roomUsers = useAppSelector((state) => rooms.Selectors.getRoomUsers(state, roomId));
  const games = useAppSelector((state) => rooms.Selectors.getRoomGames(state, roomId));
  const buddyList = useAppSelector(server.Selectors.getBuddyList);
  const onlineUsers = useAppSelector(server.Selectors.getUsers);
  const locale = useAppSelector((state) => state.server.locale);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(DEFAULT_SECTION_OPEN);

  const people = useMemo(
    () => buildRoomPeople({ roomUsers, buddyList, onlineUsers, games, query, locale }),
    [roomUsers, buddyList, onlineUsers, games, query, locale],
  );
  const searching = query.trim() !== '';
  const rows = useMemo(() => peopleRows(people, open, searching), [people, open, searching]);
  const toggle = useCallback((section: PeopleSection) => setOpen((current) => ({ ...current, [section]: !current[section] })), []);

  return { people, rows, query, setQuery, toggle };
}
