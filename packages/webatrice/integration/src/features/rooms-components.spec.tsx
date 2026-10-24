import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import GamesList from '../../../src/features/rooms/components/GamesList';
import CreateGameDialog from '../../../src/features/rooms/dialogs/CreateGameDialog/CreateGameDialog';
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
  it('mounts GamesList with an empty room as a games grid under the quick-filter bar', () => {
    renderFeatureScreen(<GamesList room={makeRoom()} />);

    expect(screen.getByRole('grid', { name: 'GamesList.heading' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'QuickFilterBar.search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'QuickFilterBar.more' })).toBeInTheDocument();
    expect(screen.getByText('GamesList.empty')).toBeInTheDocument();
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

    expect(screen.getByText('CreateGameDialog.title')).toBeInTheDocument();
  });
});
