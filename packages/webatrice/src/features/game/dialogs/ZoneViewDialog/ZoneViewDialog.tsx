import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForkRef } from '@mui/material/utils';
import { ZoneName, isBuiltinZone } from '@cockatrice/sockatrice';

import { usePreference } from '@app/hooks';

import { useCanActFor } from '../../components/ui/CardVisualStateContext';
import { useGameReadOnly } from '../../components/ui/GameReadOnlyContext';
import { useGameDialogsContext } from '../../components/ui/GameDialogsContext';
import { useGameId } from '../../components/ui/GameIdContext';
import { useGameSelectionState } from '../../components/ui/GameSelectionContext';
import { usePendingTargetContext } from '../../components/ui/PendingTargetContext';
import { useKeyboardMove } from '../../components/ui/KeyboardMoveContext';
import { cardLabel } from '../../components/ui/SeatCard/cardLabel';
import { useCardFocus } from '../../components/ui/SeatCard/useCardFocus';
import { useActiveSeatDrag, useSeatDragSource, useSeatDropZone } from '../../components/ui/SeatDragContext';
import type { ZoneViewTarget } from '../../hooks/dialogs/gameDialogs.types';
import {
  SEAT_DROP_PRIORITY,
  seatZoneName,
  type SeatDragSource,
  type SeatDropPoint,
  type SeatDropTarget,
  type SeatZone,
} from '../../hooks/seatDropPlan';
import { makeCardKey } from '../../utils/CardRegistry/CardRegistryContext';
import { EMPTY_SELECTION } from '../../utils/selection';
import ZoneRevealPanel from './ZoneRevealPanel';
import ZoneViewPanel, { type ZoneViewCardScope } from './ZoneViewPanel';
import { useZoneViewDialog } from './useZoneViewDialog';
import { readShuffleOnClose } from '../shared/zoneViewPreferences';
import { isOrderedView, offersShuffleOnClose } from './zoneViewTarget';

export interface ZoneViewDialogProps {
  view: ZoneViewTarget;
  handleClose: (shuffleOnClose?: boolean) => void;
}

const SEAT_ZONE: Partial<Record<string, SeatZone>> = {
  [ZoneName.DECK]: 'library',
  [ZoneName.GRAVE]: 'graveyard',
  [ZoneName.EXILE]: 'exile',
  [ZoneName.HAND]: 'hand',
  [ZoneName.SIDEBOARD]: 'sideboard',
};

const CARD_MENU_KIND: Partial<Record<string, 'pile' | 'zoneView'>> = {
  [ZoneName.GRAVE]: 'pile',
  [ZoneName.EXILE]: 'pile',
  [ZoneName.DECK]: 'zoneView',
  [ZoneName.SIDEBOARD]: 'zoneView',
};

