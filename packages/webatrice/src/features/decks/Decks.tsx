import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { generatePath, useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  Loader2,
  Upload,
  X,
  CircleAlert,
  CheckCircle2,
  LayoutGrid,
  Rows3,
} from 'lucide-react';

import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { server } from '@cockatrice/datatrice';
import type { ServerInfo_DeckStorage_Folder, ServerInfo_DeckStorage_TreeItem } from '@cockatrice/sockatrice/generated';
import { useAppSelector } from '@app/store';
import { useReduxEffect } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';
import { RouteEnum } from '@app/types';

import { lookupCards, type LookupResult } from './cardLookup';
import { emptyCod, parseCod, serializeCod } from './cod';
import { parseDecklist, type ParsedEntry } from './decklistParser';
import { assembleDeckCard } from './hydrate';
import { defaultMeta } from './meta';
import { MTG_FORMAT_LABELS, MTG_FORMATS, normalizeFormat, type DeckCard, type ParsedDeck } from './types';
import { clearDeckEditorCache, deleteCachedDeck } from './useDeckEditor';

/**
 * My Decks page. Flat list of decks from Servatrice — folders are
 * intentionally flattened per the plan (see plans/my-decks-integration.md).
 *
 * Data flow:
 *   1. On mount: `deckList()` if `backendDecks` is null. The response
 *      handler dispatches into Redux; we read via `getBackendDecks`.
 *   2. Flatten the folder tree into `Array<{id, name, path, ...}>`.
 *   3. User actions:
 *        • "New Deck"  → `deckUpload("", 0, emptyCod())` → server assigns
 *                        an id; a useReduxEffect on DECK_UPLOAD catches it
 *                        and navigates to the editor.
 *        • Row click   → navigate to `/deck/:id` (editor stub for now)
 *        • Delete      → confirm → `deckDel(id)`; reducer removes the row
 *                        from `backendDecks`, list re-renders.
 *
 * Rename is deferred to Piece 3 (handled by the editor via the
 * deckname field).
 */

interface FlatDeck {
  id: number;
  name: string;
  /** Folder path from root, `""` for root-level decks. */
  path: string;
  /** Unix seconds. Not `updated_at` — Servatrice only tracks creation. */
  creationTime: number;
}

/**
 * Category slugs used by the deck-list grouping. MTG format slugs get
 * their pretty labels from MTG_FORMAT_LABELS; three extra sentinels
 * cover the non-MTG / not-yet-known cases. Kept as string constants
 * so the grouping code and the section-label lookup stay in sync.
 */
const CATEGORY_OTHER = 'other';
const CATEGORY_LOADING = 'loading';
const CATEGORY_UNKNOWN = 'unknown';
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  MTG_FORMAT_LABELS.map((f) => [f.value, f.label]),
);
CATEGORY_LABELS[CATEGORY_OTHER] = 'Other';
CATEGORY_LABELS[CATEGORY_LOADING] = 'Loading…';
CATEGORY_LABELS[CATEGORY_UNKNOWN] = 'Unknown format';

/** Bucket a deck into a category slug. Absent summary → LOADING (its
 *  XML hasn't landed yet); empty format → UNKNOWN; MTG format → its
 *  own slug; anything else → OTHER. */
function categoryOfDeck(summary: DeckSummary | undefined): string {
  if (!summary) return CATEGORY_LOADING;
  const n = normalizeFormat(summary.format ?? '');
  if (!n) return CATEGORY_UNKNOWN;
  if (MTG_FORMATS.includes(n)) return n;
  return CATEGORY_OTHER;
}

// Module-level cache so navigating away from the Decks page and back
// doesn't re-download every deck's XML + re-run the price / format /
// commander-art extraction — those would otherwise flash "Loading…"
// on every tab return because component state resets on unmount.
// Cleared only by the manual Refresh button (fetchList) so the user
// can still force a re-fetch after saving from the editor. Lives for
// the browser session; a reload wipes both alongside Redux.
const summaryCache: Map<number, DeckSummary> = new Map();
const priceFetchedCache: Set<number> = new Set();

/** Wipe every module-level MyDecks cache. Called by TopBar when the
 *  current server / user identity changes — deck ids are per-user on
 *  servatrice, so a cache from a different login would surface stale
 *  or wrong summaries against the new server's tree. */
export function clearDecksListCache(): void {
  summaryCache.clear();
  priceFetchedCache.clear();
}

