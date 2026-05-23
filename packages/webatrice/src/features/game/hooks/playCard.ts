import type { WebClient } from '@cockatrice/sockatrice';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched, ZoneEntry } from '@cockatrice/datatrice';
import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { MAX_SUBPOS, applyInvertY, clampRow } from '../components/battlefield/Battlefield/gridMath';

// tableRow=3 → stack; 0/1/2 → battlefield with per-row default. tableZone picks fresh column (undefined → col 0). isInverted = useBattlefield's flag.
export async function playCardViaTableRow({
  webClient,
  gameId,
  localPlayerId,
  sourcePlayerId,
  sourceZone,
  card,
  faceDown,
  isInverted,
  tableZone,
}: {
  webClient: WebClient;
  gameId: number;
  localPlayerId: number;
  sourcePlayerId: number;
  sourceZone: string;
  card: ServerInfo_Card;
  faceDown: boolean;
  isInverted: boolean;
  tableZone: ZoneEntry | undefined;
}): Promise<void> {
  // `<tablerow>` is a top-level element on `<card>`, not inside `<prop>`.
  const meta = await CardDTO.get(card.name).catch(() => undefined);
  const tablerowRaw = meta?.tablerow?.value;
  const tablerow =
    tablerowRaw != null && /^\d+$/.test(tablerowRaw) ? Number(tablerowRaw) : null;

  if (tablerow === 3) {
    webClient.request.game.moveCard(gameId, {
      startPlayerId: sourcePlayerId,
      startZone: sourceZone,
      cardsToMove: { card: [{ cardId: card.id, faceDown }] },
      targetPlayerId: localPlayerId,
      targetZone: Enriched.ZoneName.STACK,
      x: 0,
      y: 0,
      isReversed: false,
    });
    return;
  }

  // tablerow 0/1/2 → visualY 2/1/0 (top-of-player-view); unknown → top row.
  const visualY =
    tablerow === 0 || tablerow === 1 || tablerow === 2 ? 2 - tablerow : 0;
  const wireY = applyInvertY(visualY, isInverted);

  // Fresh stack column at the right edge of the target row.
  let nextCol = 0;
  if (tableZone) {
    for (const cardId of tableZone.order) {
      const c = tableZone.byId[cardId];
      if (!c || clampRow(c.y ?? 0) !== wireY) {
        continue;
      }
      const col = Math.floor((c.x ?? 0) / MAX_SUBPOS);
      if (col + 1 > nextCol) {
        nextCol = col + 1;
      }
    }
  }

  webClient.request.game.moveCard(gameId, {
    startPlayerId: sourcePlayerId,
    startZone: sourceZone,
    cardsToMove: { card: [{ cardId: card.id, faceDown }] },
    targetPlayerId: localPlayerId,
    targetZone: Enriched.ZoneName.TABLE,
    x: nextCol * MAX_SUBPOS,
    y: wireY,
    isReversed: false,
  });
}
