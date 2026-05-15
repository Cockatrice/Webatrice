import { screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';
import Decks from './Decks';

describe('Decks', () => {
  it('renders the Decks placeholder content', () => {
    renderWithProviders(<Decks />, { preloadedState: connectedState });

    // LeftNav also renders a "Decks" nav link, so scope to the page's own span.
    expect(screen.getByText('Decks', { selector: 'span' })).toBeInTheDocument();
  });
});
