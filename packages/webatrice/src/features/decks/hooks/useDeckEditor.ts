import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';

import { server, type games } from '@cockatrice/datatrice';
import type { CommandFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useCommandFailureMessage, useReduxEffect, useRequestTracker } from '@app/hooks';
import { lookupCard, parseCod, takeStagedDeck, trackEvent } from '@app/services';
import { onSessionEnd } from '@app/services/session';
import { useAppSelector, type RootState } from '@app/store';
import { RouteEnum, type BracketAssessment } from '@app/types';

import {
  deleteDraft,
  getCachedDeck,
  getCachedDraft,
  getDraftDocument,
  setCachedDeck,
  setCachedDraft,
  setDraftDocument,
} from '../deckEditorCache';
import {
  adjustCardQuantity,
  appendCard,
  findMainboardRow,
  normalizeAddedCardName,
  removeCard,
  renameDeck,
  setCardCategory,
  setCardCommander,
  setCardPrinting,
  setDeckBanner,
  setDeckBracketAssessment,
  setDeckDescription,
  setDeckFormat,
  setDeckPriceCache,
  setDeckTags,
  setDeckPlaymat,
  type CardPrinting,
} from '../deckEdits';
import { countDeckCards } from '../deckGrouping';
import { findDeckFile } from '../deckTree';
import { deckSummaryRevision, deckSummaryScope, readDeckSummary } from '../deckSummaryCache';
import {
  DESCRIPTION_COALESCE_MS,
  RENAME_COALESCE_MS,
  type DeckHistory,
  type DeckHistoryReason,
} from '../deckHistory';
import { deckSaveSignature } from '../deckPersistence';
import type { BannerCandidate } from '../deckTags';
import { applyDeckCardDataRefresh, assembleDeckCard, hydrateDeck, type DeckCardDataRefresh } from '../hydrate';
import type { DeckCard, HydratedDeck } from '../types';
import { useDeckAutosave, type SaveState } from './useDeckAutosave';
import { useDeckHistory } from './useDeckHistory';

export type { SaveState } from './useDeckAutosave';

export type AddCardZone = 'main' | 'side';

export interface AddCardOptions {
  zone?: AddCardZone;
  scryfallId?: string;
}

const ZONE_CATEGORY: Record<AddCardZone, DeckCard['category']> = { main: 'main', side: 'sideboard' };

function findZoneRow(deck: HydratedDeck, name: string, category: DeckCard['category'], scryfallId?: string): number {
  const lower = name.toLowerCase();
  const inZone = (c: DeckCard) => c.category === category && c.name.toLowerCase() === lower;
  if (scryfallId) {
    return deck.cards.findIndex((c) => inZone(c) && c.scryfallId === scryfallId);
  }
  return category === 'main' ? findMainboardRow(deck, name) : deck.cards.findIndex(inZone);
}

export interface UseDeckEditor {
  deck: HydratedDeck | null;
  loading: boolean;
  hydrating: boolean;
  readOnlyReason: string | null;
  notFound: boolean;
  loadError: string | null;
  saveState: SaveState;
  /** Total (main + commander), excluding sideboard, for the header. */
  totalMainboardCount: number;
  totalSideboardCount: number;

  // --- Mutations (all optimistic; each schedules an autosave) ---
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setFormat: (format: string) => void;
  setBanner: (banner: BannerCandidate | null) => void;
  setTags: (tags: readonly string[]) => void;
  setPlaymat: (playmat: games.Playmat | null) => void;
  setPriceCache: (priceUsd: number | undefined, priceMissingCount: number | undefined) => void;
  setBracketAssessment: (assessment: BracketAssessment | undefined) => void;
  setPrinting: (index: number, printing: CardPrinting) => void;
  deleteCard: (index: number) => void;
  incQuantity: (index: number, delta: number) => void;
  setCategory: (index: number, category: DeckCard['category']) => void;
  /** Toggle the commander marker on a card. Independent of category.
   *  See DeckCard.isCommander for the full rationale. */
  setCommander: (index: number, isCommander: boolean) => void;
  addCard: (name: string, options?: AddCardOptions) => Promise<void>;
  flushSave: () => void;
  retrySave: () => void;
  isModified: boolean;
  saveNow: () => Promise<boolean>;
  discardChanges: () => void;
  pauseAutosave: () => void;
  resumeAutosave: () => void;

