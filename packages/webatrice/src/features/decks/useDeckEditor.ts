import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { WebClient } from '@cockatrice/sockatrice';
import {
  Command_DeckUpload_ext,
  Command_DeckUploadSchema,
  Response_DeckUpload_ext,
} from '@cockatrice/sockatrice/generated';
import { useAppSelector } from '@app/store';
import { useReduxEffect } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';

import { lookupCard } from './cardLookup';
import { parseCod, serializeCod } from './cod';
import { assembleDeckCard, hydrateDeck } from './hydrate';
import { touchMeta } from './meta';
import type { BracketAssessment, DeckCard, DeckMeta, HydratedDeck } from './types';

/**
 * State + actions the DeckEditor UI uses. Splitting the hook out of
 * the component keeps the component tree focused on rendering; all
 * network + Redux plumbing (download → parse → hydrate → autosave)
 * lives here.
 *
 * Data flow on mount:
 *   1. `deckDownload(deckId)` fires.
 *   2. `useReduxEffect(DECK_DOWNLOADED)` catches the response, checks
 *      the payload's deckId matches (guards against opening a
 *      different deck while an earlier request is in flight), and
 *      parses + hydrates the XML.
 *   3. `deck` state is populated, `loading` flips to false.
 *
 * Auto-save:
 *   • Every mutation updates `deck` locally (optimistic).
 *   • A 500ms debounced effect serializes the deck to `.cod` XML and
 *     calls `uploadDeckUpdate(deckId, xml)` (a local helper that
 *     bypasses the sockatrice wrapper — see the note on that
 *     function for the proto2 `path`-presence bug it works around).
 *   • On the server ack, `uploadDeckUpdate` (a) refetches the deck
 *     list so MyDecks + sticky tab titles reflect the change without
 *     a manual refresh, and (b) fires the caller's onDone so we can
 *     flip the save indicator from "Saving…" to "Saved".
 */

const AUTOSAVE_DEBOUNCE_MS = 500;

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

export interface UseDeckEditor {
  deck: HydratedDeck | null;
  loading: boolean;
  notFound: boolean;
  saveState: SaveState;
  /** Total (main + commander), excluding sideboard, for the header. */
  totalMainboardCount: number;
  totalSideboardCount: number;

  // --- Mutations (all optimistic; each schedules an autosave) ---
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  /** Set the deck's format (`commander`, `modern`, `other`, or any
   *  custom string). Persists to the `<format>` element via autosave.
   *  Editor UI gates MTG-specific features off this value. */
  setFormat: (format: string) => void;
  /** Persist a freshly-computed price cache into meta.priceUsd /
   *  priceMissingCount. Used by the sidebar's Buy button after
   *  Scryfall lookups so the totals survive a reload. */
  setPriceCache: (priceUsd: number | undefined, priceMissingCount: number | undefined) => void;
  /** Persist a freshly-computed bracket assessment onto the deck.
   *  Writes to the `<bracketAssessment>` XML element (level +
   *  flagged card lists + a deck fingerprint for staleness detection)
   *  AND mirrors `level` into `meta.bracketLevel` so legacy consumers
   *  that only read the JSON blob keep working. Passing `undefined`
   *  clears both caches — used when the assessment failed. */
  setBracketAssessment: (assessment: BracketAssessment | undefined) => void;
  updateCard: (index: number, patch: Partial<DeckCard>) => void;
  deleteCard: (index: number) => void;
  incQuantity: (index: number, delta: number) => void;
  setCategory: (index: number, category: DeckCard['category']) => void;
  /** Toggle the commander marker on a card. Independent of category.
   *  See DeckCard.isCommander for the full rationale. */
  setCommander: (index: number, isCommander: boolean) => void;
  /**
   * Add a card by name to the mainboard. If the mainboard already
   * has a row for this card (case-insensitive), that row's quantity
   * is incremented — matches the "no duplicate rows" convention
   * fancy webatrice uses. Async because it may look up the card via
   * Dexie / Scryfall to hydrate metadata.
   */
  addCard: (name: string) => Promise<void>;
  /** Force a save right now (bypass debounce). Useful on unmount. */
  flushSave: () => void;
}

// (pendingLocalSaveRef removed — the DECK_UPLOAD-listening race with
//  MyDecks is no longer relevant since our custom `uploadDeckUpdate`
//  does not dispatch that action.)

