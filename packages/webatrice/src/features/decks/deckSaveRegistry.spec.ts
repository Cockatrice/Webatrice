import { combineReducers } from '@reduxjs/toolkit';
import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { rootReducerMap, type RootState } from '@app/store';
import { connectedState, createMockWebClient } from '../../__test-utils__';
import { makeReduxHookWrapper } from '../../__test-utils__/makeHookWrapper';
import { hasUnloadRisk } from '../../services/unloadGuard';
import { clearDeckEditorCache, getCachedDeck, setCachedDeck } from './deckEditorCache';
import { createDeckSaveRegistry, dropCleanCachedDeck, dropCleanCachedDecks, getDeckSaveRegistry } from './deckSaveRegistry';
import { deckSaveSignature } from './deckPersistence';
import type { HydratedDeck } from './types';

const original: HydratedDeck = { name: 'Original', format: 'modern', cards: [], meta: { v: 1, updatedAt: 'x' } };
const first = { ...original, name: 'First' };
const second = { ...original, name: 'Second' };

function setup() {
  const client = createMockWebClient();
  const { store } = makeReduxHookWrapper<RootState>(combineReducers(rootReducerMap), connectedState as RootState);
  const registry = createDeckSaveRegistry(store, client);
  registry.connect();
  registry.initialize(7, deckSaveSignature(original));
  registry.initialize(8, deckSaveSignature(original));
  const response = (index: number) => vi.mocked(client.request.session.deckUpdate).mock.calls[index][4]!;
  return { registry, client, store, response };
}

beforeEach(() => clearDeckEditorCache());

