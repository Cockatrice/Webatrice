import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { Server } from '@app/features/server';
import { rooms } from '@cockatrice/datatrice';
import {
  Command_JoinRoom_ext,
  Event_ListRoomsSchema,
  Event_ListRooms_ext,
  Response_ResponseCode,
  ServerInfo_RoomSchema,
} from '@cockatrice/sockatrice/generated';

import { connectAndHandshake } from '../helpers/setup';
import { buildResponse, buildResponseMessage, buildSessionEventMessage, deliverMessage } from '../helpers/protobuf-builders';
import { findLastSessionCommand } from '../helpers/command-capture';
import { renderFeatureScreen, simulateLoggedIn, store } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Server (integration)', () => {
  it('renders the Home page with an empty rooms panel', () => {
    renderFeatureScreen(<Server />);

    expect(screen.getByRole('heading', { name: 'HomeHero.welcome' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RoomsList.title' })).toBeInTheDocument();
    expect(screen.getByText('RoomsList.empty')).toBeInTheDocument();
  });

  it('lists each known room in the rooms panel', () => {
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

    renderFeatureScreen(<Server />);

    const panel = screen.getByRole('heading', { name: 'RoomsList.title' }).closest('section');
    expect(panel).toHaveTextContent('Lobby');
    expect(screen.getByRole('button', { name: 'RoomsList.openLabel' })).toBeInTheDocument();
  });

  it('explains a rejected room join and keeps the user in the lobby', async () => {
    connectAndHandshake();
    simulateLoggedIn();
    deliverMessage(buildSessionEventMessage(Event_ListRooms_ext, create(Event_ListRoomsSchema, {
      roomList: [create(ServerInfo_RoomSchema, { roomId: 4, name: 'Gated', permissionlevel: 'none' })],
    })));

    renderFeatureScreen(<Server />);
    fireEvent.click(screen.getByRole('button', { name: 'RoomsList.joinLabel' }));

    const join = findLastSessionCommand(Command_JoinRoom_ext);
    expect(join.value.roomId).toBe(4);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: join.cmdId,
      responseCode: Response_ResponseCode.RespNameNotFound,
    })));

    expect(store.getState().rooms.joinRoomError)
      .toEqual({ roomId: 4, responseCode: Response_ResponseCode.RespNameNotFound, failure: undefined });
    expect(await screen.findByRole('dialog')).toHaveTextContent('RoomsList.joinError.notFound');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(store.getState().rooms.joinRoomError).toBeNull();
    expect(await screen.findByRole('button', { name: 'RoomsList.joinLabel' })).toBeInTheDocument();
  });
});
