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
  it('renders the room frame: games header with Create game, the people column and the chat input', () => {
    const { container } = renderFeatureScreen(
      <Routes>
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>,
      '/room/1',
    );

    expect(container.querySelector('.room-view')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Room.title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Room.createGame' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RoomUsers.title' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'RoomUsers.list' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Common.action.send' })).toBeInTheDocument();
  });

  it('renders nothing when the route param does not match a joined room', () => {
    const { container } = renderFeatureScreen(
      <Routes>
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={null} />
      </Routes>,
      '/room/999',
    );

    expect(container.querySelector('.room-view')).toBeNull();
  });
});
