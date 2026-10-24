import type { RefObject } from 'react';
import { useForkRef } from '@mui/material/utils';

import { SEAT_DROP_PRIORITY, type SeatDragSource, type FixedSeatZone } from '../../../hooks/seatDropPlan';
import type { SeatSelection, SeatSelectionApi } from '../../../hooks/useSeatSelection';
import { layoutVerticalPile, verticalPileDropIndex, type VerticalPileOptions } from '../VerticalPile/verticalPile';
import { useCanActFor } from '../CardVisualStateContext';
import { useActiveSeatDrag, useSeatDragSource, useSeatDropZone, type SeatDragStart } from '../SeatDragContext';
import type { BattlefieldCardViewModel, PlayerCardViewModel } from './playerBoard.types';

type HandCard = PlayerCardViewModel & Pick<BattlefieldCardViewModel, 'ownerPlayerId'>;
type DragSourceZone = FixedSeatZone;
/** A marquee selection is always within a single zone. */
type Selection = SeatSelection;
type ActiveSeatDrag = NonNullable<ReturnType<typeof useActiveSeatDrag>>;

export interface UseSeatDndArgs {
  seatId: number;
  seatDrag: ActiveSeatDrag | null;
  selection: SeatSelection | null;
  setSelection: SeatSelectionApi['setSelection'];
  resolveAttachPress: (card: HandCard) => boolean;
  printedPT: (cardName: string) => string | undefined;
  stackDisplayList: readonly PlayerCardViewModel[];
  handDisplayList: readonly PlayerCardViewModel[];
  horizontalHand: boolean;
  handRef: RefObject<HTMLDivElement | null>;
  stackRef: RefObject<HTMLDivElement | null>;
  libraryRef: RefObject<HTMLDivElement | null>;
  graveyardRef: RefObject<HTMLDivElement | null>;
  exileRef: RefObject<HTMLDivElement | null>;
  onCardClick?: (zone: Selection['zone'], card: HandCard, e: PointerEvent, selectionBefore: Selection | null) => void;
  CARD_W_PX: number;
  CARD_H_PX: number;
  stackPileOptions: VerticalPileOptions;
}

