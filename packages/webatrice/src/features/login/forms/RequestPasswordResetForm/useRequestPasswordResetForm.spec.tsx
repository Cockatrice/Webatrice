import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import { useRequestPasswordResetForm } from './useRequestPasswordResetForm';
import { server } from '@cockatrice/datatrice';

const Probe = () => {
  const { errorMessage, setErrorMessage, isMFA, setIsMFA } = useRequestPasswordResetForm();
  return (
    <div>
      <span data-testid="errorMessage">{String(errorMessage)}</span>
      <span data-testid="isMFA">{String(isMFA)}</span>
      <button data-testid="clearError" onClick={() => setErrorMessage(false)} />
      <button data-testid="setMFA" onClick={() => setIsMFA(true)} />
    </div>
  );
};

describe('useRequestPasswordResetForm', () => {
  test('starts with errorMessage and isMFA false', () => {
    renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    expect(screen.getByTestId('errorMessage').textContent).toBe('false');
    expect(screen.getByTestId('isMFA').textContent).toBe('false');
  });

  test('RESET_PASSWORD_FAILED sets errorMessage true', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_FAILED, payload: {} });
    });
    expect(screen.getByTestId('errorMessage').textContent).toBe('true');
  });

  test('RESET_PASSWORD_CHALLENGE sets isMFA true', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_CHALLENGE, payload: {} });
    });
    expect(screen.getByTestId('isMFA').textContent).toBe('true');
  });

  test('exposes setters that update state', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_FAILED, payload: {} });
    });
    expect(screen.getByTestId('errorMessage').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('clearError'));
    expect(screen.getByTestId('errorMessage').textContent).toBe('false');

    fireEvent.click(screen.getByTestId('setMFA'));
    expect(screen.getByTestId('isMFA').textContent).toBe('true');
  });
});