function Decks() {
  const navigate = useNavigate();
  const webClient = useWebClient();
  const backendDecks = useAppSelector(server.Selectors.getBackendDecks);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);

  // Kick off the initial fetch when we don't yet have a tree. Refresh
  // button also uses this handler.
  const fetchList = () => {
    if (!isConnected) return;
    // Clear the fetched guard so a manual refresh re-downloads every
    // deck's XML and picks up any changes made in the editor (or
    // elsewhere) since we last visited this page. Wipe both the
    // component-scoped ref/state AND the module-level cache — the
    // cache is what survives tab switches, so it needs the reset too.
    priceFetchedRef.current = new Set();
    priceFetchedCache.clear();
    summaryCache.clear();
    // A manual refresh should also drop the per-deck editor cache so
    // reopening a deck after Refresh re-downloads its XML (matches
    // what the user probably means by "refresh").
    clearDeckEditorCache();
    setSummaryMap(new Map());
    webClient.request.session.deckList();
  };
  useEffect(() => {
    if (isConnected && !backendDecks) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, backendDecks]);

  // Flatten the folder tree into a plain sorted list. Sorted by
  // creationTime desc (newest first) since we don't yet have
  // updated_at at the list level.
  const decks = useMemo<FlatDeck[]>(() => {
    if (!backendDecks?.root) return [];
    return flattenFolder(backendDecks.root, '').sort(
      (a, b) => b.creationTime - a.creationTime,
    );
  }, [backendDecks]);

  // --- Create ---
  // Track "did *I* trigger this deckUpload" via a ref, so a background
  // upload (e.g. a future edit-save) doesn't yank the user's tab away.
  const pendingCreateRef = useRef(false);
  useReduxEffect<{ path: string; treeItem: ServerInfo_DeckStorage_TreeItem }>(
    ({ payload: { treeItem } }) => {
      if (!pendingCreateRef.current) return;
      pendingCreateRef.current = false;
      if (treeItem.id) {
        navigate(generatePath(RouteEnum.DECK, { deckId: String(treeItem.id) }));
      }
    },
    server.Types.DECK_UPLOAD,
    [navigate],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const handleCreateSubmit = (name: string, format: string) => {
    if (!isConnected) return;
    setCreateOpen(false);
    pendingCreateRef.current = true;
    // deckId=0 tells Servatrice to assign a new id. Path "" = root.
    webClient.request.session.deckUpload('', 0, emptyCod(name || 'New Deck', format));
  };

  // --- Import ---
  const [importOpen, setImportOpen] = useState(false);
  const handleImportSubmit = (xml: string) => {
    if (!isConnected) return;
    setImportOpen(false);
    // Same DECK_UPLOAD listener used by "New deck" — reusing the flag
    // means the newly-imported deck automatically opens in the editor.
    pendingCreateRef.current = true;
    webClient.request.session.deckUpload('', 0, xml);
  };

  // --- Per-deck summary (price + bracket + banner + commander) ---
  //
  // Servatrice's deck-tree endpoint returns { id, name, creationTime }
  // only — no metadata. Fancy webatrice cheats by joining a Postgres
  // `deck_assessments` table into the deck list query so prices arrive
  // in the same round-trip. We can't do that here, so we get close: as
  // soon as we have a deck list, fire `deckDownload` in parallel for
  // every deck and pluck what we need out of each response as it
  // arrives. Small XMLs over an already-open WebSocket land in a few
  // milliseconds each, so the list fills in with no perceptible
  // stutter (matching the "fast like fancy" bar the user set).
  //
  // Extracted per row:
  //   • usd / missing        — meta.priceUsd + meta.priceMissingCount
  //   • bracketLevel         — <bracketAssessment level> or meta.bracketLevel
  //   • format               — <format> element (for the row chip)
  //   • bannerCard           — <bannerCard> name (first pick for art)
  //   • commanderName/Uuid   — first card with `commander="1"` attr (art fallback)
  // Hydrate from the module cache on mount so returning to the tab
  // shows previously-fetched summaries immediately instead of flashing
  // "Loading…" while every deck re-downloads. Cache is a snapshot at
  // mount time — new summaries flow into both state and cache below.
  const [summaryMap, setSummaryMap] = useState<Map<number, DeckSummary>>(
    () => new Map(summaryCache),
  );
  const priceFetchedRef = useRef<Set<number>>(new Set(priceFetchedCache));

  useEffect(() => {
    if (!isConnected || decks.length === 0) return;
    for (const deck of decks) {
      if (priceFetchedRef.current.has(deck.id)) continue;
      priceFetchedRef.current.add(deck.id);
      priceFetchedCache.add(deck.id);
      webClient.request.session.deckDownload(deck.id);
    }
  }, [isConnected, decks, webClient]);

  useReduxEffect<{ deckId: number; deck: string }>(
    ({ payload }) => {
      try {
        const parsed = parseCod(payload.deck);
        const commander = parsed.cards.find((c) => c.isCommander);
        const next: DeckSummary = {
          usd: parsed.meta.priceUsd,
          missing: parsed.meta.priceMissingCount,
          // Prefer the richer <bracketAssessment> level (matches what the
          // GameLobby reads); fall back to meta.bracketLevel for decks
          // last saved before the new element existed.
          bracketLevel: parsed.bracketAssessment?.level ?? parsed.meta.bracketLevel,
          format: parsed.format || undefined,
          bannerCard: parsed.bannerCard,
          commanderName: commander?.name,
          commanderScryfallId: commander?.scryfallId,
        };
        // Mirror into the module cache so a tab switch away and back
        // keeps this summary without re-downloading. The state update
        // and the cache write need to stay in sync — this branch owns
        // both writes.
        summaryCache.set(payload.deckId, next);
        setSummaryMap((prev) => {
          const existing = prev.get(payload.deckId);
          if (existing && summariesEqual(existing, next)) return prev;
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

  // --- Grouping by format ---
  //
  // Buckets each deck into a category slug and orders the sections:
  //   1. MTG formats in canonical MTG_FORMAT_LABELS order (Commander,
  //      Pauper Commander, Duel Commander, Oathbreaker, Standard,
  //      Pioneer, Modern, Legacy, …).
  //   2. Other (any non-empty format string not in MTG_FORMATS).
  //   3. Loading (deck's XML hasn't landed yet, so we don't know its
  //      format — held here until the deckDownload response arrives).
  //   4. Unknown (deck fetched, but its `<format>` was empty / missing).
  // Inside each section, decks stay sorted by creationTime desc (newest
  // first — same order the flat list used).
  const groupedDecks = useMemo(() => {
    const groups = new Map<string, FlatDeck[]>();
    for (const deck of decks) {
      const summary = summaryMap.get(deck.id);
      const cat = categoryOfDeck(summary);
      const bucket = groups.get(cat) ?? [];
      bucket.push(deck);
      groups.set(cat, bucket);
    }
    // decks[] is already sorted newest-first; the per-bucket order
    // inherits that, so no re-sort needed.
    const order: string[] = MTG_FORMAT_LABELS.map((f) => f.value);
    order.push(CATEGORY_OTHER, CATEGORY_LOADING, CATEGORY_UNKNOWN);
    return order
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, decks: groups.get(cat)! }));
  }, [decks, summaryMap]);

  // --- View mode (persisted to localStorage) ---
  //
  // 'card' = the big row with commander art bleeding in from the right
  //          (matches fancy webatrice's default look).
  // 'compact' = one-line row with a small commander-art thumbnail on
  //             the left. Better for skimming a long deck list.
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode);
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Storage disabled (private mode, quota, etc.) — silently drop
      // the persist; state still works for the current session.
    }
  }, [viewMode]);

  // --- Delete (with confirmation) ---
  const [pendingDelete, setPendingDelete] = useState<FlatDeck | null>(null);
  const confirmDelete = () => {
    if (!pendingDelete) return;
    webClient.request.session.deckDel(pendingDelete.id);
    // Evict the editor's cached copy so a stale entry can't be shown
    // if the user reopens a deck slot the server later reuses for a
    // brand new deck with the same id.
    deleteCachedDeck(pendingDelete.id);
    summaryCache.delete(pendingDelete.id);
    priceFetchedCache.delete(pendingDelete.id);
    setPendingDelete(null);
  };

  const openDeck = (deck: FlatDeck) => {
    navigate(generatePath(RouteEnum.DECK, { deckId: String(deck.id) }));
  };

  const loading = !backendDecks;

  return (
    <Layout>
      <AuthGuard />
      <div className="h-full flex flex-col bg-bg-base bg-purple-radial">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <h1 className="font-modern text-2xl font-semibold text-text-primary">My Decks</h1>
            <p className="text-sm text-text-muted mt-0.5">
              {loading
                ? 'Loading…'
                : `${decks.length} ${decks.length === 1 ? 'deck' : 'decks'} on this server`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Card vs Compact toggle. Segmented control style — the
                 active option has the accent tint, the inactive one
                 is transparent so the two chips read as a pair. */}
            <div
              role="group"
              aria-label="View mode"
              className="flex items-center gap-0.5 p-0.5 rounded-md bg-bg-elevated border border-border-subtle"
            >
              <button
                type="button"
                onClick={() => setViewMode('card')}
                aria-pressed={viewMode === 'card'}
                title="Card view"
                aria-label="Card view"
                className={[
                  'p-1.5 rounded transition-colors',
                  viewMode === 'card'
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-base',
                ].join(' ')}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                aria-pressed={viewMode === 'compact'}
                title="Compact view"
                aria-label="Compact view"
                className={[
                  'p-1.5 rounded transition-colors',
                  viewMode === 'compact'
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-base',
                ].join(' ')}
              >
                <Rows3 size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={fetchList}
              disabled={!isConnected}
              className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Refresh"
              aria-label="Refresh deck list"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              disabled={!isConnected}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-text-primary bg-bg-elevated border border-border-strong hover:bg-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Upload size={14} /> Import
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={!isConnected}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={14} /> New deck
            </button>
          </div>
        </div>

        {/* Body — capped at max-w-4xl to match fancy webatrice's list
             width so rows don't stretch to ultrawide monitors. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="max-w-4xl mx-auto">
            {loading && <LoadingState />}
            {!loading && decks.length === 0 && <EmptyState onCreate={() => setCreateOpen(true)} disabled={!isConnected} />}
            {!loading && decks.length > 0 && (
              <div className="space-y-6">
                {groupedDecks.map(({ category, decks: bucket }) => (
                  <section key={category} className="space-y-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
                      <span>{CATEGORY_LABELS[category] ?? category}</span>
                      <span className="text-text-muted/70 tabular-nums">{bucket.length}</span>
                    </h2>
                    <ul className="space-y-2">
                      {bucket.map((deck) => (
                        <li key={deck.id}>
                          <DeckRow
                            deck={deck}
                            summary={summaryMap.get(deck.id)}
                            mode={viewMode}
                            onOpen={() => openDeck(deck)}
                            onDelete={() => setPendingDelete(deck)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingDelete && (
        <DeleteConfirmDialog
          deckName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      <ImportDeckModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportSubmit}
      />

      <CreateDeckModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateSubmit}
      />
    </Layout>
  );
}

/**
 * Per-deck summary extracted from the deck's XML. Fetched in parallel
 * for every row on mount; drives the price badge, bracket badge, and
 * the commander-art background on each row.
 */
interface DeckSummary {
  usd?: number;
  missing?: number;
  /** Assessed commander bracket 1..5, from either the new
   *  `<bracketAssessment>` element or the legacy meta blob. */
  bracketLevel?: number;
  /** `<format>` element — used for the format label chip. */
  format?: string;
  /** `<bannerCard>` element — Cockatrice's "featured card" for the
   *  deck. Wins over the commander art per the user's ask. Just a
   *  card name (no scryfallId), so we resolve art via Scryfall's
   *  `/cards/named` endpoint. */
  bannerCard?: string;
  /** First card marked with `commander="1"`'s name — Scryfall art fallback
   *  when there's no scryfallId hint on the card. */
  commanderName?: string;
  /** First card marked with `commander="1"`'s scryfallId — preferred
   *  because it resolves to the exact chosen printing's art. */
  commanderScryfallId?: string;
}

function summariesEqual(a: DeckSummary, b: DeckSummary): boolean {
  return (
    a.usd === b.usd &&
    a.missing === b.missing &&
    a.bracketLevel === b.bracketLevel &&
    a.format === b.format &&
    a.bannerCard === b.bannerCard &&
    a.commanderName === b.commanderName &&
    a.commanderScryfallId === b.commanderScryfallId
  );
}

/**
 * Resolve the URL for a deck's background art per the user's rule:
 *   1. `<bannerCard>` → Scryfall `/cards/named?exact=…` (name-based).
 *   2. Commander card's `scryfallId` → `/cards/:uuid` (exact printing).
 *   3. Commander card's name → `/cards/named?exact=…`.
 *   4. Nothing → `null` (row renders the placeholder gradient).
 *
 * Both endpoints support `format=image&version=art_crop`, which
 * returns a landscape crop with no card frame — ideal as a row
 * background. Scryfall follows a 302 redirect to its CDN, and the
 * browser caches the CDN URL aggressively across page loads.
 */
function deckArtUrl(s: DeckSummary | undefined): string | null {
  if (!s) return null;
  if (s.bannerCard && s.bannerCard.trim()) {
    return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(s.bannerCard.trim())}&format=image&version=art_crop`;
  }
  if (s.commanderScryfallId) {
    return `https://api.scryfall.com/cards/${encodeURIComponent(s.commanderScryfallId)}?format=image&version=art_crop`;
  }
  if (s.commanderName && s.commanderName.trim()) {
    return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(s.commanderName.trim())}&format=image&version=art_crop`;
  }
  return null;
}

// Bracket tone palette — same tokens as the DeckBreakdown + GameLobby
// badges so a B3 chip reads the same everywhere.
const BRACKET_TONE: Record<number, string> = {
  1: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
  2: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
  3: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40',
  4: 'text-red-300 bg-red-500/15 border-red-500/40',
  5: 'text-red-300 bg-red-500/15 border-red-500/40',
};

function BracketBadge({ level }: { level: number }) {
  const tone = BRACKET_TONE[level] ?? 'text-text-secondary bg-bg-elevated border-border-subtle';
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded border text-xs font-bold tabular-nums shrink-0 ${tone}`}
      title={`Commander Bracket ${level}`}
    >
      B{level}
    </span>
  );
}

