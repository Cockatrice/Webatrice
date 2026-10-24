import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../../__test-utils__';
import type { RecentDeck } from '@app/services';
import RecentDecks from './RecentDecks';

const mocks = vi.hoisted(() => ({
  prefetch: vi.fn(),
  prefetchHook: vi.fn(),
}));

vi.mock('../../../RoutePrefetch', () => ({
  useDeckEditorRoutePrefetch: mocks.prefetchHook,
}));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('@app/hooks')>(),
  useRecentDecks: () => [{
    scope: 'ws://localhost:4748',
    owner: 'testUser',
    deckId: 7,
    name: 'Atraxa',
    format: 'commander',
    colors: 'WUBG',
    cardCount: 100,
    openedAt: 1,
  } satisfies RecentDeck],
}));

beforeEach(() => {
  mocks.prefetchHook.mockReturnValue(mocks.prefetch);
});

it('registers idle prefetch and prefetches from a recent deck tile', () => {
  renderWithProviders(<RecentDecks />, { preloadedState: connectedState });
  expect(mocks.prefetchHook).toHaveBeenCalledTimes(1);
  const button = screen.getByRole('button', { name: /Atraxa/ });
  fireEvent.pointerEnter(button);
  fireEvent.focus(button);
  expect(mocks.prefetch).toHaveBeenCalledTimes(2);
});
