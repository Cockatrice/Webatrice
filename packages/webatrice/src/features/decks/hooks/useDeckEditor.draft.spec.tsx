import { act, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { stageDeckDocument } from '@app/services';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { clearDeckEditorCache, getCachedDeck, getCachedDraft, setCachedDraft } from '../deckEditorCache';
import { useDeckEditor, type UseDeckEditor } from './useDeckEditor';

vi.mock('../../../services/cards/catalog/lookup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/cards/catalog/lookup')>();
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    ...actual,
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCardsForHydration: vi.fn(async (inputs: Array<string | { name: string }>) => ({
      lookups: new Map(inputs.map((input) => {
        const hint = typeof input === 'string' ? { name: input } : input;
        return [actual.printingKey(hint), unknown(hint.name)];
      })),
      refreshed: Promise.resolve(new Map()),
    })),
  };
});

const GAME_DECK = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<cockatrice_deck version="1">',
  '<deckname>Burn</deckname>',
  '<zone name="main">',
  '<card number="4" name="Lightning Bolt" setShortName="M11" collectorNumber="149" uuid="bolt-uuid"/>',
  '</zone>',
  '<zone name="side">',
  '<card number="2" name="Smash to Smithereens" setShortName="SOM" collectorNumber="104" uuid="smash-uuid"/>',
  '</zone>',
  '</cockatrice_deck>',
].join('');

const editor: { current: UseDeckEditor | null } = { current: null };
const location: { pathname: string } = { pathname: '' };

function DraftProbe({ token }: { token: string }) {
  editor.current = useDeckEditor(null, token);
  location.pathname = useLocation().pathname;
  return null;
}

function setupDraft(token: string) {
  const webClient = createMockWebClient();
  const result = renderWithProviders(<DraftProbe token={token} />, {
    preloadedState: connectedState,
    webClient,
    route: `/deck/draft/${token}`,
  });
  return { ...result, webClient };
}

beforeEach(() => {
  clearDeckEditorCache();
  editor.current = null;
});

