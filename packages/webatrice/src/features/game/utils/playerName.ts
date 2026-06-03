import { PlayerEntry } from '@cockatrice/datatrice';

// The display name for a player, falling back to `p${id}` when the server hasn't
// sent a userInfo name yet. Shared by the reveal-target list, turn controls, and
// the game-info dialog so the fallback format stays consistent.
export function playerName(player: PlayerEntry): string {
  return player.properties.userInfo?.name ?? `p${player.properties.playerId}`;
}
