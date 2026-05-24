import { App, Enriched } from '../../types';
import {
  CardAttribute,
  Event_AttachCard,
  Event_ChangeZoneProperties,
  Event_CreateToken,
  Event_DumpZone,
  Event_FlipCard,
  Event_MoveCard,
  Event_RollDie,
  Event_SetCardAttr,
  Event_SetCardCounter,
  Event_SetCounter,
  ServerInfo_Arrow,
  ServerInfo_PlayerProperties,
} from '@cockatrice/sockatrice/generated';

// @critical proto2 wire default for GameEvent.player_id — must be -1, not 0. 0 is a valid player id.
// See .github/instructions/datatrice-game.instructions.md#servatrice-game-event-quirks.
export const EVENT_PLAYER_ID_SYSTEM = -1;

function nameOf(game: Enriched.GameEntry, playerId: number): string {
  if (playerId < 0) {
    return 'The server';
  }
  return game.players[playerId]?.properties.userInfo?.name ?? `Player ${playerId}`;
}

function zoneLabel(zoneName: string): string {
  switch (zoneName) {
    case Enriched.ZoneName.TABLE: return 'the battlefield';
    case Enriched.ZoneName.HAND: return 'their hand';
    case Enriched.ZoneName.GRAVE: return 'their graveyard';
    case Enriched.ZoneName.EXILE: return 'exile';
    case Enriched.ZoneName.DECK: return 'their library';
    case Enriched.ZoneName.SIDEBOARD: return 'their sideboard';
    case Enriched.ZoneName.STACK: return 'the stack';
    default: return `custom zone '${zoneName}'`;
  }
}

const PHASE_NAMES: Record<number, string> = {
  [App.Phase.Untap]: 'untap step',
  [App.Phase.Upkeep]: 'upkeep step',
  [App.Phase.Draw]: 'draw step',
  [App.Phase.FirstMain]: 'first main phase',
  [App.Phase.BeginCombat]: 'beginning of combat',
  [App.Phase.DeclareAttackers]: 'declare attackers step',
  [App.Phase.DeclareBlockers]: 'declare blockers step',
  [App.Phase.CombatDamage]: 'combat damage step',
  [App.Phase.EndCombat]: 'end of combat',
  [App.Phase.SecondMain]: 'second main phase',
  [App.Phase.EndCleanup]: 'end step',
};

function phaseName(phase: number): string {
  return PHASE_NAMES[phase] ?? `phase ${phase}`;
}

function cardDescriptor(cardName: string | undefined): string {
  if (!cardName) {
    return 'a card';
  }
  return cardName;
}

function isSameZoneReorder(startZone: string, targetZone: string, sameOwner: boolean): boolean {
  if (!sameOwner && (startZone === Enriched.ZoneName.TABLE && targetZone === Enriched.ZoneName.TABLE)) {
    return false;
  }
  return (
    (sameOwner && startZone === Enriched.ZoneName.TABLE && targetZone === Enriched.ZoneName.TABLE) ||
    (startZone === Enriched.ZoneName.HAND && targetZone === Enriched.ZoneName.HAND) ||
    (startZone === Enriched.ZoneName.EXILE && targetZone === Enriched.ZoneName.EXILE)
  );
}

export interface CardMovedContext {
  resolvedCardName: string;
}

export function formatCardMoved(
  game: Enriched.GameEntry,
  actingPlayerId: number,
  data: Event_MoveCard,
  ctx: CardMovedContext,
): string | null {
  const sameOwner = data.startPlayerId === data.targetPlayerId;
  if (isSameZoneReorder(data.startZone, data.targetZone, sameOwner)) {
    return null;
  }

  const actor = nameOf(game, actingPlayerId);
  const card = cardDescriptor(data.cardName || ctx.resolvedCardName);

  if (!sameOwner && data.startPlayerId === actingPlayerId) {
    return `${actor} gives ${nameOf(game, data.targetPlayerId)} control over ${card}.`;
  }

  if (data.startZone === Enriched.ZoneName.HAND && data.targetZone === Enriched.ZoneName.TABLE) {
    return `${actor} plays ${card}.`;
  }

  if (data.targetZone === Enriched.ZoneName.HAND && data.startZone !== Enriched.ZoneName.HAND) {
    return `${actor} puts ${card} into ${sameOwner ? 'their hand' : `${nameOf(game, data.targetPlayerId)}'s hand`}.`;
  }

  const target = sameOwner
    ? zoneLabel(data.targetZone)
    : `${nameOf(game, data.targetPlayerId)}'s ${zoneLabel(data.targetZone).replace('their ', '')}`;
  return `${actor} moves ${card} to ${target}.`;
}

