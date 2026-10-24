import type { ReactNode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { PREFERENCE_DEFAULTS, RouteEnum, StartupTab, type PreferenceKey, type Preferences } from '@app/types';

const hoisted = vi.hoisted(() => ({
  preferences: {} as Partial<Preferences>,
  useKnownHosts: vi.fn(),
}));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/hooks')>()),
  usePreference: (key: PreferenceKey) => hoisted.preferences[key] ?? PREFERENCE_DEFAULTS[key],
}));
vi.mock('@app/feature-widgets/known-hosts', () => ({ useKnownHosts: hoisted.useKnownHosts }));

import { makeHost, makeKnownHostsHook } from '../../feature-widgets/known-hosts/__mocks__/useKnownHosts';
import { detectPageReload, pageLoadLoginGate, resolveStartupDestination, useStartupDestination } from './startupDestination';

const prefs = (overrides: Partial<Preferences> = {}) => ({
  startupTab: PREFERENCE_DEFAULTS.startupTab,
  startupServer: '',
  startupRoom: '',
  ...overrides,
});

describe('detectPageReload', () => {
  const memoryStorage = () => {
    const items = new Map<string, string>();
    return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
  };

  it('treats a fresh tab as a launch and an explicit reload as a reload', () => {
    const tab = memoryStorage();

    expect(detectPageReload(tab, 'navigate')).toBe(false);
    expect(detectPageReload(tab, 'reload')).toBe(true);
  });

  it('treats a same-tab relaunch as a launch despite the session marker', () => {
    const tab = memoryStorage();
    detectPageReload(tab, 'navigate');

    expect(detectPageReload(tab, 'navigate')).toBe(false);
  });

  it('uses the session marker only when the navigation entry is missing', () => {
    const tab = memoryStorage();

    expect(detectPageReload(tab, undefined)).toBe(false);
    expect(detectPageReload(tab, undefined)).toBe(true);
  });

  it('treats a new tab as a launch', () => {
    detectPageReload(memoryStorage(), 'navigate');

    expect(detectPageReload(memoryStorage(), 'navigate')).toBe(false);
  });

  it('falls back to the navigation type without storage', () => {
    expect(detectPageReload(undefined, 'reload')).toBe(true);
    expect(detectPageReload(undefined, 'navigate')).toBe(false);
  });

  it('falls back to the navigation type when storage throws', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };

    expect(detectPageReload(blocked, 'reload')).toBe(true);
    expect(detectPageReload(blocked, 'navigate')).toBe(false);
  });
});

describe('resolveStartupDestination', () => {
  it('returns any other login to the page it was sent away from', () => {
    expect(resolveStartupDestination(prefs({ startupTab: StartupTab.Replays }), 'a:1', '/decks', false))
      .toEqual({ to: '/decks' });
  });

  it('returns any other login with nowhere to return to to the lobby', () => {
    expect(resolveStartupDestination(prefs({ startupTab: StartupTab.Replays }), 'a:1', undefined, false))
      .toEqual({ to: RouteEnum.SERVER });
  });

  it('opens the startup tab whatever page the last session was on', () => {
    expect(resolveStartupDestination(prefs({ startupTab: StartupTab.Replays }), 'a:1', '/decks', true))
      .toEqual({ to: RouteEnum.REPLAYS });
  });

  it('opens the lobby by default, as Webatrice always has', () => {
    expect(resolveStartupDestination(prefs(), 'a:1', undefined, true)).toEqual({ to: RouteEnum.SERVER });
  });

  it.each([
    [StartupTab.DeckStorage, RouteEnum.DECKS],
    [StartupTab.Replays, RouteEnum.REPLAYS],
    [StartupTab.Server, RouteEnum.SERVER],
  ])('opens the %s startup tab', (startupTab, to) => {
    expect(resolveStartupDestination(prefs({ startupTab }), 'a:1', undefined, true)).toEqual({ to });
  });

  it('hands the startup room to the lobby on any server when none is chosen', () => {
    const preferences = prefs({ startupTab: StartupTab.ServerRoom, startupRoom: 'Magic' });
    expect(resolveStartupDestination(preferences, 'a:1', undefined, true))
      .toEqual({ to: RouteEnum.SERVER, state: { startupRoom: 'Magic' } });
  });

  it('hands the startup room to the lobby on the startup server', () => {
    const preferences = prefs({ startupTab: StartupTab.ServerRoom, startupServer: 'a:1', startupRoom: 'Magic' });
    expect(resolveStartupDestination(preferences, 'a:1', undefined, true))
      .toEqual({ to: RouteEnum.SERVER, state: { startupRoom: 'Magic' } });
  });

  it('opens the lobby of any other server', () => {
    const preferences = prefs({ startupTab: StartupTab.ServerRoom, startupServer: 'a:1', startupRoom: 'Magic' });
    expect(resolveStartupDestination(preferences, 'b:2', undefined, true)).toEqual({ to: RouteEnum.SERVER });
  });

  it('opens the lobby when no room is named', () => {
    expect(resolveStartupDestination(prefs({ startupTab: StartupTab.ServerRoom }), 'a:1', undefined, true))
      .toEqual({ to: RouteEnum.SERVER });
  });
});

