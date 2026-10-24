import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from 'react-redux';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useReduxEffect } from '@app/hooks';
import type { RootState } from '@app/store';

import { deleteCachedDraft } from '../deckEditorCache';
import { deckColorIdentity, deckSaveSignature, serializeDeckForSave } from '../deckPersistence';
import { getDeckSaveRegistry, type SaveState } from '../deckSaveRegistry';
import type { HydratedDeck } from '../types';

export const AUTOSAVE_DEBOUNCE_MS = 500;
export type { SaveState } from '../deckSaveRegistry';

export interface DeckAutosave {
  saveState: SaveState;
  scheduleSave: () => void;
  flushSave: () => void;
  isModified: boolean;
  saveNow: () => Promise<boolean>;
  discardChanges: () => void;
  pauseAutosave: () => void;
  resumeAutosave: () => void;
  markSaved: (signature: string) => void;
  resetSaved: () => void;
  savedSignature: () => string | null;
}

export interface DraftAutosave {
  key: string;
  onStored: (deckId: number, signature: string) => void;
}

export function useDeckAutosave(
  deckId: number | null,
  readDeck: () => HydratedDeck | null,
  initialSavedSignature: string | null,
  draft?: DraftAutosave,
): DeckAutosave {
  const webClient = useWebClient();
  const store = useStore<RootState>();
  const registry = useMemo(() => getDeckSaveRegistry(store, webClient), [store, webClient]);
  const storedIdRef = useRef<number | null>(null);
  const getSnapshot = useCallback(() => registry.getSnapshot(deckId ?? storedIdRef.current), [registry, deckId]);
  const { saveState: storedSaveState, isModified: storedIsModified } = useSyncExternalStore(registry.subscribe, getSnapshot);
  const saveTimerRef = useRef<number | null>(null);
  const savePendingRef = useRef(false);
  const autosavePausedRef = useRef(false);
  const [draftSaveState, setDraftSaveState] = useState<SaveState>('idle');
  const draftSavedSignatureRef = useRef<string | null>(deckId == null ? initialSavedSignature : null);
  const draftUploadRef = useRef<{ signature: string; requestId: string } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const draftKey = draft?.key ?? null;
  const previousDraftKeyRef = useRef(draftKey);
  const previousIdentityRef = useRef({ deckId, draftKey });
  const draftWaitersRef = useRef<((saved: boolean) => void)[]>([]);
  const answerDraftWaiters = useCallback((saved: boolean) => {
    const waiters = draftWaitersRef.current;
    draftWaitersRef.current = [];
    waiters.forEach((resolve) => resolve(saved));
  }, []);
  const cancelScheduledSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const previous = previousIdentityRef.current;
    if (previous.deckId === deckId && previous.draftKey === draftKey) {
      return;
    }
    const handoff = previous.deckId == null && deckId != null && storedIdRef.current === deckId;
    if (!handoff) {
      autosavePausedRef.current = false;
      savePendingRef.current = false;
    }
    previousIdentityRef.current = { deckId, draftKey };
  }, [deckId, draftKey]);

  useEffect(() => {
    if (previousDraftKeyRef.current === draftKey) {
      return;
    }
    previousDraftKeyRef.current = draftKey;
    storedIdRef.current = null;
    draftUploadRef.current = null;
    draftSavedSignatureRef.current = null;
    answerDraftWaiters(false);
    setDraftSaveState('idle');
  }, [draftKey, answerDraftWaiters]);

  useEffect(() => {
    registry.connect();
    if (deckId != null) {
      registry.initialize(deckId, initialSavedSignature);
      storedIdRef.current = null;
    }
  }, [registry, deckId, initialSavedSignature]);

  const persistNow = useCallback(() => {
    if (autosavePausedRef.current) {
      return;
    }
    savePendingRef.current = false;
    const current = readDeck();
    const targetId = deckId ?? storedIdRef.current;
    if (!current) {
      return;
    }
    if (targetId != null) {
      registry.save(targetId, current);
      return;
    }
    if (!draftRef.current) {
      return;
    }
    const signature = deckSaveSignature(current);
    if (draftUploadRef.current == null && signature !== draftSavedSignatureRef.current) {
      const requestId = crypto.randomUUID();
      draftUploadRef.current = { signature, requestId };
      setDraftSaveState('saving');
      webClient.request.session.deckUpload('', 0, serializeDeckForSave(current), undefined, deckColorIdentity(current.cards), requestId);
    }
  }, [registry, deckId, webClient, readDeck]);

  useReduxEffect<{ path: string; treeItem: { id: number }; requestId?: string }>(
    ({ payload }) => {
      const upload = draftUploadRef.current;
      if (upload == null || deckId != null || payload.requestId !== upload.requestId) {
        return;
      }
      const { signature } = upload;
      draftUploadRef.current = null;
      storedIdRef.current = payload.treeItem.id;
      draftSavedSignatureRef.current = signature;
      setDraftSaveState('saved');
      cancelScheduledSave();
      registry.initialize(payload.treeItem.id, signature);
      const current = readDeck();
      const paused = autosavePausedRef.current;
      savePendingRef.current = paused && current != null && deckSaveSignature(current) !== signature;
      if (savePendingRef.current) {
        registry.markDirty(payload.treeItem.id);
      }
      const waiters = draftWaitersRef.current;
      draftWaitersRef.current = [];
      draftRef.current?.onStored(payload.treeItem.id, signature);
      if (current) {
        if (waiters.length) {
          const completion = paused ? registry.waitForSave(payload.treeItem.id) : registry.saveNow(payload.treeItem.id, current);
          void completion.then((saved) => {
            waiters.forEach((resolve) => resolve(saved));
          });
        } else if (!paused) {
          registry.save(payload.treeItem.id, current);
        }
      } else {
        waiters.forEach((resolve) => resolve(false));
      }
    },
    server.Types.DECK_UPLOAD,
    [deckId, registry, readDeck, cancelScheduledSave],
  );
  useReduxEffect<{ requestId?: string }>(
    ({ payload }) => {
      const upload = draftUploadRef.current;
      if (deckId == null && upload != null && payload.requestId === upload.requestId) {
        draftUploadRef.current = null;
        setDraftSaveState('failed');
        answerDraftWaiters(false);
      }
    },
    server.Types.DECK_UPLOAD_FAILED,
    [deckId, answerDraftWaiters],
  );

  const scheduleSave = useCallback(() => {
    const targetId = deckId ?? storedIdRef.current;
    if (targetId != null) {
      registry.markDirty(targetId);
    } else if (draftRef.current) {
      setDraftSaveState('dirty');
    } else {
      return;
    }
    savePendingRef.current = true;
    cancelScheduledSave();
    if (autosavePausedRef.current) {
      return;
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistNow();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [registry, deckId, persistNow, cancelScheduledSave]);

  const flushSave = useCallback(() => {
    if (savePendingRef.current && !autosavePausedRef.current) {
      cancelScheduledSave();
      persistNow();
    }
  }, [persistNow, cancelScheduledSave]);
  useEffect(() => flushSave, [flushSave, draftKey]);
  useEffect(() => () => answerDraftWaiters(false), [answerDraftWaiters, draftKey]);

  const pauseAutosave = useCallback(() => {
    autosavePausedRef.current = true;
    cancelScheduledSave();
  }, [cancelScheduledSave]);

  const resumeAutosave = useCallback(() => {
    if (!autosavePausedRef.current) {
      return;
    }
    autosavePausedRef.current = false;
    if (savePendingRef.current) {
      scheduleSave();
    }
  }, [scheduleSave]);

  const saveNow = useCallback((): Promise<boolean> => {
    autosavePausedRef.current = false;
    savePendingRef.current = false;
    cancelScheduledSave();
    const targetId = deckId ?? storedIdRef.current;
    const current = readDeck();
    if (!current) {
      return Promise.resolve(false);
    }
    if (targetId != null) {
      return registry.saveNow(targetId, current);
    }
    if (!draftRef.current) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      draftWaitersRef.current.push(resolve);
      persistNow();
      if (draftUploadRef.current == null && storedIdRef.current == null) {
        answerDraftWaiters(draftSavedSignatureRef.current === deckSaveSignature(current));
      }
    });
  }, [registry, deckId, readDeck, persistNow, cancelScheduledSave, answerDraftWaiters]);

  const discardChanges = useCallback(() => {
    savePendingRef.current = false;
    cancelScheduledSave();
    const targetId = deckId ?? storedIdRef.current;
    if (targetId != null) {
      registry.discardChanges(targetId);
    } else {
      if (draftKey != null) {
        deleteCachedDraft(draftKey);
      }
      draftUploadRef.current = null;
      draftSavedSignatureRef.current = null;
      answerDraftWaiters(false);
      setDraftSaveState('idle');
    }
  }, [registry, deckId, draftKey, cancelScheduledSave, answerDraftWaiters]);

  const markSaved = useCallback((signature: string) => {
    const targetId = deckId ?? storedIdRef.current;
    if (targetId != null) {
      registry.markSaved(targetId, signature);
    } else {
      draftSavedSignatureRef.current = signature;
      setDraftSaveState('idle');
    }
  }, [registry, deckId]);
  const resetSaved = useCallback(() => {
    const targetId = deckId ?? storedIdRef.current;
    if (targetId != null) {
      registry.markSaved(targetId, null);
    } else {
      draftSavedSignatureRef.current = null;
      setDraftSaveState('idle');
    }
  }, [registry, deckId]);
  const savedSignature = useCallback(() => {
    const targetId = deckId ?? storedIdRef.current;
    return targetId == null ? draftSavedSignatureRef.current : registry.getSnapshot(targetId).savedSignature;
  }, [registry, deckId]);
  const saveState = deckId == null && (storedIdRef.current == null || storedSaveState === 'idle')
    ? draftSaveState : storedSaveState;
  const isModified = (deckId ?? storedIdRef.current) != null
    ? storedIsModified : draftSaveState === 'dirty' || draftSaveState === 'failed';

  return {
    saveState, isModified, saveNow, discardChanges, pauseAutosave, resumeAutosave,
    scheduleSave, flushSave, markSaved, resetSaved, savedSignature,
  };
}
