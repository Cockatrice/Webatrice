import { Enriched } from '@cockatrice/datatrice';

/**
 * Resolve the destination player for a moveCard command.
 *
 * Mirrors Servatrice's rule (server_abstract_player.cpp:274-278): a move into a
 * non-table zone is only accepted into the tree the card already sits in, so its
 * destination player is the card's owner — never the local actor or the dropped-on
 * zone's owner. A controlled card (which stays in its owner's tree) therefore
 * routes to the owner's grave/hand/exile/library; for a self-owned card the owner
 * already is the local player, so it's a no-op.
 *
 * TABLE is the one zone that accepts cross-player moves (a legal control-change),
 * so there the explicitly requested target player is kept.
 */
export function moveTargetPlayerId(
  ownerPlayerId: number,
  targetZone: string,
  tableTargetPlayerId: number,
): number {
  return targetZone === Enriched.ZoneName.TABLE ? tableTargetPlayerId : ownerPlayerId;
}
