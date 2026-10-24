import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { create } from '@bufbuild/protobuf';
import { rooms, server } from '@cockatrice/datatrice';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { makeGame } from '@cockatrice/datatrice/testing';
import { createMockWebClient, disconnectedState, makeUser, renderWithProviders } from './__test-utils__';
import { testI18n } from './__test-utils__/renderWithProviders';
import { makeSettings } from './hooks/__mocks__/useSettings';
import { makeHost } from './feature-widgets/known-hosts/__mocks__/useKnownHosts';
import { settingsStore } from './hooks/useSettings';
import * as settingsModule from './hooks/useSettings';
import { knownHostsStore } from './feature-widgets/known-hosts/useKnownHosts';
import * as hostsModule from './feature-widgets/known-hosts/useKnownHosts';
import { autoLoginGate } from './services/session/autoLoginGate';
import { homePreview, loadHomeSnapshot, saveHomeSnapshot, type HomeSnapshot } from './services/storage/homeSnapshot';
import BootSession from './BootSession';
import AppShellRoutes from './AppShellRoutes';
import reconnectingText from './features/server/ReconnectingHome.i18n.json';
import heroText from './features/server/components/HomeHero.i18n.json';
import roomsText from './features/server/RoomsList.i18n.json';
import buddiesText from './features/server/components/BuddiesOnline.i18n.json';
import gameText from './components/GameCard/GameCard.i18n.json';
import { observeHomeSession } from './BootSession';
import { useAccount } from './features/account/useAccount';
import { useNavRailController } from './feature-wrappers/layout/hooks/useNavRailController';

const cached: HomeSnapshot = {
  version: 1, host: 'test.example:4747', userName: 'joe', serverName: 'Test server',
  onlineCount: 12, gamesRunning: 3, rooms: [{ id: 1, name: 'Cached room', games: 3, people: 12 }],
  usualRoomId: 1, openGames: [{ id: 7, name: 'Cached game', players: 1, maxPlayers: 2 }], buddiesOnline: 2, buddyCount: 5,
};

const liveRoom = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Live room', autoJoin: true, gameCount: 0 });

beforeEach(async () => {
  await Promise.all([settingsStore.whenReady(), knownHostsStore.whenReady()]);
  Object.assign(autoLoginGate, { hasChecked: false, inFlight: false, target: null, source: null });
  homePreview.set(null);
  localStorage.clear();
  testI18n.addResourceBundle('en-US', 'translation', {
    ...reconnectingText, ...heroText, ...roomsText, ...buddiesText, ...gameText,
  }, true, true);
});

afterEach(() => {
  homePreview.set(null);
  localStorage.clear();
  autoLoginGate.inFlight = false;
});

function setup({ autoConnect = true, userName = 'joe', remember = true } = {}) {
  const settings = makeSettings({ autoConnect });
  const host = makeHost({ remember, userName, hashedPassword: 'hash', supportsHashedPassword: true });
  host.save = vi.fn().mockResolvedValue(undefined);
  const hosts = { hosts: [host], selectedHost: host };
  settingsStore.setValue(settings);
  knownHostsStore.setValue(hosts);
  vi.spyOn(settingsModule, 'getSettings').mockResolvedValue(settings);
  vi.spyOn(hostsModule, 'getKnownHosts').mockResolvedValue(hosts);
  const client = createMockWebClient();
  client.clientOptions = { autojoinrooms: true, keepalive: 5000 };
  return { settings, hosts, client, preparation: Promise.resolve<[typeof settings, typeof hosts]>([settings, hosts]) };
}

