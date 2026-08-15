import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

import { games } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';

import Card from './Card';
import { CARD_HEIGHT, CARD_WIDTH } from './cardSize';
import { useForeignDrag } from './foreignDragContext';
import { useHoveredCard } from './hoveredCard';
import { useBigCardPreview } from './bigCardPreview';
import type { DeckCard } from './mockTypes';
import {
  compareCards,
  groupCards,
  type EnrichedCard,
  type GroupMode,
  type SortMode,
} from './cardListSort';
import { lookupCardsCached } from '../../../decks/cardLookup';

/**
 * Receiver-side modal for Event_RevealCards. Pops up whenever someone
 * reveals a zone to us (e.g. "Reveal library to All players"). Reads
 * the pending reveal from Redux (`games.Selectors.getIncomingReveal`)
 * and dismisses it via `games.Actions.incomingRevealDismissed`.
 *
 * Mirrors Cockatrice desktop's behaviour of opening a ZoneViewWidget
 * when the reveal event arrives with a populated card list — the
 * viewer sees the source player's face-up cards until they close the
 * window. The source doesn't see this modal (server sends them the
 * summary event instead).
 *
 * Sort / group / pile-view controls share their logic with
 * LibrarySearchDialog (see cardListSort). Metadata (type_line, cmc,
 * colors, P/T, set) is backfilled from Dexie/Scryfall on open — the
 * receiver doesn't have the source's deck data locally, so we look it
 * up by name in a single batch request.
 */

const POSITION_STORAGE_KEY = 'webatrice.incomingRevealPosition';
const SIZE_STORAGE_KEY = 'webatrice.incomingRevealSize';
const GROUP_BY_STORAGE_KEY = 'webatrice.incomingRevealGroupBy';
const SORT_BY_STORAGE_KEY = 'webatrice.incomingRevealSortBy';
const PILE_VIEW_STORAGE_KEY = 'webatrice.incomingRevealPileView';
const MIN_DIALOG_W = 400;
const MIN_DIALOG_H = 300;
const DEFAULT_DIALOG_W = 900;
const DEFAULT_DIALOG_H = 520;
/** Fraction of card height each stacked card advances in pile view. */
const PILE_STEP_FRACTION = 0.25;

function readStoredPosition(): { x: number; y: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStoredPosition(pos: { x: number; y: number }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function readStoredSize(): { w: number; h: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.w === 'number' &&
      typeof parsed.h === 'number' &&
      Number.isFinite(parsed.w) &&
      Number.isFinite(parsed.h)
    ) {
      return { w: parsed.w, h: parsed.h };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStoredSize(size: { w: number; h: number }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
  } catch {
    // ignore
  }
}

function clampToViewport(
  pos: { x: number; y: number },
  size: { w: number; h: number },
): { x: number; y: number } {
  if (typeof window === 'undefined') return pos;
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - size.w)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - size.h)),
  };
}

function zoneLabel(zoneName: string): string {
  switch (zoneName) {
    case 'deck':
      return 'library';
    case 'grave':
      return 'graveyard';
    case 'rfg':
      return 'exile';
    case 'hand':
      return 'hand';
    case 'sb':
      return 'sideboard';
    case 'stack':
      return 'stack';
    case 'table':
      return 'battlefield';
    default:
      return zoneName;
  }
}

/** Placeholder metadata used before Scryfall lookup returns (or when
 *  lookup fails). Sort/group treats it as "unknown" — sorts to the top
 *  under Ungrouped, buckets to "Other" under group-by-type. */
function placeholderMeta(name: string): DeckCard {
  return {
    id: `reveal-${name}`,
    card_scryfall_id: '',
    name,
    mana_cost: null,
    type_line: null,
    cmc: null,
    colors: [],
    set: null,
    collector_number: null,
    power: null,
    toughness: null,
    quantity: 1,
    category: 'main',
  };
}

