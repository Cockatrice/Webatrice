import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { server, type CommandFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useCommandFailureMessage, useReduxEffect, useRequestTracker } from '@app/hooks';
import { parseCod, patchDeckDetails } from '@app/services';
import { onSessionEnd } from '@app/services/session';
import { useAppSelector, type RootState } from '@app/store';

import { deleteCachedDeck } from '../deckEditorCache';
import { renameDeck, setDeckBanner, setDeckTags } from '../deckEdits';
import { deckSaveSignature } from '../deckPersistence';
import { dropCleanCachedDeck, getDeckSaveRegistry, type DeckSaveSnapshot } from '../deckSaveRegistry';
import { storageEditConflict, type DeckStorageEdit } from '../deckStorageEdits';
import { hydrateDeck } from '../hydrate';
import type { HydratedDeck } from '../types';

export type { DeckStorageEdit } from '../deckStorageEdits';

const failedEdits: Map<number, DeckStorageEdit> = new Map();
onSessionEnd(() => failedEdits.clear());

function storageFailed(snapshot: DeckSaveSnapshot): boolean {
  return snapshot.saveState === 'failed' && snapshot.failedBy === 'storage';
}

function blockedByEditor(snapshot: DeckSaveSnapshot): boolean {
  return snapshot.pending.size > 0 || (snapshot.isModified && !storageFailed(snapshot));
}

function applyEdit(deck: HydratedDeck, xml: string, edit: DeckStorageEdit): { next: HydratedDeck; document: string } {
  if ('banner' in edit) {
    return { next: setDeckBanner(deck, edit.banner), document: patchDeckDetails(xml, edit) };
  }
  if ('tags' in edit) {
    const next = setDeckTags(deck, edit.tags);
    return { next, document: patchDeckDetails(xml, { tagsXml: next.tagsXml ?? '<tags/>' }) };
  }
  const next = renameDeck(deck, edit.name);
  return { next, document: patchDeckDetails(xml, { name: next.name }) };
}

