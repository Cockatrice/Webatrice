import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import GameSelector from '../../../src/features/rooms/components/GameSelector/GameSelector';
import OpenGames from '../../../src/features/rooms/components/OpenGames';
import Messages from '../../../src/features/rooms/components/Messages';
import SayMessage from '../../../src/features/rooms/components/SayMessage';
import CreateGameDialog from '../../../src/features/rooms/dialogs/CreateGameDialog/CreateGameDialog';
import FilterGamesDialog from '../../../src/features/rooms/dialogs/FilterGamesDialog/FilterGamesDialog';
import { rooms } from '@cockatrice/datatrice';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';
import type { Room as RoomType } from '@cockatrice/datatrice';

import { renderFeatureScreen, simulateLoggedIn, store } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
  store.dispatch(rooms.Actions.joinRoom({
    roomInfo: create(ServerInfo_RoomSchema, {
      roomId: 1,
      name: 'Lobby',
      description: 'Test lobby',
      autoJoin: false,
      gameList: [],
      userList: [],
      gametypeList: [],
    }),
  }));
});

const makeRoom = (): RoomType => ({
  info: { roomId: 1, name: 'Lobby' },
  gametypeMap: {},
  order: 0,
  games: {},
  users: {},
}) as unknown as RoomType;

describe('Rooms components (integration)', () => {
  it('mounts GameSelector with a known room and renders its toolbar/games panel', () => {
    const { container } = renderFeatureScreen(<GameSelector room={makeRoom()} />);

    expect(container.querySelector('.games')).toBeInTheDocument();
  });

  it('mounts OpenGames with an empty room', () => {
    renderFeatureScreen(<OpenGames room={makeRoom()} />);

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('mounts Messages with rendered message data', () => {
    const { container } = renderFeatureScreen(
      <Messages messages={[{ message: 'hello', timeReceived: 1 } as never]} />,
    );

    expect(container.querySelectorAll('.message-wrapper')).toHaveLength(1);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('mounts SayMessage and renders the chat input + send button', () => {
    renderFeatureScreen(<SayMessage onSubmit={vi.fn()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('mounts CreateGameDialog open', () => {
    renderFeatureScreen(
      <CreateGameDialog
        isOpen
        gametypeMap={{}}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Create Game')).toBeInTheDocument();
  });

  it('mounts FilterGamesDialog open with default filters', () => {
    renderFeatureScreen(
      <FilterGamesDialog
        isOpen
        initialFilters={rooms.DEFAULT_GAME_FILTERS}
        gametypeMap={{}}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Filter games')).toBeInTheDocument();
  });
});
