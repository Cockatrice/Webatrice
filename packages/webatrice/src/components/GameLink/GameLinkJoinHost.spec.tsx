import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { games, rooms } from '@cockatrice/datatrice';
import {
  Event_GameJoinedSchema,
  Response_ResponseCode,
  ServerInfo_GameSchema,
  ServerInfo_User_UserLevelFlag,
  ServerInfo_RoomSchema,
  type ServerInfo_Game,
} from '@cockatrice/sockatrice/generated';
import type { WebClient } from '@cockatrice/sockatrice';

import {
  connectedWithRoomsState,
  createMockWebClient,
  makeStoreState,
  makeUser,
  renderWithProviders,
} from '../../__test-utils__';
import { makeGameJoinLink } from '@app/utils';
import { GameLinkButton } from './GameLinkButton';
import GameLinkJoinHost, { GAME_LINK_WAIT_MS } from './GameLinkJoinHost';

const LIVE_SERVER = { hostname: 'localhost', port: '4748', desktopPort: '4747' };

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function listedGame(overrides: MessageInitShape<typeof ServerInfo_GameSchema> = {}): ServerInfo_Game {
  return create(ServerInfo_GameSchema, {
    gameId: 7,
    roomId: 1,
    description: 'Friday modern',
    playerCount: 1,
    maxPlayers: 2,
    ...overrides,
  });
}

function stateWith(game: ServerInfo_Game | null, userLevel?: number) {
  const room = connectedWithRoomsState.rooms!.rooms[1];
  return makeStoreState({
    ...connectedWithRoomsState,
    server: userLevel !== undefined ? {
      ...connectedWithRoomsState.server!,
      user: makeUser({ userLevel }),
    } : connectedWithRoomsState.server,
    rooms: {
      ...connectedWithRoomsState.rooms,
      rooms: { 1: { ...room, games: game ? { [game.gameId]: { info: game, gameType: '' } } : {} } },
    },
  });
}

const link = (overrides: Partial<Parameters<typeof makeGameJoinLink>[0]> = {}) =>
  makeGameJoinLink({ hostname: 'localhost', port: '4747', roomId: 1, gameId: 7, description: 'Friday modern', ...overrides });

function renderHost(url: string, game: ServerInfo_Game | null = listedGame()) {
  const webClient = createMockWebClient() as unknown as WebClient;
  const utils = renderWithProviders(
    <>
      <GameLinkButton url={url} />
      <GameLinkJoinHost endpoint={LIVE_SERVER} />
      <LocationProbe />
    </>,
    { preloadedState: stateWith(game), webClient },
  );
  fireEvent.click(screen.getByRole('button', { name: /GameLink\.anchor/ }));
  return { ...utils, webClient };
}

const dialogButton = (name: string) => within(screen.getByRole('dialog')).getByRole('button', { name });

