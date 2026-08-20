import { useEffect, useRef, useState } from 'react';
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
  LogOut,
  type LucideIcon,
} from 'lucide-react';

import { Phase } from '@cockatrice/datatrice';

import { useGameId } from '../ui/GameIdContext';
import { usePhaseTrackPinned } from '../../hooks/usePhaseTrackPinned';

import { usePhaseBar } from './usePhaseBar';

/**
 * Left-edge auto-collapsing phase track — a HUD-style overlay that
 * frees the play area to fill the full width of the screen.
 *
 * Two modes:
 *
 *   • **Collapsed** (default). A ~8 px vertical strip of color-coded
 *     bars pinned to the left edge, one per phase. Only the active
 *     phase reveals its name — a floating pill that pops out to the
 *     right of its bar. Everything else is just tint. The strip is
 *     the hover target, so mousing over any bar triggers the expand.
 *
 *   • **Expanded** (on hover). Slides out to the classic 112 px wide
 *     panel with icon + label per phase, plus the Pass button at the
 *     bottom. Clicking a phase advances to it and collapses back.
 *
 * The bar sits inside the game shell's `position: relative` root, so
 * the expansion animation floats over the play area without shifting
 * card positions. Cards under the collapsed strip are still visible;
 * only the leftmost ~8 px is occluded when idle.
 */

interface PhaseEntry {
  phase: Phase;
  label: string;
  title: string;
  icon: LucideIcon;
  tint: string;
  builtInOnDoubleClick?: 'untapAll' | 'drawCard';
}

// Phase-family tint colors — kept as hex here because the phase
// tinting is a traffic-light palette (green / blue / red) that
// doesn't map onto the design tokens. Applied at ~55 % on the
// collapsed bars and again at ~85 % overlay in expanded mode.
const TINT_GREEN = '#22c55e';
const TINT_BLUE = '#3b82f6';
const TINT_RED = '#ef4444';

const PHASE_ENTRIES: ReadonlyArray<PhaseEntry> = [
  {
    phase: Phase.Untap,
    label: 'Untap',
    title: 'Untap step (double-click: untap all)',
    icon: RotateCcw,
    tint: TINT_GREEN,
    builtInOnDoubleClick: 'untapAll',
  },
  { phase: Phase.Upkeep, label: 'Upkeep', title: 'Upkeep step', icon: Settings, tint: TINT_GREEN },
  {
    phase: Phase.Draw,
    label: 'Draw',
    title: 'Draw step (double-click: draw a card)',
    icon: BookOpen,
    tint: TINT_GREEN,
    builtInOnDoubleClick: 'drawCard',
  },
  { phase: Phase.FirstMain, label: 'Main 1', title: 'First main phase', icon: Circle, tint: TINT_BLUE },
  { phase: Phase.BeginCombat, label: 'Start Combat', title: 'Beginning of combat', icon: Swords, tint: TINT_RED },
  { phase: Phase.DeclareAttackers, label: 'Attack', title: 'Declare attackers', icon: Sword, tint: TINT_RED },
  { phase: Phase.DeclareBlockers, label: 'Block', title: 'Declare blockers', icon: Shield, tint: TINT_RED },
  { phase: Phase.CombatDamage, label: 'Damage', title: 'Combat damage', icon: Zap, tint: TINT_RED },
  { phase: Phase.EndCombat, label: 'End Combat', title: 'End of combat', icon: Flag, tint: TINT_RED },
  { phase: Phase.SecondMain, label: 'Main 2', title: 'Second main phase', icon: CircleDot, tint: TINT_BLUE },
  { phase: Phase.EndCleanup, label: 'End', title: 'End step / cleanup', icon: Moon, tint: TINT_GREEN },
];

