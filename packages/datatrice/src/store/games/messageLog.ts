import { ZoneName } from '@cockatrice/sockatrice';
import { App, Enriched } from '../../types';
import {
  CardAttribute,
  Event_AttachCard,
  Event_ChangeZoneProperties,
  Event_CreateToken,
  Event_DumpZone,
  Event_FlipCard,
  Event_MoveCard,
  Event_RevealCards,
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
    case ZoneName.TABLE: return 'the battlefield';
    case ZoneName.HAND: return 'their hand';
    case ZoneName.GRAVE: return 'their graveyard';
    case ZoneName.EXILE: return 'exile';
    case ZoneName.DECK: return 'their library';
    case ZoneName.SIDEBOARD: return 'their sideboard';
    case ZoneName.STACK: return 'the stack';
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
  if (!sameOwner && (startZone === ZoneName.TABLE && targetZone === ZoneName.TABLE)) {
    return false;
  }
  return (
    (sameOwner && startZone === ZoneName.TABLE && targetZone === ZoneName.TABLE) ||
    (startZone === ZoneName.HAND && targetZone === ZoneName.HAND) ||
    (startZone === ZoneName.EXILE && targetZone === ZoneName.EXILE)
  );
}

export interface CardMovedContext {
  resolvedCardName: string;
}

/**
 * Constructs the " from X" context clause that follows the card name in
 * move-card messages. Mirrors Cockatrice desktop's `getFromStr()` at
 * `message_log_widget.cpp:27-91`. Returns an empty string when the
 * source zone doesn't warrant one (safety fallback).
 */
