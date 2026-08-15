import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Minus,
  Plus,
  Layers,
  Crown,
  Archive,
  PackageOpen,
  Trash2,
  ArrowLeft,
} from 'lucide-react';

import { CardRelatedLinks, relatedCardKey, type RelatedCardKind } from '@app/components';

import { priceForCard, type PriceLookup } from './pricing';
import type { DeckCard, DeckCategory } from './types';

/**
 * Click-to-open card details popup for MTG decks. Ports fancy
 * webatrice's `CardDetailModal` — bigger + more persistent than the
 * hover preview in the sidebar, with side-by-side image + text layout
 * and the same per-row action set the chevron menu carries so the user
 * doesn't have to close the modal to change quantity or move a card.
 *
 * Non-MTG decks never open this modal (there's nothing MTG-specific to
 * show); the parent (DeckEditor) gates on `isMtg` before mounting.
 *
 * Detail data (oracle text, flavor text, full type line) isn't in our
 * lightweight `DeckCard` — we fetch it from Scryfall on open. Uses the
 * card's `scryfallId` when known, falls back to `/cards/named?exact=`.
 */

/** Scryfall fields we render in the detail view. Superset of what
 *  `DeckCard` carries; the modal's on-open fetch fills in the rest. */
interface ScryfallDetail {
  id: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  set?: string;
  collector_number?: string;
  image_uris?: { small?: string; normal?: string; large?: string };
  card_faces?: Array<{
    name?: string;
    type_line?: string;
    oracle_text?: string;
    flavor_text?: string;
    mana_cost?: string;
    /** Face-level CMC. Scryfall only populates this on MDFCs and
     *  reversible cards — regular transform DFCs put CMC on the
     *  top-level record only, and their back face has no mana cost
     *  at all. */
    cmc?: number;
    image_uris?: { small?: string; normal?: string; large?: string };
  }>;
  /** Scryfall `all_parts` — tokens, meld pieces, combo pieces. Powers
   *  the "Related" link section rendered by CardRelatedLinks. */
  all_parts?: Array<{
    id?: string;
    name?: string;
    component?: string;
  }>;
}

