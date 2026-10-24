import { fireEvent, screen } from '@testing-library/react';
import { Link } from 'react-router-dom';

import { loadPersistedLastRoute } from '@app/services';
import { renderWithProviders } from '../../../__test-utils__';

import { usePersistLastRoute } from './usePersistLastRoute';

function Probe() {
  usePersistLastRoute();
  return <Link to="/decks">decks</Link>;
}

describe('usePersistLastRoute', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('saves the route it mounts on and every route after it', () => {
    renderWithProviders(<Probe />, { route: '/settings' });
    expect(loadPersistedLastRoute()).toBe('/settings');

    fireEvent.click(screen.getByRole('link', { name: 'decks' }));

    expect(loadPersistedLastRoute()).toBe('/decks');
  });
});
