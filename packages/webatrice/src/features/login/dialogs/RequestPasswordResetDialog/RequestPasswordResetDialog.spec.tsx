import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';

vi.mock('@app/feature-widgets/known-hosts', () => ({
  KnownHosts: () => <div data-testid="known-hosts" />,
  useKnownHosts: vi.fn(),
}));

import RequestPasswordResetDialog from './RequestPasswordResetDialog';

describe('RequestPasswordResetDialog', () => {
  test('renders nothing visible when closed', () => {
    renderWithProviders(
      <RequestPasswordResetDialog
        isOpen={false}
        onSubmit={vi.fn()}
        skipTokenRequest={vi.fn()}
      />,
      { preloadedState: disconnectedState },
    );
    expect(screen.queryByText('RequestPasswordResetDialog.title')).toBeNull();
  });

  test('renders the title and the request-reset form when open', () => {
    renderWithProviders(
      <RequestPasswordResetDialog
        isOpen
        onSubmit={vi.fn()}
        skipTokenRequest={vi.fn()}
      />,
      { preloadedState: disconnectedState },
    );
    expect(screen.getByText('RequestPasswordResetDialog.title')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'RequestPasswordResetForm.request' }),
    ).toBeTruthy();
  });

  test('invokes handleClose when the close button is clicked', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <RequestPasswordResetDialog
        isOpen
        handleClose={handleClose}
        onSubmit={vi.fn()}
        skipTokenRequest={vi.fn()}
      />,
      { preloadedState: disconnectedState },
    );
    const closeButton = document.querySelector('.dialog-title button') as HTMLElement;
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
