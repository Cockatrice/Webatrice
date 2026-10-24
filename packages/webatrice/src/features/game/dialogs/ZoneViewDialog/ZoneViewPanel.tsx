import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setRef } from '@mui/material/utils';
import { Maximize2, Minimize2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialogFocus, usePreference } from '@app/hooks';
import { cardViewRowsHeight, toggledCardViewHeight } from './cardViewHeight';
import { MARQUEE_BORDER, MARQUEE_FILL } from '../../components/ui/seatColors/seatColors';
import { useMarquee } from '../../hooks/useMarquee';
import { useCardCatalogMeta } from '../shared/useCardCatalogMeta';
import { clampPanelSize, useFloatingPanelGeometry } from '../shared/useFloatingPanelGeometry';
import { useZoneViewPreferences } from '../shared/useZoneViewPreferences';
import { ZoneCardCell } from '../shared/ZoneCardCell';
import { ZoneCardGroups } from '../shared/ZoneCardGroups';
import { PileViewToggle, ZoneViewSortControls } from '../shared/ZoneViewControls';
import { readShuffleOnClose, writeShuffleOnClose } from '../shared/zoneViewPreferences';
import { GAME_FOCUS_RING } from '../../components/ui/focusRing';
import { cardLabel } from '../../components/ui/SeatCard/cardLabel';
import { useCardFocus } from '../../components/ui/SeatCard/useCardFocus';

const HEADER_BUTTON_CLASS =
  `p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary board-motion transition-colors ${GAME_FOCUS_RING}`;
import { buildCardGroups, type GroupMode, type SortMode } from '../shared/zoneViewSort';

type HandCard = { id: string; name: string; scryfallId: string };

const STORAGE_KEY = 'webatrice.searchLibrary';

const MIN_SIZE = { w: 400, h: 300 };
const CARD_VIEW_CARD_HEIGHT_REM = 12.6;

function measureCardView(dialog: HTMLElement, content: HTMLElement): { chrome: number; area: number; cardHeightPx: number } {
  const style = window.getComputedStyle(content);
  const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const area = content.getBoundingClientRect().height - paddingY;
  const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  return {
    chrome: dialog.getBoundingClientRect().height - area,
    area,
    cardHeightPx: CARD_VIEW_CARD_HEIGHT_REM * rootFontSize,
  };
}

export interface ZoneViewCardScope {
  shownIds: string[];
  columnIds: string[];
}

type Props = {
  /** Called when the dialog closes. Receives whether the "shuffle
   *  when closing" toggle was on so the parent can dispatch the
   *  shuffle command conditionally — same behaviour as Cockatrice's
   *  ZoneViewWidget. Non-library zones (graveyard, exile) never
   *  render the toggle and always receive `false` here. */
  onClose: (shuffleOnClose: boolean) => void;
  library: readonly HandCard[];
  title: string;
  /** Whether to render the "shuffle when closing" checkbox. On by
   *  default (library flow). Non-library zones (graveyard, exile)
   *  set this to false — Cockatrice's ZoneViewWidget only shows the
   *  toggle for library views (view_zone_widget.cpp:163-165). */
  showShuffleOnClose?: boolean;
  /** Fired when the user pointer-downs on a card. Parent wires this into
   *  its drag system so the card can be moved into any play-area zone
   *  (own or another player's battlefield). */
  onCardPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    card: HandCard,
  ) => void;
  onCardContextMenu?: (
    at: { x: number; y: number },
    card: HandCard,
    scope: ZoneViewCardScope,
  ) => void;
  onCardActivate?: (card: HandCard, element: HTMLElement) => void;
  onCardMove?: (card: HandCard) => void;
  onEscapeCancel?: () => boolean;
  /** IDs of library cards currently being dragged by the parent. Those
   *  cards render at opacity 0 in the dialog so the user only sees the
   *  drag ghost. */
  draggingCardIds?: Set<string>;
  /** Ref filled with the dialog's outer content element while open.
   *  The parent uses it to treat drops landing inside the dialog as
   *  library drops — since the modal typically floats over the play
   *  area's library pile, drops on the modal itself must resolve to
   *  the library too. */
  dropRef?: React.Ref<HTMLDivElement>;
  selectedIds: ReadonlySet<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  cardOwner?: { playerId: number; zone: string };
};

