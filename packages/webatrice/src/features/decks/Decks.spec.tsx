import { screen } from '@testing-library/react';

import { renderWithProviders, connectedState, disconnectedState } from '../../__test-utils__';
import Decks from './Decks';

// Coverage scope deferred: Decks.tsx is currently a placeholder (`<span>Decks</span>`)
// with no list, selection, or management UI to exercise. List/selection/management
// tests will land alongside the real implementation; see plans/gameboard-deferrables.md.
describe('Decks (placeholder coverage)', () => {
  it('renders the Decks placeholder content', () => {
    renderWithProviders(<Decks />, { preloadedState: connectedState });

    // LeftNav also renders a "Decks" nav link, so scope to the page's own span.
    expect(screen.getByText('Decks', { selector: 'span' })).toBeInTheDocument();
  });

  it('renders inside a Layout wrapper', () => {
    const { container } = renderWithProviders(<Decks />, { preloadedState: connectedState });
    // Layout is the page-level container; assert at least one ancestor element exists.
    const span = screen.getByText('Decks', { selector: 'span' });
    expect(span.parentElement).not.toBeNull();
    expect(container.contains(span)).toBe(true);
  });

  it('still renders the placeholder span when disconnected (AuthGuard does not blank the page)', () => {
    renderWithProviders(<Decks />, { preloadedState: disconnectedState });
    expect(screen.getByText('Decks', { selector: 'span' })).toBeInTheDocument();
  });
});
