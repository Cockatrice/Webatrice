import { useCallback, useEffect, useMemo, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Loader2, X } from 'lucide-react';

import { ShortcutScope, useMenuShortcut, useShortcut } from '@app/feature-widgets/shortcuts';
import { lookupCardsCached, type RelatedCardRef } from '@app/services';

import { ContextMenuPopup } from '../../components/context-menus/ContextMenu/ContextMenu';
import { buildRelatedViewItems } from '../../components/context-menus/CardContextMenu/relatedCardActions';
import { buildRevealedCardMenu } from '../../components/context-menus/CardContextMenu/revealedCardMenu.model';
import { useCardPreviewActions } from '../../components/ui/CardPreviewContext';
import { useGameSelectionState } from '../../components/ui/GameSelectionContext';
import { usePlayerCardCommands } from '../../components/ui/GameBoardCell/usePlayerCardCommands';
import { useSeatDragSource } from '../../components/ui/SeatDragContext';
import { useKeyboardMove } from '../../components/ui/KeyboardMoveContext';
import { makeCardKey } from '../../utils/CardRegistry/CardRegistryContext';
import { useCardCatalogMeta } from '../shared/useCardCatalogMeta';
import { zoneLabel } from '../shared/zoneLabels';
import { useFloatingPanelGeometry } from '../shared/useFloatingPanelGeometry';
import { useZoneViewPreferences } from '../shared/useZoneViewPreferences';
import { ZoneCardCell } from '../shared/ZoneCardCell';
import { ZoneCardGroups } from '../shared/ZoneCardGroups';
import { PileViewToggle, ZoneViewSortControls } from '../shared/ZoneViewControls';
import { buildCardGroups, type GroupMode, type SortMode } from '../shared/zoneViewSort';
import { useIncomingReveal } from './useIncomingReveal';

const STORAGE_KEY = 'webatrice.incomingReveal';
const MIN_SIZE = { w: 400, h: 300 };
const DEFAULT_SIZE = { w: 900, h: 520 };

export function incomingRevealTitle(t: TFunction, sourceName: string | undefined, zoneName: string): string {
  const zone = zoneLabel(t, zoneName, 'inline');
  return sourceName != null
    ? t('IncomingRevealDialog.title', { player: sourceName, zone })
    : t('IncomingRevealDialog.titleUnknownSender', { zone });
}

export default function IncomingRevealDialog() {
  const incoming = useIncomingReveal();
  return incoming.reveal ? <IncomingRevealPanel {...incoming} reveal={incoming.reveal} /> : null;
}

type IncomingReveal = ReturnType<typeof useIncomingReveal>;

