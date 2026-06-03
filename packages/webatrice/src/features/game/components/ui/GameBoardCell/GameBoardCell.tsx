import { memo, useMemo } from 'react';

import { cx } from '@app/utils';

import { BoardCell } from '../../../hooks/useGameBoardLayout';
import { BoardCellProvider } from '../BoardCellContext';
import HandZone from '../HandZone/HandZone';
import PlayerBoard from '../PlayerBoard/PlayerBoard';

import './GameBoardCell.css';

export interface GameBoardCellProps {
  cell: BoardCell;
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
  onPlayerContextMenu,
  onPlayerClick,
  onHandContextMenu,
}: GameBoardCellProps) {
  // The seat identity PlayerBoard's subtree reads from BoardCellContext.
  // Memoized on the primitives so the value is stable across re-renders that
  // don't change this seat.
  const cellInfo = useMemo(
    () => ({ playerId: cell.playerId, mirrored: cell.mirrored, isLocal: cell.isLocal }),
    [cell.playerId, cell.mirrored, cell.isLocal],
  );

  return (
    <div
      className={cx('game__board-cell', { 'game__board-cell--mirrored': cell.mirrored })}
      style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
    >
      <BoardCellProvider value={cellInfo}>
        <PlayerBoard
          onPlayerContextMenu={cell.canAct ? onPlayerContextMenu : undefined}
          onPlayerClick={onPlayerClick}
        />
      </BoardCellProvider>
      {/* HandZone sits outside the cell provider: the bottom-bar hand (rendered
          by Game) has no cell, so HandZone reads its seat from a prop either way. */}
      {cell.showHand && (
        <HandZone
          playerId={cell.playerId}
          onHandContextMenu={cell.isLocal ? onHandContextMenu : undefined}
        />
      )}
    </div>
  );
}

export default memo(GameBoardCell);
