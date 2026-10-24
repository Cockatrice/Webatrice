import { act, fireEvent, waitFor } from '@testing-library/react';

import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { SessionScope } from '../../SessionScope';

import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';

import { renderWithProviders, createMockWebClient, disconnectedState } from '../../__test-utils__';

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
import { makeSettings, makeSettingsHook } from '../../hooks/__mocks__/useSettings';
import { makeHost, makeKnownHostsHook } from '../../feature-widgets/known-hosts/__mocks__/useKnownHosts';
import { autoLoginGate } from './useAutoLogin';
import { LoadingState } from '@app/hooks';
import { PREFERENCE_DEFAULTS, RouteEnum, type PreferenceKey } from '@app/types';
import Login from './Login';

const hoisted = vi.hoisted(() => ({
  mockWebClient: undefined as any,
  getSettings: vi.fn(),
  getKnownHosts: vi.fn(),
  useSettings: vi.fn(),
  usePreference: vi.fn(),
  useKnownHosts: vi.fn(),
}));

vi.mock('../../hooks/useSettings', () => ({
  useSettings: hoisted.useSettings,
  usePreference: hoisted.usePreference,
  getSettings: hoisted.getSettings,
}));
vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: () => null,
  useKnownHosts: hoisted.useKnownHosts,
  getKnownHosts: hoisted.getKnownHosts,
}));
vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return {
    ...actual,
    useWebClient: () => hoisted.mockWebClient,
    WebClientProvider: ({ children }: { children: any }) => children,
  };
});

beforeAll(() => {
  const client = createMockWebClient();
  (client.request.authentication as any).testConnection = vi.fn();
  hoisted.mockWebClient = client;
});

afterEach(async () => {
  await flushEffects();
});

beforeEach(() => {
  autoLoginGate.hasChecked = false;

  hoisted.getSettings.mockReset();
  hoisted.getKnownHosts.mockReset();
  hoisted.useSettings.mockReset();
  hoisted.useKnownHosts.mockReset();
  hoisted.usePreference.mockImplementation((key: PreferenceKey) => PREFERENCE_DEFAULTS[key]);

  const defaultHost = makeHost({
    id: 1,
    remember: true,
    userName: 'alice',
    hashedPassword: 'stored-hash',
    lastSelected: true,
  });

  hoisted.useSettings.mockReturnValue(
    makeSettingsHook({
      status: LoadingState.READY,
      value: makeSettings({ autoConnect: false }),
      update: vi.fn().mockResolvedValue(undefined),
    })
  );
  hoisted.useKnownHosts.mockReturnValue(
    makeKnownHostsHook({
      status: LoadingState.READY,
      value: { hosts: [defaultHost], selectedHost: defaultHost },
    })
  );
  hoisted.getSettings.mockResolvedValue(makeSettings({ autoConnect: false }));
  hoisted.getKnownHosts.mockResolvedValue({
    hosts: [defaultHost],
    selectedHost: defaultHost,
  });
});

const armAutoConnect = () => {
  const host = makeHost({
    id: 1,
    remember: true,
    userName: 'alice',
    hashedPassword: 'stored-hash',
    lastSelected: true,
  });
  hoisted.getSettings.mockResolvedValue(makeSettings({ autoConnect: true }));
  hoisted.getKnownHosts.mockResolvedValue({ hosts: [host], selectedHost: host });
};

describe('Login — debug log', () => {
  test('opens "View debug log" before signing in, as desktop\'s Help menu does', () => {
    const { getByRole, queryByRole } = renderWithProviders(<Login />, { preloadedState: disconnectedState });
    expect(queryByRole('dialog', { name: /DebugLogDialog\.title/ })).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /Login\.footer\.debugLog/ }));

    expect(getByRole('dialog', { name: /DebugLogDialog\.title/ })).toBeInTheDocument();
    expect(getByRole('textbox', { name: /DebugLogDialog\.logLabel/ })).toBeInTheDocument();
  });
});

describe('Login — auto-connect cold start', () => {
  test('fires login when settings + host say go', async () => {
    armAutoConnect();

    renderWithProviders(<Login />, { preloadedState: disconnectedState });

    await waitFor(() => {
      expect(hoisted.mockWebClient.request.authentication.login).toHaveBeenCalledTimes(1);
    });
    expect(hoisted.mockWebClient.request.authentication.login.mock.calls[0][0]).toMatchObject({
      userName: 'alice',
      hashedPassword: 'stored-hash',
    });
  });

  test('does not fire when autoConnect setting is off', async () => {
    renderWithProviders(<Login />, { preloadedState: disconnectedState });

    await flushEffects();
    expect(hoisted.mockWebClient.request.authentication.login).not.toHaveBeenCalled();
  });

  test('does not fire when selected host has no stored credentials', async () => {
    const host = makeHost({
      id: 1,
      remember: false,
      userName: undefined,
      hashedPassword: undefined,
      lastSelected: true,
    });
    hoisted.getSettings.mockResolvedValue(makeSettings({ autoConnect: true }));
    hoisted.getKnownHosts.mockResolvedValue({ hosts: [host], selectedHost: host });

    renderWithProviders(<Login />, { preloadedState: disconnectedState });

    await flushEffects();
    expect(hoisted.mockWebClient.request.authentication.login).not.toHaveBeenCalled();
  });
});

