import i18next from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import translations from './UserGamesDialog.i18n.json';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { games, rooms, server, type Game } from '@cockatrice/datatrice';
import {
  Event_GameJoinedSchema,
  Response_GetGamesOfUserSchema,
  Response_ResponseCode,
  ServerInfo_GameSchema,
  ServerInfo_RoomSchema,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';

import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { renderWithProviders, connectedState, createMockWebClient, makeUser } from '../../__test-utils__';
import type { RootState } from '../../store';
import UserGamesDialog from './UserGamesDialog';
import { setAdminLocked } from '../../hooks/useAdminLock';

afterEach(() => setAdminLocked(false));

const mockWebClient = createMockWebClient();

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => mockWebClient) };
});

const makeGame = (overrides: MessageInitShape<typeof ServerInfo_GameSchema> = {}): Game => ({
  info: create(ServerInfo_GameSchema, {
    gameId: 7,
    roomId: 2,
    description: 'Friday casual',
    playerCount: 1,
    maxPlayers: 2,
    spectatorsAllowed: true,
    creatorInfo: create(ServerInfo_UserSchema, { name: 'bob' }),
    ...overrides,
  }),
  gameType: 'Standard',
});

interface StateOptions {
  status?: RootState['server']['gamesOfUserStatus'][string];
  gameList?: Game[];
  joinedRoom?: boolean;
  judge?: boolean;
  alreadyOpen?: boolean;
}

function stateWith({
  status, gameList = [], joinedRoom = true, judge = false, alreadyOpen = false,
}: StateOptions = {}): Partial<RootState> {
  const server = connectedState.server as RootState['server'];
  const rooms = connectedState.rooms as RootState['rooms'];
  return {
    ...connectedState,
    ...(alreadyOpen ? { games: { games: { 7: {} as never }, pings: {} } } : {}),
    server: {
      ...server,
      user: judge ? makeUser({ name: 'testUser', userLevel: ServerInfo_User_UserLevelFlag.IsJudge }) : server.user,
      gamesOfUser: { bob: Object.fromEntries(gameList.map((game) => [game.info.gameId, game])) },
      gamesOfUserRoomNames: { bob: { 2: 'Constructed' } },
      gamesOfUserStatus: status ? { bob: status } : {},
    },
    rooms: {
      ...rooms,
      rooms: { 2: { info: create(ServerInfo_RoomSchema, { roomId: 2, name: 'Constructed' }) } as never },
      joinedRoomIds: joinedRoom ? { 2: true } : {},
    },
  };
}

function renderDialog(options?: StateOptions) {
  const onClose = vi.fn();
  const utils = renderWithProviders(<UserGamesDialog userName="bob" onClose={onClose} />, {
    preloadedState: stateWith(options),
  });
  return { ...utils, onClose };
}

const loaded = { state: 'loaded' } as const;

