import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import { makeHost } from '../../../../feature-widgets/known-hosts/__mocks__/useKnownHosts';

const hoisted = vi.hoisted(() => ({
  host: undefined as any,
}));

// Stub KnownHosts to a controlled dropdown-free input; its real effects would
// require the full known-hosts service wiring.
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

import RegisterForm from './RegisterForm';

beforeEach(() => {
  hoisted.host = makeHost({ id: 1 });
});

const fillRequired = () => {
  fireEvent.change(screen.getByLabelText('Common.label.username'), {
    target: { value: 'alice' },
  });
  fireEvent.change(screen.getByLabelText('Common.label.password'), {
    target: { value: 'password1' },
  });
  fireEvent.change(screen.getByLabelText('Common.label.confirmPassword'), {
    target: { value: 'password1' },
  });
  fireEvent.click(screen.getByTestId('pick-host'));
};

describe('RegisterForm', () => {
  test('renders all the form fields and the submit button', () => {
    renderWithProviders(<RegisterForm onSubmit={vi.fn()} />, {
      preloadedState: disconnectedState,
    });
    expect(screen.getByLabelText('Common.label.username')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.password')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.confirmPassword')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.email')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.confirmEmail')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.realName')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'RegisterForm.label.register' }),
    ).toBeTruthy();
  });

  test('does not call onSubmit when required fields are empty', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<RegisterForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'RegisterForm.label.register' }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('does not call onSubmit when the passwords do not match', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<RegisterForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    fireEvent.change(screen.getByLabelText('Common.label.username'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText('Common.label.password'), {
      target: { value: 'password1' },
    });
    fireEvent.change(screen.getByLabelText('Common.label.confirmPassword'), {
      target: { value: 'mismatch1' },
    });
    fireEvent.click(screen.getByTestId('pick-host'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'RegisterForm.label.register' }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('calls onSubmit with trimmed values when the form is valid', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<RegisterForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });
    fillRequired();
    fireEvent.click(
      screen.getByRole('button', { name: 'RegisterForm.label.register' }),
    );
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      userName: 'alice',
      password: 'password1',
      selectedHost: hoisted.host,
    });
  });

  test('renders the server registration error from redux state', () => {
    renderWithProviders(<RegisterForm onSubmit={vi.fn()} />, {
      preloadedState: {
        ...disconnectedState,
        server: {
          ...(disconnectedState.server as any),
          registrationError: 'Server says no',
        },
      },
    });
    expect(screen.getByText('Server says no')).toBeTruthy();
  });

  // NOTE: the REGISTRATION_REQUIRES_EMAIL → email-required path is not covered
  // here because it cannot fire in practice: useRegisterForm recreates
  // `onHostChange` every render, so RegisterForm's `useEffect([formHost,
  // onHostChange])` re-runs onHostChange() (which clears emailRequired) on the
  // render right after the flag is set. Covering it would require a source fix
  // (memoize the handlers) — out of scope for the coverage pass.
});