describe('GameLinkJoinHost (GAME-033 incoming links)', () => {
  it('confirms, then joins the listed game through Command_JoinGame and opens it', () => {
    const { webClient, store } = renderHost(link());
    expect(within(screen.getByRole('dialog')).getByText('GameLink.confirm.descriptionInRoom')).toBeInTheDocument();
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();

    fireEvent.click(dialogButton('GameLink.yes'));
    expect(webClient.request.session.joinRoom).not.toHaveBeenCalled();
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, {
      gameId: 7,
      password: '',
      spectator: false,
      overrideRestrictions: false,
      joinAsJudge: false,
    }, expect.any(String));

    act(() => {
      store.dispatch(games.Actions.gameJoined({
        data: create(Event_GameJoinedSchema, { gameInfo: listedGame(), playerId: 2, hostId: 1 }),
      }));
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/game/7');
  });

  it('declining the confirmation sends nothing', async () => {
    const { webClient } = renderHost(link());
    fireEvent.click(dialogButton('GameLink.no'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(webClient.request.session.joinRoom).not.toHaveBeenCalled();
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
  });

  it('joins the room first when the user is not in it, then the game once it is listed', () => {
    const { webClient, store } = renderHost(link({ roomId: 2 }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(webClient.request.session.joinRoom).toHaveBeenCalledWith(2);
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(rooms.Actions.joinRoom({
        roomInfo: create(ServerInfo_RoomSchema, { roomId: 2, name: 'Side', gameList: [listedGame({ roomId: 2 })] }),
      }));
    });
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({ gameId: 7 }), expect.any(String));
  });

  it('reports a game that never appears in the room', () => {
    vi.useFakeTimers();
    try {
      const { webClient } = renderHost(link(), null);
      fireEvent.click(dialogButton('GameLink.yes'));
      act(() => {
        vi.advanceTimersByTime(GAME_LINK_WAIT_MS);
      });
      expect(within(screen.getByRole('dialog')).getByText('GameLink.notFound')).toBeInTheDocument();
      expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers to spectate a full game', () => {
    const { webClient } = renderHost(link(), listedGame({ playerCount: 2, maxPlayers: 2 }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(within(screen.getByRole('dialog')).getByText('GameLink.full')).toBeInTheDocument();
    expect(dialogButton('GameLink.no')).toHaveFocus();
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({ spectator: true }), expect.any(String));
  });

  it.each([
    ['moderator', ServerInfo_User_UserLevelFlag.IsModerator],
    ['admin', ServerInfo_User_UserLevelFlag.IsAdmin | ServerInfo_User_UserLevelFlag.IsModerator],
    ['judge', ServerInfo_User_UserLevelFlag.IsJudge],
  ])('joins a full game without prompting as %s', (_role, userLevel) => {
    const webClient = createMockWebClient() as unknown as WebClient;
    renderWithProviders(
      <>
        <GameLinkButton url={link()} />
        <GameLinkJoinHost endpoint={LIVE_SERVER} />
      </>,
      { preloadedState: stateWith(listedGame({ playerCount: 2, maxPlayers: 2 }), userLevel), webClient },
    );
    fireEvent.click(screen.getByRole('button', { name: /GameLink\.anchor/ }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(screen.queryByText('GameLink.full')).not.toBeInTheDocument();
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({
      spectator: true,
      overrideRestrictions: true,
    }), expect.any(String));
  });

  it('declining spectator confirmation clears the join and allows a fresh attempt', async () => {
    const { webClient } = renderHost(link(), listedGame({ playerCount: 2, maxPlayers: 2 }));
    fireEvent.click(dialogButton('GameLink.yes'));
    fireEvent.click(dialogButton('GameLink.no'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /GameLink\.anchor/ }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(dialogButton('GameLink.no')).toHaveFocus();
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledTimes(1);
  });

  it('asks for a spectator password only after accepting spectator confirmation', () => {
    const { webClient } = renderHost(link(), listedGame({
      playerCount: 2, maxPlayers: 2, withPassword: true, spectatorsNeedPassword: true,
    }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(screen.queryByLabelText('GameLink.password.description')).not.toBeInTheDocument();
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    fireEvent.click(dialogButton('GameLink.yes'));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('GameLink.password.description'), {
      target: { value: 'spectator-secret' },
    });
    fireEvent.click(dialogButton('GameLink.join'));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({
      spectator: true, password: 'spectator-secret', overrideRestrictions: false,
    }), expect.any(String));
  });

  it('asks for the password of a protected game', () => {
    const { webClient } = renderHost(link(), listedGame({ withPassword: true }));
    fireEvent.click(dialogButton('GameLink.yes'));
    const password = within(screen.getByRole('dialog')).getByLabelText('GameLink.password.description');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.change(password, { target: { value: 'hunter2' } });
    fireEvent.click(dialogButton('GameLink.join'));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({ password: 'hunter2' }), expect.any(String));
  });

  it('reports a rejected join off the room page, and dismissing it clears the error', () => {
    const { store, webClient } = renderHost(link());
    fireEvent.click(dialogButton('GameLink.yes'));
    const requestId = vi.mocked(webClient.request.rooms.joinGame).mock.lastCall?.[2];
    act(() => {
      store.dispatch(rooms.Actions.setJoinGameError({ code: 1, message: 'The game is full.', requestId }));
    });
    expect(within(screen.getByRole('dialog')).getByText('The game is full.')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button'));
    expect(rooms.Selectors.getJoinGameError(store.getState())).toBeNull();
  });

  it('translates a correlated server rejection with no raw message', () => {
    const { store, webClient } = renderHost(link());
    fireEvent.click(dialogButton('GameLink.yes'));
    const requestId = vi.mocked(webClient.request.rooms.joinGame).mock.lastCall?.[2];
    act(() => store.dispatch(rooms.Actions.setJoinGameError({
      code: Response_ResponseCode.RespGameFull, message: '', requestId,
    })));
    expect(within(screen.getByRole('dialog')).getByText('JoinGameError.full')).toBeInTheDocument();
  });

  it('cancelling the password prompt sends nothing', async () => {
    const { webClient } = renderHost(link(), listedGame({ withPassword: true }));
    fireEvent.click(dialogButton('GameLink.yes'));
    fireEvent.click(dialogButton('Common.action.cancel'));
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('explains a link for another server instead of joining', () => {
    const { webClient } = renderHost(link({ hostname: 'other.example' }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(within(screen.getByRole('dialog')).getByText('GameLink.otherServer')).toBeInTheDocument();
    expect(webClient.request.session.joinRoom).not.toHaveBeenCalled();
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
  });

  it('rejects a link for another port on the same hostname', () => {
    const { webClient } = renderHost(link({ port: '4748' }), listedGame({ withPassword: true }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(within(screen.getByRole('dialog')).getByText('GameLink.otherServer')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(webClient.request.session.joinRoom).not.toHaveBeenCalled();
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
  });

  it('asks for the desktop port when the live host has no desktop port mapping', () => {
    const webClient = createMockWebClient() as unknown as WebClient;
    renderWithProviders(
      <>
        <GameLinkButton url={link({ port: '4748' })} />
        <GameLinkJoinHost endpoint={{ hostname: 'localhost', port: '4748' }} />
      </>,
      { preloadedState: stateWith(listedGame()), webClient },
    );
    fireEvent.click(screen.getByRole('button', { name: /GameLink\.anchor/ }));
    fireEvent.click(dialogButton('GameLink.yes'));
    expect(within(screen.getByRole('dialog')).getByText('GameLink.desktopPortRequired')).toBeInTheDocument();
    expect(webClient.request.session.joinRoom).not.toHaveBeenCalled();
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
  });

  it('rejects an invalid link with desktop\'s message', () => {
    renderHost('cockatrice://joingame?hostname=h&port=x&roomid=1&gameid=7');
    expect(within(screen.getByRole('dialog')).getByText('GameLink.invalid.port')).toBeInTheDocument();
  });
});
