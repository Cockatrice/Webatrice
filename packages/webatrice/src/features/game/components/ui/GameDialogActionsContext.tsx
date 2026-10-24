import { createRequiredContext } from './createRequiredContext';
import type { RotationStep } from '../../hooks/useGameBoardLayout';

// Game-session actions that open a dialog or confirm rather than dispatching
// directly, plus the local view rotation. Sourced once from useGame in Game and
// consumed by the sidebar (its buttons and game menu) — provided via context so
// RightPanel doesn't have to forward them (it never used them itself).
export interface GameDialogActions {
  onRequestRollDie: () => void;
  onRequestConcede: () => void;
  onRequestUnconcede: () => void;
  onRequestGameInfo: () => void;
  onRequestViewSideboard: () => void;
  /** Opens the "Leave this game?" confirmation. Fires
   *  Command_LeaveGame on confirm; no-op on cancel. Mirrors
   *  `onRequestConcede` — a guard against accidentally dropping out. */
  onRequestLeave: () => void;
  onRotateView: (step: RotationStep) => void;
}

export const [GameDialogActionsProvider, useGameDialogActions] =
  createRequiredContext<GameDialogActions>('GameDialogActionsContext');
