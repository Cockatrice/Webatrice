import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import BattlefieldRow from './BattlefieldRow';
import BattlefieldStackColumn from './BattlefieldStackColumn';
import { useBattlefield } from './useBattlefield';

import './Battlefield.css';

export interface BattlefieldProps {
  gameId: number;
  playerId: number;
  mirrored?: boolean;
  canAct?: boolean;
  arrowSourceKey?: string | null;
  onCardHover?: (card: ServerInfo_Card) => void;
  onCardClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardContextMenu?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
}

function Battlefield({
  gameId,
  playerId,
  mirrored = false,
  canAct = false,
  arrowSourceKey = null,
  onCardHover,
  onCardClick,
  onCardContextMenu,
  onCardDoubleClick,
}: BattlefieldProps) {
  const { rows, stackColumnsByRow, rowOrder, attachmentsByParent } = useBattlefield({
    gameId,
    playerId,
    mirrored,
  });

  return (
    <div className="battlefield" data-testid="battlefield">
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
                onCardHover={onCardHover}
                onCardClick={onCardClick}
                onCardContextMenu={onCardContextMenu}
                onCardDoubleClick={onCardDoubleClick}
              />
            );
          })}
        </BattlefieldRow>
      ))}
    </div>
  );
}

export default Battlefield;
