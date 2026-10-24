import { useCallback, useMemo } from 'react';

import { SEAT_WIRE_ZONE, type SeatSelectionZone } from '../../../hooks/useSeatSelection';
import { useCardFocus, type CardFocusOptions } from '../SeatCard/useCardFocus';
import type { PlayerCardViewModel } from './playerBoard.types';
import { usePlayerSeatContext } from './PlayerSeatContext';

const NO_IDS: ReadonlySet<string> = new Set();

export type SeatCardFocusOptions<C extends PlayerCardViewModel> =
  Pick<CardFocusOptions<C>, 'cards' | 'orientation' | 'lines' | 'labelOf' | 'previewOf' | 'onKeyboardFocus'>
  & { ownerOf?: CardFocusOptions<C>['ownerOf'] };

export function useSeatCardFocus<C extends PlayerCardViewModel>(zone: SeatSelectionZone, options: SeatCardFocusOptions<C>) {
  const { playerId, selection, setSelection, activateCard, openCardMenuAt, moveWithKeyboard } = usePlayerSeatContext();
  const onSelectIds = useCallback((ids: Set<string>) => setSelection({ zone, ids }), [setSelection, zone]);
  const selectedIds = useMemo(() => (selection?.zone === zone ? selection.ids : NO_IDS), [selection, zone]);
  return useCardFocus<C>({
    zone: SEAT_WIRE_ZONE[zone],
    ownerOf: () => playerId,
    selectedIds,
    onSelectIds,
    onActivate: (card, element) => activateCard(zone, card, element),
    onOpenMenu: (card, rect) => openCardMenuAt(zone, card, rect),
    onMove: (card) => moveWithKeyboard(zone, card),
    ...options,
  });
}
