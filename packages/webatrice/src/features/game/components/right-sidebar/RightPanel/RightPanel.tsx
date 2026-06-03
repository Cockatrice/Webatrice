import CardPreview from '../CardPreview/CardPreview';
import GameLog from '../GameLog/GameLog';
import PlayerList from '../PlayerList/PlayerList';
import TurnControls from '../TurnControls/TurnControls';
import { useLocalIdentity } from '../../../hooks/useLocalIdentity';

import './RightPanel.css';

function RightPanel() {
  const { isSpectator } = useLocalIdentity();

  return (
    <aside className="right-panel" data-testid="right-panel">
      {isSpectator && (
        <div className="right-panel__spectating" data-testid="spectating-tag">
          Spectating
        </div>
      )}
      <CardPreview />
      <PlayerList />
      <GameLog />
      <TurnControls />
    </aside>
  );
}

export default RightPanel;
