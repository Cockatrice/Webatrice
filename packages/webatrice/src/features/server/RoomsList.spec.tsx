import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { makeRoom } from '@cockatrice/datatrice/testing';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { renderWithProviders, connectedState } from '../../__test-utils__';

import RoomsList from './RoomsList';

const room = (overrides: Parameters<typeof makeRoom>[0] = {}) =>
  makeRoom({ roomId: 1, name: 'Main Room', permissionlevel: 'none', playerCount: 3, gameCount: 2, ...overrides });

describe('RoomsList', () => {
  it('shows a row per room with its counts', () => {
    renderWithProviders(
      <RoomsList rooms={[room(), room({ roomId: 2, name: 'Second Room' })]} joinedRoomIds={{}} onOpen={vi.fn()} />,
      { preloadedState: connectedState },
    );
    expect(screen.getByText('Main Room')).toBeInTheDocument();
    expect(screen.getByText('Second Room')).toBeInTheDocument();
    expect(screen.getAllByText('RoomsList.summary')).toHaveLength(2);
  });

  it('offers Join for a room not joined yet and Open for a joined one', () => {
    const onOpen = vi.fn();
    renderWithProviders(
      <RoomsList rooms={[room(), room({ roomId: 2, name: 'Second Room' })]} joinedRoomIds={{ 2: true }} onOpen={onOpen} />,
      { preloadedState: connectedState },
    );
    fireEvent.click(screen.getByRole('button', { name: 'RoomsList.joinLabel' }));
    fireEvent.click(screen.getByRole('button', { name: 'RoomsList.openLabel' }));
    expect(onOpen.mock.calls).toEqual([[1], [2]]);
    expect(screen.getByText('RoomsList.joined')).toBeInTheDocument();
  });

  it('marks rooms with an entry restriction', () => {
    renderWithProviders(
      <RoomsList
        rooms={[room({ permissionlevel: 'REGISTERED' }), room({ roomId: 2, name: 'Open' })]}
        joinedRoomIds={{}}
        onOpen={vi.fn()}
      />,
      { preloadedState: connectedState },
    );
    expect(screen.getAllByRole('img', { name: 'RoomsList.restricted' })).toHaveLength(1);
  });

  it('says when the server has no rooms', () => {
    renderWithProviders(<RoomsList rooms={[]} joinedRoomIds={{}} onOpen={vi.fn()} />, { preloadedState: connectedState });
    expect(screen.getByText('RoomsList.empty')).toBeInTheDocument();
  });

  describe('join failures', () => {
    const withJoinError = (code: number, failure?: WebsocketTypes.CommandFailure) => ({
      ...connectedState,
      rooms: { ...(connectedState.rooms as any), joinRoomError: { roomId: 1, responseCode: code, failure } },
    });

    it.each([
      [6, 'RoomsList.joinError.notFound'],
      [11, 'RoomsList.joinError.contextError'],
      [15, 'RoomsList.joinError.userLevelTooLow'],
      [3, 'RoomsList.joinError.unknown'],
    ])('maps response code %i to the desktop message', (code, key) => {
      renderWithProviders(<RoomsList rooms={[room()]} joinedRoomIds={{}} onOpen={vi.fn()} />, {
        preloadedState: withJoinError(code),
      });
      expect(screen.getByRole('dialog')).toHaveTextContent(key);
    });

    it('explains a join the server never answered with the transport reason', () => {
      renderWithProviders(<RoomsList rooms={[room()]} joinedRoomIds={{}} onOpen={vi.fn()} />, {
        preloadedState: withJoinError(-1, WebsocketTypes.CommandFailure.Disconnected),
      });
      expect(screen.getByRole('dialog')).toHaveTextContent('CommandFailure.disconnected');
    });

    it('clears the error on dismiss so the join can be retried', () => {
      const { store } = renderWithProviders(<RoomsList rooms={[room()]} joinedRoomIds={{}} onOpen={vi.fn()} />, {
        preloadedState: withJoinError(6),
      });
      fireEvent.click(screen.getByRole('button', { name: 'OK' }));
      expect(store.getState().rooms.joinRoomError).toBeNull();
    });
  });
});