it('selects the snapshot before login, paints while disconnected, and replaces it with live Home', async () => {
  saveHomeSnapshot(cached);
  const { client, preparation } = setup();
  let selectedBeforeLogin = false;
  vi.mocked(client.request.authentication.login).mockImplementation(() => {
    selectedBeforeLogin = homePreview.get()?.userName === 'joe';
  });
  const { store } = renderWithProviders(
    <StrictMode><BootSession preparation={preparation}><AppShellRoutes /></BootSession></StrictMode>,
    { preloadedState: disconnectedState, route: '/server', webClient: client },
  );
  await waitFor(() => expect(client.request.authentication.login).toHaveBeenCalledTimes(1));
  expect(selectedBeforeLogin).toBe(true);
  expect(server.Selectors.getIsConnected(store.getState())).toBe(false);
  expect(screen.getByRole('heading', { name: 'Welcome back, joe' })).toBeVisible();
  expect(screen.getByText(/Reconnecting —/)).toBeVisible();
  expect(screen.getByText('2 of 5')).toBeVisible();
  expect(screen.getByText('3 games · 12 people')).toBeVisible();
  expect(screen.getByText('1 / 2 players')).toBeVisible();
  for (const button of screen.getAllByRole('button')) {
    expect(button).toBeDisabled();
  }
  expect(client.request.authentication.login).toHaveBeenCalledWith({
    host: 'test.example', port: '4747', userName: 'joe', password: '', hashedPassword: 'hash',
  });
  expect(client.request.authentication.testConnection).not.toHaveBeenCalled();
  act(() => {
    store.dispatch(server.Actions.updateUser({ user: makeUser({ name: 'joe' }) }));
    store.dispatch(server.Actions.loginSuccessful({ options: { hashedPassword: 'hash' } }));
  });
  expect(client.request.authentication.testConnection).not.toHaveBeenCalled();
  act(() => {
    store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: '' } }));
    store.dispatch(rooms.Actions.updateRooms({ rooms: [liveRoom] }));
    store.dispatch(server.Actions.updateUsers({ users: [makeUser({ name: 'joe' })] }));
  });
  expect(screen.getByText('Cached room')).toBeVisible();
  act(() => {
    store.dispatch(server.Actions.sessionCommandFailed({ command: 'reportDetails', responseCode: 13, target: '4' }));
  });
  expect(screen.getByText('Cached room')).toBeVisible();
  act(() => {
    store.dispatch(rooms.Actions.joinRoom({ roomInfo: liveRoom, userInitiated: false }));
  });
  await waitFor(() => expect(screen.queryByText('Cached room')).not.toBeInTheDocument());
  const roomsPanel = screen.getByRole('heading', { name: 'Rooms' }).closest('section')!;
  expect(within(roomsPanel).getByText('Live room')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open Live room' })).toBeEnabled();
  expect(client.request.authentication.login).toHaveBeenCalledTimes(1);
  expect(client.request.authentication.testConnection).not.toHaveBeenCalled();
});

it.each([{ userName: 'jane' }, { autoConnect: false }, { remember: false }])(
  'does not expose another account or a disabled snapshot: %j', async options => {
    saveHomeSnapshot(cached);
    const { client, preparation } = setup(options);
    renderWithProviders(<BootSession preparation={preparation}><AppShellRoutes /></BootSession>, {
      preloadedState: disconnectedState, route: '/server', webClient: client,
    });
    await waitFor(() => expect(screen.getByText('Login.header.headline')).toBeVisible());
    expect(screen.queryByText('Cached room')).not.toBeInTheDocument();
    if (options.autoConnect === false || options.remember === false) {
      expect(client.request.authentication.login).not.toHaveBeenCalled();
    }
    if (options.autoConnect === false) {
      expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
    }
  },
);

it('waits for saved settings and credentials before any connection', async () => {
  const { client, settings, hosts } = setup();
  let release!: (value: [typeof settings, typeof hosts]) => void;
  const preparation = new Promise<[typeof settings, typeof hosts]>(resolve => {
    release = resolve;
  });
  vi.mocked(settingsModule.getSettings).mockReturnValue(preparation.then(([loaded]) => loaded));
  vi.mocked(hostsModule.getKnownHosts).mockReturnValue(preparation.then(([, loaded]) => loaded));
  renderWithProviders(<BootSession preparation={preparation}><AppShellRoutes /></BootSession>, {
    preloadedState: disconnectedState, route: '/server', webClient: client,
  });
  expect(client.request.authentication.login).not.toHaveBeenCalled();
  expect(client.request.authentication.testConnection).not.toHaveBeenCalled();
  await act(async () => {
    release([settings, hosts]);
  });
  expect(client.request.authentication.login).toHaveBeenCalledTimes(1);
  expect(client.request.authentication.testConnection).not.toHaveBeenCalled();
});

