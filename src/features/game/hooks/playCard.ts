import type { WebClient } from '@cockatrice/sockatrice';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { ZoneEntry, ZoneName } from '@cockatrice/datatrice';
import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { MAX_SUBPOS, applyInvertY, clampRow } from '../components/battlefield/Battlefield/gridMath';

// Mirrors desktop's player_actions.cpp:47-93 (PlayerActions::playCard) — the
// destination zone is chosen from CardInfo's `tableRow`. tableRow=3 routes to
// the stack (instant/sorcery); 0/1/2 route to the battlefield with a
// per-row default that the user can later drag-correct.
//
// `tableZone` is the local player's TABLE zone (used to pick a fresh column);
// pass `undefined` if not yet hydrated and we'll drop into column 0.
//
// `isInverted` is the same flag useBattlefield computes
// (mirrored !== invertVerticalCoordinate). For the local player (who's never
// per-player mirrored when this UI fires), the only contributor is the user's
// invertVerticalCoordinate setting.
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
  // Cockatrice XML schema: `<tablerow>` is a top-level element on `<card>`
  // (not inside `<prop>`). See types/cards.ts and CockatriceXmlParser.spec.ts.
  const meta = await CardDTO.get(card.name).catch(() => undefined);
  const tablerowRaw = meta?.tablerow?.value;
  const tablerow =
    tablerowRaw != null && /^\d+$/.test(tablerowRaw) ? Number(tablerowRaw) : null;

  if (tablerow === 3) {
    webClient.request.game.moveCard(gameId, {
      startPlayerId: sourcePlayerId,
      startZone: sourceZone,
      // `face_down` is per-card on CardToMove, not on Command_MoveCard.
      cardsToMove: { card: [{ cardId: card.id, faceDown }] },
      targetPlayerId: localPlayerId,
      targetZone: ZoneName.STACK,
      x: 0,
      y: 0,
      isReversed: false,
    });
    return;
  }

  // tablerow 0=lands(bottom), 1=creatures(middle), 2=artifacts/enchantments
  // (top). Convert to player-perspective visualY (0 = top of player view),
  // then to wire y via applyInvertY. Missing/unknown tablerow defaults to
  // top row, matching the user's "default to top lane" preference.
  const visualY =
    tablerow === 0 || tablerow === 1 || tablerow === 2 ? 2 - tablerow : 0;
  const wireY = applyInvertY(visualY, isInverted);

  // Place the card in a fresh stack column at the right edge of the target
  // row, mirroring desktop's "play next to existing cards" placement.
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
    targetZone: ZoneName.TABLE,
    x: nextCol * MAX_SUBPOS,
    y: wireY,
    isReversed: false,
  });
}
