import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { Room } from '@app/features/rooms';
import { rooms } from '@cockatrice/datatrice';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';

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

describe('Room (integration)', () => {
  it('renders the room view, game-selector header and chat input when joined', () => {
    const { container } = renderFeatureScreen(
      <Routes>
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>,
      '/room/1',
    );

    expect(container.querySelector('.room-view')).toBeInTheDocument();
    expect(screen.getByText(/Users in this room:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('renders nothing when the route param does not match a joined room', () => {
    const { container } = renderFeatureScreen(
      <Routes>
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>,
      '/room/999',
    );

    expect(container.querySelector('.room-view')).toBeNull();
  });
});
