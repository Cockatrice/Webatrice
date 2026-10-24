import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RotateCcw,
  Settings,
  BookOpen,
  Circle,
  CircleDot,
  Swords,
  Sword,
  Shield,
  Zap,
  Flag,
  Moon,
  type LucideIcon,
} from 'lucide-react';

import { Phase } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import { useGameId } from '../ui/GameIdContext';

import { GAME_FOCUS_RING } from '../ui/focusRing';
import { usePhaseBar } from './usePhaseBar';
import { phaseLabel } from '@app/utils';

type PhaseTone = 'success' | 'info' | 'danger';

interface PhaseEntry {
  phase: Phase;
  icon: LucideIcon;
  tone: PhaseTone;
  groupStart?: boolean;
  builtIn?: 'untapAll' | 'drawCard';
}

const PHASE_ENTRIES: ReadonlyArray<PhaseEntry> = [
  { phase: Phase.Untap, icon: RotateCcw, tone: 'success', builtIn: 'untapAll' },
  { phase: Phase.Upkeep, icon: Settings, tone: 'success' },
  { phase: Phase.Draw, icon: BookOpen, tone: 'success', builtIn: 'drawCard' },
  { phase: Phase.FirstMain, icon: Circle, tone: 'info', groupStart: true },
  { phase: Phase.BeginCombat, icon: Swords, tone: 'danger', groupStart: true },
  { phase: Phase.DeclareAttackers, icon: Sword, tone: 'danger' },
  { phase: Phase.DeclareBlockers, icon: Shield, tone: 'danger' },
  { phase: Phase.CombatDamage, icon: Zap, tone: 'danger' },
  { phase: Phase.EndCombat, icon: Flag, tone: 'danger' },
  { phase: Phase.SecondMain, icon: CircleDot, tone: 'info', groupStart: true },
  { phase: Phase.EndCleanup, icon: Moon, tone: 'success', groupStart: true },
];

const ACTIVE_TONE: Record<PhaseTone, string> = {
  success: 'bg-success text-bg-base',
  info: 'bg-info text-bg-base',
  danger: 'bg-danger text-bg-base',
};

export default function PhaseTrack() {
  const { t } = useTranslation();
  const gameId = useGameId();
  const {
    activePhase,
    canAdvancePhase,
    handlePhaseClick,
    handleUntapAll,
    handleDrawOne,
  } = usePhaseBar(gameId);

  const [endStepFlashSeq, setEndStepFlashSeq] = useState(0);
  const previousPhaseRef = useRef<Phase | undefined>(undefined);
  useEffect(() => {
    const previous = previousPhaseRef.current;
    previousPhaseRef.current = activePhase;
    if (previous !== undefined
      && previous !== Phase.EndCleanup
      && activePhase === Phase.EndCleanup) {
      setEndStepFlashSeq((n) => n + 1);
    }
  }, [activePhase]);

  const entries = PHASE_ENTRIES.map((entry) => ({
    ...entry,
    label: phaseLabel(t, entry.phase, 'short'),
    title: phaseLabel(t, entry.phase, 'title'),
  }));

  return (
    <nav
      data-testid="phase-bar"
      aria-label={t('PhaseTrack.label')}
      className={cx(
        'flex min-w-0 shrink items-center gap-[2px] overflow-x-auto rounded-ui border border-border-subtle bg-bg-sunken p-[3px]',
        'board-motion transition-colors',
      )}
    >
      {entries.map(({ phase, icon: Icon, tone, groupStart, builtIn, label, title }) => {
        const isActive = phase === activePhase;
        const isPast = activePhase !== undefined && phase < activePhase;
        const isEndStep = phase === Phase.EndCleanup;
        return (
          <button
            key={isEndStep ? `endstep-${endStepFlashSeq}` : `phase-${phase}`}
            type="button"
            data-phase={phase}
            aria-label={label}
            aria-current={isActive ? 'step' : undefined}
            aria-disabled={!canAdvancePhase || undefined}
            onClick={() => {
              if (!canAdvancePhase) {
                return;
              }
              const wasAlreadyActive = phase === activePhase;
              handlePhaseClick(phase);
              if (builtIn === 'untapAll') {
                handleUntapAll();
              }
              if (builtIn === 'drawCard' && wasAlreadyActive) {
                handleDrawOne();
              }
            }}
            onDoubleClick={canAdvancePhase && builtIn === 'untapAll' ? handleUntapAll : undefined}
            title={canAdvancePhase ? title : t('PhaseTrack.activePlayerOnly')}
            className={cx(
              'flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-ui-sm px-[7px] text-[11.5px] font-medium',
              'board-motion transition-colors',
              GAME_FOCUS_RING,
              groupStart && 'ml-1',
              isActive ? ACTIVE_TONE[tone] : isPast ? 'text-text-muted' : 'text-text-secondary',
              !isActive && (canAdvancePhase ? 'hover:bg-bg-elevated cursor-pointer' : 'cursor-not-allowed'),
              isEndStep && endStepFlashSeq > 0 && 'phase-endstep-flash',
            )}
          >
            <Icon size={13} aria-hidden />
            <span className="max-[1359px]:hidden">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
