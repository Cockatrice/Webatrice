import { fireEvent } from '@testing-library/react';

import { renderWithProviders, createMockWebClient, disconnectedState } from '../../../../__test-utils__';
import { makeSettingsHook, makeSettings } from '../../../../hooks/__mocks__/useSettings';
import { makeKnownHostsHook, makeHost } from '../../../../feature-widgets/known-hosts/__mocks__/useKnownHosts';

const hoisted = vi.hoisted(() => ({
  mockWebClient: undefined as any,
  mockUseSettings: vi.fn(),
  mockUseKnownHosts: vi.fn(),
}));

vi.mock('@app/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/hooks')>();
  return {
    ...actual,
    useSettings: hoisted.mockUseSettings,
  };
});
vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

// @critical Stub KnownHosts; its effect would clobber preloaded testConnectionStatus
vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: () => null,
  useKnownHosts: hoisted.mockUseKnownHosts,
}));

import LoginForm from './LoginForm';
import { LoadingState } from '@app/hooks';

beforeAll(() => {
  const client = createMockWebClient();
  (client.request.authentication as any).testConnection = vi.fn();
  hoisted.mockWebClient = client;
});

describe('LoginForm — regression: settings.autoConnect is not clobbered by host state', () => {
  test('selecting a hashed-capable host with remember=false does NOT call settings.update', () => {
    const update = vi.fn().mockResolvedValue(undefined);

    hoisted.mockUseSettings.mockReturnValue(
      makeSettingsHook({
        status: LoadingState.READY,
        value: makeSettings({ autoConnect: true }),
        update,
      })
    );

    const host = makeHost({
      id: 1,
      remember: false,
      userName: undefined,
      hashedPassword: undefined,
      supportsHashedPassword: true,
      lastSelected: true,
    });
    hoisted.mockUseKnownHosts.mockReturnValue(
      makeKnownHostsHook({
        status: LoadingState.READY,
        value: { hosts: [host], selectedHost: host },
      })
    );

    renderWithProviders(
      <LoginForm onSubmit={vi.fn()} disableSubmitButton={false} onResetPassword={vi.fn()} />,
      { preloadedState: disconnectedState }
    );

    expect(update).not.toHaveBeenCalled();
  });

  test('auto-login never fires from the form; that is now the container concern', () => {
    const onSubmit = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);

    hoisted.mockUseSettings.mockReturnValue(
      makeSettingsHook({
        status: LoadingState.READY,
        value: makeSettings({ autoConnect: true }),
        update,
      })
    );

    const host = makeHost({
      id: 1,
      remember: true,
      userName: 'joe',
      hashedPassword: 'abc',
      supportsHashedPassword: true,
      lastSelected: true,
    });
    hoisted.mockUseKnownHosts.mockReturnValue(
      makeKnownHostsHook({
        status: LoadingState.READY,
        value: { hosts: [host], selectedHost: host },
      })
    );

    renderWithProviders(
      <LoginForm onSubmit={onSubmit} disableSubmitButton={false} onResetPassword={vi.fn()} />,
      { preloadedState: disconnectedState }
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LoginForm — hashed-password gating', () => {
  const testedState = {
    ...disconnectedState,
    server: { ...(disconnectedState.server as any), testConnectionStatus: 'success' as const },
  };

  const renderWith = (host: ReturnType<typeof makeHost>) => {
    hoisted.mockUseSettings.mockReturnValue(
      makeSettingsHook({
        status: LoadingState.READY,
        value: makeSettings({ autoConnect: false }),
        update: vi.fn().mockResolvedValue(undefined),
      })
    );
    hoisted.mockUseKnownHosts.mockReturnValue(
      makeKnownHostsHook({
        status: LoadingState.READY,
        value: { hosts: [host], selectedHost: host },
      })
    );
    return renderWithProviders(
      <LoginForm onSubmit={vi.fn()} disableSubmitButton={false} onResetPassword={vi.fn()} />,
      { preloadedState: testedState }
    );
  };

  const hasRemember = (root: HTMLElement) => Boolean(root.querySelector('input[name="remember"]'));
  const hasAutoConnect = (root: HTMLElement) =>
    Boolean(root.querySelector('input[name="autoConnect"]'));

  test('hides Remember + Auto Connect when the host does not support hashed passwords', () => {
    const { container } = renderWith(
      makeHost({ id: 1, supportsHashedPassword: false, lastSelected: true })
    );
    expect(hasRemember(container)).toBe(false);
    expect(hasAutoConnect(container)).toBe(false);
  });

  test('hides Remember + Auto Connect when the host has never been test-connected', () => {
    const { container } = renderWith(
      makeHost({ id: 1, supportsHashedPassword: undefined, lastSelected: true })
    );
    expect(hasRemember(container)).toBe(false);
    expect(hasAutoConnect(container)).toBe(false);
  });

  test('shows Remember + Auto Connect when the host supports hashed passwords', () => {
    const { container } = renderWith(
      makeHost({ id: 1, supportsHashedPassword: true, lastSelected: true })
    );
    expect(hasRemember(container)).toBe(true);
    expect(hasAutoConnect(container)).toBe(true);
  });

  test('clears settings.autoConnect when selecting a naked-password host with it previously on', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    hoisted.mockUseSettings.mockReturnValue(
      makeSettingsHook({
        status: LoadingState.READY,
        value: makeSettings({ autoConnect: true }),
        update,
      })
    );
    const host = makeHost({
      id: 1,
      supportsHashedPassword: false,
      remember: true,
      lastSelected: true,
    });
    hoisted.mockUseKnownHosts.mockReturnValue(
      makeKnownHostsHook({
        status: LoadingState.READY,
        value: { hosts: [host], selectedHost: host },
      })
    );
    renderWithProviders(
      <LoginForm onSubmit={vi.fn()} disableSubmitButton={false} onResetPassword={vi.fn()} />,
      { preloadedState: disconnectedState }
    );
    expect(update).toHaveBeenCalledWith({ autoConnect: false });
  });
  test('persists settings.autoConnect when the user ticks Auto Connect', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    hoisted.mockUseSettings.mockReturnValue(
      makeSettingsHook({
        status: LoadingState.READY,
        value: makeSettings({ autoConnect: false }),
        update,
      })
    );
    const host = makeHost({ id: 1, supportsHashedPassword: true, lastSelected: true });
    hoisted.mockUseKnownHosts.mockReturnValue(
      makeKnownHostsHook({
        status: LoadingState.READY,
        value: { hosts: [host], selectedHost: host },
      })
    );
    const { container } = renderWithProviders(
      <LoginForm onSubmit={vi.fn()} disableSubmitButton={false} onResetPassword={vi.fn()} />,
      { preloadedState: testedState }
    );

    fireEvent.click(container.querySelector('input[name="autoConnect"]')!);

    expect(update).toHaveBeenCalledWith({ autoConnect: true });
    expect(container.querySelector<HTMLInputElement>('input[name="remember"]')!.checked).toBe(true);
  });
});

