import { ZoneName } from '@cockatrice/sockatrice';
import { ReactNode, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { cx } from '@app/utils';

export interface BattlefieldRowProps {
  playerId: number;
  row: number;
  // Row's current cards (sorted by x, attachments already filtered out). The
  // drop handler reads these off `event.over.data.current` to compute an
  // insertion gridX via gridMath — see useGameDnd.handleDragEnd.
  rowCards: ServerInfo_Card[];
  children: ReactNode;
}

function BattlefieldRow({ playerId, row, rowCards, children }: BattlefieldRowProps) {
  const data = useMemo(
    () => ({
      targetPlayerId: playerId,
      targetZone: ZoneName.TABLE,
      row,
      rowCards,
    }),
    [playerId, row, rowCards],
  );
  const { setNodeRef, isOver } = useDroppable({
    id: `battlefield-${playerId}-${row}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className={cx('battlefield__row', { 'battlefield__row--drop-over': isOver })}
      data-row={row}
      data-testid={`battlefield-row-${row}`}
    >
      {children}
    </div>
  );
}

export default BattlefieldRow;
