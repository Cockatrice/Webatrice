import { ZoneName } from '@cockatrice/sockatrice';
import { Enriched } from '../../types';
import { Event_MoveCard, ServerInfo_Card, ServerInfo_CardSchema } from '@cockatrice/sockatrice/generated';
import { cloneWith } from '../../common';
import type { GamesState } from './game.interfaces';
import { buildEmptyCard, resetCardState } from './game.reducer.helpers';
import { formatCardMoved, formatCardUndoneDraw, type LogEntry } from './messageLog';

export interface MoveIdentity {
  targetZone: string;
  crossesZones: boolean;
  cardId: number;
  newCardId: number;
  sourceCard?: ServerInfo_Card;
  hidden: boolean;
}

export function resolveMoveIdentity(sourceZone: Enriched.ZoneEntry, data: Event_MoveCard): MoveIdentity {
  const { cardId, startPlayerId, startZone, position, targetPlayerId, newCardId } = data;
  const targetZone = data.targetZone || startZone;

  let resolvedCardId = -1;
  if (cardId >= 0) {
    resolvedCardId = cardId;
  } else if (position >= 0 && position < sourceZone.order.length) {
    resolvedCardId = sourceZone.order[position];
  }
  const sourceCard = resolvedCardId >= 0 ? sourceZone.byId[resolvedCardId] : undefined;

  return {
    targetZone,
    crossesZones: startPlayerId !== targetPlayerId || startZone !== targetZone,
    cardId: resolvedCardId,
    newCardId: newCardId >= 0 ? newCardId : resolvedCardId,
    sourceCard,
    hidden: resolvedCardId < 0 && newCardId < 0,
  };
}

export function buildMovedCard(move: MoveIdentity, data: Event_MoveCard): ServerInfo_Card {
  const { cardName, x, y, faceDown, newCardProviderId } = data;
  const { sourceCard } = move;
  const card = sourceCard
    ? cloneWith(ServerInfo_CardSchema, sourceCard, {
      id: move.newCardId,
      name: cardName || sourceCard.name,
      x, y, faceDown,
      providerId: newCardProviderId || sourceCard.providerId,
      counterList: [...sourceCard.counterList],
    })
    : buildEmptyCard(move.newCardId, cardName, x, y, faceDown, newCardProviderId);

  const leavesBattlefield = data.startZone === ZoneName.TABLE && move.targetZone !== ZoneName.TABLE;
  return leavesBattlefield ? resetCardState(card, move.targetZone === ZoneName.STACK) : card;
}

const POSITIONAL_REORDER_ZONES: readonly string[] = [ZoneName.HAND, ZoneName.STACK, ZoneName.GRAVE, ZoneName.EXILE];

export type MovePlacement = 'count-transfer' | 'none' | 'view-reorder' | 'same-zone' | 'between-zones';

export function planMovePlacement(
  move: MoveIdentity,
  sourceZone: Enriched.ZoneEntry,
  data: Event_MoveCard,
): MovePlacement {
  const inOpenView = !move.crossesZones && !!sourceZone.revealedCards && data.position >= 0;
  if (inOpenView) {
    return 'view-reorder';
  }
  if (move.hidden) {
    return move.crossesZones ? 'count-transfer' : 'none';
  }
  if (!move.crossesZones && POSITIONAL_REORDER_ZONES.includes(move.targetZone) && move.cardId >= 0) {
    return 'same-zone';
  }
  return 'between-zones';
}

export type OptimisticReconcile =
  | { kind: 'migrate'; card: ServerInfo_Card }
  | { kind: 'patch'; fields: Pick<ServerInfo_Card, 'x' | 'y' | 'faceDown'> };

export function planOptimisticReconcile(
  targetZone: Enriched.ZoneEntry | undefined,
  optimisticId: number,
  movedCard: ServerInfo_Card,
): OptimisticReconcile | null {
  if (!targetZone) {
    return null;
  }
  const serverId = movedCard.id;
  const optimisticCard = targetZone.byId[optimisticId];
  if (serverId !== optimisticId && optimisticCard !== undefined && targetZone.byId[serverId] === undefined) {
    return {
      kind: 'migrate',
      card: cloneWith(ServerInfo_CardSchema, optimisticCard, {
        id: serverId,
        x: movedCard.x,
        y: movedCard.y,
        faceDown: movedCard.faceDown,
        name: movedCard.name || optimisticCard.name,
        providerId: movedCard.providerId || optimisticCard.providerId,
      }),
    };
  }
  if (targetZone.byId[serverId]) {
    return { kind: 'patch', fields: { x: movedCard.x, y: movedCard.y, faceDown: movedCard.faceDown } };
  }
  return null;
}

export interface ZoneViewSync {
  removeAt?: number;
  clearTop: boolean;
  insertAt?: number;
}

export function planZoneViewSync(
  move: MoveIdentity,
  sourceZone: Enriched.ZoneEntry,
  targetZone: Enriched.ZoneEntry,
  data: Event_MoveCard,
): ZoneViewSync {
  const { position, startZone, x } = data;
  return {
    removeAt: sourceZone.revealedCards && move.crossesZones && position >= 0 ? position : undefined,
    clearTop: position === 0 && startZone === ZoneName.DECK,
    insertAt: targetZone.revealedCards && move.crossesZones ? x : undefined,
  };
}

export function sweepsArrows(move: MoveIdentity): boolean {
  return move.cardId >= 0 && move.crossesZones;
}

export interface ArrowRef {
  ownerPlayerId: number;
  arrowId: number;
}

export function arrowsTouchingCard(
  games: GamesState,
  gameId: number,
  playerId: number,
  zoneName: string,
  cardId: number,
): ArrowRef[] {
  const refs: ArrowRef[] = [];
  for (const [ownerId, owner] of Object.entries(games.games[gameId]?.players ?? {})) {
    for (const arrow of Object.values(owner.arrows)) {
      const fromCard = arrow.startPlayerId === playerId && arrow.startZone === zoneName && arrow.startCardId === cardId;
      const toCard = arrow.targetPlayerId === playerId && arrow.targetZone === zoneName && arrow.targetCardId === cardId;
      if (fromCard || toCard) {
        refs.push({ ownerPlayerId: Number(ownerId), arrowId: arrow.id });
      }
    }
  }
  return refs;
}

export function planAttachmentReparent(
  move: MoveIdentity,
  data: Event_MoveCard,
): { fromPlayerId: number; fromCardId: number; toPlayerId: number; toCardId: number } | null {
  if (move.cardId < 0 || data.startZone !== ZoneName.TABLE || move.targetZone !== ZoneName.TABLE) {
    return null;
  }
  return {
    fromPlayerId: data.startPlayerId,
    fromCardId: move.cardId,
    toPlayerId: data.targetPlayerId,
    toCardId: move.newCardId,
  };
}

export function cardMovedLogEntry(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_MoveCard,
  move: MoveIdentity,
  isUndoDraw: boolean,
): LogEntry | null {
  const knownName = move.sourceCard?.name;
  if (isUndoDraw) {
    return formatCardUndoneDraw(game, playerId, knownName ?? data.cardName);
  }
  return formatCardMoved(game, playerId, { ...data, targetZone: move.targetZone }, { resolvedCardName: knownName ?? '' });
}