describe('useDeckEditor draft', () => {
  it.each([true, false])('switches draft route tokens without remounting and reseeds B (cached: %s)', async (cached) => {
    const tokenA = stageDeckDocument(GAME_DECK);
    const tokenB = stageDeckDocument(GAME_DECK.replace('Burn', 'Draft B'));
    let navigate!: ReturnType<typeof useNavigate>;
    let instance!: object;
    function RoutedDraftProbe() {
      instance = useRef({}).current;
      navigate = useNavigate();
      editor.current = useDeckEditor(null, useParams().token!);
      return null;
    }
    const webClient = createMockWebClient();
    renderWithProviders(<Routes><Route path="/deck/draft/:token" element={<RoutedDraftProbe />} /></Routes>, {
      preloadedState: connectedState, webClient, route: `/deck/draft/${tokenA}`,
    });
    await waitFor(() => expect(editor.current!.loading).toBe(false));
    const originalInstance = instance;
    if (cached) {
      setCachedDraft(tokenB, { ...editor.current!.deck!, name: 'Draft B' });
    }
    act(() => editor.current!.setName('Draft A edited'));
    act(() => navigate(`/deck/draft/${tokenB}`));
    await waitFor(() => expect(editor.current!.deck?.name).toBe('Draft B'));
    expect(instance).toBe(originalInstance);
    expect(editor.current!.canUndo).toBe(false);
    expect(editor.current!.saveState).toBe('idle');
    expect(getCachedDraft(tokenA)?.name).toBe('Draft A edited');
    expect(getCachedDraft(tokenB)?.name).toBe('Draft B');
    act(() => {
      editor.current!.setName('Draft B edited');
      editor.current!.flushSave();
    });
    const uploads = vi.mocked(webClient.request.session.deckUpload).mock.calls;
    expect(uploads).toHaveLength(2);
    expect(uploads[0][2]).toContain('<deckname>Draft A edited</deckname>');
    expect(uploads[1][2]).toContain('<deckname>Draft B edited</deckname>');
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  });

  it('hydrates the staged deck with every printing field, downloading nothing', async () => {
    const { webClient } = setupDraft(stageDeckDocument(GAME_DECK));
    await waitFor(() => expect(editor.current!.loading).toBe(false));

    expect(editor.current!.deck!.name).toBe('Burn');
    expect(editor.current!.deck!.cards.map((c) => [c.name, c.category, c.quantity, c.set, c.collectorNumber, c.scryfallId]))
      .toEqual([
        ['Lightning Bolt', 'main', 4, 'M11', '149', 'bolt-uuid'],
        ['Smash to Smithereens', 'sideboard', 2, 'SOM', '104', 'smash-uuid'],
      ]);
    expect(webClient.request.session.deckDownload).not.toHaveBeenCalled();
  });

  it('stores the draft as a new deck on its first save, then moves to it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { webClient, store } = setupDraft(stageDeckDocument(GAME_DECK));
      await waitFor(() => expect(editor.current!.loading).toBe(false));
      expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();

      act(() => editor.current!.setName('Burn v2'));
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
      const [path, deckId, xml] = vi.mocked(webClient.request.session.deckUpload).mock.calls[0];
      expect([path, deckId]).toEqual(['', 0]);
      expect(xml).toContain('<deckname>Burn v2</deckname>');
      expect(xml).toContain('collectorNumber="149"');
      expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
      expect(editor.current!.saveState).toBe('saving');

      act(() => {
        store.dispatch(server.Actions.deckUpload({
          path: '',
          requestId: vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5],
          treeItem: { id: 42, name: 'Burn v2' } as Parameters<typeof server.Actions.deckUpload>[0]['treeItem'],
        }));
      });
      expect(editor.current!.saveState).toBe('saved');
      expect(location.pathname).toBe('/deck/42');
      expect(getCachedDeck(42)?.deck.name).toBe('Burn v2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stores nothing for a derived cache until the first user edit, which carries it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { webClient } = setupDraft(stageDeckDocument(GAME_DECK));
      await waitFor(() => expect(editor.current!.loading).toBe(false));

      act(() => editor.current!.setPriceCache(3.5, 2));
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();

      act(() => editor.current!.setName('Burn v2'));
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
      const xml = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][2];
      expect(xml).toContain('<deckname>Burn v2</deckname>');
      expect(xml).toContain('"priceMissingCount":2');
    } finally {
      vi.useRealTimers();
    }
  });

  const uploaded = (id: number, name: string, requestId?: string, path = '') => server.Actions.deckUpload({
    path,
    requestId,
    treeItem: { id, name } as Parameters<typeof server.Actions.deckUpload>[0]['treeItem'],
  });

  it('saves edits made during the first upload to the new deck once its id arrives', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { webClient, store } = setupDraft(stageDeckDocument(GAME_DECK));
      await waitFor(() => expect(editor.current!.loading).toBe(false));

      act(() => editor.current!.setName('Burn v2'));
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);

      act(() => editor.current!.setName('Burn v3'));
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
      expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();

      act(() => {
        store.dispatch(uploaded(41, 'Something else'));
      });
      expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
      expect(editor.current!.saveState).not.toBe('saved');

      act(() => {
        store.dispatch(uploaded(42, 'Burn v2', vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5]));
      });
      expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
      expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
      const [deckId, deckList] = vi.mocked(webClient.request.session.deckUpdate).mock.calls[0];
      expect(deckId).toBe(42);
      expect(deckList).toContain('<deckname>Burn v3</deckname>');
      expect(editor.current!.saveState).toBe('saving');
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves an edit still waiting on the autosave debounce to the new deck', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { webClient, store } = setupDraft(stageDeckDocument(GAME_DECK));
      await waitFor(() => expect(editor.current!.loading).toBe(false));

      act(() => editor.current!.setName('Burn v2'));
      act(() => {
        vi.advanceTimersByTime(600);
      });
      act(() => editor.current!.setName('Burn v3'));
      act(() => {
        store.dispatch(uploaded(42, 'Burn v2', vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5]));
      });
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
      expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
      expect(vi.mocked(webClient.request.session.deckUpdate).mock.calls[0][0]).toBe(42);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps only the latest drafts', async () => {
    const tokens = Array.from({ length: 5 }, () => stageDeckDocument(GAME_DECK));
    for (const token of tokens) {
      const { unmount } = setupDraft(token);
      await waitFor(() => expect(editor.current!.loading).toBe(false));
      expect(editor.current!.notFound).toBe(false);
      unmount();
    }

    const latest = setupDraft(tokens[4]);
    await waitFor(() => expect(editor.current!.loading).toBe(false));
    expect(editor.current!.notFound).toBe(false);
    latest.unmount();

    setupDraft(tokens[0]);
    await waitFor(() => expect(editor.current!.loading).toBe(false));
    expect(editor.current!.notFound).toBe(true);
  });

  it('is not found for an unknown token', async () => {
    setupDraft('missing');
    await waitFor(() => expect(editor.current!.loading).toBe(false));
    expect(editor.current!.notFound).toBe(true);
  });
});
