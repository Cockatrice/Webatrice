import Tooltip from '@mui/material/Tooltip';

import { Phase } from 'datatrice';
import { cx } from '@app/utils';

import { usePhaseBar } from './usePhaseBar';

import './PhaseBar.css';

export interface PhaseBarProps {
  gameId: number | undefined;
}

const PHASE_LABELS: ReadonlyArray<{
  phase: Phase;
  label: string;
  title: string;
  builtInOnDoubleClick?: 'untapAll' | 'drawCard';
}> = [
  { phase: Phase.Untap, label: 'UNTAP', title: 'Untap step (double-click: untap all)', builtInOnDoubleClick: 'untapAll' },
  { phase: Phase.Upkeep, label: 'UPKP', title: 'Upkeep step' },
  { phase: Phase.Draw, label: 'DRAW', title: 'Draw step (double-click: draw a card)', builtInOnDoubleClick: 'drawCard' },
  { phase: Phase.FirstMain, label: 'M1', title: 'First main phase' },
  { phase: Phase.BeginCombat, label: 'CMBT', title: 'Beginning of combat' },
  { phase: Phase.DeclareAttackers, label: 'ATTK', title: 'Declare attackers' },
  { phase: Phase.DeclareBlockers, label: 'BLCK', title: 'Declare blockers' },
  { phase: Phase.CombatDamage, label: 'DMGE', title: 'Combat damage' },
  { phase: Phase.EndCombat, label: 'ECMB', title: 'End of combat' },
  { phase: Phase.SecondMain, label: 'M2', title: 'Second main phase' },
  { phase: Phase.EndCleanup, label: 'END', title: 'End step / cleanup' },
];

function PhaseBar({ gameId }: PhaseBarProps) {
  const {
    activePhase,
    canPassTurn,
    canAdvancePhase,
    handlePhaseClick,
    handlePass,
    handleUntapAll,
    handleDrawOne,
  } = usePhaseBar(gameId);

  const onDoubleClickFor = (kind: 'untapAll' | 'drawCard' | undefined) => {
    if (kind === 'untapAll') {
      return handleUntapAll;
    }
    if (kind === 'drawCard') {
      return handleDrawOne;
    }
    return undefined;
  };

  return (
    <nav className="phase-bar" data-testid="phase-bar" aria-label="Turn phases">
      {PHASE_LABELS.map(({ phase, label, title, builtInOnDoubleClick }) => {
        const isActive = phase === activePhase;
        return (
          <Tooltip key={phase} title={title} placement="right" enterDelay={500}>
            <span className="phase-bar__btn-wrap">
              <button
                type="button"
                className={cx('phase-bar__btn', { 'phase-bar__btn--active': isActive })}
                data-phase={phase}
                disabled={!canAdvancePhase}
                onClick={() => handlePhaseClick(phase)}
                onDoubleClick={onDoubleClickFor(builtInOnDoubleClick)}
              >
                {label}
              </button>
            </span>
          </Tooltip>
        );
      })}
      <div className="phase-bar__spacer" />
      <Tooltip title="Pass to the next turn" placement="right" enterDelay={500}>
        <span className="phase-bar__btn-wrap">
          <button
            type="button"
            className="phase-bar__btn phase-bar__btn--pass"
            disabled={!canPassTurn}
            onClick={handlePass}
          >
            PASS TURN
          </button>
        </span>
      </Tooltip>
    </nav>
  );
}

export default PhaseBar;
