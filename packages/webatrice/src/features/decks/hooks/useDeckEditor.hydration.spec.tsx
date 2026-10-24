import 'fake-indexeddb/auto';
import { act, waitFor } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Response_DeckListSchema } from '@cockatrice/sockatrice/generated';
import { parseCod, trackEvent } from '@app/services';
import { endSession } from '@app/services/session';
import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { dexieService } from '../../../services/dexie/DexieService';
import { getCachedDeck, getCachedDraft, setDraftDocument } from '../deckEditorCache';
import { deckSaveSignature } from '../deckPersistence';
import { deckSummaryScope, invalidateDeckSummary, writeDeckSummary, deckSummaryRevision } from '../deckSummaryCache';
import * as summaryCache from '../deckSummaryCache';
import { summarizeDeck } from '../deckSummary';
import { assembleDeckCard, hydrateDeck, type DeckCardDataRefresh } from '../hydrate';
import type { HydratedDeck } from '../types';
import { useDeckEditor, type UseDeckEditor } from './useDeckEditor';

vi.unmock('dexie');
vi.mock('../hydrate', async (original) => ({ ...await original<typeof import('../hydrate')>(), hydrateDeck: vi.fn() }));
vi.mock('@app/services', async (original) => ({ ...await original<typeof import('@app/services')>(), trackEvent: vi.fn() }));

const cod = (name = 'Saved', format = 'modern') => `<cockatrice_deck version="1"><deckname>${name}</deckname><format>${format}</format>`
  + '<zone name="main"><card number="4" name="Lightning Bolt" set="M11"/></zone>'
  + '<zone name="side"><card number="2" name="Mountain"/></zone></cockatrice_deck>';
const listing = (creationTime = 10) => create(Response_DeckListSchema, { root: { items: [
  { id: 5, name: 'Deck', file: { creationTime } }, { id: 6, name: 'Other', file: { creationTime: 20 } },
] } });
const hydrated = (document = cod()): HydratedDeck => {
  const parsed = parseCod(document);
  return { ...parsed, format: parsed.format || 'modern', cards: parsed.cards.map((row) => ({
    ...assembleDeckCard(row, undefined), lookupSource: 'scryfall', typeLine: 'Instant',
  })) };
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes; reject = no;
  });
  return { promise, resolve, reject };
}
let editor: UseDeckEditor;
function Probe({ id = 5, token = null }: { id?: number | null; token?: string | null }) {
  editor = useDeckEditor(id, token);
  return null;
}
function setup(user = 'testUser', host = 'wss://server.example:4748/', creationTime = 10) {
  const webClient = createMockWebClient();
  Object.assign(webClient.socket, { connectedEndpoint: host });
  const view = renderWithProviders(<Probe />, { webClient, preloadedState: {
    ...connectedState,
    server: { ...connectedState.server!, user: { ...connectedState.server!.user!, name: user }, backendDecks: listing(creationTime) },
  } });
  return { ...view, webClient, download: (document = cod()) => act(() => view.store.dispatch(server.Actions.deckDownloaded({
    deckId: 5, deck: document, requestId: vi.mocked(webClient.request.session.deckDownload).mock.calls[0][1],
  }))) };
}
async function seed(document = cod()) {
  const scope = JSON.stringify(['wss://server.example:4748', 'testUser']);
  await writeDeckSummary({ scope, deckId: 5, creationTime: 10, summary: summarizeDeck(parseCod(document)), document },
    deckSummaryRevision(scope, 5));
  return scope;
}
afterEach(() => vi.useRealTimers());
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-13T00:00:00Z'));
  endSession();
  await dexieService.deckSummaries.clear();
  vi.mocked(hydrateDeck).mockImplementation(() => new Promise(() => {}));
});

