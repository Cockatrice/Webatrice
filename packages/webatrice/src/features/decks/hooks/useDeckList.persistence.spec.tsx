import 'fake-indexeddb/auto';
import { act, cleanup, waitFor } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Response_DeckListSchema, ServerInfo_DeckStorage_TreeItemSchema } from '@cockatrice/sockatrice/generated';
import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { dexieService } from '../../../services/dexie/DexieService';
import { endSession } from '../../../services/session';
import { deckSummaryScope } from '../deckSummaryCache';
import { useDeckList, clearDecksListCache, type UseDeckList } from './useDeckList';
import { useDeckSummaryInvalidation } from './useDeckSummaryInvalidation';

vi.unmock('dexie');

let latest: UseDeckList;
function Probe() {
  latest = useDeckList({ onDeckCreated: vi.fn() });
  return null;
}
function Observer() {
  useDeckSummaryInvalidation();
  return null;
}
const xml = (format: string) => `<cockatrice_deck version="1"><deckname>D</deckname><format>${format}</format>`
  + '<zone name="main"/></cockatrice_deck>';
const listing = (time = 10) => create(Response_DeckListSchema, { root: { items: [
  { id: 1, name: 'First', file: { creationTime: time, isPublic: true, bannerCardName: 'Island', colorIdentity: 'U' } },
  { id: 2, name: 'Second', file: { creationTime: 20 } },
] } });

function setup(tree = listing(), user = 'testUser', host = 'wss://server.example:4748/') {
  const webClient = createMockWebClient();
  Object.assign(webClient.socket, { connectedEndpoint: host });
  return renderWithProviders(<><Observer /><Probe /></>, { webClient, preloadedState: {
    ...connectedState,
    server: { ...connectedState.server!, user: { ...connectedState.server!.user!, name: user }, backendDecks: tree },
  } });
}

async function seed() {
  const view = setup();
  await waitFor(() => expect(view.webClient.request.session.deckDownload).toHaveBeenCalledTimes(2));
  act(() => {
    view.store.dispatch(server.Actions.deckDownloaded({ deckId: 1, deck: xml('modern') }));
    view.store.dispatch(server.Actions.deckDownloaded({ deckId: 2, deck: xml('legacy') }));
  });
  await waitFor(async () => expect(await dexieService.deckSummaries.count()).toBe(2));
  view.unmount();
  clearDecksListCache();
  return view;
}

beforeEach(async () => {
  clearDecksListCache();
  await dexieService.deckSummaries.clear();
});
afterEach(cleanup);

it('reloads an unchanged listing with zero downloads and keeps documents available for details editing', async () => {
  await seed();
  const view = setup();
  await waitFor(() => expect(latest.summaries.size).toBe(2));
  expect(view.webClient.request.session.deckDownload).not.toHaveBeenCalled();
  expect(latest.decks.map((deck) => deck.id)).toEqual([2, 1]);
  expect(latest.documents.get(1)).toBe(xml('modern'));
  expect(latest.decks[1]).toMatchObject({ isPublic: true, bannerCardName: 'Island', colorIdentity: 'U' });
});

it('downloads only the deck with a changed timestamp', async () => {
  await seed();
  const view = setup(listing(30));
  await waitFor(() => expect(view.webClient.request.session.deckDownload).toHaveBeenCalledExactlyOnceWith(1));
  expect(latest.summaries.get(2)?.format).toBe('legacy');
  expect(latest.summaries.has(1)).toBe(false);
});

it.each([
  ['otherUser', 'wss://server.example:4748/'],
  ['testUser', 'wss://other.example:4748/'],
])('does not reuse another account or host: %s %s', async (user, host) => {
  await seed();
  const view = setup(listing(), user, host);
  expect(latest.summaries.size).toBe(0);
  await waitFor(() => expect(view.webClient.request.session.deckDownload).toHaveBeenCalledTimes(2));
  expect(latest.documents.size).toBe(0);
});

it('prunes deleted decks, including an empty listing, without deleting another account', async () => {
  const seeded = await seed();
  const scope = deckSummaryScope(seeded.store.getState(), seeded.webClient)!;
  await dexieService.deckSummaries.put({ scope: 'other', deckId: 1, creationTime: 10 });
  const tree = create(Response_DeckListSchema, { root: { items: [] } });
  setup(tree);
  await waitFor(async () => expect(await dexieService.deckSummaries.where('scope').equals(scope).count()).toBe(0));
  expect(await dexieService.deckSummaries.get(['other', 1, 10])).toBeDefined();
});

it.each(['update', 'upload'])('invalidates a same-second %s while the list is unmounted', async (kind) => {
  const seeded = await seed();
  const observer = renderWithProviders(<Observer />, { store: seeded.store, webClient: seeded.webClient });
  act(() => {
    const treeItem = create(ServerInfo_DeckStorage_TreeItemSchema, { id: 1, name: 'First', file: { creationTime: 10 } });
    seeded.store.dispatch(kind === 'update'
      ? server.Actions.deckUpdated({ deckId: 1, treeItem })
      : server.Actions.deckUpload({ path: '', treeItem }));
  });
  await waitFor(async () => expect(await dexieService.deckSummaries.count()).toBe(1));
  observer.unmount();
  const view = setup();
  await waitFor(() => expect(view.webClient.request.session.deckDownload).toHaveBeenCalledExactlyOnceWith(1));
  expect(latest.summaries.get(2)?.format).toBe('legacy');
});

