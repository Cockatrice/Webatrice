import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { GameEntry } from '@cockatrice/datatrice';

import { parseCardKey } from './CardRegistry/CardRegistryContext';

// Shared default so containers don't each allocate a per-render empty Set.
export const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

export interface SelectedCard {
  ownerPlayerId: number;
  zone: string;
  card: ServerInfo_Card;
}

// Keys whose card no longer exists (moved/removed since selection) are dropped.
export function resolveSelectedCards(
  game: GameEntry,
  keys: ReadonlySet<string>,
): SelectedCard[] {
  const out: SelectedCard[] = [];
  keys.forEach((key) => {
    const parsed = parseCardKey(key);
    if (!parsed) {
      return;
    }
    const card = game.players[parsed.playerId]?.zones[parsed.zone]?.byId[parsed.cardId];
    if (card) {
      out.push({ ownerPlayerId: parsed.playerId, zone: parsed.zone, card });
    }
  });
  return out;
}
