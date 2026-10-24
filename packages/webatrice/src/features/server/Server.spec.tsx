import { vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';

import { rooms } from '@cockatrice/datatrice';
import { getExpandedChats } from '@app/hooks';
import { makeGame, makeUser } from '@cockatrice/datatrice/testing';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';

import {
  renderWithProviders,
  createMockWebClient,
  connectedState,
  connectedWithRoomsState,
} from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import Server from './Server';

beforeEach(() => {
  hoisted.mockWebClient = createMockWebClient();
});

const withBuddyGame = () => {
  const base = connectedWithRoomsState as any;
  const buddy = makeUser({ name: 'otherUser' });
  return {
    ...base,
    server: { ...base.server, buddyList: { otherUser: buddy } },
    rooms: {
      ...base.rooms,
      rooms: {
        1: {
          ...base.rooms.rooms[1],
          info: create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main Room', autoJoin: true, gameCount: 1, playerCount: 2 }),
          games: {
            9: makeGame({
              gameId: 9, roomId: 1, description: 'Buddy game', playerCount: 1, maxPlayers: 2, spectatorsAllowed: true,
              creatorInfo: buddy,
            }),
          },
        },
      },
    },
  };
};

const withOpenGames = () => {
  const base = connectedWithRoomsState as any;
  const stranger = makeUser({ name: 'stranger' });
  const game = (gameId: number, extra: Record<string, unknown> = {}) => makeGame({
    gameId, roomId: 1, description: `Open ${gameId}`, playerCount: 1, maxPlayers: 2, creatorInfo: stranger, ...extra,
  });
  return {
    ...base,
    rooms: {
      ...base.rooms,
      rooms: {
        1: {
          ...base.rooms.rooms[1],
          info: create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main Room', autoJoin: true, gameCount: 3, playerCount: 4 }),
          games: {
            11: game(11),
            12: game(12, { withPassword: true }),
            13: game(13, { started: true }),
          },
        },
      },
    },
  };
};

function LocationProbe({ name }: { name: string }) {
  const location = useLocation();
  return <div>{`${name}:${JSON.stringify(location.state)}`}</div>;
}

function RoomStateProbe() {
  const location = useLocation();
  return <div>{`create:${String((location.state as { createGame?: boolean } | null)?.createGame)}`}</div>;
}

function renderHome(preloadedState: any) {
  return renderWithProviders(
    <Routes>
      <Route path="/server" element={<Server />} />
      <Route path="/room/:roomId" element={<div>room-page</div>} />
      <Route path="/player/:name" element={<div>player-page</div>} />
      <Route path="/people" element={<div>people-page</div>} />
      <Route path="/decks" element={<LocationProbe name="decks-page" />} />
    </Routes>,
    { preloadedState, route: '/server' },
  );
}

describe('Server (Home)', () => {
  it('greets the user and lists the rooms with their counts', () => {
    renderHome(connectedWithRoomsState);
    expect(screen.getByRole('heading', { name: 'HomeHero.welcome' })).toBeInTheDocument();
    const roomsPanel = screen.getByRole('heading', { name: 'RoomsList.title' }).closest('section') as HTMLElement;
    expect(within(roomsPanel).getByText('Main Room')).toBeInTheDocument();
    expect(within(roomsPanel).getByText('RoomsList.joined')).toBeInTheDocument();
  });

  it('renders the sanitized server message html', () => {
    renderHome(connectedState);
    expect(screen.getByText('Welcome').tagName).toBe('B');
  });

  it('renders without rooms', () => {
    renderHome(connectedState);
    expect(screen.getByText('RoomsList.empty')).toBeInTheDocument();
    expect(screen.getByText('HomeHero.noRooms')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'HomeHero.play' })).not.toBeInTheDocument();
  });

  it('Play opens the usual room when it is joined', () => {
    renderHome(connectedWithRoomsState);
    fireEvent.click(screen.getByRole('button', { name: 'HomeHero.play' }));
    expect(screen.getByText('room-page')).toBeInTheDocument();
    expect(hoisted.mockWebClient.request.session.joinRoom).not.toHaveBeenCalled();
  });

  it('Play joins the usual room when it is not joined yet', () => {
    const base = connectedWithRoomsState as any;
    renderHome({ ...base, rooms: { ...base.rooms, joinedRoomIds: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'HomeHero.play' }));
    expect(hoisted.mockWebClient.request.session.joinRoom).toHaveBeenCalledWith(1);
  });

  it('Create game opens the usual room with its create dialog requested', () => {
    renderWithProviders(
      <Routes>
        <Route path="/server" element={<Server />} />
        <Route path="/room/:roomId" element={<RoomStateProbe />} />
      </Routes>,
      { preloadedState: connectedWithRoomsState, route: '/server' },
    );
    fireEvent.click(screen.getByRole('button', { name: 'HomeHero.createGame' }));
    expect(screen.getByText('create:true')).toBeInTheDocument();
  });

  it('offers Create game only once the usual room is joined', () => {
    const base = connectedWithRoomsState as any;
    renderHome({ ...base, rooms: { ...base.rooms, joinedRoomIds: {} } });
    expect(screen.queryByRole('button', { name: 'HomeHero.createGame' })).not.toBeInTheDocument();
  });

  it('shows a game a buddy hosts and joins it through the room', () => {
    renderHome(withBuddyGame());
    const card = screen.getByRole('article', { name: 'Buddy game' });
    fireEvent.click(within(card).getByRole('button', { name: 'GameCard.joinLabel' }));
    expect(hoisted.mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ gameId: 9, spectator: false }),
      expect.anything(),
    );
  });

  it('lists online buddies with what they host and opens a chat from Message', () => {
    renderHome(withBuddyGame());
    const buddies = screen.getByRole('heading', { name: 'BuddiesOnline.title' }).closest('section') as HTMLElement;
    expect(within(buddies).getByText('BuddiesOnline.hosting')).toBeInTheDocument();
    fireEvent.click(within(buddies).getByRole('button', { name: 'BuddiesOnline.message' }));
    expect(getExpandedChats()).toContain('otherUser');
  });

  it('explains buddies once, on the left, when there are none', () => {
    renderHome(connectedWithRoomsState);
    expect(screen.getByText('BuddyGames.emptyNoBuddies')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'BuddiesOnline.title' })).not.toBeInTheDocument();
  });

  it('sends a user without buddies to the People page', () => {
    renderHome(connectedWithRoomsState);
    const section = screen.getByRole('heading', { name: 'BuddyGames.title' }).closest('section') as HTMLElement;
    fireEvent.click(within(section).getByRole('button', { name: 'BuddyGames.findPeople' }));
    expect(screen.getByText('people-page')).toBeInTheDocument();
  });

  it('points at the People page when no buddy is online', () => {
    const base = withBuddyGame();
    renderHome({ ...base, server: { ...base.server, users: { testUser: makeUser() } } });
    const panel = screen.getByRole('heading', { name: 'BuddiesOnline.title' }).closest('section') as HTMLElement;
    expect(within(panel).getByText('BuddiesOnline.empty')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'BuddiesOnline.allBuddies' }));
    expect(screen.getByText('people-page')).toBeInTheDocument();
  });

  it('offers a new deck or an import when there are no recent decks', () => {
    renderHome(connectedWithRoomsState);
    const section = screen.getByRole('heading', { name: 'RecentDecks.title' }).closest('section') as HTMLElement;
    expect(within(section).getByText('RecentDecks.empty')).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: 'RecentDecks.importDeck' }));
    expect(screen.getByText('decks-page:{"open":"migrate"}')).toBeInTheDocument();
  });

  it('previews the joinable open games of the usual room and joins one', () => {
    renderHome(withOpenGames());
    const section = screen.getByRole('heading', { name: 'OpenGames.title' }).closest('section') as HTMLElement;
    expect(within(section).queryByRole('article', { name: 'Open 12' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('article', { name: 'Open 13' })).not.toBeInTheDocument();
    const card = within(section).getByRole('article', { name: 'Open 11' });
    fireEvent.click(within(card).getByRole('button', { name: 'GameCard.joinLabel' }));
    expect(hoisted.mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ gameId: 11, spectator: false }),
      expect.anything(),
    );
  });

  it('offers Create game when the usual room has no open seats', () => {
    renderHome(connectedWithRoomsState);
    const section = screen.getByRole('heading', { name: 'OpenGames.title' }).closest('section') as HTMLElement;
    expect(within(section).getByText('OpenGames.empty')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'OpenGames.createGame' })).toBeInTheDocument();
  });

  it('leaves the open games preview out until the usual room is joined', () => {
    const base = connectedWithRoomsState as any;
    renderHome({ ...base, rooms: { ...base.rooms, joinedRoomIds: {} } });
    expect(screen.queryByRole('heading', { name: 'OpenGames.title' })).not.toBeInTheDocument();
  });

  describe('when a room join lands', () => {
    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 2, name: 'Side Room' });

    it('opens the room the user asked to join', () => {
      const { store } = renderHome(connectedWithRoomsState);
      act(() => {
        store.dispatch(rooms.Actions.joinRoom({ roomInfo, userInitiated: true }));
      });
      expect(screen.getByText('room-page')).toBeInTheDocument();
    });

    it('stays on Home for a server auto-join, as desktop does (setCurrent = false)', () => {
      const { store } = renderHome(connectedWithRoomsState);
      act(() => {
        store.dispatch(rooms.Actions.joinRoom({ roomInfo, userInitiated: false }));
      });
      expect(screen.queryByText('room-page')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'HomeHero.welcome' })).toBeInTheDocument();
    });
  });
});