  history: DeckHistory;
  canUndo: boolean;
  canRedo: boolean;
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
}

export function useDeckEditor(deckId: number | null, draftToken: string | null = null): UseDeckEditor {
  const webClient = useWebClient();
  const store = useStore<RootState>();
  const scope = useAppSelector((state) => deckSummaryScope(state, webClient));
  const navigate = useNavigate();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);

  const isDraft = deckId == null && draftToken != null;
  const initialCached = deckId != null ? getCachedDeck(deckId) : undefined;
  const initialDraft = isDraft ? getCachedDraft(draftToken) : undefined;
  const [deck, setDeck] = useState<HydratedDeck | null>(initialCached?.deck ?? initialDraft ?? null);
  const [loading, setLoading] = useState(!initialCached && !initialDraft);
  const [hydrating, setHydrating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const requests = useRequestTracker();

  const deckRef = useRef<HydratedDeck | null>(null);
  const hydrationControllerRef = useRef<AbortController | null>(null);
  const provisionalDocumentRef = useRef<string | null>(null);
  const downloadReceivedRef = useRef(false);
  const readDeck = useCallback(() => deckRef.current, []);
  const publishProvisional = useCallback((document: string, parsed: ReturnType<typeof parseCod>) => {
    deckRef.current = null;
    setHydrating(true);
    if (provisionalDocumentRef.current !== document) {
      provisionalDocumentRef.current = document;
      setDeck({ ...parsed, cards: parsed.cards.map((row) => assembleDeckCard(row, undefined)) });
    }
  }, []);
  const clearProvisional = useCallback(() => {
    deckRef.current = null;
    provisionalDocumentRef.current = null;
    setDeck(null);
    setHydrating(false);
  }, []);

  const onDraftStored = useCallback((storedId: number, signature: string) => {
    if (!isDraft || !deckRef.current) {
      return;
    }
    setCachedDeck(storedId, { deck: deckRef.current, savedSignature: signature });
    deleteDraft(draftToken);
    navigate(generatePath(RouteEnum.DECK, { deckId: String(storedId) }), { replace: true });
  }, [isDraft, draftToken, navigate]);
  const autosave = useDeckAutosave(
    deckId,
    readDeck,
    initialCached?.savedSignature ?? null,
    isDraft ? { key: draftToken, onStored: onDraftStored } : undefined,
  );
  const { scheduleSave, markSaved, resetSaved, savedSignature } = autosave;
  const history = useDeckHistory();
  const { record, clear: clearHistory, undo: undoHistory, redo: redoHistory } = history;

  const applyCardDataRefresh = useCallback((refresh: DeckCardDataRefresh, signal: AbortSignal) => {
    const current = deckRef.current;
    if (signal.aborted || !current) {
      return;
    }
    const next = applyDeckCardDataRefresh(current, refresh);
    if (next !== current) {
      deckRef.current = next;
      setDeck(next);
    }
  }, []);

  const identity = deckId ?? draftToken;
  const [seededIdentity, setSeededIdentity] = useState(identity);
  if (seededIdentity !== identity) {
    clearHistory();
    const cached = initialCached?.deck ?? initialDraft;
    setSeededIdentity(identity);
    setDeck(cached ?? null);
    setLoading(!cached);
    setHydrating(false);
    setNotFound(false);
    setLoadError(null);
  }

  useEffect(() => {
    deckRef.current = hydrating ? null : deck;
  }, [deck, hydrating]);

  useEffect(() => {
    if (!isDraft) {
      return;
    }
    if (getCachedDraft(draftToken)) {
      setLoading(false);
      setNotFound(false);
      return;
    }
    const cod = getDraftDocument(draftToken) ?? takeStagedDeck(draftToken);
    if (cod == null) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setDraftDocument(draftToken, cod);
    provisionalDocumentRef.current = null;
    const controller = new AbortController();
    const unsubscribe = onSessionEnd(() => {
      controller.abort();
      clearProvisional();
      setLoading(true);
    });
    (async () => {
      try {
        const parsed = parseCod(cod);
        publishProvisional(cod, parsed);
        let refresh: Promise<DeckCardDataRefresh> | undefined;
        const hydrated = await hydrateDeck(parsed, controller.signal, (pending) => {
          refresh = pending;
        });
        if (controller.signal.aborted) {
          return;
        }
        deckRef.current = hydrated;
        setCachedDraft(draftToken, hydrated);
        void refresh?.then((data) => applyCardDataRefresh(data, controller.signal));
        setDeck(hydrated);
        setHydrating(false);
        provisionalDocumentRef.current = null;
        clearHistory();
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
          return;
        }
        console.error('Failed to parse deck XML', err);
        clearProvisional();
        setNotFound(true);
        setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [isDraft, draftToken, clearHistory, publishProvisional, clearProvisional, applyCardDataRefresh]);

  // --- Load ---
  useEffect(() => {
    requests.cancel();
    hydrationControllerRef.current?.abort();
    hydrationControllerRef.current = null;
    if (deckId == null) {
      return;
    }
    const controller = new AbortController();
    hydrationControllerRef.current = controller;
    const unsubscribe = onSessionEnd(() => {
      controller.abort();
      clearProvisional();
      setLoading(true);
    });
    const cleanup = () => {
      controller.abort();
      unsubscribe();
      if (hydrationControllerRef.current === controller) {
        hydrationControllerRef.current = null;
      }
      requests.cancel();
    };
    const cached = getCachedDeck(deckId);
    if (cached) {
      if (savedSignature() !== cached.savedSignature) {
        if (cached.savedSignature == null) {
          resetSaved();
        } else {
          markSaved(cached.savedSignature);
        }
      }
      setLoading(false);
      setNotFound(false);
      return cleanup;
    }
    if (!isConnected) {
      return cleanup;
    }
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    clearProvisional();
    downloadReceivedRef.current = false;
    const requestId = requests.begin();
    requests.track(requestId);
    webClient.request.session.deckDownload(deckId, requestId);
    if (scope) {
      const file = findDeckFile(server.Selectors.getBackendDecks(store.getState())?.root, deckId);
      if (!file) {
        return cleanup;
      }
      const revision = deckSummaryRevision(scope, deckId);
      void readDeckSummary(scope, deckId, file.creationTime).then((row) => {
        if (controller.signal.aborted || downloadReceivedRef.current || !requests.isCurrent(requestId)
          || scope !== deckSummaryScope(store.getState(), webClient) || revision !== deckSummaryRevision(scope, deckId)) {
          return;
        }
        const current = findDeckFile(server.Selectors.getBackendDecks(store.getState())?.root, deckId);
        if (row && row.creationTime === current?.creationTime) {
          try {
            publishProvisional(row.document, parseCod(row.document));
          } catch {
            return;
          }
        }
      });
    }
    return cleanup;
  }, [isConnected, deckId, webClient, resetSaved, markSaved, savedSignature, requests, scope, store,
    publishProvisional, clearProvisional]);

  useReduxEffect<{ deckId: number; deck: string; requestId?: string }>(
    ({ payload }) => {
      if (payload.deckId !== deckId || !requests.isCurrent(payload.requestId) || !requests.settle(payload.requestId)) {
        return;
      }
      downloadReceivedRef.current = true;
      (async () => {
        const controller = hydrationControllerRef.current;
        if (!controller || controller.signal.aborted) {
          return;
        }
        try {
          const parsed = parseCod(payload.deck);
          publishProvisional(payload.deck, parsed);
          let refresh: Promise<DeckCardDataRefresh> | undefined;
          const hydrated = await hydrateDeck(parsed, controller.signal, (pending) => {
            refresh = pending;
          });
          if (controller.signal.aborted || !requests.isCurrent(payload.requestId)) {
            return;
          }
          requests.cancel();
          const hasLegacyCommanderZone = payload.deck.includes('<zone name="commander"');
          const needsMigration = (!parsed.format.trim() && hydrated.format !== '') || hasLegacyCommanderZone;
          const signature = needsMigration ? null : deckSaveSignature(hydrated);
          deckRef.current = hydrated;
          setDeck(hydrated);
          setHydrating(false);
          provisionalDocumentRef.current = null;
          clearHistory();
          if (signature == null) {
            resetSaved();
          } else {
            markSaved(signature);
          }
          trackEvent('deck_opened', { format: hydrated.format });
          setCachedDeck(payload.deckId, { deck: hydrated, savedSignature: signature });
          void refresh?.then((data) => applyCardDataRefresh(data, controller.signal));
          setLoading(false);
          if (needsMigration) {
            scheduleSave();
          }
        } catch (err) {
          if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError'
            || !requests.isCurrent(payload.requestId)) {
            return;
          }
          requests.cancel();
          console.error('Failed to parse deck XML', err);
          clearProvisional();
          setNotFound(true);
          setLoading(false);
        }
      })();
    },
    server.Types.DECK_DOWNLOADED,
    [deckId, requests, publishProvisional, clearProvisional, applyCardDataRefresh],
  );

  useReduxEffect<CommandFailedPayload & { deckId: number }>(
    ({ payload }) => {
      if (payload.deckId !== deckId || !requests.isCurrent(payload.requestId) || !requests.settle(payload.requestId)) {
        return;
      }
      requests.cancel();
      clearProvisional();
      setLoadError(describeFailure(payload.failure, t('DeckEditor.downloadFailed')));
      setNotFound(true);
      setLoading(false);
    },
    server.Types.DECK_DOWNLOAD_FAILED,
    [deckId, describeFailure, t, requests, clearProvisional],
  );

  useEffect(() => {
    if (hydrating) {
      return;
    }
    if (isDraft && deck) {
      setCachedDraft(draftToken, deck);
      return;
    }
    if (deckId == null || !deck) {
      return;
    }
    const existing = getCachedDeck(deckId);
    setCachedDeck(deckId, {
      deck,
      savedSignature: existing ? existing.savedSignature : savedSignature(),
    });
  }, [deckId, isDraft, draftToken, deck, savedSignature, hydrating]);

  // --- Mutations ---
  // Applies `edit` to the latest deck. A user edit passes the `reason` it
  // is listed under in the undo history (desktop `DeckStateManager`
  // `modifyDeck` / `requestHistorySave`); derived caches pass none. An
  // edit that returns the same deck is not an edit at all.
  const applyEdit = useCallback(
    (edit: (current: HydratedDeck) => HydratedDeck, reason?: DeckHistoryReason, coalesceMs?: number) => {
      const before = deckRef.current;
      if (!before) {
        return;
      }
      const next = edit(before);
      if (next === before) {
        return;
      }
      if (reason) {
        record(before, reason, coalesceMs);
      }
      deckRef.current = next;
      setDeck(next);
      if (reason || !isDraft) {
        scheduleSave();
      }
    },
    [record, scheduleSave, isDraft],
  );

  const editCard = useCallback(
    (index: number, edit: (current: HydratedDeck) => HydratedDeck, reason: (card: DeckCard) => DeckHistoryReason) => {
      const card = deckRef.current?.cards[index];
      if (card) {
        applyEdit(edit, reason(card));
      }
    },
    [applyEdit],
  );

  const restore = useCallback(
    (step: (current: HydratedDeck) => HydratedDeck | null) => {
      const current = deckRef.current;
      const restored = current ? step(current) : null;
      if (!restored) {
        return;
      }
      deckRef.current = restored;
      setDeck(restored);
      scheduleSave();
    },
    [scheduleSave],
  );
  const undo = useCallback((steps = 1) => restore((d) => undoHistory(d, steps)), [restore, undoHistory]);
  const redo = useCallback((steps = 1) => restore((d) => redoHistory(d, steps)), [restore, redoHistory]);

  const setName = useCallback(
    (name: string) => applyEdit(
      (d) => renameDeck(d, name),
      { kind: 'rename', from: deckRef.current?.name ?? '', to: name },
      RENAME_COALESCE_MS,
    ),
    [applyEdit],
  );
  const setFormat = useCallback(
    (format: string) => applyEdit((d) => setDeckFormat(d, format), { kind: 'format', format }),
    [applyEdit],
  );
  const setDescription = useCallback(
    (description: string) => applyEdit(
      (d) => setDeckDescription(d, description),
      { kind: 'description', before: deckRef.current?.meta.description?.length ?? 0, after: description.length },
      DESCRIPTION_COALESCE_MS,
    ),
    [applyEdit],
  );
  const setBanner = useCallback(
    (banner: BannerCandidate | null) => applyEdit(
      (d) => setDeckBanner(d, banner),
      banner ? { kind: 'banner', name: banner.name } : { kind: 'bannerCleared' },
    ),
    [applyEdit],
  );
  const setTags = useCallback(
    (tags: readonly string[]) => applyEdit((d) => setDeckTags(d, tags), { kind: 'tags' }),
    [applyEdit],
  );
  const setPlaymat = useCallback(
    (playmat: games.Playmat | null) => applyEdit((d) => setDeckPlaymat(d, playmat), { kind: 'playmat' }),
    [applyEdit],
  );
  const setPriceCache = useCallback(
    (priceUsd: number | undefined, priceMissingCount: number | undefined) =>
      applyEdit((d) => setDeckPriceCache(d, priceUsd, priceMissingCount)),
    [applyEdit],
  );
  const setBracketAssessment = useCallback(
    (assessment: BracketAssessment | undefined) => applyEdit((d) => setDeckBracketAssessment(d, assessment)),
    [applyEdit],
  );
  const setPrinting = useCallback(
    (index: number, printing: CardPrinting) => editCard(
      index,
      (d) => setCardPrinting(d, index, printing),
      (card) => ({ kind: 'changePrinting', name: card.name, set: printing.set ?? '' }),
    ),
    [editCard],
  );
  const deleteCard = useCallback(
    (index: number) => editCard(index, (d) => removeCard(d, index), (card) => ({ kind: 'removeCard', name: card.name })),
    [editCard],
  );
  const incQuantity = useCallback(
    (index: number, delta: number) => editCard(
      index,
      (d) => adjustCardQuantity(d, index, delta),
      (card) => ({ kind: 'adjustCard', delta, name: card.name }),
    ),
    [editCard],
  );
  const setCategory = useCallback(
    (index: number, category: DeckCard['category']) => editCard(
      index,
      (d) => setCardCategory(d, index, category),
      (card) => ({ kind: 'moveCard', count: card.quantity, name: card.name, zone: category }),
    ),
    [editCard],
  );
  const setCommander = useCallback(
    (index: number, isCommander: boolean) => editCard(
      index,
      (d) => setCardCommander(d, index, isCommander),
      (card) => ({ kind: isCommander ? 'setCommander' : 'unsetCommander', name: card.name }),
    ),
    [editCard],
  );

  const addCard = useCallback(
    async (name: string, options: AddCardOptions = {}) => {
      const trimmed = normalizeAddedCardName(name);
      if (!trimmed || !deckRef.current) {
        return;
      }
      const zone = options.zone ?? 'main';
      const category = ZONE_CATEGORY[zone];
      const current = deckRef.current;
      if (current) {
        const existingIdx = findZoneRow(current, trimmed, category, options.scryfallId);
        if (existingIdx >= 0) {
          editCard(
            existingIdx,
            (d) => adjustCardQuantity(d, existingIdx, 1),
            (card) => ({ kind: 'addCard', zone: category, name: card.name }),
          );
          return;
        }
      }
      const lookup = await lookupCard(trimmed);
      const newCard = assembleDeckCard({ name: trimmed, quantity: 1, category, scryfallId: options.scryfallId }, lookup);
      applyEdit((d) => appendCard(d, newCard), { kind: 'addCard', zone: category, name: newCard.name });
    },
    [applyEdit, editCard],
  );

  const { totalMainboardCount, totalSideboardCount } = countDeckCards(deck?.cards);
  const retrySave = useCallback(() => {
    if (deckRef.current) {
      scheduleSave();
    }
  }, [scheduleSave]);

  return {
    deck,
    loading,
    hydrating,
    readOnlyReason: hydrating ? t('DeckEditor.hydrating') : null,
    notFound,
    loadError,
    saveState: autosave.saveState,
    totalMainboardCount,
    totalSideboardCount,
    setName,
    setDescription,
    setFormat,
    setBanner,
    setTags,
    setPlaymat,
    setPriceCache,
    setBracketAssessment,
    setPrinting,
    deleteCard,
    incQuantity,
    setCategory,
    setCommander,
    addCard,
    flushSave: autosave.flushSave,
    retrySave,
    isModified: autosave.isModified,
    saveNow: autosave.saveNow,
    discardChanges: autosave.discardChanges,
    pauseAutosave: autosave.pauseAutosave,
    resumeAutosave: autosave.resumeAutosave,
    history: history.history,
    canUndo: !hydrating && history.canUndo,
    canRedo: !hydrating && history.canRedo,
    undo,
    redo,
  };
}
