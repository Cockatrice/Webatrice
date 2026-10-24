import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { SessionScope } from '../../../src/SessionScope';
import { useAppSelector } from '@app/store';
import GamesList from '../../../src/features/rooms/components/GamesList';
import { UserDisplay } from '@app/components';
import { UserGamesProvider } from '@app/feature-widgets/user-games';
import {
  Command_GetGamesOfUser_ext,
  Command_JoinGame_ext,
  Command_JoinRoom_ext,
  Event_GameJoinedSchema,
  Event_GameJoined_ext,
  Event_ListRoomsSchema,
  Event_ListRooms_ext,
  Event_UserJoinedSchema,
  Event_UserJoined_ext,
  Response_GetGamesOfUserSchema,
  Response_GetGamesOfUser_ext,
  Response_JoinRoomSchema,
  Response_JoinRoom_ext,
  Response_ResponseCode,
  ServerInfo_GameSchema,
  ServerInfo_GameTypeSchema,
  ServerInfo_RoomSchema,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';

import { connectAndLogin, getWebClient, store } from '../helpers/setup';
import { buildResponse, buildResponseMessage, buildSessionEventMessage, deliverMessage } from '../helpers/protobuf-builders';
import { findLastRoomCommand, findLastSessionCommand } from '../helpers/command-capture';
import { renderFeatureScreen, simulateLoggedIn } from './helpers';

const bob = create(ServerInfo_UserSchema, { name: 'bob', country: 'us' });

const room = create(ServerInfo_RoomSchema, {
  roomId: 2,
  name: 'Constructed',
  autoJoin: true,
  gametypeList: [create(ServerInfo_GameTypeSchema, { gameTypeId: 1, description: 'Standard' })],
});

const bobsGame = create(ServerInfo_GameSchema, {
  gameId: 7,
  roomId: 2,
  description: 'Friday casual',
  withPassword: true,
  playerCount: 1,
  maxPlayers: 2,
  gameTypes: [1],
  creatorInfo: { name: 'bob' },
});

function BackgroundGames() {
  const joinedRoom = useAppSelector((state) => state.rooms.rooms[2]);
  return joinedRoom ? <GamesList room={joinedRoom} /> : null;
}

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function setupLobby() {
  connectAndLogin('alice');
  simulateLoggedIn();
  deliverMessage(buildSessionEventMessage(Event_ListRooms_ext, create(Event_ListRoomsSchema, { roomList: [room] })));
  const join = findLastSessionCommand(Command_JoinRoom_ext);
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: join.cmdId,
    ext: Response_JoinRoom_ext,
    value: create(Response_JoinRoomSchema, { roomInfo: room }),
  })));
  deliverMessage(buildSessionEventMessage(Event_UserJoined_ext, create(Event_UserJoinedSchema, { userInfo: bob })));

  renderFeatureScreen(
    <Routes>
      <Route path="*" element={<SessionScope><UserGamesProvider>
        <UserDisplay user={bob} /><BackgroundGames /><LocationProbe />
      </UserGamesProvider></SessionScope>} />
    </Routes>,
    '/server',
  );
}

function openShowGames() {
  fireEvent.contextMenu(screen.getByText('bob'));
  fireEvent.click(screen.getByRole('menuitem', { name: /UserGamesDialog\.menu\.showGames/ }));
  return findLastSessionCommand(Command_GetGamesOfUser_ext);
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('Show games of a user (integration)', () => {
  it('lists the games of the user and joins one through the password prompt', async () => {
    setupLobby();
    const request = openShowGames();
    expect(request.value.userName).toBe('bob');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: request.cmdId,
      ext: Response_GetGamesOfUser_ext,
      value: create(Response_GetGamesOfUserSchema, { roomList: [room], gameList: [bobsGame] }),
    })));

    const dialog = screen.getByRole('dialog', { name: 'UserGamesDialog.title' });
    const row = (await within(dialog).findByText('Friday casual')).closest('tr')!;
    expect(row).toHaveTextContent('Constructed');
    expect(row).toHaveTextContent('Standard');

    fireEvent.doubleClick(row);
    const password = await screen.findByLabelText('UserGamesDialog.password.label');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.change(password, { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'UserGamesDialog.password.submit' }));

    const joinGame = findLastRoomCommand(Command_JoinGame_ext);
    expect(joinGame.roomId).toBe(2);
    expect(joinGame.value).toMatchObject({ gameId: 7, password: 'hunter2', spectator: false });

    deliverMessage(buildResponseMessage(buildResponse({ cmdId: joinGame.cmdId })));
    deliverMessage(buildSessionEventMessage(Event_GameJoined_ext, create(Event_GameJoinedSchema, {
      gameInfo: bobsGame, playerId: 1, hostId: 1,
    })));

    expect(await screen.findByText('/game/7')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'UserGamesDialog.title' })).not.toBeInTheDocument();
  });

  it('switches to an already-open protected game and closes the selector', async () => {
    setupLobby();
    deliverMessage(buildSessionEventMessage(Event_GameJoined_ext, create(Event_GameJoinedSchema, {
      gameInfo: bobsGame, playerId: 1, hostId: 1,
    })));
    const request = openShowGames();
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: request.cmdId,
      ext: Response_GetGamesOfUser_ext,
      value: create(Response_GetGamesOfUserSchema, { roomList: [room], gameList: [bobsGame] }),
    })));
    fireEvent.doubleClick(await screen.findByText('Friday casual'));
    expect(await screen.findByText('/game/7')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'UserGamesDialog.title' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('UserGamesDialog.password.label')).not.toBeInTheDocument();
  });

  it('explains why the games of a user who ignores you cannot be shown', async () => {
    setupLobby();
    const request = openShowGames();
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: request.cmdId,
      responseCode: Response_ResponseCode.RespInIgnoreList,
    })));

    expect(await screen.findByRole('alert')).toHaveTextContent('UserGamesDialog.error.ignored');
  });
});

