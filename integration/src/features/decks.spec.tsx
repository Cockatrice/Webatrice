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

    expect(screen.getByText('Decks', { selector: 'span' })).toBeInTheDocument();
  });
});
