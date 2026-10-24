import { ZoneName } from '@cockatrice/sockatrice';
import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

export interface StackSummaryItem {
  key: string;
  playerId: number;
  playerName: string | undefined;
  card: { name: string; scryfallId: string; annotation?: string };
}

interface StackSeat {
  properties: { playerId: number; userInfo?: { name?: string } };
  zones: Record<string, { order: number[]; byId: Record<number, ServerInfo_Card> } | undefined>;
}

export function summarizeStack(seats: readonly StackSeat[]): StackSummaryItem[] {
  const items: StackSummaryItem[] = [];
  for (const seat of seats) {
    const playerId = seat.properties.playerId;
    const stack = seat.zones[ZoneName.STACK];
    if (!stack) {
      continue;
    }
    for (const id of stack.order) {
      const card = stack.byId[id];
      items.push({
        key: `${playerId}:${id}`,
        playerId,
        playerName: seat.properties.userInfo?.name,
        card: {
          name: card?.name ?? '',
          scryfallId: card?.providerId ?? '',
          annotation: card?.annotation || undefined,
        },
      });
    }
  }
  return items;
}
