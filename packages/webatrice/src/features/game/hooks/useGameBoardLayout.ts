import { useMemo } from 'react';
import { lruMemoize } from '@reduxjs/toolkit';
import { shallowEqual } from 'react-redux';

import { GameEntry, games } from '@cockatrice/datatrice';
import { PREFERENCE_DEFAULTS } from '@app/types';

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

export type RotationStep = 1 | -1;
export const ROTATE_CLOCKWISE: RotationStep = -1;
export const ROTATE_COUNTERCLOCKWISE: RotationStep = 1;

const EMPTY_LAYOUT: GameBoardLayout = {
  cells: [],
  columns: 1,
  rows: 1,
  handMode: 'bar',
  bottomHand: undefined,
};

export function useGameBoardLayout(
  game: GameEntry | undefined,
  rotation = 0,
  minPlayersForMultiColumn: number = PREFERENCE_DEFAULTS.minPlayersForMultiColumnLayout,
): GameBoardLayout {
  const selectPlayerIds = useMemo(() => lruMemoize(
    (entry: GameEntry | undefined) => entry ? games.seatedPlayersOf(entry).map((p) => p.properties.playerId) : [],
    { resultEqualityCheck: shallowEqual },
  ), []);
  const players = selectPlayerIds(game);
  const isSpectator = game?.spectator;
  const localPlayerId = game?.localPlayerId;
  const judge = game?.judge;
  const omniscient = game?.info?.spectatorsOmniscient === true;
  return useMemo<GameBoardLayout>(() => {
    if (localPlayerId === undefined || isSpectator === undefined || judge === undefined) {
      return EMPTY_LAYOUT;
    }

    const n = players.length;
    if (n === 0) {
      return EMPTY_LAYOUT;
    }

    const access = { spectator: isSpectator, localPlayerId, judge };

    // A seated player always sees their own hand; other hands are revealed only when
    // the server marks the game omniscient (spectators_see_everything). More than one
    // visible hand renders inline per board, otherwise a single bottom bar.
    const visibleHand = new Set<number>();
    for (const playerId of players) {
      if ((!isSpectator && playerId === localPlayerId) || omniscient) {
        visibleHand.add(playerId);
      }
    }
    const handMode: 'bar' | 'inline' = visibleHand.size > 1 ? 'inline' : 'bar';
    const bottomHand =
      handMode === 'bar' && visibleHand.has(localPlayerId)
        ? { playerId: localPlayerId, canAct: computeCanAct(access, localPlayerId) }
        : undefined;

    const columns = n >= minPlayersForMultiColumn ? 2 : 1;
    const rows = Math.ceil(n / columns);

    const localIndex = isSpectator
      ? -1
      : players.findIndex((p) => p === localPlayerId);
    const start = (((Math.max(localIndex, 0) + rotation) % n) + n) % n;
    const ring = [...players.slice(start), ...players.slice(0, start)];

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
        canAct: computeCanAct(access, playerId),
        showHand: handMode === 'inline' && visibleHand.has(playerId),
        row,
        col,
      };
    });

    return { cells, columns, rows, handMode, bottomHand };
  }, [players, isSpectator, localPlayerId, judge, omniscient, rotation, minPlayersForMultiColumn]);
}
