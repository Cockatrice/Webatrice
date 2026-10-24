import { createElement, useRef, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoneName } from '@cockatrice/sockatrice';
import { isContextMenuKey, type MenuAnchor } from '@app/components';

import { ContextMenuPopup, contextMenuAnchor, type ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import type { PlayerCardViewModel } from '../PlayerBoard/playerBoard.types';
import { usePlayerSeatContext } from '../PlayerBoard/PlayerSeatContext';
import { useGameReadOnly } from '../GameReadOnlyContext';
import { useGameDialogsContext } from '../GameDialogsContext';

export type PileName = 'library' | 'graveyard' | 'exile';

export interface SeatPile {
  name: PileName;
  ref: Ref<HTMLDivElement>;
  zoneLabel: string;
  label: string;
  count: number;
  topCard: { name: string; scryfallId: string } | null;
  pileProps: HTMLAttributes<HTMLDivElement>;
  onPointerDown: ((e: React.PointerEvent<HTMLDivElement>) => void) | undefined;
  arrowAnchorZone: string | undefined;
  popup: ReactNode;
}

const LIBRARY_TOP_DRAG_PAYLOAD: PlayerCardViewModel = {
  id: '__library_top__',
  name: '',
  scryfallId: '',
};

const NO_MODIFIERS = (event: KeyboardEvent) => !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

function usePile(pile: PileName, count: number, top: { name: string } | null | undefined, items?: readonly ContextMenuItem[]) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const zone = { library: t('ZoneStack.library'), graveyard: t('ZoneStack.graveyard'), exile: t('ZoneStack.exile') }[pile];
  const label = top
    ? t('ZoneStack.pileWithTop', { zone, count, top: top.name })
    : t('ZoneStack.pile', { zone, count });
  if (!items) {
    return { zone, label, pileProps: { role: 'img', 'aria-label': label } satisfies HTMLAttributes<HTMLDivElement>, popup: null };
  }
  const pileProps: HTMLAttributes<HTMLDivElement> = {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    'aria-haspopup': 'menu',
    'aria-expanded': anchor != null,
    onContextMenu: (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      triggerRef.current = event.currentTarget;
      setAnchor(contextMenuAnchor(event));
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (isContextMenuKey(event) || ((event.key === 'Enter' || event.key === ' ') && NO_MODIFIERS(event))) {
        event.preventDefault();
        event.stopPropagation();
        triggerRef.current = event.currentTarget;
        setAnchor({ rect: event.currentTarget.getBoundingClientRect(), placement: 'below' });
      }
    },
  };
  const popup = anchor
    ? createElement(ContextMenuPopup, { items, anchor, label: zone, onClose: () => setAnchor(null), triggerRef })
    : null;
  return { zone, label, pileProps, popup };
}

export function useSeatPiles(): Record<PileName, SeatPile> {
  const readOnly = useGameReadOnly();
  const { openZoneView } = useGameDialogsContext();
  const {
    seatDrag,
    deckTopCard,
    displayedDeckCount,
    displayedExileCount,
    displayedGraveyardCount,
    exileDisplayList,
    exileMenuItemsOpponent,
    exileMenuItemsSelf,
    exileZoneRef,
    graveDisplayList,
    graveMenuItemsOpponent,
    graveMenuItemsSelf,
    graveyardZoneRef,
    isSelf,
    libraryMenuItems,
    libraryZoneRef,
    playerId,
    startPileDrag,
  } = usePlayerSeatContext();
  const graveyardTopIdx = graveDisplayList.length - 1 - (seatDrag?.zone === 'graveyard' ? 1 : 0);
  const exileTopIdx = exileDisplayList.length - 1 - (seatDrag?.zone === 'exile' ? 1 : 0);
  const graveyardTop = graveyardTopIdx >= 0 ? graveDisplayList[graveyardTopIdx] : null;
  const exileTop = exileTopIdx >= 0 ? exileDisplayList[exileTopIdx] : null;

  const library = usePile('library', displayedDeckCount, deckTopCard, !readOnly && isSelf ? libraryMenuItems : undefined);
  const graveyard = usePile('graveyard', displayedGraveyardCount, graveyardTop,
    readOnly ? undefined : isSelf ? graveMenuItemsSelf : graveMenuItemsOpponent);
  const exile = usePile('exile', displayedExileCount, exileTop,
    readOnly ? undefined : isSelf ? exileMenuItemsSelf : exileMenuItemsOpponent);
  const replayViewProps = (zoneName: string): HTMLAttributes<HTMLDivElement> => ({
    'data-replay-zone-view': zoneName,
    role: 'button',
    tabIndex: 0,
    onClick: () => openZoneView({ playerId, zoneName }),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' && NO_MODIFIERS(event)) {
        event.preventDefault();
        event.stopPropagation();
        openZoneView({ playerId, zoneName });
      }
    },
  } as HTMLAttributes<HTMLDivElement>);
  const canDrag = !readOnly && isSelf;

  return {
    library: {
      name: 'library',
      ref: libraryZoneRef,
      zoneLabel: library.zone,
      label: library.label,
      count: displayedDeckCount,
      topCard: deckTopCard ?? null,
      pileProps: library.pileProps,
      onPointerDown: canDrag && displayedDeckCount > 0
        ? (e) => startPileDrag(e, LIBRARY_TOP_DRAG_PAYLOAD, 'library')
        : undefined,
      arrowAnchorZone: undefined,
      popup: library.popup,
    },
    graveyard: {
      name: 'graveyard',
      ref: graveyardZoneRef,
      zoneLabel: graveyard.zone,
      label: graveyard.label,
      count: displayedGraveyardCount,
      topCard: graveyardTop,
      pileProps: { ...graveyard.pileProps, ...(readOnly && replayViewProps(ZoneName.GRAVE)) },
      onPointerDown: canDrag && graveDisplayList.length > 0
        ? (e) => startPileDrag(e, graveDisplayList[graveDisplayList.length - 1], 'graveyard')
        : undefined,
      arrowAnchorZone: ZoneName.GRAVE,
      popup: graveyard.popup,
    },
    exile: {
      name: 'exile',
      ref: exileZoneRef,
      zoneLabel: exile.zone,
      label: exile.label,
      count: displayedExileCount,
      topCard: exileTop,
      pileProps: { ...exile.pileProps, ...(readOnly && replayViewProps(ZoneName.EXILE)) },
      onPointerDown: canDrag && exileDisplayList.length > 0
        ? (e) => startPileDrag(e, exileDisplayList[exileDisplayList.length - 1], 'exile')
        : undefined,
      arrowAnchorZone: ZoneName.EXILE,
      popup: exile.popup,
    },
  };
}
