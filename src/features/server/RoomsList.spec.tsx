import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { Room } from '@cockatrice/datatrice';

import { renderWithProviders, createMockWebClient, connectedState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import RoomsList from './RoomsList';

beforeAll(() => {
  hoisted.mockWebClient = createMockWebClient();
});

const makeRoom = (overrides: Partial<Room['info']> = {}): Room =>
  ({
    info: {
      roomId: 1,
      name: 'Main Room',
      description: 'The lobby',
      permissionlevel: 'none',
      playerCount: 3,
      gameCount: 2,
      ...overrides,
    },
  }) as unknown as Room;

describe('RoomsList', () => {
  it('renders the table headers', () => {
    renderWithProviders(<RoomsList rooms={{}} joinedRooms={[]} />, {
      preloadedState: connectedState,
    });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Games')).toBeInTheDocument();
  });

  it('renders a row per room', () => {
    const rooms = { 1: makeRoom(), 2: makeRoom({ roomId: 2, name: 'Second Room' }) };
    renderWithProviders(<RoomsList rooms={rooms} joinedRooms={[]} />, {
      preloadedState: connectedState,
    });
    expect(screen.getByText('Main Room')).toBeInTheDocument();
    expect(screen.getByText('Second Room')).toBeInTheDocument();
  });

  it('joins a room via the web client when not already joined', () => {
    const rooms = { 1: makeRoom() };
    renderWithProviders(<RoomsList rooms={rooms} joinedRooms={[]} />, {
      preloadedState: connectedState,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(hoisted.mockWebClient.request.session.joinRoom).toHaveBeenCalledWith(1);
  });

  it('navigates instead of re-joining when the room is already joined', () => {
    const room = makeRoom();
    const rooms = { 1: room };
    renderWithProviders(<RoomsList rooms={rooms} joinedRooms={[room]} />, {
      preloadedState: connectedState,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(hoisted.mockWebClient.request.session.joinRoom).not.toHaveBeenCalled();
  });
});