it('publishes parsed rows without allowing edits, history or saves before hydration', async () => {
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValue(pending.promise);
  const view = setup();
  view.download();
  expect(editor.deck?.cards).toMatchObject([
    { name: 'Lightning Bolt', quantity: 4, category: 'main', set: 'M11', lookupSource: 'unknown' },
    { name: 'Mountain', quantity: 2, category: 'sideboard' },
  ]);
  expect(editor.hydrating).toBe(true);
  expect(editor.readOnlyReason).toBe('DeckEditor.hydrating');
  const provisional = editor.deck;
  await act(async () => {
    editor.setName('Changed'); editor.setFormat('legacy'); editor.setDescription('Changed');
    editor.setBanner({ name: 'Mountain' }); editor.setTags(['Changed']); editor.setPlaymat(null);
    editor.incQuantity(0, 1); editor.deleteCard(1); editor.setCategory(0, 'sideboard');
    editor.setCommander(0, true); editor.setPrinting(0, { set: 'NEW' });
    editor.setPriceCache(20, 0); editor.setBracketAssessment(undefined);
    await editor.addCard('Island'); editor.undo(); editor.redo();
    editor.retrySave(); editor.flushSave(); editor.resumeAutosave();
    expect(await editor.saveNow()).toBe(false);
  });
  expect(editor.deck).toBe(provisional);
  expect(editor.history.undo).toEqual([]);
  expect(editor.canUndo).toBe(false);
  expect(editor.canRedo).toBe(false);
  expect(editor.isModified).toBe(false);
  expect(getCachedDeck(5)).toBeUndefined();
  expect(trackEvent).not.toHaveBeenCalled();
  expect(view.webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  expect(view.webClient.request.session.deckUpload).not.toHaveBeenCalled();
  await act(async () => pending.resolve(hydrated()));
  expect(editor.hydrating).toBe(false);
  expect(editor.readOnlyReason).toBeNull();
  expect(editor.deck).toEqual(hydrated());
  expect(getCachedDeck(5)?.savedSignature).toBe(deckSaveSignature(hydrated()));
  expect(trackEvent).toHaveBeenCalledWith('deck_opened', { format: 'modern' });
  act(() => editor.setName('Allowed'));
  expect(editor.history.undo).toHaveLength(1);
  act(() => editor.discardChanges());
});

it.each([true, false])('shows the saved file and uses downloaded truth (equal: %s)', async (equal) => {
  const scope = await seed();
  const view = setup();
  expect(deckSummaryScope(view.store.getState(), view.webClient)).toBe(scope);
  await waitFor(() => expect(editor.deck?.name).toBe('Saved'));
  expect(editor.hydrating).toBe(true);
  expect(hydrateDeck).not.toHaveBeenCalled();
  const provisional = editor.deck;
  const document = equal ? cod() : cod('Downloaded');
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValue(pending.promise);
  view.download(document);
  expect(editor.deck?.name).toBe(equal ? 'Saved' : 'Downloaded');
  if (equal) {
    expect(editor.deck).toBe(provisional);
  }
  expect(hydrateDeck).toHaveBeenCalledWith(parseCod(document), expect.any(AbortSignal), expect.any(Function));
  await act(async () => pending.resolve(hydrated(document)));
  expect(editor.deck).toEqual(hydrated(document));
  expect(getCachedDeck(5)?.savedSignature).toBe(deckSaveSignature(hydrated(document)));
});

it.each([
  ['another account', 'someoneElse', 'wss://server.example:4748/', 10],
  ['another host', 'testUser', 'wss://other.example:4748/', 10],
  ['stale timestamp', 'testUser', 'wss://server.example:4748/', 11],
] as const)('does not display a saved copy from %s', async (_label, user, host, time) => {
  await seed();
  const read = vi.spyOn(dexieService.deckSummaries, 'where');
  setup(user, host, time);
  await waitFor(() => expect(read).toHaveBeenCalled());
  await act(async () => {
    await dexieService.deckSummaries.toArray();
  });
  expect(editor.deck).toBeNull();
});

it('rejects invalidated copies even if deletion fails', async () => {
  const scope = await seed();
  vi.spyOn(dexieService.deckSummaries, 'where').mockImplementationOnce(() => {
    throw new Error('unavailable');
  });
  await invalidateDeckSummary(scope, 5);
  setup();
  await act(async () => {
    await dexieService.deckSummaries.toArray();
  });
  expect(editor.deck).toBeNull();
});

it.each(['switch', 'unmount'] as const)('never commits old hydration after %s even when hydration ignores abort', async (action) => {
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValue(pending.promise);
  const view = setup();
  view.download();
  expect(editor.deck?.name).toBe('Saved');
  if (action === 'switch') {
    view.rerender(<Probe id={6} />);
  } else {
    view.unmount();
  }
  await act(async () => pending.resolve(hydrated()));
  expect(getCachedDeck(5)).toBeUndefined();
  expect(trackEvent).not.toHaveBeenCalled();
  if (action === 'switch') {
    expect(editor.deck).toBeNull();
  }
});

it('removes provisional rows when hydration fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValue(pending.promise);
  const view = setup();
  view.download();
  expect(editor.deck).not.toBeNull();
  await act(async () => pending.reject(new Error('failed')));
  expect(editor.notFound).toBe(true);
  expect(editor.deck).toBeNull();
  expect(getCachedDeck(5)).toBeUndefined();
  expect(await editor.saveNow()).toBe(false);
});

