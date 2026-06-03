import { createRequiredContext } from './createRequiredContext';

// Game-session actions that open a dialog or confirm rather than dispatching
// directly. Sourced once from useGameDialogs in Game and consumed by the
// TurnControls sidebar — provided via context so RightPanel doesn't have to
// forward them (it never used them itself).
export interface GameDialogActions {
  onRequestRollDie: () => void;
  onRequestConcede: () => void;
  onRequestUnconcede: () => void;
  onRequestGameInfo: () => void;
}

export const [GameDialogActionsProvider, useGameDialogActions] =
  createRequiredContext<GameDialogActions>('GameDialogActionsContext');
