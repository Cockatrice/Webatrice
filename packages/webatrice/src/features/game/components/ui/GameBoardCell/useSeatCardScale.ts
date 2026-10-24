import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';

import { battlefieldSlots } from '../../battlefield/Battlefield/battlefieldSlots';
import { useCardScale } from '../CardScaleContext';
import type { BattlefieldCardViewModel } from '../PlayerBoard/playerBoard.types';
import { seatCardScale } from '../seatScale';

export function useSeatCardScale(
  cellRef: RefObject<HTMLElement | null>,
  cards: readonly BattlefieldCardViewModel[],
  playerId: number,
  verticalHand: boolean,
): number {
  const { scale: heightScale } = useCardScale();
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = cellRef.current;
    if (!el) {
      return undefined;
    }
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [cellRef]);
  const slots = useMemo(() => battlefieldSlots(cards, playerId, false).slots, [cards, playerId]);
  return useMemo(
    () => seatCardScale({ seatWidth: width, heightScale, slots, verticalHand }),
    [width, heightScale, slots, verticalHand],
  );
}
