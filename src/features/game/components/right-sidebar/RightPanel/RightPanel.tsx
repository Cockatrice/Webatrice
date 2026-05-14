import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import CardPreview from '../CardPreview/CardPreview';
import GameLog from '../GameLog/GameLog';
import PlayerList from '../PlayerList/PlayerList';
import TurnControls from '../TurnControls/TurnControls';

import './RightPanel.css';

export interface RightPanelProps {
  gameId: number | undefined;
  hoveredCard: ServerInfo_Card | null | undefined;
  onRequestRollDie: () => void;
  onRequestConcede: () => void;
  onRequestUnconcede: () => void;
  onRequestGameInfo: () => void;
  onToggleRotate90: () => void;
  isRotated: boolean;
}

function RightPanel({
  gameId,
  hoveredCard,
  onRequestRollDie,
  onRequestConcede,
  onRequestUnconcede,
  onRequestGameInfo,
  onToggleRotate90,
  isRotated,
}: RightPanelProps) {
  const isSpectator = useAppSelector((state) =>
    gameId != null ? games.Selectors.isSpectator(state, gameId) : false,
  );

  return (
    <aside className="right-panel" data-testid="right-panel">
      {isSpectator && (
        <div className="right-panel__spectating" data-testid="spectating-tag">
          Spectating
        </div>
      )}
      <CardPreview card={hoveredCard} />
      <PlayerList gameId={gameId} />
      <GameLog gameId={gameId} />
      <TurnControls
        gameId={gameId}
        onRequestRollDie={onRequestRollDie}
        onRequestConcede={onRequestConcede}
        onRequestUnconcede={onRequestUnconcede}
        onRequestGameInfo={onRequestGameInfo}
        onToggleRotate90={onToggleRotate90}
        isRotated={isRotated}
      />
    </aside>
  );
}

export default RightPanel;
