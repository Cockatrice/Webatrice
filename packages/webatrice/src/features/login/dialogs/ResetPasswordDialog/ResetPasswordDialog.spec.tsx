import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';

// ResetPasswordForm renders <KnownHosts disabled />; stub it to a dumb element
// so the dialog test does not pull in the known-hosts service wiring.
vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: () => <div data-testid="known-hosts" />,
  useKnownHosts: vi.fn(),
}));

import ResetPasswordDialog from './ResetPasswordDialog';

describe('ResetPasswordDialog', () => {
  test('renders nothing visible when closed', () => {
    renderWithProviders(
      <ResetPasswordDialog isOpen={false} onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.queryByText('ResetPasswordDialog.title')).toBeNull();
  });

  test('renders the title and the reset-password form when open', () => {
    renderWithProviders(
      <ResetPasswordDialog isOpen onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.getByText('ResetPasswordDialog.title')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'ResetPasswordForm.label.reset' }),
    ).toBeTruthy();
  });

  test('prefills the username when one is supplied', () => {
    renderWithProviders(
      <ResetPasswordDialog isOpen onSubmit={vi.fn()} userName="lockedUser" />,
      { preloadedState: disconnectedState },
    );
    expect(
      (screen.getByLabelText('Common.label.username') as HTMLInputElement).value,
    ).toBe('lockedUser');
  });

  test('invokes handleClose when the close button is clicked', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <ResetPasswordDialog isOpen handleClose={handleClose} onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    const closeButton = document.querySelector('.dialog-title button') as HTMLElement;
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
