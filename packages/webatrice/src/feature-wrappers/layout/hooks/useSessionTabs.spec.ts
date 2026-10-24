import type { Tab } from '../topBarTabs';
import { makeGameEntry, makeGameInfo } from '@cockatrice/datatrice/testing';
import { connectedWithRoomsState, makeUser } from '../../../__test-utils__';
import { selectSessionGameTabs, selectSessionRoomTabs, titleTabFor } from './useSessionTabs';

const lobby: Tab = { key: 'server', type: 'server', title: 'Lobby', route: '/server', closeable: false };
const room: Tab = { key: 'room:1', type: 'room', title: 'Magic', route: '/room/1', closeable: true };

describe('titleTabFor', () => {
  it('uses the open tab for the current route', () => {
    expect(titleTabFor([lobby, room], '/room/1')).toBe(room);
  });

  it('derives the page from the route when the strip has no tab for it', () => {
    expect(titleTabFor([lobby], '/decks')).toEqual(expect.objectContaining({ key: 'decks', titleKey: 'TopBar.tab.myDecks' }));
    expect(titleTabFor([lobby], '/replays')).toEqual(expect.objectContaining({ key: 'replays' }));
  });

  it('falls back to the Lobby for a route without a page of its own', () => {
    expect(titleTabFor([lobby], '/game/9')).toBe(lobby);
  });
});

describe('session tab selectors', () => {
  it('keeps room tabs stable when room state changes outside the tab label', () => {
    const initial = { rooms: connectedWithRoomsState.rooms! };
    const room = initial.rooms.rooms[1];
    const first = selectSessionRoomTabs(initial);
    const changed = {
      ...initial,
      rooms: {
        ...initial.rooms,
        rooms: {
          ...initial.rooms.rooms,
          1: { ...room, users: { ...room.users, newcomer: makeUser({ name: 'newcomer' }) } },
        },
      },
    };

    expect(selectSessionRoomTabs(changed)).toBe(first);
  });

  it('keeps game tabs stable when active game state changes outside the tab fields', () => {
    const game = makeGameEntry({
      info: makeGameInfo({ gameId: 7, description: 'Draft' }),
      spectator: true,
      replay: false,
    });
    const initial = {
      games: { games: { 7: game }, pings: {} },
    };
    const first = selectSessionGameTabs(initial);
    const changed = {
      ...initial,
      games: {
        ...initial.games,
        games: {
          7: { ...game, secondsElapsed: game.secondsElapsed + 1 },
        },
      },
    };

    expect(selectSessionGameTabs(changed)).toBe(first);
  });

  it('updates a tab when a displayed field changes', () => {
    const initial = { rooms: connectedWithRoomsState.rooms! };
    const first = selectSessionRoomTabs(initial);
    const changed = {
      ...initial,
      rooms: {
        ...initial.rooms,
        rooms: {
          ...initial.rooms.rooms,
          1: {
            ...initial.rooms.rooms[1],
            info: { ...initial.rooms.rooms[1].info, name: 'Renamed Room' },
          },
        },
      },
    };

    expect(selectSessionRoomTabs(changed)).not.toBe(first);
    expect(selectSessionRoomTabs(changed)).toEqual([{ roomId: 1, name: 'Renamed Room' }]);
  });
});
