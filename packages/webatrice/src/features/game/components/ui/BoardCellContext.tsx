import { createContext, useContext } from 'react';

// Identifies which seat a board subtree renders. These are positional values —
// they say *which* player's board this is and how it's oriented — but they were
// forwarded down through PlayerBoard into every child (StackColumn, Battlefield,
// PlayerInfoPanel, ZoneStack). GameBoardCell provides them once per cell so the
// board components read their seat from context instead of a prop chain.
//
// Scoped per cell (not global like GameIdContext): a multi-player board renders
// several PlayerBoards at once, each inside its own provider.
export interface BoardCellInfo {
  playerId: number;
  mirrored: boolean;
  isLocal: boolean;
}

const BoardCellContext = createContext<BoardCellInfo | null>(null);

export const BoardCellProvider = BoardCellContext.Provider;

// Board components only render inside a GameBoardCell, so a missing provider is
// a wiring bug rather than a pre-game state — throw like useGameIdRequired.
export function useBoardCell(): BoardCellInfo {
  const ctx = useContext(BoardCellContext);
  if (!ctx) {
    throw new Error('useBoardCell must be used inside <BoardCellProvider> (a GameBoardCell)');
  }
  return ctx;
}