export function formatCardFlipped(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_FlipCard,
  previousName: string | undefined,
): string {
  const actor = nameOf(game, playerId);
  const name = cardDescriptor(data.cardName || previousName);
  return data.faceDown
    ? `${actor} flips ${name} face-down.`
    : `${actor} flips ${name} face-up.`;
}

export function formatCardDestroyed(
  game: Enriched.GameEntry,
  playerId: number,
  cardName: string | undefined,
): string {
  return `${nameOf(game, playerId)} destroys ${cardDescriptor(cardName)}.`;
}

export function formatCardAttached(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_AttachCard,
  sourceCardName: string | undefined,
): string {
  const actor = nameOf(game, playerId);
  const source = cardDescriptor(sourceCardName);
  if (data.targetCardId < 0 || !data.targetZone) {
    return `${actor} unattaches ${source}.`;
  }
  const targetPlayer = nameOf(game, data.targetPlayerId);
  const targetCard = cardDescriptor(
    game.players[data.targetPlayerId]?.zones[data.targetZone]?.byId[data.targetCardId]?.name,
  );
  return `${actor} attaches ${source} to ${targetPlayer}'s ${targetCard}.`;
}

export function formatTokenCreated(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_CreateToken,
): string {
  const actor = nameOf(game, playerId);
  if (data.faceDown) {
    return `${actor} creates a face-down token.`;
  }
  const pt = data.pt ? ` (${data.pt})` : '';
  return `${actor} creates token: ${data.cardName}${pt}.`;
}

export function formatCardAttrChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardAttr,
  cardName: string | undefined,
): string | null {
  const actor = nameOf(game, playerId);
  const card = cardDescriptor(cardName);
  switch (data.attribute as CardAttribute) {
    case CardAttribute.AttrTapped:
      return data.attrValue === '1' ? `${actor} taps ${card}.` : `${actor} untaps ${card}.`;
    case CardAttribute.AttrAttacking:
      return data.attrValue === '1' ? `${actor} declares ${card} as an attacker.` : null;
    case CardAttribute.AttrFaceDown:
      return null;
    case CardAttribute.AttrColor:
      return null;
    case CardAttribute.AttrPT:
      return data.attrValue
        ? `${actor} sets PT of ${card} to ${data.attrValue}.`
        : `${actor} clears the PT of ${card}.`;
    case CardAttribute.AttrAnnotation:
      return data.attrValue
        ? `${actor} sets annotation of ${card} to "${data.attrValue}".`
        : `${actor} clears the annotation on ${card}.`;
    case CardAttribute.AttrDoesntUntap:
      return data.attrValue === '1'
        ? `${actor} sets ${card} to not untap normally.`
        : `${actor} sets ${card} to untap normally.`;
    default:
      return null;
  }
}

export function formatCardCounterChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardCounter,
  cardName: string | undefined,
  previousValue: number,
): string {
  const actor = nameOf(game, playerId);
  const card = cardDescriptor(cardName);
  const delta = data.counterValue - previousValue;
  if (delta > 0) {
    return `${actor} puts ${delta} counter(s) on ${card} (total ${data.counterValue}).`;
  }
  if (delta < 0) {
    return `${actor} removes ${-delta} counter(s) from ${card} (total ${data.counterValue}).`;
  }
  return `${actor} sets counters on ${card} to ${data.counterValue}.`;
}

export function formatCounterSet(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCounter,
  counterName: string | undefined,
  previousValue: number,
): string {
  const actor = nameOf(game, playerId);
  const name = counterName ?? `counter ${data.counterId}`;
  const delta = data.value - previousValue;
  if (delta > 0) {
    return `${actor} increases their ${name} to ${data.value}.`;
  }
  if (delta < 0) {
    return `${actor} decreases their ${name} to ${data.value}.`;
  }
  return `${actor} sets their ${name} to ${data.value}.`;
}

export function formatCardsDrawn(
  game: Enriched.GameEntry,
  playerId: number,
  number: number,
): string {
  const actor = nameOf(game, playerId);
  return number === 1 ? `${actor} draws a card.` : `${actor} draws ${number} cards.`;
}

