import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { App } from '../../types';
import type { LegacyLogText, LogDescriptor, LogParamsByKind, LogPlayer, LogSegment } from '../../types/gameLog';

function playerName(player: LogPlayer): string {
  return player.name ?? (player.id === undefined ? 'Unknown player' : player.id < 0 ? 'The server' : `Player ${player.id}`);
}

// Segment builders. Kept short — they appear many times per format
// function and terse names make the templates readable.
const t = (text: string): LogSegment => ({ text, kind: 'plain' });
const p = (name: string): LogSegment => ({ text: name, kind: 'player' });
const n = (value: number | string): LogSegment => ({ text: String(value), kind: 'number' });

/** Card-name segment. Unknown card names ("a card") fall back to a
 *  plain segment — the preview hover expects a real name. */
function c(name: string | undefined | null): LogSegment {
  if (!name) {
    return { text: 'a card', kind: 'plain' };
  }
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
function L(strings: TemplateStringsArray, ...values: LogPart[]): LegacyLogText {
  const raw: LogSegment[] = [];
  strings.forEach((str, i) => {
    if (str) {
      raw.push(t(str));
    }
    if (i < values.length) {
      const v = values[i];
      if (typeof v === 'string') {
        if (v) {
          raw.push(t(v));
        }
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

function fromContext(
  data: LogParamsByKind['cardMoved'],
  actingIsSourceOwner: boolean,
  hasCardName: boolean,
): { nameOverride?: string; from: string } {
  const sourceOwner = playerName(data.sourceOwner);
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
        data.sourceCount;
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
  if (!name) {
    return 'counter';
  }
  return COUNTER_DISPLAY_NAME[name.toLowerCase()] ?? name;
}

const LEAVE_REASON_MESSAGES: Record<number, string> = {
  1: 'reason unknown',
  2: 'kicked by game host or moderator',
  3: 'player left the game',
  4: 'player disconnected from server',
};

function renderCardMoved(params: LogParamsByKind['cardMoved']): LegacyLogText | null {

  const sameOwner = params.sourceOwner.id === params.targetOwner.id;

  const actor = playerName(params.actor);
  const rawCardName = params.cardName;
  const actingIsSourceOwner = params.sourceOwner.id === params.actor.id;
  const { nameOverride, from } = fromContext(
    params,
    actingIsSourceOwner,
    !!rawCardName,
  );
  // `card` becomes either a card-name segment (linkable/hoverable) or
  // a plain descriptor phrase ("the top card of their library" / "a
  // card") — the descriptor case is not a real card name so the hover
  // preview shouldn't fire on it.
  const cardSeg: LogSegment = nameOverride ? t(nameOverride) : c(rawCardName);
  const faceDown = params.faceDown ? ' face down' : '';

  // Cross-owner control-transfer stays out of the zone-specific
  // switch below — desktop logs this as a distinct event.
  if (!sameOwner && params.sourceOwner.id === params.actor.id) {
    return L`${p(actor)} gives ${p(playerName(params.targetOwner))} control over ${cardSeg}.`;
  }

  switch (params.targetZone) {
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
        params.targetCount;
      const x = params.targetPosition;
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
        ? L`${p(actor)} moves ${cardSeg}${from} to custom zone '${params.targetZone}' face down.`
        : L`${p(actor)} moves ${cardSeg}${from} to custom zone '${params.targetZone}'.`;
  }

}

function renderCardFlipped(params: LogParamsByKind['cardFlipped']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const nameSeg = c(params.cardName);
  return params.faceDown
    ? L`${p(actor)} turns ${nameSeg} face-down.`
    : L`${p(actor)} turns ${nameSeg} face-up.`;

}

function renderCardDestroyed(params: LogParamsByKind['cardDestroyed']): LegacyLogText | null {

  return L`${p(playerName(params.actor))} destroys ${c(params.cardName)}.`;

}

function renderCardAttached(params: LogParamsByKind['cardAttached']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const sourceSeg = c(params.cardName);
  if (params.detached) {
    return L`${p(actor)} unattaches ${sourceSeg}.`;
  }
  const targetPlayer = playerName(params.targetOwner);
  const targetCardSeg = c(
    params.targetCardName,
  );
  return L`${p(actor)} attaches ${sourceSeg} to ${p(targetPlayer)}'s ${targetCardSeg}.`;

}

function renderTokenCreated(params: LogParamsByKind['tokenCreated']): LegacyLogText | null {

  const actor = playerName(params.actor);
  if (params.faceDown) {
    return L`${p(actor)} creates a face down token.`;
  }
  const nameSeg = c(params.cardName);
  return params.pt
    ? L`${p(actor)} creates token: ${nameSeg} (${params.pt}).`
    : L`${p(actor)} creates token: ${nameSeg}.`;

}

function renderCardAttrChanged(params: LogParamsByKind['cardAttrChanged']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const cardSeg = c(params.cardName);
  switch (params.attribute as CardAttribute) {
    case CardAttribute.AttrTapped:
      return params.value === '1'
        ? L`${p(actor)} taps ${cardSeg}.`
        : L`${p(actor)} untaps ${cardSeg}.`;
    case CardAttribute.AttrAttacking:
      return params.value === '1'
        ? L`${p(actor)} declares ${cardSeg} as an attacker.`
        : null;
    case CardAttribute.AttrFaceDown:
      return null;
    case CardAttribute.AttrColor:
      return null;
    case CardAttribute.AttrPT: {
      if (!params.value) {
        return L`${p(actor)} removes the PT of ${cardSeg}.`;
      }
      const oldPT = params.previousPT;
      if (!oldPT) {
        return L`${p(actor)} changes the PT of ${cardSeg} from nothing to ${n(params.value)}.`;
      }
      return L`${p(actor)} changes the PT of ${cardSeg} from ${n(oldPT)} to ${n(params.value)}.`;
    }
    case CardAttribute.AttrAnnotation:
      return params.value
        ? L`${p(actor)} sets annotation of ${cardSeg} to "${params.value}".`
        : L`${p(actor)} sets annotation of ${cardSeg} to "".`;
    case CardAttribute.AttrDoesntUntap:
      return params.value === '1'
        ? L`${p(actor)} sets ${cardSeg} to not untap normally.`
        : L`${p(actor)} sets ${cardSeg} to untap normally.`;
    default:
      return null;
  }

}

function renderCardAttrChangedBulk(params: LogParamsByKind['cardAttrChangedBulk']): LegacyLogText {
  return params.tapped
    ? L`${p(playerName(params.actor))} taps their permanents.`
    : L`${p(playerName(params.actor))} untaps their permanents.`;
}

function renderCardCounterChanged(params: LogParamsByKind['cardCounterChanged']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const cardSeg = c(params.cardName);
  const delta = params.value - params.previousValue;
  if (delta > 0) {
    return L`${p(actor)} places ${n(delta)} counter(s) on ${cardSeg} (now ${n(params.value)}).`;
  }
  if (delta < 0) {
    return L`${p(actor)} removes ${n(-delta)} counter(s) from ${cardSeg} (now ${n(params.value)}).`;
  }
  return L`${p(actor)} sets counters on ${cardSeg} to ${n(params.value)}.`;

}

function renderCounterSet(params: LogParamsByKind['counterSet']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const displayName = displayCounterName(params.counterName);
  const delta = params.value - params.previousValue;
  const sign = delta > 0 ? '+' : '';
  return L`${p(actor)} sets counter ${displayName} to ${n(params.value)} (${n(`${sign}${delta}`)}).`;

}

function renderCardsDrawn(params: LogParamsByKind['cardsDrawn']): LegacyLogText | null {

  const actor = playerName(params.actor);
  return params.count === 1
    ? L`${p(actor)} draws ${n(1)} card.`
    : L`${p(actor)} draws ${n(params.count)} cards.`;

}

function renderCardUndoneDraw(params: LogParamsByKind['cardUndoneDraw']): LegacyLogText | null {

  const actor = playerName(params.actor);
  if (params.cardName) {
    return L`${p(actor)} undoes their last draw (${c(params.cardName)}).`;
  }
  return L`${p(actor)} undoes their last draw.`;

}

function renderUndoDrawFailed(params: LogParamsByKind['undoDrawFailed']): LegacyLogText | null {

  return L`${p(playerName(params.actor))} failed to undo their last draw.`;

}

function renderZoneShuffled(params: LogParamsByKind['zoneShuffled']): LegacyLogText | null {

  return L`${p(playerName(params.actor))} shuffles their library.`;

}

function renderCardPeeked(params: LogParamsByKind['cardPeeked']): LegacyLogText | null {

  const actor = playerName(params.actor);
  if (params.cardName) {
    return L`${p(actor)} peeks at face down card #${n(params.cardId)}: ${c(params.cardName)}.`;
  }
  return L`${p(actor)} peeks at face down card #${n(params.cardId)}.`;

}

function renderCardsRevealed(params: LogParamsByKind['cardsRevealed']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const zone = zoneLabelReveal(params.zoneName, true);
  const isLend = params.lend;
  const hasTarget = params.target !== null;
  const targetName = hasTarget ? playerName(params.target!) : null;

  if (params.mode === 'zone') {
    if (isLend) {
      if (!targetName) {
        return L`${p(actor)} reveals ${zone}.`;
      }
      return L`${p(actor)} lends ${zone} to ${p(targetName)}.`;
    }
    if (targetName) {
      return L`${p(actor)} reveals ${zone} to ${p(targetName)}.`;
    }
    return L`${p(actor)} reveals ${zone}.`;
  }

  if (params.mode === 'top') {
    const count = params.count;
    if (count <= 0) {
      return null;
    }
    if (targetName) {
      return count === 1
        ? L`${p(actor)} reveals ${n(1)} card from ${zone} to ${p(targetName)}.`
        : L`${p(actor)} reveals ${n(count)} cards from ${zone} to ${p(targetName)}.`;
    }
    return count === 1
      ? L`${p(actor)} reveals ${n(1)} card from ${zone}.`
      : L`${p(actor)} reveals ${n(count)} cards from ${zone}.`;
  }

  // Observer-side peek log. When the source peeks their own face-down
  // card, Servatrice sends the fully-populated Event_RevealCards to
  // the recipient (source == target) — that path emits per-card
  // "peeks at face down card #N" logs from the listener via
  // formatCardPeeked. Observers receive the same event with card
  // details stripped (empty `cards[]`), only card ids and the reveal
  // target. Cockatrice's `logRevealCards` "else if (otherPlayer)"
  // branch (message_log_widget.cpp:558-566) is what produces the
  // "SonicBliss reveals 1 card(s) from play to SonicBliss." line on
  // observer clients — that's this branch.
  if (params.mode === 'cards') {
    const count = params.count;
    const fromLabel = params.zoneName === ZoneName.TABLE ? 'play' : zoneLabelReveal(params.zoneName, false);
    if (targetName) {
      return L`${p(actor)} reveals ${n(count)} card(s) from ${fromLabel} to ${p(targetName)}.`;
    }
    return L`${p(actor)} reveals ${n(count)} card(s) from ${fromLabel}.`;
  }

  params.mode satisfies never;
  return null;

}

function renderZoneDumped(params: LogParamsByKind['zoneDumped']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const isOwner = params.owner.id === params.actor.id;
  const zoneLabel = zoneLabelReveal(params.zoneName, isOwner);
  if (params.count < 0) {
    if (isOwner) {
      return L`${p(actor)} is looking at ${zoneLabel}.`;
    }
    const ownerName = playerName(params.owner);
    return L`${p(actor)} is looking at ${p(ownerName)}'s ${zoneLabel.replace(/^the /, '')}.`;
  }
  const countSeg = n(params.count);
  const noun = params.count === 1 ? 'card' : 'cards';
  if (isOwner) {
    return L`${p(actor)} is looking at the top ${countSeg} ${noun} of ${zoneLabel}.`;
  }
  const ownerName = playerName(params.owner);
  return L`${p(actor)} is looking at the top ${countSeg} ${noun} of ${p(ownerName)}'s ${zoneLabel.replace(/^the /, '')}.`;

}

function renderZonePropertiesChanged(params: LogParamsByKind['zonePropertiesChanged']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const zone = zoneLabelReveal(params.zoneName, true);
  if (params.reveal) {
    return L`${p(actor)} is now keeping the top card of ${zone} revealed.`;
  }
  if (params.look) {
    return L`${p(actor)} can now look at top card of ${zone} at any time.`;
  }
  return L`${p(actor)} is not revealing the top card of ${zone} any longer.`;

}

function renderActivePhaseSet(params: LogParamsByKind['activePhaseSet']): LegacyLogText | null {

  return L`It is now the ${phaseName(params.phase)}.`;

}

function renderActivePlayerSet(params: LogParamsByKind['activePlayerSet']): LegacyLogText | null {

  return L`${p(playerName(params.actor))}'s turn.`;

}

function renderTurnReversed(params: LogParamsByKind['turnReversed']): LegacyLogText | null {

  const actor = playerName(params.actor);
  return params.reversed
    ? L`${p(actor)} reversed turn order, now it's reversed.`
    : L`${p(actor)} reversed turn order, now it's normal.`;

}

function renderDieRolled(params: LogParamsByKind['dieRolled']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const rolls = params.rolls;
  if (rolls.length === 0) {
    return L`${p(actor)} rolls a ${n(params.sides)}-sided die.`;
  }
  if (rolls.length === 1) {
    const roll = rolls[0];
    if (params.sides === 2) {
      const face = roll === 1 ? 'Heads (1)' : 'Tails (2)';
      return L`${p(actor)} flipped a coin. It landed as ${n(face)}.`;
    }
    return L`${p(actor)} rolls a ${n(roll)} with a ${n(params.sides)}-sided die.`;
  }
  if (params.sides === 2) {
    const heads = rolls.filter((r) => r === 1).length;
    const tails = rolls.filter((r) => r === 2).length;
    return L`${p(actor)} flips ${n(rolls.length)} coins. There are ${n(heads)} heads and ${n(tails)} tails.`;
  }
  return L`${p(actor)} rolls a ${n(params.sides)}-sided dice ${n(rolls.length)} times: ${n(rolls.join(', '))}.`;

}

function renderPlayerJoined(params: LogParamsByKind['playerJoined']): LegacyLogText | null {

  return L`${p(playerName(params.actor))} has joined the game.`;

}

function renderLeaveMessage(params: LogParamsByKind['playerLeft']): LegacyLogText | null {

  const reasonText = LEAVE_REASON_MESSAGES[params.reason] ?? LEAVE_REASON_MESSAGES[1];
  return L`${p(playerName(params.actor))} has left the game (${reasonText}).`;

}

function renderArrowCreated(params: LogParamsByKind['arrowCreated']): LegacyLogText | null {

  const actor = playerName(params.actor);
  const sourcePlayerName = playerName(params.sourceOwner);
  const targetPlayerName = playerName(params.targetOwner);
  const sourceCardSeg = c(
    params.sourceCardName,
  );
  const isPlayerTarget = params.playerTarget;
  const actorIsSource = params.actor.id === params.sourceOwner.id;
  const actorIsTarget = params.actor.id === params.targetOwner.id;

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
    params.targetCardName,
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

export function renderLegacyLog(entry: LogDescriptor): LegacyLogText {
  switch (entry.kind) {
    case 'cardMoved': return renderCardMoved(entry.params)!;
    case 'cardFlipped': return renderCardFlipped(entry.params)!;
    case 'cardDestroyed': return renderCardDestroyed(entry.params)!;
    case 'cardAttached': return renderCardAttached(entry.params)!;
    case 'tokenCreated': return renderTokenCreated(entry.params)!;
    case 'cardAttrChanged': return renderCardAttrChanged(entry.params)!;
    case 'cardAttrChangedBulk': return renderCardAttrChangedBulk(entry.params)!;
    case 'cardCounterChanged': return renderCardCounterChanged(entry.params)!;
    case 'counterSet': return renderCounterSet(entry.params)!;
    case 'cardsDrawn': return renderCardsDrawn(entry.params)!;
    case 'cardUndoneDraw': return renderCardUndoneDraw(entry.params)!;
    case 'undoDrawFailed': return renderUndoDrawFailed(entry.params)!;
    case 'zoneShuffled': return renderZoneShuffled(entry.params)!;
    case 'cardPeeked': return renderCardPeeked(entry.params)!;
    case 'cardsRevealed': return renderCardsRevealed(entry.params)!;
    case 'zoneDumped': return renderZoneDumped(entry.params)!;
    case 'zonePropertiesChanged': return renderZonePropertiesChanged(entry.params)!;
    case 'activePhaseSet': return renderActivePhaseSet(entry.params)!;
    case 'activePlayerSet': return renderActivePlayerSet(entry.params)!;
    case 'turnReversed': return renderTurnReversed(entry.params)!;
    case 'dieRolled': return renderDieRolled(entry.params)!;
    case 'playerJoined': return renderPlayerJoined(entry.params)!;
    case 'playerLeft': return renderLeaveMessage(entry.params)!;
    case 'gameStarted': return L`The game has started.`;
    case 'gameClosed': return L`The game has been closed.`;
    case 'replayStarted': return L`You are watching a replay of game #${String(entry.params.gameId)}.`;
    case 'arrowCreated': return renderArrowCreated(entry.params)!;
    case 'playerConceded': return L`${p(playerName(entry.params.actor))} has conceded the game.`;
    case 'playerUnconceded': return L`${p(playerName(entry.params.actor))} has unconceded the game.`;
    case 'playerReady': return L`${p(playerName(entry.params.actor))} is ready to start the game.`;
    case 'playerUnready': return L`${p(playerName(entry.params.actor))} is not ready to start the game any more.`;
    case 'sideboardLocked': return L`${p(playerName(entry.params.actor))} has locked their sideboard.`;
    case 'sideboardUnlocked': return L`${p(playerName(entry.params.actor))} has unlocked their sideboard.`;
    case 'deckLoaded': return L`${p(playerName(entry.params.actor))} has loaded a deck (${entry.params.hash}).`;
  }
}