/**
 * Module-level cache of hydrated decks by deckId. Survives unmounts
 * so switching tabs (MyDecks ↔ open deck) doesn't re-download and
 * re-hydrate every time — otherwise every tab return flashes the
 * "Loading…" placeholder while the cod XML round-trips to servatrice
 * and hydrateDeck's async Dexie / Scryfall lookups run again.
 *
 * Entries mirror the in-editor deck state (updated whenever the local
 * state changes), plus the last-known-saved XML signature so the
 * autosave dirty check keeps working after a rehydrate. Invalidated
 * by MyDecks' Refresh button via `clearDeckEditorCache()`, and by
 * `deleteCachedDeck(id)` when a deck is removed.
 */
interface CachedDeck { deck: HydratedDeck; savedXml: string }
const deckCache: Map<number, CachedDeck> = new Map();
export function clearDeckEditorCache(): void { deckCache.clear(); }
export function deleteCachedDeck(deckId: number): void { deckCache.delete(deckId); }

export function useDeckEditor(deckId: number | null): UseDeckEditor {
  const webClient = useWebClient();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);

  // Hydrate initial state from the module cache if we've already
  // loaded this deck this session — avoids the "Loading…" flash and
  // the deckDownload round-trip when returning to an open deck tab.
  const initialCached = deckId != null ? deckCache.get(deckId) : undefined;
  const [deck, setDeck] = useState<HydratedDeck | null>(initialCached?.deck ?? null);
  const [loading, setLoading] = useState(!initialCached);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Refs used by the autosave loop. `deckRef` mirrors state so the
  // debounced timer sees the latest snapshot without needing to be in
  // the effect's deps.
  const deckRef = useRef<HydratedDeck | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const savedSignatureRef = useRef<string | null>(initialCached?.savedXml ?? null);
  deckRef.current = deck;

  // --- Load ---
  useEffect(() => {
    if (deckId == null) return;
    // Cached: state already seeded from the cache above; skip the
    // network round-trip entirely so tab switches feel instant.
    if (deckCache.has(deckId)) {
      setLoading(false);
      setNotFound(false);
      return;
    }
    if (!isConnected) return;
    setLoading(true);
    setNotFound(false);
    setDeck(null);
    savedSignatureRef.current = null;
    webClient.request.session.deckDownload(deckId);
  }, [isConnected, deckId, webClient]);

  useReduxEffect<{ deckId: number; deck: string }>(
    ({ payload }) => {
      if (payload.deckId !== deckId) return;
      (async () => {
        try {
          const parsed = parseCod(payload.deck);
          const hydrated = await hydrateDeck(parsed);
          setDeck(hydrated);
          savedSignatureRef.current = payload.deck;
          // Seed the cache so subsequent mounts of this deck skip the
          // download + parse + hydrate round-trip. `deck`-change
          // effect below keeps the entry up to date after edits.
          deckCache.set(payload.deckId, { deck: hydrated, savedXml: payload.deck });
          setLoading(false);
          setSaveState('idle');
          // Legacy decks with no <format> element get defaulted to
          // commander during hydration. Nudge an autosave so that
          // default gets written back to the file even when the user
          // opens the deck and closes without editing. `scheduleSave`
          // debounces + `persistNow` early-returns when the serialized
          // XML matches savedSignatureRef, so this is a no-op for
          // decks that already had a format on file.
          //
          // Also nudge for legacy decks with a `<zone
          // name="commander">` block. parseCod coerces those cards
          // into the main zone with `isCommander: true`, but the
          // stored XML still has the old shape until we re-save it.
          // Servatrice's setupZones only reads main + side, so an
          // un-migrated file drops the commander from the library.
          const hasLegacyCommanderZone = payload.deck.includes('<zone name="commander"');
          if (!parsed.format.trim() || hasLegacyCommanderZone) {
            scheduleSave();
          }
        } catch (err) {
          console.error('Failed to parse deck XML', err);
          setNotFound(true);
          setLoading(false);
        }
      })();
    },
    server.Types.DECK_DOWNLOADED,
    [deckId],
  );

  // --- Save (debounced) ---
  const scheduleSave = useCallback(() => {
    setSaveState('dirty');
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistNow();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const persistNow = useCallback(() => {
    const current = deckRef.current;
    if (!current || deckId == null) return;
    const nextMeta = touchMeta(current.meta);
    const xml = serializeCod({
      name: current.name,
      meta: nextMeta,
      cards: current.cards,
      format: current.format,
      bannerCard: current.bannerCard,
      lastLoadedTimestamp: current.lastLoadedTimestamp,
      tagsXml: current.tagsXml,
      bracketAssessment: current.bracketAssessment,
    });
    if (xml === savedSignatureRef.current) return; // nothing changed
    savedSignatureRef.current = xml;
    // Refresh the cached saved-signature so a remount after autosave
    // still sees the deck as "clean" (matches the last-known-saved
    // XML) and doesn't queue a spurious re-save.
    const cached = deckCache.get(deckId);
    if (cached) deckCache.set(deckId, { deck: cached.deck, savedXml: xml });
    setSaveState('saving');
    // uploadDeckUpdate handles both the server "saved" ack (flips our
    // saveState) and a follow-up deckList refetch that keeps MyDecks
    // + the sticky tab title in sync without needing a manual refresh.
    uploadDeckUpdate(deckId, xml, () => setSaveState('saved'));
  }, [deckId]);

  // Flush pending save on unmount so tab-close / navigate-away
  // doesn't drop the last edit.
  const flushSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      persistNow();
    }
  }, [persistNow]);
  useEffect(() => flushSave, [flushSave]);

  // Mirror local edits into the module cache so returning to this
  // deck's tab after switching away shows the latest in-editor state
  // (including unsaved edits), not the last-downloaded XML. Runs after
  // every setDeck — cheap, just a Map.set.
  useEffect(() => {
    if (deckId == null || !deck) return;
    const existing = deckCache.get(deckId);
    deckCache.set(deckId, {
      deck,
      savedXml: existing?.savedXml ?? savedSignatureRef.current ?? '',
    });
  }, [deckId, deck]);

  // --- Mutations ---
  const setName = useCallback(
    (name: string) => {
      setDeck((prev) => (prev ? { ...prev, name } : prev));
      scheduleSave();
    },
    [scheduleSave],
  );

  const setFormat = useCallback(
    (format: string) => {
      setDeck((prev) => (prev ? { ...prev, format } : prev));
      scheduleSave();
    },
    [scheduleSave],
  );

  const setDescription = useCallback(
    (description: string) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const nextMeta: DeckMeta = { ...prev.meta, description: description || undefined };
        return { ...prev, meta: nextMeta };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const setPriceCache = useCallback(
    (priceUsd: number | undefined, priceMissingCount: number | undefined) => {
      setDeck((prev) => {
        if (!prev) return prev;
        // Skip the state churn (and the autosave it triggers) when the
        // computed values match what's already in meta. Without this,
        // the pricing effect would re-fire on every editor open even
        // when nothing has changed.
        if (
          prev.meta.priceUsd === priceUsd &&
          prev.meta.priceMissingCount === priceMissingCount
        ) {
          return prev;
        }
        const nextMeta: DeckMeta = { ...prev.meta, priceUsd, priceMissingCount };
        return { ...prev, meta: nextMeta };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const setBracketAssessment = useCallback(
    (assessment: BracketAssessment | undefined) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const prevLevel = prev.meta.bracketLevel;
        const nextLevel = assessment?.level;
        const prevFingerprint = prev.bracketAssessment?.fingerprint;
        const nextFingerprint = assessment?.fingerprint;
        // Skip the state churn (and the autosave it triggers) when the
        // assessment matches what we already had on disk. Same-shape
        // deck reopened → BracketSection replays analyzeBracket and
        // hands us back an assessment we've already saved.
        if (prevLevel === nextLevel && prevFingerprint === nextFingerprint) {
          return prev;
        }
        const nextMeta: DeckMeta = { ...prev.meta, bracketLevel: nextLevel };
        return { ...prev, meta: nextMeta, bracketAssessment: assessment };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const updateCard = useCallback(
    (index: number, patch: Partial<DeckCard>) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const next = prev.cards.slice();
        next[index] = { ...next[index], ...patch };
        return { ...prev, cards: next };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const deleteCard = useCallback(
    (index: number) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const next = prev.cards.slice();
        next.splice(index, 1);
        return { ...prev, cards: next };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const incQuantity = useCallback(
    (index: number, delta: number) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const next = prev.cards.slice();
        const nextQty = next[index].quantity + delta;
        if (nextQty <= 0) {
          next.splice(index, 1);
        } else {
          next[index] = { ...next[index], quantity: nextQty };
        }
        return { ...prev, cards: next };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const setCategory = useCallback(
    (index: number, category: DeckCard['category']) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const next = prev.cards.slice();
        next[index] = { ...next[index], category };
        return { ...prev, cards: next };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  // Toggle the commander marker on a card. Independent of category —
  // the card stays in whatever zone it's currently in. Also clamps
  // quantity to 1 when marking (Commander convention: only one copy
  // of the commander in the deck).
  const setCommander = useCallback(
    (index: number, isCommander: boolean) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const next = prev.cards.slice();
        const current = next[index];
        if (!current) return prev;
        next[index] = {
          ...current,
          isCommander,
          quantity: isCommander ? 1 : current.quantity,
        };
        return { ...prev, cards: next };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const addCard = useCallback(
    async (name: string) => {
      // Strip DFC back-face suffix ("A // B" → "A") so the deck row
      // saves and later resolves under the single front-face name.
      // Scryfall's autocomplete returns the combined "A // B" form
      // for MDFCs / transform cards, but users expect "Riverglide
      // Pathway" in their deck, not the full split name — and our
      // Dexie cards table + Scryfall exact-name lookups both hit
      // the same front-face record either way. Idempotent for
      // single-face names (no ` // ` present → no change).
      const trimmed = name.trim().split(' // ')[0].trim();
      if (!trimmed) return;
      // Increment first if a mainboard row already exists — matches
      // fancy's "one row per (name, category)" invariant.
      const current = deckRef.current;
      if (current) {
        const existingIdx = current.cards.findIndex(
          (c) => c.category === 'main' && c.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existingIdx >= 0) {
          setDeck((prev) => {
            if (!prev) return prev;
            const next = prev.cards.slice();
            next[existingIdx] = {
              ...next[existingIdx],
              quantity: next[existingIdx].quantity + 1,
            };
            return { ...prev, cards: next };
          });
          scheduleSave();
          return;
        }
      }
      // Otherwise: look up + assemble a new row, append to mainboard.
      const lookup = await lookupCard(trimmed);
      const newCard = assembleDeckCard(
        { name: trimmed, quantity: 1, category: 'main' },
        lookup,
      );
      setDeck((prev) => (prev ? { ...prev, cards: [...prev.cards, newCard] } : prev));
      scheduleSave();
    },
    [scheduleSave],
  );

  const { totalMainboardCount, totalSideboardCount } = countCards(deck?.cards);

  return {
    deck,
    loading,
    notFound,
    saveState,
    totalMainboardCount,
    totalSideboardCount,
    setName,
    setDescription,
    setFormat,
    setPriceCache,
    setBracketAssessment,
    updateCard,
    deleteCard,
    incQuantity,
    setCategory,
    setCommander,
    addCard,
    flushSave,
  };
}

function countCards(cards: DeckCard[] | undefined): {
  totalMainboardCount: number;
  totalSideboardCount: number;
} {
  let main = 0;
  let side = 0;
  for (const c of cards ?? []) {
    if (c.category === 'sideboard') side += c.quantity;
    else main += c.quantity;
  }
  return { totalMainboardCount: main, totalSideboardCount: side };
}

/**
 * Send a Command_DeckUpload that Servatrice treats as an **update**
 * (not a create), then refetch the deck list on success so the local
 * tree stays consistent.
 *
 * Why bypass `webClient.request.session.deckUpload`: sockatrice's
 * wrapper always passes `path` in the constructor object, so the
 * proto2 `optional string path` field is marked as present on the
 * wire — even when the string is empty. Servatrice's C++ handler
 * branches on path-presence first ("path was sent → create at this
 * folder"), silently ignoring `deck_id`. Result: every autosave
 * would spawn a new deck at root instead of replacing the existing
 * one. Constructing the message with just `{ deckId, deckList }`
 * omits the path field entirely, so the server takes the deck_id
 * update path.
 *
 * We can't reuse the wrapper's `uploadServerDeck` reducer dispatch
 * either — that reducer INSERTs the returned tree item and doesn't
 * dedupe by id, so a successful update would visually duplicate the
 * deck in the local tree. Instead we fire `deckList()` on success:
 * the response replaces `backendDecks` wholesale, so MyDecks and
 * the sticky tab titles always see server truth. Cost: one extra
 * round-trip per autosave, which is cheap compared to the deck-upload
 * payload itself.
 */
function uploadDeckUpdate(
  deckId: number,
  deckList: string,
  onDone?: () => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckUpload_ext,
    create(Command_DeckUploadSchema, { deckId, deckList }),
    {
      responseExt: Response_DeckUpload_ext,
      onSuccess: () => {
        // "Saved" indicator fires immediately per-save so the UI
        // stays responsive; the tree refetch is debounced so a
        // rapid edit stream doesn't spam deckList() at the server.
        onDone?.();
        scheduleDeckListRefetch();
      },
    },
  );
}

// Module-level debounce timer so rapid successive saves collapse into
// a single deckList() refetch after the storm settles. 500ms matches
// the autosave debounce — long enough to coalesce a typing burst,
// short enough that MyDecks and the sticky-tab title feel live.
const DECK_LIST_REFETCH_DEBOUNCE_MS = 500;
let deckListRefetchTimer: number | null = null;

function scheduleDeckListRefetch(): void {
  if (deckListRefetchTimer != null) window.clearTimeout(deckListRefetchTimer);
  deckListRefetchTimer = window.setTimeout(() => {
    deckListRefetchTimer = null;
    WebClient.instance.request.session.deckList();
  }, DECK_LIST_REFETCH_DEBOUNCE_MS);
}