export function useDeckStorageDetails(
  deckId: number, xml: string, onSaved: (deckId: number, xml: string) => void, colorIdentity?: string,
) {
  const { t } = useTranslation();
  const client = useWebClient();
  const store = useStore<RootState>();
  const connected = useAppSelector(server.Selectors.getIsConnected);
  const registry = useMemo(() => getDeckSaveRegistry(store, client), [store, client]);
  const snapshot = useSyncExternalStore(registry.subscribe, useCallback(() => registry.getSnapshot(deckId), [registry, deckId]));
  const requests = useRequestTracker();
  const describeFailure = useCommandFailureMessage();
  const [deck, setDeck] = useState<HydratedDeck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const source = useRef<{ deck: HydratedDeck; xml: string } | null>(null);
  const hydration = useRef<Promise<HydratedDeck | null> | null>(null);
  const download = useRef<((xml: string | null) => void) | null>(null);

  useEffect(() => {
    setDeck(null);
    setError(null);
    setSaving(false);
    source.current = null;
    hydration.current = null;
    busy.current = false;
    return () => {
      requests.cancel();
      download.current?.(null);
      download.current = null;
    };
  }, [deckId, connected, requests]);

  const activate = (): Promise<HydratedDeck | null> => {
    if (!connected) {
      return Promise.resolve(null);
    }
    if (source.current) {
      return Promise.resolve(source.current.deck);
    }
    if (hydration.current) {
      return hydration.current;
    }
    registry.connect();
    const request = requests.begin();
    hydration.current = (async () => {
      try {
        const hydrated = await hydrateDeck(parseCod(xml));
        if (requests.isCurrent(request)) {
          registry.initialize(deckId, deckSaveSignature(hydrated));
          source.current = { deck: hydrated, xml };
          setDeck(hydrated);
          return hydrated;
        }
      } catch {
        if (requests.isCurrent(request)) {
          setError(t('DeckStorageEditDialog.loadFailed'));
        }
      } finally {
        if (requests.isCurrent(request)) {
          hydration.current = null;
        }
      }
      return null;
    })();
    return hydration.current;
  };

  useReduxEffect<{ deckId: number; deck: string; requestId?: string }>(
    ({ payload }) => {
      if (payload.deckId === deckId && requests.isCurrent(payload.requestId) && requests.settle(payload.requestId)) {
        download.current?.(payload.deck);
        download.current = null;
      }
    }, server.Types.DECK_DOWNLOADED, [deckId, requests],
  );
  useReduxEffect<CommandFailedPayload & { deckId: number }>(
    ({ payload }) => {
      if (payload.deckId === deckId && requests.isCurrent(payload.requestId) && requests.settle(payload.requestId)) {
        setError(describeFailure(payload.failure, t('DeckStorageEditDialog.loadFailed')));
        download.current?.(null);
        download.current = null;
      }
    }, server.Types.DECK_DOWNLOAD_FAILED, [deckId, requests, describeFailure, t],
  );

  const downloadFresh = (request: string) => new Promise<string | null>((resolve) => {
    download.current = resolve;
    requests.track(request);
    client.request.session.deckDownload(deckId, request);
  });

  const save = async (edit: DeckStorageEdit): Promise<boolean> => {
    if (!source.current || !connected || busy.current || blockedByEditor(registry.getSnapshot(deckId))) {
      return false;
    }
    const request = requests.begin();
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const freshXml = await downloadFresh(request);
      if (freshXml == null || !requests.isCurrent(request) || blockedByEditor(registry.getSnapshot(deckId))) {
        return false;
      }
      let base = source.current;
      if (freshXml !== base.xml) {
        const fresh = { xml: freshXml, deck: await hydrateDeck(parseCod(freshXml)) };
        if (!requests.isCurrent(request)) {
          return false;
        }
        const conflict = storageEditConflict(base.xml, freshXml, edit);
        registry.rebase(deckId, deckSaveSignature(fresh.deck));
        dropCleanCachedDeck(registry, deckId);
        source.current = fresh;
        base = fresh;
        if (conflict) {
          setDeck(fresh.deck);
          onSaved(deckId, freshXml);
          setError(t('DeckStorageEditDialog.changedElsewhere'));
          return false;
        }
      }
      const { next, document } = applyEdit(base.deck, base.xml, edit);
      deleteCachedDeck(deckId);
      const saved = await registry.saveNow(deckId, next, { xml: document, colorIdentity }, 'storage');
      if (saved) {
        failedEdits.delete(deckId);
        onSaved(deckId, document);
      } else if (storageFailed(registry.getSnapshot(deckId))) {
        failedEdits.set(deckId, edit);
      }
      if (!requests.isCurrent(request)) {
        return false;
      }
      if (!saved) {
        const failure = registry.getSnapshot(deckId).lastFailure;
        setError(describeFailure(failure?.failure, t('DeckStorageEditDialog.saveFailed')));
        return false;
      }
      source.current = { deck: next, xml: document };
      setDeck(next);
      return true;
    } catch {
      if (requests.isCurrent(request)) {
        setError(t('DeckStorageEditDialog.loadFailed'));
      }
      return false;
    } finally {
      if (requests.isCurrent(request)) {
        busy.current = false;
        setSaving(false);
      }
    }
  };

  const discardFailed = () => {
    failedEdits.delete(deckId);
    registry.discardChanges(deckId);
    setError(null);
  };

  const failed = storageFailed(snapshot);
  const editorHasChanges = blockedByEditor(snapshot) && snapshot.pending.size === 0;
  return {
    deck, error, saving, activate, editorHasChanges, save,
    failedEdit: failed ? failedEdits.get(deckId) ?? null : null,
    discardFailed: failed ? discardFailed : undefined,
    disabled: !connected || !deck || saving || blockedByEditor(snapshot),
  };
}
