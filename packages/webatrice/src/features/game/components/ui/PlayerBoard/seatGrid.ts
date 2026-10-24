import type { CSSProperties } from 'react';

import { CARD_HEIGHT, CARD_WIDTH } from '../SeatCard/cardSize';
import { HAND_ROW_CARD_RATIO, HAND_ROW_PAD_PX } from '../seatFit';
import { INFO_COLUMN_MIN_PX, INFO_COLUMN_PAD_PX, STACK_COLUMN_PAD_PX, STACK_COLUMN_RATIO, VERTICAL_HAND_RATIO } from '../seatScale';

type Placement = Pick<CSSProperties, 'gridColumn' | 'gridRow'>;

export interface SeatGrid {
  template: Pick<CSSProperties, 'gridTemplateColumns' | 'gridTemplateRows'>;
  info: Placement;
  hand: Placement;
  stack: Placement;
  battlefield: Placement;
}

const INFO_COLUMN = `max(calc(${CARD_HEIGHT} + ${INFO_COLUMN_PAD_PX}px), ${INFO_COLUMN_MIN_PX}px)`;
const STACK_COLUMN = `calc((${CARD_WIDTH} + ${STACK_COLUMN_PAD_PX}px) * ${STACK_COLUMN_RATIO})`;
const VERTICAL_HAND_COLUMN = `calc(${CARD_WIDTH} * ${VERTICAL_HAND_RATIO})`;
const HAND_ROW = `calc(${CARD_HEIGHT} * ${HAND_ROW_CARD_RATIO} + ${HAND_ROW_PAD_PX}px)`;

export function seatGrid({
  horizontalHand,
  handOnTop,
  inlineHand,
}: { horizontalHand: boolean; handOnTop: boolean; inlineHand: boolean }): SeatGrid {
  if (!inlineHand) {
    return {
      template: {
        gridTemplateColumns: `${INFO_COLUMN} ${STACK_COLUMN} 1fr`,
        gridTemplateRows: '1fr',
      },
      info: { gridColumn: 1, gridRow: 1 },
      hand: {},
      stack: { gridColumn: 2, gridRow: 1 },
      battlefield: { gridColumn: 3, gridRow: 1 },
    };
  }
  if (!horizontalHand) {
    return {
      template: {
        gridTemplateColumns: `${INFO_COLUMN} ${VERTICAL_HAND_COLUMN} ${STACK_COLUMN} 1fr`,
        gridTemplateRows: '1fr',
      },
      info: { gridColumn: 1, gridRow: 1 },
      hand: { gridColumn: 2, gridRow: 1 },
      stack: { gridColumn: 3, gridRow: 1 },
      battlefield: { gridColumn: 4, gridRow: 1 },
    };
  }
  const playRow = handOnTop ? 2 : 1;
  return {
    template: {
      gridTemplateColumns: `${INFO_COLUMN} ${STACK_COLUMN} 1fr`,
      gridTemplateRows: handOnTop ? `${HAND_ROW} 1fr` : `1fr ${HAND_ROW}`,
    },
    info: { gridColumn: 1, gridRow: '1 / -1' },
    hand: { gridColumn: '2 / 4', gridRow: handOnTop ? 1 : 2 },
    stack: { gridColumn: 2, gridRow: playRow },
    battlefield: { gridColumn: 3, gridRow: playRow },
  };
}