describe('UserGamesDialog', () => {
  it('returns to the games list when the default No answer is chosen', async () => {
    renderDialog({ status: loaded, gameList: [makeGame({ playerCount: 2 })] });
    fireEvent.doubleClick(screen.getByRole('row', { name: /Friday casual/ }));
    fireEvent.click(screen.getByRole('button', { name: 'GameLink.no' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'UserGamesDialog.title' })).toBeVisible());
    expect(screen.getByRole('row', { name: /Friday casual/ })).toBeInTheDocument();
    expect(mockWebClient.request.rooms.joinGame).not.toHaveBeenCalled();
  });

  it('asks before a full-game row joins as spectator', () => {
    renderDialog({ status: loaded, gameList: [makeGame({ playerCount: 2 })] });
    fireEvent.doubleClick(screen.getByRole('row', { name: /Friday casual/ }));
    expect(screen.getByRole('button', { name: 'GameLink.no' })).toHaveFocus();
    expect(mockWebClient.request.rooms.joinGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'GameLink.yes' }));
    expect(mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({ spectator: true }), expect.any(String));
  });

  it('uses room names from the user games response instead of the room listing', () => {
    const { store } = renderDialog();
    act(() => {
      store.dispatch(server.Actions.gamesOfUser({ userName: 'bob', response: create(Response_GetGamesOfUserSchema, {
        roomList: [{ roomId: 2, name: 'Response room name' }], gameList: [makeGame().info],
      }) }));
    });
    expect(screen.getByRole('gridcell', { name: 'Response room name' })).toBeInTheDocument();
  });

  it('requests the games of the user when it opens', () => {
    renderDialog();
    expect(mockWebClient.request.session.getGamesOfUser).toHaveBeenCalledWith('bob');
    expect(screen.getByRole('dialog', { name: 'UserGamesDialog.title' })).toBeInTheDocument();
  });

  it('shows a loading state until the answer arrives', () => {
    renderDialog({ status: { state: 'loading' } });
    expect(screen.getByText('UserGamesDialog.loading')).toBeInTheDocument();
  });

  it.each([
    [Response_ResponseCode.RespNameNotFound, 'UserGamesDialog.error.userNotFound'],
    [Response_ResponseCode.RespInIgnoreList, 'UserGamesDialog.error.ignored'],
    [Response_ResponseCode.RespInternalError, 'UserGamesDialog.error.unknown'],
  ])('shows the desktop message for rejection %i', (code, key) => {
    renderDialog({ status: { state: 'failed', responseCode: code } });
    expect(screen.getByRole('alert')).toHaveTextContent(key);
  });

  it('gives the transport reason when the server never answered', () => {
    renderDialog({
      status: {
        state: 'failed',
        responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.Disconnected,
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('CommandFailure.disconnected');
  });

  it('says so when the user is in no games', () => {
    renderDialog({ status: loaded });
    expect(screen.getByText('UserGamesDialog.empty')).toBeInTheDocument();
  });

  it('lists each game with its room, description, creator and type', () => {
    renderDialog({ status: loaded, gameList: [makeGame()] });
    const row = screen.getByText('Friday casual').closest('tr')!;
    expect(row).toHaveTextContent('Constructed');
    expect(row).toHaveTextContent('bob');
    expect(row).toHaveTextContent('Standard');
    expect(row).toHaveTextContent('1/2');
  });

  it('joins the selected game through its room', () => {
    renderDialog({ status: loaded, gameList: [makeGame()] });
    expect(screen.getByRole('button', { name: 'UserGamesDialog.action.join' })).toBeDisabled();

    fireEvent.click(screen.getByText('Friday casual'));
    fireEvent.click(screen.getByRole('button', { name: 'UserGamesDialog.action.join' }));
    expect(mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({
      gameId: 7, spectator: false, joinAsJudge: false,
    }), expect.any(String));
  });

  it('spectates on request, and only where spectators are allowed', () => {
    renderDialog({ status: loaded, gameList: [makeGame(), makeGame({ gameId: 8, description: 'Private', spectatorsAllowed: false })] });
    fireEvent.click(screen.getByText('Private'));
    expect(screen.getByRole('button', { name: 'UserGamesDialog.action.spectate' })).toBeDisabled();

    fireEvent.click(screen.getByText('Friday casual'));
    fireEvent.click(screen.getByRole('button', { name: 'UserGamesDialog.action.spectate' }));
    expect(mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(
      2, expect.objectContaining({ gameId: 7, spectator: true }), expect.any(String),
    );
  });

  it('offers judge joins to judges only', () => {
    renderDialog({ status: loaded, gameList: [makeGame()] });
    expect(screen.queryByRole('button', { name: 'UserGamesDialog.action.joinAsJudge' })).not.toBeInTheDocument();
  });

  it('lets a judge join as judge', () => {
    renderDialog({ status: loaded, gameList: [makeGame()], judge: true });
    fireEvent.click(screen.getByText('Friday casual'));
    fireEvent.click(screen.getByRole('button', { name: 'UserGamesDialog.action.joinAsJudge' }));
    expect(mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(
      2, expect.objectContaining({ joinAsJudge: true }), expect.any(String),
    );
  });

  describe('keyboard', () => {
    const twoGames = () => [makeGame(), makeGame({ gameId: 8, description: 'Late night' })];
    const rows = () => screen.getAllByRole('row').slice(1);

    it('makes the first row the grid\'s one Tab stop until a row is selected', () => {
      renderDialog({ status: loaded, gameList: twoGames() });
      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(rows().map((row) => row.tabIndex)).toEqual([0, -1]);
    });

    it('moves the selection and focus with the arrow keys', () => {
      renderDialog({ status: loaded, gameList: twoGames() });
      const [first, second] = rows();
      first.focus();
      fireEvent.keyDown(first, { key: 'ArrowDown' });
      expect(second).toHaveFocus();
      expect(second).toHaveAttribute('aria-selected', 'true');
      expect(rows().map((row) => row.tabIndex)).toEqual([-1, 0]);

      fireEvent.keyDown(second, { key: 'ArrowUp' });
      expect(first).toHaveFocus();
      expect(first).toHaveAttribute('aria-selected', 'true');
    });

    it('selects with Space so Join and Spectate can act on the row', () => {
      renderDialog({ status: loaded, gameList: twoGames() });
      fireEvent.keyDown(rows()[1], { key: ' ' });
      fireEvent.click(screen.getByRole('button', { name: 'UserGamesDialog.action.join' }));
      expect(mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({ gameId: 8 }), expect.any(String));
    });

    it('joins the row with Enter', () => {
      renderDialog({ status: loaded, gameList: twoGames() });
      fireEvent.keyDown(rows()[0], { key: 'Enter' });
      expect(mockWebClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({
        gameId: 7, spectator: false,
      }), expect.any(String));
    });
  });

  it('asks for the password of a protected game before joining', () => {
    renderDialog({ status: loaded, gameList: [makeGame({ withPassword: true })] });
    fireEvent.doubleClick(screen.getByText('Friday casual'));
    expect(mockWebClient.request.rooms.joinGame).not.toHaveBeenCalled();
    expect(screen.getByText('UserGamesDialog.password.title')).toBeInTheDocument();
    expect(screen.getByLabelText('UserGamesDialog.password.label')).toHaveAttribute('type', 'password');
  });

  it.each([true, false])('closes for an already-open protected game (room joined: %s)', (joinedRoom) => {
    const { onClose } = renderDialog({
      status: loaded, gameList: [makeGame({ withPassword: true })], alreadyOpen: true, joinedRoom,
    });
    fireEvent.doubleClick(screen.getByText('Friday casual'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockWebClient.request.rooms.joinGame).not.toHaveBeenCalled();
    expect(screen.queryByText('UserGamesDialog.password.title')).not.toBeInTheDocument();
    expect(screen.queryByText('UserGamesDialog.error.joinRoomFirst')).not.toBeInTheDocument();
  });

  it.each([
    ['Friday casual', 'Password for "Friday casual":'],
    ['', 'Password for game #7:'],
  ])('names the password target when its description is %s', async (description, label) => {
    const i18n = i18next.createInstance().use(ICU);
    await i18n.init({ lng: 'en', resources: { en: { translation: translations } } });
    renderWithProviders(
      <I18nextProvider i18n={i18n}><UserGamesDialog userName="bob" onClose={vi.fn()} /></I18nextProvider>,
      { preloadedState: stateWith({ status: loaded, gameList: [makeGame({ description, withPassword: true })] }) },
    );
    fireEvent.doubleClick(screen.getAllByRole('row')[1]);
    expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password');
  });

  it('asks the user to join the room first, as desktop does', () => {
    renderDialog({ status: loaded, gameList: [makeGame()], joinedRoom: false });
    fireEvent.doubleClick(screen.getByText('Friday casual'));
    expect(mockWebClient.request.rooms.joinGame).not.toHaveBeenCalled();
    expect(screen.getByText('UserGamesDialog.error.joinRoomFirst')).toBeInTheDocument();
  });

  it('closes once a join from its list is confirmed', () => {
    const { store, onClose } = renderDialog({ status: loaded, gameList: [makeGame()] });
    act(() => {
      store.dispatch(games.Actions.gameJoined({
        data: create(Event_GameJoinedSchema, { gameInfo: create(ServerInfo_GameSchema, { gameId: 7 }) }),
      }) as never);
    });
    expect(onClose).toHaveBeenCalled();
  });
});

it.each([
  [Response_ResponseCode.RespWrongPassword, undefined, 'JoinGameError.wrongPassword'],
  [Response_ResponseCode.RespNotConnected, WebsocketTypes.CommandFailure.Timeout, 'CommandFailure.timeout'],
] as const)('translates its own join failure %s/%s with an empty legacy message', (code, failure, message) => {
  const { store } = renderDialog({ status: loaded, gameList: [makeGame()] });
  fireEvent.doubleClick(screen.getByText('Friday casual'));
  const requestId = vi.mocked(mockWebClient.request.rooms.joinGame).mock.lastCall?.[2];
  act(() => store.dispatch(rooms.Actions.setJoinGameError({ code, message: '', failure, requestId })));
  expect(screen.getByText(message)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
  expect(screen.queryByText(message)).not.toBeInTheDocument();
});

it.each([
  ['ordinary', ServerInfo_User_UserLevelFlag.IsRegistered, false, false],
  ['locked ordinary', ServerInfo_User_UserLevelFlag.IsRegistered, true, false],
  ['moderator', ServerInfo_User_UserLevelFlag.IsModerator, false, true],
  ['locked moderator', ServerInfo_User_UserLevelFlag.IsModerator, true, false],
  ['judge', ServerInfo_User_UserLevelFlag.IsJudge, false, true],
  ['locked judge', ServerInfo_User_UserLevelFlag.IsJudge, true, true],
] as const)('gates private user games for %s', (_name, userLevel, locked, override) => {
  setAdminLocked(locked);
  const state = stateWith({ status: loaded, gameList: [makeGame({ playerCount: 2, spectatorsAllowed: false })] });
  state.server!.user = makeUser({ userLevel });
  renderWithProviders(<UserGamesDialog userName="bob" onClose={() => {}} />, { preloadedState: state });
  fireEvent.click(screen.getByText('Friday casual'));
  expect(screen.getByRole('button', { name: 'UserGamesDialog.action.join' })).toHaveProperty('disabled', !override);
  expect(screen.getByRole('button', { name: 'UserGamesDialog.action.spectate' })).toHaveProperty('disabled', !override);
});
