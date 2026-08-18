import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import type { Enriched } from '../../types';

/** A pending "someone revealed their zone to us" notification. Set when
 *  Event_RevealCards arrives with a non-empty `cards[]` (i.e. WE are on the
 *  receiving side of the reveal). Cleared when the user dismisses the
 *  IncomingRevealDialog. Only one at a time — a fresh reveal replaces
 *  any pending one so the UI never stacks multiple modals. */
export interface IncomingReveal {
  gameId: number;
  /** Player id of whoever revealed the zone (the source, not the target). */
  sourceOwnerId: number;
  /** Zone name from the event (e.g. "deck", "hand", "grave"). */
  zoneName: string;
  cards: ServerInfo_Card[];
  grantWriteAccess: boolean;
}

export interface GamesState {
  games: { [gameId: number]: Enriched.GameEntry };
  /** Optional so pre-existing fixtures that only stub the `games` map
   *  don't have to be updated. `getIncomingReveal` selector treats
   *  undefined and null the same (no reveal). */
  incomingReveal?: IncomingReveal | null;
}
