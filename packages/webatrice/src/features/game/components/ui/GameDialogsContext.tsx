import { createContext, useContext } from 'react';

import type { GameDialogs } from '../../hooks/useGameDialogs';

// The whole dialog/menu state machine (from useGameDialogs, via useGame) shared
// through context so the high-prop-count context menus source their own state +
// action handlers instead of Game enumerating ~50 props across them. Named
// distinctly from the producing `useGameDialogs` hook to avoid confusion.
const GameDialogsContext = createContext<GameDialogs | null>(null);

export const GameDialogsProvider = GameDialogsContext.Provider;

export function useGameDialogsContext(): GameDialogs {
  const ctx = useContext(GameDialogsContext);
  if (!ctx) {
    throw new Error('useGameDialogsContext must be used inside <GameDialogsProvider>');
  }
  return ctx;
}
