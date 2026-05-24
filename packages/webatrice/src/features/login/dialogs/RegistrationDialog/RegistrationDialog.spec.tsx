import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';

vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: () => <div data-testid="known-hosts" />,
  useKnownHosts: vi.fn(),
}));

import RegistrationDialog from './RegistrationDialog';

describe('RegistrationDialog', () => {
  test('renders nothing visible when closed', () => {
    renderWithProviders(
      <RegistrationDialog isOpen={false} onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.queryByText('RegistrationDialog.title')).toBeNull();
  });

  test('renders the title and the registration form when open', () => {
    renderWithProviders(
      <RegistrationDialog isOpen onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.getByText('RegistrationDialog.title')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'RegisterForm.label.register' }),
    ).toBeTruthy();
  });

  test('invokes handleClose when the close button is clicked', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <RegistrationDialog isOpen handleClose={handleClose} onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    const closeButton = document.querySelector('.dialog-title button') as HTMLElement;
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
