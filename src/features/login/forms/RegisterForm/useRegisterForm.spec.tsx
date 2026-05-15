import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import { useRegisterForm, type RegisterForm } from './useRegisterForm';
import { server } from '@cockatrice/datatrice';

// Probe component: surfaces the hook's return value and exposes buttons that
// invoke each imperative callback so we can assert state transitions.
let latest: RegisterForm;
const Probe = () => {
  const hook = useRegisterForm();
  latest = hook;
  return (
    <div>
      <span data-testid="emailRequired">{String(hook.emailRequired)}</span>
      <span data-testid="emailError">{String(hook.emailError)}</span>
      <span data-testid="passwordError">{String(hook.passwordError)}</span>
      <span data-testid="userNameError">{String(hook.userNameError)}</span>
      <span data-testid="error">{String(hook.error)}</span>
      <button data-testid="onHostChange" onClick={hook.onHostChange} />
      <button data-testid="onEmailChange" onClick={hook.onEmailChange} />
      <button data-testid="onPasswordChange" onClick={hook.onPasswordChange} />
      <button data-testid="onUserNameChange" onClick={hook.onUserNameChange} />
    </div>
  );
};

describe('useRegisterForm', () => {
  test('starts with cleared state', () => {
    renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    expect(screen.getByTestId('emailRequired').textContent).toBe('false');
    expect(screen.getByTestId('emailError').textContent).toBe('null');
    expect(screen.getByTestId('passwordError').textContent).toBe('null');
    expect(screen.getByTestId('userNameError').textContent).toBe('null');
    expect(screen.getByTestId('error').textContent).toBe('null');
  });

  test('reads the registration error from redux state', () => {
    renderWithProviders(<Probe />, {
      preloadedState: {
        ...disconnectedState,
        server: { ...(disconnectedState.server as any), registrationError: 'boom' },
      },
    });
    expect(screen.getByTestId('error').textContent).toBe('boom');
  });

  test('REGISTRATION_REQUIRES_EMAIL flips emailRequired; onHostChange clears it', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({ type: server.Types.REGISTRATION_REQUIRES_EMAIL, payload: {} });
    });
    expect(screen.getByTestId('emailRequired').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('onHostChange'));
    expect(screen.getByTestId('emailRequired').textContent).toBe('false');
  });

  test('REGISTRATION_EMAIL_ERROR sets emailError; onEmailChange clears it', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({
        type: server.Types.REGISTRATION_EMAIL_ERROR,
        payload: { error: 'bad email' },
      });
    });
    expect(screen.getByTestId('emailError').textContent).toBe('bad email');

    fireEvent.click(screen.getByTestId('onEmailChange'));
    expect(screen.getByTestId('emailError').textContent).toBe('null');
  });

  test('REGISTRATION_PASSWORD_ERROR sets passwordError; onPasswordChange clears it', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({
        type: server.Types.REGISTRATION_PASSWORD_ERROR,
        payload: { error: 'bad password' },
      });
    });
    expect(screen.getByTestId('passwordError').textContent).toBe('bad password');

    fireEvent.click(screen.getByTestId('onPasswordChange'));
    expect(screen.getByTestId('passwordError').textContent).toBe('null');
  });

  test('REGISTRATION_USERNAME_ERROR sets userNameError; onUserNameChange clears it', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({
        type: server.Types.REGISTRATION_USERNAME_ERROR,
        payload: { error: 'bad name' },
      });
    });
    expect(screen.getByTestId('userNameError').textContent).toBe('bad name');

    fireEvent.click(screen.getByTestId('onUserNameChange'));
    expect(screen.getByTestId('userNameError').textContent).toBe('null');
  });

  test('change callbacks are no-ops when no matching error is present', () => {
    renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    fireEvent.click(screen.getByTestId('onEmailChange'));
    fireEvent.click(screen.getByTestId('onPasswordChange'));
    fireEvent.click(screen.getByTestId('onUserNameChange'));
    expect(screen.getByTestId('emailError').textContent).toBe('null');
    expect(screen.getByTestId('passwordError').textContent).toBe('null');
    expect(screen.getByTestId('userNameError').textContent).toBe('null');
  });

  test('REGISTRATION_SUCCESS is handled without throwing', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    expect(() =>
      act(() => {
        store.dispatch({ type: server.Types.REGISTRATION_SUCCESS, payload: {} });
      }),
    ).not.toThrow();
    expect(latest).toBeDefined();
  });
});
