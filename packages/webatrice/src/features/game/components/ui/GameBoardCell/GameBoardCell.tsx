import { cx } from '@app/utils';

import { BoardCell } from '../../../hooks/useGameBoardLayout';
import HandZone from '../HandZone/HandZone';
import PlayerBoard from '../PlayerBoard/PlayerBoard';

import './GameBoardCell.css';

export interface GameBoardCellProps {
  cell: BoardCell;
  gameId: number;
  arrowSourceKey?: string | null;
  arrowTargetKey?: string | null;
  selectedCardKeys?: ReadonlySet<string>;
  onPlayerContextMenu?: (event: React.MouseEvent) => void;
  onPlayerClick?: (playerId: number) => boolean;
  onHandContextMenu?: (event: React.MouseEvent) => void;
}

/**
 * One seat in the adaptive board grid: a PlayerBoard placed at its computed
 * row/column, plus an inline HandZone when this seat's hand is visible
 * (`cell.showHand`). The hand stacks above a mirrored board and below an upright
 * one. The bottom hand bar (single-hand games) is rendered separately by Game.
 */
function GameBoardCell({
  cell,
  gameId,
  arrowSourceKey = null,
  arrowTargetKey = null,
  selectedCardKeys,
  onPlayerContextMenu,
  onPlayerClick,
  onHandContextMenu,
}: GameBoardCellProps) {
  return (
    <div
      className={cx('game__board-cell', { 'game__board-cell--mirrored': cell.mirrored })}
      style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
    >
      <PlayerBoard
        gameId={gameId}
        playerId={cell.playerId}
        mirrored={cell.mirrored}
        isLocal={cell.isLocal}
        canAct={cell.canAct}
        canEditCounters={cell.canAct}
        arrowSourceKey={arrowSourceKey}
        arrowTargetKey={arrowTargetKey}
        selectedCardKeys={selectedCardKeys}
        onPlayerContextMenu={cell.canAct ? onPlayerContextMenu : undefined}
        onPlayerClick={onPlayerClick}
      />
      {cell.showHand && (
        <HandZone
          gameId={gameId}
          playerId={cell.playerId}
          canAct={cell.canAct}
          arrowSourceKey={arrowSourceKey}
          arrowTargetKey={arrowTargetKey}
          selectedCardKeys={selectedCardKeys}
          onHandContextMenu={cell.isLocal ? onHandContextMenu : undefined}
        />
      )}
    </div>
  );
}

export default GameBoardCell;
