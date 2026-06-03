import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import { useGameDialogActions } from '../../ui/GameDialogActionsContext';
import { useGameId } from '../../ui/GameIdContext';
import { useTurnControls } from './useTurnControls';

import './TurnControls.css';

function TurnControls() {
  const gameId = useGameId();
  const { onRequestRollDie, onRequestConcede, onRequestUnconcede, onRequestGameInfo } =
    useGameDialogActions();
  const {
    isHost,
    isConceded,
    invertVerticalCoordinate,
    settingsReady,
    canPassTurn,
    canAdvancePhase,
    canLeave,
    canConcede,
    canUnconcede,
    canRoll,
    canKick,
    canRemoveArrows,
    hasLiveGame,
    opponents,
    kickAnchor,
    setKickAnchor,
    handlePassTurn,
    handleReverseTurn,
    handleNextPhase,
    handleConcedeToggle,
    handleRemoveArrows,
    handleLeave,
    handleToggleInvert,
    handleKick,
  } = useTurnControls({ gameId, onRequestConcede, onRequestUnconcede });

  return (
    <div className="turn-controls" data-testid="turn-controls">
      <button
        type="button"
        className="turn-controls__btn"
        onClick={handlePassTurn}
        disabled={!canPassTurn}
      >
        Pass Turn
      </button>
      <button
        type="button"
        className="turn-controls__btn"
        onClick={handleReverseTurn}
        disabled={!canPassTurn}
      >
        Reverse Turn
      </button>
      <button
        type="button"
        className="turn-controls__btn"
        onClick={handleNextPhase}
        disabled={!canAdvancePhase}
      >
        Next Phase
      </button>
      <button
        type="button"
        className="turn-controls__btn"
        onClick={handleConcedeToggle}
        disabled={!canConcede && !canUnconcede}
      >
        {isConceded ? 'Unconcede' : 'Concede'}
      </button>
      <button
        type="button"
        className="turn-controls__btn"
        onClick={onRequestRollDie}
        disabled={!canRoll}
      >
        Roll Die…
      </button>
      <button
        type="button"
        className="turn-controls__btn"
        onClick={handleRemoveArrows}
        disabled={!canRemoveArrows}
        title="Remove all arrows you've drawn this turn"
      >
        Remove Arrows
      </button>
      <button
        type="button"
        className={`turn-controls__btn${invertVerticalCoordinate ? ' turn-controls__btn--active' : ''}`}
        onClick={handleToggleInvert}
        aria-pressed={invertVerticalCoordinate}
        disabled={!settingsReady}
        title="Flip battlefield row order (saved across sessions)"
      >
        Invert Rows
      </button>
      <button
        type="button"
        className="turn-controls__btn"
        onClick={onRequestGameInfo}
        disabled={!hasLiveGame}
      >
        Game Info
      </button>
      <button
        type="button"
        className="turn-controls__btn"
        onClick={handleLeave}
        disabled={!canLeave}
      >
        Leave Game
      </button>
      {isHost && (
        <>
          <button
            type="button"
            className="turn-controls__btn"
            onClick={(e) => setKickAnchor(e.currentTarget)}
            disabled={!canKick}
          >
            Kick ▾
          </button>
          <Menu
            open={kickAnchor != null}
            anchorEl={kickAnchor}
            onClose={() => setKickAnchor(null)}
          >
            {opponents.map((o) => (
              <MenuItem key={o.playerId} onClick={() => handleKick(o.playerId)}>
                {o.name}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </div>
  );
}

export default TurnControls;
