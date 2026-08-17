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

// Cockatrice cards.xml tablerow convention (see carddatabase_v4/cards.xsd):
//  0 = land, 1 = creature, 2 = other permanent, 3 = instant/sorcery.
const TABLEROW_LAND = 0;
const TABLEROW_INSTANT_SORCERY = 3;

async function readTablerow(cardName: string): Promise<number | null> {
  const meta = await CardDTO.get(cardName).catch(() => undefined);
  const raw = meta?.tablerow?.value;
  return raw != null && /^\d+$/.test(raw) ? Number(raw) : null;
}

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
  const tablerow = await readTablerow(card.name);

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

// Double-click auto-play chain (hand → stack → grave/table). Distinct from
// `playCardViaTableRow`, which is the direct "play now" action from the card
// context menu — that keeps its old routing so an explicit Play still resolves
// in one step. The chain here always inserts a stack stop for non-lands so
// spells resolve visibly, mirroring the physical MTG flow:
//   hand + land           → table (bottom row) — matches the direct-play path
//   hand + non-land       → stack
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
  tableZone: ZoneEntry | undefined;
  judgeTargetId?: number;
}): Promise<string> {
  const { webClient, gameId, sourcePlayerId, sourceZone, card, faceDown, judgeTargetId } = args;

  if (sourceZone === ZoneName.HAND) {
    const tablerow = await readTablerow(card.name);
    if (tablerow === TABLEROW_LAND) {
      return playCardViaTableRow(args);
    }
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

  if (sourceZone === ZoneName.STACK) {
    const tablerow = await readTablerow(card.name);
    if (tablerow === TABLEROW_INSTANT_SORCERY) {
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