export default function ZoneViewPanel({
  onClose,
  library,
  title,
  showShuffleOnClose = true,
  onCardPointerDown,
  onCardContextMenu,
  onCardActivate,
  onEscapeCancel,
  onCardMove,
  draggingCardIds,
  dropRef,
  selectedIds,
  onSelectedIdsChange,
  cardOwner,
}: Props) {
  const [query, setQuery] = useState('');
  const focusSearchBar = usePreference('focusCardViewSearchBar');
  const cardViewInitialRowsMax = usePreference('cardViewInitialRowsMax');
  const cardViewExpandedRowsMax = usePreference('cardViewExpandedRowsMax');
  const showSearchBar = !usePreference('keepGameChatFocus');
  const activeQuery = showSearchBar ? query : '';
  const { groupBy, setGroupBy, sortBy, setSortBy, pileView, setPileView } = useZoneViewPreferences(STORAGE_KEY);
  // "Shuffle when closing" toggle. Cockatrice's ZoneViewWidget
  // defaults this to on; unchecking lets the player peek at library
  // order without wrecking the game state. Persist across sessions.
  const [shuffleOnClose, setShuffleOnClose] = useState(readShuffleOnClose);
  useEffect(() => {
    writeShuffleOnClose(shuffleOnClose);
  }, [shuffleOnClose]);

  const contentRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const { panelRef: dialogRef, panelStyle, dragging, onHeaderPointerDown } = useFloatingPanelGeometry({
    storageKey: STORAGE_KEY,
    minSize: MIN_SIZE,
    initialSize: (el) => {
      if (!contentRef.current) {
        return;
      }
      const { chrome, cardHeightPx } = measureCardView(el, contentRef.current);
      const cardsHeight = cardsRef.current?.scrollHeight ?? 0;
      const rowsHeight = cardViewRowsHeight(cardViewInitialRowsMax, cardHeightPx);
      const height = chrome + (cardsHeight > 0 ? Math.min(rowsHeight, cardsHeight) : rowsHeight);
      el.style.height = `${Math.round(clampPanelSize({ w: el.getBoundingClientRect().width, h: height }, MIN_SIZE).h)}px`;
    },
  });

  const { t } = useTranslation();
  const titleId = useId();
  const close = () => onClose(showShuffleOnClose && shuffleOnClose);
  const { getDialogProps } = useDialogFocus({
    isOpen: true,
    onEscape: () => {
      if (!onEscapeCancel?.()) {
        close();
      }
    },
    modal: false,
    moveFocusIn: showSearchBar,
  });
  const dialogFocusProps = getDialogProps();
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => {
    const el = dialogRef.current;
    const content = contentRef.current;
    if (!el || !content) {
      return;
    }
    const { chrome, area, cardHeightPx } = measureCardView(el, content);
    const cardsHeight = cardsRef.current?.scrollHeight ?? 0;
    const initial = cardViewRowsHeight(cardViewInitialRowsMax, cardHeightPx);
    const maxHeight = Math.min(window.innerHeight - chrome, cardsHeight > 0 ? cardsHeight : Infinity);
    const next = toggledCardViewHeight(area, {
      initial,
      expanded: cardViewRowsHeight(Math.max(cardViewExpandedRowsMax, cardViewInitialRowsMax), cardHeightPx),
      maxHeight,
    });
    setExpanded(next > Math.min(initial, maxHeight) + 1);
    el.style.height = `${Math.round(Math.max(MIN_SIZE.h, chrome + next))}px`;
  };

  const { marquee, begin } = useMarquee<undefined>((rect) => {
    const ids = new Set<string>();
    contentRef.current?.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
      const id = el.dataset.cardId;
      const r = el.getBoundingClientRect();
      if (id && !(r.right < rect.left || r.left > rect.right || r.bottom < rect.top || r.top > rect.bottom)) {
        ids.add(id);
      }
    });
    onSelectedIdsChange(ids);
    return ids.size;
  }, { blockTextSelection: true });

  const onContentPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    const target = e.target as HTMLElement | null;
    // Skip clicks on cards themselves (future: card interaction) and any
    // controls that shouldn't kick off a marquee.
    if (target?.closest('[data-card]')) {
      return;
    }
    if (target?.closest('input, button, select, textarea, [role=\'button\']')) {
      return;
    }
    // Skip clicks that land on the content area's scrollbar — those are
    // scrollbar interactions, not selection gestures.
    const contentEl = contentRef.current;
    if (contentEl) {
      const cr = contentEl.getBoundingClientRect();
      const localX = e.clientX - cr.left;
      const localY = e.clientY - cr.top;
      const onHScrollbar =
        contentEl.scrollWidth > contentEl.clientWidth &&
        localY > contentEl.clientHeight;
      const onVScrollbar =
        contentEl.scrollHeight > contentEl.clientHeight &&
        localX > contentEl.clientWidth;
      if (onHScrollbar || onVScrollbar) {
        return;
      }
    }
    // Skip clicks on the native `resize: both` handle at the dialog's
    // bottom-right corner. Handle occupies roughly the last 20px of
    // each axis; clicking there resizes the dialog.
    const dialogEl = dialogRef.current;
    if (dialogEl) {
      const dRect = dialogEl.getBoundingClientRect();
      const RESIZE_HANDLE_SIZE = 20;
      if (
        e.clientX >= dRect.right - RESIZE_HANDLE_SIZE &&
        e.clientY >= dRect.bottom - RESIZE_HANDLE_SIZE
      ) {
        return;
      }
    }
    onSelectedIdsChange(new Set());
    begin(e, undefined);
  };

  const { metaByName, metadataLoaded } = useCardCatalogMeta(library);
  const effectiveGroupBy: GroupMode = metadataLoaded ? groupBy : 'none';
  const effectiveSortBy: SortMode = metadataLoaded ? sortBy : 'none';
  const groups = useMemo(
    () => buildCardGroups(
      library,
      metaByName,
      { query: activeQuery, sortBy: effectiveSortBy, groupBy: effectiveGroupBy },
      t,
    ),
    [library, metaByName, activeQuery, effectiveSortBy, effectiveGroupBy, t],
  );

  const totalShown = groups.reduce((n, g) => n + g.cards.length, 0);
  const shownIds = groups.flatMap((g) => g.cards.map((c) => c.handCard.id));
  const pile = pileView && groupBy !== 'none';
  const scopeOf = (cardId: string): ZoneViewCardScope => ({
    shownIds,
    columnIds: groups.find((g) => g.cards.some((c) => c.handCard.id === cardId))?.cards.map((c) => c.handCard.id) ?? [],
  });
  const { cardProps } = useCardFocus<HandCard>({
    zone: cardOwner?.zone ?? '',
    cards: groups.flatMap((g) => g.cards.map((c) => c.handCard)),
    orientation: pile ? 'vertical' : 'horizontal',
    lines: groups.map((g) => g.cards.map((c) => c.handCard.id)),
    ownerOf: () => cardOwner?.playerId ?? -1,
    labelOf: (card) => cardLabel(t, { name: card.name }),
    previewOf: (card) => ({ name: card.name, scryfallId: card.scryfallId }),
    selectedIds,
    onSelectIds: onSelectedIdsChange,
    onActivate: onCardActivate,
    onMove: onCardMove,
    onOpenMenu: (card, rect) => onCardContextMenu?.({ x: rect.left, y: rect.bottom }, card, scopeOf(card.id)),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 pointer-events-none"
      // React portals still bubble synthetic events up the React tree,
      // which would let a pointerdown here reach the ancestor seat
      // and start a marquee behind the dialog. Stop propagation at the
      // portal boundary for both mouse (backdrop close) and pointer
      // (drag start / card interactions).
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        {...dialogFocusProps}
        role="dialog"
        aria-labelledby={titleId}
        ref={(el) => {
          dialogRef.current = el;
          setRef(dropRef, el);
          dialogFocusProps.ref(el);
        }}
        className={[
          'bg-bg-surface border border-border-subtle rounded-lg',
          'shadow-glow w-[min(1100px,95vw)] h-[min(85vh,900px)]',
          'max-w-screen max-h-screen flex flex-col pointer-events-auto resize overflow-hidden',
        ].join(' ')}
        // Override the shared card-size CSS variables so every card
        // inside the dialog renders bigger than in the play area.
        // Cards use these vars via cardSize.ts, so nothing else changes.
        style={
          {
            '--card-width': '9rem',
            '--card-height': `${CARD_VIEW_CARD_HEIGHT_REM}rem`,
            ...panelStyle,
          } as React.CSSProperties
        }
      >
        {/* Header */}
        <div
          onPointerDown={onHeaderPointerDown}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest('button')) {
              toggleExpanded();
            }
          }}
          className={[
            'flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0 select-none',
            dragging ? 'cursor-grabbing' : 'cursor-grab',
          ].join(' ')}
        >
          <h2
            className={`text-lg font-semibold text-text-primary rounded ${GAME_FOCUS_RING}`}
            tabIndex={-1}
            data-autofocus={showSearchBar && focusSearchBar ? undefined : true}
          >
            <span id={titleId}>{title}</span>
            <span className="ml-2 text-sm text-text-muted">
              {totalShown} / {library.length}
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <PileViewToggle groupBy={groupBy} pileView={pileView} onChange={setPileView} />
            {showShuffleOnClose && (
              <label className="flex items-center gap-1.5 text-xs text-text-muted select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleOnClose}
                  onChange={(e) => setShuffleOnClose(e.target.checked)}
                  className="accent-accent"
                />
                {t('ZoneViewPanel.shuffleOnClose')}
              </label>
            )}
            <button
              type="button"
              onClick={toggleExpanded}
              aria-pressed={expanded}
              aria-label={t('ZoneViewPanel.expand')}
              title={t('ZoneViewPanel.expand')}
              className={HEADER_BUTTON_CLASS}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={close}
              className={HEADER_BUTTON_CLASS}
              aria-label={t('ZoneViewPanel.close')}
              title={t('ZoneViewPanel.close')}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle shrink-0">
          {showSearchBar ? (
            <div className="relative flex-1 min-w-0">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              <input
                type="text"
                autoFocus={focusSearchBar}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t('ZoneViewPanel.search')}
                placeholder={t('ZoneView.searchPlaceholder')}
                className={[
                  'w-full pl-8 pr-3 py-2 rounded-md bg-bg-base border border-border-subtle text-sm',
                  'text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent',
                  GAME_FOCUS_RING,
                ].join(' ')}
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <ZoneViewSortControls groupBy={groupBy} sortBy={sortBy} onGroupByChange={setGroupBy} onSortByChange={setSortBy} />
        </div>

        {/* Grouped columns of stacked cards */}
        <div
          ref={contentRef}
          onPointerDown={onContentPointerDown}
          className="flex-1 min-h-0 overflow-auto p-4 relative"
        >
          {totalShown === 0 ? (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              {t('ZoneViewPanel.noMatch')}
            </div>
          ) : (
            <ZoneCardGroups
              cardsRef={cardsRef}
              label={title}
              groups={groups}
              pile={pile}
              renderCell={(c, _g, place) => (
                <ZoneCardCell
                  card={c.handCard}
                  pile={place}
                  marked
                  cardOwner={cardOwner}
                  className="shrink-0"
                  selected={selectedIds.has(c.handCard.id)}
                  hidden={draggingCardIds?.has(c.handCard.id)}
                  onPointerDown={onCardPointerDown && ((e) => onCardPointerDown(e, c.handCard))}
                  onContextMenu={onCardContextMenu && ((e) => {
                    onCardContextMenu({ x: e.clientX, y: e.clientY }, c.handCard, scopeOf(c.handCard.id));
                  })}
                  interaction={cardProps(c.handCard)}
                />
              )}
            />
          )}
        </div>
      </div>

      {/* Marquee rectangle for in-dialog selection. Fixed position so it
          stays aligned with the pointer regardless of the dialog's scroll. */}
      {marquee && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
            border: MARQUEE_BORDER,
            background: MARQUEE_FILL,
            zIndex: 1001,
          }}
        />
      )}
    </div>,
    document.body,
  );
}