// Widths for the two modes. Collapsed stays skinny enough that the
// leftmost card in the play area is at most half-obscured; expanded
// matches the previous fixed sidebar width so hover-clicks feel
// familiar. `HOVER_BUFFER_PX` extends the hit area a few pixels to
// the right of the visible bars so the overlay expands even when
// the pointer is just past the strip — makes the target easier to
// grab without visually widening the bars themselves.
const VISIBLE_BAR_WIDTH = 8;
const HOVER_BUFFER_PX = 4;
const COLLAPSED_WIDTH = VISIBLE_BAR_WIDTH + HOVER_BUFFER_PX;
const EXPANDED_WIDTH = 112;

export default function PhaseTrack() {
  const gameId = useGameId();
  const pinned = usePhaseTrackPinned();
  // Hover-driven expand still applies in unpinned mode; pinned mode
  // treats `expanded` as always-true and skips the hover handlers so
  // stray mouse-outs can't collapse the panel.
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const expanded = pinned || hoverExpanded;
  const {
    activePhase,
    canPassTurn,
    canAdvancePhase,
    handlePhaseClick,
    handlePass,
    handleUntapAll,
    handleDrawOne,
  } = usePhaseBar(gameId);

  // End-step attention flash. Whenever the active phase TRANSITIONS
  // into EndCleanup (from any other phase), we flip on
  // `endStepFlashing` for ~1.6 s to drive the CSS animation on the
  // End bar. Motivation: an opponent's turn scrolls by quickly and
  // players miss the end-step window for instant-speed responses.
  // A brief amber pulse on the collapsed End bar makes it obvious
  // that the window is open even when the phase track is collapsed
  // and hidden at the screen's left edge.
  //
  // Tracks the previous phase in a ref so we only fire on the
  // TRANSITION — sitting on end step through re-renders shouldn't
  // re-trigger the animation. `key` on the animated element (bumped
  // via `endStepFlashSeq`) restarts the CSS animation cleanly for
  // back-to-back triggers (multiplayer: player A → end → player B →
  // end within the same React lifecycle).
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

  const onDoubleClickFor = (kind: PhaseEntry['builtInOnDoubleClick']) => {
    if (kind === 'untapAll') return handleUntapAll;
    // Draw is now handled by single-click on the already-active
    // draw phase (see button onClick below). We drop the double-
    // click binding to avoid firing draw twice on a double-click
    // (which would otherwise: click 1 advances → click 2 sees
    // already-active and draws → onDoubleClick draws again).
    return undefined;
  };

  return (
    <nav
      data-testid="phase-bar"
      aria-label="Turn phases"
      // Pinned mode: no hover-driven expand/collapse; the panel is
      // always full-width and lives in its own grid column, so hover
      // events are irrelevant. Unpinned mode: mouse in / out drives
      // the auto-expand HUD behavior.
      onMouseEnter={pinned ? undefined : () => setHoverExpanded(true)}
      onMouseLeave={pinned ? undefined : () => setHoverExpanded(false)}
      className={[
        // Pinned: `relative` so it takes up the reserved grid column.
        // Unpinned: `absolute` so it floats over the play area and
        //   only the 8-px stripe consumes real width.
        pinned
          ? 'relative flex flex-col gap-0.5 min-h-0 box-border h-full'
          : 'absolute top-0 bottom-0 left-0 z-20 flex flex-col gap-0.5 min-h-0 box-border',
        'transition-[width,background-color,padding,box-shadow] duration-200 ease-out',
        expanded
          ? 'bg-bg-surface/85 backdrop-blur-sm border-r border-border-subtle py-4 px-2 gap-2 shadow-glow'
          : // `pr-1` (4 px) reserves invisible hit-area past the visible
            // 8 px bars so the overlay still expands when the pointer
            // is up to 4 px right of the strip.
            'py-2 pr-1',
      ].join(' ')}
      style={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
    >
      {PHASE_ENTRIES.map(({ phase, label, title, icon: Icon, tint, builtInOnDoubleClick }) => {
        const isActive = phase === activePhase;
        const isEndStep = phase === Phase.EndCleanup;
        return (
          <div key={phase} className="relative flex-1 min-h-0 flex">
            <button
              // Bump the button's React key on every end-step flash
              // so the CSS animation restarts cleanly. Without this,
              // back-to-back triggers (player A ends → player B ends
              // before the animation finishes) would not re-fire the
              // keyframes since the same DOM node stays attached.
              // Non-end-step buttons use their phase as the key
              // (stable across re-renders).
              key={isEndStep ? `endstep-${endStepFlashSeq}` : `phase-${phase}`}
              type="button"
              data-phase={phase}
              disabled={!canAdvancePhase}
              onClick={() => {
                // Snapshot BEFORE advancing so we can distinguish
                // "user is re-clicking the already-active phase" from
                // "user is advancing into this phase for the first
                // time". `handlePhaseClick` is gated on canAdvancePhase
                // (which checks active-player status), so the draw
                // path below stays behind the same gate.
                const wasAlreadyActive = phase === activePhase;
                handlePhaseClick(phase);
                // Match Cockatrice: entering the untap step untaps
                // every card on your battlefield except those tagged
                // with `AttrDoesntUntap`. The server filters that set
                // when it receives `cardId: -1` + `AttrTapped: "0"`.
                if (builtInOnDoubleClick === 'untapAll') handleUntapAll();
                // Draw a card when the user clicks the already-active
                // Draw phase — matches the mental model "click Draw to
                // draw." Double-click also draws (naturally: click 1
                // advances into Draw, click 2 sees already-active →
                // draws) since our phase changes are optimistic. Gated
                // on canAdvancePhase inside handleDrawOne so
                // non-active-player clicks stay no-op.
                if (builtInOnDoubleClick === 'drawCard' && wasAlreadyActive) {
                  handleDrawOne();
                }
              }}
              onDoubleClick={onDoubleClickFor(builtInOnDoubleClick)}
              title={canAdvancePhase ? title : 'Only the active player can change phases'}
              className={[
                'relative overflow-hidden w-full h-full transition-all duration-200',
                expanded
                  ? 'rounded-md flex flex-col items-center justify-center gap-1 px-1 py-1'
                  : 'rounded-sm',
                isActive ? 'opacity-100' : 'opacity-45',
                canAdvancePhase ? 'cursor-pointer' : 'cursor-not-allowed',
                // Flash class runs the 1.5 s CSS animation defined in
                // Game.css. The key bump above forces the button to
                // remount, restarting the animation for every trigger.
                isEndStep && endStepFlashSeq > 0 ? 'phase-endstep-flash' : '',
              ].join(' ')}
              style={{ backgroundColor: tint }}
            >
              {/* Expanded: darken non-active phases so the active phase
                   still reads as "lit up" against the same tint. */}
              {expanded && !isActive && (
                <div className="absolute inset-0 bg-black/40 pointer-events-none" aria-hidden />
              )}
              {expanded && (
                <>
                  <Icon size={16} className="relative z-10 text-white" strokeWidth={2.25} />
                  <span className="relative z-10 text-[11px] font-semibold uppercase tracking-wider text-white leading-tight text-center">
                    {label}
                  </span>
                </>
              )}
            </button>

          </div>
        );
      })}

      {/* Pass button — same collapse/expand rules. In collapsed mode
           it's a skinny accent-tinted bar at the bottom; expanded, it
           reveals the icon + PASS label. Doubles as the visual anchor
           for "end of the phase track". */}
      <button
        type="button"
        onClick={handlePass}
        disabled={!canPassTurn}
        title="Pass to the next turn"
        className={[
          'relative shrink-0 overflow-hidden w-full transition-all duration-200',
          'bg-accent-secondary hover:bg-accent text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          expanded
            ? 'mt-1 rounded-md px-2 py-3 flex flex-col items-center gap-1 text-xs font-bold uppercase tracking-wider shadow-glow'
            : 'rounded-sm h-8',
        ].join(' ')}
      >
        {expanded && (
          <>
            <LogOut size={16} />
            <span>Pass</span>
          </>
        )}
      </button>
    </nav>
  );
}
