import { ZoneName } from '@cockatrice/sockatrice';
import {
  CardAttribute,
  type Event_AttachCard,
  type Event_ChangeZoneProperties,
  type Event_CreateToken,
  type Event_DumpZone,
  type Event_FlipCard,
  type Event_MoveCard,
  type Event_RevealCards,
  type Event_RollDie,
  type Event_SetCardAttr,
  type Event_SetCardCounter,
  type Event_SetCounter,
  type ServerInfo_Arrow,
  type ServerInfo_PlayerProperties,
} from '@cockatrice/sockatrice/generated';
import type { Enriched } from '../../types';
import type { LogDescriptor, LogEntry, LogKind, LogParamsByKind, LogPlayer, LogTone } from '../../types/gameLog';
import { renderLegacyLog } from './messageLog.legacy';

export type {
  LogDescriptor, LogEntry, LogKind, LogParamsByKind, LogPlayer, LogSegment, LogSegmentKind, LogTone,
} from '../../types/gameLog';

export const EVENT_PLAYER_ID_SYSTEM = -1;

export function logPlayer(game: Enriched.GameEntry, id: number): LogPlayer {
  return { id, name: id < 0 ? undefined : game.players[id]?.properties.userInfo?.name };
}

function entry<K extends LogKind>(kind: K, params: LogParamsByKind[K]): LogEntry {
  const descriptor = { kind, params } as LogDescriptor;
  return { ...descriptor, ...renderLegacyLog(descriptor) };
}

export interface CardMovedContext { resolvedCardName: string }

export function formatCardMoved(
  game: Enriched.GameEntry,
  actingPlayerId: number,
  data: Event_MoveCard,
  ctx: CardMovedContext,
): LogEntry | null {
  if (data.startZone === data.targetZone && (
    (data.startZone === ZoneName.TABLE && data.startPlayerId === data.targetPlayerId)
    || data.startZone === ZoneName.HAND || data.startZone === ZoneName.EXILE
  )) {
    return null;
  }
  return entry('cardMoved', {
    actor: logPlayer(game, actingPlayerId),
    sourceOwner: logPlayer(game, data.startPlayerId),
    targetOwner: logPlayer(game, data.targetPlayerId),
    cardName: data.cardName || ctx.resolvedCardName,
    startZone: data.startZone,
    targetZone: data.targetZone,
    position: data.position,
    targetPosition: data.x,
    sourceCount: game.players[data.startPlayerId]?.zones[data.startZone]?.cardCount ?? 0,
    targetCount: game.players[data.targetPlayerId]?.zones[data.targetZone]?.cardCount ?? 0,
    faceDown: data.faceDown,
  });
}

export function formatCardFlipped(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_FlipCard,
  previousName: string | undefined,
): LogEntry {
  return entry('cardFlipped', {
    actor: logPlayer(game, playerId), cardName: data.cardName || previousName || '', faceDown: data.faceDown,
  });
}

export function formatCardDestroyed(
  game: Enriched.GameEntry,
  playerId: number,
  cardName: string | undefined,
): LogEntry {
  return entry('cardDestroyed', { actor: logPlayer(game, playerId), cardName: cardName ?? '' });
}

export function formatCardAttached(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_AttachCard,
  sourceCardName: string | undefined,
): LogEntry {
  return entry('cardAttached', {
    actor: logPlayer(game, playerId), cardName: sourceCardName ?? '',
    targetOwner: logPlayer(game, data.targetPlayerId),
    targetCardName: game.players[data.targetPlayerId]?.zones[data.targetZone]?.byId[data.targetCardId]?.name ?? '',
    detached: data.targetCardId < 0 || !data.targetZone,
  });
}

export function formatTokenCreated(game: Enriched.GameEntry, playerId: number, data: Event_CreateToken): LogEntry {
  return entry('tokenCreated', {
    actor: logPlayer(game, playerId), cardName: data.cardName, faceDown: data.faceDown, pt: data.pt,
  });
}

export function formatCardAttrChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardAttr,
  cardName: string | undefined,
  previousPT?: string,
): LogEntry | null {
  switch (data.attribute as CardAttribute) {
    case CardAttribute.AttrAttacking:
      if (data.attrValue !== '1') {
        return null;
      }
      break;
    case CardAttribute.AttrTapped:
    case CardAttribute.AttrPT:
    case CardAttribute.AttrAnnotation:
    case CardAttribute.AttrDoesntUntap:
      break;
    default:
      return null;
  }
  return entry('cardAttrChanged', {
    actor: logPlayer(game, playerId), cardName: cardName ?? '',
    attribute: data.attribute, value: data.attrValue, previousPT: previousPT ?? '',
  });
}

