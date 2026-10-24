import { act, fireEvent, screen, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { makeGame, makeGameEntry, makeGameInfo } from '@cockatrice/datatrice/testing';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';

import { connectedState, makeUser, renderWithProviders } from '../../__test-utils__';
import { dispatchChatDock, getChatDockState } from '../../hooks/useChatDock';
import { getSettings, settingsStore } from '../../hooks/useSettings';
import People from './People';

const liveServer = vi.hoisted(() => ({ value: { hostname: 'localhost', port: '4748', desktopPort: '4747' } }));
vi.mock('@app/feature-widgets/known-hosts', () => ({ useLiveServerEndpoint: () => liveServer.value }));

type RoCallback = (entries: { contentRect: { height: number; width: number }; target: Element }[]) => void;
let observers: { callback: RoCallback; targets: Set<Element> }[] = [];
let originalRo: typeof globalThis.ResizeObserver;

function mountRows() {
  for (const list of document.querySelectorAll('.virtual-list__list')) {
    for (const handle of observers) {
      if (handle.targets.has(list)) {
        act(() => handle.callback([{ contentRect: { height: 360, width: 800 }, target: list }]));
      }
    }
  }
}

const user = (name: string) => makeUser({ name, userLevel: 3 });
const loaded = { state: 'loaded' as const };

function state({ myGame = false } = {}) {
  return {
    ...connectedState,
    server: {
      ...connectedState.server!,
      user: user('me'),
      users: { me: user('me'), kira: user('kira'), tomo: user('tomo'), mei: user('mei'), zed: user('zed'), Bob: user('Bob') },
      buddyList: { kira: user('kira'), tomo: user('tomo'), mei: user('mei'), carol: user('carol'), anna: user('anna') },
      ignoreList: { troll: user('troll') },
      gamesOfUser: {
        kira: { 3: makeGame({
          gameId: 3, roomId: 1, description: 'Modern', started: true, playerCount: 2, maxPlayers: 2, spectatorsAllowed: true,
          startTime: Math.floor(Date.now() / 1000) - 600 }) },
        tomo: { 5: makeGame({ gameId: 5, roomId: 2, description: 'Pod', playerCount: 3, maxPlayers: 4, creatorInfo: user('tomo') }) },
        mei: {},
      },
      gamesOfUserRoomNames: { kira: { 1: 'General' }, tomo: { 2: 'Side' }, mei: {} },
      gamesOfUserStatus: { kira: loaded, tomo: loaded, mei: loaded },
    },
    rooms: {
      ...connectedState.rooms!,
      rooms: {
        1: { info: create(ServerInfo_RoomSchema, { roomId: 1, name: 'General' }), gametypeMap: {}, order: 0, games: {}, users: {} },
      },
      joinedRoomIds: { 1: true },
    },
    games: {
      ...connectedState.games!,
      games: myGame
        ? {
          9: makeGameEntry({
            info: makeGameInfo({ gameId: 9, roomId: 1, description: 'Mine', maxPlayers: 2 }), hostId: 1, localPlayerId: 1,
          }),
        }
        : {},
    },
  };
}

const renderPeople = (options: Parameters<typeof state>[0] = {}) =>
  renderWithProviders(<People />, { preloadedState: state(options) as never });

const nameOf = (item: HTMLElement) => within(item).getAllByRole('link')[0].textContent;
const card = (name: string) => screen.getAllByRole('listitem').find((item) => nameOf(item) === name)!;

describe('People', () => {
  beforeEach(async () => {
    settingsStore.reset();
    await getSettings();
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
    act(() => dispatchChatDock({ type: 'reset' }));
  });

  it('shows online buddies A-Z with what they are doing and the matching action', () => {
    renderPeople();
    const online = screen.getByRole('region', { name: /People\.online\.title/ });
    const items = within(online).getAllByRole('listitem');
    expect(items.map(nameOf)).toEqual(['kira', 'mei', 'tomo']);
    expect(within(items[0]).getByText('People.activity.playing')).toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: 'People.action.watchLabel' })).toBeEnabled();
    expect(within(items[2]).getByText('People.activity.hosting')).toBeInTheDocument();
    expect(within(items[1]).getByText('People.activity.idle')).toBeInTheDocument();
    expect(within(items[1]).queryByRole('button', { name: 'People.action.inviteLabel' })).toBeNull();
  });

  it('watches a buddy\'s game in a joined room, and joins the room first for one elsewhere', () => {
    const { webClient } = renderPeople();
    fireEvent.click(within(card('kira')).getByRole('button', { name: 'People.action.watchLabel' }));
    expect(webClient.request.rooms.joinGame)
      .toHaveBeenCalledWith(1, expect.objectContaining({ gameId: 3, spectator: true }), expect.any(String));
    fireEvent.click(within(card('tomo')).getByRole('button', { name: 'People.action.joinLabel' }));
    expect(webClient.request.session.joinRoom).toHaveBeenCalledWith(2);
  });

  it('opens a chat from a buddy card', () => {
    renderPeople();
    fireEvent.click(within(card('mei')).getByRole('button', { name: 'People.action.messageLabel' }));
    expect(getChatDockState().chats).toEqual([{ name: 'mei', expanded: true }]);
  });

  it('invites an idle buddy to the game you are waiting in', () => {
    const { webClient } = renderPeople({ myGame: true });
    expect(screen.getByText('People.myGame.hosting')).toBeInTheDocument();
    fireEvent.click(within(card('mei')).getByRole('button', { name: 'People.action.inviteLabel' }));
    expect(webClient.request.session.message).toHaveBeenCalledWith('mei', expect.stringContaining('cockatrice://joingame'));
  });

  it('keeps offline buddies and everyone else collapsed until asked, then lists them', () => {
    const { webClient } = renderPeople();
    const offline = screen.getByRole('button', { name: /People\.offline\.title/ });
    expect(offline).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'People.offline.title' })).toBeNull();
    fireEvent.click(offline);
    mountRows();
    const offlineList = screen.getByRole('list', { name: 'People.offline.title' });
    expect(within(offlineList).getAllByRole('listitem').map(nameOf)).toEqual(['anna', 'carol']);

    fireEvent.click(screen.getByRole('button', { name: /People\.others\.title/ }));
    mountRows();
    const others = screen.getByRole('list', { name: 'People.others.title' });
    expect(within(others).getAllByRole('listitem').map(nameOf)).toEqual(['Bob', 'zed']);
    fireEvent.click(within(others).getAllByRole('button', { name: 'People.action.addBuddy' })[1]);
    expect(webClient.request.session.addToBuddyList).toHaveBeenCalledWith('zed');
  });

  it('searches every group, opening the collapsed ones, and adds the typed name as a buddy', () => {
    const { webClient } = renderPeople();
    const search = screen.getByRole('searchbox', { name: 'People.search.label' });
    const add = screen.getByRole('button', { name: 'People.add.buddy' });
    expect(add).toBeDisabled();
    fireEvent.change(search, { target: { value: 'kira' } });
    expect(add).toBeDisabled();
    fireEvent.change(search, { target: { value: 'z' } });
    expect(screen.queryByRole('region', { name: /People\.online\.title/ })).toBeNull();
    expect(screen.getByRole('button', { name: /People\.others\.title/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(search, { target: { value: ' dave ' } });
    expect(screen.getByText('People.search.noMatches')).toBeInTheDocument();
    fireEvent.click(add);
    expect(webClient.request.session.addToBuddyList).toHaveBeenCalledWith('dave');
    expect(search).toHaveValue('');
  });

  it('tucks the ignore list away behind a collapsed toggle', () => {
    const { webClient } = renderPeople();
    const toggle = screen.getByRole('button', { name: /People\.ignored\.title/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('troll')).toBeNull();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'People.action.unignore' }));
    expect(webClient.request.session.removeFromIgnoreList).toHaveBeenCalledWith('troll');
    fireEvent.change(screen.getByRole('textbox', { name: 'People.add.ignoreLabel' }), { target: { value: 'eve' } });
    fireEvent.click(screen.getByRole('button', { name: 'People.add.ignore' }));
    expect(webClient.request.session.addToIgnoreList).toHaveBeenCalledWith('eve');
  });
});
