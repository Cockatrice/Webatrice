import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  makeGameEntry,
  makeGameInfo,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';
import { games, server } from '@cockatrice/datatrice';
import type { WebClient } from '@cockatrice/sockatrice';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import {
  connectedWithRoomsState,
  createMockWebClient,
  makeStoreState,
  makeUser,
  renderWithProviders,
} from '../../../../__test-utils__';
import GameInviteControls from './GameInviteControls';

const liveServer = vi.hoisted(() => ({
  value: { hostname: 'localhost', port: '4748', desktopPort: '4747' } as {
    hostname: string;
    port: string;
    desktopPort?: string;
  } | null,
}));

vi.mock('@app/feature-widgets/known-hosts', () => ({
  useLiveServerEndpoint: () => liveServer.value,
}));

type RoCallback = (entries: { contentRect: { height: number; width: number }; target: Element }[]) => void;
let observers: { callback: RoCallback; targets: Set<Element> }[] = [];
let originalRo: typeof globalThis.ResizeObserver;

function mountRows(): void {
  const list = document.querySelector('.virtual-list__list');
  for (const handle of observers) {
    if (list && handle.targets.has(list)) {
      act(() => handle.callback([{ contentRect: { height: 300, width: 300 }, target: list }]));
    }
  }
}

function state({ onlyBuddies = false, description = 'Friday modern' } = {}) {
  return makeStoreState({
    ...connectedWithRoomsState,
    server: {
      ...connectedWithRoomsState.server,
      user: makeUser({ name: 'me' }),
      users: {
        me: makeUser({ name: 'me' }),
        alice: makeUser({ name: 'alice' }),
        bob: makeUser({ name: 'bob' }),
        spectator: makeUser({ name: 'spectator' }),
      },
      buddyList: { bob: makeUser({ name: 'bob' }) },
      ignoreList: {},
    },
    games: {
      games: {
        5: makeGameEntry({
          info: makeGameInfo({ gameId: 5, roomId: 3, description, onlyBuddies }),
          localPlayerId: 1,
          players: {
            1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'me' } }) }),
            2: makePlayerEntry({
              properties: makePlayerProperties({ playerId: 2, spectator: true, userInfo: { name: 'spectator' } }),
            }),
          },
        }),
      },
    },
  });
}

const LINK = 'cockatrice://joingame?hostname=localhost&port=4747&roomid=3&gameid=5&game=Friday%20modern';

function renderControls(options: Parameters<typeof state>[0] = {}) {
  const webClient = createMockWebClient() as unknown as WebClient;
  const utils = renderWithProviders(<GameInviteControls gameId={5} />, { preloadedState: state(options), webClient, gameId: 5 });
  return { ...utils, webClient };
}

