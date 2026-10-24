import { act, renderHook, waitFor } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { parseCod } from '@app/services';
import { rootReducerMap, type RootState } from '@app/store';

import { connectedState, createMockWebClient } from '../../../__test-utils__';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { hydrateDeck } from '../hydrate';
import { clearDeckEditorCache, getCachedDeck, setCachedDeck } from '../deckEditorCache';
import { getDeckSaveRegistry } from '../deckSaveRegistry';
import { deckSaveSignature } from '../deckPersistence';
import type { HydratedDeck } from '../types';
import { useDeckStorageDetails } from './useDeckStorageDetails';

vi.mock('../hydrate', () => ({ hydrateDeck: vi.fn() }));
const xml = '<?xml version="1.0"?>\r\n<cockatrice_deck><deckname>Deck</deckname>'
  + '<bannerCard providerId="old">Island</bannerCard><comments><![CDATA[Keep <this>]]></comments>'
  + '<zone name="unknown"><card number="04" name="Swamp" extra="keep"/></zone></cockatrice_deck>\r\n';
const hydrated = (): HydratedDeck => ({ ...parseCod(xml), format: 'commander',
  cards: [{ name: 'Swamp', quantity: 4, category: 'main', lookupSource: 'unknown' }] });

beforeEach(() => {
  clearDeckEditorCache();
  vi.mocked(hydrateDeck).mockImplementation(async (parsed) => ({ ...hydrated(), name: parsed.name }));
});

