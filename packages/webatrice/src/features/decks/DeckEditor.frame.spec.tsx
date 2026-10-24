import { act, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { Route, Routes } from 'react-router-dom';
import { server } from '@cockatrice/datatrice';
import { Response_DeckListSchema } from '@cockatrice/sockatrice/generated';
import { recordRecentDeck, resetRecentDecksCache } from '@app/services';
import { connected31State, disconnectedState, createMockWebClient, renderWithProviders } from '../../__test-utils__';
import DeckEditor from './DeckEditor';
import { clearDeckEditorCache } from './deckEditorCache';
import { hydrateDeck } from './hydrate';
import type { HydratedDeck } from './types';

vi.mock('./hydrate', async (original) => ({ ...await original<typeof import('./hydrate')>(), hydrateDeck: vi.fn() }));
vi.mock('./pricing', async (original) => ({
  ...await original<typeof import('./pricing')>(), fetchPricesForCards: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@app/services', async (original) => ({
  ...await original<typeof import('@app/services')>(), lookupCardsCached: vi.fn().mockResolvedValue(new Map()),
}));

beforeEach(() => {
  clearDeckEditorCache();
  localStorage.clear();
  resetRecentDecksCache();
});

function setup(connected = true, listed = true, routed = true) {
  const webClient = createMockWebClient();
  Object.assign(webClient.socket, { connectedEndpoint: 'wss://server.example:4748/' });
  const state = connected ? connected31State : disconnectedState;
  const content = routed ? (
    <Routes>
      <Route path="/deck/:deckId" element={<DeckEditor />} />
      <Route path="/login" element={<div>Login destination</div>} />
    </Routes>
  ) : <DeckEditor />;
  const view = renderWithProviders(content, {
    route: '/deck/5', webClient, preloadedState: {
      ...state, server: { ...state.server!, backendDecks: listed ? create(Response_DeckListSchema, {
        root: { items: [{ id: 5, name: 'Tree deck', file: { creationTime: 10, colorIdentity: 'UR' } }] },
      }) : undefined },
    },
  });
  return { ...view, webClient };
}

it('keeps the real frame and disabled header mounted from click through provisional and hydrated content', async () => {
  let resolve!: (deck: HydratedDeck) => void;
  vi.mocked(hydrateDeck).mockReturnValue(new Promise((yes) => {
    resolve = yes;
  }));
  const view = setup();
  const name = screen.getByRole('textbox', { name: 'DeckHeader.name' });
  expect(name).toHaveValue('Tree deck');
  expect(name).toBeDisabled();
  expect(screen.getByRole('button', { name: 'DeckHeader.more' })).toBeDisabled();
  expect(screen.getByLabelText('Decks.badge.identity')).toBeVisible();
  const header = name.closest('header');
  const dock = screen.getByRole('complementary', { name: 'DeckEditor.dock.label' });
  const frame = dock.parentElement;
  expect(screen.getByRole('list', { name: 'DeckEditor.shell.loadingDeck' }).children).toHaveLength(6);
  act(() => view.store.dispatch(server.Actions.deckDownloaded({
    deckId: 5, deck: '<cockatrice_deck version="1"><deckname>Downloaded</deckname><format>modern</format>'
      + '<zone name="main"><card number="4" name="Lightning Bolt"/></zone></cockatrice_deck>',
    requestId: vi.mocked(view.webClient.request.session.deckDownload).mock.calls[0][1],
  })));
  expect(screen.getByRole('textbox', { name: 'DeckHeader.name' })).toBe(name);
  expect(name).toHaveValue('Downloaded');
  expect(name).toBeDisabled();
  expect(screen.getByText('Lightning Bolt')).toBeVisible();
  await act(async () => resolve({ name: 'Downloaded', format: 'modern', meta: { v: 1, updatedAt: '' }, cards: [
    { name: 'Lightning Bolt', quantity: 4, category: 'main', lookupSource: 'scryfall', typeLine: 'Instant' },
  ] }));
  expect(name).toBeEnabled();
  expect(name.closest('header')).toBe(header);
  expect(screen.getByRole('complementary', { name: 'DeckEditor.dock.label' })).toBe(dock);
  expect(dock.parentElement).toBe(frame);
  expect(screen.queryByRole('list', { name: 'DeckEditor.shell.loadingDeck' })).not.toBeInTheDocument();
});

it('shows an unknown deck in a sensible read-only frame', () => {
  setup(true, false);
  expect(screen.getByRole('textbox', { name: 'DeckHeader.name' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'DeckHeader.name' })).toHaveValue('SharedDeck.untitled');
  expect(screen.getByText('DeckEditor.hydrating')).toBeVisible();
  expect(screen.getByRole('list', { name: 'DeckEditor.shell.loadingDeck' }).children).toHaveLength(6);
});

it('shows reconnect messaging while the editor remains mounted without a connection', () => {
  setup(false, false, false);
  expect(screen.getByRole('textbox', { name: 'DeckHeader.name' })).toBeDisabled();
  expect(screen.getAllByText('Decks.grid.disconnected')[0]).toBeVisible();
  expect(screen.queryByRole('list', { name: 'DeckEditor.shell.loadingDeck' })).not.toBeInTheDocument();
});

it('preserves the authentication redirect when the route guard navigates first', () => {
  setup(false);
  expect(screen.getByText('Login destination')).toBeVisible();
  expect(screen.queryByRole('textbox', { name: 'DeckHeader.name' })).not.toBeInTheDocument();
});

it.each([[3, 3], [100, 12]])('shows known format and caps placeholders for %s cards at %s rows', async (count, rows) => {
  await recordRecentDeck({ scope: 'wss://server.example:4748', owner: 'testUser', deckId: 5,
    name: 'Recent deck', format: 'modern', colors: 'UR', cardCount: count, openedAt: 1 });
  setup();
  expect(screen.getByRole('combobox')).toHaveValue('modern');
  expect(screen.getByRole('list', { name: 'DeckEditor.shell.loadingDeck' }).children).toHaveLength(rows);
});