function ZoneViewDialog({ view, handleClose }: ZoneViewDialogProps) {
  const { t } = useTranslation();
  const readOnly = useGameReadOnly();
  const gameId = useGameId();
  const { playerId, zoneName } = view;
  const { cards, count, title, isLocal } = useZoneViewDialog(gameId, view);
  const ordered = isOrderedView(view);
  const seatZone = useMemo<SeatZone | undefined>(
    () => SEAT_ZONE[zoneName] ?? (isBuiltinZone(zoneName) ? undefined : { kind: 'custom', name: zoneName }),
    [zoneName],
  );

  const closeEmptyCardView = usePreference('closeEmptyCardView');
  const viewKey = `${view.numberCards ?? -1}:${view.isReversed ?? false}`;
  const shown = useRef({ viewKey, count: cards.length });
  useEffect(() => {
    const previous = shown.current;
    shown.current = { viewKey, count: cards.length };
    if (closeEmptyCardView && previous.viewKey === viewKey && previous.count > 0 && cards.length === 0) {
      handleClose(offersShuffleOnClose(view) && readShuffleOnClose());
    }
  }, [cards.length, closeEmptyCardView, handleClose, view, viewKey]);

  const canActFor = useCanActFor();
  const viewId = `zone-view-${playerId}-${zoneName}`;
  const startDrag = useSeatDragSource(viewId, {
    seatPlayerId: playerId,
    zone: seatZone ?? 'library',
    canMoveFor: canActFor,
    disabled: readOnly || !isLocal || seatZone == null,
  });
  const onCardPointerDown = !readOnly && isLocal && seatZone != null
    ? (e: React.PointerEvent<HTMLElement>, card: { id: string }) => startDrag(e, [card])
    : undefined;

  const activeDrag = useActiveSeatDrag();
  const draggingCardIds = activeDrag?.seatPlayerId === playerId && seatZoneName(activeDrag.zone) === zoneName
    ? new Set(activeDrag.cards.map((c) => c.id))
    : undefined;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const resolveDrop = ({ pointer }: SeatDropPoint, source: SeatDragSource): SeatDropTarget | null => {
    switch (seatZone) {
      case 'hand':
        return source.zone === 'hand' ? null : { zone: 'hand', index: cards.length };
      case 'graveyard':
      case 'exile':
      case 'sideboard':
        return { zone: seatZone };
      case 'library':
        if (!ordered) {
          return { zone: 'library' };
        }
        break;
      default:
        return null;
    }
    let slot = 0;
    let best = Infinity;
    panelRef.current?.querySelectorAll<HTMLElement>('[data-card][data-card-id]').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = (pointer.x - cx) ** 2 + (pointer.y - cy) ** 2;
      if (dist < best) {
        best = dist;
        slot = pointer.x > cx ? i + 1 : i;
      }
    });
    const base = view.isReversed ? count - cards.length : 0;
    return { zone: 'library', position: Math.max(0, Math.min(count, base + slot)) };
  };
  const dropRef = useSeatDropZone(
    viewId,
    { seatPlayerId: playerId, priority: dropPriority(view), resolve: resolveDrop },
    readOnly || seatZone == null,
  );
  const panelDropRef = useForkRef(panelRef, dropRef);

  const { selectedIds, setSelectedIds } = useZoneViewSelection(playerId, zoneName, cards);

  const requestKeyboardMove = useKeyboardMove();
  const onCardMove = !readOnly && isLocal && seatZone != null && requestKeyboardMove && canActFor(playerId)
    ? (card: { id: string; name: string }) => {
      const moved = selectedIds.has(card.id) ? cards.filter((c) => selectedIds.has(c.id)) : [card];
      requestKeyboardMove({
        source: { kind: 'seat', seatPlayerId: playerId, zone: seatZone, cards: moved.map((c) => ({ id: c.id })) },
        name: card.name,
      });
    }
    : undefined;

  const { openSeatCardMenu } = useGameDialogsContext();
  const { pending, pickArrowAt, cancel: cancelPick } = usePendingTargetContext();

  const { cardProps: orderedCardProps } = useCardFocus<(typeof cards)[number]>({
    zone: ZoneName.DECK,
    cards,
    orientation: 'horizontal',
    ownerOf: () => playerId,
    labelOf: (card) => cardLabel(t, { name: card.name }),
    previewOf: (card) => ({ name: card.name, scryfallId: card.scryfallId }),
    selectedIds,
    onSelectIds: setSelectedIds,
    onActivate: readOnly ? undefined : (_card, element) => pickArrowAt(element),
    onMove: onCardMove,
    onOpenMenu: () => undefined,
  });
  const cardMenuKind = typeof seatZone === 'object' ? 'zoneView' : CARD_MENU_KIND[zoneName];
  const onCardContextMenu = !readOnly && cardMenuKind
    ? (at: { x: number; y: number }, card: { id: string; name: string }, scope: ZoneViewCardScope) => {
      openSeatCardMenu({
        kind: cardMenuKind,
        playerId,
        zone: zoneName,
        cardId: card.id,
        cardName: card.name,
        x: at.x,
        y: at.y,
        viewCardIds: scope.shownIds,
        columnCardIds: scope.columnIds,
      });
    }
    : undefined;

  if (ordered) {
    return (
      <ZoneRevealPanel
        title={title}
        cards={cards}
        labels={cards.map((c) => {
          const libraryPos = Number(c.id);
          if (!Number.isFinite(libraryPos)) {
            return '';
          }
          if (libraryPos <= 0) {
            return t('ZoneView.position.top');
          }
          if (libraryPos >= count - 1) {
            return t('ZoneView.position.bottom');
          }
          return String(libraryPos);
        })}
        onCardPointerDown={onCardPointerDown}
        dropRef={panelDropRef}
        draggingCardIds={draggingCardIds}
        cardInteraction={orderedCardProps}
        onClose={() => handleClose(false)}
      />
    );
  }

  return (
    <ZoneViewPanel
      title={title}
      library={cards}
      showShuffleOnClose={!readOnly && offersShuffleOnClose(view)}
      onClose={handleClose}
      onCardPointerDown={onCardPointerDown}
      onCardContextMenu={onCardContextMenu}
      onCardActivate={readOnly ? undefined : (_card, element) => pickArrowAt(element)}
      onCardMove={onCardMove}
      onEscapeCancel={() => {
        if (!pending) {
          return false;
        }
        cancelPick();
        return true;
      }}
      dropRef={panelDropRef}
      draggingCardIds={draggingCardIds}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      cardOwner={{ playerId, zone: zoneName }}
    />
  );
}

function dropPriority(view: ZoneViewTarget): number {
  switch (view.zoneName) {
    case ZoneName.DECK:
      return isOrderedView(view) ? SEAT_DROP_PRIORITY.revealDialog : SEAT_DROP_PRIORITY.librarySearchDialog;
    case ZoneName.SIDEBOARD:
      return SEAT_DROP_PRIORITY.sideboardDialog;
    default:
      return SEAT_DROP_PRIORITY.pileViewDialog;
  }
}

function useZoneViewSelection(playerId: number, zoneName: string, cards: readonly { id: string }[]) {
  const game = useGameSelectionState();
  const [localKeys, setLocalKeys] = useState<ReadonlySet<string>>(EMPTY_SELECTION);
  const selectedCardKeys = game?.selectedCardKeys ?? localKeys;
  const setSelectedCardKeys = game?.setSelectedCardKeys ?? setLocalKeys;

  const keyOf = useCallback((id: string) => makeCardKey(playerId, zoneName, Number(id)), [playerId, zoneName]);
  const selectedIds = useMemo(
    () => new Set(cards.filter((c) => selectedCardKeys.has(keyOf(c.id))).map((c) => c.id)),
    [cards, selectedCardKeys, keyOf],
  );
  const setSelectedIds = useCallback(
    (ids: ReadonlySet<string>) => {
      setSelectedCardKeys(ids.size === 0 ? EMPTY_SELECTION : new Set([...ids].map(keyOf)));
    },
    [setSelectedCardKeys, keyOf],
  );

  const shownKeys = useRef<string[]>([]);
  shownKeys.current = cards.map((c) => keyOf(c.id));
  useEffect(
    () => () => {
      const shown = new Set(shownKeys.current);
      setSelectedCardKeys((prev) => {
        if (![...prev].some((key) => shown.has(key))) {
          return prev;
        }
        const kept = new Set([...prev].filter((key) => !shown.has(key)));
        return kept.size === 0 ? EMPTY_SELECTION : kept;
      });
    },
    [setSelectedCardKeys],
  );

  return { selectedIds, setSelectedIds };
}

export default ZoneViewDialog;
