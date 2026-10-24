import { act, screen } from '@testing-library/react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';

import { rooms, server } from '@cockatrice/datatrice';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { renderWithProviders, createMockWebClient, connectedWithRoomsState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import { STARTUP_ROOM_TIMEOUT_MS, useStartupRoom } from './useStartupRoom';

const sideRoom = create(ServerInfo_RoomSchema, { roomId: 2, name: 'Side Room', autoJoin: false });
const autoRoom = create(ServerInfo_RoomSchema, { roomId: 3, name: 'Auto Room', autoJoin: true });

const lobbyState = {
  ...connectedWithRoomsState,
  rooms: {
    ...connectedWithRoomsState.rooms,
    rooms: {
      ...connectedWithRoomsState.rooms!.rooms,
      2: { info: sideRoom, gametypeMap: {}, order: 2, games: {}, users: {} },
      3: { info: autoRoom, gametypeMap: {}, order: 3, games: {}, users: {} },
    },
  },
} as typeof connectedWithRoomsState;

function Lobby() {
  useStartupRoom();
  const location = useLocation();
  return <div>{`lobby ${JSON.stringify(location.state)}`}</div>;
}

function renderLobby(startupRoom: string, preloadedState = lobbyState) {
  return renderWithProviders(
    <Routes>
      <Route path="/start" element={<Navigate to="/server" state={{ startupRoom }} />} />
      <Route path="/server" element={<Lobby />} />
      <Route path="/room/:roomId" element={<div>room-page</div>} />
    </Routes>,
    { preloadedState, route: '/start' },
  );
}

describe('useStartupRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockWebClient = createMockWebClient();
  });

  it('opens a room that is already joined', () => {
    renderLobby('Main Room');

    expect(screen.getByText('room-page')).toBeInTheDocument();
    expect(hoisted.mockWebClient.request.session.joinRoom).not.toHaveBeenCalled();
  });

  it('joins the room once, and the lobby opens it when the join lands', () => {
    renderLobby('Side Room');

    expect(hoisted.mockWebClient.request.session.joinRoom).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWebClient.request.session.joinRoom).toHaveBeenCalledWith(2);
    expect(screen.getByText('lobby {"startupRoom":"Side Room"}')).toBeInTheDocument();
  });

  it('waits for the server to auto-join an auto-join room instead of joining it again', () => {
    const { store } = renderLobby('Auto Room');
    expect(hoisted.mockWebClient.request.session.joinRoom).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(rooms.Actions.joinRoom({ roomInfo: autoRoom, userInitiated: false }));
    });

    expect(screen.getByText('room-page')).toBeInTheDocument();
  });

  it('matches the name exactly, as desktop does', () => {
    renderLobby('main room');

    expect(hoisted.mockWebClient.request.session.joinRoom).not.toHaveBeenCalled();
    expect(screen.getByText('lobby null')).toBeInTheDocument();
  });

  it('stays in the lobby when the join is refused', () => {
    const { store } = renderLobby('Side Room');

    act(() => {
      store.dispatch(rooms.Actions.joinRoomFailed({ roomId: 2, responseCode: 0, userInitiated: true }));
    });

    expect(screen.getByText('lobby null')).toBeInTheDocument();
  });

  it('waits for the room list', () => {
    renderLobby('Side Room', { ...lobbyState, rooms: { ...lobbyState.rooms!, rooms: {}, joinedRoomIds: {} } });

    expect(screen.getByText('lobby {"startupRoom":"Side Room"}')).toBeInTheDocument();
    expect(hoisted.mockWebClient.request.session.joinRoom).not.toHaveBeenCalled();
  });

  describe('startup room timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('gives up on an unresolved room lookup after 20 seconds', () => {
      renderLobby('Auto Room', { ...lobbyState, rooms: { ...lobbyState.rooms!, rooms: {}, joinedRoomIds: {} } });
      act(() => {
        vi.advanceTimersByTime(STARTUP_ROOM_TIMEOUT_MS - 1);
      });
      expect(screen.getByText('lobby {"startupRoom":"Auto Room"}')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByText('lobby null')).toBeInTheDocument();
    });

    it.each([
      ['Auto Room', autoRoom, false],
      ['Side Room', sideRoom, true],
    ])('selects %s when its pending join succeeds after the timeout', (name, roomInfo, userInitiated) => {
      const { store } = renderLobby(name);

      act(() => {
        vi.advanceTimersByTime(STARTUP_ROOM_TIMEOUT_MS * 2);
      });

      act(() => {
        store.dispatch(rooms.Actions.joinRoom({ roomInfo, userInitiated }));
      });

      expect(screen.getByText('room-page')).toBeInTheDocument();
      expect(hoisted.mockWebClient.request.session.joinRoom).toHaveBeenCalledTimes(userInitiated ? 1 : 0);
    });

    it('drops a pending auto-join on disconnect', () => {
      const { store } = renderLobby('Auto Room');
      act(() => {
        store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null } }));
      });

      expect(screen.getByText('lobby null')).toBeInTheDocument();
      act(() => {
        store.dispatch(rooms.Actions.joinRoom({ roomInfo: autoRoom, userInitiated: false }));
      });
      expect(screen.queryByText('room-page')).not.toBeInTheDocument();
    });
  });
});
