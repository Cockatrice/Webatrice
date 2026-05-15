import { screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ useRoom: vi.fn() }));

vi.mock('./useRoom', () => ({ useRoom: hoisted.useRoom }));
// Room is a layout container; stub its children so this spec covers Room's own
// branching (the `!room` guard) and pane wiring, not the children's internals.
vi.mock('./components/GameSelector/GameSelector', () => ({
  default: () => <div data-testid="game-selector" />,
}));
vi.mock('./components/Messages', () => ({
  default: () => <div data-testid="messages" />,
}));
vi.mock('./components/SayMessage', () => ({
  default: () => <div data-testid="say-message" />,
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

    expect(screen.getByTestId('game-selector')).toBeInTheDocument();
    expect(screen.getByTestId('messages')).toBeInTheDocument();
    expect(screen.getByTestId('say-message')).toBeInTheDocument();
  });
});
