
import { ZoneName } from '@cockatrice/sockatrice';

import {
  resolveCardTableRow,
  playedCardFields,
  tableRowToGridY,
  type PlayedCardMeta,
} from '../../battlefield/Battlefield/cardPlacement';
import type { PlayerZoneCommands, SeatMoveCard, SeatMoveDestination } from './playerBoard.types';

export interface TableMoveMeta extends PlayedCardMeta {
  typeLine: string;
  tableRow?: number;
}

export function tableMove(cardId: number, meta: TableMoveMeta | undefined): { card: SeatMoveCard; to: SeatMoveDestination } {
  const fields = playedCardFields(meta, false);
  const tableRow = resolveCardTableRow(meta);
  return {
    card: fields.pt || fields.tapped ? { id: cardId, ...fields } : cardId,
    to: { zone: ZoneName.TABLE, index: 'end', row: tableRowToGridY(tableRow) },
  };
}

export function moveSelectedCards(
  moveCards: PlayerZoneCommands['moveCards'],
  from: string,
  cards: readonly { id: string; name: string }[],
  to: SeatMoveDestination,
  cardMeta: (name: string) => TableMoveMeta | undefined,
): void {
  const targets = cards.filter((c) => Number.isFinite(Number(c.id)));
  if (targets.length === 0) {
    return;
  }
  if (to.zone === ZoneName.TABLE && from !== ZoneName.TABLE) {
    for (const c of targets) {
      const move = tableMove(Number(c.id), cardMeta(c.name));
      moveCards(from, [move.card], move.to);
    }
    return;
  }
  moveCards(from, targets.map((c) => Number(c.id)), {
    reversed: false,
    ...to,
    ...(to.zone === ZoneName.DECK && targets.length > 1 && { shuffleMoved: true }),
  });
}