describe('GameInviteControls (GAME-033)', () => {
  beforeEach(() => {
    liveServer.value = { hostname: 'localhost', port: '4748', desktopPort: '4747' };
    originalRo = globalThis.ResizeObserver;
    observers = [];
    globalThis.ResizeObserver = class {
      private handle = { callback: (() => undefined) as RoCallback, targets: new Set<Element>() };
      constructor(callback: RoCallback) {
        this.handle.callback = callback;
        observers.push(this.handle);
      }
      observe(target: Element) {
        this.handle.targets.add(target);
      }
      unobserve(target: Element) {
        this.handle.targets.delete(target);
      }
      disconnect() {
        this.handle.targets.clear();
      }
    } as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalRo;
  });

  it('Copy game link writes the desktop join link for this server to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'GameInvite.copyLink' }));
    expect(writeText).toHaveBeenCalledWith(LINK);
    await waitFor(() => expect(screen.getByText('GameInvite.linkCopied')).toBeInTheDocument());
  });

  it('is disabled until the client knows its server', () => {
    liveServer.value = null;
    renderControls();
    expect(screen.getByRole('button', { name: 'GameInvite.copyLink' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'GameInvite.inviteToGame' })).toBeDisabled();
  });

  it('is disabled when the live endpoint has no configured desktop port', () => {
    liveServer.value = { hostname: 'localhost', port: '4748' };
    renderControls();
    expect(screen.getByRole('button', { name: 'GameInvite.copyLink' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'GameInvite.inviteToGame' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'GameInvite.copyLink' })).toHaveAttribute(
      'title',
      'GameInvite.desktopPortRequired',
    );
    expect(screen.getByRole('button', { name: 'GameInvite.copyLink' })).toHaveAccessibleDescription(
      'GameInvite.desktopPortRequired',
    );
    expect(screen.getByText('GameInvite.desktopPortRequired')).toBeVisible();
  });

  it('is disabled once the game is closed (desktop disables Invite to Game for a closed game)', () => {
    const { store } = renderControls();
    act(() => {
      store.dispatch(games.Actions.gameClosed({ gameId: 5 }));
    });
    expect(screen.getByRole('button', { name: 'GameInvite.inviteToGame' })).toBeDisabled();
  });

  it('invites a listed user by private message carrying the link, as desktop does', () => {
    const { webClient } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'GameInvite.inviteToGame' }));
    mountRows();
    const list = screen.getByTestId('invite-user-list');
    expect(within(list).queryByText('me')).not.toBeInTheDocument();
    expect(within(list).queryByText('spectator')).not.toBeInTheDocument();

    const invite = screen.getByRole('button', { name: 'GameInvite.dialog.invite' });
    expect(invite).toBeDisabled();
    fireEvent.click(within(list).getByText('alice'));
    fireEvent.click(invite);

    expect(webClient.request.session.message).toHaveBeenCalledWith('alice', `GameInvite.messageWithDescription ${LINK}`);
    expect(screen.queryByTestId('invite-user-list')).not.toBeInTheDocument();
  });

  it('double-clicking a user invites them', () => {
    const { webClient } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'GameInvite.inviteToGame' }));
    mountRows();
    fireEvent.doubleClick(within(screen.getByTestId('invite-user-list')).getByText('bob'));
    expect(webClient.request.session.message).toHaveBeenCalledWith('bob', expect.stringContaining(LINK));
  });

  it('a buddies-only game lists buddies only', () => {
    renderControls({ onlyBuddies: true });
    fireEvent.click(screen.getByRole('button', { name: 'GameInvite.inviteToGame' }));
    mountRows();
    const list = screen.getByTestId('invite-user-list');
    expect(within(list).getByText('bob')).toBeInTheDocument();
    expect(within(list).queryByText('alice')).not.toBeInTheDocument();
  });

  it('uses the id-only prefix for a game without a description', () => {
    const { webClient } = renderControls({ description: '' });
    fireEvent.click(screen.getByRole('button', { name: 'GameInvite.inviteToGame' }));
    mountRows();
    fireEvent.doubleClick(within(screen.getByTestId('invite-user-list')).getByText('alice'));
    expect(webClient.request.session.message).toHaveBeenCalledWith(
      'alice',
      'GameInvite.message cockatrice://joingame?hostname=localhost&port=4747&roomid=3&gameid=5',
    );
  });

  function inviteAlice() {
    const utils = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'GameInvite.inviteToGame' }));
    mountRows();
    fireEvent.doubleClick(within(screen.getByTestId('invite-user-list')).getByText('alice'));
    return utils;
  }

  it('reports an invite the server rejects', async () => {
    const { store } = inviteAlice();
    act(() => {
      store.dispatch(server.Actions.privateMessageFailed({
        userName: 'alice',
        message: `GameInvite.messageWithDescription ${LINK}`,
        responseCode: Response_ResponseCode.RespInIgnoreList,
      }));
    });
    expect(await screen.findByText('GameInvite.inviteFailed.ignoring')).toBeInTheDocument();
  });

  it('reports an invite that was never answered with the transport reason', async () => {
    const { store } = inviteAlice();
    act(() => {
      store.dispatch(server.Actions.privateMessageFailed({
        userName: 'alice',
        message: `GameInvite.messageWithDescription ${LINK}`,
        responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.Timeout,
      }));
    });
    expect(await screen.findByText('GameInvite.inviteFailed.notSent')).toBeInTheDocument();
  });

  it('ignores a failed private message that was not an invite', () => {
    const { store } = inviteAlice();
    act(() => {
      store.dispatch(server.Actions.privateMessageFailed({
        userName: 'alice',
        message: 'hello',
        responseCode: Response_ResponseCode.RespInIgnoreList,
      }));
    });
    expect(screen.queryByText(/GameInvite\.inviteFailed/)).not.toBeInTheDocument();
  });
});
