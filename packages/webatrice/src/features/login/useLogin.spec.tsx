import { ReactNode } from 'react';
import { act, renderHook, screen } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { createStore, server } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';

import { rootReducerMap, type RootState } from '../../store';
import {
  connectedState,
  createMockWebClient,
  disconnectedState,
} from '../../__test-utils__';
import { ToastProvider } from '../../components/Toast/ToastContext';
import { makeKnownHostsHook, makeHost } from '../../feature-widgets/known-hosts/__mocks__/useKnownHosts';

vi.mock('./useAutoLogin', () => ({ useAutoLogin: vi.fn() }));
vi.mock('../../feature-widgets/known-hosts/useKnownHosts');
vi.mock('react-i18next', async (orig) => {
  const actual = await orig<typeof import('react-i18next')>();
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) };
});

import { useKnownHosts } from '../../feature-widgets/known-hosts/useKnownHosts';
import { useLogin } from './useLogin';
import { loginAttempt } from './loginAttempt';

const reducer = combineReducers(rootReducerMap);

function setup(preloadedState: Partial<RootState>) {
  const hostsUpdate = vi.fn();
  vi.mocked(useKnownHosts).mockReturnValue(
    makeKnownHostsHook({ update: hostsUpdate }),
  );
  const webClient = createMockWebClient();
  const store = createStore<RootState>({
    reducer: reducer as never,
    preloadedState: preloadedState as never,
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <ToastProvider>{children}</ToastProvider>
        </WebClientContext>
      </Provider>
    );
  }
  const { result, rerender } = renderHook(() => useLogin(), { wrapper: Wrapper });
  return { result, rerender, webClient, store, hostsUpdate };
}

const makeLoginValues = (overrides: any = {}) => ({
  userName: 'user',
  password: 'pw',
  remember: false,
  selectedHost: makeHost({ host: 'h.example', port: '1' } as any),
  ...overrides,
});