function LoginPage({ connected }: { connected: boolean }) {
  const destination = useStartupDestination(connected);
  return connected ? <Navigate to={destination.to} state={destination.state} /> : <div>login-page</div>;
}

function Landing() {
  const location = useLocation();
  return <div>{`at ${location.pathname} ${JSON.stringify(location.state)}`}</div>;
}

function renderLogin(connected: boolean, from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: RouteEnum.LOGIN, state: from ? { from } : null }]}>
      <Routes>
        <Route path={RouteEnum.LOGIN} element={<LoginPage connected={connected} />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </MemoryRouter>,
  );
}

function loginRouteWrapper(from?: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[{ pathname: RouteEnum.LOGIN, state: from ? { from } : null }]}>
      {children}
    </MemoryRouter>
  );
}

describe('useStartupDestination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pageLoadLoginGate.done = false;
    pageLoadLoginGate.reload = false;
    hoisted.preferences = {};
    const host = makeHost({ host: 'a', port: '1' });
    hoisted.useKnownHosts.mockReturnValue(makeKnownHostsHook({ value: { hosts: [host], selectedHost: host } }));
  });

  it('opens the startup tab on a cold start, whatever page the last session was on', () => {
    hoisted.preferences = { startupTab: StartupTab.Replays };

    renderLogin(true, '/decks');

    expect(screen.getByText('at /replays null')).toBeInTheDocument();
    expect(pageLoadLoginGate.done).toBe(true);
  });

  it('opens the startup tab on a cold start with no last route', () => {
    hoisted.preferences = { startupTab: StartupTab.DeckStorage };

    renderLogin(true);

    expect(screen.getByText('at /decks null')).toBeInTheDocument();
  });

  it('opens the startup tab on a same-tab relaunch with a session marker', () => {
    hoisted.preferences = { startupTab: StartupTab.Replays };
    const tab = { getItem: () => '1', setItem: () => undefined };
    pageLoadLoginGate.reload = detectPageReload(tab, 'navigate');

    renderLogin(true, '/decks');

    expect(screen.getByText('at /replays null')).toBeInTheDocument();
  });

  it('returns the login a reload starts with to the page the user was on', () => {
    hoisted.preferences = { startupTab: StartupTab.Replays };
    pageLoadLoginGate.reload = true;

    renderLogin(true, '/decks');

    expect(screen.getByText('at /decks null')).toBeInTheDocument();
  });

  it('returns a reconnect to the page the connection dropped on', () => {
    hoisted.preferences = { startupTab: StartupTab.Replays };
    pageLoadLoginGate.done = true;

    renderLogin(true, '/room/1');

    expect(screen.getByText('at /room/1 null')).toBeInTheDocument();
  });

  it('returns a second login of the page load to the lobby when there is no page to return to', () => {
    hoisted.preferences = { startupTab: StartupTab.Replays };
    pageLoadLoginGate.done = true;

    renderLogin(true);

    expect(screen.getByText('at /server null')).toBeInTheDocument();
  });

  it('matches the startup server against the host being signed in to', () => {
    hoisted.preferences = { startupTab: StartupTab.ServerRoom, startupServer: 'a:1', startupRoom: 'Magic' };

    renderLogin(true);

    expect(screen.getByText('at /server {"startupRoom":"Magic"}')).toBeInTheDocument();
  });

  it('keeps the page-load login pending while the login page waits', () => {
    act(() => {
      renderLogin(false, '/decks');
    });

    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(pageLoadLoginGate.done).toBe(false);
  });

  it.each([
    ['a cold start', false, { to: RouteEnum.REPLAYS }],
    ['a reload', true, { to: '/decks' }],
  ])('keeps the destination of %s while the login page re-renders', (_, reload, expected) => {
    hoisted.preferences = { startupTab: StartupTab.Replays };
    pageLoadLoginGate.reload = reload;
    const { result, rerender } = renderHook(({ connected }) => useStartupDestination(connected), {
      initialProps: { connected: false },
      wrapper: loginRouteWrapper('/decks'),
    });

    rerender({ connected: true });
    expect(result.current).toEqual(expected);

    expect(pageLoadLoginGate.done).toBe(true);
    rerender({ connected: true });
    expect(result.current).toEqual(expected);
  });
});
