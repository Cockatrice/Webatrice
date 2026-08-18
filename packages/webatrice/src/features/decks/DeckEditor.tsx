import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Crown,
  Layers,
  Loader2,
  CircleAlert,
  Check,
  Search,
  X,
  ImageOff,
  SlidersHorizontal,
  Upload,
  ShoppingCart,
  PawPrint,
  Sparkles,
  Sparkle,
  Flag,
  Zap,
  Wand2,
  Trophy,
  Mountain,
  MoreHorizontal,
  Archive,
  ChevronDown,
  ChevronUp,
  PackageOpen,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { RouteEnum } from '@app/types';

import CardDetailModal from './CardDetailModal';
import DeckBreakdown from './DeckBreakdown';
import ExportDeckModal from './ExportDeckModal';
import { fetchAllPrintings, lookupCard, type PrintingSummary } from './cardLookup';
import {
  buildTcgMassEntryUrl,
  computeDeckPrice,
  emptyPriceLookup,
  fetchPricesForCards,
  priceForCard,
  type PriceLookup,
} from './pricing';
import {
  searchCards,
  searchScryfallCards,
  type ScryfallSearchCard,
  type SearchResult,
} from './search';
import {
  MTG_FORMAT_LABELS,
  MTG_FORMATS,
  isCommanderFormat,
  isMtgFormat,
  normalizeFormat,
  primaryType,
  type BracketAssessment,
  type DeckCard,
  type DeckCategory,
  type HydratedDeck,
} from './types';
import { useDeckEditor, type SaveState } from './useDeckEditor';

/**
 * Deck editor. Layout mirrors fancy webatrice's DeckEditor:
 *   • ~280px LEFT sidebar    — deck metadata + hovered card preview
 *   • MAIN area (1fr)        — top-right QuickAdd search input, body
 *                              is a multi-column grid of type buckets
 *
 * Groupings are the standard MTG supertype buckets (Commander → Creatures →
 * Planeswalkers → Battles → Instants → Sorceries → Enchantments → Artifacts →
 * Lands → Other → Sideboard) laid out via CSS columns so tall categories
 * (e.g. Creatures in a 100-card deck) flow into the next column instead
 * of forcing a vertical scroll.
 *
 * Deferred (later Piece 4 sub-tasks):
 *   • Advanced search full-page mode with filters + grid results
 *   • Printings picker per card
 *   • Drag-drop between mainboard / sideboard
 */