function setup(activate = true) {
  const client = createMockWebClient();
  const { Wrapper, store } = makeReduxWebClientHookWrapper<RootState>({
    reducer: combineReducers(rootReducerMap), preloadedState: connectedState as RootState, webClient: client,
  });
  const onSaved = vi.fn();
  const hook = renderHook(({ id, document }) => useDeckStorageDetails(id, document, onSaved, 'UB'), {
    wrapper: Wrapper, initialProps: { id: 7, document: xml },
  });
  if (activate) {
    act(() => {
      void hook.result.current.activate();
    });
  }
  const respond = (error: { responseCode: number } | null = null) => {
    act(() => vi.mocked(client.request.session.deckUpdate).mock.calls.at(-1)![4]!(error));
  };
  const lastDownload = () => vi.mocked(client.request.session.deckDownload).mock.calls.at(-1)![1]!;
  const serve = async (deck = xml) => {
    await act(async () => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 7, deck, requestId: lastDownload() }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  const ready = () => waitFor(() => expect(hook.result.current.disabled).toBe(false));
  return { ...hook, Wrapper, client, store, onSaved, respond, serve, lastDownload, ready };
}

function start(ctx: ReturnType<typeof setup>, edit: Parameters<ReturnType<typeof useDeckStorageDetails>['save']>[0]) {
  let saved!: Promise<boolean>;
  act(() => {
    saved = ctx.result.current.save(edit);
  });
  return () => saved;
}

it('downloads the stored file immediately before patching, even when nothing else is known to have changed', async () => {
  const ctx = setup();
  await ctx.ready();
  setCachedDeck(7, { deck: hydrated(), savedSignature: 'old' });
  const saved = start(ctx, { banner: { name: 'Swamp', providerId: 'new' } });
  expect(ctx.client.request.session.deckDownload).toHaveBeenCalledWith(7, expect.any(String));
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
  await ctx.serve();
  const expected = xml.replace('<bannerCard providerId="old">Island</bannerCard>', '<bannerCard providerId="new">Swamp</bannerCard>');
  expect(ctx.client.request.session.deckUpdate).toHaveBeenCalledWith(7, expected, undefined, 'UB', expect.any(Function));
  expect(ctx.onSaved).not.toHaveBeenCalled();
  expect(getCachedDeck(7)).toBeUndefined();
  ctx.respond();
  await act(async () => expect(await saved()).toBe(true));
  expect(ctx.onSaved).toHaveBeenCalledExactlyOnceWith(7, expected);
});

it('renames by patching only the stored deck name and uploading over the same deck', async () => {
  const ctx = setup();
  await ctx.ready();
  const saved = start(ctx, { name: 'Fire & Ice' });
  await ctx.serve();
  const expected = xml.replace('<deckname>Deck</deckname>', '<deckname>Fire &amp; Ice</deckname>');
  expect(ctx.client.request.session.deckUpdate).toHaveBeenCalledWith(7, expected, undefined, 'UB', expect.any(Function));
  ctx.respond();
  await act(async () => expect(await saved()).toBe(true));
  expect(ctx.onSaved).toHaveBeenCalledExactlyOnceWith(7, expected);
  expect(ctx.result.current.deck?.name).toBe('Fire & Ice');
});

it('writes an empty tag list when the last tag is removed', async () => {
  const ctx = setup();
  await ctx.ready();
  start(ctx, { tags: ['Ramp'] });
  await ctx.serve();
  ctx.respond();
  await waitFor(() => expect(ctx.result.current.saving).toBe(false));
  start(ctx, { tags: [] });
  await ctx.serve(vi.mocked(ctx.client.request.session.deckUpdate).mock.calls.at(-1)![1]);
  expect(vi.mocked(ctx.client.request.session.deckUpdate).mock.calls.at(-1)![1]).toContain('<tags/>');
});

it('patches a newer stored file when only other details changed elsewhere', async () => {
  const ctx = setup();
  await ctx.ready();
  const newer = xml.replace('<comments>', '<tags><tag>Burn</tag></tags><comments>');
  const saved = start(ctx, { name: 'Renamed' });
  await ctx.serve(newer);
  const expected = newer.replace('<deckname>Deck</deckname>', '<deckname>Renamed</deckname>');
  expect(ctx.client.request.session.deckUpdate).toHaveBeenCalledWith(7, expected, undefined, 'UB', expect.any(Function));
  ctx.respond();
  await act(async () => expect(await saved()).toBe(true));
});

it('refuses to save when the card list changed elsewhere and shows the latest version instead', async () => {
  const ctx = setup();
  await ctx.ready();
  const newer = xml.replace('number="04"', 'number="09"');
  const saved = start(ctx, { name: 'Renamed' });
  await ctx.serve(newer);
  await act(async () => expect(await saved()).toBe(false));
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
  expect(ctx.result.current.error).toBe('DeckStorageEditDialog.changedElsewhere');
  expect(ctx.onSaved).toHaveBeenCalledExactlyOnceWith(7, newer);

  const retried = start(ctx, { name: 'Renamed' });
  await ctx.serve(newer);
  expect(ctx.client.request.session.deckUpdate).toHaveBeenCalledWith(
    7, newer.replace('<deckname>Deck</deckname>', '<deckname>Renamed</deckname>'), undefined, 'UB', expect.any(Function),
  );
  ctx.respond();
  await act(async () => expect(await retried()).toBe(true));
});

it('refuses when the same detail was changed elsewhere', async () => {
  const ctx = setup();
  await ctx.ready();
  const saved = start(ctx, { name: 'Mine' });
  await ctx.serve(xml.replace('<deckname>Deck</deckname>', '<deckname>Theirs</deckname>'));
  await act(async () => expect(await saved()).toBe(false));
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
  expect(ctx.result.current.deck?.name).toBe('Theirs');
});

it('keeps a failed storage save owned by storage across remounts, with retry and discard', async () => {
  const first = setup();
  await first.ready();
  const saved = start(first, { tags: ['Ramp'] });
  await first.serve();
  first.respond({ responseCode: 3 });
  await act(async () => expect(await saved()).toBe(false));
  expect(first.result.current.error).toBeTruthy();
  const registry = getDeckSaveRegistry(first.store, first.client);
  expect(registry.getSnapshot(7)).toMatchObject({ saveState: 'failed', failedBy: 'storage' });
  first.unmount();

  const again = renderHook(() => useDeckStorageDetails(7, xml, first.onSaved, 'UB'), { wrapper: first.Wrapper });
  act(() => {
    void again.result.current.activate();
  });
  await waitFor(() => expect(again.result.current.disabled).toBe(false));
  expect(again.result.current.editorHasChanges).toBe(false);
  expect(again.result.current.failedEdit).toEqual({ tags: ['Ramp'] });
  act(() => again.result.current.discardFailed!());
  expect(registry.getSnapshot(7).saveState).not.toBe('failed');
  expect(again.result.current.failedEdit).toBeNull();
  expect(again.result.current.discardFailed).toBeUndefined();
});

it('ignores old hydration after changing decks', async () => {
  let finish!: (deck: HydratedDeck) => void;
  vi.mocked(hydrateDeck).mockImplementationOnce(() => new Promise((resolve) => {
    finish = resolve;
  }));
  const ctx = setup();
  const next = { ...hydrated(), name: 'Next' };
  vi.mocked(hydrateDeck).mockResolvedValue(next);
  ctx.rerender({ id: 8, document: xml.replace('Deck', 'Next') });
  act(() => {
    void ctx.result.current.activate();
  });
  await waitFor(() => expect(ctx.result.current.deck?.name).toBe('Next'));
  await act(async () => finish(hydrated()));
  expect(ctx.result.current.deck?.name).toBe('Next');
});

it('blocks storage edits over pending editor changes', async () => {
  const ctx = setup();
  await ctx.ready();
  act(() => getDeckSaveRegistry(ctx.store, ctx.client).markDirty(7));
  expect(ctx.result.current.editorHasChanges).toBe(true);
  await act(async () => expect(await ctx.result.current.save({ tags: ['Ramp'] })).toBe(false));
  expect(ctx.client.request.session.deckDownload).not.toHaveBeenCalled();
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
});

it('keeps controls disabled when an editor save has failed', async () => {
  const ctx = setup();
  await ctx.ready();
  act(() => getDeckSaveRegistry(ctx.store, ctx.client).save(7, { ...hydrated(), name: 'Unsaved editor changes' }));
  ctx.respond({ responseCode: 3 });
  expect(ctx.result.current.disabled).toBe(true);
  expect(ctx.result.current.editorHasChanges).toBe(true);
  expect(ctx.result.current.discardFailed).toBeUndefined();
  await act(async () => expect(await ctx.result.current.save({ tags: ['Ramp'] })).toBe(false));
  expect(ctx.client.request.session.deckUpdate).toHaveBeenCalledTimes(1);
});

it('does not upload when the editor changed the deck while the download was in flight', async () => {
  const ctx = setup();
  await ctx.ready();
  const saved = start(ctx, { tags: ['Ramp'] });
  act(() => getDeckSaveRegistry(ctx.store, ctx.client).markDirty(7));
  await ctx.serve();
  await act(async () => expect(await saved()).toBe(false));
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
});

it('does not apply late save results after disconnect', async () => {
  const ctx = setup();
  await ctx.ready();
  const saved = start(ctx, { tags: ['Ramp'] });
  await ctx.serve();
  act(() => ctx.store.dispatch(server.Actions.updateStatus({
    status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null },
  })));
  ctx.respond();
  await act(async () => expect(await saved()).toBe(false));
  expect(ctx.onSaved).not.toHaveBeenCalled();
});

