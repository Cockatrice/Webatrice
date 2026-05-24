import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import { makeHost } from '../../../../feature-widgets/known-hosts/__mocks__/useKnownHosts';

const hoisted = vi.hoisted(() => ({
  host: undefined as any,
}));

// ResetPasswordForm renders <KnownHosts disabled />; the real widget still
// reports a selected host through onChange. The stub stays clickable (ignores
// `disabled`) so the test can drive host selection.
vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: ({ value, onChange }: any) => (
    <button
      type="button"
      data-testid="pick-host"
      onClick={() => onChange(hoisted.host)}
    >
      host:{value ? 'set' : 'unset'}
    </button>
  ),
  useKnownHosts: vi.fn(),
}));

import ResetPasswordForm from './ResetPasswordForm';
import { server } from '@cockatrice/datatrice';

beforeEach(() => {
  hoisted.host = makeHost({ id: 1 });
});

const fillValid = () => {
  fireEvent.change(screen.getByLabelText('Common.label.username'), {
    target: { value: 'alice' },
  });
  fireEvent.change(screen.getByLabelText('Common.label.token'), {
    target: { value: 'tok123' },
  });
  fireEvent.change(screen.getByLabelText('Common.label.password'), {
    target: { value: 'password1' },
  });
  fireEvent.change(screen.getByLabelText('Common.label.passwordAgain'), {
    target: { value: 'password1' },
  });
  fireEvent.click(screen.getByTestId('pick-host'));
};

describe('ResetPasswordForm', () => {
  test('renders all the fields and the submit button', () => {
    renderWithProviders(<ResetPasswordForm onSubmit={vi.fn()} />, {
      preloadedState: disconnectedState,
    });
    expect(screen.getByLabelText('Common.label.username')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.token')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.password')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.passwordAgain')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'ResetPasswordForm.label.reset' }),
    ).toBeTruthy();
  });

  test('prefills the username from the userName prop', () => {
    renderWithProviders(<ResetPasswordForm onSubmit={vi.fn()} userName="lockedUser" />, {
      preloadedState: disconnectedState,
    });
    const input = screen.getByLabelText('Common.label.username') as HTMLInputElement;
    expect(input.value).toBe('lockedUser');
  });

  test('submits with the entered values when valid', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<ResetPasswordForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    fillValid();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'ResetPasswordForm.label.reset' }),
      );
    });
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      userName: 'alice',
      token: 'tok123',
      newPassword: 'password1',
      selectedHost: hoisted.host,
    });
  });

  test('does not submit when the passwords do not match', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<ResetPasswordForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    fireEvent.change(screen.getByLabelText('Common.label.username'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText('Common.label.token'), {
      target: { value: 'tok123' },
    });
    fireEvent.change(screen.getByLabelText('Common.label.password'), {
      target: { value: 'password1' },
    });
    fireEvent.change(screen.getByLabelText('Common.label.passwordAgain'), {
      target: { value: 'mismatch1' },
    });
    fireEvent.click(screen.getByTestId('pick-host'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'ResetPasswordForm.label.reset' }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('does not submit when required fields are empty', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<ResetPasswordForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'ResetPasswordForm.label.reset' }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('shows the error message when RESET_PASSWORD_FAILED is dispatched', () => {
    const { store } = renderWithProviders(<ResetPasswordForm onSubmit={vi.fn()} />, {
      preloadedState: disconnectedState,
    });
    act(() => {
      store.dispatch({ type: server.Types.RESET_PASSWORD_FAILED, payload: {} });
    });
    expect(screen.getByText('ResetPasswordForm.error')).toBeTruthy();
  });
});