it('keeps the shell and manual Login usable when boot preparation never resolves', async () => {
  const { client } = setup({ autoConnect: false });
  const preparation = new Promise<Awaited<ReturnType<typeof import('./BootSession').prepareBootSession>>>(() => {});
  const { store } = renderWithProviders(
    <BootSession preparation={preparation}><AppShellRoutes /></BootSession>,
    { preloadedState: disconnectedState, route: '/login', webClient: client },
  );
  expect(screen.getByText('Login.header.headline')).toBeVisible();
  expect(screen.getByRole('main')).toBeVisible();
  await waitFor(() => expect(client.request.authentication.testConnection).toHaveBeenCalledTimes(1));
  act(() => {
    store.dispatch(server.Actions.testConnectionSuccessful({ supportsHashedPassword: true }));
  });
  const signIn = screen.getByRole('button', { name: 'LoginForm.label.login' });
  expect(signIn).toBeEnabled();
  fireEvent.click(signIn);
  await waitFor(() => expect(client.request.authentication.login).toHaveBeenCalledTimes(1));
  expect(client.request.authentication.login).toHaveBeenCalledWith({
    host: 'test.example', port: '4747', userName: 'joe', password: '', hashedPassword: 'hash',
  });
});

it.each(['boot', 'page'] as const)('allows only the %s winner to log in and persist credentials', async winner => {
  saveHomeSnapshot(cached);
  const { client, settings, hosts, preparation: ready } = setup();
  let release!: (values: [typeof settings, typeof hosts]) => void;
  const deferred = new Promise<[typeof settings, typeof hosts]>(resolve => {
    release = resolve;
  });
  const preparation = winner === 'boot' ? ready : deferred;
  const { store } = renderWithProviders(
    <BootSession preparation={preparation}><AppShellRoutes /></BootSession>,
    { preloadedState: disconnectedState, route: '/login', webClient: client },
  );
  await waitFor(() => expect(client.request.authentication.login).toHaveBeenCalledTimes(1));
  expect(autoLoginGate.source).toBe(winner);
  expect(screen.getByText('Cached room')).toBeVisible();
  if (winner === 'page') {
    await act(async () => {
      release([settings, hosts]);
    });
  }
  expect(client.request.authentication.login).toHaveBeenCalledTimes(1);
  expect(client.request.authentication.testConnection).not.toHaveBeenCalled();
  await act(async () => {
    store.dispatch(server.Actions.updateUser({ user: makeUser({ name: 'joe' }) }));
    store.dispatch(server.Actions.loginSuccessful({ options: { hashedPassword: 'new hash' } }));
  });
  expect(hosts.selectedHost.save).toHaveBeenCalledTimes(1);
  expect(hosts.selectedHost).toMatchObject({ remember: true, userName: 'joe', hashedPassword: 'new hash' });
});

it.each(['disconnect', 'failure', 'disable', 'switch'])(
  'removes the visible snapshot on %s and clears persisted data where required', async event => {
    saveHomeSnapshot(cached);
    const { client, preparation, settings } = setup();
    const { store } = renderWithProviders(<BootSession preparation={preparation}><AppShellRoutes /></BootSession>, {
      preloadedState: disconnectedState, route: '/server', webClient: client,
    });
    await waitFor(() => expect(screen.getByText('Cached room')).toBeVisible());
    act(() => {
      if (event === 'disable') {
        settingsStore.setValue({ ...settings, autoConnect: false } as typeof settings);
      } else if (event === 'switch') {
        const host = makeHost({ userName: 'jane', remember: true, hashedPassword: 'other' });
        knownHostsStore.setValue({ hosts: [host], selectedHost: host });
      } else {
        store.dispatch(event === 'disconnect' ? server.Actions.disconnected() : server.Actions.loginFailed(undefined));
      }
    });
    expect(screen.queryByText('Cached room')).not.toBeInTheDocument();
    if (event === 'disable') {
      expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
    } else {
      expect(loadHomeSnapshot(cached.host, 'joe')).toEqual(cached);
    }
    if (event === 'failure' || event === 'disconnect') {
      await waitFor(() => expect(client.request.authentication.testConnection).toHaveBeenCalledTimes(1));
    }
  },
);