function fromContext(
  game: Enriched.GameEntry,
  data: Event_MoveCard,
  actingIsSourceOwner: boolean,
): string {
  const sourceOwner = nameOf(game, data.startPlayerId);
  const owner = actingIsSourceOwner ? 'their' : `${sourceOwner}'s`;
  switch (data.startZone) {
    case ZoneName.TABLE:
      return ' from play';
    case ZoneName.GRAVE:
      return ' from their graveyard';
    case ZoneName.EXILE:
      return ' from exile';
    case ZoneName.HAND:
      return ' from their hand';
    case ZoneName.SIDEBOARD:
      return ' from sideboard';
    case ZoneName.STACK:
      return ' from the stack';
    case ZoneName.DECK: {
      // Reducer processes the move before the formatter runs, so
      // `cardCount` here is the post-move deck size. That means
      // `position === cardCount` implies the card sat at the last
      // pre-move index — i.e. was pulled from the bottom.
      const postCount =
        game.players[data.startPlayerId]?.zones[data.startZone]?.cardCount ?? 0;
      const position = data.position;
      if (position === 0) {
        return ` from the top of ${owner} library`;
      }
      if (postCount > 0 && position === postCount) {
        return ` from the bottom of ${owner} library`;
      }
      return ` from ${owner} library`;
    }
    default:
      return ` from custom zone '${data.startZone}'`;
  }
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
  const actingIsSourceOwner = data.startPlayerId === actingPlayerId;
  const from = fromContext(game, data, actingIsSourceOwner);
  const faceDown = data.faceDown ? ' face down' : '';

  // Cross-owner control-transfer stays out of the zone-specific
  // switch below — the desktop client logs this as a distinct event
  // even before the actual zone destination is announced.
  if (!sameOwner && data.startPlayerId === actingPlayerId) {
    return `${actor} gives ${nameOf(game, data.targetPlayerId)} control over ${card}.`;
  }

  // Format strings mirror Cockatrice desktop's `MessageLogWidget`
  // templates from `message_log_widget.cpp:308-352`.
  switch (data.targetZone) {
    case ZoneName.TABLE:
      // "%1 puts %2 into play%3[ face down]."
      return `${actor} puts ${card} into play${from}${faceDown}.`;
    case ZoneName.GRAVE:
      // "%1 puts %2%3 into their graveyard[ face down]."
      return `${actor} puts ${card}${from} into their graveyard${faceDown}.`;
    case ZoneName.EXILE:
      // "%1 exiles %2%3[ face down]."
      return `${actor} exiles ${card}${from}${faceDown}.`;
    case ZoneName.HAND:
      // Desktop: "%1 moves %2%3 to their hand." for the source-zone
      // variants; special-cased into "%1 takes %2 into their hand"
      // for library sources isn't in the widget — leave the generic
      // form here to match one-to-one behavior.
      return `${actor} puts ${card}${from} into ${sameOwner ? 'their hand' : `${nameOf(game, data.targetPlayerId)}'s hand`}.`;
    case ZoneName.DECK: {
      // Reducer already applied the move, so target `cardCount`
      // includes the just-added card. The server has already
      // resolved Command_MoveCard's `is_reversed` into an absolute
      // `x` on the event, so we just compare it against the pile
      // ends: 0 = top, cardCount - 1 = bottom, anything else is a
      // specific position mid-deck.
      const targetCount =
        game.players[data.targetPlayerId]?.zones[data.targetZone]?.cardCount ?? 0;
      const x = data.x;
      if (x <= 0) {
        return `${actor} puts ${card}${from} on top of their library.`;
      }
      if (targetCount > 0 && x >= targetCount - 1) {
        return `${actor} puts ${card}${from} onto the bottom of their library.`;
      }
      // "%1 puts %2%3 into their library %4 cards from the top."
      return `${actor} puts ${card}${from} into their library ${x + 1} cards from the top.`;
    }
    default:
      return `${actor} moves ${card}${from} to custom zone '${data.targetZone}'.`;
  }
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

export function formatCardAttrChangedBulk(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardAttr,
): string | null {
  const actor = nameOf(game, playerId);
  switch (data.attribute as CardAttribute) {
    case CardAttribute.AttrTapped:
      return data.attrValue === '1'
        ? `${actor} taps their permanents.`
        : `${actor} untaps their permanents.`;
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

/** Mirrors Cockatrice desktop's `TranslateCounterName::translated` map
 *  in `translate_counter_name.cpp` — converts the wire counter name
 *  (single lowercase letter for mana, or an explicit tag) to the
 *  chat-log display name. Unknown names fall through unchanged. */
const COUNTER_DISPLAY_NAME: Record<string, string> = {
  life: 'Life',
  w: 'White',
  u: 'Blue',
  b: 'Black',
  r: 'Red',
  g: 'Green',
  x: 'Colorless',
  storm: 'Other',
};

function displayCounterName(name: string | undefined): string {
  if (!name) return 'counter';
  return COUNTER_DISPLAY_NAME[name.toLowerCase()] ?? name;
}

export function formatCounterSet(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCounter,
  counterName: string | undefined,
  previousValue: number,
): string {
  // Cockatrice desktop's `MessageLogWidget::logSetCounter`:
  // "%1 sets counter %2 to %3 (%4%5)." where %4 is "+" when delta > 0
  // (empty otherwise so negative deltas print as "(-1)") and %5 is the
  // signed delta. Used for both life changes and mana counter changes.
  const actor = nameOf(game, playerId);
  const name = displayCounterName(counterName);
  const delta = data.value - previousValue;
  const sign = delta > 0 ? '+' : '';
  return `${actor} sets counter ${name} to ${data.value} (${sign}${delta}).`;
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

/**
 * Mirrors Cockatrice's MessageLogWidget::logRevealCards
 * (message_log_widget.cpp:487-572). Covers two branches today:
 *
 *   • Zone-wide reveal / lend (`card_id[]` empty):
 *       - Reveal library to specific player → "Alice reveals library to Bob."
 *       - Reveal library to all players     → "Alice reveals library."
 *       - Lend library (always targeted)    → "Alice lends library to Bob."
 *
 *   • Top-N reveal (`card_id[0] === 0` sentinel + populated
 *     `number_of_cards`, sent by Cockatrice's actRevealTopCards at
 *     player_actions.cpp:1735-1748):
 *       - Reveal top N to specific player   → "Alice reveals 3 cards from
 *                                              their library to Bob."
 *       - Reveal top N to all players       → "Alice reveals 3 cards
 *                                              from their library."
 *
 * Returns null for the remaining `card_id[]`-populated paths (random
 * reveal cardId=[-2], specific-card reveals from hand, peek-face-down).
 */
export function formatCardsRevealed(
  game: Enriched.GameEntry,
  actorPlayerId: number,
  data: Event_RevealCards,
): string | null {
  const actor = nameOf(game, actorPlayerId);
  const zone = zoneLabel(data.zoneName);
  const isLend = data.grantWriteAccess;
  // otherPlayerId defaults to -1 in proto2; the desktop client's
  // reveal-to-all path passes null for otherPlayer, so treat < 0 as
  // "no specific target".
  const hasTarget = data.otherPlayerId >= 0;
  const targetName = hasTarget ? nameOf(game, data.otherPlayerId) : null;

  // Full-zone reveal / lend (empty card_id[]).
  if (data.cardId.length === 0) {
    if (isLend) {
      // Lend is always targeted — Cockatrice's menu doesn't offer
      // "Lend to all" (library_menu.cpp:280-293). If we ever see a
      // targetless lend event it's a client bug upstream, fall back
      // to the reveal-to-all phrasing rather than crash.
      if (!targetName) return `${actor} reveals ${zone}.`;
      return `${actor} lends ${zone} to ${targetName}.`;
    }
    if (targetName) return `${actor} reveals ${zone} to ${targetName}.`;
    return `${actor} reveals ${zone}.`;
  }

  // Top-N reveal: card_id[0] === 0 backward-compat sentinel from
  // desktop's actRevealTopCards. Prefer number_of_cards (populated on
  // both eventPrivate and eventOthers) so spectators see the same
  // count as the target / originator.
  const isTopNReveal = data.cardId.length === 1 && data.cardId[0] === 0;
  if (isTopNReveal) {
    const count = data.numberOfCards || data.cards.length;
    if (count <= 0) return null;
    const cardsPhrase = count === 1 ? '1 card' : `${count} cards`;
    if (targetName) {
      return `${actor} reveals ${cardsPhrase} from ${zone} to ${targetName}.`;
    }
    return `${actor} reveals ${cardsPhrase} from ${zone}.`;
  }

  return null;
}

export function formatZoneDumped(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_DumpZone,
): string {
  const actor = nameOf(game, playerId);
  // Cockatrice's Command_DumpZone uses number_cards = -1 for "all
  // cards" (the "View library" flow); render that as "the whole
  // library" rather than the raw -1 which reads as a bug.
  const rawCount = data.numberCards;
  const countPhrase = rawCount < 0
    ? `the whole ${zoneLabel(data.zoneName).replace('their ', '')}`
    : `${rawCount} card(s) from the top of ${zoneLabel(data.zoneName).replace('their ', '')}`;
  if (data.zoneOwnerId !== playerId) {
    const owner = nameOf(game, data.zoneOwnerId);
    return rawCount < 0
      ? `${actor} looks at the whole ${zoneLabel(data.zoneName).replace('their ', '')} of ${owner}.`
      : `${actor} looks at ${rawCount} card(s) from the top of ${owner}'s ${zoneLabel(data.zoneName).replace('their ', '')}.`;
  }
  return rawCount < 0
    ? `${actor} looks at their whole ${zoneLabel(data.zoneName).replace('their ', '')}.`
    : `${actor} looks at ${countPhrase}.`;
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
