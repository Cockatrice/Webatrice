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

    // Old `.server-rooms` container is gone; the rooms shell is now a
    // <table> inside RoomsList. ServerUsers panel exposes user count as
    // "N connected" instead of "Users connected to server:".
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText(/\d+ connected/)).toBeInTheDocument();
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

    // `.rooms` class no longer exists — RoomsList renders a <table> and
    // a <tr> per room; scope to the <tbody> to skip the header cells.
    const tbody = container.querySelector('table tbody');
    expect(tbody?.textContent).toContain('Lobby');
  });
});