it('updates the document cache when a successful save arrives after the row unmounts', async () => {
  const ctx = setup();
  await ctx.ready();
  setCachedDeck(7, { deck: hydrated(), savedSignature: 'old' });
  const saved = start(ctx, { tags: ['Ramp'] });
  await ctx.serve();
  expect(getCachedDeck(7)).toBeUndefined();
  ctx.unmount();
  ctx.respond();
  expect(await saved()).toBe(false);
  expect(ctx.onSaved).toHaveBeenCalledExactlyOnceWith(7, expect.stringContaining('<tag>Ramp</tag>'));
});

it('ignores an unrelated download answer', async () => {
  const ctx = setup();
  await ctx.ready();
  start(ctx, { tags: ['Ramp'] });
  act(() => ctx.store.dispatch(server.Actions.deckDownloaded({ deckId: 7, deck: xml, requestId: 'unrelated' })));
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
  await ctx.serve();
  expect(ctx.client.request.session.deckUpdate).toHaveBeenCalledOnce();
});

it('does not hydrate or initialize a registry entry until the first interaction', async () => {
  const ctx = setup(false);
  expect(hydrateDeck).not.toHaveBeenCalled();
  expect(getDeckSaveRegistry(ctx.store, ctx.client).getSnapshot(7).savedSignature).toBeNull();
  await act(async () => {
    await ctx.result.current.activate();
  });
  expect(hydrateDeck).toHaveBeenCalledOnce();
  expect(getDeckSaveRegistry(ctx.store, ctx.client).getSnapshot(7).savedSignature).toBe(deckSaveSignature(hydrated()));
  await act(async () => {
    await ctx.result.current.activate();
  });
  expect(hydrateDeck).toHaveBeenCalledOnce();
});

