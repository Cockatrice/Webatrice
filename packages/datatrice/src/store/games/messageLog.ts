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

/**
 * Coarse tone classification for log messages. Consumed by the chat
 * log renderer to pick a color per line — the goal is to make
 * high-signal events (turn/phase changes, joins/leaves, concedes)
 * pop against the routine action log. Cockatrice desktop styles by
 * fixed color per event kind (green turn banner, per-phase color,
 * red server messages, blue-highlighted numbers); we approximate
 * with a small palette rather than exact colors.
 */
export type LogTone = 'phase' | 'turn' | 'system' | 'action';

/**
 * A styled slice of a log message. The chat log renderer emits each
 * segment as its own <span> with a per-kind Tailwind class — card
 * segments additionally wire onMouseEnter to the shared preview.
 *   • `plain`  — filler text (verbs, prepositions, punctuation)
 *   • `player` — a player display name (semibold)
 *   • `card`   — a real MTG card name (italic accent, hoverable →
 *                right-rail preview)
 *   • `number` — a numeric value (counter delta, dice roll, PT, hash)
 */
export type LogSegmentKind = 'plain' | 'player' | 'card' | 'number';

export interface LogSegment {
  text: string;
  kind: LogSegmentKind;
}

/**
 * A formatted log message ready to append to the game log.
 *   • `text`     — plain-text form (used by tone classifier, accessibility
 *                  labels, copy-to-clipboard).
 *   • `segments` — the same message split into style-tagged spans so
 *                  the renderer can color card / player / number tokens
 *                  independently.
 */
export interface LogEntry {
  text: string;
  segments: LogSegment[];
}

// Segment builders. Kept short — they appear many times per format
// function and terse names make the templates readable.
const t = (text: string): LogSegment => ({ text, kind: 'plain' });
const p = (name: string): LogSegment => ({ text: name, kind: 'player' });
const n = (value: number | string): LogSegment => ({ text: String(value), kind: 'number' });

/** Card-name segment. Unknown card names ("a card") fall back to a
 *  plain segment — the preview hover expects a real name. */
function c(name: string | undefined | null): LogSegment {
  if (!name) return { text: 'a card', kind: 'plain' };
  return { text: name, kind: 'card' };
}

/**
 * Template-tag helper that builds a `LogEntry` from a mixed string /
 * segment template. String pieces (both from the template literal
 * itself and from interpolated string values) collapse into `plain`
 * segments; interpolated `LogSegment` values pass through. Adjacent
 * plain segments merge, keeping the segment list compact.
 *
 * Usage:
 *   L`${p(actor)} puts ${c(card)} into play${from}${faceDown}.`
 * where `from` / `faceDown` are plain strings.
 */
type LogPart = LogSegment | string;
function L(strings: TemplateStringsArray, ...values: LogPart[]): LogEntry {
  const raw: LogSegment[] = [];
  strings.forEach((str, i) => {
    if (str) raw.push(t(str));
    if (i < values.length) {
      const v = values[i];
      if (typeof v === 'string') {
        if (v) raw.push(t(v));
      } else {
        raw.push(v);
      }
    }
  });
  const merged: LogSegment[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && last.kind === 'plain' && s.kind === 'plain') {
      last.text += s.text;
    } else {
      merged.push({ ...s });
    }
  }
  return {
    text: merged.map((s) => s.text).join(''),
    segments: merged,
  };
}

function nameOf(game: Enriched.GameEntry, playerId: number): string {
  if (playerId < 0) {
    return 'The server';
  }
  return game.players[playerId]?.properties.userInfo?.name ?? `Player ${playerId}`;
}

/** Cockatrice's per-zone translated label — used by reveal / dump /
 *  zone-properties logs. Matches `TranslatedName` case variants. */
