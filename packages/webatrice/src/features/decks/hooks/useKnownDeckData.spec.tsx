import { act, waitFor } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Response_DeckListSchema } from '@cockatrice/sockatrice/generated';
import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { resetRecentDecksCache, recordRecentDeck } from '@app/services';
import { readDeckSummary, type CachedDeckSummary } from '../deckSummaryCache';
import { useKnownDeckData } from './useKnownDeckData';

vi.mock('../deckSummaryCache', async (original) => ({
  ...await original<typeof import('../deckSummaryCache')>(), readDeckSummary: vi.fn().mockResolvedValue(undefined),
}));

let known: ReturnType<typeof useKnownDeckData>;
function Probe() {
  known = useKnownDeckData(5);
  return null;
}

function setup(user = 'testUser', host = 'wss://server.example:4748/', listed = true) {
  const webClient = createMockWebClient();
  Object.assign(webClient.socket, { connectedEndpoint: host });
  return renderWithProviders(<Probe />, { webClient, preloadedState: {
    ...connectedState, server: { ...connectedState.server!, user: { ...connectedState.server!.user!, name: user },
      backendDecks: listed ? create(Response_DeckListSchema, { root: { items: [
        { id: 5, name: 'Tree name', file: { creationTime: 10, colorIdentity: 'UR', bannerCardName: 'Tree art', tags: ['Tree tag'] } },
      ] } }) : undefined,
    },
  } });
}

const row: CachedDeckSummary = {
  scope: JSON.stringify(['wss://server.example:4748', 'testUser']), deckId: 5, creationTime: 10,
  summary: { format: 'modern', cardCount: 100, bannerCard: 'Cached art' }, document: '',
};

beforeEach(async () => {
  localStorage.clear();
  resetRecentDecksCache();
  vi.mocked(readDeckSummary).mockResolvedValue(undefined);
  await recordRecentDeck({ scope: 'wss://server.example:4748', owner: 'testUser', deckId: 5,
    name: 'Recent name', format: 'legacy', colors: 'G', cardCount: 60, openedAt: 1, bannerCard: 'Recent art' });
});

it('uses tree metadata immediately, fills missing data from this account snapshot, then uses the creation-matched summary', async () => {
  vi.mocked(readDeckSummary).mockResolvedValue(row);
  setup();
  expect(known.deck.name).toBe('Tree name');
  expect(known.deck.format).toBe('legacy');
  expect(known.colors).toBe('UR');
  expect(known.deck.bannerCard).toBe('Tree art');
  expect(known.tags).toEqual(['Tree tag']);
  expect(known.cardCount).toBe(60);
  await waitFor(() => expect(known.deck.format).toBe('modern'));
  expect(readDeckSummary).toHaveBeenCalledWith(row.scope, 5, 10);
  expect(known.cardCount).toBe(100);
});

it('uses a matching recent snapshot without a tree entry', () => {
  setup('testUser', 'wss://server.example:4748/', false);
  expect(known.deck).toMatchObject({ name: 'Recent name', format: 'legacy', bannerCard: 'Recent art' });
  expect(known.colors).toBe('G');
  expect(known.cardCount).toBe(60);
  expect(readDeckSummary).not.toHaveBeenCalled();
});

it.each([
  ['someoneElse', 'wss://server.example:4748/'],
  ['testUser', 'wss://other.example:4748/'],
])('does not use snapshots for a different user or endpoint: %s %s', (user, host) => {
  setup(user, host, false);
  expect(known.deck.name).toBe('SharedDeck.untitled');
  expect(known.deck.format).toBe('');
  expect(known.cardCount).toBeUndefined();
});

it('rejects a summary with a different creation time', async () => {
  vi.mocked(readDeckSummary).mockResolvedValue({ ...row, creationTime: 9 });
  setup();
  await act(async () => {});
  expect(known.deck.format).toBe('legacy');
});

it('ignores an in-flight summary after the account changes', async () => {
  let resolve!: (value: CachedDeckSummary) => void;
  vi.mocked(readDeckSummary).mockReturnValueOnce(new Promise((yes) => {
    resolve = yes;
  }));
  const view = setup();
  act(() => view.store.dispatch(server.Actions.clearStore()));
  await act(async () => resolve(row));
  expect(known.deck.name).toBe('SharedDeck.untitled');
  expect(known.deck.format).toBe('');
  expect(known.cardCount).toBeUndefined();
});