/** Render one revealed card. When `dragToBattlefield` is provided
 *  (lender granted us write access), pointer-down starts a drag onto
 *  the local player's battlefield via the ForeignDragContext. The
 *  drag runs through the local PlayerBox's normal drag machinery —
 *  ghost, drop detection, wire dispatch — with sourcePlayerId set to
 *  the lender so Command_MoveCard's startPlayerId routes through
 *  their zone. Read-only otherwise. */
function renderRevealCard(
  c: EnrichedCard,
  style: React.CSSProperties,
  className: string,
  dragToBattlefield:
    | ((e: React.PointerEvent<HTMLElement>, card: EnrichedCard) => void)
    | undefined,
): React.ReactElement {
  return (
    <div
      key={c.handCard.id}
      className={className}
      style={{
        ...style,
        cursor: dragToBattlefield ? 'grab' : undefined,
        touchAction: dragToBattlefield ? 'none' : undefined,
      }}
      onPointerDown={
        dragToBattlefield
          ? (e) => {
              if (e.button !== 0) return;
              dragToBattlefield(e, c);
            }
          : undefined
      }
    >
      <Card name={c.handCard.name} scryfallId={c.handCard.scryfallId} />
    </div>
  );
}

export default function IncomingRevealDialog() {
  const reveal = useAppSelector(games.Selectors.getIncomingReveal);
  const dispatch = useAppDispatch();
  const beginForeignDrag = useForeignDrag();
  const { setHoveredCard } = useHoveredCard();
  const { openBigPreview, closeBigPreview } = useBigCardPreview();

  const sourceName = useAppSelector((state) => {
    if (!reveal) return undefined;
    const player = games.Selectors.getPlayer(state, reveal.gameId, reveal.sourceOwnerId);
    return player?.properties.userInfo?.name;
  });

  // Prefer the live source-zone snapshot over the initial reveal
  // payload — the cardsRevealed listener also seeds this on the
  // source's zone so cross-zone moves auto-prune via the existing
  // zoneViewCardRemoved path. When the lend recipient right-clicks a
  // card and moves it to their hand, the entry disappears from this
  // list without a bespoke prune reducer. An empty array is truthful
  // (all cards moved out — show "No cards"). Only fall back to the
  // initial payload when the snapshot was never populated
  // (getRevealedCards returns EMPTY_ARRAY for a missing snapshot but
  // ALSO for an existing-but-empty one; we treat those the same and
  // let the empty state render).
  const liveCards = useAppSelector((state) =>
    reveal
      ? games.Selectors.getRevealedCards(
          state,
          reveal.gameId,
          reveal.sourceOwnerId,
          reveal.zoneName,
        )
      : undefined,
  );
  const revealCards = liveCards ?? reveal?.cards ?? [];

  // Our own seat's playerId in this game. Needed to name the target
  // side of Command_MoveCard when we (the lend recipient) pull a card
  // from the lender's deck into one of our own zones.
  const localPlayerId = useAppSelector((state) => {
    if (!reveal) return undefined;
    return games.Selectors.getLocalPlayerId(state, reveal.gameId);
  });

  // When the lender granted us write access, cards in the reveal are
  // draggable onto our own battlefield — matching Cockatrice desktop's
  // ZoneViewWidget behaviour for lent zones. The drag runs on the
  // local PlayerBox's existing drag infrastructure (ghost, drop
  // detection, applyMove wire dispatch) via the ForeignDragContext:
  //   • pointerdown here calls beginForeignDrag with sourcePlayerId
  //     set to the lender's id
  //   • PlayerBox's applyMove writes that into Command_MoveCard's
  //     `startPlayerId`, so Servatrice routes the move through the
  //     lender's zone and validates the write-permission set at
  //     server_abstract_player.cpp:779
  //   • PlayerBox's detectDropTarget-restriction (foreign drags only
  //     land on battlefield) mirrors Cockatrice's ZoneViewWidget
  //     drag scope — hand / grave / exile drops silently no-op
  // Guarded by: reveal.grantWriteAccess (only lends offer this) and
  // sourceOwnerId !== localPlayerId (self-directed reveal edge case
  // — user shouldn't drag their own library-view cards).
  const canDragLent =
    reveal != null &&
    reveal.grantWriteAccess &&
    localPlayerId != null &&
    reveal.sourceOwnerId !== localPlayerId;
  const dragToBattlefield = useMemo(() => {
    if (!canDragLent || !reveal) return undefined;
    return (e: React.PointerEvent<HTMLElement>, c: EnrichedCard) => {
      // The revealed card's id IS its deck position (Cockatrice
      // invariant after `zoneViewRevealed` reindex — see
      // reindexRevealed / view_zone_logic.cpp:92-124). PlayerBox's
      // applyMove reads it back via `Number(handCard.id)` for the
      // wire's cardId when sourceZone === "library".
      beginForeignDrag(
        e,
        [
          {
            id: c.handCard.id,
            name: c.handCard.name,
            scryfallId: c.handCard.scryfallId,
          },
        ],
        'library',
        reveal.sourceOwnerId,
      );
    };
  }, [canDragLent, reveal, beginForeignDrag]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const hasBeenDraggedRef = useRef(false);

  // Sort / group / pile-view state — same defaults as LibrarySearchDialog
  // (view_zone_widget.cpp:234-250 + cache_settings.cpp:383-384): group by
  // type, sort by name, pile view on. Persisted separately so the two
  // dialogs can be tuned independently.
  const [groupBy, setGroupBy] = useState<GroupMode>(() => {
    if (typeof window === 'undefined') return 'type';
    try {
      const raw = window.localStorage.getItem(GROUP_BY_STORAGE_KEY);
      if (raw === 'none' || raw === 'type' || raw === 'cmc' || raw === 'color') {
        return raw;
      }
    } catch {
      // ignore
    }
    return 'type';
  });
  const [sortBy, setSortBy] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'name';
    try {
      const raw = window.localStorage.getItem(SORT_BY_STORAGE_KEY);
      if (
        raw === 'none' ||
        raw === 'name' ||
        raw === 'cmc' ||
        raw === 'type' ||
        raw === 'color' ||
        raw === 'set' ||
        raw === 'pt'
      ) {
        return raw;
      }
    } catch {
      // ignore
    }
    return 'name';
  });
  const [pileView, setPileView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem(PILE_VIEW_STORAGE_KEY);
      if (raw === null) return true;
      return raw === '1';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROUP_BY_STORAGE_KEY, groupBy);
    } catch {
      // ignore
    }
  }, [groupBy]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SORT_BY_STORAGE_KEY, sortBy);
    } catch {
      // ignore
    }
  }, [sortBy]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PILE_VIEW_STORAGE_KEY, pileView ? '1' : '0');
    } catch {
      // ignore
    }
  }, [pileView]);

  // Batch-fetch metadata for every unique card in the reveal. Dexie hits
  // synchronously; misses fall back to a single Scryfall /cards/collection
  // POST (up to 75 identifiers per request). Cards render immediately
  // with placeholder metadata; once lookup lands the grid re-buckets.
  const [metaByName, setMetaByName] = useState<Map<string, DeckCard>>(
    () => new Map(),
  );
  useEffect(() => {
    if (!reveal) {
      setMetaByName(new Map());
      return;
    }
    let cancelled = false;
    const uniqueNames = Array.from(
      new Set(reveal.cards.map((c) => c.name).filter((n) => n.length > 0)),
    );
    if (uniqueNames.length === 0) return;
    void (async () => {
      const results = await lookupCardsCached(uniqueNames);
      if (cancelled) return;
      const next = new Map<string, DeckCard>();
      for (const [name, r] of results) {
        next.set(name, {
          id: `reveal-${name}`,
          card_scryfall_id: r.printings[0]?.scryfallId ?? '',
          name,
          mana_cost: r.manaCost ?? null,
          type_line: r.typeLine ?? null,
          cmc: r.cmc ?? null,
          colors: r.colors ?? [],
          set: r.printings[0]?.set ?? null,
          collector_number: r.printings[0]?.collectorNumber ?? null,
          power: r.power ?? null,
          toughness: r.toughness ?? null,
          quantity: 1,
          category: 'main',
        });
      }
      setMetaByName(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [reveal]);

  useLayoutEffect(() => {
    if (!reveal) return;
    const el = dialogRef.current;
    if (!el) return;
    const stored = readStoredSize();
    if (stored) {
      el.style.width = `${stored.w}px`;
      el.style.height = `${stored.h}px`;
    } else {
      el.style.width = `${DEFAULT_DIALOG_W}px`;
      el.style.height = `${DEFAULT_DIALOG_H}px`;
    }
  }, [reveal]);

  useLayoutEffect(() => {
    if (!reveal) {
      setPos(null);
      hasBeenDraggedRef.current = false;
      return;
    }
    const el = dialogRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const stored = readStoredPosition();
    if (stored) {
      setPos(clampToViewport(stored, { w: rect.width, h: rect.height }));
    } else {
      setPos({
        x: Math.max(0, (window.innerWidth - rect.width) / 2),
        y: Math.max(0, (window.innerHeight - rect.height) / 2),
      });
    }
  }, [reveal]);

  useEffect(() => {
    if (!reveal) return;
    const el = dialogRef.current;
    if (!el) return;
    let first = true;
    let timer: number | null = null;
    const ro = new ResizeObserver(([entry]) => {
      if (first) {
        first = false;
        return;
      }
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => writeStoredSize({ w, h }), 500);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [reveal]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const off = dragOffset.current;
      if (!off) return;
      setPos({ x: e.clientX - off.x, y: e.clientY - off.y });
    };
    const onUp = () => {
      dragOffset.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!reveal || !pos || !hasBeenDraggedRef.current) return;
    const timer = window.setTimeout(() => writeStoredPosition(pos), 500);
    return () => window.clearTimeout(timer);
  }, [reveal, pos]);

  const close = useMemo(
    () => () => {
      // Clear the source's zone.revealedCards on our client so it
      // doesn't linger — a future "View library" of the same source
      // (in another game or after game reset) shouldn't see a stale
      // snapshot. The cardsRevealed listener re-seeds it on any
      // future reveal.
      if (reveal) {
        dispatch(games.Actions.zoneViewCleared({
          gameId: reveal.gameId,
          playerId: reveal.sourceOwnerId,
          zoneName: reveal.zoneName,
        }));
      }
      dispatch(games.Actions.incomingRevealDismissed());
    },
    [dispatch, reveal],
  );

  useEffect(() => {
    if (!reveal) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reveal, close]);

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    setDragging(true);
    hasBeenDraggedRef.current = true;
  };

  // While the Scryfall backfill is in flight, ALL cards have placeholder
  // metadata (type_line=null → primaryType returns 'Other', cmc=null,
  // colors=[]). Grouping by anything but Ungrouped would slam every card
  // into a single misleading bucket. So during load, force Ungrouped and
  // Unsorted regardless of the user's saved preferences — the render
  // stays flat until at least one real lookup result has landed. Once
  // metaByName has an entry for every unique name, grouping/sorting
  // kicks in with real data.
  const uniqueNames = useMemo(
    () =>
      new Set(revealCards.map((c) => c.name).filter((n) => n.length > 0)),
    [revealCards],
  );
  const metadataLoaded =
    uniqueNames.size === 0 ||
    Array.from(uniqueNames).every((n) => metaByName.has(n));
  const effectiveGroupBy: GroupMode = metadataLoaded ? groupBy : 'none';
  const effectiveSortBy: SortMode = metadataLoaded ? sortBy : 'none';

  const groups = useMemo(() => {
    if (!reveal) return [];
    const enriched: EnrichedCard[] = revealCards.map((c, i) => ({
      handCard: {
        id: String(c.id ?? i),
        name: c.name,
        scryfallId: c.providerId,
      },
      meta: metaByName.get(c.name) ?? placeholderMeta(c.name),
    }));
    enriched.sort((a, b) => compareCards(a.meta, b.meta, effectiveSortBy));
    return groupCards(enriched, effectiveGroupBy);
  }, [reveal, revealCards, metaByName, effectiveSortBy, effectiveGroupBy]);

  if (!reveal) return null;

  const title = sourceName
    ? `${sourceName} reveals their ${zoneLabel(reveal.zoneName)}`
    : `A player reveals their ${zoneLabel(reveal.zoneName)}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-6 pointer-events-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={dialogRef}
        className="bg-bg-surface border border-border-subtle rounded-lg shadow-glow flex flex-col pointer-events-auto resize overflow-hidden"
        style={{
          minWidth: `${MIN_DIALOG_W}px`,
          minHeight: `${MIN_DIALOG_H}px`,
          ...(pos
            ? { position: 'absolute', left: pos.x, top: pos.y, margin: 0 }
            : null),
        }}
      >
        {/* Header — title + pile-view toggle + close. */}
        <div
          onPointerDown={onHeaderPointerDown}
          className={[
            'px-4 py-3 border-b border-border-subtle flex items-center gap-3 shrink-0 select-none',
            dragging ? 'cursor-grabbing' : 'cursor-grab',
          ].join(' ')}
        >
          <div className="min-w-0 flex-1">
            <h2 className="font-modern text-base font-semibold text-text-primary truncate">
              {title}
            </h2>
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
              {revealCards.length} card{revealCards.length === 1 ? '' : 's'}
              {reveal.grantWriteAccess
                ? ' — write access granted (drag a card onto your battlefield)'
                : ''}
              {/* Spinner while Scryfall metadata is still resolving —
                  without it the user sees a suspicious "1 Creature,
                  rest in Other" state during the fetch and can't tell
                  whether it's still loading or just wrong. Grouping/
                  sorting are already gated on `metadataLoaded` so
                  cards stay flat until everything's in. */}
              {!metadataLoaded && (
                <span className="inline-flex items-center gap-1 text-text-muted italic">
                  <Loader2 size={12} className="animate-spin" />
                  loading card details…
                </span>
              )}
            </p>
          </div>
          <label
            className={[
              'flex items-center gap-1.5 text-xs select-none',
              groupBy === 'none'
                ? 'text-text-disabled cursor-not-allowed'
                : 'text-text-muted cursor-pointer',
            ].join(' ')}
            title={
              groupBy === 'none'
                ? 'Pile view requires a grouping'
                : 'Stack cards within each group'
            }
          >
            <input
              type="checkbox"
              checked={pileView && groupBy !== 'none'}
              disabled={groupBy === 'none'}
              onChange={(e) => setPileView(e.target.checked)}
              className="accent-accent"
            />
            pile view
          </label>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls — group + sort dropdowns. */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle shrink-0">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupMode)}
            className="px-3 py-2 rounded-md bg-bg-base border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-accent"
            title="Group by"
          >
            <option value="none">Ungrouped</option>
            <option value="type">Group by Type</option>
            <option value="cmc">Group by Mana Value</option>
            <option value="color">Group by Color</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="px-3 py-2 rounded-md bg-bg-base border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-accent"
            title="Sort by"
          >
            <option value="none">Unsorted</option>
            <option value="name">Sort by Name</option>
            <option value="cmc">Sort by Mana Cost</option>
            <option value="type">Sort by Type</option>
            <option value="color">Sort by Color</option>
            <option value="set">Sort by Set</option>
            <option value="pt">Sort by P/T</option>
          </select>
        </div>

        {/* Card grid — same two-mode layout as LibrarySearchDialog:
            pile view stacks each group into a fanned column; flat view
            wraps each group's cards into a grid. During the initial
            metadata backfill we render Ungrouped/Unsorted so a
            misleading "Other (N)" bucket never flashes. */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {!metadataLoaded && (
            <div className="text-xs text-text-muted italic mb-3 select-none">
              Loading card details…
            </div>
          )}
          {revealCards.length === 0 ? (
            <div className="text-sm text-text-muted italic">
              No cards to show.
            </div>
          ) : (
            <div
              className={
                pileView && effectiveGroupBy !== 'none'
                  ? 'flex gap-3 items-start'
                  : 'flex flex-col gap-6'
              }
            >
              {groups.map((g) => (
                <div
                  key={g.key}
                  className={
                    pileView && effectiveGroupBy !== 'none' ? 'shrink-0' : ''
                  }
                  style={
                    pileView && effectiveGroupBy !== 'none'
                      ? { width: CARD_WIDTH }
                      : undefined
                  }
                >
                  {g.label && (
                    <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5 select-none">
                      {g.label}{' '}
                      <span className="text-text-muted normal-case">
                        ({g.cards.length})
                      </span>
                    </div>
                  )}
                  {pileView && effectiveGroupBy !== 'none' ? (
                    <div
                      className="relative"
                      style={{
                        width: CARD_WIDTH,
                        height: `calc(${CARD_HEIGHT} + ${Math.max(
                          0,
                          g.cards.length - 1,
                        )} * calc(${CARD_HEIGHT} * ${PILE_STEP_FRACTION}))`,
                      }}
                    >
                      {g.cards.map((c, i) => {
                        const isLast = i === g.cards.length - 1;
                        // See LibrarySearchDialog for the rationale — outer
                        // strip is the DOM box for hover detection so
                        // browsing a pile down never gets stuck on an
                        // expanded card, inner Card is pointer-events:none
                        // and visually overflows.
                        return (
                          <div
                            key={c.handCard.id}
                            className="absolute left-0 hover:z-10 group"
                            style={{
                              left: 0,
                              top: `calc(${CARD_HEIGHT} * ${PILE_STEP_FRACTION} * ${i})`,
                              width: CARD_WIDTH,
                              height: isLast
                                ? CARD_HEIGHT
                                : `calc(${CARD_HEIGHT} * ${PILE_STEP_FRACTION})`,
                              borderRadius: '7.5%',
                              cursor: dragToBattlefield ? 'grab' : undefined,
                              touchAction: dragToBattlefield ? 'none' : undefined,
                            }}
                            onPointerDown={
                              dragToBattlefield
                                ? (e) => {
                                    if (e.button !== 0) return;
                                    dragToBattlefield(e, c);
                                  }
                                : undefined
                            }
                            onMouseEnter={() => {
                              setHoveredCard({
                                name: c.handCard.name,
                                scryfallId: c.handCard.scryfallId,
                              });
                            }}
                            onMouseDown={(e) => {
                              if (e.button !== 1) return;
                              e.preventDefault();
                              openBigPreview({
                                name: c.handCard.name,
                                scryfallId: c.handCard.scryfallId,
                              });
                              const handleUp = (ev: MouseEvent) => {
                                if (ev.button !== 1) return;
                                closeBigPreview();
                                window.removeEventListener('mouseup', handleUp);
                              };
                              window.addEventListener('mouseup', handleUp);
                            }}
                            onAuxClick={(e) => {
                              if (e.button === 1) e.preventDefault();
                            }}
                          >
                            <div
                              className="absolute left-0 top-0 pointer-events-none transition-transform duration-150 ease-out group-hover:scale-[1.06]"
                              style={{
                                width: CARD_WIDTH,
                                height: CARD_HEIGHT,
                              }}
                            >
                              <Card
                                name={c.handCard.name}
                                scryfallId={c.handCard.scryfallId}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {g.cards.map((c) =>
                        renderRevealCard(
                          c,
                          {
                            width: CARD_WIDTH,
                            height: CARD_HEIGHT,
                            borderRadius: '7.5%',
                          },
                          'shrink-0',
                          dragToBattlefield,
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={close}
            className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