describe('useLogin', () => {
  beforeEach(() => {
    loginAttempt.reset();
  });

  describe('loginFailed', () => {
    const attempt = (result: { current: ReturnType<typeof useLogin> }) => {
      act(() => {
        result.current.handleLogin(makeLoginValues({ selectedHost: makeHost() }));
      });
    };

    it('is set by a rejection that carries no response code (salt timeout, registration required)', () => {
      const { result, store } = setup(disconnectedState);
      attempt(result);
      expect(result.current.loginFailed).toBe(false);

      act(() => {
        store.dispatch(server.Actions.loginFailed(undefined));
      });

      expect(store.getState().server.loginFailureCode).toBeNull();
      expect(result.current.loginFailed).toBe(true);
    });

    it('is set when the connection fails or the server is unreachable', () => {
      const { result, store } = setup(disconnectedState);
      attempt(result);
      act(() => {
        store.dispatch(server.Actions.connectUnreachable());
      });
      expect(result.current.loginFailed).toBe(true);
    });

    it('is cleared by a new attempt', () => {
      const { result, store } = setup(disconnectedState);
      attempt(result);
      act(() => {
        store.dispatch(server.Actions.loginFailed({ responseCode: Response_ResponseCode.RespWrongPassword }));
      });
      expect(result.current.loginFailed).toBe(true);

      attempt(result);
      expect(result.current.loginFailed).toBe(false);
    });

    it('is cleared when another server is selected', () => {
      const { result, rerender, store } = setup(disconnectedState);
      attempt(result);
      act(() => {
        store.dispatch(server.Actions.loginFailed(undefined));
      });
      expect(result.current.loginFailed).toBe(true);

      const other = makeHost({ id: 2, host: 'other.example', port: '443' } as any);
      vi.mocked(useKnownHosts).mockReturnValue(
        makeKnownHostsHook({ value: { hosts: [other], selectedHost: other } }),
      );
      rerender();
      expect(result.current.loginFailed).toBe(false);
    });

    it('ignores failures outside a sign-in attempt, such as a registration', () => {
      const { result, store } = setup(disconnectedState);
      act(() => {
        store.dispatch(server.Actions.connectionFailed());
      });
      expect(result.current.loginFailed).toBe(false);
    });
  });

  it('sends lowercase country codes during registration', () => {
    const { result, webClient } = setup(disconnectedState);
    act(() => result.current.handleRegistrationDialogSubmit({
      userName: 'user', password: 'pw', passwordConfirm: 'pw', email: '', emailConfirm: '', realName: '',
      country: 'US', selectedHost: makeHost(),
    }));
    expect(webClient.request.authentication.register).toHaveBeenCalledWith(expect.objectContaining({ country: 'us' }));
  });

  it('exposes the description and disconnected isConnected flag from server state', () => {
    const { result } = setup({
      ...disconnectedState,
      server: {
        ...(disconnectedState.server as any),
        status: {
          ...(disconnectedState.server as any).status,
          description: 'welcome',
        },
      },
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.description).toBe('welcome');
    expect(result.current.dialogState.passwordResetRequestDialog).toBe(false);
  });

  it('handleLogin dispatches authentication.login through the web client', () => {
    const { result, webClient } = setup(disconnectedState);

    act(() => {
      result.current.handleLogin(makeLoginValues({ userName: 'joe', password: 'pw' }));
    });

    expect(webClient.request.authentication.login).toHaveBeenCalled();
    const call = vi.mocked(webClient.request.authentication.login).mock.calls[0][0];
    expect(call).toMatchObject({ userName: 'joe', password: 'pw' });
  });

  it('handleLogin sends the stored hashedPassword when remember is set and password is empty', () => {
    const { result, webClient } = setup(disconnectedState);
    const host = makeHost({ hashedPassword: 'hp' } as any);

    act(() => {
      result.current.handleLogin({
        userName: 'joe',
        password: '',
        remember: true,
        selectedHost: host,
      } as any);
    });

    const call = vi.mocked(webClient.request.authentication.login).mock.calls[0][0];
    expect(call.hashedPassword).toBe('hp');
  });

  it('RESET_PASSWORD_REQUESTED closes the request dialog and opens the reset dialog', () => {
    const { result, store } = setup(disconnectedState);

    act(() => {
      result.current.openRequestPasswordResetDialog();
    });
    expect(result.current.dialogState.passwordResetRequestDialog).toBe(true);

    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_REQUESTED, payload: {} });
    });

    expect(result.current.dialogState.passwordResetRequestDialog).toBe(false);
    expect(result.current.dialogState.resetPasswordDialog).toBe(true);
  });

  it('RESET_PASSWORD_SUCCESS toasts under the key the shipped locales translate', () => {
    const { store } = setup(disconnectedState);

    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_SUCCESS, payload: {} });
    });

    expect(screen.getByText('Login.toasts.passwordResetSuccessToast')).toBeInTheDocument();
  });

  it('skipTokenRequest stores the user and pivots the dialog to the reset step', () => {
    const { result } = setup(disconnectedState);

    act(() => {
      result.current.openRequestPasswordResetDialog();
    });
    act(() => {
      result.current.skipTokenRequest('jane');
    });

    expect(result.current.userToResetPassword).toBe('jane');
    expect(result.current.dialogState.passwordResetRequestDialog).toBe(false);
    expect(result.current.dialogState.resetPasswordDialog).toBe(true);
  });

  it('handleRegistrationDialogSubmit dispatches authentication.register through the web client', () => {
    const { result, webClient } = setup(disconnectedState);

    act(() => {
      result.current.handleRegistrationDialogSubmit({
        userName: 'newcomer',
        password: 'pw',
        email: 'a@b.com',
        country: 'US',
        realName: 'Real Name',
        selectedHost: makeHost() as any,
      } as any);
    });

    const call = vi.mocked(webClient.request.authentication.register).mock.calls[0][0];
    expect(call).toMatchObject({ userName: 'newcomer', email: 'a@b.com' });
  });

  it('handleAccountActivationDialogSubmit is a no-op until pending activation context is set', () => {
    const { result, webClient } = setup(disconnectedState);

    act(() => {
      result.current.handleAccountActivationDialogSubmit({ token: 'abc' });
    });

    expect(webClient.request.authentication.activateAccount).not.toHaveBeenCalled();
  });

  describe('activation-to-login continuity', () => {
    const pending = { host: 'h.example', port: '1', userName: 'newcomer' };

    function registerThenAwaitActivation() {
      const ctx = setup(disconnectedState);
      act(() => {
        ctx.result.current.handleRegistrationDialogSubmit({
          userName: 'newcomer',
          password: 'secret',
          email: 'a@b.com',
          country: 'US',
          realName: '',
          selectedHost: makeHost() as any,
        } as any);
      });
      act(() => {
        ctx.store.dispatch({ type: server.Types.ACCOUNT_AWAITING_ACTIVATION, payload: { options: pending } });
      });
      return ctx;
    }

    it('carries the registration password into the activation request so the client logs in afterwards', () => {
      const { result, webClient } = registerThenAwaitActivation();
      expect(result.current.dialogState.activationDialog).toBe(true);

      act(() => {
        result.current.handleAccountActivationDialogSubmit({ token: 'tok' });
      });

      expect(webClient.request.authentication.activateAccount).toHaveBeenCalledWith({
        ...pending,
        token: 'tok',
        password: 'secret',
      });
    });

    it('carries the login password when the server reports the account is not activated yet', () => {
      const { result, webClient, store } = setup(disconnectedState);
      act(() => {
        result.current.handleLogin(makeLoginValues({ userName: 'newcomer', password: 'pw2' }));
      });
      act(() => {
        store.dispatch({ type: server.Types.ACCOUNT_AWAITING_ACTIVATION, payload: { options: pending } });
      });
      act(() => {
        result.current.handleAccountActivationDialogSubmit({ token: 'tok' });
      });

      const call = vi.mocked(webClient.request.authentication.activateAccount).mock.calls[0][0];
      expect(call.password).toBe('pw2');
    });

    it('drops the retained password when the activation dialog is cancelled', () => {
      const { result, webClient } = registerThenAwaitActivation();

      act(() => {
        result.current.closeActivateAccountDialog();
      });
      act(() => {
        result.current.handleAccountActivationDialogSubmit({ token: 'tok' });
      });

      const call = vi.mocked(webClient.request.authentication.activateAccount).mock.calls[0][0];
      expect(call.password).toBeUndefined();
    });
  });

  it('shows the description when disconnected with a non-empty description', () => {
    const { result } = setup({
      ...disconnectedState,
      server: {
        ...(disconnectedState.server as any),
        status: {
          ...(disconnectedState.server as any).status,
          description: 'hello',
        },
      },
    });
    expect(result.current.showDescription()).toBe(true);
  });

  it('hides the description when connected', () => {
    const { result } = setup(connectedState);
    expect(result.current.showDescription()).toBe(false);
  });

  it('substitutes the reachability message when disconnected and the last connect never opened', () => {
    const { result } = setup({
      ...disconnectedState,
      server: {
        ...(disconnectedState.server as any),
        connectUnreachable: true,
        status: {
          ...(disconnectedState.server as any).status,
          description: 'Connection Closed',
        },
      },
    });

    expect(result.current.description).toBe('Login.status.serverUnreachable');
    expect(result.current.showDescription()).toBe(true);
  });

  it('keeps the generic description when the last connect was reachable', () => {
    const { result } = setup({
      ...disconnectedState,
      server: {
        ...(disconnectedState.server as any),
        connectUnreachable: false,
        status: {
          ...(disconnectedState.server as any).status,
          description: 'Connection Failed',
        },
      },
    });

    expect(result.current.description).toBe('Connection Failed');
  });

  it.each([
    [Response_ResponseCode.RespPasswordChangeRequired, 'Login.status.passwordChangeRequired'],
    [Response_ResponseCode.RespServerFull, 'Login.status.serverFull'],
  ])('explains login rejection %s with %s', (loginFailureCode, key) => {
    const { result } = setup({
      ...disconnectedState,
      server: {
        ...(disconnectedState.server as any),
        loginFailureCode,
        status: {
          ...(disconnectedState.server as any).status,
          description: 'Login failed: something',
        },
      },
    });

    expect(result.current.description).toBe(key);
    expect(result.current.showDescription()).toBe(true);
  });

  it('offers the password reset only for a password-change-required rejection', () => {
    const rejectedWith = (loginFailureCode: number) => setup({
      ...disconnectedState,
      server: { ...(disconnectedState.server as any), loginFailureCode },
    }).result.current.passwordChangeRequired;

    expect(rejectedWith(Response_ResponseCode.RespPasswordChangeRequired)).toBe(true);
    expect(rejectedWith(Response_ResponseCode.RespServerFull)).toBe(false);
  });

  it('does not offer the password reset once connected', () => {
    const { result } = setup({
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        loginFailureCode: Response_ResponseCode.RespPasswordChangeRequired,
      },
    });

    expect(result.current.passwordChangeRequired).toBe(false);
  });

  it('keeps the status line for a login rejection without a localized message', () => {
    const { result } = setup({
      ...disconnectedState,
      server: {
        ...(disconnectedState.server as any),
        loginFailureCode: Response_ResponseCode.RespWrongPassword,
        status: {
          ...(disconnectedState.server as any).status,
          description: 'Login failed: incorrect username or password',
        },
      },
    });

    expect(result.current.description).toBe('Login failed: incorrect username or password');
  });

  it('does not surface the reachability message once connected, even if the flag lingers', () => {
    const { result } = setup({
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        connectUnreachable: true,
      },
    });

    expect(result.current.description).not.toBe('Login.status.serverUnreachable');
    expect(result.current.showDescription()).toBe(false);
  });
});