describe('deckSaveRegistry', () => {
  it('guards dirty, in-flight and failed saves, then releases clean or discarded work', () => {
    const { registry, response } = setup();
    expect(hasUnloadRisk()).toBe(false);

    registry.markDirty(7);
    expect(hasUnloadRisk()).toBe(true);
    registry.save(7, first);
    expect(hasUnloadRisk()).toBe(true);
    response(0)(null);
    expect(hasUnloadRisk()).toBe(false);

    registry.markDirty(7);
    registry.save(7, second);
    response(1)({ responseCode: 1 });
    expect(hasUnloadRisk()).toBe(true);
    registry.discardChanges(7);
    expect(hasUnloadRisk()).toBe(false);
    registry.dispose();
  });

  it('keeps saveNow waiters with each deck and waits for all of its requests', async () => {
    const { registry, response } = setup();
    const settledA = vi.fn();
    const savedA = registry.saveNow(7, first).then(settledA);
    registry.save(7, second);
    const savedB = registry.saveNow(8, first);
    response(2)({ responseCode: 1 });
    await expect(savedB).resolves.toBe(false);
    response(1)(null);
    await Promise.resolve();
    expect(settledA).not.toHaveBeenCalled();
    response(0)({ responseCode: 1 });
    await savedA;
    expect(settledA).toHaveBeenCalledExactlyOnceWith(true);
    expect(registry.getSnapshot(7).isModified).toBe(false);
    expect(registry.getSnapshot(8).isModified).toBe(true);
  });

  it('keeps a saveNow waiter pending for newer debounced edits', async () => {
    const { registry, response } = setup();
    const settled = vi.fn();
    const saved = registry.saveNow(7, first).then(settled);
    registry.markDirty(7);
    response(0)(null);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(registry.getSnapshot(7).isModified).toBe(true);
    registry.save(7, second);
    response(1)(null);
    await saved;
    expect(settled).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('discards unsent edits and cancels waiters without losing in-flight settlement', async () => {
    const { registry, response, client } = setup();
    setCachedDeck(7, { deck: second, savedSignature: deckSaveSignature(original) });
    const saved = registry.saveNow(7, first);
    registry.markDirty(7);
    registry.discardChanges(7);
    await expect(saved).resolves.toBe(false);
    expect(registry.getSnapshot(7).isModified).toBe(false);
    expect(getCachedDeck(7)).toBeUndefined();
    expect(client.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    expect(registry.getSnapshot(7).pending.size).toBe(1);
    response(0)(null);
    expect(registry.getSnapshot(7).savedSignature).toBe(deckSaveSignature(first));
    expect(getCachedDeck(7)).toBeUndefined();
  });

  it.each(['disconnect', 'dispose'] as const)('resolves outstanding saveNow waiters on %s', async (change) => {
    const { registry, store, response } = setup();
    const saved = registry.saveNow(7, first);
    if (change === 'dispose') {
      registry.dispose();
    } else {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null } }));
    }
    await expect(saved).resolves.toBe(false);
    response(0)(null);
    expect(registry.getSnapshot(7).savedSignature).toBeNull();
  });

  it('owns identical pending signatures independently for each deck', () => {
    const { registry, response } = setup();
    registry.save(7, first);
    registry.save(8, first);
    response(1)(null);
    expect(registry.getSnapshot(8).saveState).toBe('saved');
    expect(registry.getSnapshot(7).saveState).toBe('saving');
    response(0)(null);
    expect(registry.getSnapshot(7).savedSignature).toBe(deckSaveSignature(first));
  });

  it('matches out-of-order replies to their requests without rolling back the cache', () => {
    const { registry, response } = setup();
    setCachedDeck(7, { deck: second, savedSignature: deckSaveSignature(original) });
    registry.save(7, first);
    registry.save(7, second);
    expect(registry.getSnapshot(7).pending.size).toBe(2);
    response(1)(null);
    response(0)(null);
    expect(registry.getSnapshot(7).pending.size).toBe(0);
    expect(registry.getSnapshot(7).savedSignature).toBe(deckSaveSignature(second));
    expect(getCachedDeck(7)?.savedSignature).toBe(deckSaveSignature(second));
    expect(getCachedDeck(7)?.deck).toBe(second);
  });

  it('retains a newer failure when an older request succeeds, then retries', () => {
    const { registry, response } = setup();
    registry.save(7, first);
    registry.save(7, second);
    const error = { responseCode: 1, failure: WebsocketTypes.CommandFailure.Timeout };
    response(1)(error);
    response(0)(null);
    expect(registry.getSnapshot(7).lastFailure).toEqual(error);
    expect(registry.getSnapshot(7).savedSignature).toBe(deckSaveSignature(first));
    expect(registry.getSnapshot(7).saveState).toBe('failed');
    registry.save(7, second);
    response(2)(null);
    expect(registry.getSnapshot(7).lastFailure).toBeNull();
    expect(registry.getSnapshot(7).saveState).toBe('saved');
  });

  it('records who owns a failure until a later save succeeds or the failure is discarded', () => {
    const { registry, response } = setup();
    const error = { responseCode: 1 };
    registry.save(7, first, { xml: '<cockatrice_deck/>' }, 'storage');
    response(0)(error);
    expect(registry.getSnapshot(7)).toMatchObject({ saveState: 'failed', failedBy: 'storage' });
    registry.save(7, second);
    response(1)(error);
    expect(registry.getSnapshot(7).failedBy).toBe('editor');
    registry.discardChanges(7);
    expect(registry.getSnapshot(7)).toMatchObject({ failedBy: null, lastFailure: null });
    registry.save(7, first, undefined, 'storage');
    response(2)(error);
    registry.save(7, second);
    response(3)(null);
    expect(registry.getSnapshot(7)).toMatchObject({ failedBy: null, saveState: 'saved' });
  });

  it('does not let an older failure replace a newer success or settle a response twice', () => {
    const { registry, response } = setup();
    registry.save(7, first);
    registry.save(7, second);
    response(1)(null);
    response(0)({ responseCode: 1 });
    response(1)({ responseCode: 1 });
    expect(registry.getSnapshot(7).lastFailure).toBeNull();
    expect(registry.getSnapshot(7).saveState).toBe('saved');
  });

  it('keeps a newer debounced edit dirty when the previous save settles', () => {
    const { registry, response } = setup();
    registry.save(7, first);
    registry.markDirty(7);
    response(0)(null);
    expect(registry.getSnapshot(7).saveState).toBe('dirty');
  });

  it('resends an older pending signature when a newer save has already succeeded', () => {
    const { registry, response, client } = setup();
    registry.save(7, first);
    registry.save(7, second);
    response(1)(null);
    registry.save(7, first);
    expect(client.request.session.deckUpdate).toHaveBeenCalledTimes(3);
    response(0)(null);
    response(2)(null);
    expect(registry.getSnapshot(7).savedSignature).toBe(deckSaveSignature(first));
  });

  it.each([WebsocketTypes.StatusEnum.DISCONNECTED, WebsocketTypes.StatusEnum.DISCONNECTING])(
    'clears the session on %s and ignores late replies after reconnect', (state) => {
      const { registry, store, response } = setup();
      registry.save(7, first);
      const oldResponse = response(0);
      registry.save(8, second);
      response(1)({ responseCode: 1 });
      setCachedDeck(7, { deck: first, savedSignature: 'old session' });
      store.dispatch(server.Actions.updateStatus({ status: { state, description: null } }));
      expect(registry.getSnapshot(7).pending.size).toBe(0);
      expect(registry.getSnapshot(7).savedSignature).toBeNull();
      expect(registry.getSnapshot(8).lastFailure).toBeNull();
      expect(getCachedDeck(7)).toBeUndefined();
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
      registry.initialize(7, 'new session');
      oldResponse(null);
      expect(registry.getSnapshot(7).savedSignature).toBe('new session');
    },
  );

  it.each(['logout', 'server change'] as const)('invalidates pending responses on %s', (change) => {
    const { registry, store, response } = setup();
    registry.save(7, first);
    store.dispatch(change === 'logout' ? server.Actions.clearStore()
      : server.Actions.updateInfo({ info: { name: 'Another server', version: '1.0.0' } }));
    response(0)(null);
    expect(registry.getSnapshot(7).savedSignature).toBeNull();
    expect(registry.getSnapshot(7).pending.size).toBe(0);
  });

  it('notifies subscribers with stable snapshots and allows unsubscribing', () => {
    const { registry, response } = setup();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    const before = registry.getSnapshot(7);
    expect(registry.getSnapshot(7)).toBe(before);
    registry.save(7, first);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.getSnapshot(7)).not.toBe(before);
    unsubscribe();
    response(0)(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('rebase', () => {
  it('moves the saved baseline to a downloaded document unless the editor has work outstanding', () => {
    const { registry, response } = setup();
    registry.rebase(7, deckSaveSignature(first));
    expect(registry.getSnapshot(7).savedSignature).toBe(deckSaveSignature(first));
    registry.save(7, first);
    expect(registry.getSnapshot(7).pending.size).toBe(0);

    registry.markDirty(8);
    registry.rebase(8, deckSaveSignature(second));
    expect(registry.getSnapshot(8).savedSignature).toBe(deckSaveSignature(original));
    registry.save(8, first);
    registry.rebase(8, deckSaveSignature(second));
    expect(registry.getSnapshot(8).savedSignature).toBe(deckSaveSignature(original));
    response(0)(null);
    expect(registry.getSnapshot(8).savedSignature).toBe(deckSaveSignature(first));

    registry.rebase(9, deckSaveSignature(second));
    expect(registry.getSnapshot(9).savedSignature).toBe(deckSaveSignature(second));
  });
});

describe('dropCleanCachedDeck', () => {
  it('drops only that deck, and only when it holds no unsaved work', () => {
    const { registry } = setup();
    const clean = { deck: original, savedSignature: deckSaveSignature(original) };
    setCachedDeck(1, clean);
    setCachedDeck(2, clean);
    setCachedDeck(3, { deck: first, savedSignature: deckSaveSignature(original) });
    dropCleanCachedDeck(registry, 1);
    dropCleanCachedDeck(registry, 3);
    expect([1, 2, 3].map((id) => getCachedDeck(id) != null)).toEqual([false, true, true]);
  });
});

describe('dropCleanCachedDecks', () => {
  it('drops only editor copies with nothing unsaved, failed or in flight', () => {
    const { registry, response } = setup();
    const clean = { deck: original, savedSignature: deckSaveSignature(original) };
    setCachedDeck(1, clean);
    setCachedDeck(2, { deck: first, savedSignature: deckSaveSignature(original) });
    setCachedDeck(7, clean);
    setCachedDeck(8, clean);
    registry.markDirty(7);
    registry.save(8, first);
    dropCleanCachedDecks(registry);
    expect([1, 2, 7, 8].map((id) => getCachedDeck(id) != null)).toEqual([false, true, true, true]);
    response(0)({ responseCode: 1 });
    registry.discardChanges(7);
    setCachedDeck(7, clean);
    dropCleanCachedDecks(registry);
    expect([7, 8].map((id) => getCachedDeck(id) != null)).toEqual([false, true]);
  });
});

describe('deckSaveRegistry session ownership', () => {
  it('shares one owner across editor subscribers but isolates different sessions', () => {
    const { store, client } = setup();
    const registry = getDeckSaveRegistry(store, client);
    registry.connect();
    registry.initialize(7, 'original');
    registry.save(7, first);
    const unsubscribe = registry.subscribe(vi.fn());
    unsubscribe();
    vi.mocked(client.request.session.deckUpdate).mock.calls[0][4]!({ responseCode: 1 });
    expect(getDeckSaveRegistry(store, client)).toBe(registry);
    expect(registry.getSnapshot(7).saveState).toBe('failed');
    const other = setup();
    expect(getDeckSaveRegistry(other.store, other.client).getSnapshot(7).savedSignature).toBeNull();
  });
});
