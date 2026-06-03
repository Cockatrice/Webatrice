import { createContext, useContext } from 'react';

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

const GameDialogActionsContext = createContext<GameDialogActions | null>(null);

export const GameDialogActionsProvider = GameDialogActionsContext.Provider;

export function useGameDialogActions(): GameDialogActions {
  const ctx = useContext(GameDialogActionsContext);
  if (!ctx) {
    throw new Error('useGameDialogActions must be used inside <GameDialogActionsProvider>');
  }
  return ctx;
}
