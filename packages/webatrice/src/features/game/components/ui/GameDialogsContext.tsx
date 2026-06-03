import { createRequiredContext } from './createRequiredContext';

import type { GameDialogs } from '../../hooks/useGameDialogs';

// The whole dialog/menu state machine (from useGameDialogs, via useGame) shared
// through context so the high-prop-count context menus source their own state +
// action handlers instead of Game enumerating ~50 props across them. Named
// distinctly from the producing `useGameDialogs` hook to avoid confusion.
export const [GameDialogsProvider, useGameDialogsContext] =
  createRequiredContext<GameDialogs>('GameDialogsContext');