export function formatCardAttrChangedBulk(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardAttr,
): LogEntry | null {
  return data.attribute === CardAttribute.AttrTapped
    ? entry('cardAttrChangedBulk', { actor: logPlayer(game, playerId), tapped: data.attrValue === '1' }) : null;
}

export function formatCardCounterChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardCounter,
  cardName: string | undefined,
  previousValue: number,
): LogEntry {
  return entry('cardCounterChanged', {
    actor: logPlayer(game, playerId), cardName: cardName ?? '', counterId: data.counterId, value: data.counterValue, previousValue,
  });
}

export function formatCounterSet(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCounter,
  counterName: string | undefined,
  previousValue: number,
): LogEntry {
  return entry('counterSet', {
    actor: logPlayer(game, playerId), counterId: data.counterId, counterName: counterName ?? '', value: data.value, previousValue,
  });
}

export function formatCardsDrawn(game: Enriched.GameEntry, playerId: number, count: number): LogEntry {
  return entry('cardsDrawn', { actor: logPlayer(game, playerId), count });
}

export function formatCardUndoneDraw(game: Enriched.GameEntry, playerId: number, cardName: string): LogEntry {
  return entry('cardUndoneDraw', { actor: logPlayer(game, playerId), cardName });
}

export function formatUndoDrawFailed(game: Enriched.GameEntry, playerId: number): LogEntry {
  return entry('undoDrawFailed', { actor: logPlayer(game, playerId) });
}

export function formatZoneShuffled(game: Enriched.GameEntry, playerId: number): LogEntry {
  return entry('zoneShuffled', { actor: logPlayer(game, playerId) });
}

export function formatCardPeeked(
  game: Enriched.GameEntry,
  playerId: number,
  cardId: number,
  cardName: string,
): LogEntry {
  return entry('cardPeeked', { actor: logPlayer(game, playerId), cardId, cardName });
}

export function formatCardsRevealed(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_RevealCards,
): LogEntry | null {
  let mode: 'zone' | 'top' | 'cards';
  let count = 0;
  if (data.cardId.length === 0) {
    mode = 'zone';
  } else if (data.cardId.length === 1 && data.cardId[0] === 0) {
    mode = 'top';
    count = data.numberOfCards || data.cards.length;
    if (count <= 0) {
      return null;
    }
  } else if (data.cards.length === 0) {
    mode = 'cards';
    count = data.cardId.length;
  } else {
    return null;
  }
  return entry('cardsRevealed', {
    actor: logPlayer(game, playerId), zoneName: data.zoneName,
    target: data.otherPlayerId >= 0 ? logPlayer(game, data.otherPlayerId) : null,
    mode, count, lend: data.grantWriteAccess,
  });
}

export function formatZoneDumped(game: Enriched.GameEntry, playerId: number, data: Event_DumpZone): LogEntry {
  return entry('zoneDumped', {
    actor: logPlayer(game, playerId), owner: logPlayer(game, data.zoneOwnerId), zoneName: data.zoneName, count: data.numberCards,
  });
}

export function formatZonePropertiesChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_ChangeZoneProperties,
): LogEntry {
  return entry('zonePropertiesChanged', {
    actor: logPlayer(game, playerId), zoneName: data.zoneName, reveal: data.alwaysRevealTopCard, look: data.alwaysLookAtTopCard,
  });
}

export function formatActivePhaseSet(phase: number): LogEntry {
  return entry('activePhaseSet', { phase });
}

export function formatActivePlayerSet(game: Enriched.GameEntry, playerId: number): LogEntry {
  return entry('activePlayerSet', { actor: logPlayer(game, playerId) });
}

export function formatTurnReversed(game: Enriched.GameEntry, playerId: number, reversed: boolean): LogEntry {
  return entry('turnReversed', { actor: logPlayer(game, playerId), reversed });
}

export function formatDieRolled(game: Enriched.GameEntry, playerId: number, data: Event_RollDie): LogEntry {
  const rolls = data.values?.length ? [...data.values] : data.value ? [data.value] : [];
  return entry('dieRolled', { actor: logPlayer(game, playerId), sides: data.sides, rolls });
}

export function formatPlayerJoined(game: Enriched.GameEntry, playerId: number): LogEntry {
  return entry('playerJoined', { actor: logPlayer(game, playerId) });
}

export function formatLeaveMessage(player: string | LogPlayer, reason: number): LogEntry {
  const actor = typeof player === 'string' ? { name: player } : { ...player, name: player.name ?? '' };
  return entry('playerLeft', { actor, reason });
}

