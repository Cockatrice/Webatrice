import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders, disconnectedState, connectedState } from '../../__test-utils__';
import Initialize from './Initialize';

describe('Initialize', () => {
  it('renders the splash screen while the server is not initialized', () => {
    const { container } = renderWithProviders(<Initialize />, { preloadedState: disconnectedState });

    // Layout's LeftNav also renders a logo, so scope to the Initialize content.
    expect(container.querySelector('.Initialize-content img')).toBeInTheDocument();
    // i18n keys render verbatim under the test i18n instance.
    expect(screen.getByText('Initialize.title')).toBeInTheDocument();
  });

  it('redirects to the login route once the server is initialized', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Initialize />} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>,
      { preloadedState: connectedState, route: '/' },
    );

    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByText('Initialize.title')).not.toBeInTheDocument();
  });
});
