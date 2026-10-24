import { act } from '@testing-library/react';

import { server } from '@cockatrice/datatrice';
import { create } from '@bufbuild/protobuf';
import { Response_ResponseCode, ServerInfo_DeckStorage_TreeItemSchema } from '@cockatrice/sockatrice/generated';
import type { WebClient } from '@cockatrice/sockatrice';
import type { CommandFailedPayload } from '@cockatrice/datatrice';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import {
  clearDeckEditorCache, getCachedDeck, getCachedDraft, getDraftDocument, setCachedDeck, setCachedDraft, setDraftDocument,
} from '../deckEditorCache';
import { deckSaveSignature } from '../deckPersistence';
import type { HydratedDeck } from '../types';
import { AUTOSAVE_DEBOUNCE_MS, useDeckAutosave, type DeckAutosave, type DraftAutosave } from './useDeckAutosave';

const deck: HydratedDeck = { name: 'D', meta: { v: 1, updatedAt: 'x' }, cards: [], format: 'modern' };
const SAVED = deckSaveSignature(deck);
const EDITED: HydratedDeck = { ...deck, name: 'D v2' };

let latest: DeckAutosave;
let current: HydratedDeck | null;
const readDeck = () => current;
const clients = new WeakMap<object, WebClient>();
const settled = new WeakSet<NonNullable<Parameters<WebClient['request']['session']['deckUpdate']>[4]>>();

function Probe({ initial, deckId = 7, draft }: { initial: string | null; deckId?: number | null; draft?: DraftAutosave }) {
  latest = useDeckAutosave(deckId, readDeck, initial, draft);
  return null;
}

function setup(initial: string | null = SAVED) {
  const webClient = createMockWebClient();
  const view = renderWithProviders(<Probe initial={initial} />, { preloadedState: connectedState, webClient });
  clients.set(view.store, webClient);
  return { ...view, webClient };
}

function ack(store: { dispatch: (a: unknown) => void }, deckId = 7, error: CommandFailedPayload | null = null) {
  act(() => {
    store.dispatch(error ? server.Actions.deckUpdateFailed({ deckId, ...error }) : server.Actions.deckUpdated({
      deckId,
      treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: deckId, name: 'D' }),
    }));
    const call = vi.mocked(clients.get(store)!.request.session.deckUpdate).mock.calls
      .find(([id, , , , callback]) => id === deckId && callback && !settled.has(callback));
    const callback = call?.[4];
    if (callback) {
      settled.add(callback);
      callback(error);
    }
  });
}

