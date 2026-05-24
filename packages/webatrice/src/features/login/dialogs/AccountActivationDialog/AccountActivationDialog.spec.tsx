import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../../__test-utils__';
import AccountActivationDialog from './AccountActivationDialog';

describe('AccountActivationDialog', () => {
  test('renders nothing visible when closed', () => {
    renderWithProviders(
      <AccountActivationDialog isOpen={false} onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.queryByText('AccountActivationDialog.title')).toBeNull();
  });

  test('renders the title, subtitles and the activation form when open', () => {
    renderWithProviders(
      <AccountActivationDialog isOpen onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(screen.getByText('AccountActivationDialog.title')).toBeTruthy();
    expect(screen.getByText('AccountActivationDialog.subtitle1')).toBeTruthy();
    expect(screen.getByText('AccountActivationDialog.subtitle2')).toBeTruthy();
    expect(screen.getByLabelText('Common.label.token')).toBeTruthy();
  });

  test('invokes handleClose when the close button is clicked', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <AccountActivationDialog isOpen handleClose={handleClose} onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    const closeButton = document.querySelector('.dialog-title button') as HTMLElement;
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('omits the close button when no handleClose is provided', () => {
    renderWithProviders(
      <AccountActivationDialog isOpen onSubmit={vi.fn()} />,
      { preloadedState: disconnectedState },
    );
    expect(document.querySelector('.dialog-title button')).toBeNull();
  });
});