/** Small USD pill shown inline with the deck meta row. Same three
 *  visual states as before: loading (dots), fetched-no-cache (dash),
 *  fetched-priced ($X.XX with "+" for incomplete data). */
function DeckPriceBadge({
  price,
}: {
  price: { usd?: number; missing?: number } | undefined;
}) {
  if (price === undefined) {
    return (
      <span
        className="text-xs tabular-nums text-text-muted opacity-50"
        title="Loading price…"
      >
        · · ·
      </span>
    );
  }
  if (price.usd == null) {
    return (
      <span
        className="text-xs tabular-nums text-text-muted"
        title="No cached price — open the deck to compute it"
      >
        —
      </span>
    );
  }
  const suffix = price.missing && price.missing > 0 ? '+' : '';
  const title =
    price.missing && price.missing > 0
      ? `TCGplayer USD total. ${price.missing} card${price.missing === 1 ? '' : 's'} had no price on file — actual total is higher.`
      : 'TCGplayer USD total';
  return (
    <span
      className="text-xs tabular-nums text-emerald-300 font-medium"
      title={title}
    >
      ${price.usd.toFixed(2)}{suffix}
    </span>
  );
}

type ViewMode = 'card' | 'compact';

const VIEW_MODE_STORAGE_KEY = 'decks:viewMode';

