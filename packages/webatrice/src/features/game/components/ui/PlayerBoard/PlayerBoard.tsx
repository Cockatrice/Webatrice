import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
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
  onCardHover?: (card: ServerInfo_Card) => void;
  onCardClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardContextMenu?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onZoneClick?: (playerId: number, zoneName: string) => void;
  onZoneContextMenu?: (playerId: number, zoneName: string, event: React.MouseEvent) => void;
  onPlayerContextMenu?: (event: React.MouseEvent) => void;
}

function PlayerBoard({
  gameId,
  playerId,
  mirrored = false,
  canAct = false,
  canEditCounters = false,
  arrowSourceKey = null,
  onCardHover,
  onCardClick,
  onCardContextMenu,
  onCardDoubleClick,
  onZoneClick,
  onZoneContextMenu,
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
        onCardHover={onCardHover}
        onZoneClick={onZoneClick}
        onZoneContextMenu={onZoneContextMenu}
      />
      <StackColumn
        gameId={gameId}
        playerId={playerId}
        mirrored={mirrored}
        onCardHover={onCardHover}
      />
      <Battlefield
        gameId={gameId}
        playerId={playerId}
        mirrored={mirrored}
        canAct={canAct}
        arrowSourceKey={arrowSourceKey}
        onCardHover={onCardHover}
        onCardClick={onCardClick}
        onCardContextMenu={onCardContextMenu}
        onCardDoubleClick={onCardDoubleClick}
      />
    </div>
  );
}

export default PlayerBoard;
