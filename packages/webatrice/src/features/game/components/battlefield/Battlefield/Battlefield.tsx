import { memo } from 'react';

import BattlefieldRow from './BattlefieldRow';
import BattlefieldStackColumn from './BattlefieldStackColumn';
import { useBattlefield } from './useBattlefield';
import { useCanActFor } from '../../ui/CardVisualStateContext';
import { useGameIdRequired } from '../../ui/GameIdContext';
import { useBoardCell } from '../../ui/BoardCellContext';

import './Battlefield.css';

function Battlefield() {
  const { playerId, mirrored } = useBoardCell();
  const gameId = useGameIdRequired();
  const draggable = useCanActFor()(playerId);
  const { rows, stackColumnsByRow, rowOrder, attachmentsByParent } = useBattlefield({
    gameId,
    playerId,
    mirrored,
  });

  return (
    <div className="battlefield scrollable" data-testid="battlefield" data-zone-box-select="">
      {rowOrder.map((rowIdx) => (
        <BattlefieldRow
          key={rowIdx}
          playerId={playerId}
          row={rowIdx}
          rowCards={rows[rowIdx]}
        >
          {stackColumnsByRow[rowIdx].map((stackCards, colIdx) => {
            if (stackCards == null) {
              // Spacer for empty column; see .github/instructions/webatrice-game.instructions.md#battlefield-grid.
              return (
                <div
                  key={`empty-${rowIdx}-${colIdx}`}
                  className="battlefield__stack-placeholder"
                  data-testid="battlefield-stack-placeholder"
                  data-col={colIdx}
                  aria-hidden="true"
                />
              );
            }
            return (
              // Stable React key: leftmost card's id identifies the stack.
              <BattlefieldStackColumn
                key={stackCards[0].id}
                cards={stackCards}
                attachmentsByParent={attachmentsByParent}
                draggable={draggable}
                ownerPlayerId={playerId}
              />
            );
          })}
        </BattlefieldRow>
      ))}
    </div>
  );
}

export default memo(Battlefield);
