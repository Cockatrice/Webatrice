import { useMemo } from 'react';

import { GameEntry, games } from '@cockatrice/datatrice';

import { computeCanAct } from './useGameAccess';

export interface BoardCell {
  playerId: number;
  isLocal: boolean;
  // true for every row above the bottom row, so opponents' cards face inward.
  mirrored: boolean;
  // whether the local user can act on this seat (own seat, or judge).
  canAct: boolean;
  // whether this seat renders its own inline hand (omniscient games).
  showHand: boolean;
  row: number;
  col: number;
}

export interface GameBoardLayout {
  cells: BoardCell[]; // placed active players in join order
  columns: number;
  rows: number;
  // 'bar' renders a single bottom hand for the local player; 'inline' renders a
  // hand inside each board whose hand is visible (omniscient / spectators_see_everything).
  handMode: 'bar' | 'inline';
  // the seat whose hand fills the bottom bar (only set in 'bar' mode).
  bottomHand: { playerId: number; canAct: boolean } | undefined;
}

// Cockatrice switches to a 2-column board at this player count
// (its getMinPlayersForMultiColumnLayout default; see Cockatrice issue #3533).
const MIN_PLAYERS_FOR_TWO_COLUMNS = 4;

const EMPTY_LAYOUT: GameBoardLayout = {
  cells: [],
  columns: 1,
  rows: 1,
  handMode: 'bar',
  bottomHand: undefined,
};

/**
 * Board view-model for a game: where each seated player renders, whether the local
 * user can act on it, and how hands are shown. A port of Cockatrice's
 * GameScene::rearrange() (collectActivePlayers -> rotatePlayers ->
 * computeSceneSizeAndPlayerLayout): seated players sit in a cyclic ring in join
 * order; the local player anchors the bottom-left cell and the ring is rotated so
 * everyone else keeps their seating order relative to the local player. Cells fill
 * up the left column (bottom -> top) then down the right column (top -> bottom).
 */
export function useGameBoardLayout(game: GameEntry | undefined): GameBoardLayout {
  return useMemo<GameBoardLayout>(() => {
    if (!game) {
      return EMPTY_LAYOUT;
    }

    // Active players (non-spectator, non-conceded) in server seat/join order,
    // sourced from the store's seatOrder via seatedPlayersOf — only the id is
    // needed to seat cells (names are a presentation concern owned by consumers).
    const players = games.seatedPlayersOf(game).map((p) => p.properties.playerId);

    const n = players.length;
    if (n === 0) {
      return EMPTY_LAYOUT;
    }

    const isSpectator = game.spectator;
    const localPlayerId = game.localPlayerId;

    // A seated player always sees their own hand; other hands are revealed only when
    // the server marks the game omniscient (spectators_see_everything). More than one
    // visible hand renders inline per board, otherwise a single bottom bar.
    const omniscient = game.info?.spectatorsOmniscient === true;
    const visibleHand = new Set<number>();
    for (const playerId of players) {
      if ((!isSpectator && playerId === localPlayerId) || omniscient) {
        visibleHand.add(playerId);
      }
    }
    const handMode: 'bar' | 'inline' = visibleHand.size > 1 ? 'inline' : 'bar';
    const bottomHand =
      handMode === 'bar' && visibleHand.has(localPlayerId)
        ? { playerId: localPlayerId, canAct: computeCanAct(game, localPlayerId) }
        : undefined;

    const columns = n >= MIN_PLAYERS_FOR_TWO_COLUMNS ? 2 : 1;
    const rows = Math.ceil(n / columns);

    // Rotate the ring so the anchored (local) player leads. Spectators have no
    // anchor, so the seats fill in plain join order.
    const localIndex = isSpectator
      ? -1
      : players.findIndex((p) => p === localPlayerId);
    const ring =
      localIndex >= 0
        ? [...players.slice(localIndex), ...players.slice(0, localIndex)]
        : players;

    // Around-the-table cell path: up the left column (bottom -> top), then
    // (2-column only) down the right column (top -> bottom). path[0] is bottom-left.
    const path: number[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      path.push(r * columns);
    }
    if (columns === 2) {
      for (let r = 0; r < rows; r++) {
        path.push(r * columns + 1);
      }
    }

    const cells: BoardCell[] = ring.map((playerId, k) => {
      const index = path[k];
      const row = Math.floor(index / columns);
      const col = index % columns;
      return {
        playerId,
        isLocal: !isSpectator && playerId === localPlayerId,
        mirrored: row < rows - 1,
        canAct: computeCanAct(game, playerId),
        showHand: handMode === 'inline' && visibleHand.has(playerId),
        row,
        col,
      };
    });

    return { cells, columns, rows, handMode, bottomHand };
  }, [game]);
}