async function fetchScryfallDetail(
  scryfallId: string | undefined,
  name: string,
  signal?: AbortSignal,
): Promise<ScryfallDetail | null> {
  try {
    let url: string;
    if (scryfallId) {
      url = `https://api.scryfall.com/cards/${encodeURIComponent(scryfallId)}`;
    } else {
      const cleaned = name.replace(/\s*\(?\bToken\b\)?\s*$/i, '');
      url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cleaned)}`;
    }
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as ScryfallDetail;
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    return null;
  }
}

export interface CardDetailModalProps {
  /** Snapshot of the card at click time. `null` closes the modal.
   *  We track by snapshot rather than array index because the deck's
   *  cards array reshuffles (alphabetical sort, adds, removes) —
   *  finding the live row by (name, category) survives those. */
  snapshot: DeckCard | null;
  /** Live deck cards. The modal resolves `snapshot` to a live row
   *  every render so quantity + printing changes stay in sync. */
  deckCards: DeckCard[];
  /** Format-gated flag: only show the commander toggle for
   *  commander-family decks. */
  isCommanderDeck: boolean;
  /** Shared price lookup from DeckEditor. Modal reads its per-card
   *  price from this rather than firing its own Scryfall call. */
  prices: PriceLookup;
  onClose: () => void;
  onInc: (index: number) => void;
  onDec: (index: number) => void;
  onSetCategory: (index: number, category: DeckCategory) => void;
  /** Toggle the commander marker on a card. Independent of category
   *  — the card stays in whatever zone it was in (main / sideboard).
   *  Passing an index outside the deck bounds is a no-op. */
  onSetCommander: (index: number, isCommander: boolean) => void;
  onChangePrinting: (index: number, card: DeckCard) => void;
  onDelete: (index: number) => void;
  /** Add a card to the deck by name. Used by the "Add to deck"
   *  button that appears when browsing a related card (token / meld
   *  piece / combo piece) not currently in the deck. Async because
   *  the underlying `addCard` hydrates via Dexie / Scryfall. */
  onAdd: (name: string) => Promise<void> | void;
}

export default function CardDetailModal({
  snapshot,
  deckCards,
  isCommanderDeck,
  prices,
  onClose,
  onInc,
  onDec,
  onSetCategory,
  onSetCommander,
  onChangePrinting,
  onDelete,
  onAdd,
}: CardDetailModalProps) {
  // Full-fat Scryfall data for this card — fetched on open, cached
  // locally to the modal instance. Cleared when the modal closes.
  const [detail, setDetail] = useState<ScryfallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Optional browse override — set when the user clicks a related-
  // card link (token / meld piece / combo piece / other face). Only
  // affects the preview panel; the actions block retargets to the
  // browsed card's deck row when it exists. `kind` tracks how the
  // browsed card relates to the parent so the Add button can be
  // suppressed for "face" (same physical card) and "meld_result"
  // (visual representation of a completed meld, not a real card).
  // A "← Back" affordance in the header clears the override.
  const [browseOverride, setBrowseOverride] = useState<{ name: string; scryfallId?: string; kind: RelatedCardKind } | null>(null);
  // Chip the user just clicked, while its details are fetching. Once
  // the fetch resolves we swap `browseOverride` + `detail` atomically
  // and clear this — that way the modal never renders a half-loaded
  // in-between state, and the specific chip shows a spinner instead
  // of the whole panel flickering blank.
  const [pendingNavigation, setPendingNavigation] = useState<{ name: string; scryfallId?: string } | null>(null);
  // Ref mirror so the async fetch closure can compare against the
  // latest pending state at resolve time. Stale click from a chip
  // whose fetch resolves after a newer click gets discarded.
  const pendingNavigationRef = useRef<typeof pendingNavigation>(null);
  pendingNavigationRef.current = pendingNavigation;

  const snapshotKey = snapshot ? `${snapshot.name}::${snapshot.category}` : null;
  // Reset the override whenever the snapshot changes — opening a
  // different deck row starts fresh.
  useEffect(() => {
    setBrowseOverride(null);
  }, [snapshotKey]);

  const fetchTarget = browseOverride ?? (snapshot
    ? { name: snapshot.name, scryfallId: snapshot.scryfallId }
    : null);
  const fetchKey = fetchTarget
    ? fetchTarget.scryfallId ?? `name:${fetchTarget.name}`
    : null;

  useEffect(() => {
    if (!fetchTarget) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setDetailLoading(true);
    const controller = new AbortController();
    fetchScryfallDetail(fetchTarget.scryfallId, fetchTarget.name, controller.signal)
      .then((data) => {
        setDetail(data);
        setDetailLoading(false);
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setDetailLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  useEffect(() => {
    if (!snapshot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [snapshot, onClose]);

  if (!snapshot) return null;

  // Resolve the target deck row for actions. Two cases:
  //  1. Not browsing → resolve by snapshot (the row the user clicked).
  //     Uniqueness invariant: (name, category) — enforced by addCard.
  //  2. Browsing to a related card → look up ALL deck rows matching
  //     the browsed name (either category); prefer 'main' since
  //     commanders live there. If not found, actions apply to
  //     nothing and the block is hidden entirely.
  const targetName = browseOverride?.name ?? snapshot.name;
  const liveIndex = browseOverride
    ? (() => {
        // Prefer main-category matches over sideboard for the same
        // name so "Mark as commander" applies to the mainboard copy
        // when both exist.
        const mainIdx = deckCards.findIndex(
          (c) => c.name === targetName && c.category === 'main',
        );
        if (mainIdx >= 0) return mainIdx;
        return deckCards.findIndex((c) => c.name === targetName);
      })()
    : deckCards.findIndex(
        (c) => c.name === snapshot.name && c.category === snapshot.category,
      );
  const liveCard = liveIndex >= 0 ? deckCards[liveIndex] : null;
  // `removed` = the snapshot row was deleted (only meaningful when
  // NOT browsing). `browsedNotInDeck` = the user is browsing a related
  // card that isn't in the deck — hide actions rather than show them
  // grayed out with a "removed" label.
  const removed = !browseOverride && !liveCard;
  const browsedNotInDeck = !!browseOverride && !liveCard;

  // Pick the matching face when the active card name resolves to a
  // specific `card_faces[N].name` (case-insensitive) — this is how
  // clicking "Other face" on a DFC actually flips the modal to the
  // back face's data. Falls back to face[0] for classic single-face
  // cards and when the browsed name doesn't match any face.
  const activeCardName = browseOverride?.name ?? snapshot.name;
  const face =
    detail?.card_faces?.find(
      (f) => f.name?.toLowerCase() === activeCardName.toLowerCase(),
    ) ?? detail?.card_faces?.[0];
  // Prefer the face's own image when a specific face was picked —
  // Scryfall's top-level `image_uris` on a DFC always returns the
  // front face, so relying on it alone would leave the back-face
  // click showing the front art.
  const img =
    face?.image_uris?.normal ??
    face?.image_uris?.large ??
    detail?.image_uris?.normal ??
    detail?.image_uris?.large;
  // When browsing to a related card, prefer that card's own data over
  // the original snapshot's fields — otherwise a token's row would
  // silently inherit the deck row's typeLine / manaCost / etc.
  const displayFallback: Partial<DeckCard> = browseOverride
    ? {}
    : snapshot;
  // Face-level fields win over top-level so a DFC's back face shows
  // its own oracle / type / PT / mana instead of the front's.
  const typeLine = face?.type_line ?? detail?.type_line ?? liveCard?.typeLine ?? displayFallback.typeLine ?? '';
  const oracle = face?.oracle_text ?? detail?.oracle_text ?? '';
  const flavor = face?.flavor_text ?? detail?.flavor_text ?? '';
  const manaCost =
    face?.mana_cost ??
    detail?.mana_cost ??
    liveCard?.manaCost ??
    displayFallback.manaCost ??
    '';
  // CMC gating: if we've picked a face and that face has NO mana
  // cost (e.g. transform DFC back like Insectile Aberration), don't
  // show a CMC — otherwise we'd inherit the front face's CMC from
  // detail.cmc. Prefer face.cmc when Scryfall provided it (MDFCs,
  // reversibles) so each face shows its own value. Fall through to
  // top-level for single-face cards and transform fronts.
  const cmc = (() => {
    if (face) {
      const faceMana = face.mana_cost ?? '';
      if (!faceMana) return undefined;
      if (typeof face.cmc === 'number') return face.cmc;
    }
    return typeof detail?.cmc === 'number' ? detail.cmc : liveCard?.cmc ?? displayFallback.cmc;
  })();
  const setCode = detail?.set ?? liveCard?.set ?? displayFallback.set;
  const collector = detail?.collector_number ?? liveCard?.collectorNumber ?? displayFallback.collectorNumber;
  // Card-level flags derive purely from the live deck row when it
  // exists (that's the authoritative deck state). When browsing to a
  // card that ISN'T in the deck, `liveCard` is null and the actions
  // block is hidden entirely, so these values don't get read.
  const cardIsCommander = !!liveCard?.isCommander;
  const cardIsSideboard = liveCard?.category === 'sideboard';
  const quantity = liveCard?.quantity ?? 0;

  const priceInfo = priceForCard(prices, liveCard ?? (browseOverride ? { name: browseOverride.name } as DeckCard : snapshot));

  // Run an action and immediately close so the deck-list surface
  // reflects the change. Quantity +/- is the exception — keep the
  // modal open so the user can adjust rapidly.
  const closeAfter = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-3xl rounded-xl bg-bg-surface border border-border-subtle shadow-glow p-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="grid gap-6" style={{ gridTemplateColumns: '300px 1fr' }}>
          <div>
            {img ? (
              <img
                src={img}
                alt={activeCardName}
                className="w-full rounded-lg shadow-glow"
                draggable={false}
              />
            ) : detailLoading ? (
              <div className="w-full aspect-[5/7] rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-text-muted" />
              </div>
            ) : (
              <div className="w-full aspect-[5/7] rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-xs text-text-muted">
                No image
              </div>
            )}
          </div>

          <div className="min-w-0 flex flex-col gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="font-modern text-xl font-bold text-text-primary truncate">
                  {face?.name ?? activeCardName}
                </h2>
                {typeof cmc === 'number' && (
                  <span className="text-xs text-text-muted tabular-nums shrink-0">
                    CMC {cmc}
                  </span>
                )}
              </div>
              {manaCost && (
                <div className="mt-1">
                  <ManaSymbols cost={manaCost} size={16} />
                </div>
              )}
            </div>

            {typeLine && (
              <div className="text-sm text-text-secondary italic">{typeLine}</div>
            )}

            {oracle && (
              <div className="text-sm text-text-primary whitespace-pre-line leading-relaxed">
                <SymbolText text={oracle} size={13} />
              </div>
            )}

            {flavor && (
              <div className="text-sm text-text-muted italic whitespace-pre-line leading-relaxed border-t border-border-subtle pt-3">
                <SymbolText text={flavor} size={13} />
              </div>
            )}

            {browseOverride && (
              <button
                type="button"
                onClick={() => setBrowseOverride(null)}
                className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
                title={`Back to ${snapshot.name}`}
              >
                <ArrowLeft size={12} /> Back to {snapshot.name}
              </button>
            )}
            {/* Related-card links only appear on the ORIGINAL snapshot
                view. Once the user has browsed into a related card,
                the Back button is the only nav — no deeper drilling.
                Keeps the flow shallow and predictable. */}
            {detail && !browseOverride && (
              <CardRelatedLinks
                faces={detail.card_faces}
                allParts={detail.all_parts}
                parentName={detail.name}
                currentFaceName={face?.name ?? detail.name}
                pendingKey={pendingNavigation
                  ? relatedCardKey(pendingNavigation)
                  : undefined}
                onNavigate={(next) => {
                  // Fetch-first-then-swap: the naive "setBrowseOverride
                  // immediately" flow would clear `detail` (via the
                  // fetch effect), render a blank in-between frame,
                  // then repaint with the new card. Instead we mark
                  // the chip as pending (shows spinner + disables all
                  // chips), fetch the new details, and only swap
                  // `browseOverride` + `detail` together in one
                  // commit. AbortController isn't strictly needed
                  // because the effect that would re-fetch only fires
                  // AFTER we've swapped — but we still guard against
                  // stale results by comparing the target when the
                  // fetch returns.
                  setPendingNavigation({ name: next.name, scryfallId: next.scryfallId });
                  const target = next;
                  void (async () => {
                    const fetched = await fetchScryfallDetail(target.scryfallId, target.name);
                    // Bail if the user clicked a DIFFERENT chip while
                    // this fetch was in flight — the newer click's
                    // pending state has replaced ours.
                    const stillCurrent = (
                      pendingNavigationRef.current?.name === target.name
                      && pendingNavigationRef.current?.scryfallId === target.scryfallId
                    );
                    if (!stillCurrent) return;
                    // Commit atomically: browseOverride change would
                    // otherwise trigger the fetch effect below to
                    // re-fetch what we just fetched. Pre-seeding
                    // `detail` here means the effect will re-fetch in
                    // the background, but the UI has the data
                    // immediately — no flicker.
                    setDetail(fetched);
                    setBrowseOverride(target);
                    setPendingNavigation(null);
                  })();
                }}
              />
            )}

            {/* Actions block — same option set as the row's chevron
                 menu so the user doesn't need to close the modal to
                 tweak the deck. When browsing a related card, the
                 actions retarget to that card's deck row (if it
                 exists). If the browsed card isn't in the deck at
                 all, the block is hidden — no point offering
                 "Change printing" on a card you don't own. */}
            {!browsedNotInDeck && (
            <div className="mt-2 border-t border-border-subtle pt-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Actions
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-md bg-bg-elevated border border-border-subtle">
                <span className="text-sm text-text-secondary">
                  Quantity{' '}
                  {removed && (
                    <span className="text-xs text-text-muted">· removed from deck</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => liveIndex >= 0 && onDec(liveIndex)}
                    disabled={removed}
                    className="p-1 rounded hover:bg-bg-base text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center tabular-nums text-text-primary font-semibold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => liveIndex >= 0 && onInc(liveIndex)}
                    disabled={removed}
                    className="p-1 rounded hover:bg-bg-base text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <ActionButton
                icon={<Layers size={14} />}
                label="Change printing"
                disabled={removed}
                onClick={closeAfter(() => {
                  if (liveCard && liveIndex >= 0) onChangePrinting(liveIndex, liveCard);
                })}
              />
              {isCommanderDeck && (
                <ActionButton
                  icon={
                    <Crown
                      size={14}
                      className={cardIsCommander ? 'text-yellow-400' : ''}
                    />
                  }
                  label={cardIsCommander ? 'Unmark as commander' : 'Mark as commander'}
                  disabled={removed}
                  onClick={closeAfter(() => {
                    if (liveIndex < 0) return;
                    onSetCommander(liveIndex, !cardIsCommander);
                  })}
                />
              )}
              {cardIsSideboard ? (
                <ActionButton
                  icon={<PackageOpen size={14} />}
                  label="Move to main"
                  disabled={removed}
                  onClick={closeAfter(() => {
                    if (liveIndex >= 0) onSetCategory(liveIndex, 'main');
                  })}
                />
              ) : (
                <ActionButton
                  icon={<Archive size={14} />}
                  label="Move to sideboard"
                  disabled={removed || cardIsCommander}
                  onClick={closeAfter(() => {
                    if (liveIndex >= 0) onSetCategory(liveIndex, 'sideboard');
                  })}
                />
              )}
              <ActionButton
                icon={<Trash2 size={14} />}
                label="Remove from deck"
                danger
                disabled={removed}
                onClick={closeAfter(() => {
                  if (liveIndex >= 0) onDelete(liveIndex);
                })}
              />
            </div>
            )}

            {browsedNotInDeck && browseOverride && (() => {
              // Add-to-deck only makes sense for cards that are real
              // deckable cards:
              //   • 'face'        → same physical card as the parent,
              //                     nothing to add
              //   • 'meld_result' → visual of a completed meld, not a
              //                     card you shuffle in
              //   • 'token'       → tokens are generated at game time,
              //                     not shuffled in — no Add
              //   • 'meld_part'   → the OTHER card that completes the
              //                     meld — deckable
              //   • 'combo_piece' → deckable
              const canAdd = browseOverride.kind === 'meld_part'
                || browseOverride.kind === 'combo_piece';
              // If there's nothing to offer, skip the whole section
              // rather than rendering an empty "Actions" header.
              if (!canAdd) return null;
              return (
                <div className="mt-2 border-t border-border-subtle pt-3 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Actions
                  </div>
                  <ActionButton
                    icon={<Plus size={14} />}
                    label="Add to deck"
                    onClick={() => {
                      // Keep the modal open on the browsed card — after
                      // `addCard` resolves, the deckCards prop updates,
                      // `liveIndex` resolves, and the full Actions block
                      // takes over so the user can mark as commander,
                      // change printing, etc. without extra clicks.
                      void onAdd(browseOverride.name);
                    }}
                  />
                </div>
              );
            })()}

            {priceInfo?.usd != null && (
              <div className="mt-1 pt-2 border-t border-border-subtle">
                {priceInfo.tcgplayer ? (
                  <a
                    href={priceInfo.tcgplayer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border transition-colors bg-accent-secondary/50 hover:bg-accent-secondary border-accent/40 hover:border-accent text-white shadow-glow"
                  >
                    <span className="text-sm font-medium">Buy @ TCGplayer</span>
                    <span className="tabular-nums text-sm font-semibold">
                      ${priceInfo.usd.toFixed(2)}
                    </span>
                  </a>
                ) : (
                  <div className="w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border bg-accent-secondary/30 border-accent/30 text-text-primary">
                    <span className="text-sm font-medium">TCGplayer USD</span>
                    <span className="tabular-nums text-sm font-semibold">
                      ${priceInfo.usd.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(setCode || collector) && (
              <div className="text-xs text-text-muted mt-1 pt-2 border-t border-border-subtle uppercase tracking-wider">
                {setCode?.toUpperCase() ?? '?'} · #{collector ?? '?'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors',
        danger
          ? 'bg-bg-elevated border-border-subtle text-red-300 hover:bg-red-500/10 hover:border-red-500/40'
          : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ---------- Local symbol renderers ----------
// (Duplicated locally rather than imported from DeckEditor.tsx to
//  keep this modal file self-contained — the DeckEditor version is
//  only used inside the deck row and isn't exported. Kept in sync
//  visually via matching sizes/CDN URLs.)

const TOKEN_RE = /\{[^}]+\}/g;
const SINGLE_TOKEN_RE = /^\{[^}]+\}$/;

function ManaSymbol({ token, size }: { token: string; size: number | string }) {
  const inner = token.slice(1, -1).replace(/\//g, '');
  return (
    <img
      src={`https://svgs.scryfall.io/card-symbols/${inner}.svg`}
      alt={token}
      style={{ width: size, height: size }}
      className="inline-block align-text-bottom"
      draggable={false}
    />
  );
}

function ManaSymbols({
  cost,
  size = 14,
  className,
}: {
  cost: string;
  size?: number | string;
  className?: string;
}) {
  const tokens = cost.match(TOKEN_RE);
  if (!tokens || tokens.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className ?? ''}`}>
      {tokens.map((tok, i) => (
        <ManaSymbol key={i} token={tok} size={size} />
      ))}
    </span>
  );
}

/** Interpolates `{X}` symbols inline within rules text so oracle
 *  paragraphs read naturally. Split-based so newlines survive via the
 *  parent's `whitespace-pre-line`. */
function SymbolText({ text, size = 12 }: { text: string; size?: number }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (SINGLE_TOKEN_RE.test(p)) return <ManaSymbol key={i} token={p} size={size} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