function save() {
  act(() => {
    latest.scheduleSave();
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  clearDeckEditorCache();
  current = EDITED;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDeckAutosave', () => {
  it.each(['stored', 'uploading', 'failed'] as const)('resets draft identity after A is %s so B cannot save to A', (phase) => {
    const webClient = createMockWebClient();
    const onStoredA = vi.fn();
    const onStoredB = vi.fn();
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'A', onStored: onStoredA }} />, {
      preloadedState: connectedState, webClient,
    });
    clients.set(view.store, webClient);
    save();
    const requestIdA = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
    if (phase === 'stored') {
      act(() => view.store.dispatch(server.Actions.deckUpload({
        path: '', requestId: requestIdA, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 5 }),
      })));
      current = { ...EDITED, name: 'A pending edit' };
      act(() => latest.scheduleSave());
    } else if (phase === 'failed') {
      act(() => view.store.dispatch(server.Actions.deckUploadFailed({ path: '', requestId: requestIdA, responseCode: 1 })));
    }

    view.rerender(<Probe initial={null} deckId={null} draft={{ key: 'B', onStored: onStoredB }} />);
    expect(latest.saveState).toBe('idle');
    expect(latest.savedSignature()).toBeNull();
    current = { ...deck, name: 'Draft B' };
    save();
    expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(2);
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(phase === 'stored' ? 1 : 0);
    if (phase === 'stored') {
      expect(vi.mocked(webClient.request.session.deckUpdate).mock.calls[0][1]).toContain('<deckname>A pending edit</deckname>');
      ack(view.store, 5);
    }
    act(() => {
      view.store.dispatch(server.Actions.deckUpload({
        path: '', requestId: requestIdA, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 5 }),
      }));
      view.store.dispatch(server.Actions.deckUploadFailed({ path: '', requestId: requestIdA, responseCode: 1 }));
    });
    expect(latest.saveState).toBe('saving');
    expect(onStoredB).not.toHaveBeenCalled();
    act(() => view.store.dispatch(server.Actions.deckUpload({
      path: '', requestId: vi.mocked(webClient.request.session.deckUpload).mock.calls[1][5],
      treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 6 }),
    })));
    expect(onStoredB).toHaveBeenCalledExactlyOnceWith(6, deckSaveSignature(current));
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(phase === 'stored' ? 1 : 0);
  });

  it.each(['success', 'failure'] as const)('retains the follow-up draft update %s after the editor closes', (outcome) => {
    const webClient = createMockWebClient();
    const onStored = (id: number, signature: string) => {
      setCachedDeck(id, { deck: current!, savedSignature: signature });
    };
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'draft', onStored }} />, {
      preloadedState: connectedState, webClient,
    });
    clients.set(view.store, webClient);
    save();
    current = { ...EDITED, name: 'Edited during upload' };
    save();
    act(() => view.store.dispatch(server.Actions.deckUpload({
      path: '', requestId: vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5],
      treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
    })));
    expect(latest.saveState).toBe('saving');
    expect(latest.savedSignature()).toBe(deckSaveSignature(EDITED));
    expect(vi.mocked(webClient.request.session.deckUpdate).mock.calls[0][1])
      .toContain('<deckname>Edited during upload</deckname>');
    save();
    expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    view.unmount();
    ack(view.store, 42, outcome === 'failure' ? { responseCode: Response_ResponseCode.RespInternalError } : null);
    const signature = outcome === 'failure' ? deckSaveSignature(EDITED) : deckSaveSignature(current);
    expect(getCachedDeck(42)?.savedSignature).toBe(signature);
    renderWithProviders(<Probe initial={signature} deckId={42} />, { store: view.store, webClient });
    expect(latest.saveState).toBe(outcome === 'failure' ? 'failed' : 'saved');
    expect(latest.savedSignature()).toBe(signature);
  });

  it.each([
    ['success', 'another-upload'], ['success', undefined],
    ['failure', 'another-upload'], ['failure', undefined],
  ] as const)('ignores foreign upload %s with request ID %s while a draft is saving', (outcome, foreignRequestId) => {
    const webClient = createMockWebClient();
    const onStored = vi.fn();
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'draft', onStored }} />, {
      preloadedState: connectedState, webClient,
    });
    save();
    const requestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
    act(() => view.store.dispatch(outcome === 'success' ? server.Actions.deckUpload({
      path: '', requestId: foreignRequestId, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 99 }),
    }) : server.Actions.deckUploadFailed({
      path: '', requestId: foreignRequestId, responseCode: Response_ResponseCode.RespInternalError,
    })));
    expect(onStored).not.toHaveBeenCalled();
    expect(latest.saveState).toBe('saving');
    expect(latest.savedSignature()).toBeNull();
    expect(requestId).toEqual(expect.any(String));
    act(() => view.store.dispatch(server.Actions.deckUpload({
      path: '', requestId, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
    })));
    expect(onStored).toHaveBeenCalledExactlyOnceWith(42, deckSaveSignature(EDITED));
    expect(latest.saveState).toBe('saved');
  });

  it('hands an uploaded draft to the registry and uses updates for later saves', () => {
    const webClient = createMockWebClient();
    const onStored = vi.fn();
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'draft', onStored }} />, {
      preloadedState: connectedState, webClient,
    });
    clients.set(view.store, webClient);
    save();
    save();
    expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
    act(() => view.store.dispatch(server.Actions.deckUpload({
      requestId: vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5],
      path: '', treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
    })));
    const signature = deckSaveSignature(EDITED);
    expect(onStored).toHaveBeenCalledWith(42, signature);
    expect(latest.saveState).toBe('saved');
    view.rerender(<Probe initial={signature} deckId={42} />);
    expect(latest.savedSignature()).toBe(signature);
    save();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    current = { ...EDITED, name: 'After upload' };
    save();
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    ack(view.store, 42);
    expect(latest.saveState).toBe('saved');
    expect(latest.savedSignature()).toBe(deckSaveSignature(current));
  });

  it.each(['success', 'failure'] as const)('keeps a stored save %s separate from a draft upload', (outcome) => {
    const view = setup();
    save();
    const onStored = vi.fn();
    view.rerender(<Probe initial={null} deckId={null} draft={{ key: 'draft', onStored }} />);
    current = { ...deck, name: 'Draft' };
    save();
    ack(view.store, 7, outcome === 'failure' ? { responseCode: Response_ResponseCode.RespInternalError } : null);
    expect(latest.saveState).toBe('saving');
    expect(latest.savedSignature()).toBeNull();
    expect(onStored).not.toHaveBeenCalled();
    act(() => view.store.dispatch(server.Actions.deckUpload({
      requestId: vi.mocked(view.webClient.request.session.deckUpload).mock.calls[0][5],
      path: '', treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
    })));
    expect(onStored).toHaveBeenCalledWith(42, deckSaveSignature(current));
    view.rerender(<Probe initial={SAVED} deckId={7} />);
    expect(latest.saveState).toBe(outcome === 'failure' ? 'failed' : 'saved');
    expect(latest.savedSignature()).toBe(outcome === 'failure' ? SAVED : deckSaveSignature(EDITED));
  });

  it('keeps a failed upload as a draft and retries without updating a stored deck', () => {
    const webClient = createMockWebClient();
    const onStored = vi.fn();
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'draft', onStored }} />, {
      preloadedState: connectedState, webClient,
    });
    save();
    const firstRequestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
    act(() => view.store.dispatch(server.Actions.deckUploadFailed({
      path: '', requestId: firstRequestId, responseCode: Response_ResponseCode.RespInternalError,
    })));
    expect(latest.saveState).toBe('failed');
    expect(latest.savedSignature()).toBeNull();
    expect(onStored).not.toHaveBeenCalled();
    save();
    expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(2);
    const retryRequestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[1][5];
    expect(retryRequestId).toEqual(expect.any(String));
    expect(retryRequestId).not.toBe(firstRequestId);
    act(() => {
      view.store.dispatch(server.Actions.deckUploadFailed({
        path: '', requestId: firstRequestId, responseCode: Response_ResponseCode.RespInternalError,
      }));
      view.store.dispatch(server.Actions.deckUpload({
        path: '', requestId: firstRequestId, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 99 }),
      }));
    });
    expect(latest.saveState).toBe('saving');
    expect(onStored).not.toHaveBeenCalled();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    view.rerender(<Probe initial={SAVED} deckId={7} />);
    save();
    act(() => {
      view.store.dispatch(server.Actions.deckUploadFailed({
        path: '', requestId: retryRequestId, responseCode: Response_ResponseCode.RespInternalError,
      }));
      view.store.dispatch(server.Actions.deckUpload({
        requestId: retryRequestId,
        path: '', treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
      }));
    });
    expect(latest.saveState).toBe('saving');
    expect(latest.savedSignature()).toBe(SAVED);
    expect(onStored).not.toHaveBeenCalled();
  });

  it('settles each original deck when acknowledgements cross a switch', () => {
    const view = setup();
    setCachedDeck(7, { deck: EDITED, savedSignature: SAVED });
    save();
    view.rerender(<Probe initial={SAVED} deckId={8} />);
    current = { ...deck, name: 'Other deck edited' };
    setCachedDeck(8, { deck: current, savedSignature: SAVED });
    save();
    ack(view.store, 7);
    ack(view.store, 8);
    expect(getCachedDeck(7)?.savedSignature).toBe(deckSaveSignature(EDITED));
    expect(getCachedDeck(8)?.savedSignature).toBe(deckSaveSignature(current));
    expect(latest.saveState).toBe('saved');
  });

  it('sends identical contents for different decks with pending saves', () => {
    const view = setup();
    save();
    view.rerender(<Probe initial={SAVED} deckId={8} />);
    save();
    expect(vi.mocked(view.webClient.request.session.deckUpdate).mock.calls.map(([id]) => id)).toEqual([7, 8]);
    ack(view.store, 8);
    ack(view.store, 7);
    expect(latest.saveState).toBe('saved');
  });

  it('settles the final save after unmount and reopens it as saved', () => {
    const view = setup();
    setCachedDeck(7, { deck: EDITED, savedSignature: SAVED });
    act(() => latest.scheduleSave());
    view.unmount();
    ack(view.store);
    expect(getCachedDeck(7)?.savedSignature).toBe(deckSaveSignature(EDITED));
    renderWithProviders(<Probe initial={getCachedDeck(7)!.savedSignature} />, { store: view.store, webClient: view.webClient });
    expect(latest.saveState).toBe('saved');
  });

  it('retains a final-save failure after unmount and retries on reopen', () => {
    const view = setup();
    act(() => latest.scheduleSave());
    view.unmount();
    ack(view.store, 7, { responseCode: Response_ResponseCode.RespInternalError });
    renderWithProviders(<Probe initial={SAVED} />, { store: view.store, webClient: view.webClient });
    expect(latest.saveState).toBe('failed');
    save();
    ack(view.store);
    expect(latest.saveState).toBe('saved');
  });

  it('sends the deck\'s color identity with every update and leaves visibility alone', () => {
    current = {
      ...EDITED,
      cards: [
        { name: 'Counterspell', quantity: 1, category: 'main', lookupSource: 'scryfall', colors: ['U'] },
        { name: 'Duress', quantity: 1, category: 'sideboard', lookupSource: 'scryfall', colors: ['B'] },
      ],
    };
    const { webClient } = setup();
    save();
    const [, , isPublic, colorIdentity] = vi.mocked(webClient.request.session.deckUpdate).mock.calls[0];
    expect(isPublic).toBeUndefined();
    expect(colorIdentity).toBe('UB');
  });

  it('debounces edits into one deckUpdate and reports saving, then saved on the ack', () => {
    const { webClient, store } = setup();

    act(() => {
      latest.scheduleSave();
      latest.scheduleSave();
    });
    expect(latest.saveState).toBe('dirty');
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    const [deckId, xml] = vi.mocked(webClient.request.session.deckUpdate).mock.calls[0];
    expect(deckId).toBe(7);
    expect(xml).toContain('<deckname>D v2</deckname>');
    expect(latest.saveState).toBe('saving');

    ack(store);
    expect(latest.saveState).toBe('saved');
    expect(latest.savedSignature()).toBe(deckSaveSignature(EDITED));
  });

  it('skips the upload when only the timestamp would change', () => {
    current = { ...deck, meta: { ...deck.meta, updatedAt: 'later' } };
    const { webClient } = setup();
    save();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    expect(latest.saveState).toBe('idle');
  });

  it('settles back to saved when an edit is reverted before the debounce fires', () => {
    const { webClient, store } = setup();
    save();
    ack(store);

    current = { ...EDITED, name: 'D v3' };
    act(() => latest.scheduleSave());
    current = EDITED;
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    expect(latest.saveState).toBe('saved');
  });

  it('does not resend content that is already in flight', () => {
    const { webClient } = setup();
    save();
    save();
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    expect(latest.saveState).toBe('saving');
  });

  it('reports a failed save and uploads again on the next save', () => {
    const { webClient, store } = setup();
    save();
    ack(store, 7, { responseCode: Response_ResponseCode.RespInternalError });
    expect(latest.saveState).toBe('failed');
    expect(latest.savedSignature()).toBe(SAVED);

    save();
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(2);
  });

  it('ignores answers for other decks and answers with nothing in flight', () => {
    const { store } = setup();
    ack(store);
    expect(latest.saveState).toBe('idle');
    save();
    ack(store, 8);
    expect(latest.saveState).toBe('saving');
  });

  it('keeps the cached signature in step with each acknowledged save', () => {
    setCachedDeck(7, { deck, savedSignature: SAVED });
    const { store } = setup();
    save();
    expect(getCachedDeck(7)?.savedSignature).toBe(SAVED);
    ack(store);
    expect(getCachedDeck(7)?.savedSignature).toBe(deckSaveSignature(EDITED));
  });

  it('flushes a pending save on demand and on unmount', () => {
    const { webClient, unmount } = setup();
    act(() => latest.scheduleSave());
    act(() => latest.flushSave());
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);

    current = { ...EDITED, name: 'D v3' };
    act(() => latest.scheduleSave());
    unmount();
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a deck', () => {
    current = null;
    const { webClient } = setup();
    save();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  });

  it('uploads unconditionally after resetSaved, and markSaved marks the deck clean', () => {
    current = deck;
    const { webClient } = setup();
    act(() => latest.resetSaved());
    expect(latest.savedSignature()).toBeNull();
    save();
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);

    act(() => latest.markSaved('sig'));
    expect(latest.saveState).toBe('idle');
    expect(latest.savedSignature()).toBe('sig');
  });
});

