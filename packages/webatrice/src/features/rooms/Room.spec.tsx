import { screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ useRoom: vi.fn() }));

vi.mock('./useRoom', () => ({ useRoom: hoisted.useRoom }));
// Room is a layout container; stub its children so this spec covers Room's own
// branching (the `!room` guard) and pane wiring, not the children's internals.
// The old GameSelector/Messages/SayMessage were replaced during the fancy-
// webatrice redo by GamesList/RoomChat/RoomUsers — mock those instead.
vi.mock('./components/GamesList', () => ({
  default: () => <div data-testid="games-list" />,
}));
vi.mock('./components/RoomChat', () => ({
  default: () => <div data-testid="room-chat" />,
}));
vi.mock('./components/RoomUsers', () => ({
  default: () => <div data-testid="room-users" />,
}));

import Room from './Room';

const baseRoom = {
  room: undefined,
  roomMessages: [],
  users: [],
  handleRoomSay: vi.fn(),
};

describe('Room', () => {
  it('renders nothing when there is no resolved room', () => {
    hoisted.useRoom.mockReturnValue({ ...baseRoom, room: undefined });

    const { container } = renderWithProviders(<Room />, {
      preloadedState: connectedState,
      route: '/room/1',
    });

    expect(container.querySelector('.room-view')).toBeNull();
  });

  it('renders the game selector, messages and say-message panes when a room is resolved', () => {
    hoisted.useRoom.mockReturnValue({
      ...baseRoom,
      room: { info: { roomId: 1, name: 'Main Room' } } as never,
    });

    renderWithProviders(<Room />, {
      preloadedState: connectedState,
      route: '/room/1',
    });

    // Same pane-wiring intent as before, now against the renamed children:
    // GamesList (was GameSelector), RoomChat (was Messages + SayMessage).
    expect(screen.getByTestId('games-list')).toBeInTheDocument();
    expect(screen.getByTestId('room-chat')).toBeInTheDocument();
    expect(screen.getByTestId('room-users')).toBeInTheDocument();
  });

  // Room no longer forwards a `users` prop into the side pane — RoomUsers
  // pulls from redux (buddyList + sortedUsers). Test removed because the
  // useRoom→prop wire it was covering was deleted; per-user rendering is
  // covered by RoomUsers.spec.tsx (or the integration Server users panel).
});