it('keeps a failed download visible without uploading the cached document', async () => {
  const ctx = setup();
  await ctx.ready();
  const saved = start(ctx, { tags: ['Ramp'] });
  act(() => ctx.store.dispatch(server.Actions.deckDownloadFailed({
    deckId: 7, requestId: ctx.lastDownload(), responseCode: 3, failure: WebsocketTypes.CommandFailure.Timeout,
  })));
  await act(async () => expect(await saved()).toBe(false));
  expect(ctx.result.current.error).toBe('CommandFailure.timeout');
  expect(ctx.result.current.saving).toBe(false);
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
  expect(ctx.onSaved).not.toHaveBeenCalled();
});

it('cancels the download when the row unmounts', async () => {
  const ctx = setup();
  await ctx.ready();
  const saved = start(ctx, { tags: ['Ramp'] });
  const requestId = ctx.lastDownload();
  ctx.unmount();
  act(() => ctx.store.dispatch(server.Actions.deckDownloaded({ deckId: 7, deck: xml, requestId })));
  expect(await saved()).toBe(false);
  expect(ctx.client.request.session.deckUpdate).not.toHaveBeenCalled();
});

it('drops the clean editor copy when it adopts a newer stored file, but keeps unsaved editor work', async () => {
  const ctx = setup();
  await ctx.ready();
  setCachedDeck(7, { deck: hydrated(), savedSignature: deckSaveSignature(hydrated()) });
  const unsaved = { ...hydrated(), name: 'Unsaved' };
  setCachedDeck(8, { deck: unsaved, savedSignature: deckSaveSignature(hydrated()) });
  const saved = start(ctx, { name: 'Renamed' });
  await ctx.serve(xml.replace('number="04"', 'number="09"'));
  await act(async () => expect(await saved()).toBe(false));
  expect(getCachedDeck(7)).toBeUndefined();
  expect(getCachedDeck(8)?.deck).toBe(unsaved);
});

it('keeps unsaved work in the editor copy of the same deck when it adopts a newer stored file', async () => {
  const ctx = setup();
  await ctx.ready();
  const unsaved = { ...hydrated(), name: 'Unsaved' };
  setCachedDeck(7, { deck: unsaved, savedSignature: deckSaveSignature(hydrated()) });
  const saved = start(ctx, { name: 'Renamed' });
  await ctx.serve(xml.replace('number="04"', 'number="09"'));
  await act(async () => expect(await saved()).toBe(false));
  expect(getCachedDeck(7)?.deck).toBe(unsaved);
});

it('makes the adopted file the save baseline, so retrying the old value still uploads', async () => {
  const ctx = setup();
  await ctx.ready();
  const theirs = xml.replace('<deckname>Deck</deckname>', '<deckname>Theirs</deckname>');
  const refused = start(ctx, { name: 'Mine' });
  await ctx.serve(theirs);
  await act(async () => expect(await refused()).toBe(false));
  expect(getDeckSaveRegistry(ctx.store, ctx.client).getSnapshot(7).savedSignature)
    .toBe(deckSaveSignature({ ...hydrated(), name: 'Theirs' }));

  const retried = start(ctx, { name: 'Deck' });
  await ctx.serve(theirs);
  expect(ctx.client.request.session.deckUpdate).toHaveBeenCalledWith(7, xml, undefined, 'UB', expect.any(Function));
  ctx.respond();
  await act(async () => expect(await retried()).toBe(true));
});
