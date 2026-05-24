import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import AccountActivationForm from './AccountActivationForm';
import { server } from '@cockatrice/datatrice';

describe('AccountActivationForm', () => {
  test('renders the token field and the activate button', () => {
    renderWithProviders(<AccountActivationForm onSubmit={vi.fn()} />, {
      preloadedState: disconnectedState,
    });
    expect(screen.getByLabelText('Common.label.token')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'AccountActivationForm.label.activate' }),
    ).toBeTruthy();
  });

  test('submits with the entered token when valid', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<AccountActivationForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    fireEvent.change(screen.getByLabelText('Common.label.token'), {
      target: { value: 'mytoken' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'AccountActivationForm.label.activate' }),
      );
    });
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ token: 'mytoken' });
  });

  test('does not submit when the token is empty', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<AccountActivationForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'AccountActivationForm.label.activate' }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('shows the failure message when ACCOUNT_ACTIVATION_FAILED is dispatched', () => {
    const { store } = renderWithProviders(<AccountActivationForm onSubmit={vi.fn()} />, {
      preloadedState: disconnectedState,
    });
    act(() => {
      store.dispatch({ type: server.Types.ACCOUNT_ACTIVATION_FAILED, payload: {} });
    });
    expect(screen.getByText('AccountActivationForm.error.failed')).toBeTruthy();
  });

  test('clears the failure message on a subsequent valid submit', async () => {
    const onSubmit = vi.fn();
    const { store } = renderWithProviders(<AccountActivationForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    act(() => {
      store.dispatch({ type: server.Types.ACCOUNT_ACTIVATION_FAILED, payload: {} });
    });
    expect(screen.getByText('AccountActivationForm.error.failed')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Common.label.token'), {
      target: { value: 'mytoken' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'AccountActivationForm.label.activate' }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('AccountActivationForm.error.failed')).toBeNull();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
