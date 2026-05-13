import { act, renderHook } from '@testing-library/react';

import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '../../../__test-utils__/games-fixtures';

import { useGamePlayerSlots } from './useGamePlayerSlots';

function buildGame({
  localPlayerId,
  spectator = false,
  playerSpec,
}: {
  localPlayerId: number;
  spectator?: boolean;
  playerSpec: Array<{ id: number; name?: string; spectator?: boolean }>;
}) {
  const players: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  for (const p of playerSpec) {
    players[p.id] = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: p.id,
        spectator: p.spectator ?? false,
        userInfo: p.name != null ? { name: p.name } : undefined,
      }),
    });
  }
  return makeGameEntry({ localPlayerId, spectator, players });
}

describe('useGamePlayerSlots', () => {
  it('returns empty defaults when no game is provided', () => {
    const { result } = renderHook(() => useGamePlayerSlots(undefined));
    expect(result.current.players).toEqual([]);
    expect(result.current.slotAPlayerId).toBeUndefined();
    expect(result.current.slotBPlayerId).toBeUndefined();
  });

  it('active player: slot A defaults to localPlayerId, slot B to the other player', () => {
    const game = buildGame({
      localPlayerId: 1,
      playerSpec: [
        { id: 1, name: 'Me' },
        { id: 2, name: 'Foe' },
      ],
    });
    const { result } = renderHook(() => useGamePlayerSlots(game));
    expect(result.current.players.map((p) => p.playerId)).toEqual([1, 2]);
    expect(result.current.slotAPlayerId).toBe(1);
    expect(result.current.slotBPlayerId).toBe(2);
  });

  it('spectator: slot A defaults to first seated player, slot B to the second', () => {
    const game = buildGame({
      localPlayerId: 99,
      spectator: true,
      playerSpec: [
        { id: 0, name: 'Alice' },
        { id: 1, name: 'Bob' },
        { id: 99, name: 'Watcher', spectator: true },
      ],
    });
    const { result } = renderHook(() => useGamePlayerSlots(game));
    // The local spectator is excluded from the seated-player list.
    expect(result.current.players.map((p) => p.playerId)).toEqual([0, 1]);
    expect(result.current.slotAPlayerId).toBe(0);
    expect(result.current.slotBPlayerId).toBe(1);
  });

  it('falls back to playerId-based name when userInfo is missing', () => {
    const game = buildGame({
      localPlayerId: 0,
      playerSpec: [{ id: 0 }, { id: 1 }],
    });
    const { result } = renderHook(() => useGamePlayerSlots(game));
    expect(result.current.players[0].name).toBe('p0');
    expect(result.current.players[1].name).toBe('p1');
  });

  it('preserves user-chosen slot IDs across re-renders when both are still seated', () => {
    const game = buildGame({
      localPlayerId: 0,
      playerSpec: [
        { id: 0, name: 'Me' },
        { id: 1, name: 'Foe' },
      ],
    });
    const { result, rerender } = renderHook(({ g }) => useGamePlayerSlots(g), {
      initialProps: { g: game },
    });

    act(() => {
      result.current.setSlotAPlayerId(1);
      result.current.setSlotBPlayerId(0);
    });

    rerender({ g: game });

    expect(result.current.slotAPlayerId).toBe(1);
    expect(result.current.slotBPlayerId).toBe(0);
  });

  it('reassigns a slot when its selected player leaves the game', () => {
    const initial = buildGame({
      localPlayerId: 0,
      playerSpec: [
        { id: 0, name: 'Me' },
        { id: 1, name: 'Bob' },
        { id: 2, name: 'Carol' },
      ],
    });
    const { result, rerender } = renderHook(({ g }) => useGamePlayerSlots(g), {
      initialProps: { g: initial },
    });

    act(() => {
      result.current.setSlotBPlayerId(2);
    });
    expect(result.current.slotBPlayerId).toBe(2);

    const after = buildGame({
      localPlayerId: 0,
      playerSpec: [
        { id: 0, name: 'Me' },
        { id: 1, name: 'Bob' },
      ],
    });
    rerender({ g: after });

    expect(result.current.slotBPlayerId).toBe(1);
  });
});
