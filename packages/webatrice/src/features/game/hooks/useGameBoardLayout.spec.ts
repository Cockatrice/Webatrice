import { renderHook } from '@testing-library/react';

import {
  makeGameEntry,
  makeGameInfo,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { useGameBoardLayout, type BoardCell } from './useGameBoardLayout';

function buildGame({
  localPlayerId,
  spectator = false,
  judge = false,
  omniscient = false,
  playerSpec,
}: {
  localPlayerId: number;
  spectator?: boolean;
  judge?: boolean;
  omniscient?: boolean;
  playerSpec: Array<{ id: number; name?: string; spectator?: boolean; conceded?: boolean }>;
}) {
  const players: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  for (const p of playerSpec) {
    players[p.id] = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: p.id,
        spectator: p.spectator ?? false,
        conceded: p.conceded ?? false,
        userInfo: p.name != null ? { name: p.name } : undefined,
      }),
    });
  }
  return makeGameEntry({
    localPlayerId,
    spectator,
    judge,
    players,
    info: makeGameInfo({ spectatorsOmniscient: omniscient }),
  });
}

function seats(ids: number[]) {
  return ids.map((id) => ({ id, name: `p${id}` }));
}

function cellById(cells: BoardCell[]): Map<number, BoardCell> {
  return new Map(cells.map((c) => [c.playerId, c]));
}