it('renders a draft provisionally without caching or uploading it', async () => {
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValue(pending.promise);
  setDraftDocument('draft', cod());
  const webClient = createMockWebClient();
  renderWithProviders(<Probe id={null} token="draft" />, { preloadedState: connectedState, webClient });
  expect(editor.deck?.name).toBe('Saved');
  expect(editor.hydrating).toBe(true);
  expect(getCachedDraft('draft')).toBeUndefined();
  expect(await editor.saveNow()).toBe(false);
  expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
  await act(async () => pending.resolve(hydrated()));
  expect(editor.hydrating).toBe(false);
  expect(getCachedDraft('draft')).toEqual(hydrated());
});

it('defers migration until hydration replaces the provisional deck', async () => {
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValue(pending.promise);
  const document = cod('Migration', '');
  const view = setup();
  view.download(document);
  expect(editor.deck?.name).toBe('Migration');
  expect(editor.isModified).toBe(false);
  expect(getCachedDeck(5)).toBeUndefined();
  await act(async () => pending.resolve(hydrated(document)));
  expect(getCachedDeck(5)?.savedSignature).toBeNull();
  expect(editor.isModified).toBe(true);
  act(() => editor.flushSave());
  expect(view.webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
  expect(parseCod(vi.mocked(view.webClient.request.session.deckUpdate).mock.calls[0][1]).format).toBe('modern');
});

it('shows the same file provisionally when switching between draft tokens', async () => {
  setDraftDocument('first', cod());
  setDraftDocument('second', cod());
  const view = renderWithProviders(<Probe id={null} token="first" />, { preloadedState: connectedState });
  expect(editor.deck?.name).toBe('Saved');
  view.rerender(<Probe id={null} token="second" />);
  expect(editor.hydrating).toBe(true);
  expect(editor.deck?.name).toBe('Saved');
});

it.each(['switch', 'unmount'] as const)('ignores late draft hydration after %s', async (action) => {
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValueOnce(pending.promise);
  setDraftDocument('first', cod());
  setDraftDocument('second', cod('Second'));
  const view = renderWithProviders(<Probe id={null} token="first" />, { preloadedState: connectedState });
  expect(editor.deck?.name).toBe('Saved');
  if (action === 'switch') {
    view.rerender(<Probe id={null} token="second" />);
  } else {
    view.unmount();
  }
  await act(async () => pending.resolve(hydrated()));
  expect(getCachedDraft('first')).toBeUndefined();
  if (action === 'switch') {
    expect(editor.deck?.name).toBe('Second');
  }
});

it('keeps saved files intact when the current deck tree is not available', async () => {
  const scope = await seed();
  const webClient = createMockWebClient();
  Object.assign(webClient.socket, { connectedEndpoint: 'wss://server.example:4748/' });
  renderWithProviders(<Probe />, { webClient, preloadedState: connectedState });
  await act(async () => {
    await dexieService.deckSummaries.toArray();
  });
  expect(editor.deck).toBeNull();
  expect(await dexieService.deckSummaries.get([scope, 5, 10])).toBeDefined();
});

it('clears a provisional saved copy when the account disconnects', async () => {
  await seed();
  const view = setup();
  await waitFor(() => expect(editor.deck?.name).toBe('Saved'));
  act(() => view.store.dispatch(server.Actions.disconnected()));
  expect(editor.deck).toBeNull();
  expect(getCachedDeck(5)).toBeUndefined();
});

it('clears the saved provisional copy when the download fails', async () => {
  await seed();
  const view = setup();
  await waitFor(() => expect(editor.deck?.name).toBe('Saved'));
  act(() => view.store.dispatch(server.Actions.deckDownloadFailed({
    deckId: 5, responseCode: 3, requestId: vi.mocked(view.webClient.request.session.deckDownload).mock.calls[0][1],
  })));
  expect(editor.notFound).toBe(true);
  expect(editor.deck).toBeNull();
  expect(await editor.saveNow()).toBe(false);
  expect(getCachedDeck(5)).toBeUndefined();
});

it.each(['download', 'switch', 'unmount', 'account'] as const)('ignores a cache read that finishes after %s', async (action) => {
  const pending = deferred<summaryCache.CachedDeckSummary>();
  vi.spyOn(summaryCache, 'readDeckSummary').mockReturnValueOnce(pending.promise);
  const view = setup();
  const scope = deckSummaryScope(view.store.getState(), view.webClient)!;
  if (action === 'download') {
    view.download(cod('Downloaded'));
  } else if (action === 'switch') {
    view.rerender(<Probe id={6} />);
  } else if (action === 'account') {
    act(() => view.store.dispatch(server.Actions.updateUser({ user: { name: 'Another' } })));
  } else {
    view.unmount();
  }
  await act(async () => pending.resolve(
    { scope, deckId: 5, creationTime: 10, document: cod(), summary: summarizeDeck(parseCod(cod())) },
  ));
  expect(editor.deck?.name).toBe(action === 'download' ? 'Downloaded' : undefined);
  expect(getCachedDeck(5)).toBeUndefined();
});

it('clears a provisional draft and ignores late hydration when the session ends', async () => {
  const pending = deferred<HydratedDeck>();
  vi.mocked(hydrateDeck).mockReturnValue(pending.promise);
  setDraftDocument('draft', cod());
  renderWithProviders(<Probe id={null} token="draft" />, { preloadedState: connectedState });
  expect(editor.deck?.name).toBe('Saved');
  act(() => endSession());
  expect(editor.deck).toBeNull();
  await act(async () => pending.resolve(hydrated()));
  expect(editor.deck).toBeNull();
  expect(getCachedDraft('draft')).toBeUndefined();
});

it.each(['dirty', 'saving'] as const)('does not show deck A\'s %s state while deck B is provisional', async (state) => {
  vi.mocked(hydrateDeck).mockResolvedValueOnce(hydrated(cod('Alpha')));
  const view = setup();
  view.download(cod('Alpha'));
  await waitFor(() => expect(editor.hydrating).toBe(false));
  act(() => editor.setName('Edited Alpha'));
  expect(editor.isModified).toBe(true);
  expect(editor.saveState).toBe('dirty');
  if (state === 'saving') {
    act(() => editor.flushSave());
    expect(editor.saveState).toBe('saving');
  }
  view.rerender(<Probe id={6} />);
  expect(editor.isModified).toBe(false);
  expect(editor.saveState).toBe('idle');
  act(() => view.store.dispatch(server.Actions.deckDownloaded({
    deckId: 6, deck: cod('Bravo'), requestId: vi.mocked(view.webClient.request.session.deckDownload).mock.lastCall![1],
  })));
  expect(editor.deck?.name).toBe('Bravo');
  expect(editor.hydrating).toBe(true);
  expect(editor.isModified).toBe(false);
  expect(editor.saveState).toBe('idle');
  const update = vi.mocked(view.webClient.request.session.deckUpdate).mock.lastCall!;
  expect(update[0]).toBe(5);
  act(() => update[4]!(null));
  expect(editor.isModified).toBe(false);
  expect(editor.saveState).toBe('idle');
  expect(getCachedDeck(6)).toBeUndefined();
});

it.each([false, true])('patches metadata without changing dirty state or scheduling a save (dirty: %s)', async (dirty) => {
  const pending = deferred<DeckCardDataRefresh>();
  const initial = hydrated();
  vi.mocked(hydrateDeck).mockImplementation(async (_parsed, _signal, receiveRefresh) => {
    receiveRefresh?.(pending.promise);
    return initial;
  });
  const view = setup();
  view.download();
  await waitFor(() => expect(editor.hydrating).toBe(false));
  act(() => editor.pauseAutosave());
  if (dirty) {
    act(() => {
      editor.incQuantity(0, 2); editor.setCategory(0, 'sideboard'); editor.deleteCard(1);
    });
  }
  const before = editor.deck!;
  const history = editor.history;
  await act(async () => pending.resolve([{ card: initial.cards[0], lookup: {
    name: 'Lightning Bolt', found: true, source: 'scryfall', typeLine: 'Sorcery', manaCost: '{R}',
    printings: [{ set: 'M11', collectorNumber: '146', scryfallId: 'new-id', imageUri: 'https://new/image' }],
    legalities: { modern: 'banned' },
  } }]));
  expect(editor.deck?.cards[0]).toMatchObject({ typeLine: 'Sorcery', manaCost: '{R}', imageUri: 'https://new/image' });
  expect(deckSaveSignature(editor.deck!)).toBe(deckSaveSignature(before));
  expect(editor.isModified).toBe(dirty);
  expect(editor.history).toBe(history);
  expect(editor.deck?.cards[0].quantity).toBe(dirty ? 6 : 4);
  expect(editor.deck?.cards[0].category).toBe(dirty ? 'sideboard' : 'main');
  expect(editor.deck?.cards).toHaveLength(dirty ? 1 : 2);
  expect(view.webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  expect(view.webClient.request.session.deckUpload).not.toHaveBeenCalled();
  if (!dirty) {
    act(() => {
      editor.resumeAutosave(); editor.flushSave();
    });
    expect(view.webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  }
  act(() => editor.discardChanges());
});

it('does not patch a printing chosen while refresh was pending', async () => {
  const pending = deferred<DeckCardDataRefresh>();
  const initial = hydrated();
  vi.mocked(hydrateDeck).mockImplementation(async (_parsed, _signal, receiveRefresh) => {
    receiveRefresh?.(pending.promise);
    return initial;
  });
  const view = setup();
  view.download();
  await waitFor(() => expect(editor.hydrating).toBe(false));
  act(() => {
    editor.pauseAutosave(); editor.setPrinting(0, { set: 'NEW', scryfallId: 'chosen', imageUri: 'https://chosen/image' });
  });
  const before = editor.deck;
  await act(async () => pending.resolve([{ card: initial.cards[0], lookup: {
    name: 'Lightning Bolt', found: true, source: 'scryfall', typeLine: 'Sorcery', printings: [],
  } }]));
  expect(editor.deck).toBe(before);
  expect(editor.deck?.cards[0].scryfallId).toBe('chosen');
  act(() => editor.discardChanges());
});

it.each(['switch', 'unmount', 'session'] as const)('drops a background refresh after %s', async (reason) => {
  const pending = deferred<DeckCardDataRefresh>();
  const initial = hydrated();
  vi.mocked(hydrateDeck).mockImplementation(async (_parsed, _signal, receiveRefresh) => {
    receiveRefresh?.(pending.promise);
    return initial;
  });
  const view = setup();
  view.download();
  await waitFor(() => expect(editor.hydrating).toBe(false));
  if (reason === 'switch') {
    vi.mocked(hydrateDeck).mockResolvedValueOnce(hydrated(cod('Other')));
    view.rerender(<Probe id={6} />);
    act(() => view.store.dispatch(server.Actions.deckDownloaded({ deckId: 6, deck: cod('Other'),
      requestId: vi.mocked(view.webClient.request.session.deckDownload).mock.lastCall![1],
    })));
    await waitFor(() => expect(editor.hydrating).toBe(false));
  }
  if (reason === 'unmount') {
    view.unmount();
  }
  if (reason === 'session') {
    act(() => endSession());
  }
  const before = editor.deck;
  await act(async () => pending.resolve([{ card: initial.cards[0], lookup: {
    name: 'Lightning Bolt', found: true, source: 'scryfall', typeLine: 'Sorcery', printings: [],
  } }]));
  expect(editor.deck).toBe(before);
  expect(getCachedDeck(5)?.deck.cards[0].typeLine).not.toBe('Sorcery');
  expect(view.webClient.request.session.deckUpdate).not.toHaveBeenCalled();
});

it('keeps the deck object and render count unchanged for identical refreshed data', async () => {
  const lookup = { name: 'Lightning Bolt', found: true, source: 'scryfall' as const, typeLine: 'Instant',
    printings: [{ set: 'M11', imageUri: 'https://same/image' }],
  };
  const initial = hydrated();
  initial.cards[0] = assembleDeckCard(initial.cards[0], lookup);
  const pending = deferred<DeckCardDataRefresh>();
  vi.mocked(hydrateDeck).mockImplementation(async (_parsed, _signal, receiveRefresh) => {
    receiveRefresh?.(pending.promise);
    return initial;
  });
  const view = setup();
  view.download();
  await waitFor(() => expect(editor.hydrating).toBe(false));
  const before = editor;
  await act(async () => pending.resolve([{ card: initial.cards[0], lookup: { ...lookup, fetchedAt: Date.now() } }]));
  expect(editor).toBe(before);
  expect(editor.deck).toBe(initial);
  expect(view.webClient.request.session.deckUpdate).not.toHaveBeenCalled();
});
