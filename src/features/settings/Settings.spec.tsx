import { screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';
import Settings from './Settings';

describe('Settings', () => {
  it('renders the shortcuts tab', () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    expect(screen.getByRole('tab', { name: /Settings\.tab\.shortcuts/ })).toBeInTheDocument();
  });

  it('shows the shortcuts tab panel by default', () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    const panel = document.getElementById('settings-tabpanel-0');
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute('hidden');
  });
});