describe('useDeckAutosave save prompt support (desktop confirmOpen)', () => {
  it.each(['stored', 'draft'] as const)('holds %s edits and flushes, then resumes the latest contents once', (kind) => {
    const webClient = createMockWebClient();
    renderWithProviders(<Probe initial={kind === 'stored' ? SAVED : null} deckId={kind === 'stored' ? 7 : null}
      draft={kind === 'draft' ? { key: 'paused', onStored: vi.fn() } : undefined} />, {
      preloadedState: connectedState, webClient,
    });
    act(() => {
      latest.scheduleSave();
      latest.pauseAutosave();
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
      latest.flushSave();
    });
    current = { ...EDITED, name: 'Latest held edit' };
    save();
    expect(latest.isModified).toBe(true);
    expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    act(() => {
      latest.resumeAutosave();
      latest.resumeAutosave();
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    if (kind === 'stored') {
      expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
      expect(vi.mocked(webClient.request.session.deckUpdate).mock.calls[0][1]).toContain('<deckname>Latest held edit</deckname>');
      expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
    } else {
      expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
      expect(vi.mocked(webClient.request.session.deckUpload).mock.calls[0][2]).toContain('<deckname>Latest held edit</deckname>');
      expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['stored', 'discard'], ['stored', 'unmount'], ['draft', 'discard'], ['draft', 'unmount'],
  ] as const)('does not send held %s edits on %s', (kind, end) => {
    const webClient = createMockWebClient();
    const view = renderWithProviders(<Probe initial={kind === 'stored' ? SAVED : null} deckId={kind === 'stored' ? 7 : null}
      draft={kind === 'draft' ? { key: 'paused-end', onStored: vi.fn() } : undefined} />, {
      preloadedState: connectedState, webClient,
    });
    act(() => {
      latest.pauseAutosave();
      latest.scheduleSave();
      latest.flushSave();
    });
    if (end === 'discard') {
      act(() => {
        latest.discardChanges();
        latest.resumeAutosave();
      });
    }
    view.unmount();
    act(() => vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2));
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
  });

  it.each(['resume', 'discard'] as const)('holds edits and waiters across a paused draft handoff until %s', async (choice) => {
    const webClient = createMockWebClient();
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'paused-handoff', onStored: vi.fn() }} />, {
      preloadedState: connectedState, webClient,
    });
    clients.set(view.store, webClient);
    let saved!: Promise<boolean>;
    const settled = vi.fn();
    act(() => {
      saved = latest.saveNow().then((value) => {
        settled(value); return value;
      });
    });
    current = { ...EDITED, name: 'Held through handoff' };
    act(() => {
      latest.scheduleSave();
      latest.pauseAutosave();
      view.store.dispatch(server.Actions.deckUpload({
        path: '', requestId: vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5],
        treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
      }));
    });
    view.rerender(<Probe initial={deckSaveSignature(EDITED)} deckId={42} />);
    act(() => {
      latest.flushSave();
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(latest.isModified).toBe(true);
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    act(() => {
      if (choice === 'discard') {
        latest.discardChanges();
      }
      latest.resumeAutosave();
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    if (choice === 'resume') {
      expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
      expect(vi.mocked(webClient.request.session.deckUpdate).mock.calls[0][1]).toContain('<deckname>Held through handoff</deckname>');
      ack(view.store, 42);
    } else {
      expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    }
    await expect(saved).resolves.toBe(choice === 'resume');
    expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
  });

  it('explicitly saves a paused draft once and resumes without uploading a duplicate', async () => {
    const webClient = createMockWebClient();
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'explicit-save', onStored: vi.fn() }} />, {
      preloadedState: connectedState, webClient,
    });
    let saved!: Promise<boolean>;
    act(() => {
      latest.scheduleSave();
      latest.pauseAutosave();
      saved = latest.saveNow();
    });
    expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
    act(() => view.store.dispatch(server.Actions.deckUpload({
      path: '', requestId: vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5],
      treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
    })));
    await expect(saved).resolves.toBe(true);
    act(() => {
      latest.resumeAutosave();
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1);
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  });

  it.each(['switch', 'unmount'] as const)('settles stored saveNow after an editor %s', async (change) => {
    const view = setup();
    let saved!: Promise<boolean>;
    act(() => {
      saved = latest.saveNow();
    });
    if (change === 'switch') {
      view.rerender(<Probe initial={SAVED} deckId={8} />);
    } else {
      view.unmount();
    }
    ack(view.store, 7);
    await expect(saved).resolves.toBe(true);
    if (change === 'switch') {
      expect(latest.saveState).toBe('idle');
    }
  });

  it('transfers draft saveNow waiters to the follow-up registry update', async () => {
    const webClient = createMockWebClient();
    const onStored = vi.fn();
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'waited-draft', onStored }} />, {
      preloadedState: connectedState, webClient,
    });
    clients.set(view.store, webClient);
    let saved!: Promise<boolean>;
    const settled = vi.fn();
    act(() => {
      saved = latest.saveNow().then((value) => {
        settled(value); return value;
      });
    });
    current = { ...EDITED, name: 'Edited during Save' };
    act(() => latest.scheduleSave());
    expect(latest.isModified).toBe(true);
    act(() => view.store.dispatch(server.Actions.deckUpload({
      path: '', requestId: vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5],
      treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
    })));
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    view.unmount();
    ack(view.store, 42);
    await expect(saved).resolves.toBe(true);
  });

  it.each(['failure', 'discard', 'switch', 'unmount'] as const)(
    'ends a draft saveNow on %s without accepting a late upload', async (change) => {
      const webClient = createMockWebClient();
      const onStored = vi.fn();
      const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key: 'waiting-A', onStored }} />, {
        preloadedState: connectedState, webClient,
      });
      let saved!: Promise<boolean>;
      act(() => {
        saved = latest.saveNow();
      });
      const requestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
      if (change === 'failure') {
        act(() => view.store.dispatch(server.Actions.deckUploadFailed({ path: '', requestId, responseCode: 1 })));
        expect(latest.isModified).toBe(true);
      } else if (change === 'discard') {
        act(() => latest.discardChanges());
        expect(latest.isModified).toBe(false);
      } else if (change === 'switch') {
        view.rerender(<Probe initial={null} deckId={null} draft={{ key: 'waiting-B', onStored }} />);
      } else {
        view.unmount();
      }
      await expect(saved).resolves.toBe(false);
      act(() => view.store.dispatch(server.Actions.deckUpload({
        path: '', requestId, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42 }),
      })));
      expect(onStored).not.toHaveBeenCalled();
    });

  it('discards a draft debounce and cached edits while keeping its original document', () => {
    const webClient = createMockWebClient();
    const key = 'discard-draft';
    setDraftDocument(key, '<original/>');
    setCachedDraft(key, EDITED);
    const view = renderWithProviders(<Probe initial={null} deckId={null} draft={{ key, onStored: vi.fn() }} />, {
      preloadedState: connectedState, webClient,
    });
    act(() => latest.scheduleSave());
    expect(latest.isModified).toBe(true);
    act(() => latest.discardChanges());
    expect(latest.isModified).toBe(false);
    expect(getCachedDraft(key)).toBeUndefined();
    expect(getDraftDocument(key)).toBe('<original/>');
    view.unmount();
    expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
  });

  it('counts an edit waiting on the debounce as modified', () => {
    setup();
    expect(latest.isModified).toBe(false);

    act(() => latest.scheduleSave());

    expect(latest.isModified).toBe(true);
  });

  it('saves now and resolves true once the server takes the deck', async () => {
    const { webClient, store } = setup();
    act(() => latest.scheduleSave());

    let saved: Promise<boolean> = Promise.resolve(false);
    act(() => {
      saved = latest.saveNow();
    });
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    ack(store);

    await expect(saved).resolves.toBe(true);
    expect(latest.isModified).toBe(false);
  });

  it('resolves true at once when the server already holds the deck', async () => {
    current = deck;
    const { webClient } = setup();

    await expect(latest.saveNow()).resolves.toBe(true);
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  });

  it('resolves false and stays modified when the save fails', async () => {
    const { store } = setup();
    act(() => latest.scheduleSave());

    let saved: Promise<boolean> = Promise.resolve(true);
    act(() => {
      saved = latest.saveNow();
    });
    ack(store, 7, { responseCode: Response_ResponseCode.RespInternalError });

    await expect(saved).resolves.toBe(false);
    expect(latest.isModified).toBe(true);
  });

  it('discards an edit without sending it, even on unmount, and forgets the cached copy', () => {
    setCachedDeck(7, { deck: EDITED, savedSignature: SAVED });
    const { webClient, unmount } = setup();
    act(() => latest.scheduleSave());

    act(() => latest.discardChanges());
    expect(latest.isModified).toBe(false);
    expect(getCachedDeck(7)).toBeUndefined();
    unmount();

    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
  });
});
