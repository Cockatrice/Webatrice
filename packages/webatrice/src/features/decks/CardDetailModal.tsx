import { useEffect, useState } from 'react';
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
} from 'lucide-react';

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
    image_uris?: { small?: string; normal?: string; large?: string };
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
  onChangePrinting: (index: number, card: DeckCard) => void;
  onDelete: (index: number) => void;
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
  onChangePrinting,
  onDelete,
}: CardDetailModalProps) {
  // Full-fat Scryfall data for this card — fetched on open, cached
  // locally to the modal instance. Cleared when the modal closes.
  const [detail, setDetail] = useState<ScryfallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const snapshotKey = snapshot ? `${snapshot.name}::${snapshot.category}` : null;

  useEffect(() => {
    if (!snapshot) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setDetailLoading(true);
    const controller = new AbortController();
    fetchScryfallDetail(snapshot.scryfallId, snapshot.name, controller.signal)
      .then((data) => {
        setDetail(data);
        setDetailLoading(false);
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setDetailLoading(false);
      });
    return () => controller.abort();
    // Refetch when the modal changes cards. Uses snapshotKey so the
    // effect only fires when the identity actually changes, not on
    // every re-render of the deck list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey]);

  useEffect(() => {
    if (!snapshot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [snapshot, onClose]);

  if (!snapshot) return null;

  // Resolve snapshot → live row. Uniqueness invariant: (name, category)
  // — the editor's addCard enforces one row per (name, category).
  const liveIndex = deckCards.findIndex(
    (c) => c.name === snapshot.name && c.category === snapshot.category,
  );
  const liveCard = liveIndex >= 0 ? deckCards[liveIndex] : null;
  const removed = !liveCard;

  const face = detail?.card_faces?.[0];
  const img =
    detail?.image_uris?.normal ??
    detail?.image_uris?.large ??
    face?.image_uris?.normal ??
    face?.image_uris?.large;
  const typeLine = detail?.type_line ?? face?.type_line ?? liveCard?.typeLine ?? snapshot.typeLine ?? '';
  const oracle = detail?.oracle_text ?? face?.oracle_text ?? '';
  const flavor = detail?.flavor_text ?? face?.flavor_text ?? '';
  const manaCost =
    detail?.mana_cost ??
    face?.mana_cost ??
    liveCard?.manaCost ??
    snapshot.manaCost ??
    '';
  const cmc =
    typeof detail?.cmc === 'number' ? detail.cmc : liveCard?.cmc ?? snapshot.cmc;
  const setCode = detail?.set ?? liveCard?.set ?? snapshot.set;
  const collector = detail?.collector_number ?? liveCard?.collectorNumber ?? snapshot.collectorNumber;
  const cardIsCommander = (liveCard ?? snapshot).category === 'commander';
  const cardIsSideboard = (liveCard ?? snapshot).category === 'sideboard';
  const quantity = liveCard?.quantity ?? 0;

  const priceInfo = priceForCard(prices, liveCard ?? snapshot);

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
                alt={snapshot.name}
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
                  {snapshot.name}
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

            {/* Actions block — same option set as the row's chevron
                 menu so the user doesn't need to close the modal to
                 tweak the deck. */}
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
                    onSetCategory(liveIndex, cardIsCommander ? 'main' : 'commander');
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