export function useSeatDnd({
  seatId,
  seatDrag,
  selection,
  setSelection,
  resolveAttachPress,
  printedPT,
  stackDisplayList,
  handDisplayList,
  horizontalHand,
  handRef,
  stackRef,
  libraryRef,
  graveyardRef,
  exileRef,
  onCardClick,
  CARD_W_PX,
  CARD_H_PX,
  stackPileOptions,
}: UseSeatDndArgs) {
  const withPrintedPT = (cards: readonly HandCard[], zone: DragSourceZone): readonly HandCard[] =>
    zone === 'battlefield'
      ? cards
      : cards.map((card) => {
        const pt = printedPT(card.name);
        return pt ? { ...card, printedPT: pt } : card;
      });

  const startPileDrag = (
    e: React.PointerEvent<HTMLElement>,
    card: HandCard,
    zone: Exclude<DragSourceZone, 'hand' | 'battlefield' | 'stack'>,
  ) => {
    seatDragSources[zone]?.(e, withPrintedPT([card], zone));
  };

  /** True if this specific card is currently part of an active drag.
   *  Only returns true after the pointer has moved past the threshold —
   *  a click that never becomes a drag doesn't hide its source. */
  const isDragging = (id: string, zone: DragSourceZone) =>
    seatDrag?.zone === zone && seatDrag.cards.some((c) => c.id === id);

  const releaseCardPress = (zone: DragSourceZone, card: HandCard, e: PointerEvent) => {
    const clickedCardId = card.id;
    const clickedCardIdNum = Number(clickedCardId);
    if (zone === 'battlefield' && Number.isFinite(clickedCardIdNum) && resolveAttachPress(card)) {
      return;
    }
    if (
      zone === 'hand' ||
      zone === 'battlefield' ||
      zone === 'stack'
    ) {
      // Ctrl (Windows/Linux) / ⌘ (Mac) adds to or toggles the
      // multi-selection instead of replacing it — matches
      // Cockatrice desktop's `Qt::ControlModifier` branch in
      // `AbstractCardItem::mousePressEvent` (line 294-295).
      //
      // Cockatrice technically allows the selection to span
      // multiple zones (drag filters back down to same-zone), but
      // our Selection shape is single-zoned (used to gate drag +
      // context-menu bulk actions), so Ctrl+Click in a DIFFERENT
      // zone replaces the selection with a new single-card set
      // rooted in the clicked zone. Same-zone Ctrl+Click toggles.
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && selection && selection.zone === zone) {
        const nextIds = new Set(selection.ids);
        if (nextIds.has(clickedCardId)) {
          nextIds.delete(clickedCardId);
        } else {
          nextIds.add(clickedCardId);
        }
        if (nextIds.size === 0) {
          setSelection(null);
        } else {
          setSelection({ zone, ids: nextIds });
        }
      } else {
        setSelection({
          zone,
          ids: new Set([clickedCardId]),
        });
      }
      onCardClick?.(zone, card, e, selection);
    }
  };

  const canActFor = useCanActFor();
  const handDragSource = useSeatDragSource(`seat-${seatId}-hand`, {
    seatPlayerId: seatId,
    zone: 'hand',
    canMoveFor: canActFor,
  });
  const stackDragSource = useSeatDragSource(`seat-${seatId}-stack`, {
    seatPlayerId: seatId,
    zone: 'stack',
    canMoveFor: canActFor,
  });
  const graveyardDragSource = useSeatDragSource(`seat-${seatId}-graveyard`, {
    seatPlayerId: seatId,
    zone: 'graveyard',
    canMoveFor: canActFor,
  });
  const exileDragSource = useSeatDragSource(`seat-${seatId}-exile`, {
    seatPlayerId: seatId,
    zone: 'exile',
    canMoveFor: canActFor,
  });
  const battlefieldDragSource = useSeatDragSource(`seat-${seatId}-battlefield`, {
    seatPlayerId: seatId,
    canMoveFor: canActFor,
    zone: 'battlefield',
  });
  const libraryDragSource = useSeatDragSource(`seat-${seatId}-library`, {
    seatPlayerId: seatId,
    zone: 'library',
    canMoveFor: canActFor,
  });
  const seatDragSources: Partial<Record<DragSourceZone, SeatDragStart>> = {
    battlefield: battlefieldDragSource,
    library: libraryDragSource,
    hand: handDragSource,
    stack: stackDragSource,
    graveyard: graveyardDragSource,
    exile: exileDragSource,
  };

  const movedGroup = (card: HandCard, zone: Selection['zone'], zoneCards: readonly HandCard[]): readonly HandCard[] | null => {
    if (!selection || selection.zone !== zone || !selection.ids.has(card.id)) {
      return null;
    }
    const ownerOf = (c: HandCard) => c.ownerPlayerId ?? seatId;
    return zoneCards.filter((c) => selection.ids.has(c.id) && ownerOf(c) === ownerOf(card));
  };

  const startSeatCardDrag = (
    e: React.PointerEvent<HTMLElement>,
    card: HandCard,
    zone: Selection['zone'],
    zoneCards: readonly HandCard[],
  ) => {
    const start = seatDragSources[zone];
    if (!start) {
      return;
    }
    const group = movedGroup(card, zone, zoneCards);
    if (group && selection) {
      start(e, withPrintedPT(group, zone), group.length === 1
        ? (up) => releaseCardPress(zone, card, up)
        : (up) => onCardClick?.(zone, card, up, selection));
    } else {
      start(e, withPrintedPT([card], zone), (up) => releaseCardPress(zone, card, up));
    }
  };

  const keyboardMoveSource = (card: HandCard, zone: Selection['zone'], zoneCards: readonly HandCard[]): SeatDragSource | null => {
    const cards = withPrintedPT(movedGroup(card, zone, zoneCards) ?? [card], zone);
    if (!cards.every((c) => canActFor(c.ownerPlayerId ?? seatId))) {
      return null;
    }
    return { kind: 'seat', seatPlayerId: seatId, zone, cards };
  };

  const stackDropRef = useSeatDropZone(`seat-${seatId}-stack`, {
    seatPlayerId: seatId,
    priority: SEAT_DROP_PRIORITY.stack,
    resolve: ({ pointer }, source) => {
      const stackEl = stackRef.current;
      if (!stackEl) {
        return null;
      }
      const rect = stackEl.getBoundingClientRect();
      const layoutCount = stackDisplayList.length - (source.zone === 'stack' ? source.cards.length : 0);
      const { positions } = layoutVerticalPile(layoutCount, rect.width, rect.height, CARD_W_PX, CARD_H_PX, stackPileOptions);
      const index = verticalPileDropIndex(positions.map((pos) => rect.top + pos.y), pointer.y, CARD_H_PX);
      return { zone: 'stack', index };
    },
  });
  const handDropRef = useSeatDropZone(`seat-${seatId}-hand`, {
    seatPlayerId: seatId,
    priority: SEAT_DROP_PRIORITY.hand,
    resolve: ({ pointer }, source) => {
      const dragged = new Set(source.zone === 'hand' ? source.cards.map((c) => c.id) : []);
      const rects: DOMRect[] = [];
      handRef.current?.querySelectorAll<HTMLElement>('[data-card][data-zone="hand"]').forEach((el) => {
        const id = el.dataset.cardId;
        if (id && !dragged.has(id)) {
          rects.push(el.getBoundingClientRect());
        }
      });
      const index = horizontalHand
        ? rects.filter((r) => pointer.x > r.left + r.width / 2).length
        : verticalPileDropIndex(rects.map((r) => r.top), pointer.y, CARD_H_PX);
      return { zone: 'hand', index, order: handDisplayList.map((c) => c.id) };
    },
  });
  const libraryDropRef = useSeatDropZone(`seat-${seatId}-library`, {
    seatPlayerId: seatId,
    priority: SEAT_DROP_PRIORITY.library,
    resolve: () => ({ zone: 'library' }),
  });
  const graveyardDropRef = useSeatDropZone(`seat-${seatId}-graveyard`, {
    seatPlayerId: seatId,
    priority: SEAT_DROP_PRIORITY.graveyard,
    resolve: () => ({ zone: 'graveyard' }),
  });
  const exileDropRef = useSeatDropZone(`seat-${seatId}-exile`, {
    seatPlayerId: seatId,
    priority: SEAT_DROP_PRIORITY.exile,
    resolve: () => ({ zone: 'exile' }),
  });
  const stackZoneRef = useForkRef(stackRef, stackDropRef);
  const handZoneRef = useForkRef(handRef, handDropRef);
  const libraryZoneRef = useForkRef(libraryRef, libraryDropRef);
  const graveyardZoneRef = useForkRef(graveyardRef, graveyardDropRef);
  const exileZoneRef = useForkRef(exileRef, exileDropRef);

  return {
    startPileDrag,
    isDragging,
    startSeatCardDrag,
    keyboardMoveSource,
    stackZoneRef,
    handZoneRef,
    libraryZoneRef,
    graveyardZoneRef,
    exileZoneRef,
  };
}
