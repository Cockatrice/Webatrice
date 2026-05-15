import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { Server } from '@app/features/server';
import { rooms } from '@cockatrice/datatrice';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';

import { renderFeatureScreen, simulateLoggedIn, store } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Server (integration)', () => {
  it('renders the rooms shell with the empty user count', () => {
    const { container } = renderFeatureScreen(<Server />);

    expect(container.querySelector('.server-rooms')).toBeInTheDocument();
    expect(screen.getByText(/Users connected to server:/)).toBeInTheDocument();
  });

  it('shows a row in the rooms table for each known room', () => {
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

    const { container } = renderFeatureScreen(<Server />);

    const tableRoom = container.querySelector('.rooms');
    expect(tableRoom?.textContent).toContain('Lobby');
  });
});
