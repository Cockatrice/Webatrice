import { act, waitFor } from '@testing-library/react';

import { server, games } from '@cockatrice/datatrice';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { lookupCard, parseCod, readDeckPlaymat } from '@app/services';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { clearDeckEditorCache, getCachedDeck, setCachedDeck, setDraftDocument } from '../deckEditorCache';
import { deckSaveSignature } from '../deckPersistence';
import { hydrateDeck } from '../hydrate';
import type { HydratedDeck } from '../types';
import { useDeckEditor, type UseDeckEditor } from './useDeckEditor';

vi.mock('../hydrate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hydrate')>()),
  hydrateDeck: vi.fn(),
}));
vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCard: vi.fn(),
  trackEvent: vi.fn(),
}));

const COD = '<cockatrice_deck version="1"><deckname>Burn</deckname><format>modern</format>'
  + '<zone name="main"><card number="1" name="Sol Ring"/></zone></cockatrice_deck>';

function hydrated(overrides: Partial<HydratedDeck> = {}): HydratedDeck {
  return {
    name: 'Burn',
    meta: { v: 1, updatedAt: 'x' },
    format: 'modern',
    cards: [{ name: 'Sol Ring', quantity: 1, category: 'main', lookupSource: 'scryfall' }],
    ...overrides,
  };
}

let latest: UseDeckEditor;
function Probe({ deckId }: { deckId: number | null }) {
  latest = useDeckEditor(deckId);
  return null;
}

function DraftProbe({ draftToken }: { draftToken: string }) {
  latest = useDeckEditor(null, draftToken);
  return null;
}

function setup(deckId: number | null = 5) {
  const webClient = createMockWebClient();
  const view = renderWithProviders(<Probe deckId={deckId} />, { preloadedState: connectedState, webClient });
  const requestId = () => vi.mocked(webClient.request.session.deckDownload).mock.lastCall?.[1];
  return { ...view, webClient, requestId };
}

beforeEach(() => {
  clearDeckEditorCache();
  vi.mocked(hydrateDeck).mockResolvedValue(hydrated());
});