export function formatZoneShuffled(game: Enriched.GameEntry, playerId: number): string {
  return `${nameOf(game, playerId)} shuffles their library.`;
}

export function formatZoneDumped(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_DumpZone,
): string {
  const actor = nameOf(game, playerId);
  const count = data.numberCards;
  if (data.zoneOwnerId !== playerId) {
    const owner = nameOf(game, data.zoneOwnerId);
    return `${actor} looks at ${count} card(s) from the top of ${owner}'s ${zoneLabel(data.zoneName).replace('their ', '')}.`;
  }
  return `${actor} looks at ${count} card(s) from the top of ${zoneLabel(data.zoneName)}.`;
}

export function formatZonePropertiesChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_ChangeZoneProperties,
): string | null {
  const actor = nameOf(game, playerId);
  const zone = zoneLabel(data.zoneName);
  if (data.alwaysRevealTopCard) {
    return `${actor} is now revealing the top card of ${zone}.`;
  }
  if (data.alwaysLookAtTopCard) {
    return `${actor} can now look at the top card of ${zone}.`;
  }
  return `${actor} stops revealing/looking at the top card of ${zone}.`;
}

export function formatActivePhaseSet(phase: number): string {
  return `It is now the ${phaseName(phase)}.`;
}

export function formatActivePlayerSet(game: Enriched.GameEntry, activePlayerId: number): string {
  return `It is now ${nameOf(game, activePlayerId)}'s turn.`;
}

export function formatTurnReversed(game: Enriched.GameEntry, playerId: number, reversed: boolean): string {
  const actor = nameOf(game, playerId);
  return reversed
    ? `${actor} reverses the turn order.`
    : `${actor} restores the turn order.`;
}

export function formatDieRolled(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_RollDie,
): string {
  const actor = nameOf(game, playerId);
  const rolls = (data.values && data.values.length > 0) ? data.values : (data.value ? [data.value] : []);
  if (rolls.length === 0) {
    return `${actor} rolls a ${data.sides}-sided die.`;
  }
  if (rolls.length === 1) {
    return `${actor} rolls a ${rolls[0]} on a ${data.sides}-sided die.`;
  }
  return `${actor} rolls ${rolls.join(', ')} on ${rolls.length} ${data.sides}-sided dice.`;
}

export function formatPlayerJoined(game: Enriched.GameEntry, playerId: number): string {
  return `${nameOf(game, playerId)} has joined the game.`;
}

export function formatGameStart(): string {
  return 'The game has started.';
}

export function formatArrowCreated(
  game: Enriched.GameEntry,
  playerId: number,
  arrow: ServerInfo_Arrow,
): string {
  const actor = nameOf(game, playerId);
  const sourceCard = cardDescriptor(
    game.players[arrow.startPlayerId]?.zones[arrow.startZone]?.byId[arrow.startCardId]?.name,
  );
  const playerTarget = arrow.targetCardId < 0 || !arrow.targetZone;
  if (playerTarget) {
    return `${actor} points from ${sourceCard} to ${nameOf(game, arrow.targetPlayerId)}.`;
  }
  const targetCard = cardDescriptor(
    game.players[arrow.targetPlayerId]?.zones[arrow.targetZone]?.byId[arrow.targetCardId]?.name,
  );
  return `${actor} points from ${sourceCard} to ${targetCard}.`;
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

export function formatPropertyDiff(
  game: Enriched.GameEntry,
  playerId: number,
  diff: PropertyDiff,
): string[] {
  const actor = nameOf(game, playerId);
  const messages: string[] = [];
  if (diff.conceded) {
    messages.push(`${actor} has conceded the game.`);
  }
  if (diff.unconceded) {
    messages.push(`${actor} has unconceded the game.`);
  }
  if (diff.ready) {
    messages.push(`${actor} is ready to start the game.`);
  }
  if (diff.unready) {
    messages.push(`${actor} is no longer ready to start the game.`);
  }
  if (diff.sideboardLocked) {
    messages.push(`${actor} has locked their sideboard.`);
  }
  if (diff.sideboardUnlocked) {
    messages.push(`${actor} has unlocked their sideboard.`);
  }
  if (diff.deckLoaded) {
    messages.push(`${actor} has loaded a deck (${diff.deckLoaded.hash}).`);
  }
  return messages;
}
