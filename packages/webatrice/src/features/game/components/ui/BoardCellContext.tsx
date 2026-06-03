import { createRequiredContext } from './createRequiredContext';

// Identifies which seat a board subtree renders. These are positional values —
// they say *which* player's board this is and how it's oriented — but they were
// forwarded down through PlayerBoard into every child (StackColumn, Battlefield,
// PlayerInfoPanel, ZoneStack). GameBoardCell provides them once per cell so the
// board components read their seat from context instead of a prop chain.
//
// Scoped per cell (not global like GameIdContext): a multi-player board renders
// several PlayerBoards at once, each inside its own provider. Board components
// only render inside a GameBoardCell, so a missing provider is a wiring bug
// rather than a pre-game state — the factory's hook throws.
export interface BoardCellInfo {
  playerId: number;
  mirrored: boolean;
  isLocal: boolean;
}

export const [BoardCellProvider, useBoardCell] =
  createRequiredContext<BoardCellInfo>('BoardCellContext');