/** Seed viewMode state from localStorage. Falls back to 'card' when
 *  the stored value is missing / invalid / storage is unavailable. */
function readStoredViewMode(): ViewMode {
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (raw === 'compact' || raw === 'card') return raw;
  } catch {
    // Storage disabled — fall through.
  }
  return 'card';
}

interface DeckRowProps {
  deck: FlatDeck;
  /** Populated by the parent's background deckDownload loop. `undefined`
   *  while the XML hasn't landed yet — row still renders, just without
   *  price / bracket / art. */
  summary: DeckSummary | undefined;
  mode: ViewMode;
  onOpen: () => void;
  onDelete: () => void;
}

function DeckRow(props: DeckRowProps) {
  return props.mode === 'compact' ? <DeckRowCompact {...props} /> : <DeckRowCard {...props} />;
}

/**
 * "Card" view — aligned with fancy webatrice: a taller row with the
 * commander (or banner) art bleeding in from the right side, gradient-
 * blended into the row's base surface. Whole card clickable; delete
 * floats top-right so it stays reachable over the art.
 */
function DeckRowCard({ deck, summary, onOpen, onDelete }: DeckRowProps) {
  const artUrl = deckArtUrl(summary);
  const bracket = summary?.bracketLevel;
  const formatLabel = summary?.format ? formatDisplayLabel(summary.format) : null;

  return (
    <div className="group relative rounded-lg bg-bg-surface border border-border-subtle hover:border-border-strong overflow-hidden transition-all">
      {/* Right-half background art. When there's no art, fall through
          to the placeholder underlay below. Two absolutely-positioned
          layers: the art itself, then a gradient that fades it into
          the row's base surface so the text on the left stays legible. */}
      {artUrl ? (
        <>
          <div
            className="absolute inset-y-0 right-0 w-1/2 pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity"
            style={{
              backgroundImage: `url(${artUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 30%',
            }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 w-1/2 pointer-events-none"
            style={{
              background:
                'linear-gradient(115deg, rgb(var(--bg-surface)) 15%, rgb(var(--bg-surface) / 0.35) 40%, rgb(var(--bg-surface) / 0) 70%)',
            }}
            aria-hidden
          />
        </>
      ) : (
        <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none flex items-center justify-end pr-8" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(115deg, rgb(var(--bg-surface)) 30%, rgb(var(--bg-elevated) / 0.6) 100%)',
            }}
          />
          <FileText size={72} className="relative text-text-muted/10" strokeWidth={1.25} />
        </div>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="relative w-full text-left flex items-center gap-4 p-5 min-h-32 cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
              {deck.name}
            </span>
            {bracket != null && <BracketBadge level={bracket} />}
          </div>
          <div className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
            {formatLabel && (
              <>
                <span className="text-text-secondary">{formatLabel}</span>
                <span>·</span>
              </>
            )}
            <span>Created {formatTimestamp(deck.creationTime)}</span>
            {deck.path && (
              <>
                <span>·</span>
                <span>in <span className="text-text-secondary">{deck.path}</span></span>
              </>
            )}
            <span>·</span>
            <DeckPriceBadge price={summary && { usd: summary.usd, missing: summary.missing }} />
          </div>
        </div>
      </button>

      <div className="absolute top-3 right-3 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 rounded-md bg-bg-surface/80 backdrop-blur-sm border border-border-subtle text-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
          title="Delete deck"
          aria-label={`Delete ${deck.name}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * "Compact" view — single-line row with a small commander-art
 * thumbnail on the left, name + bracket + meta on one line, delete
 * on the right. Better for skimming a long deck list where the big
 * hero art would just add scroll.
 */
function DeckRowCompact({ deck, summary, onOpen, onDelete }: DeckRowProps) {
  const artUrl = deckArtUrl(summary);
  const bracket = summary?.bracketLevel;
  const formatLabel = summary?.format ? formatDisplayLabel(summary.format) : null;

  return (
    <div className="group flex items-center gap-3 rounded-md bg-bg-surface border border-border-subtle hover:border-border-strong transition-colors">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 text-left cursor-pointer"
      >
        {/* Square art thumbnail — same fallback chain as the card
             view, just cropped tighter. Reuses the placeholder icon
             on decks without a banner or commander. */}
        <div className="h-10 w-10 shrink-0 rounded overflow-hidden bg-bg-elevated border border-border-subtle flex items-center justify-center">
          {artUrl ? (
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `url(${artUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 30%',
              }}
              aria-hidden
            />
          ) : (
            <FileText size={16} className="text-text-muted" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
              {deck.name}
            </span>
            {bracket != null && <BracketBadge level={bracket} />}
          </div>
          <div className="text-xs text-text-muted flex items-center gap-1.5 flex-wrap mt-0.5">
            {formatLabel && (
              <>
                <span className="text-text-secondary">{formatLabel}</span>
                <span>·</span>
              </>
            )}
            <span>Created {formatTimestamp(deck.creationTime)}</span>
            {deck.path && (
              <>
                <span>·</span>
                <span>in <span className="text-text-secondary">{deck.path}</span></span>
              </>
            )}
            <span>·</span>
            <DeckPriceBadge price={summary && { usd: summary.usd, missing: summary.missing }} />
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="mr-2 p-2 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all shrink-0"
        title="Delete deck"
        aria-label={`Delete ${deck.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** Turn a format slug into its display label. Falls back to the raw
 *  value (title-cased) for custom / non-MTG formats. */
function formatDisplayLabel(format: string): string {
  const known = MTG_FORMAT_LABELS.find((f) => f.value === normalizeFormat(format));
  if (known) return known.label;
  return format.replace(/^\w/, (c) => c.toUpperCase());
}

function LoadingState() {
  return (
    <div className="h-full min-h-[240px] flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin text-accent" />
        Loading decks…
      </div>
    </div>
  );
}

function EmptyState({ onCreate, disabled }: { onCreate: () => void; disabled: boolean }) {
  return (
    <div className="h-full min-h-[280px] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-bg-elevated border border-border-subtle mb-3">
          <FileText size={20} className="text-accent" />
        </div>
        <div className="text-text-primary font-medium">No decks yet</div>
        <div className="text-sm text-text-muted mt-1 mb-4">
          Decks live on the Servatrice server tied to your account.
          Create your first one to get started.
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} /> New deck
        </button>
      </div>
    </div>
  );
}

// ---------- Import modal ----------

type ImportPhase = 'input' | 'resolving' | 'review' | 'importing';

interface ResolvedRow {
  entry: ParsedEntry;
  lookup: LookupResult;
}

const IMPORT_PLACEHOLDER = `Paste your deck list (Arena / MTGO / Moxfield export). Example:

Commander
1 Atraxa, Grand Unifier

Deck
1 Sol Ring
1 Cultivate
1 Swords to Plowshares
...`;

/**
 * Two-phase importer: paste → look up → review matched/missing →
 * build .cod XML and hand it back to Decks for upload. Cards are
 * resolved through the same `lookupCards` helper the deck editor
 * uses (Dexie cache first, Scryfall fallback on miss) so imported
 * decks pick up local card DB matches instantly and only miss for
 * genuinely-unknown names.
 */
function ImportDeckModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (xml: string) => void;
}) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('commander');
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<ImportPhase>('input');
  const [resolved, setResolved] = useState<ResolvedRow[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // .cod file upload state — parallel path to the paste textarea.
  // When a valid file is loaded we skip the parse-and-review flow and
  // upload the XML directly (through parseCod → serializeCod to apply
  // the user's typed name, but preserving <comments> metadata like
  // priceUsd / description that a plain-text paste can't carry).
  const [fileParsed, setFileParsed] = useState<ParsedDeck | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on open so a previous close-mid-flow doesn't leak state
  // into the new session.
  useEffect(() => {
    if (!open) return;
    setName('');
    setFormat('commander');
    setText('');
    setPhase('input');
    setResolved([]);
    setIgnored([]);
    setError(null);
    setFileParsed(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleFilePicked = (file: File | null) => {
    setError(null);
    if (!file) {
      setFileParsed(null);
      setFileName(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const xml = typeof reader.result === 'string' ? reader.result : '';
      try {
        const parsed = parseCod(xml);
        setFileParsed(parsed);
        setFileName(file.name);
        // Auto-fill the deck name from the file's <deckname> only when
        // the user hasn't typed anything, so we never overwrite their
        // in-progress input.
        if (!name.trim()) setName(parsed.name);
        // Same rule for format: if the file has a <format>, adopt it
        // so the picker reflects the file's declared format. We always
        // adopt (even if user had picked one) because the file's
        // format is authoritative for its own contents; if they want
        // to change it after, the picker still works.
        if (parsed.format) setFormat(parsed.format);
      } catch (e) {
        setFileParsed(null);
        setFileName(null);
        setError(
          e instanceof Error
            ? `Not a valid Cockatrice .cod: ${e.message}`
            : 'Not a valid Cockatrice .cod file',
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setError('Could not read the selected file');
    };
    reader.readAsText(file);
  };

  const clearFile = () => {
    setFileParsed(null);
    setFileName(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportFile = () => {
    if (!fileParsed) return;
    setError(null);
    setPhase('importing');
    // Round-trip via serializeCod so we can apply the user's typed
    // deck name (or fall back to the file's original name) while
    // preserving the file's metadata (priceUsd, description, printing
    // hints) and normalising the XML to what the rest of the app
    // reads. Pass the parsed cards through as-is — they carry
    // set/collector/scryfallId hints that serializeCod emits back
    // onto the <card> attributes.
    const nextName = name.trim() || fileParsed.name || 'Imported deck';
    const xml = serializeCod({
      name: nextName,
      meta: fileParsed.meta,
      cards: fileParsed.cards as unknown as DeckCard[],
      format: format.trim().toLowerCase() || fileParsed.format || 'commander',
      bannerCard: fileParsed.bannerCard,
      // Preserve Cockatrice-desktop bookkeeping through the import
      // round-trip so a file that had these elements keeps them.
      lastLoadedTimestamp: fileParsed.lastLoadedTimestamp,
      tagsXml: fileParsed.tagsXml,
    });
    onImport(xml);
  };

  const handleResolve = async () => {
    setError(null);
    const { entries, ignored: skipped } = parseDecklist(text);
    if (entries.length === 0) {
      setError('No cards recognised. Check the format — one line per card, like `1 Sol Ring`.');
      return;
    }
    setPhase('resolving');
    try {
      // Pass set + collector alongside name so Scryfall's collection
      // batch can identify freshly-printed / Universe-Beyond cards
      // by exact printing rather than fuzzy-matching on name (which
      // silently misses when the export's name doesn't byte-match
      // Scryfall's canonical form). Dedup by name — the first hint
      // wins if the same card appears at different printings across
      // deck lines (rare, and printing selection happens later in
      // `pickPrinting`).
      const uniqueHints = new Map<string, {
        name: string;
        set?: string;
        collectorNumber?: string;
      }>();
      for (const e of entries) {
        if (!uniqueHints.has(e.name)) {
          uniqueHints.set(e.name, {
            name: e.name,
            set: e.set,
            collectorNumber: e.collectorNumber,
          });
        }
      }
      const lookupMap = await lookupCards(Array.from(uniqueHints.values()));
      const rows: ResolvedRow[] = entries.map((entry) => ({
        entry,
        lookup: lookupMap.get(entry.name) ?? {
          found: false,
          source: 'unknown',
          name: entry.name,
          printings: [],
        },
      }));
      setResolved(rows);
      setIgnored(skipped);
      setPhase('review');
    } catch (e) {
      setPhase('input');
      setError(e instanceof Error ? e.message : 'Failed to resolve cards');
    }
  };

  const handleConfirmImport = () => {
    setError(null);
    setPhase('importing');
    // Include unmatched entries too — the deck editor will render
    // them with a warning icon (lookupSource === 'unknown'). Dropping
    // them silently would surprise the user; showing them lets them
    // fix typos and hit save.
    const cards: DeckCard[] = resolved.map((r) => assembleDeckCard(r.entry, r.lookup));
    const deckName = name.trim() || 'Imported deck';
    const xml = serializeCod({
      name: deckName,
      meta: defaultMeta(),
      cards,
      format: format.trim().toLowerCase() || 'commander',
    });
    onImport(xml);
  };

  const matchedCount = resolved.reduce(
    (sum, r) => sum + (r.lookup.found ? r.entry.quantity : 0),
    0,
  );
  const missingCount = resolved.reduce(
    (sum, r) => sum + (r.lookup.found ? 0 : r.entry.quantity),
    0,
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl rounded-xl bg-bg-surface border border-border-subtle shadow-glow p-6 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="font-modern text-xl font-semibold text-text-primary">Import a deck</h2>
        <p className="text-sm text-text-muted mt-1">
          Paste a list from Moxfield, Arena, MTGO, Cockatrice — most formats work.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            <CircleAlert size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {phase === 'input' && (
          <div className="mt-4 flex-1 min-h-0 flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".cod,application/xml,text/xml"
              onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="block">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Deck name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="mt-1 w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </label>
              <div>
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1">
                  Format
                </span>
                <FormatPicker value={format} onChange={setFormat} />
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Decklist
                </span>
                {fileParsed ? (
                  <button
                    type="button"
                    onClick={clearFile}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-1"
                  >
                    <X size={11} /> Clear file
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-accent hover:text-accent-hover transition-colors inline-flex items-center gap-1"
                    title="Import from a Cockatrice .cod file (preserves all metadata)"
                  >
                    <Upload size={11} /> Upload .cod file
                  </button>
                )}
              </div>
              {fileParsed ? (
                <FileSummary
                  fileName={fileName ?? '(untitled)'}
                  parsed={fileParsed}
                />
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={IMPORT_PLACEHOLDER}
                  className="flex-1 min-h-[240px] bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none"
                />
              )}
            </div>
          </div>
        )}

        {phase === 'resolving' && (
          <div className="mt-8 mb-8 flex flex-col items-center gap-2 text-text-secondary text-sm">
            <Loader2 size={20} className="animate-spin text-accent" />
            <div>Looking up cards…</div>
          </div>
        )}

        {phase === 'review' && (
          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <CheckCircle2 size={14} /> {matchedCount} matched
              </span>
              {missingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-yellow-300">
                  <CircleAlert size={14} /> {missingCount} unknown (imported with warning)
                </span>
              )}
              {ignored.length > 0 && (
                <span className="text-text-muted">
                  · {ignored.length} unrecognised line{ignored.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div className="mt-3 flex-1 min-h-0 overflow-y-auto border border-border-subtle rounded-md">
              <ul className="divide-y divide-border-subtle">
                {resolved.map((r, i) => (
                  <li
                    key={i}
                    className={[
                      'flex items-center gap-3 px-3 py-1.5 text-sm',
                      r.lookup.found ? '' : 'bg-yellow-500/5',
                    ].join(' ')}
                  >
                    <span className="text-xs tabular-nums text-text-muted w-8 text-right">{r.entry.quantity}×</span>
                    <span
                      className={[
                        'flex-1 truncate',
                        r.lookup.found ? 'text-text-primary' : 'text-yellow-200',
                      ].join(' ')}
                    >
                      {r.entry.name}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-text-muted">
                      {r.entry.category}
                    </span>
                    {!r.lookup.found && (
                      <span className="text-xs text-yellow-400">unknown</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {phase === 'importing' && (
          <div className="mt-8 mb-8 flex flex-col items-center gap-2 text-text-secondary text-sm">
            <Loader2 size={20} className="animate-spin text-accent" />
            <div>Creating deck…</div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            Cancel
          </button>
          {phase === 'input' && (
            fileParsed ? (
              <button
                type="button"
                onClick={handleImportFile}
                className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold text-sm shadow-glow transition-colors flex items-center gap-2"
                title=".cod files are pre-structured — no card review needed"
              >
                <Upload size={14} /> Import file
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleResolve()}
                disabled={!text.trim()}
                className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-glow transition-colors flex items-center gap-2"
              >
                Next: check cards
              </button>
            )
          )}
          {phase === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setPhase('input')}
                className="px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={resolved.length === 0}
                className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-glow transition-colors flex items-center gap-2"
              >
                <Upload size={14} /> Import {resolved.length} card{resolved.length === 1 ? '' : 's'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- Format picker (shared by Create + Import modals) ----------

// Full MTG format list lives in `types.ts` (`MTG_FORMAT_LABELS`) so
// the sidebar picker in DeckEditor and the `isMtgFormat` membership
// check stay in sync with what the modals offer. Any format not in
// that list falls into "Other" and gets a custom label text field.
const KNOWN_FORMAT_OPTIONS = MTG_FORMAT_LABELS;

/**
 * Format dropdown + custom-value text field, used by both the New Deck
 * modal and the Import modal. Design decisions:
 *   - Predefined MTG options gate MTG features in the editor.
 *   - "Other (specify)" surfaces a text input so a user can label
 *     non-MTG decks (Netrunner, playtesting, whatever) — those decks
 *     are stored the same way, just without any MTG-specific UI.
 *   - If the incoming value doesn't match a predefined MTG option
 *     (e.g. imported .cod with `<format>pauper</format>`), we treat
 *     it as an Other value and prefill the custom text field so the
 *     user sees exactly what's stored.
 */
function FormatPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const knownValues = KNOWN_FORMAT_OPTIONS.map((o) => o.value);
  const normalized = normalizeFormat(value);
  const isKnown = knownValues.includes(normalized);

  // Local "user explicitly picked Other" flag. Needed because a value
  // of `''` alone is ambiguous — could be "brand-new picker, default to
  // Commander" or "user picked Other and hasn't typed a custom name
  // yet". Seed from the initial value so an existing custom format
  // opens in Other mode. Persists across renders independent of value
  // so onChange('') from picking Other doesn't flip us back.
  const [otherMode, setOtherMode] = useState(() => !isKnown && normalized !== '');

  const inOtherMode = otherMode || (!isKnown && normalized !== '');
  const dropdownValue = inOtherMode ? 'other' : (isKnown ? normalized : 'commander');

  return (
    <div className="space-y-2">
      <select
        value={dropdownValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === 'other') {
            setOtherMode(true);
            onChange('');
          } else {
            setOtherMode(false);
            onChange(next);
          }
        }}
        className="w-full appearance-none bg-bg-base border border-border-subtle rounded-md pl-3 pr-8 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237A6E8F' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        {KNOWN_FORMAT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        <option value="other">Other (specify)</option>
      </select>
      {inOtherMode && (
        <input
          type="text"
          value={isKnown ? '' : value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            // If they typed a canonical slug, drop Other mode so the
            // dropdown snaps to that known option next render.
            if (knownValues.includes(normalizeFormat(next))) {
              setOtherMode(false);
            }
          }}
          placeholder="e.g. Netrunner, Playtest, Cube"
          maxLength={60}
          className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          autoFocus
        />
      )}
    </div>
  );
}

// ---------- Create Deck modal ----------

function CreateDeckModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, format: string) => void;
}) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('commander');

  useEffect(() => {
    if (!open) return;
    setName('');
    setFormat('commander');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Empty format is fine (defaults to commander in emptyCod), but if
  // the user picked "Other" and typed nothing, keep them here.
  const trimmedFormat = format.trim();
  const submitDisabled = !trimmedFormat;

  const handleSubmit = () => {
    if (submitDisabled) return;
    onCreate(name.trim(), trimmedFormat.toLowerCase());
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <h2 className="font-modern text-lg font-semibold text-text-primary">Create a deck</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Deck name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              maxLength={80}
              placeholder="Untitled Deck"
              autoFocus
              className="mt-1 w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
          </label>
          <div>
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1">
              Format
            </span>
            <FormatPicker value={format} onChange={setFormat} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={13} /> Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Body shown in the import modal when a .cod file has been uploaded.
 *  Replaces the paste textarea with a summary card so the user can
 *  confirm they picked the right file before hitting Import. */
function FileSummary({
  fileName,
  parsed,
}: {
  fileName: string;
  parsed: ParsedDeck;
}) {
  const totals = parsed.cards.reduce(
    (acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + c.quantity;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalCount = parsed.cards.reduce((sum, c) => sum + c.quantity, 0);
  const parts: string[] = [];
  if (totals.commander) parts.push(`${totals.commander} commander`);
  if (totals.main) parts.push(`${totals.main} main`);
  if (totals.sideboard) parts.push(`${totals.sideboard} sideboard`);

  return (
    <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center bg-bg-base border border-border-subtle rounded-md p-6 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-bg-elevated border border-border-strong mb-3">
        <FileText size={22} className="text-accent" />
      </div>
      <div className="text-sm font-semibold text-text-primary truncate max-w-full">
        {fileName}
      </div>
      <div className="text-xs text-text-muted mt-1">
        Deck name in file: <span className="text-text-secondary">{parsed.name}</span>
      </div>
      <div className="text-xs text-text-muted mt-3 tabular-nums">
        {totalCount} card{totalCount === 1 ? '' : 's'}
        {parts.length > 0 && <> · {parts.join(' · ')}</>}
      </div>
      {parsed.meta.priceUsd != null && (
        <div className="text-xs text-emerald-300 mt-1 tabular-nums font-medium">
          ${parsed.meta.priceUsd.toFixed(2)} cached from source
        </div>
      )}
      <div className="text-xs text-text-muted italic mt-4 max-w-sm">
        .cod files are pre-structured — importing skips the card review step and preserves any embedded metadata.
      </div>
    </div>
  );
}

interface DeleteConfirmDialogProps {
  deckName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ deckName, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete deck"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="font-modern text-lg font-semibold text-text-primary">Delete deck?</h2>
        </div>
        <div className="px-5 py-4 text-sm text-text-secondary">
          <span className="text-text-primary font-medium">{deckName}</span> will be permanently removed from the server. This can't be undone.
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-md text-sm font-semibold bg-red-500 text-white hover:bg-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

/** Recursively walk a Servatrice folder tree collecting only files
 *  (leaf decks). `pathPrefix` is the display path from the root. */
function flattenFolder(folder: ServerInfo_DeckStorage_Folder, pathPrefix: string): FlatDeck[] {
  const out: FlatDeck[] = [];
  for (const item of folder.items) {
    if (item.file && item.id) {
      out.push({
        id: item.id,
        name: item.name || `Deck #${item.id}`,
        path: pathPrefix,
        creationTime: item.file.creationTime ?? 0,
      });
    } else if (item.folder) {
      const nextPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
      out.push(...flattenFolder(item.folder, nextPath));
    }
  }
  return out;
}

/** Loose "3 hours ago" formatter for Unix seconds. Good enough for
 *  the list view; the editor can show absolute timestamps. */
function formatTimestamp(unixSeconds: number): string {
  if (!unixSeconds) return 'unknown';
  const then = new Date(unixSeconds * 1000);
  const diffSec = (Date.now() - then.getTime()) / 1000;
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return then.toLocaleDateString();
}

export default Decks;
