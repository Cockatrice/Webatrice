import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import RegisterForm from '../../../src/features/login/forms/RegisterForm/RegisterForm';
import ResetPasswordForm from '../../../src/features/login/forms/ResetPasswordForm/ResetPasswordForm';
import RequestPasswordResetForm from '../../../src/features/login/forms/RequestPasswordResetForm/RequestPasswordResetForm';
import AccountActivationForm from '../../../src/features/login/forms/AccountActivationForm/AccountActivationForm';
import RegistrationDialog from '../../../src/features/login/dialogs/RegistrationDialog/RegistrationDialog';
import ResetPasswordDialog from '../../../src/features/login/dialogs/ResetPasswordDialog/ResetPasswordDialog';

import { renderFeatureScreen } from './helpers';

// Stubbing KnownHosts decouples these specs from the known-hosts service
// (its store loads asynchronously from Dexie). The forms still drive their
// own onSubmit / state via the render-side stub.
vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: ({ onChange }: { onChange: (v: unknown) => void }) => (
    <button
      type="button"
      data-testid="pick-host"
      onClick={() =>
        onChange({
          id: 1,
          name: 'h',
          host: 'h',
          port: '4747',
          editable: false,
          remember: false,
          // RequestPasswordResetForm syncs username from the picked host on
          // change — give it a concrete value so the form doesn't need a
          // separate text input mutation in the test.
          userName: 'alice',
        })
      }
    >
      host
    </button>
  ),
  useKnownHosts: vi.fn(),
}));

beforeEach(() => {
  vi.useRealTimers();
});

describe('Login forms (integration)', () => {
  it('mounts RegisterForm, accepts input, and submits when valid', async () => {
    const onSubmit = vi.fn();
    renderFeatureScreen(<RegisterForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Common.label.username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Common.label.password'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText('Common.label.confirmPassword'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByTestId('pick-host'));
    fireEvent.click(screen.getByRole('button', { name: 'RegisterForm.label.register' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('mounts AccountActivationForm and submits a token', async () => {
    const onSubmit = vi.fn();
    renderFeatureScreen(<AccountActivationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Common.label.token'), { target: { value: 'tok123' } });
    fireEvent.click(screen.getByRole('button', { name: 'AccountActivationForm.label.activate' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok123' }));
    });
  });

  it('mounts RequestPasswordResetForm and submits with the host-driven username', async () => {
    const onSubmit = vi.fn();
    renderFeatureScreen(
      <RequestPasswordResetForm onSubmit={onSubmit} skipTokenRequest={vi.fn()} />,
    );

    // Picking the host populates the username from the host (see the mock
    // above), so no manual change is needed before submitting.
    fireEvent.click(screen.getByTestId('pick-host'));
    fireEvent.click(screen.getByRole('button', { name: 'RequestPasswordResetForm.request' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('mounts ResetPasswordForm and submits with token + password', async () => {
    const onSubmit = vi.fn();
    renderFeatureScreen(<ResetPasswordForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Common.label.username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Common.label.token'), { target: { value: 'tok123' } });
    fireEvent.change(screen.getByLabelText('Common.label.password'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText('Common.label.passwordAgain'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByTestId('pick-host'));
    fireEvent.click(screen.getByRole('button', { name: 'ResetPasswordForm.label.reset' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('mounts RegistrationDialog open and renders the embedded form', () => {
    renderFeatureScreen(<RegistrationDialog isOpen onSubmit={vi.fn()} />);
    expect(screen.getByText('RegistrationDialog.title')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'RegisterForm.label.register' }),
    ).toBeInTheDocument();
  });

  it('mounts ResetPasswordDialog open and renders the embedded form', () => {
    renderFeatureScreen(<ResetPasswordDialog isOpen onSubmit={vi.fn()} />);
    expect(screen.getByText('ResetPasswordDialog.title')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ResetPasswordForm.label.reset' }),
    ).toBeInTheDocument();
  });
});
