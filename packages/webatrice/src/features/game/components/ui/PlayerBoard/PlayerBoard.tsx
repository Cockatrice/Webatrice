import { memo } from 'react';

import { cx } from '@app/utils';

import Battlefield from '../../battlefield/Battlefield/Battlefield';
import PlayerInfoPanel from '../../right-sidebar/PlayerInfoPanel/PlayerInfoPanel';
import StackColumn from '../StackColumn/StackColumn';
import { useBoardCell } from '../BoardCellContext';

import './PlayerBoard.css';

export interface PlayerBoardProps {
  onPlayerContextMenu?: (event: React.MouseEvent) => void;
  onPlayerClick?: (playerId: number) => boolean;
}

function PlayerBoard({
  onPlayerContextMenu,
  onPlayerClick,
}: PlayerBoardProps) {
  const { playerId, mirrored, isLocal } = useBoardCell();
  return (
    <div
      className={cx('player-board', { 'player-board--mirrored': mirrored })}
      data-testid={`player-board-${playerId}`}
      data-local-player={isLocal ? '' : undefined}
    >
      <PlayerInfoPanel
        onContextMenu={onPlayerContextMenu}
        onPlayerClick={onPlayerClick}
      />
      <StackColumn />
      <Battlefield />
    </div>
  );
}

export default memo(PlayerBoard);