export function formatGameStart(): LogEntry {
  return entry('gameStarted', {});
}
export function formatGameClosed(): LogEntry {
  return entry('gameClosed', {});
}
export function formatReplayStarted(gameId: number): LogEntry {
  return entry('replayStarted', { gameId });
}

export function formatArrowCreated(game: Enriched.GameEntry, playerId: number, arrow: ServerInfo_Arrow): LogEntry {
  return entry('arrowCreated', {
    actor: logPlayer(game, playerId), sourceOwner: logPlayer(game, arrow.startPlayerId), targetOwner: logPlayer(game, arrow.targetPlayerId),
    sourceCardName: game.players[arrow.startPlayerId]?.zones[arrow.startZone]?.byId[arrow.startCardId]?.name ?? '',
    targetCardName: game.players[arrow.targetPlayerId]?.zones[arrow.targetZone]?.byId[arrow.targetCardId]?.name ?? '',
    playerTarget: arrow.targetCardId < 0 || !arrow.targetZone,
  });
}

interface PropertyDiff {
  conceded?: boolean;
  unconceded?: boolean;
  ready?: boolean;
  unready?: boolean;
  sideboardLocked?: boolean;
  sideboardUnlocked?: boolean;
  deckLoaded?: { hash: string };
}

export function diffPlayerProperties(
  previous: ServerInfo_PlayerProperties,
  next: ServerInfo_PlayerProperties,
): PropertyDiff {
  const diff: PropertyDiff = {};
  if (!previous.conceded && next.conceded) {
    diff.conceded = true;
  }
  if (previous.conceded && !next.conceded) {
    diff.unconceded = true;
  }
  if (!previous.readyStart && next.readyStart) {
    diff.ready = true;
  }
  if (previous.readyStart && !next.readyStart) {
    diff.unready = true;
  }
  if (!previous.sideboardLocked && next.sideboardLocked) {
    diff.sideboardLocked = true;
  }
  if (previous.sideboardLocked && !next.sideboardLocked) {
    diff.sideboardUnlocked = true;
  }
  if (previous.deckHash !== next.deckHash && next.deckHash) {
    diff.deckLoaded = { hash: next.deckHash };
  }
  return diff;
}

export function formatPropertyDiff(game: Enriched.GameEntry, playerId: number, diff: PropertyDiff): LogEntry[] {
  const actor = logPlayer(game, playerId);
  const messages: LogEntry[] = [];
  if (diff.conceded) {
    messages.push(entry('playerConceded', { actor }));
  }
  if (diff.unconceded) {
    messages.push(entry('playerUnconceded', { actor }));
  }
  if (diff.ready) {
    messages.push(entry('playerReady', { actor }));
  }
  if (diff.unready) {
    messages.push(entry('playerUnready', { actor }));
  }
  if (diff.sideboardLocked) {
    messages.push(entry('sideboardLocked', { actor }));
  }
  if (diff.sideboardUnlocked) {
    messages.push(entry('sideboardUnlocked', { actor }));
  }
  if (diff.deckLoaded) {
    messages.push(entry('deckLoaded', { actor, hash: diff.deckLoaded.hash }));
  }
  return messages;
}

export function logTone(kind: LogKind): LogTone {
  switch (kind) {
    case 'activePhaseSet': return 'phase';
    case 'activePlayerSet': return 'turn';
    case 'gameStarted': case 'gameClosed': case 'replayStarted':
    case 'playerJoined': case 'playerLeft': case 'playerConceded': case 'playerUnconceded':
    case 'playerReady': case 'playerUnready': case 'sideboardLocked': case 'sideboardUnlocked':
    case 'deckLoaded': case 'undoDrawFailed': return 'system';
    default: return 'action';
  }
}

export function classifyLogTone(input: string | LogEntry): LogTone {
  if (typeof input !== 'string' && input.kind) {
    return logTone(input.kind);
  }
  const text = typeof input === 'string' ? input : input.text;
  if (/^It is now the /.test(text)) {
    return 'phase';
  }
  if (/'s turn\.$/.test(text)) {
    return 'turn';
  }
  if (/^The game has (started|been closed)\.$/.test(text)
    || /^You are watching a replay of game #/.test(text)
    || / has joined the game\.$/.test(text) || / has left the game/.test(text)
    || / has (?:un)?conceded the game\.$/.test(text) || / is (?:not )?ready to start the game/.test(text)
    || / has (?:un)?locked their sideboard\.$/.test(text) || / has loaded a deck /.test(text)
    || / failed to undo their last draw\.$/.test(text)) {
    return 'system';
  }
  return 'action';
}