describe('LoginForm — state-aware sign-in button', () => {
  const host = makeHost({ id: 1, supportsHashedPassword: true, lastSelected: true });

  const renderIn = (
    server: Record<string, unknown>,
    props: Partial<{ disableSubmitButton: boolean; failed: boolean }> = {},
  ) => {
    hoisted.mockUseSettings.mockReturnValue(
      makeSettingsHook({ status: LoadingState.READY, value: makeSettings({ autoConnect: false }) })
    );
    hoisted.mockUseKnownHosts.mockReturnValue(
      makeKnownHostsHook({ status: LoadingState.READY, value: { hosts: [host], selectedHost: host } })
    );
    return renderWithProviders(
      <LoginForm
        onSubmit={vi.fn()}
        onResetPassword={vi.fn()}
        disableSubmitButton={props.disableSubmitButton ?? false}
        failed={props.failed}
      />,
      { preloadedState: { ...disconnectedState, server: { ...(disconnectedState.server as any), ...server } } }
    );
  };

  test('names the server test while it runs and blocks sign-in', () => {
    const { getByRole } = renderIn({ testConnectionStatus: 'testing' });
    expect(getByRole('button', { name: 'LoginForm.phase.testing' })).toBeDisabled();
    expect(getByRole('list', { name: 'LoginForm.steps.label' })).toHaveTextContent('LoginForm.steps.serverTesting');
  });

  test('says the server is not reachable when the test fails', () => {
    const { getByRole } = renderIn({ testConnectionStatus: 'failed' });
    expect(getByRole('button', { name: 'LoginForm.phase.unreachable' })).toBeDisabled();
    expect(getByRole('list', { name: 'LoginForm.steps.label' })).toHaveTextContent('LoginForm.steps.serverUnreachable');
  });

  test('offers "Sign in and play" once the server is reachable', () => {
    const { getByRole } = renderIn({ testConnectionStatus: 'success' });
    expect(getByRole('button', { name: 'LoginForm.label.login' })).toBeEnabled();
  });

  test('shows the connecting step after submit', () => {
    const { getByRole } = renderIn({ testConnectionStatus: 'success' }, { disableSubmitButton: true });
    expect(getByRole('button', { name: 'LoginForm.phase.connecting' })).toBeDisabled();
    const current = getByRole('list', { name: 'LoginForm.steps.label' }).querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent('LoginForm.steps.signingIn');
  });

  test('marks the sign-in step failed after a rejected attempt', () => {
    const { getByRole } = renderIn({ testConnectionStatus: 'success' }, { failed: true });
    expect(getByRole('list', { name: 'LoginForm.steps.label' })).toHaveTextContent('LoginForm.steps.signInFailed');
    expect(getByRole('button', { name: 'LoginForm.label.login' })).toBeEnabled();
  });

  test('reveals and hides the password on request', () => {
    const { getByLabelText, getByRole } = renderIn({ testConnectionStatus: 'success' });
    const password = getByLabelText('Common.label.password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(getByRole('button', { name: 'LoginForm.label.showPassword' }));
    expect(password).toHaveAttribute('type', 'text');

    fireEvent.click(getByRole('button', { name: 'LoginForm.label.hidePassword' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
