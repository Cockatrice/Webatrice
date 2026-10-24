import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import type { CommandFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { Response_DeckList, ServerInfo_DeckStorage_TreeItem } from '@cockatrice/sockatrice/generated';
import { useBackendDeckList, useCommandFailureMessage, useReduxEffect } from '@app/hooks';
import { emptyCod, parseCod } from '@app/services';
import { onSessionEnd, sessionGeneration } from '@app/services/session';
import type { RootState } from '@app/store';

import { deleteCachedDeck } from '../deckEditorCache';
import { trackDeckImport } from '../deckImportUnload';
import { dropCleanCachedDecks, getDeckSaveRegistry } from '../deckSaveRegistry';
import {
  allDeckFolderPaths,
  deckFolderEntry,
  deckFolderTree,
  decksUnderFolder,
  listDeckFolder,
  type DeckFolderEntry,
  type DeckFolderNode,
  type DeckFolderView,
} from '../deckFolders';
import { summariesEqual, summarizeDeck, type DeckSummary } from '../deckSummary';
import type { FlatDeck } from '../deckTree';
import {
  deckSummaryScope, deckSummaryRevision, invalidateDeckSummary, onDeckSummaryInvalidated,
  readDeckSummaries, writeDeckSummary, type CachedDeckSummary,
} from '../deckSummaryCache';

const summaryCache: Map<number, DeckSummary> = new Map();
const documentCache: Map<number, string> = new Map();
const summaryRequestedCache: Set<number> = new Set();
const summaryVersions = new Map<number, string>();
let memoryScope: string | null = null;

export function clearDecksListCache(): void {
  summaryCache.clear();
  documentCache.clear();
  summaryRequestedCache.clear();
  summaryVersions.clear();
}
onSessionEnd(clearDecksListCache);
onDeckSummaryInvalidated((scope, deckId) => {
  if (scope === memoryScope) {
    summaryCache.delete(deckId);
    documentCache.delete(deckId);
    summaryRequestedCache.delete(deckId);
    summaryVersions.delete(deckId);
  }
});

function forgetDeck(deckId: number): void {
  deleteCachedDeck(deckId);
  summaryCache.delete(deckId);
  documentCache.delete(deckId);
  summaryRequestedCache.delete(deckId);
}

const SERVER_UNNAMED_DECK = 'Unnamed deck';

function storedName(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const nameEl = Array.from(doc.documentElement.children).find((el) => el.tagName === 'deckname');
  return nameEl?.textContent || SERVER_UNNAMED_DECK;
}

type PendingUpload =
  | { kind: 'create'; path: string; name: string }
  | { kind: 'move'; path: string; name: string; fromId: number };

export interface UseDeckList {
  isConnected: boolean;
  loading: boolean;
  listError: string | null;
  storageError: string | null;
  dismissStorageError: () => void;
  folder: DeckFolderView;
  decks: FlatDeck[];
  folderTree: DeckFolderNode[];
  currentFolder: DeckFolderEntry | null;
  summaries: ReadonlyMap<number, DeckSummary>;
  documents: ReadonlyMap<number, string>;
  detailsSaved: (deckId: number, xml: string) => void;
  folderPaths: string[];
  decksUnder: (path: string) => FlatDeck[];
  deckTotal: number;
  publicDeckTotal: number;
  refresh: () => void;
  createDeck: (name: string, format: string) => boolean;
  importDeck: (xml: string, colorIdentity?: string) => boolean;
  deleteDeck: (deck: FlatDeck) => void;
  createFolder: (name: string) => void;
  deleteFolder: (path: string) => void;
  moveDeck: (deck: FlatDeck, targetPath: string) => void;
}

export function useDeckList({ onDeckCreated, folderPath = '' }: {
  onDeckCreated: (deckId: number) => void;
  folderPath?: string;
}): UseDeckList {
  const webClient = useWebClient();
  const store = useStore<RootState>();
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const scope = deckSummaryScope(store.getState(), webClient);
  if (memoryScope !== scope) {
    clearDecksListCache();
    memoryScope = scope;
  }
  const [listError, setListError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<Map<number, DeckSummary>>(() => new Map(summaryCache));
  const [documents, setDocuments] = useState(() => new Map(documentCache));
  const requestedVersions = useRef(new Map<number, { creationTime: number; revision: number }>());
  const requestSummary = useCallback((deck: FlatDeck) => {
    if (requestedVersions.current.has(deck.id)) {
      return;
    }
    const revision = scope ? deckSummaryRevision(scope, deck.id) : 0;
    requestedVersions.current.set(deck.id, {
      creationTime: deck.creationTime, revision,
    });
    summaryVersions.set(deck.id, `${deck.creationTime}:${revision}`);
    summaryRequestedCache.add(deck.id);
    webClient.request.session.deckDownload(deck.id);
  }, [scope, webClient]);

  const pendingMovesRef = useRef<Map<number, { deck: FlatDeck; targetPath: string; awaitingList?: boolean }>>(new Map());

  const clearSummaries = useCallback(() => {
    setListError(null);
    if (scope) {
      const listed = server.Selectors.getBackendDecks(store.getState());
      for (const deck of decksUnderFolder(listed?.root, '')) {
        void invalidateDeckSummary(scope, deck.id);
      }
    }
    summaryRequestedCache.clear();
    summaryVersions.clear();
    summaryCache.clear();
    documentCache.clear();
    setDocuments(new Map());
    dropCleanCachedDecks(getDeckSaveRegistry(store, webClient));
    setSummaries(new Map());
  }, [scope, store, webClient]);
  const { backendDecks, isConnected, refresh } = useBackendDeckList({ beforeRequest: clearSummaries });

  useReduxEffect<CommandFailedPayload>(({ payload: { failure } }) => {
    setListError(describeFailure(failure, t('Decks.listError')));
    for (const [id, move] of pendingMovesRef.current) {
      if (move.awaitingList) {
        pendingMovesRef.current.delete(id);
        setStorageError(describeFailure(failure, t('Decks.moveFailed', { name: move.deck.name })));
      }
    }
  }, server.Types.DECK_LIST_FAILED, [describeFailure, t]);

  const root = backendDecks?.root;
  const folder = useMemo(() => listDeckFolder(root, folderPath), [root, folderPath]);
  const folderPaths = useMemo(() => allDeckFolderPaths(root), [root]);
  const folderTree = useMemo(() => deckFolderTree(root), [root]);
  const currentFolder = useMemo(() => deckFolderEntry(root, folder.path), [root, folder.path]);
  const decks = useMemo(
    () => decksUnderFolder(root, folder.path).sort((a, b) => b.creationTime - a.creationTime),
    [root, folder.path],
  );
  const allDecks = useMemo(() => decksUnderFolder(root, ''), [root]);
  const deckTotal = allDecks.length;
  const publicDeckTotal = useMemo(() => allDecks.filter((deck) => deck.visibility !== 'private').length, [allDecks]);

  const pendingUploadsRef = useRef<PendingUpload[]>([]);

  useReduxEffect<{ path: string; treeItem: ServerInfo_DeckStorage_TreeItem }>(
    ({ payload: { path, treeItem } }) => {
      const pending = pendingUploadsRef.current;
      const index = pending.findIndex((p) => p.path === path && p.name === treeItem.name);
      if (index < 0) {
        return;
      }
      const [settled] = pending.splice(index, 1);
      if (settled.kind === 'move') {
        const summary = summaryCache.get(settled.fromId);
        if (summary && treeItem.id) {
          summaryCache.set(treeItem.id, summary);
          summaryRequestedCache.add(treeItem.id);
          setSummaries((prev) => new Map(prev).set(treeItem.id, summary));
        }
        webClient.request.session.deckDel(settled.fromId);
        forgetDeck(settled.fromId);
      } else if (treeItem.id) {
        onDeckCreated(treeItem.id);
      }
    },
    server.Types.DECK_UPLOAD,
    [onDeckCreated, webClient],
  );

  useReduxEffect<CommandFailedPayload & { path: string }>(
    ({ payload: { path, failure } }) => {
      const pending = pendingUploadsRef.current;
      const index = pending.findIndex((p) => p.path === path);
      if (index < 0) {
        return;
      }
      const [failed] = pending.splice(index, 1);
      const key = failed.kind === 'move' ? 'Decks.moveFailed' : 'Decks.uploadFailed';
      setStorageError(describeFailure(failure, t(key, { name: failed.name })));
    },
    server.Types.DECK_UPLOAD_FAILED,
    [describeFailure, t],
  );

  const upload = (entry: PendingUpload, xml: string, isPublic?: boolean, colorIdentity?: string, requestId?: string) => {
    pendingUploadsRef.current.push(entry);
    if (requestId === undefined) {
      webClient.request.session.deckUpload(entry.path, 0, xml, isPublic, colorIdentity);
    } else {
      webClient.request.session.deckUpload(entry.path, 0, xml, isPublic, colorIdentity, requestId);
    }
  };

  const createDeck = (name: string, format: string): boolean => {
    if (!isConnected) {
      return false;
    }
    const deckName = name || t('Decks.list.defaultDeckName');
    upload({ kind: 'create', path: folder.path, name: deckName }, emptyCod(deckName, format));
    return true;
  };

  const importDeck = (xml: string, colorIdentity = ''): boolean => {
    if (!isConnected) {
      return false;
    }
    const requestId = crypto.randomUUID();
    trackDeckImport(store, requestId);
    upload({ kind: 'create', path: folder.path, name: storedName(xml) }, xml, undefined, colorIdentity, requestId);
    return true;
  };

  const deleteDeck = (deck: FlatDeck) => {
    webClient.request.session.deckDel(deck.id);
    forgetDeck(deck.id);
  };

  const createFolder = (name: string) => {
    if (!isConnected) {
      return;
    }
    webClient.request.session.deckNewDir(folder.path, name);
  };

  const deleteFolder = (path: string) => {
    if (!isConnected || !path) {
      return;
    }
    for (const deck of decksUnderFolder(root, path)) {
      forgetDeck(deck.id);
    }
    webClient.request.session.deckDelDir(path);
  };

  const moveDeck = (deck: FlatDeck, targetPath: string) => {
    if (!isConnected || targetPath === deck.path) {
      return;
    }
    const awaitingList = deck.colorIdentity === undefined;
    pendingMovesRef.current.set(deck.id, { deck, targetPath, awaitingList });
    if (awaitingList) {
      webClient.request.session.deckList();
    } else {
      webClient.request.session.deckDownload(deck.id);
    }
  };

  useReduxEffect<{ deckList: Response_DeckList }>(({ payload: { deckList } }) => {
    const listed = decksUnderFolder(deckList.root, '');
    for (const [id, move] of pendingMovesRef.current) {
      if (!move.awaitingList) {
        continue;
      }
      const deck = listed.find((entry) => entry.id === id);
      if (!deck) {
        pendingMovesRef.current.delete(id);
        setStorageError(t('Decks.moveFailed', { name: move.deck.name }));
        continue;
      }
      pendingMovesRef.current.set(id, { ...move, deck, awaitingList: false });
      webClient.request.session.deckDownload(id);
    }
  }, server.Types.BACKEND_DECKS, [webClient, t]);

  useEffect(() => {
    if (!isConnected || !root) {
      return;
    }
    let active = true;
    const generation = sessionGeneration();
    const revisions = new Map(decks.map((deck) => [deck.id, scope ? deckSummaryRevision(scope, deck.id) : 0]));
    const apply = (rows: CachedDeckSummary[]) => {
      if (!active || generation !== sessionGeneration() || scope !== deckSummaryScope(store.getState(), webClient)) {
        return;
      }
      const cached = new Map(rows.map((row) => [row.deckId, row]));
      for (const deck of decks) {
        const revision = scope ? deckSummaryRevision(scope, deck.id) : 0;
        const version = `${deck.creationTime}:${revision}`;
        if (summaryVersions.get(deck.id) === version && summaryRequestedCache.has(deck.id)) {
          continue;
        }
        const row = revisions.get(deck.id) === revision ? cached.get(deck.id) : undefined;
        summaryVersions.set(deck.id, version);
        summaryRequestedCache.add(deck.id);
        if (row) {
          summaryCache.set(deck.id, row.summary);
          documentCache.set(deck.id, row.document);
        } else {
          summaryCache.delete(deck.id);
          documentCache.delete(deck.id);
          requestSummary(deck);
        }
      }
      setSummaries(new Map(summaryCache));
      setDocuments(new Map(documentCache));
    };
    const persisted = scope ? readDeckSummaries(scope, allDecks) : undefined;
    if (persisted) {
      void persisted.then(apply);
    } else {
      apply([]);
    }
    return () => {
      active = false;
    };
  }, [isConnected, decks, allDecks, root, scope, store, webClient, requestSummary]);

  useReduxEffect<{ deckId: number; deck: string }>(
    ({ payload }) => {
      const requested = requestedVersions.current.get(payload.deckId);
      requestedVersions.current.delete(payload.deckId);
      const currentDeck = decksUnderFolder(server.Selectors.getBackendDecks(store.getState())?.root, '')
        .find((deck) => deck.id === payload.deckId);
      const move = pendingMovesRef.current.get(payload.deckId);
      if (move && !move.awaitingList) {
        pendingMovesRef.current.delete(payload.deckId);
        upload(
          { kind: 'move', path: move.targetPath, name: storedName(payload.deck), fromId: payload.deckId },
          payload.deck,
          move.deck.isPublic,
          move.deck.colorIdentity,
        );
      }
      if (scope && requested && (requested.revision !== deckSummaryRevision(scope, payload.deckId)
        || requested.creationTime !== currentDeck?.creationTime)) {
        if (currentDeck) {
          requestSummary(currentDeck);
        }
        return;
      }
      try {
        const next = summarizeDeck(parseCod(payload.deck));
        if (scope && requested && deckSummaryRevision(scope, payload.deckId) === requested.revision) {
          void writeDeckSummary({
            scope, deckId: payload.deckId, creationTime: requested.creationTime, summary: next, document: payload.deck,
          }, requested.revision);
        }
        documentCache.set(payload.deckId, payload.deck);
        setDocuments((prev) => new Map(prev).set(payload.deckId, payload.deck));
        summaryCache.set(payload.deckId, next);
        setSummaries((prev) => {
          const existing = prev.get(payload.deckId);
          if (existing && summariesEqual(existing, next)) {
            return prev;
          }
          const out = new Map(prev);
          out.set(payload.deckId, next);
          return out;
        });
      } catch {
        // Malformed XML — leave the row without a summary.
      }
    },
    server.Types.DECK_DOWNLOADED,
    [],
  );

  useReduxEffect<CommandFailedPayload & { deckId: number }>(
    ({ payload: { deckId, failure } }) => {
      const requested = requestedVersions.current.get(deckId);
      requestedVersions.current.delete(deckId);
      const currentDeck = decksUnderFolder(server.Selectors.getBackendDecks(store.getState())?.root, '')
        .find((deck) => deck.id === deckId);
      if (scope && requested && currentDeck && (requested.revision !== deckSummaryRevision(scope, deckId)
        || requested.creationTime !== currentDeck.creationTime)) {
        requestSummary(currentDeck);
      }
      const move = pendingMovesRef.current.get(deckId);
      if (!move) {
        return;
      }
      pendingMovesRef.current.delete(deckId);
      setStorageError(describeFailure(failure, t('Decks.moveFailed', { name: move.deck.name })));
    },
    server.Types.DECK_DOWNLOAD_FAILED,
    [describeFailure, t],
  );

  return {
    isConnected,
    loading: !backendDecks,
    listError,
    storageError,
    dismissStorageError: () => setStorageError(null),
    folder,
    decks,
    folderTree,
    currentFolder,
    summaries,
    documents,
    detailsSaved: (deckId, xml) => {
      if (scope !== deckSummaryScope(store.getState(), webClient)) {
        return;
      }
      if (scope) {
        void invalidateDeckSummary(scope, deckId);
      }
      const summary = summarizeDeck(parseCod(xml));
      const listed = allDecks.find((deck) => deck.id === deckId);
      if (listed) {
        summaryVersions.set(deckId, `${listed.creationTime}:${scope ? deckSummaryRevision(scope, deckId) : 0}`);
        summaryRequestedCache.add(deckId);
      }
      documentCache.set(deckId, xml);
      summaryCache.set(deckId, summary);
      setDocuments((prev) => new Map(prev).set(deckId, xml));
      setSummaries((prev) => new Map(prev).set(deckId, summary));
    },
    folderPaths,
    decksUnder: (path: string) => decksUnderFolder(root, path),
    deckTotal,
    publicDeckTotal,
    refresh,
    createDeck,
    importDeck,
    deleteDeck,
    createFolder,
    deleteFolder,
    moveDeck,
  };
}