async function openUnprotectedGame() {
  const request = openShowGames();
  act(() => deliverMessage(buildResponseMessage(buildResponse({
    cmdId: request.cmdId, ext: Response_GetGamesOfUser_ext,
    value: create(Response_GetGamesOfUserSchema, {
      roomList: [room], gameList: [create(ServerInfo_GameSchema, { ...bobsGame, withPassword: false })],
    }),
  }))));
  return screen.findByText('Friday casual');
}

it('keeps a closed selector rejection out of the reopened selector and background list', async () => {
  setupLobby();
  fireEvent.doubleClick(await openUnprotectedGame());
  const oldJoin = findLastRoomCommand(Command_JoinGame_ext);
  fireEvent.click(screen.getByRole('button', { name: 'Common.action.close' }));
  await openUnprotectedGame();
  act(() => deliverMessage(buildResponseMessage(buildResponse({
    cmdId: oldJoin.cmdId, responseCode: Response_ResponseCode.RespWrongPassword,
  }))));
  expect(screen.queryByText('JoinGameError.wrongPassword')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'UserGamesDialog.error.title' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument();

  fireEvent.doubleClick(screen.getByText('Friday casual'));
  const currentJoin = findLastRoomCommand(Command_JoinGame_ext);
  act(() => deliverMessage(buildResponseMessage(buildResponse({
    cmdId: currentJoin.cmdId, responseCode: Response_ResponseCode.RespWrongPassword,
  }))));
  expect(screen.getAllByText('JoinGameError.wrongPassword')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'UserGamesDialog.error.title' })).toBeInTheDocument();
});

it('leaves no old selector or join error after disconnect, re-login, and a late response', async () => {
  setupLobby();
  fireEvent.doubleClick(await openUnprotectedGame());
  const oldJoin = findLastRoomCommand(Command_JoinGame_ext);
  act(() => getWebClient().disconnect());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(store.getState().rooms.joinGameError).toBeNull();
  act(() => connectAndLogin('alice'));
  act(() => deliverMessage(buildResponseMessage(buildResponse({
    cmdId: oldJoin.cmdId, responseCode: Response_ResponseCode.RespWrongPassword,
  }))));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(store.getState().rooms.joinGameError).toBeNull();
});

it('opens user games entirely by keyboard, traps focus, and restores the user link', async () => {
  const user = userEvent.setup();
  setupLobby();
  const opener = screen.getByRole('link', { name: /bob/ });
  opener.focus();
  await user.keyboard('{Shift>}{F10}{/Shift}');
  const menu = screen.getByRole('menu');
  const showGames = within(menu).getByRole('menuitem', { name: /UserGamesDialog.menu.showGames/ });
  const entries = within(menu).getAllByRole('menuitem');
  await user.keyboard('{Home}');
  for (let i = 0; i < entries.indexOf(showGames); i += 1) {
    await user.keyboard('{ArrowDown}');
  }
  expect(showGames).toHaveFocus();
  await user.keyboard('{Enter}');
  const request = findLastSessionCommand(Command_GetGamesOfUser_ext);
  expect(request.value.userName).toBe('bob');
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: request.cmdId,
    ext: Response_GetGamesOfUser_ext,
    value: create(Response_GetGamesOfUserSchema, { roomList: [room], gameList: [bobsGame] }),
  })));
  const dialog = screen.getByRole('dialog', { name: 'UserGamesDialog.title' });
  expect(dialog.contains(document.activeElement)).toBe(true);
  const stops = within(dialog).getAllByRole('button').filter((button) => !(button as HTMLButtonElement).disabled);
  for (let i = 0; i <= stops.length + 2; i += 1) {
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  }
  await user.tab({ shift: true });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
