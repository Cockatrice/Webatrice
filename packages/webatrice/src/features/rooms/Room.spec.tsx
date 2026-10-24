import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ useRoom: vi.fn() }));

vi.mock('./useRoom', () => ({ useRoom: hoisted.useRoom }));
vi.mock('./components/GamesList', () => ({
  default: ({ header }: { header?: React.ReactNode }) => <div data-testid="games-list">{header}</div>,
}));
vi.mock('./components/RoomChat', () => ({
  default: () => <div data-testid="room-chat" />,
}));
vi.mock('./components/RoomUsers', () => ({
  default: ({ roomId, roomName }: { roomId: number; roomName: string }) => (
    <div data-testid="room-users">{`${roomId}:${roomName}`}</div>
  ),
}));
vi.mock('./dialogs/CreateGameDialog/CreateGameDialog', () => ({
  default: ({ isOpen, onSubmit, onCancel }: { isOpen: boolean; onSubmit: (p: unknown) => void; onCancel: () => void }) => (
    isOpen ? (
      <div role="dialog" aria-label="create">
        <button type="button" onClick={() => onSubmit({ description: 'pod' })}>submit</button>
        <button type="button" onClick={onCancel}>cancel</button>
      </div>
    ) : null
  ),
}));

import Room from './Room';

const baseRoom = {
  roomId: 1,
  room: undefined,
  roomMessages: [],
  users: [],
  handleRoomSay: vi.fn(),
  handleCreateGame: vi.fn(),
};

const resolved = (overrides = {}) => ({
  ...baseRoom,
  room: { info: { roomId: 1, name: 'Main Room', description: 'Play anything here.' }, gametypeMap: {}, users: {} } as never,
  ...overrides,
});

const renderRoom = () => renderWithProviders(<Room />, { preloadedState: connectedState, route: '/room/1' });

describe('Room', () => {
  it('renders nothing when there is no resolved room', () => {
    hoisted.useRoom.mockReturnValue({ ...baseRoom, room: undefined });

    const { container } = renderRoom();

    expect(container.querySelector('.room-view')).toBeNull();
  });

  it('frames the games list, the room chat and the room people column', () => {
    hoisted.useRoom.mockReturnValue(resolved());

    renderRoom();

    expect(screen.getByRole('heading', { level: 1, name: 'Room.title' })).toBeInTheDocument();
    expect(screen.getByText('Play anything here.')).toBeInTheDocument();
    expect(screen.getByTestId('games-list')).toBeInTheDocument();
    expect(screen.getByTestId('room-chat')).toBeInTheDocument();
    expect(screen.getByTestId('room-users')).toHaveTextContent('1:Main Room');
  });

  it('opens the create game dialog from the header and creates the game in this room', () => {
    const handleCreateGame = vi.fn();
    hoisted.useRoom.mockReturnValue(resolved({ handleCreateGame }));

    renderRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Room.createGame' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(handleCreateGame).toHaveBeenCalledWith({ description: 'pod' });
    expect(screen.queryByRole('dialog', { name: 'create' })).not.toBeInTheDocument();
  });

  it('closes the create game dialog on cancel without creating anything', () => {
    const handleCreateGame = vi.fn();
    hoisted.useRoom.mockReturnValue(resolved({ handleCreateGame }));

    renderRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Room.createGame' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(handleCreateGame).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'create' })).not.toBeInTheDocument();
  });

  it('opens the create game dialog when Home asks for it through the route state', () => {
    hoisted.useRoom.mockReturnValue(resolved());

    renderWithProviders(<Room />, {
      preloadedState: connectedState,
      route: { pathname: '/room/1', state: { createGame: true } },
    });

    expect(screen.getByRole('dialog', { name: 'create' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByRole('dialog', { name: 'create' })).not.toBeInTheDocument();
  });
});