describe('useGameBoardLayout', () => {
  it('returns empty defaults when no game is provided', () => {
    const { result } = renderHook(() => useGameBoardLayout(undefined));
    expect(result.current.players).toEqual([]);
    expect(result.current.cells).toEqual([]);
    expect(result.current.columns).toBe(1);
    expect(result.current.rows).toBe(1);
  });

  it('lone player fills a single full-screen cell', () => {
    const game = buildGame({ localPlayerId: 1, playerSpec: seats([1]) });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.columns).toBe(1);
    expect(result.current.rows).toBe(1);
    expect(result.current.cells).toHaveLength(1);
    const cell = result.current.cells[0];
    expect(cell).toMatchObject({ playerId: 1, row: 0, col: 0, isLocal: true, mirrored: false });
  });

  it('2 players stack you on the bottom (upright) and the opponent on top (mirrored)', () => {
    const game = buildGame({ localPlayerId: 1, playerSpec: seats([1, 2]) });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.columns).toBe(1);
    expect(result.current.rows).toBe(2);
    const byId = cellById(result.current.cells);
    expect(byId.get(1)).toMatchObject({ row: 1, col: 0, isLocal: true, mirrored: false });
    expect(byId.get(2)).toMatchObject({ row: 0, col: 0, isLocal: false, mirrored: true });
  });

  it('3 players stack vertically in a single column', () => {
    const game = buildGame({ localPlayerId: 1, playerSpec: seats([1, 2, 3]) });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.columns).toBe(1);
    expect(result.current.rows).toBe(3);
    const byId = cellById(result.current.cells);
    expect(byId.get(1)).toMatchObject({ row: 2, col: 0, mirrored: false }); // bottom (you)
    expect(byId.get(2)).toMatchObject({ row: 1, col: 0, mirrored: true });
    expect(byId.get(3)).toMatchObject({ row: 0, col: 0, mirrored: true });
  });

  it('4 players form a 2x2 grid with you anchored bottom-left', () => {
    // Join order 1,2,3,4 with the local player 2 -> rotated ring [2,3,4,1].
    const game = buildGame({ localPlayerId: 2, playerSpec: seats([1, 2, 3, 4]) });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.columns).toBe(2);
    expect(result.current.rows).toBe(2);
    const byId = cellById(result.current.cells);
    expect(byId.get(2)).toMatchObject({ row: 1, col: 0, isLocal: true, mirrored: false }); // bottom-left
    expect(byId.get(3)).toMatchObject({ row: 0, col: 0, mirrored: true }); // up the left
    expect(byId.get(4)).toMatchObject({ row: 0, col: 1, mirrored: true }); // across the top
    expect(byId.get(1)).toMatchObject({ row: 1, col: 1, mirrored: false }); // down the right (wraps past P4)
  });

  it('5 players grow to a 2x3 grid leaving the bottom-right cell empty', () => {
    const game = buildGame({ localPlayerId: 1, playerSpec: seats([1, 2, 3, 4, 5]) });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.columns).toBe(2);
    expect(result.current.rows).toBe(3);
    expect(result.current.cells).toHaveLength(5);
    const byId = cellById(result.current.cells);
    expect(byId.get(1)).toMatchObject({ row: 2, col: 0, isLocal: true, mirrored: false });
    expect(byId.get(2)).toMatchObject({ row: 1, col: 0, mirrored: true });
    expect(byId.get(3)).toMatchObject({ row: 0, col: 0, mirrored: true });
    expect(byId.get(4)).toMatchObject({ row: 0, col: 1, mirrored: true });
    expect(byId.get(5)).toMatchObject({ row: 1, col: 1, mirrored: true });
    // Bottom-right (row 2, col 1) is left empty.
    expect(result.current.cells.some((c) => c.row === 2 && c.col === 1)).toBe(false);
  });

  it('6 players fill a full 2x3 grid', () => {
    const game = buildGame({ localPlayerId: 1, playerSpec: seats([1, 2, 3, 4, 5, 6]) });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.columns).toBe(2);
    expect(result.current.rows).toBe(3);
    expect(result.current.cells).toHaveLength(6);
    // The whole bottom row is upright; every row above is mirrored.
    for (const cell of result.current.cells) {
      expect(cell.mirrored).toBe(cell.row < 2);
    }
  });

  it('rotates the ring so anchoring keeps seating order relative to the local player', () => {
    // Join order 1,2,3,4; local player 2 -> ring [2,3,4,1]. P1 wraps past P4
    // (it comes after P4, not before P3), proving rotation rather than reshuffle.
    const game = buildGame({ localPlayerId: 2, playerSpec: seats([1, 2, 3, 4]) });
    const { result } = renderHook(() => useGameBoardLayout(game));
    // cells are emitted in ring order along the around-the-table path.
    expect(result.current.cells.map((c) => c.playerId)).toEqual([2, 3, 4, 1]);
  });

  it('spectator: all seats fill with no anchored local cell', () => {
    const game = buildGame({
      localPlayerId: 99,
      spectator: true,
      playerSpec: [
        { id: 0, name: 'Alice' },
        { id: 1, name: 'Bob' },
        { id: 99, name: 'Watcher', spectator: true },
      ],
    });
    const { result } = renderHook(() => useGameBoardLayout(game));
    // The local spectator is excluded from the seated-player list.
    expect(result.current.players.map((p) => p.playerId)).toEqual([0, 1]);
    expect(result.current.cells.every((c) => !c.isLocal)).toBe(true);
  });

  it('excludes conceded players so their board collapses out of the grid', () => {
    const game = buildGame({
      localPlayerId: 1,
      playerSpec: [
        { id: 1, name: 'Me' },
        { id: 2, name: 'Foe', conceded: true },
      ],
    });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.players.map((p) => p.playerId)).toEqual([1]);
    expect(result.current.cells).toHaveLength(1);
    expect(result.current.cells[0]).toMatchObject({ playerId: 1, isLocal: true });
  });

  it('falls back to a playerId-based name when userInfo is missing', () => {
    const game = buildGame({ localPlayerId: 0, playerSpec: [{ id: 0 }, { id: 1 }] });
    const { result } = renderHook(() => useGameBoardLayout(game));
    expect(result.current.players[0].name).toBe('p0');
    expect(result.current.players[1].name).toBe('p1');
  });

  describe('hand mode', () => {
    it('uses a bottom bar for the local hand in a normal game (no inline hands)', () => {
      const game = buildGame({ localPlayerId: 1, playerSpec: seats([1, 2]) });
      const { result } = renderHook(() => useGameBoardLayout(game));
      expect(result.current.handMode).toBe('bar');
      expect(result.current.bottomHand).toEqual({ playerId: 1, canAct: true });
      expect(result.current.cells.every((c) => !c.showHand)).toBe(true);
    });

    it('renders an inline hand on every seat when the game is omniscient', () => {
      const game = buildGame({ localPlayerId: 1, omniscient: true, playerSpec: seats([1, 2]) });
      const { result } = renderHook(() => useGameBoardLayout(game));
      expect(result.current.handMode).toBe('inline');
      expect(result.current.bottomHand).toBeUndefined();
      expect(result.current.cells.every((c) => c.showHand)).toBe(true);
    });

    it('shows no hand to a non-omniscient spectator', () => {
      const game = buildGame({
        localPlayerId: 99,
        spectator: true,
        playerSpec: [
          { id: 0, name: 'Alice' },
          { id: 1, name: 'Bob' },
          { id: 99, name: 'Watcher', spectator: true },
        ],
      });
      const { result } = renderHook(() => useGameBoardLayout(game));
      expect(result.current.bottomHand).toBeUndefined();
      expect(result.current.cells.every((c) => !c.showHand)).toBe(true);
    });
  });

  describe('per-cell canAct', () => {
    it('grants canAct only to the local seat in a normal game', () => {
      const game = buildGame({ localPlayerId: 1, playerSpec: seats([1, 2]) });
      const { result } = renderHook(() => useGameBoardLayout(game));
      const byId = cellById(result.current.cells);
      expect(byId.get(1)!.canAct).toBe(true);
      expect(byId.get(2)!.canAct).toBe(false);
    });

    it('grants a judge canAct on every seat', () => {
      const game = buildGame({ localPlayerId: 1, judge: true, playerSpec: seats([1, 2, 3]) });
      const { result } = renderHook(() => useGameBoardLayout(game));
      expect(result.current.cells.every((c) => c.canAct)).toBe(true);
    });

    it('grants a spectator canAct on no seat', () => {
      const game = buildGame({
        localPlayerId: 99,
        spectator: true,
        playerSpec: [
          { id: 0, name: 'Alice' },
          { id: 1, name: 'Bob' },
          { id: 99, name: 'Watcher', spectator: true },
        ],
      });
      const { result } = renderHook(() => useGameBoardLayout(game));
      expect(result.current.cells.every((c) => !c.canAct)).toBe(true);
    });
  });
});
