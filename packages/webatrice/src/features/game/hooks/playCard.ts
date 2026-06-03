import { ZoneName } from '@cockatrice/sockatrice';
import type { WebClient } from '@cockatrice/sockatrice';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { ZoneEntry } from '@cockatrice/datatrice';
import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import {
  applyInvertY,
  gridXFromColumn,
  nextAvailableColumn,
} from '../components/battlefield/Battlefield/gridMath';

// tableRow=3 → stack; 0/1/2 → battlefield with per-row default.
// tableZone picks fresh column (undefined → col 0). isInverted = useBattlefield's flag.
export async function playCardViaTableRow({
  webClient,
  gameId,
  sourcePlayerId,
  sourceZone,
  card,
  faceDown,
  isInverted,
  tableZone,
  judgeTargetId,
}: {
  webClient: WebClient;
  gameId: number;
  sourcePlayerId: number;
  sourceZone: string;
  card: ServerInfo_Card;
  faceDown: boolean;
  isInverted: boolean;
  tableZone: ZoneEntry | undefined;
  // Owner to run the play as when a judge plays a foreign card (Command_Judge);
  // undefined for own cards (sent bare). See useJudgeTarget.
  judgeTargetId?: number;
}): Promise<string> {
  // `<tablerow>` is a top-level element on `<card>`, not inside `<prop>`.
  const meta = await CardDTO.get(card.name).catch(() => undefined);
  const tablerowRaw = meta?.tablerow?.value;
  const tablerow =
    tablerowRaw != null && /^\d+$/.test(tablerowRaw) ? Number(tablerowRaw) : null;

  if (tablerow === 3) {
    // A card is played onto its owner's own stack; for own cards
    // sourcePlayerId === localPlayerId, so this is unchanged for non-judge plays.
    webClient.request.game.moveCard(gameId, {
      startPlayerId: sourcePlayerId,
      startZone: sourceZone,
      cardsToMove: { card: [{ cardId: card.id, faceDown }] },
      targetPlayerId: sourcePlayerId,
      targetZone: ZoneName.STACK,
      x: 0,
      y: 0,
      isReversed: false,
    }, judgeTargetId);
    return ZoneName.STACK;
  }

  // tablerow 0/1/2 → visualY 2/1/0 (top-of-player-view); unknown → top row.
  const visualY =
    tablerow === 0 || tablerow === 1 || tablerow === 2 ? 2 - tablerow : 0;
  const wireY = applyInvertY(visualY, isInverted);

  // Fresh stack column at the right edge of the target row.
  const rowCards = tableZone
    ? tableZone.order.map((id) => tableZone.byId[id]).filter((c): c is ServerInfo_Card => !!c)
    : [];
  const nextCol = nextAvailableColumn(rowCards, wireY);

  webClient.request.game.moveCard(gameId, {
    startPlayerId: sourcePlayerId,
    startZone: sourceZone,
    cardsToMove: { card: [{ cardId: card.id, faceDown }] },
    targetPlayerId: sourcePlayerId,
    targetZone: ZoneName.TABLE,
    x: gridXFromColumn(nextCol),
    y: wireY,
    isReversed: false,
  }, judgeTargetId);
  return ZoneName.TABLE;
}