function useRevealedRelations(cards: readonly { name: string }[]) {
  const [relatedByName, setRelatedByName] = useState<ReadonlyMap<string, RelatedCardRef[]>>(() => new Map());
  const [knownRelated, setKnownRelated] = useState<ReadonlySet<string>>(() => new Set());
  const names = useMemo(() => [...new Set(cards.map((c) => c.name).filter((n) => n.length > 0))], [cards]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const results = await lookupCardsCached(names);
      if (cancelled) {
        return;
      }
      const related = new Map<string, RelatedCardRef[]>();
      for (const [name, r] of results) {
        if (r.related?.length) {
          related.set(name, r.related);
        }
      }
      setRelatedByName(related);
      const relatedNames = [...new Set([...related.values()].flatMap((refs) => refs.map((ref) => ref.name)))];
      if (relatedNames.length === 0) {
        setKnownRelated(new Set());
        return;
      }
      const relatedResults = await lookupCardsCached(relatedNames);
      if (!cancelled) {
        setKnownRelated(new Set(relatedNames.filter((name) => relatedResults.get(name)?.found)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [names]);

  return { relatedByName, knownRelated };
}

function IncomingRevealPanel({
  reveal,
  sourceName,
  cards,
  localPlayerId,
  canDragLent,
  readOnly,
  close,
}: IncomingReveal & { reveal: NonNullable<IncomingReveal['reveal']> }) {
  const { t } = useTranslation();
  const { groupBy, setGroupBy, sortBy, setSortBy, pileView, setPileView } = useZoneViewPreferences(STORAGE_KEY);
  const { showCardInfo } = useCardPreviewActions();
  const menuShortcut = useMenuShortcut();
  const cardCommands = usePlayerCardCommands(localPlayerId ?? -1, true);

  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const selection = useGameSelectionState();
  const setSelectedCardKeys = selection?.setSelectedCardKeys;
  const revealKey = useCallback(
    (id: string) => makeCardKey(reveal.sourceOwnerId, reveal.zoneName, Number(id)),
    [reveal],
  );
  const selectedIds = useMemo(() => new Set(
    reveal.cards.map((card) => String(card.id)).filter((id) => selection?.selectedCardKeys.has(revealKey(id))),
  ), [reveal, revealKey, selection?.selectedCardKeys]);
  const setSelectedIds = (next: ReadonlySet<string> | ((prev: ReadonlySet<string>) => ReadonlySet<string>)) => {
    const ids = typeof next === 'function' ? next(selectedIds) : next;
    setSelectedCardKeys?.(new Set([...ids].map(revealKey)));
  };
  useEffect(() => () => {
    const keys = new Set(reveal.cards.map((card) => revealKey(String(card.id))));
    setSelectedCardKeys?.((prev) => {
      const remaining = new Set([...prev].filter((key) => !keys.has(key)));
      return remaining.size === prev.size ? prev : remaining;
    });
  }, [reveal, revealKey, setSelectedCardKeys]);
  useEffect(() => {
    const liveIds = new Set(cards.map((card) => card.id));
    const removedKeys = new Set(reveal.cards
      .filter((card) => !liveIds.has(String(card.id))).map((card) => revealKey(String(card.id))));
    if (removedKeys.size > 0) {
      setSelectedCardKeys?.((prev) => {
        const remaining = new Set([...prev].filter((key) => !removedKeys.has(key)));
        return remaining.size === prev.size ? prev : remaining;
      });
    }
  }, [reveal, cards, revealKey, setSelectedCardKeys]);
  const [cardMenu, setCardMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const closeCardMenu = useCallback(() => setCardMenu(null), []);
  useEffect(() => {
    setHiddenIds(new Set());
    setCardMenu(null);
  }, [reveal]);
  const { relatedByName, knownRelated } = useRevealedRelations(cards);
  const { panelRef, panelStyle, dragging, onHeaderPointerDown } = useFloatingPanelGeometry({
    storageKey: STORAGE_KEY,
    minSize: MIN_SIZE,
    initialSize: DEFAULT_SIZE,
    openKey: reveal,
  });

  const startLentDrag = useSeatDragSource('incoming-reveal', {
    seatPlayerId: localPlayerId ?? -1,
    zone: 'library',
    lenderPlayerId: reveal.sourceOwnerId,
    disabled: !canDragLent,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const { metaByName, metadataLoaded } = useCardCatalogMeta(cards);
  const effectiveGroupBy: GroupMode = metadataLoaded ? groupBy : 'none';
  const effectiveSortBy: SortMode = metadataLoaded ? sortBy : 'none';
  const groups = useMemo(
    () => buildCardGroups(
      cards.filter((c) => !hiddenIds.has(c.id)),
      metaByName,
      { sortBy: effectiveSortBy, groupBy: effectiveGroupBy },
      t,
    ),
    [cards, hiddenIds, metaByName, effectiveSortBy, effectiveGroupBy, t],
  );

  const hideCards = (ids: readonly string[]) => {
    setHiddenIds((prev) => new Set([...prev, ...ids]));
    setSelectedIds((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
  };
  useShortcut(
    'game.hideRevealedCard',
    () => {
      if (selectedIds.size > 0) {
        hideCards([...selectedIds]);
      }
    },
    { scope: ShortcutScope.GAME, enabled: readOnly },
  );

  const requestKeyboardMove = useKeyboardMove();
  const lentInteraction = (card: { id: string; name: string }): HTMLAttributes<HTMLDivElement> | undefined => {
    if (!canDragLent || !requestKeyboardMove || localPlayerId == null) {
      return undefined;
    }
    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': t('IncomingRevealDialog.moveLent', { name: card.name }),
      onKeyDown: (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || !['Enter', ' ', 'm', 'M'].includes(e.key)) {
          return;
        }
        e.preventDefault();
        requestKeyboardMove({
          source: {
            kind: 'seat',
            seatPlayerId: localPlayerId,
            zone: 'library',
            lenderPlayerId: reveal.sourceOwnerId,
            cards: [{ id: card.id }],
          },
          name: card.name,
        });
      },
    };
  };

  const cardInteraction = (card: { id: string; name: string }): HTMLAttributes<HTMLDivElement> | undefined => {
    if (!readOnly) {
      return lentInteraction(card);
    }
    const { id } = card;
    const select = (toggle: boolean) => setSelectedIds((prev) => {
      if (!toggle) {
        return new Set([id]);
      }
      const next = new Set(prev);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': card.name,
      'aria-pressed': selectedIds.has(id),
      onClick: (e) => select(e.ctrlKey || e.metaKey),
      onKeyDown: (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          select(true);
        }
      },
      onContextMenu: (e) => {
        e.preventDefault();
        e.stopPropagation();
        setCardMenu({ x: e.clientX, y: e.clientY, id, name: card.name });
      },
    };
  };
  const visibleIds = groups.flatMap((g) => g.cards.map((c) => c.handCard.id));
  const menuItems = cardMenu && buildRevealedCardMenu({
    canClone: cardCommands != null,
    t,
    menuShortcut,
    onHide: () => {
      hideCards(selectedIds.has(cardMenu.id) ? [...selectedIds] : [cardMenu.id]);
      setCardMenu(null);
    },
    onClone: () => {
      setCardMenu(null);
      const ids = selectedIds.has(cardMenu.id) ? selectedIds : new Set([cardMenu.id]);
      for (const g of groups) {
        for (const c of g.cards) {
          if (ids.has(c.handCard.id)) {
            cardCommands?.clone({
              name: c.handCard.name,
              providerId: c.handCard.scryfallId,
              color: '',
              pt: '',
              annotation: '',
              y: 0,
            });
          }
        }
      }
    },
    onSelectAll: () => {
      setSelectedIds(new Set(visibleIds));
      setCardMenu(null);
    },
    relatedViewItems: buildRelatedViewItems(
      t,
      relatedByName.get(cardMenu.name) ?? [],
      (name) => knownRelated.has(name),
      (ref) => {
        showCardInfo({ name: ref.name, scryfallId: ref.scryfallId });
        setCardMenu(null);
      },
    ),
  });

  const title = incomingRevealTitle(t, sourceName, reveal.zoneName);

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-6 pointer-events-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label={title}
        ref={panelRef}
        className={[
          'bg-bg-surface border border-border-subtle rounded-lg',
          'shadow-glow flex flex-col pointer-events-auto resize overflow-hidden',
        ].join(' ')}
        style={panelStyle}
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
              {t('ReadOnlyDeck.cardCount', { count: cards.length })}
              {reveal.grantWriteAccess
                ? ` — ${t('ZoneView.status.writeAccess')}`
                : ''}
              {!metadataLoaded && (
                <span className="inline-flex items-center gap-1 text-text-muted italic">
                  <Loader2 size={12} className="board-motion animate-spin" />
                  {t('ZoneView.status.loadingCardDetails')}
                </span>
              )}
            </p>
          </div>
          <PileViewToggle groupBy={groupBy} pileView={pileView} onChange={setPileView} />
          <button
            type="button"
            onClick={close}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary"
            aria-label={t('Common.action.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls — group + sort dropdowns. */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle shrink-0">
          <ZoneViewSortControls groupBy={groupBy} sortBy={sortBy} onGroupByChange={setGroupBy} onSortByChange={setSortBy} />
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4">
          {!metadataLoaded && (
            <div className="text-xs text-text-muted italic mb-3 select-none">
              {t('ZoneView.status.loadingCardDetails')}
            </div>
          )}
          {cards.length === 0 ? (
            <div className="text-sm text-text-muted italic">
              {t('ZoneView.status.noCards')}
            </div>
          ) : (
            <ZoneCardGroups
              groups={groups}
              pile={pileView && effectiveGroupBy !== 'none'}
              renderCell={(c, _g, place) => (
                <ZoneCardCell
                  card={c.handCard}
                  pile={place}
                  className="shrink-0"
                  selected={selectedIds.has(c.handCard.id)}
                  interaction={cardInteraction(c.handCard)}
                  onPointerDown={canDragLent ? (e) => startLentDrag(e, [c.handCard]) : undefined}
                />
              )}
            />
          )}
        </div>

        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={close}
            className={[
              'px-3 py-1.5 rounded-md text-sm font-semibold bg-accent',
              'text-on-accent hover:bg-accent-hover shadow-glow board-motion transition-colors',
            ].join(' ')}
          >
            {t('Common.action.close')}
          </button>
        </div>
      </div>
      {menuItems && (
        <ContextMenuPopup
          items={menuItems}
          anchor={{ x: cardMenu.x, y: cardMenu.y }}
          label={cardMenu.name}
          onClose={closeCardMenu}
        />
      )}
    </div>,
    document.body,
  );
}