function zoneLabelReveal(zoneName: string, isOwner: boolean): string {
  switch (zoneName) {
    case ZoneName.TABLE: return isOwner ? 'their battlefield' : 'the battlefield';
    case ZoneName.HAND: return isOwner ? 'their hand' : 'the hand';
    case ZoneName.GRAVE: return isOwner ? 'their graveyard' : 'the graveyard';
    case ZoneName.EXILE: return isOwner ? 'their exile' : 'the exile';
    case ZoneName.DECK: return isOwner ? 'their library' : 'the library';
    case ZoneName.SIDEBOARD: return isOwner ? 'their sideboard' : 'the sideboard';
    case ZoneName.STACK: return isOwner ? 'their stack' : 'the stack';
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
 * Constructs the " from X" context clause that follows the card name
 * in move-card messages. Mirrors Cockatrice desktop's `getFromStr()`
 * at `message_log_widget.cpp:27-91`. Returns `{ nameOverride?, from }`
 * — when the library source has no card name, the pre-move top / bottom
 * card gets a descriptive replacement ("the top card of their
 * library") that consumes both the card slot AND the source clause,
 * matching desktop's `cardNameContainsStartZone` branch.
 */
function fromContext(
  game: Enriched.GameEntry,
  data: Event_MoveCard,
  actingIsSourceOwner: boolean,
  hasCardName: boolean,
): { nameOverride?: string; from: string } {
  const sourceOwner = nameOf(game, data.startPlayerId);
  const possessive = actingIsSourceOwner ? 'their' : `${sourceOwner}'s`;
  switch (data.startZone) {
    case ZoneName.TABLE:
      return { from: ' from play' };
    case ZoneName.GRAVE:
      return { from: ' from their graveyard' };
    case ZoneName.EXILE:
      return { from: ' from exile' };
    case ZoneName.HAND:
      return { from: ' from their hand' };
    case ZoneName.SIDEBOARD:
      return { from: ' from sideboard' };
    case ZoneName.STACK:
      return { from: ' from the stack' };
    case ZoneName.DECK: {
      const postCount =
        game.players[data.startPlayerId]?.zones[data.startZone]?.cardCount ?? 0;
      const position = data.position;
      if (position === 0) {
        if (!hasCardName) {
          return {
            nameOverride: actingIsSourceOwner
              ? 'the top card of their library'
              : `the top card of ${possessive} library`,
            from: '',
          };
        }
        return { from: ` from the top of ${possessive} library` };
      }
      if (postCount > 0 && position === postCount) {
        if (!hasCardName) {
          return {
            nameOverride: actingIsSourceOwner
              ? 'the bottom card of their library'
              : `the bottom card of ${possessive} library`,
            from: '',
          };
        }
        return { from: ` from the bottom of ${possessive} library` };
      }
      return { from: ` from ${possessive} library` };
    }
    default:
      return { from: ` from custom zone '${data.startZone}'` };
  }
}

export function formatCardMoved(
  game: Enriched.GameEntry,
  actingPlayerId: number,
  data: Event_MoveCard,
  ctx: CardMovedContext,
): LogEntry | null {
  const sameOwner = data.startPlayerId === data.targetPlayerId;
  if (isSameZoneReorder(data.startZone, data.targetZone, sameOwner)) {
    return null;
  }

  const actor = nameOf(game, actingPlayerId);
  const rawCardName = data.cardName || ctx.resolvedCardName;
  const actingIsSourceOwner = data.startPlayerId === actingPlayerId;
  const { nameOverride, from } = fromContext(
    game,
    data,
    actingIsSourceOwner,
    !!rawCardName,
  );
  // `card` becomes either a card-name segment (linkable/hoverable) or
  // a plain descriptor phrase ("the top card of their library" / "a
  // card") — the descriptor case is not a real card name so the hover
  // preview shouldn't fire on it.
  const cardSeg: LogSegment = nameOverride ? t(nameOverride) : c(rawCardName);
  const faceDown = data.faceDown ? ' face down' : '';

  // Cross-owner control-transfer stays out of the zone-specific
  // switch below — desktop logs this as a distinct event.
  if (!sameOwner && data.startPlayerId === actingPlayerId) {
    return L`${p(actor)} gives ${p(nameOf(game, data.targetPlayerId))} control over ${cardSeg}.`;
  }

  switch (data.targetZone) {
    case ZoneName.TABLE:
      return L`${p(actor)} puts ${cardSeg} into play${from}${faceDown}.`;
    case ZoneName.GRAVE:
      return L`${p(actor)} puts ${cardSeg}${from} into their graveyard${faceDown}.`;
    case ZoneName.EXILE:
      return L`${p(actor)} exiles ${cardSeg}${from}${faceDown}.`;
    case ZoneName.HAND:
      return L`${p(actor)} moves ${cardSeg}${from} to their hand.`;
    case ZoneName.SIDEBOARD:
      return L`${p(actor)} moves ${cardSeg}${from} to sideboard.`;
    case ZoneName.STACK:
      return L`${p(actor)} plays ${cardSeg}${from}${faceDown}.`;
    case ZoneName.DECK: {
      const targetCount =
        game.players[data.targetPlayerId]?.zones[data.targetZone]?.cardCount ?? 0;
      const x = data.x;
      if (x === -1) {
        return L`${p(actor)} puts ${cardSeg}${from} into their library.`;
      }
      if (targetCount > 0 && x >= targetCount - 1) {
        return L`${p(actor)} puts ${cardSeg}${from} onto the bottom of their library.`;
      }
      if (x === 0) {
        return L`${p(actor)} puts ${cardSeg}${from} on top of their library.`;
      }
      return L`${p(actor)} puts ${cardSeg}${from} into their library ${n(x + 1)} cards from the top.`;
    }
    default:
      return faceDown
        ? L`${p(actor)} moves ${cardSeg}${from} to custom zone '${data.targetZone}' face down.`
        : L`${p(actor)} moves ${cardSeg}${from} to custom zone '${data.targetZone}'.`;
  }
}

export function formatCardFlipped(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_FlipCard,
  previousName: string | undefined,
): LogEntry {
  const actor = nameOf(game, playerId);
  const nameSeg = c(data.cardName || previousName);
  return data.faceDown
    ? L`${p(actor)} turns ${nameSeg} face-down.`
    : L`${p(actor)} turns ${nameSeg} face-up.`;
}

export function formatCardDestroyed(
  game: Enriched.GameEntry,
  playerId: number,
  cardName: string | undefined,
): LogEntry {
  return L`${p(nameOf(game, playerId))} destroys ${c(cardName)}.`;
}

export function formatCardAttached(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_AttachCard,
  sourceCardName: string | undefined,
): LogEntry {
  const actor = nameOf(game, playerId);
  const sourceSeg = c(sourceCardName);
  if (data.targetCardId < 0 || !data.targetZone) {
    return L`${p(actor)} unattaches ${sourceSeg}.`;
  }
  const targetPlayer = nameOf(game, data.targetPlayerId);
  const targetCardSeg = c(
    game.players[data.targetPlayerId]?.zones[data.targetZone]?.byId[data.targetCardId]?.name,
  );
  return L`${p(actor)} attaches ${sourceSeg} to ${p(targetPlayer)}'s ${targetCardSeg}.`;
}

export function formatTokenCreated(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_CreateToken,
): LogEntry {
  const actor = nameOf(game, playerId);
  if (data.faceDown) {
    return L`${p(actor)} creates a face down token.`;
  }
  const nameSeg = c(data.cardName);
  return data.pt
    ? L`${p(actor)} creates token: ${nameSeg} (${data.pt}).`
    : L`${p(actor)} creates token: ${nameSeg}.`;
}

export function formatCardAttrChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardAttr,
  cardName: string | undefined,
  previousPT?: string,
): LogEntry | null {
  const actor = nameOf(game, playerId);
  const cardSeg = c(cardName);
  switch (data.attribute as CardAttribute) {
    case CardAttribute.AttrTapped:
      return data.attrValue === '1'
        ? L`${p(actor)} taps ${cardSeg}.`
        : L`${p(actor)} untaps ${cardSeg}.`;
    case CardAttribute.AttrAttacking:
      return data.attrValue === '1'
        ? L`${p(actor)} declares ${cardSeg} as an attacker.`
        : null;
    case CardAttribute.AttrFaceDown:
      return null;
    case CardAttribute.AttrColor:
      return null;
    case CardAttribute.AttrPT: {
      if (!data.attrValue) {
        return L`${p(actor)} removes the PT of ${cardSeg}.`;
      }
      const oldPT = previousPT ?? '';
      if (!oldPT) {
        return L`${p(actor)} changes the PT of ${cardSeg} from nothing to ${n(data.attrValue)}.`;
      }
      return L`${p(actor)} changes the PT of ${cardSeg} from ${n(oldPT)} to ${n(data.attrValue)}.`;
    }
    case CardAttribute.AttrAnnotation:
      return data.attrValue
        ? L`${p(actor)} sets annotation of ${cardSeg} to "${data.attrValue}".`
        : L`${p(actor)} sets annotation of ${cardSeg} to "".`;
    case CardAttribute.AttrDoesntUntap:
      return data.attrValue === '1'
        ? L`${p(actor)} sets ${cardSeg} to not untap normally.`
        : L`${p(actor)} sets ${cardSeg} to untap normally.`;
    default:
      return null;
  }
}

export function formatCardAttrChangedBulk(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_SetCardAttr,
): LogEntry | null {
  const actor = nameOf(game, playerId);
  switch (data.attribute as CardAttribute) {
    case CardAttribute.AttrTapped:
      return data.attrValue === '1'
        ? L`${p(actor)} taps their permanents.`
        : L`${p(actor)} untaps their permanents.`;
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
): LogEntry {
  const actor = nameOf(game, playerId);
  const cardSeg = c(cardName);
  const delta = data.counterValue - previousValue;
  if (delta > 0) {
    return L`${p(actor)} places ${n(delta)} counter(s) on ${cardSeg} (now ${n(data.counterValue)}).`;
  }
  if (delta < 0) {
    return L`${p(actor)} removes ${n(-delta)} counter(s) from ${cardSeg} (now ${n(data.counterValue)}).`;
  }
  return L`${p(actor)} sets counters on ${cardSeg} to ${n(data.counterValue)}.`;
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
): LogEntry {
  const actor = nameOf(game, playerId);
  const displayName = displayCounterName(counterName);
  const delta = data.value - previousValue;
  const sign = delta > 0 ? '+' : '';
  return L`${p(actor)} sets counter ${displayName} to ${n(data.value)} (${n(`${sign}${delta}`)}).`;
}

export function formatCardsDrawn(
  game: Enriched.GameEntry,
  playerId: number,
  number: number,
): LogEntry {
  const actor = nameOf(game, playerId);
  return number === 1
    ? L`${p(actor)} draws ${n(1)} card.`
    : L`${p(actor)} draws ${n(number)} cards.`;
}

export function formatZoneShuffled(game: Enriched.GameEntry, playerId: number): LogEntry {
  return L`${p(nameOf(game, playerId))} shuffles their library.`;
}

/**
 * Mirrors Cockatrice's MessageLogWidget::logRevealCards. Returns null
 * for card-id-populated branches we don't handle (random reveals,
 * specific-card reveals from hand, peek-face-down).
 */
export function formatCardsRevealed(
  game: Enriched.GameEntry,
  actorPlayerId: number,
  data: Event_RevealCards,
): LogEntry | null {
  const actor = nameOf(game, actorPlayerId);
  const zone = zoneLabelReveal(data.zoneName, true);
  const isLend = data.grantWriteAccess;
  const hasTarget = data.otherPlayerId >= 0;
  const targetName = hasTarget ? nameOf(game, data.otherPlayerId) : null;

  if (data.cardId.length === 0) {
    if (isLend) {
      if (!targetName) return L`${p(actor)} reveals ${zone}.`;
      return L`${p(actor)} lends ${zone} to ${p(targetName)}.`;
    }
    if (targetName) return L`${p(actor)} reveals ${zone} to ${p(targetName)}.`;
    return L`${p(actor)} reveals ${zone}.`;
  }

  const isTopNReveal = data.cardId.length === 1 && data.cardId[0] === 0;
  if (isTopNReveal) {
    const count = data.numberOfCards || data.cards.length;
    if (count <= 0) return null;
    if (targetName) {
      return count === 1
        ? L`${p(actor)} reveals ${n(1)} card from ${zone} to ${p(targetName)}.`
        : L`${p(actor)} reveals ${n(count)} cards from ${zone} to ${p(targetName)}.`;
    }
    return count === 1
      ? L`${p(actor)} reveals ${n(1)} card from ${zone}.`
      : L`${p(actor)} reveals ${n(count)} cards from ${zone}.`;
  }

  return null;
}

export function formatZoneDumped(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_DumpZone,
): LogEntry {
  const actor = nameOf(game, playerId);
  const isOwner = data.zoneOwnerId === playerId;
  const zoneLabel = zoneLabelReveal(data.zoneName, isOwner);
  if (data.numberCards < 0) {
    if (isOwner) return L`${p(actor)} is looking at ${zoneLabel}.`;
    const ownerName = nameOf(game, data.zoneOwnerId);
    return L`${p(actor)} is looking at ${p(ownerName)}'s ${zoneLabel.replace(/^the /, '')}.`;
  }
  const countSeg = n(data.numberCards);
  const noun = data.numberCards === 1 ? 'card' : 'cards';
  if (isOwner) {
    return L`${p(actor)} is looking at the top ${countSeg} ${noun} of ${zoneLabel}.`;
  }
  const ownerName = nameOf(game, data.zoneOwnerId);
  return L`${p(actor)} is looking at the top ${countSeg} ${noun} of ${p(ownerName)}'s ${zoneLabel.replace(/^the /, '')}.`;
}

export function formatZonePropertiesChanged(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_ChangeZoneProperties,
): LogEntry | null {
  const actor = nameOf(game, playerId);
  const zone = zoneLabelReveal(data.zoneName, true);
  if (data.alwaysRevealTopCard) {
    return L`${p(actor)} is now keeping the top card of ${zone} revealed.`;
  }
  if (data.alwaysLookAtTopCard) {
    return L`${p(actor)} can now look at top card of ${zone} at any time.`;
  }
  return L`${p(actor)} is not revealing the top card of ${zone} any longer.`;
}

export function formatActivePhaseSet(phase: number): LogEntry {
  return L`It is now the ${phaseName(phase)}.`;
}

export function formatActivePlayerSet(game: Enriched.GameEntry, activePlayerId: number): LogEntry {
  return L`${p(nameOf(game, activePlayerId))}'s turn.`;
}

export function formatTurnReversed(game: Enriched.GameEntry, playerId: number, reversed: boolean): LogEntry {
  const actor = nameOf(game, playerId);
  return reversed
    ? L`${p(actor)} reversed turn order, now it's reversed.`
    : L`${p(actor)} reversed turn order, now it's normal.`;
}

export function formatDieRolled(
  game: Enriched.GameEntry,
  playerId: number,
  data: Event_RollDie,
): LogEntry {
  const actor = nameOf(game, playerId);
  const rolls = (data.values && data.values.length > 0) ? data.values : (data.value ? [data.value] : []);
  if (rolls.length === 0) {
    return L`${p(actor)} rolls a ${n(data.sides)}-sided die.`;
  }
  if (rolls.length === 1) {
    const roll = rolls[0];
    if (data.sides === 2) {
      const face = roll === 1 ? 'Heads (1)' : 'Tails (2)';
      return L`${p(actor)} flipped a coin. It landed as ${n(face)}.`;
    }
    return L`${p(actor)} rolls a ${n(roll)} with a ${n(data.sides)}-sided die.`;
  }
  if (data.sides === 2) {
    const heads = rolls.filter((r) => r === 1).length;
    const tails = rolls.filter((r) => r === 2).length;
    return L`${p(actor)} flips ${n(rolls.length)} coins. There are ${n(heads)} heads and ${n(tails)} tails.`;
  }
  return L`${p(actor)} rolls a ${n(data.sides)}-sided dice ${n(rolls.length)} times: ${n(rolls.join(', '))}.`;
}

export function formatPlayerJoined(game: Enriched.GameEntry, playerId: number): LogEntry {
  return L`${p(nameOf(game, playerId))} has joined the game.`;
}

export function formatLeaveMessage(game: Enriched.GameEntry, playerId: number, reason?: string): LogEntry {
  const actor = nameOf(game, playerId);
  return reason
    ? L`${p(actor)} has left the game (${reason}).`
    : L`${p(actor)} has left the game.`;
}

export function formatGameStart(): LogEntry {
  return L`The game has started.`;
}

export function formatArrowCreated(
  game: Enriched.GameEntry,
  playerId: number,
  arrow: ServerInfo_Arrow,
): LogEntry {
  const actor = nameOf(game, playerId);
  const sourcePlayerName = nameOf(game, arrow.startPlayerId);
  const targetPlayerName = nameOf(game, arrow.targetPlayerId);
  const sourceCardSeg = c(
    game.players[arrow.startPlayerId]?.zones[arrow.startZone]?.byId[arrow.startCardId]?.name,
  );
  const isPlayerTarget = arrow.targetCardId < 0 || !arrow.targetZone;
  const actorIsSource = playerId === arrow.startPlayerId;
  const actorIsTarget = playerId === arrow.targetPlayerId;

  if (isPlayerTarget) {
    if (actorIsSource && actorIsTarget) {
      return L`${p(actor)} points from their ${sourceCardSeg} to themselves.`;
    }
    if (actorIsSource) {
      return L`${p(actor)} points from their ${sourceCardSeg} to ${p(targetPlayerName)}.`;
    }
    if (actorIsTarget) {
      return L`${p(actor)} points from ${p(sourcePlayerName)}'s ${sourceCardSeg} to themselves.`;
    }
    return L`${p(actor)} points from ${p(sourcePlayerName)}'s ${sourceCardSeg} to ${p(targetPlayerName)}.`;
  }

  const targetCardSeg = c(
    game.players[arrow.targetPlayerId]?.zones[arrow.targetZone]?.byId[arrow.targetCardId]?.name,
  );
  if (actorIsSource && actorIsTarget) {
    return L`${p(actor)} points from their ${sourceCardSeg} to their ${targetCardSeg}.`;
  }
  if (actorIsSource) {
    return L`${p(actor)} points from their ${sourceCardSeg} to ${p(targetPlayerName)}'s ${targetCardSeg}.`;
  }
  if (actorIsTarget) {
    return L`${p(actor)} points from ${p(sourcePlayerName)}'s ${sourceCardSeg} to their own ${targetCardSeg}.`;
  }
  return L`${p(actor)} points from ${p(sourcePlayerName)}'s ${sourceCardSeg} to ${p(targetPlayerName)}'s ${targetCardSeg}.`;
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
): LogEntry[] {
  const actor = nameOf(game, playerId);
  const messages: LogEntry[] = [];
  if (diff.conceded) {
    messages.push(L`${p(actor)} has conceded the game.`);
  }
  if (diff.unconceded) {
    messages.push(L`${p(actor)} has unconceded the game.`);
  }
  if (diff.ready) {
    messages.push(L`${p(actor)} is ready to start the game.`);
  }
  if (diff.unready) {
    messages.push(L`${p(actor)} is not ready to start the game any more.`);
  }
  if (diff.sideboardLocked) {
    messages.push(L`${p(actor)} has locked their sideboard.`);
  }
  if (diff.sideboardUnlocked) {
    messages.push(L`${p(actor)} has unlocked their sideboard.`);
  }
  if (diff.deckLoaded) {
    messages.push(L`${p(actor)} has loaded a deck (${diff.deckLoaded.hash}).`);
  }
  return messages;
}

/**
 * Classify a formatted log-message text into a coarse tone bucket so
 * the chat log can color-code it. Cheap string-inclusion checks —
 * the classifier only sees English text, but the format functions
 * above produce English strings anyway.
 *
 * Accepts either a raw string (for external callers) or a `LogEntry`
 * (renderer path, which already has `.text`).
 */
export function classifyLogTone(input: string | LogEntry): LogTone {
  const text = typeof input === 'string' ? input : input.text;
  if (/^It is now the /.test(text)) return 'phase';
  if (/'s turn\.$/.test(text)) return 'turn';
  if (
    /^The game has (started|been closed)\.$/.test(text)
    || / has joined the game\.$/.test(text)
    || / has left the game/.test(text)
    || / has (?:un)?conceded the game\.$/.test(text)
    || / is (?:not )?ready to start the game/.test(text)
    || / has (?:un)?locked their sideboard\.$/.test(text)
    || / has loaded a deck /.test(text)
  ) {
    return 'system';
  }
  return 'action';
}