describe('Login — logout cycle (same JS session)', () => {
  test('does not re-auto-connect after first auto-login + logout', async () => {
    armAutoConnect();

    const first = renderWithProviders(<Login />, { preloadedState: disconnectedState });
    await waitFor(() => {
      expect(hoisted.mockWebClient.request.authentication.login).toHaveBeenCalledTimes(1);
    });

    first.unmount();
    renderWithProviders(<Login />, { preloadedState: disconnectedState });

    await flushEffects();

    expect(hoisted.mockWebClient.request.authentication.login).toHaveBeenCalledTimes(1);
  });

  test('does not auto-connect when user enabled autoConnect mid-session and then logged out', async () => {
    const first = renderWithProviders(<Login />, { preloadedState: disconnectedState });
    await flushEffects();
    expect(hoisted.mockWebClient.request.authentication.login).not.toHaveBeenCalled();

    first.unmount();

    hoisted.getSettings.mockResolvedValue(makeSettings({ autoConnect: true }));

    renderWithProviders(<Login />, { preloadedState: disconnectedState });
    await flushEffects();
    expect(hoisted.mockWebClient.request.authentication.login).not.toHaveBeenCalled();
  });

  test('submits with the restored host after a logout→remount without Required error', async () => {
    const first = renderWithProviders(<Login />, { preloadedState: disconnectedState });
    await flushEffects();
    first.unmount();

    // @critical preload testConnectionStatus='success' — submit stays disabled otherwise
    const { getByRole, queryByText } = renderWithProviders(<Login />, {
      preloadedState: {
        ...disconnectedState,
        server: { ...(disconnectedState.server as any), testConnectionStatus: 'success' },
      },
    });
    await flushEffects();

    fireEvent.click(getByRole('button', { name: /LoginForm\.label\.login/ }));
    await flushEffects();

    expect(queryByText(/required/i)).toBeNull();
    expect(hoisted.mockWebClient.request.authentication.login).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWebClient.request.authentication.login.mock.calls[0][0]).toMatchObject({
      userName: 'alice',
    });
  });
});

