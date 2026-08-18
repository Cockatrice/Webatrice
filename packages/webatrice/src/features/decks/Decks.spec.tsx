import { screen } from '@testing-library/react';

import { renderWithProviders, connectedState, disconnectedState } from '../../__test-utils__';
import Decks from './Decks';

// Piece 2 coverage: smoke-test the new MyDecks list. Full RTL
// coverage (create/delete flows, useReduxEffect navigation) lives in
// integration tests to be added alongside Piece 3.
describe('Decks (MyDecks page)', () => {
  it('renders the page header + New Deck button when connected', () => {
    renderWithProviders(<Decks />, { preloadedState: connectedState });
    expect(screen.getByRole('heading', { name: 'My Decks' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /new deck/i }).length).toBeGreaterThan(0);
  });

  it('shows the loading state while backendDecks is null', () => {
    renderWithProviders(<Decks />, { preloadedState: connectedState });
    expect(screen.getByText(/loading decks/i)).toBeInTheDocument();
  });

  it('still renders the page shell when disconnected (AuthGuard does not blank the page)', () => {
    renderWithProviders(<Decks />, { preloadedState: disconnectedState });
    expect(screen.getByRole('heading', { name: 'My Decks' })).toBeInTheDocument();
  });
});