const DeckEditor = () => {
  const { deckId: deckIdParam } = useParams<{ deckId: string }>();
  const deckId = deckIdParam ? parseInt(deckIdParam, 10) : NaN;

  const editor = useDeckEditor(Number.isFinite(deckId) ? deckId : null);

  // Sticky preview: last card the user hovered on the right stays
  // shown on the left even after the cursor moves off — you can walk
  // through a list and study one card without racing to click it.
  const [previewCard, setPreviewCard] = useState<DeckCard | null>(null);

  // Which row's chevron-menu asked to change printing. `null` when no
  // picker is open. Held as {index, card} so the modal always sees the
  // freshest data even after unrelated deck mutations reshuffle indices.
  const [printingRequest, setPrintingRequest] = useState<
    { index: number; card: DeckCard } | null
  >(null);

  // Card-detail modal state. Snapshot of the clicked card — the modal
  // re-resolves it to a live row every render via (name, category), so
  // deletes and printing swaps keep the modal in sync without index
  // gymnastics. `null` = closed. Only surfaced for MTG decks; the
  // callback we pass down is undefined for non-MTG so clicking a card
  // name in a non-MTG deck does nothing extra.
  const [detailSnapshot, setDetailSnapshot] = useState<DeckCard | null>(null);

  // Export-deck modal open/closed. Modal reads deck fields directly
  // from `editor.deck` at render time so a mid-modal edit reflects
  // in the preview without extra plumbing.
  const [exportOpen, setExportOpen] = useState(false);

  // Session-scoped price lookup. `pricing.ts` maintains its own
  // module cache so re-mounts don't re-fetch, but we still keep a
  // component state copy so React re-renders when prices land.
  const [prices, setPrices] = useState<PriceLookup>(() => emptyPriceLookup());
  const [pricesLoading, setPricesLoading] = useState(false);

  // Refetch whenever the set of card identifiers changes (a card
  // added, removed, or its printing swapped). Quantity-only changes
  // don't refetch — the total recomputes locally in DeckBuyButton off
  // the same lookup. Key includes both scryfallId (precise) AND name
  // (fallback for bare Cockatrice-authored entries with no uuid), so
  // adding a name-only card triggers a name-based price fetch instead
  // of leaving it unpriced.
  const priceKey = useMemo(() => {
    if (!editor.deck) return '';
    const tokens = editor.deck.cards.map((c) =>
      c.scryfallId ? `id:${c.scryfallId}` : `name:${c.name.toLowerCase()}`,
    );
    return Array.from(new Set(tokens)).sort().join('|');
  }, [editor.deck]);

  const setPriceCache = editor.setPriceCache;
  useEffect(() => {
    if (!priceKey || !editor.deck) return;
    let cancelled = false;
    setPricesLoading(true);
    // Stream partial results through onProgress so the sidebar total
    // ticks up as each Scryfall chunk lands — otherwise the whole
    // deck sits at $0.00 while both/three chunks race to finish.
    fetchPricesForCards(editor.deck.cards, (partial) => {
      if (cancelled) return;
      setPrices(partial);
    })
      .then(() => {
        if (cancelled) return;
        setPricesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPricesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey]);

  // Persist the deck's price into meta whenever prices settle. Ties
  // the total to the deck file so MyDecks (and future consumers) don't
  // have to reprice every time. `setPriceCache` internally skips the
  // update when nothing actually changed, so this doesn't trigger a
  // save-loop.
  useEffect(() => {
    if (!editor.deck) return;
    if (pricesLoading) return;
    const { total, missing } = computeDeckPrice(editor.deck.cards, prices);
    setPriceCache(
      total > 0 ? Number(total.toFixed(2)) : undefined,
      missing > 0 ? missing : undefined,
    );
  }, [editor.deck, prices, pricesLoading, setPriceCache]);

  // Format-gated feature flags. `isMtg` controls the whole MTG feature
  // set (Scryfall search, printings picker, pricing, previews, type
  // grouping). `isCommander` controls just the commander-designation
  // affordance on top of that.
  const isMtg = isMtgFormat(editor.deck?.format);
  const isCommander = isCommanderFormat(editor.deck?.format);

  const groups = useMemo(
    () => groupCards(editor.deck?.cards ?? [], isCommander),
    [editor.deck, isCommander],
  );

  if (editor.loading) return <LoadingShell />;
  if (editor.notFound || !editor.deck) return <NotFoundShell />;

  return (
    <Layout>
      <AuthGuard />
      <div className="h-full grid bg-bg-base bg-purple-radial" style={{ gridTemplateColumns: '360px 1fr' }}>
        <DeckSidebar
          deck={editor.deck}
          saveState={editor.saveState}
          totalMainboardCount={editor.totalMainboardCount}
          totalSideboardCount={editor.totalSideboardCount}
          onNameChange={editor.setName}
          onFormatChange={editor.setFormat}
          onExport={() => setExportOpen(true)}
          previewCard={previewCard}
          prices={prices}
          pricesLoading={pricesLoading}
          isMtg={isMtg}
        />
        <MainPane
          deck={editor.deck}
          groups={groups}
          onAddByName={(name) => void editor.addCard(name)}
          onInc={(i, d) => editor.incQuantity(i, d)}
          onDelete={(i) => editor.deleteCard(i)}
          onSetCategory={(i, c) => editor.setCategory(i, c)}
          onSetCommander={(i, v) => editor.setCommander(i, v)}
          onPreviewCard={setPreviewCard}
          onChangePrinting={(i, c) => setPrintingRequest({ index: i, card: c })}
          onCardClick={isMtg ? setDetailSnapshot : undefined}
          cachedBracketAssessment={editor.deck.bracketAssessment}
          onBracketAssessmentComputed={editor.setBracketAssessment}
          isMtg={isMtg}
          isCommander={isCommander}
        />
      </div>

      <PrintingPickerModal
        request={printingRequest}
        onClose={() => setPrintingRequest(null)}
        onPick={(printing) => {
          if (!printingRequest) return;
          editor.updateCard(printingRequest.index, {
            set: printing.set,
            collectorNumber: printing.collectorNumber,
            scryfallId: printing.scryfallId,
            imageUri: printing.imageUri,
          });
          setPrintingRequest(null);
        }}
      />

      {isMtg && (
        <CardDetailModal
          snapshot={detailSnapshot}
          deckCards={editor.deck.cards}
          isCommanderDeck={isCommander}
          prices={prices}
          onClose={() => setDetailSnapshot(null)}
          onInc={(i) => editor.incQuantity(i, 1)}
          onDec={(i) => editor.incQuantity(i, -1)}
          onSetCategory={(i, c) => editor.setCategory(i, c)}
          onSetCommander={(i, v) => editor.setCommander(i, v)}
          onChangePrinting={(i, c) => {
            setDetailSnapshot(null);
            setPrintingRequest({ index: i, card: c });
          }}
          onDelete={(i) => {
            editor.deleteCard(i);
            setDetailSnapshot(null);
          }}
          onAdd={(name) => editor.addCard(name)}
        />
      )}

      <ExportDeckModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        deckName={editor.deck.name}
        cards={editor.deck.cards}
        meta={editor.deck.meta}
        format={editor.deck.format}
        bannerCard={editor.deck.bannerCard}
        lastLoadedTimestamp={editor.deck.lastLoadedTimestamp}
        tagsXml={editor.deck.tagsXml}
      />
    </Layout>
  );
};

// ---------- Left: deck sidebar ----------

interface DeckSidebarProps {
  deck: HydratedDeck;
  saveState: SaveState;
  totalMainboardCount: number;
  totalSideboardCount: number;
  onNameChange: (name: string) => void;
  onFormatChange: (format: string) => void;
  onExport: () => void;
  previewCard: DeckCard | null;
  prices: PriceLookup;
  pricesLoading: boolean;
  /** Format-gated features flag. When false, hide the card preview,
   *  the TCGplayer deck-total pill, and switch the display to a
   *  non-MTG friendly layout. */
  isMtg: boolean;
}

function DeckSidebar({
  deck,
  saveState,
  totalMainboardCount,
  totalSideboardCount,
  onNameChange,
  onFormatChange,
  onExport,
  previewCard,
  prices,
  pricesLoading,
  isMtg,
}: DeckSidebarProps) {
  return (
    <aside className="min-h-0 flex flex-col border-r border-border-subtle bg-bg-surface">
      <div className="shrink-0 px-4 py-3 border-b border-border-subtle">
        <input
          type="text"
          value={deck.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Untitled Deck"
          className="w-full bg-transparent border-none outline-none font-modern text-xl font-semibold text-text-primary placeholder:text-text-muted focus:bg-bg-elevated focus:px-2 focus:py-1 focus:-mx-2 focus:-my-1 focus:rounded-md transition-all"
        />
        <div className="text-xs text-text-muted mt-1 tabular-nums">
          {totalMainboardCount} card{totalMainboardCount === 1 ? '' : 's'}
          {totalSideboardCount > 0 && <> · {totalSideboardCount} sideboard</>}
        </div>
        <div className="text-xs mt-1">
          <SaveIndicator state={saveState} />
        </div>

        <div className="mt-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Format
          </span>
          <SidebarFormatPicker value={deck.format} onChange={onFormatChange} />
        </div>

        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={onExport}
            title="Export deck (plain text, Arena, Cockatrice)"
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border-strong bg-bg-elevated hover:bg-border-subtle text-text-primary text-sm font-medium transition-colors"
          >
            <Upload size={13} /> Export deck
          </button>
          {/* Deck-total TCGplayer pill only makes sense when the cards
              are MTG (Scryfall pricing has no coverage for anything
              else). Non-MTG decks drop the row entirely. */}
          {isMtg && <DeckBuyButton cards={deck.cards} prices={prices} loading={pricesLoading} />}
        </div>
      </div>

      {isMtg ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <CardPreview card={previewCard} prices={prices} />
        </div>
      ) : (
        // Non-MTG placeholder — nothing to preview or price, so the
        // rail is intentionally empty. Left as a spacer so the sidebar
        // doesn't collapse into a thin strip.
        <div className="flex-1 min-h-0 overflow-y-auto p-6" />
      )}
    </aside>
  );
}

/** Compact format picker rendered inline in the sidebar. Same options
 *  as the create/import modals' `FormatPicker` but stripped down for
 *  the tight sidebar column. Delegates full picker semantics (Other +
 *  custom text) via a small popover-less two-row layout. */
function SidebarFormatPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const normalized = value.trim().toLowerCase();
  const isKnown = MTG_FORMATS.includes(normalized);
  // See FormatPicker in Decks.tsx for why this local flag is needed:
  // an empty value alone can't distinguish "user picked Other and
  // hasn't typed" from "no format selected, default to Commander".
  const [otherMode, setOtherMode] = useState(() => !isKnown && normalized !== '');

  const inOtherMode = otherMode || (!isKnown && normalized !== '');
  const dropdownValue = inOtherMode ? 'other' : (isKnown ? normalized : 'commander');

  return (
    <div className="mt-1 space-y-1.5">
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
        className="w-full appearance-none bg-bg-base border border-border-subtle rounded-md pl-2 pr-7 py-1 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237A6E8F' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
        }}
      >
        {MTG_FORMAT_LABELS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
        <option value="other">Other</option>
      </select>
      {inOtherMode && (
        <input
          type="text"
          value={isKnown ? '' : value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            if (MTG_FORMATS.includes(normalizeFormat(next))) {
              setOtherMode(false);
            }
          }}
          placeholder="e.g. Netrunner, Playtest"
          maxLength={60}
          className="w-full bg-bg-base border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      )}
    </div>
  );
}

/** "Buy deck @ TCGplayer" pill under the deck header. Sums TCGplayer
 *  USD prices from the passed-in map (populated by the parent's
 *  Scryfall `/cards/collection` fetch) and links to TCGplayer's
 *  Mass Entry cart pre-filled with `qty NAME [SET] NUM` per row. */
function DeckBuyButton({
  cards,
  prices,
  loading,
}: {
  cards: DeckCard[];
  prices: PriceLookup;
  loading: boolean;
}) {
  const { total, missing } = useMemo(
    () => computeDeckPrice(cards, prices),
    [cards, prices],
  );
  const href = useMemo(() => buildTcgMassEntryUrl(cards), [cards]);
  const disabled = cards.length === 0;
  const [showMissing, setShowMissing] = useState(false);

  // Unique-name count for the loading caption. Using unique names
  // rather than quantity here because "45 of 100" (unique cards) is
  // what the user perceives as "cards being looked up" — quantities
  // affect the total but not the number of Scryfall lookups pending.
  const { pricedUnique, totalUnique } = useMemo(() => {
    const seen = new Set<string>();
    let priced = 0;
    for (const card of cards) {
      if (seen.has(card.name)) continue;
      seen.add(card.name);
      const info = priceForCard(prices, card);
      if (info?.usd != null && Number.isFinite(info.usd)) priced += 1;
    }
    return { pricedUnique: priced, totalUnique: seen.size };
  }, [cards, prices]);
  const pendingUnique = Math.max(0, totalUnique - pricedUnique);

  // Names of every card in the deck that priceForCard couldn't
  // resolve. Grouped by name so quantities show alongside — helps the
  // user quickly spot whether it's "Sol Ring x1" (weird — should be
  // known) or "Some Custom Token x1" (obviously unmatched). Only
  // computed post-load — during load the list is a moving target and
  // the user should be looking at the progress caption instead.
  const missingCards = useMemo(() => {
    if (loading) return [];
    const grouped = new Map<string, number>();
    for (const card of cards) {
      const info = priceForCard(prices, card);
      if (info?.usd != null && Number.isFinite(info.usd)) continue;
      grouped.set(card.name, (grouped.get(card.name) ?? 0) + card.quantity);
    }
    return Array.from(grouped, ([name, qty]) => ({ name, qty })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [cards, prices, loading]);

  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <ShoppingCart size={13} />
        Buy deck @ TCGplayer
      </span>
      <span className="tabular-nums text-sm font-semibold flex items-center gap-1">
        {loading && <Loader2 size={11} className="animate-spin" />}
        ${total.toFixed(2)}
      </span>
    </>
  );

  const shared =
    'w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border transition-colors';

  if (disabled) {
    return (
      <div
        className={`${shared} bg-accent-secondary/20 border-accent/20 text-text-muted cursor-not-allowed`}
        title="Add cards to enable"
      >
        {inner}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the full deck in TCGplayer's mass-entry cart (opens in a new tab)"
        className={`${shared} bg-accent-secondary/50 hover:bg-accent-secondary border-accent/40 hover:border-accent text-white shadow-glow`}
      >
        {inner}
      </a>
      {loading && pendingUnique > 0 && (
        <div className="text-[10px] text-text-muted italic px-1 flex items-center gap-1.5">
          <Loader2 size={10} className="animate-spin shrink-0" />
          <span>
            Pricing {pendingUnique} card{pendingUnique === 1 ? '' : 's'}… ({pricedUnique}/{totalUnique})
          </span>
        </div>
      )}
      {!loading && missing > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowMissing((v) => !v)}
            className="w-full text-left text-[10px] text-text-muted italic px-1 hover:text-text-primary transition-colors"
            title="Click to see which cards Scryfall couldn't price"
          >
            Price missing for {missing} card{missing === 1 ? '' : 's'} — {showMissing ? 'hide' : 'show'}
          </button>
          {showMissing && (
            <ul className="max-h-40 overflow-y-auto text-[10px] text-text-secondary bg-bg-base border border-border-subtle rounded-md p-2 space-y-0.5">
              {missingCards.map(({ name, qty }) => (
                <li key={name} className="flex items-center gap-2">
                  <span className="tabular-nums text-text-muted w-5 text-right shrink-0">{qty}×</span>
                  <span className="flex-1 min-w-0 truncate">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CardPreview({
  card,
  prices,
}: {
  card: DeckCard | null;
  prices: PriceLookup;
}) {
  const imageUri = card ? upgradeScryfallImageSize(card.imageUri) : null;

  // Shared frame: `aspect-[5/7]` + `rounded-xl` + `shadow-glow` matches
  // fancy webatrice's CardImagePreview so the empty state carries the
  // same accent aura as a rendered card image. Empty state uses
  // `border-strong` so there's a visible edge without the natural
  // dark border of a Scryfall card image to define the frame; a
  // loaded card falls back to the subtler `border-subtle` fancy uses.
  const borderClass = card ? 'border-border-subtle' : 'border-border-strong';
  return (
    <div className="w-full max-w-[300px] mx-auto">
      <div
        className={`aspect-[5/7] w-full rounded-xl overflow-hidden bg-bg-elevated border ${borderClass} shadow-glow flex items-center justify-center`}
      >
        {imageUri ? (
          <img
            src={imageUri}
            alt={card?.name ?? ''}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : card ? (
          <div className="text-xs text-text-muted text-center px-4 flex flex-col items-center gap-2">
            <ImageOff size={20} />
            No image available
          </div>
        ) : (
          <div className="text-xs text-text-muted italic text-center px-4">
            Hover a card to preview
          </div>
        )}
      </div>
      {card && (
        <>
          <div className="mt-3 text-center text-sm font-medium text-text-primary truncate">
            {card.name}
          </div>
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <CardPricePill card={card} prices={prices} />
          </div>
        </>
      )}
    </div>
  );
}

/** Per-card TCGplayer buy pill under the sidebar preview. Reads from
 *  the same shared price map the deck total uses — no extra network
 *  call. Non-interactive fallback when Scryfall has no price or no
 *  affiliate URL for this printing. */
function CardPricePill({
  card,
  prices,
}: {
  card: DeckCard;
  prices: PriceLookup;
}) {
  const info = priceForCard(prices, card);
  const usd = info?.usd;
  const href = info?.tcgplayer ?? null;

  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <ShoppingCart size={13} />
        Buy @ TCGplayer
      </span>
      <span className="tabular-nums text-sm font-semibold">
        {usd != null ? `$${usd.toFixed(2)}` : '—'}
      </span>
    </>
  );

  const shared =
    'w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border transition-colors';

  if (!href) {
    return (
      <div className={`${shared} bg-accent-secondary/30 border-accent/30 text-text-primary`}>
        {inner}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Buy on TCGplayer (opens in a new tab)"
      className={`${shared} bg-accent-secondary/50 hover:bg-accent-secondary border-accent/40 hover:border-accent text-white shadow-glow`}
    >
      {inner}
    </a>
  );
}

/** Bump a Scryfall image URL to `normal` resolution — the sweet spot
 *  for a ~250px sidebar preview. Handles both URL forms Scryfall serves:
 *    • `api.scryfall.com/cards/<uuid>?format=image&version=small`
 *    • `cards.scryfall.io/small/front/…jpg`  (CDN — path segment size)
 *  Non-Scryfall URLs pass through unchanged. */
function upgradeScryfallImageSize(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.includes('api.scryfall.com')) {
    return url.replace(/([?&])version=[^&]+/i, '$1version=normal');
  }
  if (url.includes('cards.scryfall.io')) {
    return url.replace(/(cards\.scryfall\.io\/)(small|border_crop|art_crop|png|large)(\/)/i, '$1normal$3');
  }
  return url;
}

// ---------- Right: main pane (QuickAdd + card columns) ----------

interface MainPaneProps {
  deck: HydratedDeck;
  groups: Array<{ label: string; indices: number[] }>;
  onAddByName: (name: string) => void;
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  onSetCategory: (index: number, category: DeckCategory) => void;
  onSetCommander: (index: number, isCommander: boolean) => void;
  onPreviewCard: (card: DeckCard | null) => void;
  onChangePrinting: (index: number, card: DeckCard) => void;
  /** Optional — undefined for non-MTG decks (they don't get a detail
   *  modal since there's nothing MTG-specific to render). When set,
   *  clicking a card row's name opens the modal. */
  onCardClick?: (card: DeckCard) => void;
  /** Previously-persisted bracket assessment (from the .cod). Passed
   *  through to DeckBreakdown so BracketSection can skip the Scryfall
   *  + Spellbook fetches when the fingerprint still matches. */
  cachedBracketAssessment: BracketAssessment | undefined;
  /** Forwarded straight to DeckBreakdown → BracketSection: fires
   *  after the bracket assessment resolves so we can cache the full
   *  result (level + flagged cards + fingerprint) into the .cod's
   *  `<bracketAssessment>` element. */
  onBracketAssessmentComputed: (assessment: BracketAssessment | undefined) => void;
  isMtg: boolean;
  isCommander: boolean;
}

function MainPane({
  deck,
  groups,
  onAddByName,
  onInc,
  onDelete,
  onSetCategory,
  onSetCommander,
  onPreviewCard,
  onChangePrinting,
  onCardClick,
  cachedBracketAssessment,
  onBracketAssessmentComputed,
  isMtg,
  isCommander,
}: MainPaneProps) {
  // Right-pane view mode. `deckList` is the default (grouped column
  // layout of deck rows). `search` is the full-page advanced search
  // view — takes over the whole pane, hides QuickAdd.
  const [rightView, setRightView] = useState<'deckList' | 'search'>('deckList');
  // Quick-add query lifted out of QuickAddSearch so we can hand it
  // off to advanced search when the user clicks that button — matches
  // the "if they were mid-typing, don't lose it" UX ask.
  const [quickAddQuery, setQuickAddQuery] = useState('');
  // Advanced-search state: typed text + filter state, preserved across
  // view toggles so the user can bounce Back → Advanced search without
  // re-typing everything.
  const [advancedQuery, setAdvancedQuery] = useState('');
  const [filters, setFilters] = useState<SearchFiltersState>(EMPTY_FILTERS);

  const openAdvancedSearch = () => {
    // If the user had typed into QuickAdd, transfer that text over
    // and clear QuickAdd — matches the "don't lose their work" ask.
    if (quickAddQuery.trim()) {
      setAdvancedQuery(quickAddQuery);
      setQuickAddQuery('');
    }
    setRightView('search');
  };

  // Only MTG decks get Scryfall search / advanced search. Non-MTG
  // decks force the deckList view (no search view exists for them).
  const activeView = isMtg ? rightView : 'deckList';

  return (
    <section className="min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 border-b border-border-subtle bg-bg-surface/50">
        {isMtg ? (
          activeView === 'deckList' ? (
            <>
              <button
                type="button"
                onClick={openAdvancedSearch}
                title="Advanced search"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-accent hover:bg-accent-hover shadow-glow transition-colors"
              >
                <SlidersHorizontal size={12} /> Advanced search
              </button>
              <QuickAddSearch
                query={quickAddQuery}
                onQueryChange={setQuickAddQuery}
                onAdd={onAddByName}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setRightView('deckList')}
              title="Back to deck list"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-accent hover:bg-accent-hover shadow-glow transition-colors"
            >
              <ArrowLeft size={12} /> Back to deck
            </button>
          )
        ) : (
          // Non-MTG toolbar: plain typed-name entry, no Scryfall
          // autocomplete or advanced search since we have no card DB
          // to search against.
          <PlainAddCard onAdd={onAddByName} />
        )}
      </div>

      {activeView === 'deckList' ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {deck.cards.length === 0 ? (
            <EmptyCardsHint isMtg={isMtg} />
          ) : isMtg ? (
            // MTG: CSS multi-column masonry with category groups, then
            // stats block underneath. `space-y-10` matches fancy's
            // spacing between the deck-list columns and DeckBreakdown.
            <div className="space-y-10">
              <div style={{ columns: '260px', columnGap: '1.5rem' }}>
                {groups.map(({ label, indices }) => (
                  <CardGroup
                    key={label}
                    label={label}
                    indices={indices}
                    deck={deck.cards}
                    onInc={onInc}
                    onDelete={onDelete}
                    onSetCategory={onSetCategory}
                    onSetCommander={onSetCommander}
                    onPreview={onPreviewCard}
                    onChangePrinting={onChangePrinting}
                    onCardClick={onCardClick}
                    isMtg={isMtg}
                    isCommander={isCommander}
                  />
                ))}
              </div>
              <DeckBreakdown
                cards={deck.cards}
                format={deck.format}
                cachedAssessment={cachedBracketAssessment}
                onAssessmentComputed={onBracketAssessmentComputed}
              />
            </div>
          ) : (
            // Non-MTG: flat alphabetical list, single column. No
            // grouping (no type_line to group by), no preview hover
            // (nothing to preview), no printings / commander toggles.
            <div className="max-w-md mx-auto">
              <FlatCardList
                cards={deck.cards}
                onInc={onInc}
                onDelete={onDelete}
              />
            </div>
          )}
        </div>
      ) : (
        <AdvancedSearchView
          query={advancedQuery}
          onQueryChange={setAdvancedQuery}
          filters={filters}
          onFiltersChange={setFilters}
          onAddByName={onAddByName}
          onPreviewCard={onPreviewCard}
        />
      )}
    </section>
  );
}

/** Bare "type a card name and press Enter to add" input shown in the
 *  non-MTG toolbar. No autocomplete, no lookup — the whole point of a
 *  non-MTG deck is that we don't know what the cards are. */
function PlainAddCard({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState('');
  const handleAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };
  return (
    <div className="relative w-72">
      <Plus
        size={12}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
        placeholder="Add a card by name"
        className="w-full pl-7 pr-3 py-1.5 rounded-md bg-bg-base border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:border-accent focus:ring-accent transition-colors"
      />
    </div>
  );
}

/** Flat single-column card list for non-MTG decks. Same row shape as
 *  MTG cards but stripped of previews, printings, commander toggle,
 *  and price. Uses the same alphabetical sort so the list reads the
 *  way the deck editor already does for MTG decks. */
function FlatCardList({
  cards,
  onInc,
  onDelete,
}: {
  cards: DeckCard[];
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
}) {
  const sortedIndices = useMemo(() => {
    return cards
      .map((_, i) => i)
      .sort((a, b) =>
        cards[a].name.localeCompare(cards[b].name, undefined, { sensitivity: 'base' }),
      );
  }, [cards]);

  return (
    <ul>
      {sortedIndices.map((i) => (
        <li key={i}>
          <PlainCardRow
            card={cards[i]}
            onInc={(delta) => onInc(i, delta)}
            onDelete={() => onDelete(i)}
          />
        </li>
      ))}
    </ul>
  );
}

/** Row used inside `FlatCardList`. Deliberately simpler than
 *  `CardRow` — no hover preview, no chevron menu, no printings /
 *  commander / sideboard toggles. Just quantity +/-, name, and a
 *  delete button. */
function PlainCardRow({
  card,
  onInc,
  onDelete,
}: {
  card: DeckCard;
  onInc: (delta: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-elevated transition-colors">
      <span className="text-xs tabular-nums text-text-muted w-6 text-right shrink-0">
        {card.quantity}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
        {card.name}
      </span>
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onInc(-1)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
          title="Decrease"
          aria-label={`Decrease ${card.name}`}
        >
          <Minus size={12} />
        </button>
        <button
          type="button"
          onClick={() => onInc(1)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
          title="Increase"
          aria-label={`Increase ${card.name}`}
        >
          <Plus size={12} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Remove"
          aria-label={`Remove ${card.name}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ---------- QuickAdd search ----------

const SEARCH_DEBOUNCE_MS = 220;
const QUICK_ADD_MAX_SUGGESTIONS = 8;

interface QuickAddSearchProps {
  /** Controlled query state — lifted to the parent so the Advanced
   *  search button can steal it on switch (see MainPane). */
  query: string;
  onQueryChange: (query: string) => void;
  onAdd: (name: string) => void;
}

function QuickAddSearch({ query, onQueryChange, onAdd }: QuickAddSearchProps) {
  const setQuery = onQueryChange;
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const queryTokenRef = useRef(0);

  // Debounced suggestion fetch.
  useEffect(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      setHighlight(-1);
      return;
    }
    setLoading(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const token = ++queryTokenRef.current;
      searchCards(query, QUICK_ADD_MAX_SUGGESTIONS)
        .then((rows) => {
          if (token !== queryTokenRef.current) return;
          setSuggestions(rows);
          setLoading(false);
          setHighlight(rows.length ? 0 : -1);
        })
        .catch(() => {
          if (token !== queryTokenRef.current) return;
          setSuggestions([]);
          setLoading(false);
          setHighlight(-1);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [query]);

  // Close dropdown on click outside.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleAdd = (name: string) => {
    if (!name) return;
    onAdd(name);
    setQuery('');
    setSuggestions([]);
    setHighlight(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (suggestions.length ? (h + 1) % suggestions.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (suggestions.length ? (h - 1 + suggestions.length) % suggestions.length : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        handleAdd(suggestions[highlight].name);
      } else if (query.trim()) {
        // No suggestion highlighted — try the exact query as a name.
        handleAdd(query.trim());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    // Width + surface color match fancy webatrice's QuickAddSearch:
    // `w-72` (288px) and `bg-bg-base` (deeper than the toolbar itself,
    // so the input reads as recessed rather than raised).
    <div ref={rootRef} className="relative w-72">
      <label className="relative block">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Quick add — type a card name"
          className="w-full pl-8 pr-8 py-1.5 rounded-md bg-bg-base border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:border-accent focus:ring-accent transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-primary transition-colors"
            aria-label="Clear"
          >
            <X size={12} />
          </button>
        )}
      </label>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 left-0 top-full mt-1 z-20 rounded-md bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted">
              <Loader2 size={11} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-muted italic">No matches</div>
          )}
          {!loading &&
            suggestions.map((s, i) => {
              return (
                <button
                  key={s.name}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => handleAdd(s.name)}
                  className={[
                    'w-full block px-3 py-1.5 text-left text-sm text-text-primary truncate transition-colors',
                    i === highlight ? 'bg-bg-elevated' : 'hover:bg-bg-elevated',
                  ].join(' ')}
                >
                  {s.name}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ---------- Card groups ----------

interface CardGroupProps {
  label: string;
  indices: number[];
  deck: DeckCard[];
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  onSetCategory: (index: number, category: DeckCategory) => void;
  onSetCommander: (index: number, isCommander: boolean) => void;
  onPreview: (card: DeckCard | null) => void;
  onChangePrinting: (index: number, card: DeckCard) => void;
  onCardClick?: (card: DeckCard) => void;
  isMtg: boolean;
  isCommander: boolean;
}

const SECTION_ICON: Record<string, LucideIcon> = {
  Commander: Crown,
  Creature: PawPrint,
  Planeswalker: Sparkles,
  Battle: Flag,
  Instant: Zap,
  Sorcery: Wand2,
  Enchantment: Sparkle,
  Artifact: Trophy,
  Land: Mountain,
  Other: MoreHorizontal,
  Sideboard: Archive,
};

function CardGroup({
  label,
  indices,
  deck,
  onInc,
  onDelete,
  onSetCategory,
  onSetCommander,
  onPreview,
  onChangePrinting,
  onCardClick,
  isMtg,
  isCommander,
}: CardGroupProps) {
  const totalQty = indices.reduce((sum, i) => sum + deck[i].quantity, 0);
  const Icon = SECTION_ICON[label] ?? MoreHorizontal;
  return (
    <section className="min-w-0 mb-6 break-inside-avoid">
      <h3 className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border-subtle">
        <Icon size={14} className="text-text-secondary shrink-0" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </span>
        <span className="text-sm tabular-nums text-text-muted">{totalQty}</span>
      </h3>
      <ul>
        {indices.map((i) => (
          <li key={`${deck[i].category}:${deck[i].name}:${i}`}>
            <CardRow
              card={deck[i]}
              onInc={(delta) => onInc(i, delta)}
              onDelete={() => onDelete(i)}
              onSetCategory={(c) => onSetCategory(i, c)}
              onSetCommander={(v) => onSetCommander(i, v)}
              onHover={() => onPreview(deck[i])}
              onChangePrinting={() => onChangePrinting(i, deck[i])}
              onCardClick={onCardClick ? () => onCardClick(deck[i]) : undefined}
              isMtg={isMtg}
              isCommander={isCommander}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface CardRowProps {
  card: DeckCard;
  onInc: (delta: number) => void;
  onDelete: () => void;
  onSetCategory: (category: DeckCategory) => void;
  onSetCommander: (isCommander: boolean) => void;
  onChangePrinting: () => void;
  onHover: () => void;
  /** Optional — when set, the card name renders as a button that
   *  opens the detail modal. Undefined for non-MTG decks. */
  onCardClick?: () => void;
  isMtg: boolean;
  isCommander: boolean;
}

function CardRow({
  card,
  onInc,
  onDelete,
  onSetCategory,
  onSetCommander,
  onHover,
  onChangePrinting,
  onCardClick,
  isMtg,
  isCommander,
}: CardRowProps) {
  return (
    <div
      className="group flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-bg-elevated transition-colors"
      onMouseEnter={onHover}
      onFocus={onHover}
    >
      <span className="text-xs tabular-nums text-text-muted w-5 text-right shrink-0">
        {card.quantity}
      </span>
      {onCardClick ? (
        <button
          type="button"
          onClick={onCardClick}
          className="flex-1 min-w-0 truncate text-sm text-text-primary text-left hover:text-accent transition-colors cursor-pointer"
          title="Click for details"
        >
          {card.name}
        </button>
      ) : (
        <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
          {card.name}
        </span>
      )}
      {card.lookupSource === 'unknown' && (
        <span
          className="shrink-0 text-yellow-400"
          title="Not in your card DB and Scryfall couldn't find it. The card is saved but details/images can't be shown."
        >
          <CircleAlert size={10} />
        </span>
      )}
      <ManaSymbols cost={card.manaCost ?? ''} size={11} className="shrink-0 opacity-90" />
      <div className="shrink-0">
        <RowActionsMenu
          card={card}
          onInc={() => onInc(1)}
          onDec={() => onInc(-1)}
          onDelete={onDelete}
          onSetCategory={onSetCategory}
          onSetCommander={onSetCommander}
          onChangePrinting={onChangePrinting}
          isMtg={isMtg}
          isCommander={isCommander}
        />
      </div>
    </div>
  );
}

/** Kebab-menu of per-row actions — collapses what used to be a
 *  hover-reveal icon strip into a single ChevronDown trigger + a
 *  portal-rendered dropdown, matching fancy webatrice's RowActionsMenu.
 *  Portal so the menu can escape the multi-column `break-inside-avoid`
 *  container without getting clipped. */
function RowActionsMenu({
  card,
  onInc,
  onDec,
  onDelete,
  onSetCategory,
  onSetCommander,
  onChangePrinting,
  isMtg,
  isCommander,
}: {
  card: DeckCard;
  onInc: () => void;
  onDec: () => void;
  onDelete: () => void;
  onSetCategory: (category: DeckCategory) => void;
  onSetCommander: (isCommander: boolean) => void;
  onChangePrinting: () => void;
  /** Deck-level format flag. Non-MTG decks drop the printings-picker
   *  menu item since Scryfall has nothing to show. */
  isMtg: boolean;
  /** Deck-level format flag. Non-commander decks drop the
   *  "Mark as commander" toggle. */
  isCommander: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_WIDTH = 220;
    const MENU_ESTIMATED_HEIGHT = 220;
    const EDGE = 8;

    let left = rect.right - MENU_WIDTH;
    if (left < EDGE) left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - EDGE);

    let top = rect.bottom + 4;
    if (top + MENU_ESTIMATED_HEIGHT > window.innerHeight) {
      top = Math.max(EDGE, rect.top - MENU_ESTIMATED_HEIGHT - 4);
    }
    setPos({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Renamed from `isCommander` to avoid shadowing the deck-level
  // `isCommander` prop (deck format = Commander) with a card-level
  // check (this row is flagged as the commander).
  const cardIsCommander = !!card.isCommander;
  const isSideboard = card.category === 'sideboard';

  const runAndClose = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 rounded hover:bg-bg-base text-text-muted hover:text-text-primary transition-colors"
        title="Card actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ChevronDown size={14} />
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 w-[220px] rounded-lg bg-bg-surface border border-border-subtle shadow-glow py-1"
            style={{ left: pos.left, top: pos.top }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 flex items-center justify-between text-xs">
              <span className="text-text-secondary">Quantity</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onDec}
                  className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary"
                  title="Remove one"
                  aria-label="Decrease quantity"
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center tabular-nums text-text-primary font-semibold text-sm">
                  {card.quantity}
                </span>
                <button
                  type="button"
                  onClick={onInc}
                  className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary"
                  title="Add one"
                  aria-label="Increase quantity"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <div className="border-t border-border-subtle my-1" />

            {isMtg && (
              <MenuItem
                icon={<Layers size={13} />}
                label="Change printing"
                onClick={runAndClose(onChangePrinting)}
              />
            )}
            {isCommander && (
              <MenuItem
                icon={<Crown size={13} className={cardIsCommander ? 'text-yellow-400' : ''} />}
                label={cardIsCommander ? 'Unmark as commander' : 'Mark as commander'}
                onClick={runAndClose(() => onSetCommander(!cardIsCommander))}
              />
            )}
            {isSideboard ? (
              <MenuItem
                icon={<PackageOpen size={13} />}
                label="Move to main"
                onClick={runAndClose(() => onSetCategory('main'))}
              />
            ) : (
              <MenuItem
                icon={<Archive size={13} />}
                label="Move to sideboard"
                onClick={runAndClose(() => onSetCategory('sideboard'))}
                disabled={cardIsCommander}
              />
            )}

            <div className="border-t border-border-subtle my-1" />
            <MenuItem
              icon={<Trash2 size={13} />}
              label="Remove"
              danger
              onClick={runAndClose(onDelete)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      className={[
        'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors',
        disabled
          ? 'text-text-muted opacity-40 cursor-not-allowed'
          : danger
            ? 'text-red-300 hover:bg-red-500/10'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ---------- Printings picker modal ----------

/**
 * Modal that lists every known printing for a card and lets the user
 * pick one to become that row's active printing. Fires the parent's
 * `onPick` with the selected `PrintingSummary`; the parent applies it
 * via `updateCard(index, { set, collectorNumber, scryfallId, imageUri })`
 * and the autosave path serializes new XML attrs.
 *
 * Data source: `fetchAllPrintings(name)` hits Scryfall's
 * `/cards/search?q=!"…"&unique=prints` for the complete history —
 * Dexie only knows the printings that were in the user's imported
 * Cockatrice XML, which for most cards is a single row and would
 * misleadingly imply "there's only one printing to choose from." If
 * Scryfall is unreachable we degrade to `lookupCard(name).printings`
 * so the user still sees *something* offline.
 */
function PrintingPickerModal({
  request,
  onClose,
  onPick,
}: {
  request: { index: number; card: DeckCard } | null;
  onClose: () => void;
  onPick: (printing: PrintingSummary) => void;
}) {
  const [printings, setPrintings] = useState<PrintingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Prices for the currently-shown printings — keyed by scryfallId
  // inside a PriceLookup so it composes with the shared session cache
  // in pricing.ts. Populated after the printings list resolves so the
  // grid paints set/collector first and the `$X.XX` labels stream in.
  const [prices, setPrices] = useState<PriceLookup>(() => emptyPriceLookup());

  useEffect(() => {
    if (!request) return;
    setPrintings([]);
    setPrices(emptyPriceLookup());
    setError(null);
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const scryfall = await fetchAllPrintings(request.card.name);
        if (cancelled) return;
        let resolved: PrintingSummary[];
        if (scryfall.length > 0) {
          resolved = scryfall;
        } else {
          // Scryfall miss (offline / unknown card): fall back to
          // whatever Dexie has so the modal isn't empty.
          const dexie = await lookupCard(request.card.name);
          if (cancelled) return;
          resolved = dexie.printings;
        }
        setPrintings(resolved);
        setLoading(false);

        // Fire off a price fetch for every printing that has an id.
        // Runs after we've already painted the grid so the modal feels
        // instant; prices fill in as Scryfall responds. Shared pricing
        // cache means printings the user has seen before (e.g. via the
        // MyDecks list) show their prices immediately.
        const cards = resolved
          .filter((p) => p.scryfallId)
          .map((p) => ({ scryfallId: p.scryfallId!, name: request.card.name }));
        if (cards.length > 0) {
          fetchPricesForCards(cards)
            .then((lookup) => {
              if (cancelled) return;
              setPrices(lookup);
            })
            .catch(() => {
              /* silent — tiles just stay pricelessly rendered */
            });
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load printings');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request?.card.name]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [request, onClose]);

  if (!request) return null;
  const currentId = request.card.scryfallId;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-5xl rounded-xl bg-bg-surface border border-border-subtle shadow-glow p-6 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div>
          <h2 className="font-modern text-xl font-semibold text-text-primary truncate">
            Choose printing
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {request.card.name}
            {!loading && printings.length > 0 && (
              <span className="ml-2 text-text-muted">
                · {printings.length} printing{printings.length === 1 ? '' : 's'}
              </span>
            )}
          </p>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-16 text-text-muted text-sm">
            <Loader2 size={18} className="animate-spin mr-2 text-accent" /> Loading printings…
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            <CircleAlert size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && printings.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-16 text-text-muted text-sm">
            No printings found.
          </div>
        )}

        {!loading && !error && printings.length > 0 && (
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
            >
              {printings.map((p, i) => {
                const img = upgradeScryfallImageSize(p.imageUri);
                const isCurrent = p.scryfallId != null && p.scryfallId === currentId;
                return (
                  <button
                    key={p.scryfallId ?? `${p.set}-${p.collectorNumber}-${i}`}
                    type="button"
                    onClick={() => onPick(p)}
                    className={[
                      'rounded-lg overflow-hidden border transition-all group relative bg-bg-base text-left',
                      isCurrent
                        ? 'border-accent ring-2 ring-accent/50'
                        : 'border-border-subtle hover:border-accent hover:shadow-glow',
                    ].join(' ')}
                    title={`${p.set?.toUpperCase() ?? '?'} · ${request.card.name}`}
                  >
                    <div className="aspect-[5/7] w-full">
                      {img ? (
                        <img
                          src={img}
                          alt={`${request.card.name} (${p.set ?? ''})`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-text-muted p-2 text-center">
                          {request.card.name}
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5 text-xs flex items-center justify-between gap-1 border-t border-border-subtle bg-bg-surface">
                      <span className="font-medium text-text-primary uppercase tracking-wider truncate">
                        {p.set ?? '—'}
                      </span>
                      {(() => {
                        const usd = p.scryfallId ? prices.byId.get(p.scryfallId)?.usd : undefined;
                        return (
                          <span
                            className={[
                              'tabular-nums shrink-0',
                              usd != null ? 'text-emerald-300 font-medium' : 'text-text-muted',
                            ].join(' ')}
                            title={usd != null ? 'TCGplayer USD' : 'No TCGplayer price'}
                          >
                            {usd != null ? `$${usd.toFixed(2)}` : '—'}
                          </span>
                        );
                      })()}
                      {p.collectorNumber && (
                        <span className="text-text-muted tabular-nums shrink-0">
                          #{p.collectorNumber}
                        </span>
                      )}
                    </div>
                    {isCurrent && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-accent text-white text-[10px] font-semibold shadow-glow">
                        <CheckCircle2 size={10} /> Current
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Render a Scryfall mana cost string like `{2}{U}{R}` as an inline
 *  row of SVG symbol images from svgs.scryfall.io. Hybrid/phyrexian
 *  tokens on the CDN drop the slash (`{W/U}` → `WU.svg`,
 *  `{2/W}` → `2W.svg`). */
function ManaSymbols({
  cost,
  size = 11,
  className,
}: {
  cost: string;
  size?: number | string;
  className?: string;
}) {
  const tokens = cost.match(/\{[^}]+\}/g);
  if (!tokens || tokens.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className ?? ''}`}>
      {tokens.map((tok, i) => {
        const inner = tok.slice(1, -1).replace(/\//g, '');
        return (
          <img
            key={i}
            src={`https://svgs.scryfall.io/card-symbols/${inner}.svg`}
            alt={tok}
            style={{ width: size, height: size }}
            className="inline-block align-text-bottom"
            draggable={false}
          />
        );
      })}
    </span>
  );
}

// ---------- Advanced search view ----------

type FilterColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
type FilterColorMode = 'includes' | 'exactly' | 'atMost';
type FilterCardType =
  | 'Creature'
  | 'Instant'
  | 'Sorcery'
  | 'Enchantment'
  | 'Artifact'
  | 'Planeswalker'
  | 'Land';
type FilterRarity = 'common' | 'uncommon' | 'rare' | 'mythic';

interface SearchFiltersState {
  colors: FilterColor[];
  colorMode: FilterColorMode;
  types: FilterCardType[];
  subtype: string;
  showAdvanced: boolean;
  cmcMin: string;
  cmcMax: string;
  oracle: string;
  rarities: FilterRarity[];
}

const EMPTY_FILTERS: SearchFiltersState = {
  colors: [],
  colorMode: 'includes',
  types: [],
  subtype: '',
  showAdvanced: false,
  cmcMin: '',
  cmcMax: '',
  oracle: '',
  rarities: [],
};

const FILTER_COLORS: FilterColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const FILTER_TYPES: FilterCardType[] = [
  'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land',
];
const FILTER_RARITIES: Array<{ id: FilterRarity; label: string }> = [
  { id: 'common', label: 'C' },
  { id: 'uncommon', label: 'U' },
  { id: 'rare', label: 'R' },
  { id: 'mythic', label: 'M' },
];
const COLOR_SVG = (c: FilterColor) => `https://svgs.scryfall.io/card-symbols/${c}.svg`;
const COLOR_LABEL: Record<FilterColor, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless',
};

/**
 * Combine the user's typed query with filter state into a Scryfall
 * query. Filters AND-combine with the typed text (Scryfall AND is
 * implicit). Ports fancy webatrice's buildScryfallQuery verbatim so
 * both apps understand the same URL scheme.
 */
function buildScryfallQuery(typed: string, f: SearchFiltersState): string {
  const parts: string[] = [];
  const text = typed.trim();
  if (text) parts.push(text);

  if (f.colors.length > 0) {
    const letters = f.colors.map((c) => c.toLowerCase()).join('');
    const op = f.colorMode === 'exactly' ? '=' : f.colorMode === 'atMost' ? '<=' : ':';
    parts.push(`c${op}${letters}`);
  }

  if (f.types.length > 0) {
    const clauses = f.types.map((t) => `t:${t.toLowerCase()}`);
    parts.push(clauses.length > 1 ? `(${clauses.join(' or ')})` : clauses[0]);
  }

  // Subtype: quoted phrase → single clause; otherwise per-token AND.
  const subtype = f.subtype.trim();
  if (subtype) {
    const hasQuotes = /^".*"$/.test(subtype);
    if (hasQuotes) {
      parts.push(`t:${subtype.toLowerCase()}`);
    } else {
      const tokens = subtype.split(/\s+/).filter(Boolean);
      for (const tok of tokens) parts.push(`t:${tok.toLowerCase()}`);
    }
  }

  const min = f.cmcMin.trim();
  const max = f.cmcMax.trim();
  if (min && /^\d+$/.test(min)) parts.push(`cmc>=${min}`);
  if (max && /^\d+$/.test(max)) parts.push(`cmc<=${max}`);

  const oracle = f.oracle.trim();
  if (oracle) {
    const safe = oracle.replace(/"/g, '\\"');
    parts.push(`o:"${safe}"`);
  }

  // Full selection == no filter; only emit when partially narrowed.
  if (f.rarities.length > 0 && f.rarities.length < 4) {
    const clauses = f.rarities.map((r) => `r:${r}`);
    parts.push(clauses.length > 1 ? `(${clauses.join(' or ')})` : clauses[0]);
  }

  return parts.join(' ');
}

function toggleFilter<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

/**
 * Full-page advanced search view — replaces the deck list body when
 * the user clicks "Advanced search". Owns its typed query + filter
 * state (both preserved by MainPane across Back/Advanced toggles so
 * a return trip isn't a fresh start). Fires debounced Scryfall search
 * requests as the composed query changes; clicking a result card fires
 * `onAddByName` (same path QuickAdd uses).
 */
function AdvancedSearchView({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  onAddByName,
  onPreviewCard,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filters: SearchFiltersState;
  onFiltersChange: (f: SearchFiltersState) => void;
  onAddByName: (name: string) => void;
  onPreviewCard: (card: DeckCard | null) => void;
}) {
  const [results, setResults] = useState<ScryfallSearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const composedQuery = useMemo(() => buildScryfallQuery(query, filters), [query, filters]);

  // Debounced Scryfall search. Fires whenever the composed query
  // changes (typed text OR any filter). AbortController cancels an
  // in-flight fetch when the user keeps typing so we don't paint stale
  // results.
  useEffect(() => {
    const q = composedQuery.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const t = window.setTimeout(async () => {
      try {
        const cards = await searchScryfallCards(q, controller.signal);
        setResults(cards);
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [composedQuery]);

  return (
    <>
      <div className="shrink-0 px-6 py-3 border-b border-border-subtle bg-bg-surface/50 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search cards — Scryfall syntax works here too"
            autoFocus
            className="w-full bg-bg-base border border-border-subtle rounded-md pl-10 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        <SearchFilters
          value={filters}
          onChange={onFiltersChange}
          onReset={() => onFiltersChange(EMPTY_FILTERS)}
        />

        <div className="text-xs text-text-muted h-4">
          {loading && 'Searching…'}
          {error && <span className="text-red-400">{error}</span>}
          {!loading && !error && composedQuery && (
            <span>
              Showing {results.length} result{results.length === 1 ? '' : 's'} · <span className="font-mono">{composedQuery}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {results.length === 0 && !loading && (
          <div className="h-full flex items-center justify-center text-sm text-text-muted text-center max-w-md mx-auto">
            {composedQuery ? 'No results.' : (
              <div>
                <p>Type to search, or use the filters above.</p>
                <p className="mt-2 text-xs">
                  Scryfall syntax also works directly: <span className="font-mono">o:"draw a card"</span>,{' '}
                  <span className="font-mono">is:commander</span>, etc.
                </p>
              </div>
            )}
          </div>
        )}

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        >
          {results.map((card) => {
            const img =
              card.image_uris?.normal ??
              card.image_uris?.small ??
              card.card_faces?.[0]?.image_uris?.normal ??
              card.card_faces?.[0]?.image_uris?.small;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onAddByName(card.name)}
                onMouseEnter={() => {
                  // Piggyback on the sidebar preview by feeding it a
                  // synthetic DeckCard — same fields the CardPreview
                  // renders. Not added to the deck; just previewed.
                  onPreviewCard({
                    name: card.name,
                    quantity: 1,
                    category: 'main',
                    typeLine: card.type_line,
                    manaCost: card.mana_cost,
                    set: card.set,
                    collectorNumber: card.collector_number,
                    scryfallId: card.id,
                    imageUri: img,
                    lookupSource: 'scryfall',
                  });
                }}
                className="aspect-[5/7] w-full rounded-lg overflow-hidden bg-bg-surface border border-border-subtle hover:border-accent hover:shadow-glow transition-all group relative cursor-pointer focus:outline-none focus:border-accent"
                title={`Add ${card.name} to deck`}
              >
                {img ? (
                  <img
                    src={img}
                    alt={card.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div className="h-full flex flex-col p-3">
                    <div className="text-sm font-semibold text-text-primary truncate">{card.name}</div>
                    <div className="mt-auto text-xs text-text-muted">{card.type_line ?? ''}</div>
                  </div>
                )}
                {/* Overlay Add affordance on hover. */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-semibold shadow-glow flex items-center gap-1 border border-transparent">
                    <Plus size={12} /> Add to deck
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SearchFilters({
  value,
  onChange,
  onReset,
}: {
  value: SearchFiltersState;
  onChange: (next: SearchFiltersState) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof SearchFiltersState>(key: K, v: SearchFiltersState[K]) =>
    onChange({ ...value, [key]: v });

  const hasAny =
    value.colors.length > 0 ||
    value.types.length > 0 ||
    value.subtype.trim() !== '' ||
    value.cmcMin.trim() !== '' ||
    value.cmcMax.trim() !== '' ||
    value.oracle.trim() !== '' ||
    value.rarities.length > 0;

  return (
    <div className="space-y-2">
      {/* Row 1: colors + mode + clear */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Colors
        </span>
        {FILTER_COLORS.map((c) => {
          const active = value.colors.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => set('colors', toggleFilter(value.colors, c))}
              className={[
                'h-6 w-6 rounded-full transition-all',
                active
                  ? 'ring-2 ring-offset-1 ring-offset-bg-surface ring-accent'
                  : 'opacity-40 hover:opacity-80',
              ].join(' ')}
              title={COLOR_LABEL[c]}
              aria-pressed={active}
            >
              <img
                src={COLOR_SVG(c)}
                alt={COLOR_LABEL[c]}
                className="w-full h-full block"
                draggable={false}
              />
            </button>
          );
        })}

        <select
          value={value.colorMode}
          onChange={(e) => set('colorMode', e.target.value as FilterColorMode)}
          className="appearance-none bg-bg-base border border-border-subtle rounded-md pl-2 pr-6 py-1 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
          title="Color match mode"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237A6E8F' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
          }}
        >
          <option value="includes">Includes</option>
          <option value="exactly">Exactly</option>
          <option value="atMost">At most</option>
        </select>

        {hasAny && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Row 2: types */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mr-1">
          Types
        </span>
        {FILTER_TYPES.map((t) => {
          const active = value.types.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => set('types', toggleFilter(value.types, t))}
              className={[
                'px-2 py-1 rounded-md text-xs font-medium border transition-colors',
                active
                  ? 'bg-accent/20 border-accent text-text-primary'
                  : 'bg-bg-base border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong',
              ].join(' ')}
              aria-pressed={active}
            >
              {t}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => set('showAdvanced', !value.showAdvanced)}
        className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        {value.showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Advanced filters
      </button>

      {value.showAdvanced && (
        <div
          className="grid gap-3 pt-2 pb-1 border-t border-border-subtle"
          style={{ gridTemplateColumns: '1fr 1fr' }}
        >
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">
              Mana value
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={20}
                value={value.cmcMin}
                onChange={(e) => set('cmcMin', e.target.value)}
                placeholder="min"
                className="w-16 bg-bg-base border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-xs text-text-muted">to</span>
              <input
                type="number"
                min={0}
                max={20}
                value={value.cmcMax}
                onChange={(e) => set('cmcMax', e.target.value)}
                placeholder="max"
                className="w-16 bg-bg-base border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">
              Rarity
            </div>
            <div className="flex items-center gap-1">
              {FILTER_RARITIES.map(({ id, label }) => {
                const active = value.rarities.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => set('rarities', toggleFilter(value.rarities, id))}
                    className={[
                      'w-7 h-7 rounded-md text-xs font-semibold border transition-colors',
                      active
                        ? 'bg-accent/20 border-accent text-text-primary'
                        : 'bg-bg-base border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong',
                    ].join(' ')}
                    title={id[0].toUpperCase() + id.slice(1)}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col-span-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">
              Subtype
            </div>
            <input
              type="text"
              value={value.subtype}
              onChange={(e) => set('subtype', e.target.value)}
              placeholder='e.g. Elemental, or "Human Warrior" for both'
              className="w-full bg-bg-base border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="col-span-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">
              Oracle text contains
            </div>
            <input
              type="text"
              value={value.oracle}
              onChange={(e) => set('oracle', e.target.value)}
              placeholder='e.g. "draw a card"'
              className="w-full bg-bg-base border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Shells + misc ----------

function LoadingShell() {
  return (
    <Layout>
      <AuthGuard />
      <div className="h-full flex items-center justify-center bg-bg-base">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin text-accent" /> Loading deck…
        </div>
      </div>
    </Layout>
  );
}

function NotFoundShell() {
  const navigate = useNavigate();
  return (
    <Layout>
      <AuthGuard />
      <div className="h-full flex flex-col items-center justify-center bg-bg-base gap-3">
        <CircleAlert size={32} className="text-red-400" />
        <div className="text-text-primary font-medium">Deck not found</div>
        <div className="text-sm text-text-muted">
          Servatrice didn't return this deck. Might have been deleted.
        </div>
        <button
          type="button"
          onClick={() => navigate(RouteEnum.DECKS)}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
        >
          <ArrowLeft size={14} /> Back to My Decks
        </button>
      </div>
    </Layout>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  switch (state) {
    case 'saving':
      return (
        <span className="inline-flex items-center gap-1 text-text-muted">
          <Loader2 size={10} className="animate-spin" /> Saving…
        </span>
      );
    case 'dirty':
      return <span className="text-yellow-400">Unsaved changes</span>;
    case 'saved':
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <Check size={10} /> Saved
        </span>
      );
    default:
      return null;
  }
}

function EmptyCardsHint({ isMtg }: { isMtg: boolean }) {
  return (
    <>
      <div className="text-sm text-text-muted italic text-center mt-6 mb-24">
        {isMtg ? (
          <>
            Empty deck. Use{' '}
            <span className="font-semibold text-text-primary">Quick add</span> above to start
            adding, or import a list from My Decks.
          </>
        ) : (
          <>
            Empty deck. Type a card name in{' '}
            <span className="font-semibold text-text-primary">Add a card</span> above to start.
          </>
        )}
      </div>
      <div className="text-center text-text-muted">
        <div className="text-sm">No cards in this deck yet.</div>
      </div>
    </>
  );
}

// ---------- Grouping ----------

const GROUP_ORDER = [
  'Commander',
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
  'Other',
  'Sideboard',
] as const;

function groupCards(
  cards: DeckCard[],
  isCommander: boolean,
): Array<{ label: string; indices: number[] }> {
  const map = new Map<string, number[]>();
  cards.forEach((card, index) => {
    const label = bucketOf(card, isCommander);
    const bucket = map.get(label) ?? [];
    bucket.push(index);
    map.set(label, bucket);
  });
  return GROUP_ORDER
    .map((label) => {
      const indices = map.get(label) ?? [];
      // Sort each bucket alphabetically by card name (case-insensitive,
      // locale-aware) — matches fancy webatrice's Moxfield-style
      // ordering. Sorting by index-into-cards rather than mapping to
      // a new array keeps the (index → card) contract the rows rely
      // on for hover / mutate callbacks.
      indices.sort((a, b) =>
        cards[a].name.localeCompare(cards[b].name, undefined, { sensitivity: 'base' }),
      );
      return { label, indices };
    })
    .filter((g) => g.indices.length > 0);
}

function bucketOf(card: DeckCard, isCommander: boolean): string {
  // Only surface the "Commander" section when the deck's format is
  // Commander. If the deck was previously commander and got switched
  // to (say) Modern, any commander-marked cards fall back to their
  // type bucket rather than lingering under a phantom section header.
  // The `commander="1"` attribute stays in the XML so switching the
  // format back restores the visual grouping.
  if (isCommander && card.isCommander) return 'Commander';
  if (card.category === 'sideboard') return 'Sideboard';
  return primaryType(card.typeLine);
}

export default DeckEditor;
