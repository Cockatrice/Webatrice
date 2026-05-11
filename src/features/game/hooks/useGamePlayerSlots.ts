import { useEffect, useMemo, useState } from 'react';

import type { Enriched } from '@app/types';

export interface PlayerSlotEntry {
  playerId: number;
  name: string;
}

export interface GamePlayerSlots {
  /** All non-spectator players in the current game, sorted by playerId. */
  players: PlayerSlotEntry[];
  slotAPlayerId: number | undefined;
  slotBPlayerId: number | undefined;
  setSlotAPlayerId: (id: number) => void;
  setSlotBPlayerId: (id: number) => void;
  /** Convenience list for the reveal-cards dialog (same as `players`). */
  revealPlayers: PlayerSlotEntry[];
}

export function useGamePlayerSlots(
  game: Enriched.GameEntry | undefined,
): GamePlayerSlots {
  const [slotAPlayerId, setSlotAPlayerId] = useState<number | undefined>();
  const [slotBPlayerId, setSlotBPlayerId] = useState<number | undefined>();

  const players = useMemo<PlayerSlotEntry[]>(() => {
    if (!game) {
      return [];
    }
    return Object.values(game.players)
      .filter((p) => !p.properties.spectator)
      .sort((a, b) => a.properties.playerId - b.properties.playerId)
      .map((p) => ({
        playerId: p.properties.playerId,
        name: p.properties.userInfo?.name ?? `p${p.properties.playerId}`,
      }));
  }, [game]);

  const localPlayerId = game?.localPlayerId;
  const isSpectator = game?.spectator ?? false;

  useEffect(() => {
    if (players.length === 0) {
      return;
    }

    const slotAValid = slotAPlayerId != null && players.some((p) => p.playerId === slotAPlayerId);
    let resolvedA = slotAPlayerId;
    if (!slotAValid) {
      // Active player: default slot A to themselves (if seated, i.e. not a spectator).
      // Spectator: default to the first seated player.
      if (!isSpectator && localPlayerId != null && players.some((p) => p.playerId === localPlayerId)) {
        resolvedA = localPlayerId;
      } else {
        resolvedA = players[0].playerId;
      }
      setSlotAPlayerId(resolvedA);
    }

    const slotBValid = slotBPlayerId != null && players.some((p) => p.playerId === slotBPlayerId);
    if (!slotBValid) {
      // Slot B defaults to the first seated player who is NOT in slot A.
      // Falls back to slot A's id if there is only one seated player.
      const other = players.find((p) => p.playerId !== resolvedA) ?? players[0];
      setSlotBPlayerId(other.playerId);
    }
  }, [players, localPlayerId, isSpectator, slotAPlayerId, slotBPlayerId]);

  return {
    players,
    slotAPlayerId,
    slotBPlayerId,
    setSlotAPlayerId,
    setSlotBPlayerId,
    revealPlayers: players,
  };
}
