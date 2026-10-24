import { act, fireEvent, screen, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { rooms } from '@cockatrice/datatrice';
import { ServerInfo_GameSchema, ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';

import { connectedWithRoomsState, makeUser, renderWithProviders } from '../../../__test-utils__';
import type { RootState } from '../../../store';
import RoomUsers from './RoomUsers';

const hoisted = vi.hoisted(() => ({ openChat: vi.fn(), openGames: vi.fn() }));
vi.mock('@app/feature-widgets/chat-dock', () => ({ useOpenChat: () => hoisted.openChat }));
vi.mock('@app/feature-widgets/user-games', () => ({ useUserGames: () => ({ open: hoisted.openGames }) }));

const buddy = makeUser({ name: 'buddy' });
const away = makeUser({ name: 'away' });
const mod = makeUser({ name: 'mod', userLevel: Level.IsUser | Level.IsRegistered | Level.IsModerator });
const stranger = makeUser({ name: 'stranger' });

function state(): Partial<RootState> {
  const base = connectedWithRoomsState as any;
  return {
    ...base,
    server: { ...base.server, users: { buddy, mod, stranger }, buddyList: { buddy, away } },
    rooms: {
      ...base.rooms,
      rooms: {
        1: {
          ...base.rooms.rooms[1],
          users: { buddy, mod, stranger },
          games: {
            7: {
              info: create(ServerInfo_GameSchema, { gameId: 7, description: 'Bracket 3 pod', creatorInfo: buddy }),
              gameType: '',
            },
          },
        },
      },
    },
  };
}

const renderUsers = () =>
  renderWithProviders(<RoomUsers roomId={1} roomName="Main Room" />, { preloadedState: state(), route: '/room/1' });

describe('RoomUsers', () => {
  beforeEach(() => {
    hoisted.openChat.mockClear();
    hoisted.openGames.mockClear();
  });

  it('counts the room members in the header', () => {
    renderUsers();

    expect(screen.getByRole('heading', { name: 'RoomUsers.title' })).toBeInTheDocument();
    expect(screen.getByText('RoomUsers.count')).toBeInTheDocument();
  });

  it('puts the buddy in this room first, with the game they host and their actions', () => {
    renderUsers();
    const list = screen.getByRole('list', { name: 'RoomUsers.list' });

    expect(within(list).getAllByRole('link')[0]).toHaveTextContent('buddy');
    expect(within(list).getByText('RoomUsers.hosting')).toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'RoomUsers.showGames' }));
    expect(hoisted.openGames).toHaveBeenCalledWith('buddy');

    fireEvent.click(within(list).getByRole('button', { name: 'RoomUsers.message' }));
    expect(hoisted.openChat).toHaveBeenCalledWith('buddy');
  });

  it('folds offline buddies until asked', () => {
    renderUsers();
    const list = screen.getByRole('list', { name: 'RoomUsers.list' });
    const offline = within(list).getByRole('button', { name: /RoomUsers.section.offline/ });

    expect(offline).toHaveAttribute('aria-expanded', 'false');
    expect(within(list).queryByRole('link', { name: 'away' })).not.toBeInTheDocument();

    fireEvent.click(offline);
    expect(within(list).getByRole('link', { name: 'away' })).toBeInTheDocument();
  });

  it('lists staff in the room and folds everyone behind a preview', () => {
    renderUsers();
    const list = screen.getByRole('list', { name: 'RoomUsers.list' });

    expect(within(list).getByRole('button', { name: /RoomUsers.section.staff/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(list).getByRole('link', { name: /^mod/ })).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: 'stranger' })).not.toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'RoomUsers.preview' }));
    expect(within(list).getByRole('link', { name: 'stranger' })).toBeInTheDocument();
  });

  it('finds a player in the room by name', () => {
    renderUsers();

    fireEvent.change(screen.getByRole('searchbox', { name: 'RoomUsers.search' }), { target: { value: 'STRAN' } });
    const list = screen.getByRole('list', { name: 'RoomUsers.list' });

    expect(within(list).getAllByRole('link').map((l) => l.textContent)).toEqual(['stranger']);
  });

  it('closes a person menu when membership shifts the rows, so it never acts on someone else', () => {
    const { store } = renderUsers();
    const list = screen.getByRole('list', { name: 'RoomUsers.list' });
    fireEvent.click(within(list).getByRole('button', { name: 'RoomUsers.preview' }));
    fireEvent.contextMenu(within(list).getByRole('link', { name: 'stranger' }));
    expect(screen.getByRole('menu', { name: 'UserActionsMenu.label' })).toBeInTheDocument();

    act(() => {
      store.dispatch(rooms.Actions.userJoined({ roomId: 1, user: makeUser({ name: 'aaron' }) }));
    });

    expect(screen.queryByRole('menu', { name: 'UserActionsMenu.label' })).not.toBeInTheDocument();
  });
});
