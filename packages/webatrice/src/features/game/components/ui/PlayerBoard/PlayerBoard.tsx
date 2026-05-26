import { cx } from '@app/utils';

import Battlefield from '../../battlefield/Battlefield/Battlefield';
import PlayerInfoPanel from '../../right-sidebar/PlayerInfoPanel/PlayerInfoPanel';
import StackColumn from '../StackColumn/StackColumn';

import './PlayerBoard.css';

export interface PlayerBoardProps {
  gameId: number;
  playerId: number;
  mirrored?: boolean;
  canAct?: boolean;
  canEditCounters?: boolean;
  arrowSourceKey?: string | null;
  onPlayerContextMenu?: (event: React.MouseEvent) => void;
}

function PlayerBoard({
  gameId,
  playerId,
  mirrored = false,
  canAct = false,
  canEditCounters = false,
  arrowSourceKey = null,
  onPlayerContextMenu,
}: PlayerBoardProps) {
  return (
    <div
      className={cx('player-board', { 'player-board--mirrored': mirrored })}
      data-testid={`player-board-${playerId}`}
    >
      <PlayerInfoPanel
        gameId={gameId}
        playerId={playerId}
        canEdit={canEditCounters}
        onContextMenu={onPlayerContextMenu}
      />
      <StackColumn
        gameId={gameId}
        playerId={playerId}
        mirrored={mirrored}
        canAct={canAct}
        arrowSourceKey={arrowSourceKey}
      />
      <Battlefield
        gameId={gameId}
        playerId={playerId}
        mirrored={mirrored}
        canAct={canAct}
        arrowSourceKey={arrowSourceKey}
      />
    </div>
  );
}

export default PlayerBoard;
