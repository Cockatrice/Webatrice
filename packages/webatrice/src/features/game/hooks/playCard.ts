import { ZoneName, type ZoneNameValue } from '@cockatrice/sockatrice';
import type { WebClient } from '@cockatrice/sockatrice';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import {
  placementForCard,
  playedCardFields,
  resolveCardTableRow,
  STACK_TABLE_ROW,
} from '../components/battlefield/Battlefield/cardPlacement';
import { readCardPlacement } from '../components/battlefield/Battlefield/readCardPlacement';
import { applyInvertY } from '../components/battlefield/Battlefield/gridMath';

const TABLEROW_LAND = 0;

export async function playCardViaTableRow({
  webClient,
  gameId,
  sourcePlayerId,
  sourceZone,
  card,
  faceDown,
  isInverted,
  judgeTargetId,
}: {
  webClient: WebClient;
  gameId: number;
  sourcePlayerId: number;
  sourceZone: string;
  card: ServerInfo_Card;
  faceDown: boolean;
  isInverted: boolean;
  // Owner to run the play as when a judge plays a foreign card (Command_Judge);
  // undefined for own cards (sent bare). See useJudgeTarget.
  judgeTargetId?: number;
}): Promise<ZoneNameValue> {
  // `<tablerow>` is a top-level element on `<card>`, not inside `<prop>`.
  const cardDatabase = await readCardPlacement(card.name);
  const placement = placementForCard(cardDatabase, faceDown);

  if (placement.zone === 'stack') {
    webClient.request.game.moveCard(gameId, {
      startPlayerId: sourcePlayerId,
      startZone: sourceZone,
      cardsToMove: { card: [{ cardId: card.id, faceDown }] },
      targetPlayerId: sourcePlayerId,
      targetZone: ZoneName.STACK,
      x: -1,
      y: 0,
      isReversed: false,
    }, judgeTargetId);
    return ZoneName.STACK;
  }

  const wireY = applyInvertY(placement.visualY, isInverted);

  webClient.request.game.moveCard(gameId, {
    startPlayerId: sourcePlayerId,
    startZone: sourceZone,
    cardsToMove: { card: [{ cardId: card.id, faceDown, ...playedCardFields(cardDatabase, faceDown) }] },
    targetPlayerId: sourcePlayerId,
    targetZone: ZoneName.TABLE,
    x: -1,
    y: wireY,
    isReversed: false,
  }, judgeTargetId);
  return ZoneName.TABLE;
}

// Double-click auto-play chain (hand → stack → grave/table). Distinct from
// `playCardViaTableRow`, which is the direct "play now" action from the card
// context menu — that keeps its old routing so an explicit Play still resolves
// in one step. The chain here inserts a stack stop for non-lands so spells
// resolve visibly, mirroring the physical MTG flow and desktop's
// PlayerActions::playCard with "Play all nonlands onto the stack":
//   hand + land           → table (bottom row) — matches the direct-play path
//   hand + instant/sorc   → stack
//   hand + other non-land → stack, or table when `playToStack` is off
//   stack + instant/sorc  → graveyard
//   stack + other         → table at the appropriate row (fall back to `playCardViaTableRow`)
//   any other source      → delegate to `playCardViaTableRow` (unchanged behavior)
export async function autoPlayCard(args: {
  webClient: WebClient;
  gameId: number;
  sourcePlayerId: number;
  sourceZone: string;
  card: ServerInfo_Card;
  faceDown: boolean;
  isInverted: boolean;
  judgeTargetId?: number;
  playToStack?: boolean;
}): Promise<ZoneNameValue> {
  const { webClient, gameId, sourcePlayerId, sourceZone, card, faceDown, judgeTargetId, playToStack = true } = args;

  if (faceDown) {
    return playCardViaTableRow(args);
  }

  if (sourceZone === ZoneName.HAND) {
    const tablerow = resolveCardTableRow(await readCardPlacement(card.name));
    if (tablerow === TABLEROW_LAND || (!playToStack && tablerow !== STACK_TABLE_ROW)) {
      return playCardViaTableRow(args);
    }
    webClient.request.game.moveCard(gameId, {
      startPlayerId: sourcePlayerId,
      startZone: sourceZone,
      cardsToMove: { card: [{ cardId: card.id, faceDown }] },
      targetPlayerId: sourcePlayerId,
      targetZone: ZoneName.STACK,
      x: -1,
      y: 0,
      isReversed: false,
    }, judgeTargetId);
    return ZoneName.STACK;
  }

  if (sourceZone === ZoneName.STACK) {
    const tablerow = resolveCardTableRow(await readCardPlacement(card.name));
    if (tablerow === STACK_TABLE_ROW) {
      webClient.request.game.moveCard(gameId, {
        startPlayerId: sourcePlayerId,
        startZone: sourceZone,
        cardsToMove: { card: [{ cardId: card.id, faceDown }] },
        targetPlayerId: sourcePlayerId,
        targetZone: ZoneName.GRAVE,
        x: 0,
        y: 0,
        isReversed: false,
      }, judgeTargetId);
      return ZoneName.GRAVE;
    }
    return playCardViaTableRow(args);
  }

  return playCardViaTableRow(args);
}
