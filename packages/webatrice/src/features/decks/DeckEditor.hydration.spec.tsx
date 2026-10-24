import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { server } from '@cockatrice/datatrice';
import { lookupCardsCached } from '@app/services';
import { connected31State, createMockWebClient, renderWithProviders } from '../../__test-utils__';
import DeckEditor from './DeckEditor';
import { clearDeckEditorCache, getCachedDeck } from './deckEditorCache';
import { hydrateDeck } from './hydrate';
import { fetchPricesForCards } from './pricing';
import type { HydratedDeck } from './types';
import { useRecordRecentDeck } from '@app/hooks';

vi.mock('./hydrate', async (original) => ({ ...await original<typeof import('./hydrate')>(), hydrateDeck: vi.fn() }));
vi.mock('./pricing', async (original) => ({
  ...await original<typeof import('./pricing')>(), fetchPricesForCards: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@app/services', async (original) => ({
  ...await original<typeof import('@app/services')>(), lookupCardsCached: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock('@app/hooks', async (original) => ({ ...await original<typeof import('@app/hooks')>(), useRecordRecentDeck: vi.fn() }));

const cod = '<cockatrice_deck version="1"><deckname>Pending deck</deckname><format>commander</format>'
  + '<zone name="main"><card number="4" name="Lightning Bolt"/></zone>'
  + '<zone name="side"><card number="2" name="Mountain"/></zone></cockatrice_deck>';

beforeEach(() => clearDeckEditorCache());

it('shows names, quantities and sections with disabled editing and no card-data judgments until hydration', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1600 } as DOMRect);
  let resolve!: (deck: HydratedDeck) => void;
  vi.mocked(hydrateDeck).mockReturnValue(new Promise((yes) => {
    resolve = yes;
  }));
  const webClient = createMockWebClient();
  const view = renderWithProviders(<Routes><Route path="/deck/:deckId" element={<DeckEditor />} /></Routes>, {
    route: '/deck/5', preloadedState: connected31State, webClient,
  });
  act(() => view.store.dispatch(server.Actions.deckDownloaded({
    deckId: 5, deck: cod, requestId: vi.mocked(webClient.request.session.deckDownload).mock.calls[0][1],
  })));
  expect(screen.getByText('Lightning Bolt')).toBeVisible();
  expect(screen.getByText('Mountain')).toBeVisible();
  expect(screen.getByRole('gridcell', { name: '4' })).toBeVisible();
  expect(screen.getByRole('gridcell', { name: '2' })).toBeVisible();
  expect(screen.getByText('DeckEditor.section.main')).toBeVisible();
  expect(screen.getByText('DeckEditor.section.sideboard')).toBeVisible();
  expect(screen.getByText('DeckEditor.hydrating')).toBeVisible();
  const inspector = within(screen.getByRole('complementary', { name: 'DeckEditor.inspector.label' }));
  expect(inspector.getByRole('status')).toHaveTextContent('DeckEditor.shell.loadingDeck');
  expect(inspector.queryByText('DeckBreakdown.stat.avgCmc')).not.toBeInTheDocument();
  expect(inspector.queryByText('SampleHand.title')).not.toBeInTheDocument();
  expect(screen.getByText('DeckLegality.checking')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'DeckHeader.name' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'DeckHeader.more' })).toBeDisabled();
  expect(screen.queryByRole('img', { name: 'DeckEditor.row.unknown' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /DeckEditor.rowActions.trigger/ })).not.toBeInTheDocument();
  expect(fetchPricesForCards).not.toHaveBeenCalled();
  expect(lookupCardsCached).not.toHaveBeenCalled();
  expect(vi.mocked(useRecordRecentDeck).mock.calls.every(([, deck]) => deck == null)).toBe(true);
  fireEvent.keyDown(window, { key: 's', ctrlKey: true });
  fireEvent.keyDown(screen.getByText('Lightning Bolt'), { key: 'Delete' });
  expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  expect(getCachedDeck(5)).toBeUndefined();
  const header = screen.getByRole('textbox', { name: 'DeckHeader.name' }).closest('header');
  const mainPane = screen.getByRole('button', { name: 'Lightning Bolt' }).closest('[role=grid]')!
    .parentElement!.parentElement!.parentElement;
  await act(async () => resolve({
    name: 'Pending deck', format: 'commander', meta: { v: 1, updatedAt: '' },
    cards: [{ name: 'Lightning Bolt', quantity: 4, category: 'main', typeLine: 'Instant', lookupSource: 'scryfall' }],
  }));
  expect(screen.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'DeckHeader.name' })).toBeEnabled();
  expect(screen.getByRole('textbox', { name: 'DeckHeader.name' }).closest('header')).toBe(header);
  expect(screen.getByRole('button', { name: 'Lightning Bolt' }).closest('[role=grid]')!
    .parentElement!.parentElement!.parentElement).toBe(mainPane);
  expect(inspector.getByText('DeckBreakdown.stat.avgCmc')).toBeVisible();
  expect(inspector.getByText('SampleHand.title')).toBeVisible();
  expect(screen.queryByText('DeckEditor.hydrating')).not.toBeInTheDocument();
  expect(fetchPricesForCards).toHaveBeenCalled();
  expect(lookupCardsCached).toHaveBeenCalled();
  expect(vi.mocked(useRecordRecentDeck).mock.lastCall?.[1]?.name).toBe('Pending deck');
});
