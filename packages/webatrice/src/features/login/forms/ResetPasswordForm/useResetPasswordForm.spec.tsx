import { act, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import { useResetPasswordForm } from './useResetPasswordForm';
import { server } from '@cockatrice/datatrice';

const Probe = () => {
  const { errorMessage } = useResetPasswordForm();
  return <span data-testid="errorMessage">{String(errorMessage)}</span>;
};

describe('useResetPasswordForm', () => {
  test('starts with errorMessage false', () => {
    renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    expect(screen.getByTestId('errorMessage').textContent).toBe('false');
  });

  test('RESET_PASSWORD_FAILED sets errorMessage true', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_FAILED, payload: {} });
    });
    expect(screen.getByTestId('errorMessage').textContent).toBe('true');
  });

  test('ignores unrelated action types', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_SUCCESS, payload: {} });
    });
    expect(screen.getByTestId('errorMessage').textContent).toBe('false');
  });
});
