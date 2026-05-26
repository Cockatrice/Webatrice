import { useEffect, useMemo, useRef, useState } from 'react';

import { GameEntry } from '@cockatrice/datatrice';
export interface PlayerSlotEntry {
  playerId: number;
  name: string;
}

export interface GamePlayerSlots {
  players: PlayerSlotEntry[];
  slotAPlayerId: number | undefined;
  slotBPlayerId: number | undefined;
  setSlotAPlayerId: (id: number) => void;
  setSlotBPlayerId: (id: number) => void;
  revealPlayers: PlayerSlotEntry[];
}

interface SlotState {
  a: number | undefined;
  b: number | undefined;
}

export function useGamePlayerSlots(
  game: GameEntry | undefined,
): GamePlayerSlots {
  const [slots, setSlots] = useState<SlotState>({ a: undefined, b: undefined });
  // Tracks the order in which seated playerIds were first observed, so slot
  // defaults follow join order rather than numeric playerId order.
  const joinOrderRef = useRef<number[]>([]);

  const players = useMemo<PlayerSlotEntry[]>(() => {
    if (!game) {
      joinOrderRef.current = [];
      return [];
    }
    const seated = Object.values(game.players).filter((p) => !p.properties.spectator);
    const seatedIds = new Set(seated.map((p) => p.properties.playerId));
    // Drop ids that left; a re-join lands at the end of the order.
    joinOrderRef.current = joinOrderRef.current.filter((id) => seatedIds.has(id));
    for (const p of seated) {
      const id = p.properties.playerId;
      if (!joinOrderRef.current.includes(id)) {
        joinOrderRef.current.push(id);
      }
    }
    const byId = new Map(seated.map((p) => [p.properties.playerId, p]));
    return joinOrderRef.current.map((id) => {
      const p = byId.get(id)!;
      return {
        playerId: id,
        name: p.properties.userInfo?.name ?? `p${id}`,
      };
    });
  }, [game]);

  const localPlayerId = game?.localPlayerId;
  const isSpectator = game?.spectator ?? false;

  useEffect(() => {
    if (players.length === 0) {
      return;
    }

    setSlots((prev) => {
      const ids = players.map((p) => p.playerId);
      const aValid = prev.a != null && ids.includes(prev.a);
      let nextA = prev.a;
      if (!aValid) {
        if (!isSpectator && localPlayerId != null && ids.includes(localPlayerId)) {
          nextA = localPlayerId;
        } else {
          nextA = ids[0];
        }
      }

      const bValid = prev.b != null && ids.includes(prev.b) && prev.b !== nextA;
      let nextB = prev.b;
      if (players.length < 2) {
        // Lone player: leave slot B unfilled so we don't render the same
        // player on both sides of the board.
        nextB = undefined;
      } else if (!bValid) {
        nextB = ids.find((id) => id !== nextA);
      }

      if (nextA === prev.a && nextB === prev.b) {
        return prev;
      }
      return { a: nextA, b: nextB };
    });
  }, [players, localPlayerId, isSpectator]);

  const setSlotAPlayerId = (id: number) => {
    setSlots((prev) => (prev.b === id ? { a: id, b: prev.a } : { ...prev, a: id }));
  };
  const setSlotBPlayerId = (id: number) => {
    setSlots((prev) => (prev.a === id ? { a: prev.b, b: id } : { ...prev, b: id }));
  };

  return {
    players,
    slotAPlayerId: slots.a,
    slotBPlayerId: slots.b,
    setSlotAPlayerId,
    setSlotBPlayerId,
    revealPlayers: players,
  };
}
