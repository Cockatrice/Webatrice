import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import { makeHost } from '../../../../feature-widgets/known-hosts/__mocks__/useKnownHosts';

const hoisted = vi.hoisted(() => ({
  host: undefined as any,
}));

vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: ({ value, onChange, disabled }: any) => (
    <button
      type="button"
      data-testid="pick-host"
      disabled={disabled}
      onClick={() => onChange(hoisted.host)}
    >
      host:{value ? 'set' : 'unset'}
    </button>
  ),
  useKnownHosts: vi.fn(),
}));

import RequestPasswordResetForm from './RequestPasswordResetForm';
import { server } from '@cockatrice/datatrice';

beforeEach(() => {
  hoisted.host = makeHost({ id: 1, userName: 'preset' });
});

describe('RequestPasswordResetForm', () => {
  test('renders the username field, submit and skip buttons', () => {
    renderWithProviders(
      <RequestPasswordResetForm onSubmit={vi.fn()} skipTokenRequest={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.getByLabelText('Common.label.username')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'RequestPasswordResetForm.request' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'RequestPasswordResetForm.skipRequest' }),
    ).toBeTruthy();
  });

  test('does not show the email field until MFA is challenged', () => {
    renderWithProviders(
      <RequestPasswordResetForm onSubmit={vi.fn()} skipTokenRequest={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.queryByLabelText('Common.label.email')).toBeNull();
  });

  test('selecting a host populates the username from the host', async () => {
    renderWithProviders(
      <RequestPasswordResetForm onSubmit={vi.fn()} skipTokenRequest={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    fireEvent.click(screen.getByTestId('pick-host'));
    await waitFor(() => {
      expect(
        (screen.getByLabelText('Common.label.username') as HTMLInputElement).value,
      ).toBe('preset');
    });
  });

  test('submits with the entered values when valid', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <RequestPasswordResetForm onSubmit={onSubmit} skipTokenRequest={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    fireEvent.change(screen.getByLabelText('Common.label.username'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByTestId('pick-host'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'RequestPasswordResetForm.request' }),
      );
    });
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ selectedHost: hoisted.host });
  });

  test('does not submit when required fields are missing', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <RequestPasswordResetForm onSubmit={onSubmit} skipTokenRequest={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    fireEvent.change(screen.getByLabelText('Common.label.username'), {
      target: { value: '' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'RequestPasswordResetForm.request' }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('skip button forwards the current username to skipTokenRequest', () => {
    const skipTokenRequest = vi.fn();
    renderWithProviders(
      <RequestPasswordResetForm onSubmit={vi.fn()} skipTokenRequest={skipTokenRequest} />,
      { preloadedState: disconnectedState },
    );
    fireEvent.change(screen.getByLabelText('Common.label.username'), {
      target: { value: 'bob' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'RequestPasswordResetForm.skipRequest' }),
    );
    expect(skipTokenRequest).toHaveBeenCalledWith('bob');
  });

  test('shows the error message when RESET_PASSWORD_FAILED is dispatched', () => {
    const { store } = renderWithProviders(
      <RequestPasswordResetForm onSubmit={vi.fn()} skipTokenRequest={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_FAILED, payload: {} });
    });
    expect(screen.getByText('RequestPasswordResetForm.error')).toBeTruthy();
  });

  test('reveals the email field when RESET_PASSWORD_CHALLENGE is dispatched', () => {
    const { store } = renderWithProviders(
      <RequestPasswordResetForm onSubmit={vi.fn()} skipTokenRequest={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_CHALLENGE, payload: {} });
    });
    expect(screen.getByLabelText('Common.label.email')).toBeTruthy();
    expect(screen.getByText('RequestPasswordResetForm.mfaEnabled')).toBeTruthy();
  });
});