describe('useDeckEditor', () => {
  it('authors, removes and restores playmats through editor history and persistence', async () => {
    const { store, webClient, requestId } = setup();
    act(() => store.dispatch(server.Actions.deckDownloaded({ deckId: 5, deck: COD, requestId: requestId() })));
    await waitFor(() => expect(latest.loading).toBe(false));
    const playmat = { cardName: 'Island', cardProviderId: 'id', params: { ...games.DEFAULT_PLAYMAT_PARAMS, zoom: 2 } };
    act(() => latest.setPlaymat(playmat));
    expect(readDeckPlaymat(latest.deck!.playmatXml)).toEqual(playmat);
    expect(latest.history.undo.at(-1)?.reason).toEqual({ kind: 'playmat' });
    act(() => latest.setPlaymat(null));
    expect(readDeckPlaymat(latest.deck!.playmatXml)).toBeNull();
    act(() => latest.undo());
    expect(readDeckPlaymat(latest.deck!.playmatXml)).toEqual(playmat);
    act(() => latest.redo());
    expect(readDeckPlaymat(latest.deck!.playmatXml)).toBeNull();
    act(() => latest.undo());
    act(() => latest.flushSave());
    const command = vi.mocked(webClient.request.session.deckUpdate).mock.calls.at(-1)!;
    expect(readDeckPlaymat(parseCod(command[1]).playmatXml)).toEqual(playmat);
    act(() => command[4]!(null));
  });

  it('downloads the deck, hydrates it and seeds the session cache', async () => {
    const { webClient, store, requestId } = setup();
    expect(webClient.request.session.deckDownload).toHaveBeenCalledWith(5, expect.any(String));
    expect(latest.loading).toBe(true);

    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 5, deck: COD, requestId: requestId() }));
    });

    await waitFor(() => expect(latest.loading).toBe(false));
    expect(latest.deck?.name).toBe('Burn');
    expect(latest.totalMainboardCount).toBe(1);
    expect(getCachedDeck(5)?.savedSignature).toBe(deckSaveSignature(hydrated()));
  });

  it.each(['deck changes', 'editor unmounts'] as const)('aborts an in-flight downloaded-deck hydration when the %s', async (trigger) => {
    vi.mocked(hydrateDeck).mockImplementation((_parsed, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const { store, requestId, rerender, unmount } = setup();
    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 5, deck: COD, requestId: requestId() }));
    });
    const firstSignal = vi.mocked(hydrateDeck).mock.calls[0]?.[1];

    if (trigger === 'deck changes') {
      rerender(<Probe deckId={6} />);
    } else {
      unmount();
    }

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => undefined);
    if (trigger === 'deck changes') {
      expect(latest.notFound).toBe(false);
    }
  });

  it.each(['draft changes', 'editor unmounts'] as const)('aborts an in-flight draft hydration when the %s', async (trigger) => {
    setDraftDocument('draft-a', COD);
    setDraftDocument('draft-b', COD.replace('Burn', 'Control'));
    vi.mocked(hydrateDeck).mockImplementation((_parsed, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const webClient = createMockWebClient();
    const view = renderWithProviders(<DraftProbe draftToken="draft-a" />, { preloadedState: connectedState, webClient });
    const firstSignal = vi.mocked(hydrateDeck).mock.calls[0]?.[1];

    if (trigger === 'draft changes') {
      view.rerender(<DraftProbe draftToken="draft-b" />);
    } else {
      view.unmount();
    }

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => undefined);
    if (trigger === 'draft changes') {
      expect(latest.notFound).toBe(false);
    }
  });

  it('ignores another deck’s download', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 6, deck: COD }));
    });
    expect(hydrateDeck).not.toHaveBeenCalled();
    expect(latest.loading).toBe(true);
  });

  it('reports an unreadable deck as not found', async () => {
    const { store, requestId } = setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 5, deck: 'not xml', requestId: requestId() }));
    });
    await waitFor(() => expect(latest.notFound).toBe(true));
    expect(latest.loading).toBe(false);
  });

  it('stops loading and explains a timed-out download', () => {
    const { store, requestId } = setup();
    act(() => {
      store.dispatch(server.Actions.deckDownloadFailed({
        deckId: 5,
        requestId: requestId(),
        responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.Timeout,
      }));
    });
    expect(latest.loading).toBe(false);
    expect(latest.notFound).toBe(true);
    expect(latest.loadError).toBe('CommandFailure.timeout');
  });

  it('uses the generic download message for a server rejection', () => {
    const { store, requestId } = setup();
    act(() => {
      store.dispatch(server.Actions.deckDownloadFailed({
        deckId: 5, requestId: requestId(), responseCode: Response_ResponseCode.RespNameNotFound,
      }));
    });
    expect(latest.loadError).toBe('DeckEditor.downloadFailed');
  });

  it('ignores another deck’s download failure', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.deckDownloadFailed({ deckId: 6, responseCode: Response_ResponseCode.RespNameNotFound }));
    });
    expect(latest.loading).toBe(true);
    expect(latest.loadError).toBeNull();
  });

  it('serves a deck opened earlier this session without downloading it', () => {
    setCachedDeck(5, { deck: hydrated({ name: 'Cached' }), savedSignature: deckSaveSignature(hydrated()) });
    const { webClient } = setup();
    expect(latest.loading).toBe(false);
    expect(latest.deck?.name).toBe('Cached');
    expect(webClient.request.session.deckDownload).not.toHaveBeenCalled();
  });

  it('applies edits optimistically, marks the deck dirty and mirrors it into the cache', () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    setup();

    act(() => latest.setName('Burn v2'));
    expect(latest.deck?.name).toBe('Burn v2');
    expect(latest.saveState).toBe('dirty');
    expect(getCachedDeck(5)?.deck.name).toBe('Burn v2');

    act(() => latest.incQuantity(0, 2));
    expect(latest.deck?.cards[0].quantity).toBe(3);
    act(() => latest.setCategory(0, 'sideboard'));
    expect(latest.totalSideboardCount).toBe(3);
    act(() => latest.deleteCard(0));
    expect(latest.deck?.cards).toEqual([]);
  });

  it('adds a card by name, incrementing an existing mainboard row', async () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    vi.mocked(lookupCard).mockResolvedValue({ found: false, source: 'unknown', name: 'Mox', printings: [] });
    setup();

    await act(() => latest.addCard('sol ring'));
    expect(latest.deck?.cards).toHaveLength(1);
    expect(latest.deck?.cards[0].quantity).toBe(2);

    await act(() => latest.addCard('Mox // Back'));
    expect(lookupCard).toHaveBeenCalledWith('Mox');
    expect(latest.deck?.cards.map((c) => c.name)).toEqual(['Sol Ring', 'Mox']);
  });

  it('adds to the sideboard as its own row, with the printing the search picked', async () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    vi.mocked(lookupCard).mockResolvedValue({ found: false, source: 'unknown', name: 'Sol Ring', printings: [] });
    setup();

    await act(() => latest.addCard('Sol Ring', { zone: 'side', scryfallId: 'print-1' }));
    expect(latest.deck?.cards.map((c) => [c.name, c.category, c.quantity, c.scryfallId])).toEqual([
      ['Sol Ring', 'main', 1, undefined],
      ['Sol Ring', 'sideboard', 1, 'print-1'],
    ]);
    expect(latest.history.undo.at(-1)?.reason).toEqual({ kind: 'addCard', zone: 'sideboard', name: 'Sol Ring' });

    await act(() => latest.addCard('sol ring', { zone: 'side' }));
    expect(latest.deck?.cards[1].quantity).toBe(2);
    expect(latest.totalSideboardCount).toBe(2);
  });

  it('keeps a chosen printing as its own row instead of merging into another printing', async () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    vi.mocked(lookupCard).mockResolvedValue({ found: false, source: 'unknown', name: 'Sol Ring', printings: [] });
    setup();

    await act(() => latest.addCard('Sol Ring', { scryfallId: 'print-lea' }));
    expect(latest.deck?.cards.map((c) => [c.quantity, c.scryfallId])).toEqual([[1, undefined], [1, 'print-lea']]);

    await act(() => latest.addCard('Sol Ring', { scryfallId: 'print-lea' }));
    await act(() => latest.addCard('Sol Ring'));
    expect(latest.deck?.cards.map((c) => [c.quantity, c.scryfallId])).toEqual([[2, undefined], [2, 'print-lea']]);
  });

  it('undoes and redoes edits in order, and a new edit clears redo', () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    setup();

    act(() => latest.setFormat('legacy'));
    act(() => latest.incQuantity(0, 2));
    act(() => latest.setCategory(0, 'sideboard'));
    expect(latest.history.undo.map((m) => m.reason.kind)).toEqual(['format', 'adjustCard', 'moveCard']);

    act(() => latest.undo());
    expect(latest.deck?.cards[0].category).toBe('main');
    act(() => latest.undo(2));
    expect(latest.deck?.format).toBe('modern');
    expect(latest.deck?.cards[0].quantity).toBe(1);
    expect(latest.canUndo).toBe(false);

    act(() => latest.redo());
    expect(latest.deck?.format).toBe('legacy');
    expect(latest.canRedo).toBe(true);

    act(() => latest.setName('Burn v2'));
    expect(latest.canRedo).toBe(false);
  });

  it('records card edits under the card name, and does not record derived caches', () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    setup();

    act(() => latest.setPriceCache(3.5, 0));
    expect(latest.deck?.meta.priceUsd).toBe(3.5);
    expect(latest.canUndo).toBe(false);

    act(() => latest.setPrinting(0, { set: 'lea', collectorNumber: '1' }));
    act(() => latest.setCommander(0, true));
    act(() => latest.deleteCard(0));
    expect(latest.history.undo.map((m) => m.reason)).toEqual([
      { kind: 'changePrinting', name: 'Sol Ring', set: 'lea' },
      { kind: 'setCommander', name: 'Sol Ring' },
      { kind: 'removeCard', name: 'Sol Ring' },
    ]);
  });

  it('keeps every image candidate when selecting a printing', () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    setup();

    act(() => latest.setPrinting(0, {
      set: 'lea',
      imageUri: 'https://img/first.jpg',
      imageUris: ['https://img/first.jpg', 'https://img/second.jpg'],
    }));

    expect(latest.deck?.cards[0]).toMatchObject({
      imageUri: 'https://img/first.jpg',
      imageUris: ['https://img/first.jpg', 'https://img/second.jpg'],
    });
  });

  it('sets the banner and tags as undoable edits', () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    setup();

    act(() => latest.setBanner({ name: 'Sol Ring', providerId: 'p1' }));
    act(() => latest.setTags(['Ramp']));
    expect(latest.deck).toEqual(expect.objectContaining({ bannerCard: 'Sol Ring', bannerCardProviderId: 'p1' }));
    expect(latest.deck?.tagsXml).toBe('<tags><tag>Ramp</tag></tags>');
    expect(latest.history.undo.map((m) => m.reason)).toEqual([
      { kind: 'banner', name: 'Sol Ring' },
      { kind: 'tags' },
    ]);

    act(() => latest.setBanner(null));
    expect(latest.history.undo[2].reason).toEqual({ kind: 'bannerCleared' });
    act(() => latest.undo(3));
    expect(latest.deck?.bannerCard).toBeUndefined();
    expect(latest.deck?.tagsXml).toBeUndefined();
  });

  it('merges a typing burst in the name field into one undo step', () => {
    setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
    setup();
    act(() => latest.setName('B'));
    act(() => latest.setName('Bu'));
    expect(latest.history.undo).toHaveLength(1);
    expect(latest.history.undo[0].reason).toEqual({ kind: 'rename', from: 'Burn', to: 'Bu' });
  });

  it('autosaves the restored deck after an undo, and sends nothing when it matches the last save', () => {
    vi.useFakeTimers();
    try {
      setCachedDeck(5, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
      const { webClient } = setup();
      act(() => latest.setFormat('legacy'));
      act(() => latest.undo());
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
      expect(latest.deck?.format).toBe('modern');
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts a fresh history when the deck is downloaded', async () => {
    const { store, webClient, requestId } = setup();
    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 5, deck: COD, requestId: requestId() }));
    });
    await waitFor(() => expect(latest.loading).toBe(false));
    act(() => latest.setFormat('legacy'));
    expect(latest.canUndo).toBe(true);

    clearDeckEditorCache();
    const status = (state: WebsocketTypes.StatusEnum) => server.Actions.updateStatus({ status: { state, description: null } });
    act(() => store.dispatch(status(WebsocketTypes.StatusEnum.DISCONNECTED)));
    act(() => store.dispatch(status(WebsocketTypes.StatusEnum.LOGGED_IN)));
    expect(webClient.request.session.deckDownload).toHaveBeenCalledTimes(2);
    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 5, deck: COD, requestId: requestId() }));
    });
    await waitFor(() => expect(latest.loading).toBe(false));
    expect(latest.canUndo).toBe(false);
  });

  it('does nothing without a deck id', () => {
    const { webClient } = setup(null);
    expect(webClient.request.session.deckDownload).not.toHaveBeenCalled();
  });
});