it('persists the current Home summary on pagehide outside Home, and clears it on sign-out', () => {
  const { client, settings } = setup();
  Object.defineProperty(client.socket, 'connectedEndpoint', { value: 'wss://test.example:4747/' });
  const { store } = renderWithProviders(<SignOutActions />, { preloadedState: disconnectedState, webClient: client });
  const stop = observeHomeSession(store, client);
  const buddy = makeUser({ name: 'buddy' });
  const game = makeGame({ gameId: 7, description: 'Fresh open game', playerCount: 1, maxPlayers: 2 });
  const room = create(ServerInfo_RoomSchema, { ...liveRoom, gameCount: 1, playerCount: 2, gameList: [game.info] });
  act(() => {
    store.dispatch(server.Actions.updateUser({ user: makeUser({ name: 'joe' }) }));
    store.dispatch(server.Actions.loginSuccessful({ options: {} }));
    store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: '' } }));
    store.dispatch(server.Actions.updateBuddyList({ buddyList: [buddy, makeUser({ name: 'offline' })] }));
    store.dispatch(rooms.Actions.updateRooms({ rooms: [room] }));
    store.dispatch(server.Actions.updateUsers({ users: [makeUser({ name: 'joe' }), buddy] }));
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
  act(() => {
    store.dispatch(rooms.Actions.joinRoom({ roomInfo: room, userInitiated: false }));
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(loadHomeSnapshot(cached.host, 'joe')).toMatchObject({
    rooms: [{ id: 1, name: 'Live room', games: 1, people: 2 }],
    openGames: [{ id: 7, name: 'Fresh open game', players: 1, maxPlayers: 2 }],
    buddiesOnline: 1, buddyCount: 2,
  });
  act(() => {
    screen.getByRole('button', { name: 'account sign out' }).click();
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
  act(() => {
    settingsStore.setValue({ ...settings, autoConnect: false } as typeof settings);
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
  act(() => {
    settingsStore.setValue(settings);
    store.dispatch(server.Actions.disconnected());
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
  stop();
});

it('never persists data under a selected account or host that differs from the live session', () => {
  const { client, hosts } = setup();
  const { store } = renderWithProviders(<div>another route</div>, { preloadedState: disconnectedState, webClient: client });
  const stop = observeHomeSession(store, client);
  act(() => {
    store.dispatch(server.Actions.updateUser({ user: makeUser({ name: 'jane' }) }));
    store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: '' } }));
    store.dispatch(rooms.Actions.updateRooms({ rooms: [] }));
    store.dispatch(server.Actions.updateUsers({ users: [] }));
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
  act(() => {
    store.dispatch(server.Actions.updateUser({ user: makeUser({ name: hosts.selectedHost.userName! }) }));
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(loadHomeSnapshot(cached.host, 'joe')).toBeNull();
  stop();
});

function SignOutActions() {
  const account = useAccount();
  const rail = useNavRailController();
  return <>
    <button onClick={account.handleDisconnect}>account sign out</button>
    <button onClick={rail.account.onSignOut}>rail sign out</button>
  </>;
}

it.each(['account sign out', 'rail sign out'])('clears the snapshot from %s', label => {
  saveHomeSnapshot(cached);
  const client = createMockWebClient();
  renderWithProviders(<SignOutActions />, { webClient: client });
  act(() => {
    screen.getByRole('button', { name: label }).click();
  });
  expect(loadHomeSnapshot(cached.host, cached.userName)).toBeNull();
  expect(client.request.authentication.disconnect).toHaveBeenCalledTimes(1);
});