it('falls back to downloads when IndexedDB reads fail', async () => {
  await seed();
  vi.spyOn(dexieService.deckSummaries, 'where').mockImplementation(() => {
    throw new Error('unavailable');
  });
  const view = setup();
  await waitFor(() => expect(view.webClient.request.session.deckDownload).toHaveBeenCalledTimes(2));
  expect(latest.listError).toBeNull();
});

it.each(['success', 'failure'])('does not refill a saved deck with a pending old download: %s', async (outcome) => {
  const view = setup();
  await waitFor(() => expect(view.webClient.request.session.deckDownload).toHaveBeenCalledTimes(2));
  act(() => view.store.dispatch(server.Actions.deckUpdated({
    deckId: 1, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 1, name: 'First', file: { creationTime: 10 } }),
  })));
  await act(async () => {
    view.store.dispatch(outcome === 'success'
      ? server.Actions.deckDownloaded({ deckId: 1, deck: xml('old') })
      : server.Actions.deckDownloadFailed({ deckId: 1, responseCode: 17 }));
  });
  await waitFor(() => expect(view.webClient.request.session.deckDownload).toHaveBeenCalledTimes(3));
  expect(latest.summaries.has(1)).toBe(false);
  expect(await dexieService.deckSummaries.count()).toBe(0);
  act(() => view.store.dispatch(server.Actions.deckDownloaded({ deckId: 1, deck: xml('new') })));
  await waitFor(async () => expect(await dexieService.deckSummaries.count()).toBe(1));
  expect(latest.summaries.get(1)?.format).toBe('new');
});

it('retains network summaries when writes fail and retries after reload', async () => {
  vi.spyOn(dexieService.deckSummaries, 'put').mockRejectedValue(new Error('quota'));
  const first = setup();
  await waitFor(() => expect(first.webClient.request.session.deckDownload).toHaveBeenCalledTimes(2));
  act(() => first.store.dispatch(server.Actions.deckDownloaded({ deckId: 1, deck: xml('modern') })));
  expect(latest.summaries.get(1)?.format).toBe('modern');
  first.unmount();
  clearDecksListCache();
  const second = setup();
  await waitFor(() => expect(second.webClient.request.session.deckDownload).toHaveBeenCalledTimes(2));
});

it('discards a pending cache read after the session ends', async () => {
  let release!: (rows: unknown[]) => void;
  vi.spyOn(dexieService.deckSummaries, 'where').mockReturnValue({
    equals: () => ({ toArray: () => new Promise((resolve) => {
      release = resolve;
    }) }),
  } as never);
  const view = setup();
  await act(async () => {
    endSession();
    release([]);
  });
  expect(view.webClient.request.session.deckDownload).not.toHaveBeenCalled();
  expect(latest.summaries.size).toBe(0);
});

it('refresh downloads persisted decks even when their listing timestamps are unchanged', async () => {
  await seed();
  const view = setup();
  await waitFor(() => expect(latest.summaries.size).toBe(2));
  expect(view.webClient.request.session.deckDownload).not.toHaveBeenCalled();
  act(() => latest.refresh());
  expect(latest.summaries.size).toBe(0);
  expect(latest.documents.size).toBe(0);
  expect(view.webClient.request.session.deckList).toHaveBeenCalledExactlyOnceWith();
  act(() => view.store.dispatch(server.Actions.backendDecks({ deckList: listing() })));
  await waitFor(() => expect(vi.mocked(view.webClient.request.session.deckDownload).mock.calls).toEqual([[2], [1]]));
  act(() => {
    view.store.dispatch(server.Actions.deckDownloaded({ deckId: 1, deck: xml('vintage') }));
    view.store.dispatch(server.Actions.deckDownloaded({ deckId: 2, deck: xml('pauper') }));
  });
  expect(latest.summaries.get(1)?.format).toBe('vintage');
  expect(latest.summaries.get(2)?.format).toBe('pauper');
  await waitFor(async () => expect((await dexieService.deckSummaries.toArray()).map((row) => row.summary.format))
    .toEqual(['vintage', 'pauper']));
});

it.each(['success', 'failure'])('refresh discards a pending pre-refresh download: %s', async (outcome) => {
  const view = setup();
  await waitFor(() => expect(vi.mocked(view.webClient.request.session.deckDownload).mock.calls).toEqual([[2], [1]]));
  act(() => latest.refresh());
  act(() => view.store.dispatch(server.Actions.backendDecks({ deckList: listing() })));
  await act(async () => {
    view.store.dispatch(outcome === 'success'
      ? server.Actions.deckDownloaded({ deckId: 1, deck: xml('old') })
      : server.Actions.deckDownloadFailed({ deckId: 1, responseCode: 17 }));
  });
  await waitFor(() => expect(vi.mocked(view.webClient.request.session.deckDownload).mock.calls).toEqual([[2], [1], [1]]));
  expect(latest.summaries.has(1)).toBe(false);
  expect(latest.documents.has(1)).toBe(false);
  expect(await dexieService.deckSummaries.count()).toBe(0);
  act(() => view.store.dispatch(server.Actions.deckDownloaded({ deckId: 1, deck: xml('new') })));
  await waitFor(async () => expect(await dexieService.deckSummaries.count()).toBe(1));
  expect(latest.summaries.get(1)?.format).toBe('new');
  expect(latest.documents.get(1)).toBe(xml('new'));
});
