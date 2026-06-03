import { memo } from 'react';

import BattlefieldRow from './BattlefieldRow';
import BattlefieldStackColumn from './BattlefieldStackColumn';
import { useBattlefield } from './useBattlefield';
import { EMPTY_SELECTION } from '../../../utils/selection';

import './Battlefield.css';

export interface BattlefieldProps {
  gameId: number;
  playerId: number;
  mirrored?: boolean;
  canAct?: boolean;
  arrowSourceKey?: string | null;
  arrowTargetKey?: string | null;
  selectedCardKeys?: ReadonlySet<string>;
}

function Battlefield({
  gameId,
  playerId,
  mirrored = false,
  canAct = false,
  arrowSourceKey = null,
  arrowTargetKey = null,
  selectedCardKeys = EMPTY_SELECTION,
}: BattlefieldProps) {
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
                draggable={canAct}
                ownerPlayerId={playerId}
                arrowSourceKey={arrowSourceKey}
                arrowTargetKey={arrowTargetKey}
                selectedCardKeys={selectedCardKeys}
              />
            );
          })}
        </BattlefieldRow>
      ))}
    </div>
  );
}

// Memoized so a card change on ONE player's board doesn't re-render the other players'
// boards (their props are unchanged). A board re-renders only when its own subscribed
// state changes; see useBattlefield for per-column reference stabilization within a board.
export default memo(Battlefield);
