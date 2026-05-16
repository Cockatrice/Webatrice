import { fireEvent, screen } from '@testing-library/react';
import type { Room } from '@cockatrice/datatrice';
import { makeGameInfo, makeRoom } from '@cockatrice/datatrice/testing';
import { renderWithProviders, connectedWithRoomsState, makeStoreState } from '../../../__test-utils__';
import { GameSortField, SortDirection, UserSortField } from '@cockatrice/datatrice';
import OpenGames from './OpenGames';

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => ({})) };
});

describe('OpenGames', () => {
  // ServerInfo_Room is a protobuf-es Message with a required `$typeName`
  // brand; tests skip the runtime brand and rely on the cast since OpenGames
  // only reads info.roomId / info.name etc.
  const roomWithGames = {
    info: { roomId: 1, name: 'Main Room' },
    gametypeMap: {},
    order: 0,
    games: {},
    users: {},
  } as unknown as Room;

  it('renders the games table headers', () => {
    renderWithProviders(<OpenGames room={roomWithGames} />, {
      preloadedState: connectedWithRoomsState,
    });

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Spectators')).toBeInTheDocument();
  });

  it('renders without crashing when no games exist', () => {
    const { container } = renderWithProviders(<OpenGames room={roomWithGames} />, {
      preloadedState: connectedWithRoomsState,
    });

    expect(container.querySelector('.games')).toBeInTheDocument();
  });

  it('renders formatted restrictions (password, buddies, reg., open decklists)', () => {
    const game = makeGameInfo({
      gameId: 1,
      roomId: 1,
      description: 'X',
      withPassword: true,
      onlyBuddies: true,
      onlyRegistered: true,
      shareDecklistsOnLoad: true,
      maxPlayers: 4,
      playerCount: 1,
    });
    const room = makeRoom({
      roomId: 1,
      name: 'Main',
      games: { 1: { info: game, gameType: '' } },
    }) as unknown as Room;
    renderWithProviders(<OpenGames room={room} />, {
      preloadedState: makeStoreState({
        ...connectedWithRoomsState,
        rooms: {
          rooms: { 1: room as any },
          joinedRoomIds: { 1: true },
          joinedGameIds: {},
          messages: { 1: [] },
          sortGamesBy: { field: GameSortField.START_TIME, order: SortDirection.DESC },
          sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
          selectedGameIds: {},
          gameFilters: {},
          joinGamePending: false,
          joinGameError: null,
        } as any,
      }),
    });
    expect(screen.getByText('password, buddies only, reg. users only, open decklists')).toBeInTheDocument();
  });

  it('renders spectator count with chat & see-hands flags', () => {
    const game = makeGameInfo({
      gameId: 1,
      roomId: 1,
      description: 'X',
      spectatorsAllowed: true,
      spectatorsCanChat: true,
      spectatorsOmniscient: true,
      spectatorsCount: 3,
      maxPlayers: 4,
      playerCount: 1,
    });
    const room = makeRoom({
      roomId: 1,
      name: 'Main',
      games: { 1: { info: game, gameType: '' } },
    }) as unknown as Room;
    renderWithProviders(<OpenGames room={room} />, {
      preloadedState: makeStoreState({
        ...connectedWithRoomsState,
        rooms: {
          rooms: { 1: room as any },
          joinedRoomIds: { 1: true },
          joinedGameIds: {},
          messages: { 1: [] },
          sortGamesBy: { field: GameSortField.START_TIME, order: SortDirection.DESC },
          sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
          selectedGameIds: {},
          gameFilters: {},
          joinGamePending: false,
          joinGameError: null,
        } as any,
      }),
    });
    expect(screen.getByText('3 (can chat & see hands)')).toBeInTheDocument();
  });

  it('renders "not allowed" when spectators are disabled', () => {
    const game = makeGameInfo({
      gameId: 1,
      roomId: 1,
      description: 'X',
      spectatorsAllowed: false,
      maxPlayers: 4,
      playerCount: 1,
    });
    const room = makeRoom({
      roomId: 1,
      name: 'Main',
      games: { 1: { info: game, gameType: '' } },
    }) as unknown as Room;
    renderWithProviders(<OpenGames room={room} />, {
      preloadedState: makeStoreState({
        ...connectedWithRoomsState,
        rooms: {
          rooms: { 1: room as any },
          joinedRoomIds: { 1: true },
          joinedGameIds: {},
          messages: { 1: [] },
          sortGamesBy: { field: GameSortField.START_TIME, order: SortDirection.DESC },
          sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
          selectedGameIds: {},
          gameFilters: {},
          joinGamePending: false,
          joinGameError: null,
        } as any,
      }),
    });
    expect(screen.getByText('not allowed')).toBeInTheDocument();
  });

  it('double-clicking a row invokes onActivateGame with the game id', () => {
    const onActivateGame = vi.fn();
    const game = makeGameInfo({
      gameId: 7,
      roomId: 1,
      description: 'Row',
      maxPlayers: 4,
      playerCount: 1,
    });
    const room = makeRoom({
      roomId: 1,
      name: 'Main',
      games: { 7: { info: game, gameType: '' } },
    }) as unknown as Room;
    renderWithProviders(<OpenGames room={room} onActivateGame={onActivateGame} />, {
      preloadedState: makeStoreState({
        ...connectedWithRoomsState,
        rooms: {
          rooms: { 1: room as any },
          joinedRoomIds: { 1: true },
          joinedGameIds: {},
          messages: { 1: [] },
          sortGamesBy: { field: GameSortField.START_TIME, order: SortDirection.DESC },
          sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
          selectedGameIds: {},
          gameFilters: {},
          joinGamePending: false,
          joinGameError: null,
        } as any,
      }),
    });
    fireEvent.doubleClick(screen.getByText('Row'));
    expect(onActivateGame).toHaveBeenCalledWith(7);
  });

  it('clicking the Age sort header dispatches sortGames', () => {
    const game = makeGameInfo({ gameId: 1, roomId: 1, description: 'X', maxPlayers: 4, playerCount: 1 });
    const room = makeRoom({
      roomId: 1,
      name: 'Main',
      games: { 1: { info: game, gameType: '' } },
    }) as unknown as Room;
    const { store } = renderWithProviders(<OpenGames room={room} />, {
      preloadedState: makeStoreState({
        ...connectedWithRoomsState,
        rooms: {
          rooms: { 1: room as any },
          joinedRoomIds: { 1: true },
          joinedGameIds: {},
          messages: { 1: [] },
          sortGamesBy: { field: GameSortField.START_TIME, order: SortDirection.DESC },
          sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
          selectedGameIds: {},
          gameFilters: {},
          joinGamePending: false,
          joinGameError: null,
        } as any,
      }),
    });
    fireEvent.click(screen.getByText('Age'));
    const next = store.getState() as any;
    expect(next.rooms.sortGamesBy.order).toBe(SortDirection.ASC);
  });
});
