import { cx } from '@app/utils';

import Battlefield from '../../battlefield/Battlefield/Battlefield';
import PlayerInfoPanel from '../../right-sidebar/PlayerInfoPanel/PlayerInfoPanel';
import StackColumn from '../StackColumn/StackColumn';
import { EMPTY_SELECTION } from '../../../utils/selection';

import './PlayerBoard.css';

export interface PlayerBoardProps {
  gameId: number;
  playerId: number;
  mirrored?: boolean;
  isLocal?: boolean;
  canAct?: boolean;
  canEditCounters?: boolean;
  arrowSourceKey?: string | null;
  arrowTargetKey?: string | null;
  selectedCardKeys?: ReadonlySet<string>;
  onPlayerContextMenu?: (event: React.MouseEvent) => void;
  onPlayerClick?: (playerId: number) => boolean;
}

function PlayerBoard({
  gameId,
  playerId,
  mirrored = false,
  isLocal = false,
  canAct = false,
  canEditCounters = false,
  arrowSourceKey = null,
  arrowTargetKey = null,
  selectedCardKeys = EMPTY_SELECTION,
  onPlayerContextMenu,
  onPlayerClick,
}: PlayerBoardProps) {
  return (
    <div
      className={cx('player-board', { 'player-board--mirrored': mirrored })}
      data-testid={`player-board-${playerId}`}
      data-local-player={isLocal ? '' : undefined}
    >
      <PlayerInfoPanel
        gameId={gameId}
        playerId={playerId}
        canEdit={canEditCounters}
        arrowTargetKey={arrowTargetKey}
        onContextMenu={onPlayerContextMenu}
        onPlayerClick={onPlayerClick}
      />
      <StackColumn
        gameId={gameId}
        playerId={playerId}
        mirrored={mirrored}
        canAct={canAct}
        arrowSourceKey={arrowSourceKey}
        arrowTargetKey={arrowTargetKey}
        selectedCardKeys={selectedCardKeys}
      />
      <Battlefield
        gameId={gameId}
        playerId={playerId}
        mirrored={mirrored}
        canAct={canAct}
        arrowSourceKey={arrowSourceKey}
        arrowTargetKey={arrowTargetKey}
        selectedCardKeys={selectedCardKeys}
      />
    </div>
  );
}

export default PlayerBoard;