describe('Login — refresh cycle', () => {
  test('a fresh session gate re-fires auto-login when conditions still hold', async () => {
    armAutoConnect();

    renderWithProviders(<Login />, { preloadedState: disconnectedState });

    await waitFor(() => {
      expect(hoisted.mockWebClient.request.authentication.login).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Login — signed-out actions', () => {
  test('offers an offline entry point to the replay library', () => {
    const { getByRole } = renderWithProviders(<Login />, { preloadedState: disconnectedState });

    expect(getByRole('link', { name: 'Login.action.watchReplay' })).toHaveAttribute('href', RouteEnum.REPLAYS);
  });

  test('opens the registration dialog from the "Create an account" card, naming the selected server', () => {
    const { getByRole, queryByRole } = renderWithProviders(<Login />, { preloadedState: disconnectedState });
    const register = getByRole('button', { name: 'Login.action.register' });
    expect(register).toHaveAccessibleDescription('Login.action.registerOn');
    expect(queryByRole('dialog', { name: /RegistrationDialog\.title/ })).not.toBeInTheDocument();

    fireEvent.click(register);

    expect(getByRole('dialog', { name: /RegistrationDialog\.title/ })).toBeInTheDocument();
  });

  test('shows card art with its name, and shuffles to a different card', () => {
    const { container, getByRole } = renderWithProviders(<Login />, { preloadedState: disconnectedState });
    const firstSrc = container.querySelector('img[src*="art_crop"]')?.getAttribute('src');
    expect(firstSrc).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Login.art.shuffle' }));

    expect(container.querySelector('img[src*="art_crop"]')?.getAttribute('src')).not.toBe(firstSrc);
  });

  test('never requests remote art when "Card art on the sign-in screen" is off', () => {
    hoisted.useSettings.mockReturnValue(
      makeSettingsHook({ status: LoadingState.READY, value: makeSettings({ signInCardArt: false }) })
    );
    const { container, queryByRole } = renderWithProviders(<Login />, { preloadedState: disconnectedState });

    expect(container.querySelector('img[src*="scryfall"]')).toBeNull();
    expect(container.querySelector('.login-art-fallback')).not.toBeNull();
    expect(queryByRole('button', { name: 'Login.art.shuffle' })).toBeNull();
  });

  test('falls back to the bundled gradient when the art cannot load', () => {
    const { container, getByRole } = renderWithProviders(<Login />, { preloadedState: disconnectedState });
    fireEvent.error(container.querySelector('img[src*="art_crop"]')!);

    expect(container.querySelector('img[src*="art_crop"]')).toBeNull();
    expect(container.querySelector('.login-art-fallback')).not.toBeNull();
    expect(getByRole('button', { name: 'Login.art.shuffle' })).toBeEnabled();
  });
});

describe('Login — LOGIN_SUCCESSFUL → knownHosts persistence', () => {
  const armWithUpdate = () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const host = makeHost({
      id: 7,
      remember: true,
      userName: 'alice',
      hashedPassword: 'stored-hash',
      supportsHashedPassword: true,
      lastSelected: true,
    });
    hoisted.useSettings.mockReturnValue(
      makeSettingsHook({
        status: LoadingState.READY,
        value: makeSettings({ autoConnect: true }),
        update: vi.fn().mockResolvedValue(undefined),
      })
    );
    hoisted.useKnownHosts.mockReturnValue(
      makeKnownHostsHook({
        status: LoadingState.READY,
        value: { hosts: [host], selectedHost: host },
        update,
      })
    );
    hoisted.getSettings.mockResolvedValue(makeSettings({ autoConnect: true }));
    hoisted.getKnownHosts.mockResolvedValue({ hosts: [host], selectedHost: host });
    return { update, hostId: host.id! };
  };

  test('persists userName + hashedPassword when loginSuccessful carries a real hash', async () => {
    const { update, hostId } = armWithUpdate();

    const { store } = renderWithProviders(<Login />, {
      preloadedState: {
        ...disconnectedState,
        server: { ...(disconnectedState.server as any), testConnectionStatus: 'success' },
      },
    });
    await waitFor(() => {
      expect(hoisted.mockWebClient.request.authentication.login).toHaveBeenCalledTimes(1);
    });

    store.dispatch({
      type: 'server/loginSuccessful',
      payload: { options: { hashedPassword: 'real-hash-xyz' } },
    });
    await flushEffects();

    expect(update).toHaveBeenCalledWith(hostId, {
      remember: true,
      userName: 'alice',
      hashedPassword: 'real-hash-xyz',
    });
  });

  test('does not persist credentials when hashedPassword is empty (empty-salt fallback)', async () => {
    const { update, hostId } = armWithUpdate();

    const { store } = renderWithProviders(<Login />, {
      preloadedState: {
        ...disconnectedState,
        server: { ...(disconnectedState.server as any), testConnectionStatus: 'success' },
      },
    });
    await waitFor(() => {
      expect(hoisted.mockWebClient.request.authentication.login).toHaveBeenCalledTimes(1);
    });

    // Empty-salt fallback: response layer has no hash; guard in useLogin.updateHost
    // clears remember+credentials so a stale "checked" checkbox can't sit against a null hash.
    store.dispatch({
      type: 'server/loginSuccessful',
      payload: { options: { hashedPassword: undefined } },
    });
    await flushEffects();

    expect(update).toHaveBeenCalledWith(hostId, {
      remember: false,
      userName: null,
      hashedPassword: null,
    });
  });
});

describe('Login — password change required', () => {
  test('points the user to the password reset, since the server refuses the login until it is done', async () => {
    const { getByRole, findByText } = renderWithProviders(<Login />, {
      preloadedState: {
        ...disconnectedState,
        server: {
          ...(disconnectedState.server as any),
          connectionAttemptMade: true,
          loginFailureCode: Response_ResponseCode.RespPasswordChangeRequired,
        },
      },
    });
    await flushEffects();

    await findByText('Login.status.passwordChangeRequired');
    fireEvent.click(getByRole('button', { name: 'Login.status.passwordChangeRequiredAction' }));

    expect(await findByText('RequestPasswordResetDialog.title')).toBeTruthy();
  });

  test('shows no reset action for other login rejections', async () => {
    const { queryByRole } = renderWithProviders(<Login />, {
      preloadedState: {
        ...disconnectedState,
        server: {
          ...(disconnectedState.server as any),
          connectionAttemptMade: true,
          loginFailureCode: Response_ResponseCode.RespServerFull,
        },
      },
    });
    await flushEffects();

    expect(queryByRole('button', { name: 'Login.status.passwordChangeRequiredAction' })).toBeNull();
  });
});

test('keeps a connection-closed ban reason visible after DISCONNECTED and CLEAR_STORE', async () => {
  const { store, getByText } = renderWithProviders(<SessionScope><Login /></SessionScope>, {
    preloadedState: disconnectedState,
  });
  await flushEffects();
  act(() => {
    store.dispatch(server.Actions.updateStatus({
      status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: 'You are banned until tomorrow' },
    }));
  });
  expect(getByText('You are banned until tomorrow')).toBeVisible();
  act(() => {
    store.dispatch(server.Actions.disconnected());
    store.dispatch(server.Actions.clearStore());
  });
  expect(getByText('You are banned until tomorrow')).toBeVisible();
});
