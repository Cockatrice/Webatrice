import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { Decks } from '@app/features/decks';

import { renderFeatureScreen, simulateLoggedIn } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Decks (integration)', () => {
  it('renders the Decks placeholder when the user is connected', () => {
    renderFeatureScreen(<Decks />);

    // Placeholder is no longer a bare <span>Decks</span>; the page now
    // renders an <h1>My Decks</h1> heading as its identifying element.
    expect(screen.getByRole('heading', { level: 1, name: 'My Decks' })).toBeInTheDocument();
  });
});
