import type { TFunction } from 'i18next';
import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import type { LogDescriptor, LogParamsByKind, LogSegment } from '@cockatrice/datatrice';
import { createLogContext, type LogContext } from './logContext';
import { plain, p, n, type FormattedLog } from './logTranslation';

function renderCardMoved(params: LogParamsByKind['cardMoved'], context: LogContext): FormattedLog | null {
  const { playerName, c, line, fromContext, label } = context;
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
  const cardSeg: LogSegment = nameOverride ? plain(nameOverride) : c(rawCardName);
  const faceDown = params.faceDown ? label('faceDown') : '';

  // Cross-owner control-transfer stays out of the zone-specific
  // switch below — desktop logs this as a distinct event.
  if (!sameOwner && params.sourceOwner.id === params.actor.id) {
    return line('GameLog.cardMoved.control', { actor: p(actor), target: p(playerName(params.targetOwner)), card: cardSeg });
  }

  switch (params.targetZone) {
    case ZoneName.TABLE:
      return line('GameLog.cardMoved.play', { actor: p(actor), card: cardSeg, from, faceDown });
    case ZoneName.GRAVE:
      return line('GameLog.cardMoved.grave', { actor: p(actor), card: cardSeg, from, faceDown });
    case ZoneName.EXILE:
      return line('GameLog.cardMoved.exile', { actor: p(actor), card: cardSeg, from, faceDown });
    case ZoneName.HAND:
      return line('GameLog.cardMoved.hand', { actor: p(actor), card: cardSeg, from });
    case ZoneName.SIDEBOARD:
      return line('GameLog.cardMoved.sideboard', { actor: p(actor), card: cardSeg, from });
    case ZoneName.STACK:
      return line('GameLog.cardMoved.stack', { actor: p(actor), card: cardSeg, from, faceDown });
    case ZoneName.DECK: {
      const targetCount =
        params.targetCount;
      const x = params.targetPosition;
      if (x === -1) {
        return line('GameLog.cardMoved.library', { actor: p(actor), card: cardSeg, from });
      }
      if (targetCount > 0 && x >= targetCount - 1) {
        return line('GameLog.cardMoved.bottom', { actor: p(actor), card: cardSeg, from });
      }
      if (x === 0) {
        return line('GameLog.cardMoved.top', { actor: p(actor), card: cardSeg, from });
      }
      return line('GameLog.cardMoved.position', { actor: p(actor), card: cardSeg, from, position: n(x + 1) });
    }
    default:
      return faceDown
        ? line('GameLog.cardMoved.customFaceDown', { actor: p(actor), card: cardSeg, from, targetZone: params.targetZone })
        : line('GameLog.cardMoved.custom', { actor: p(actor), card: cardSeg, from, targetZone: params.targetZone });
  }

}

function renderCardFlipped(params: LogParamsByKind['cardFlipped'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  const actor = playerName(params.actor);
  const nameSeg = c(params.cardName);
  return params.faceDown
    ? line('GameLog.cardFlipped.down', { actor: p(actor), card: nameSeg })
    : line('GameLog.cardFlipped.up', { actor: p(actor), card: nameSeg });

}

function renderCardDestroyed(params: LogParamsByKind['cardDestroyed'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  return line('GameLog.cardDestroyed.message', { actor: p(playerName(params.actor)), card: c(params.cardName) });

}

function renderCardAttached(params: LogParamsByKind['cardAttached'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  const actor = playerName(params.actor);
  const sourceSeg = c(params.cardName);
  if (params.detached) {
    return line('GameLog.cardAttached.detach', { actor: p(actor), card: sourceSeg });
  }
  const targetPlayer = playerName(params.targetOwner);
  const targetCardSeg = c(
    params.targetCardName,
  );
  return line('GameLog.cardAttached.attach', { actor: p(actor), card: sourceSeg, target: p(targetPlayer), targetCard: targetCardSeg });

}

function renderTokenCreated(params: LogParamsByKind['tokenCreated'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  const actor = playerName(params.actor);
  if (params.faceDown) {
    return line('GameLog.tokenCreated.faceDown', { actor: p(actor) });
  }
  const nameSeg = c(params.cardName);
  return params.pt
    ? line('GameLog.tokenCreated.pt', { actor: p(actor), card: nameSeg, pt: params.pt })
    : line('GameLog.tokenCreated.name', { actor: p(actor), card: nameSeg });

}

function renderCardAttrChanged(params: LogParamsByKind['cardAttrChanged'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  const actor = playerName(params.actor);
  const cardSeg = c(params.cardName);
  switch (params.attribute as CardAttribute) {
    case CardAttribute.AttrTapped:
      return params.value === '1'
        ? line('GameLog.cardAttrChanged.tap', { actor: p(actor), card: cardSeg })
        : line('GameLog.cardAttrChanged.untap', { actor: p(actor), card: cardSeg });
    case CardAttribute.AttrAttacking:
      return params.value === '1'
        ? line('GameLog.cardAttrChanged.attack', { actor: p(actor), card: cardSeg })
        : null;
    case CardAttribute.AttrFaceDown:
      return null;
    case CardAttribute.AttrColor:
      return null;
    case CardAttribute.AttrPT: {
      if (!params.value) {
        return line('GameLog.cardAttrChanged.removePT', { actor: p(actor), card: cardSeg });
      }
      const oldPT = params.previousPT;
      if (!oldPT) {
        return line('GameLog.cardAttrChanged.setPT', { actor: p(actor), card: cardSeg, value: n(params.value) });
      }
      return line('GameLog.cardAttrChanged.changePT', { actor: p(actor), card: cardSeg, previous: n(oldPT), value: n(params.value) });
    }
    case CardAttribute.AttrAnnotation:
      return params.value
        ? line('GameLog.cardAttrChanged.annotation', { actor: p(actor), card: cardSeg, value: params.value })
        : line('GameLog.cardAttrChanged.clearAnnotation', { actor: p(actor), card: cardSeg });
    case CardAttribute.AttrDoesntUntap:
      return params.value === '1'
        ? line('GameLog.cardAttrChanged.doesntUntap', { actor: p(actor), card: cardSeg })
        : line('GameLog.cardAttrChanged.untaps', { actor: p(actor), card: cardSeg });
    default:
      return null;
  }

}

function renderCardAttrChangedBulk(params: LogParamsByKind['cardAttrChangedBulk'], context: LogContext): FormattedLog {
  const { playerName, line } = context;
  return params.tapped
    ? line('GameLog.cardAttrChangedBulk.tap', { actor: p(playerName(params.actor)) })
    : line('GameLog.cardAttrChangedBulk.untap', { actor: p(playerName(params.actor)) });
}

function renderCardCounterChanged(params: LogParamsByKind['cardCounterChanged'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  const actor = playerName(params.actor);
  const cardSeg = c(params.cardName);
  const delta = params.value - params.previousValue;
  if (delta > 0) {
    return line('GameLog.cardCounterChanged.add', { actor: p(actor), delta: n(delta), card: cardSeg, value: n(params.value) });
  }
  if (delta < 0) {
    return line('GameLog.cardCounterChanged.remove', { actor: p(actor), delta: n(-delta), card: cardSeg, value: n(params.value) });
  }
  return line('GameLog.cardCounterChanged.set', { actor: p(actor), card: cardSeg, value: n(params.value) });

}

function renderCounterSet(params: LogParamsByKind['counterSet'], context: LogContext): FormattedLog | null {
  const { playerName, line, displayCounterName } = context;
  const actor = playerName(params.actor);
  const displayName = displayCounterName(params.counterName);
  const delta = params.value - params.previousValue;
  const sign = delta > 0 ? '+' : '';
  return line('GameLog.counterSet.message', { actor: p(actor), displayName, value: n(params.value), delta: n(`${sign}${delta}`) });

}

function renderCardsDrawn(params: LogParamsByKind['cardsDrawn'], context: LogContext): FormattedLog | null {
  const { playerName, line } = context;
  const actor = playerName(params.actor);
  return params.count === 1
    ? line('GameLog.cardsDrawn.one', { actor: p(actor), count: n(1) })
    : line('GameLog.cardsDrawn.many', { actor: p(actor), count: n(params.count) });

}

function renderCardUndoneDraw(params: LogParamsByKind['cardUndoneDraw'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  const actor = playerName(params.actor);
  if (params.cardName) {
    return line('GameLog.cardUndoneDraw.named', { actor: p(actor), card: c(params.cardName) });
  }
  return line('GameLog.cardUndoneDraw.unknown', { actor: p(actor) });

}

function renderUndoDrawFailed(params: LogParamsByKind['undoDrawFailed'], context: LogContext): FormattedLog | null {
  const { playerName, line } = context;
  return line('GameLog.undoDrawFailed.message', { actor: p(playerName(params.actor)) });

}

function renderZoneShuffled(params: LogParamsByKind['zoneShuffled'], context: LogContext): FormattedLog | null {
  const { playerName, line } = context;
  return line('GameLog.zoneShuffled.message', { actor: p(playerName(params.actor)) });

}

function renderCardPeeked(params: LogParamsByKind['cardPeeked'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
  const actor = playerName(params.actor);
  if (params.cardName) {
    return line('GameLog.cardPeeked.named', { actor: p(actor), cardId: n(params.cardId), card: c(params.cardName) });
  }
  return line('GameLog.cardPeeked.unknown', { actor: p(actor), cardId: n(params.cardId) });

}

function renderCardsRevealed(params: LogParamsByKind['cardsRevealed'], context: LogContext): FormattedLog | null {
  const { playerName, line, zoneLabelReveal, label } = context;
  const actor = playerName(params.actor);
  const zone = zoneLabelReveal(params.zoneName, true);
  const isLend = params.lend;
  const hasTarget = params.target !== null;
  const targetName = hasTarget ? playerName(params.target!) : null;

  if (params.mode === 'zone') {
    if (isLend) {
      if (!targetName) {
        return line('GameLog.cardsRevealed.lendAll', { actor: p(actor), zone });
      }
      return line('GameLog.cardsRevealed.lendTarget', { actor: p(actor), zone, target: p(targetName) });
    }
    if (targetName) {
      return line('GameLog.cardsRevealed.zoneTarget', { actor: p(actor), zone, target: p(targetName) });
    }
    return line('GameLog.cardsRevealed.zone', { actor: p(actor), zone });
  }

  const isTopNReveal = params.mode === 'top';
  if (isTopNReveal) {
    const count = params.count;
    if (count <= 0) {
      return null;
    }
    if (targetName) {
      return count === 1
        ? line('GameLog.cardsRevealed.oneTarget', { actor: p(actor), count: n(1), zone, target: p(targetName) })
        : line('GameLog.cardsRevealed.manyTarget', { actor: p(actor), count: n(count), zone, target: p(targetName) });
    }
    return count === 1
      ? line('GameLog.cardsRevealed.one', { actor: p(actor), count: n(1), zone })
      : line('GameLog.cardsRevealed.many', { actor: p(actor), count: n(count), zone });
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
    const fromLabel = params.zoneName === ZoneName.TABLE ? label('zone.play') : zoneLabelReveal(params.zoneName, false);
    if (targetName) {
      return line('GameLog.cardsRevealed.cardsTarget', { actor: p(actor), count: n(count), fromLabel, target: p(targetName) });
    }
    return line('GameLog.cardsRevealed.cards', { actor: p(actor), count: n(count), fromLabel });
  }

  return null;

}

function renderZoneDumped(params: LogParamsByKind['zoneDumped'], context: LogContext): FormattedLog | null {
  const { playerName, line, zoneLabelReveal, zoneLabelBare, label } = context;
  const actor = playerName(params.actor);
  const isOwner = params.owner.id === params.actor.id;
  const zoneLabel = zoneLabelReveal(params.zoneName, isOwner);
  if (params.count < 0) {
    if (isOwner) {
      return line('GameLog.zoneDumped.own', { actor: p(actor), zoneLabel });
    }
    const ownerName = playerName(params.owner);
    return line('GameLog.zoneDumped.other', { actor: p(actor), owner: p(ownerName), zone: zoneLabelBare(params.zoneName) });
  }
  const countSeg = n(params.count);
  const noun = label(params.count === 1 ? 'card.one' : 'card.many');
  if (isOwner) {
    return line('GameLog.zoneDumped.topOwn', { actor: p(actor), count: countSeg, noun, zoneLabel });
  }
  const ownerName = playerName(params.owner);
  return line('GameLog.zoneDumped.topOther', {
    actor: p(actor),
    count: countSeg,
    noun,
    owner: p(ownerName),
    zone: zoneLabelBare(params.zoneName),
  });

}

function renderZonePropertiesChanged(params: LogParamsByKind['zonePropertiesChanged'], context: LogContext): FormattedLog | null {
  const { playerName, line, zoneLabelReveal } = context;
  const actor = playerName(params.actor);
  const zone = zoneLabelReveal(params.zoneName, true);
  if (params.reveal) {
    return line('GameLog.zonePropertiesChanged.reveal', { actor: p(actor), zone });
  }
  if (params.look) {
    return line('GameLog.zonePropertiesChanged.look', { actor: p(actor), zone });
  }
  return line('GameLog.zonePropertiesChanged.hide', { actor: p(actor), zone });

}

function renderActivePhaseSet(params: LogParamsByKind['activePhaseSet'], context: LogContext): FormattedLog | null {
  const { line, phaseName } = context;
  return line('GameLog.activePhaseSet.message', { phase: phaseName(params.phase) });

}

function renderActivePlayerSet(params: LogParamsByKind['activePlayerSet'], context: LogContext): FormattedLog | null {
  const { playerName, line } = context;
  return line('GameLog.activePlayerSet.message', { actor: p(playerName(params.actor)) });

}

function renderTurnReversed(params: LogParamsByKind['turnReversed'], context: LogContext): FormattedLog | null {
  const { playerName, line } = context;
  const actor = playerName(params.actor);
  return params.reversed
    ? line('GameLog.turnReversed.reversed', { actor: p(actor) })
    : line('GameLog.turnReversed.normal', { actor: p(actor) });

}

function renderDieRolled(params: LogParamsByKind['dieRolled'], context: LogContext): FormattedLog | null {
  const { playerName, line, label } = context;
  const actor = playerName(params.actor);
  const rolls = params.rolls;
  if (rolls.length === 0) {
    return line('GameLog.dieRolled.none', { actor: p(actor), sides: n(params.sides) });
  }
  if (rolls.length === 1) {
    const roll = rolls[0];
    if (params.sides === 2) {
      const face = label(roll === 1 ? 'coin.heads' : 'coin.tails');
      return line('GameLog.dieRolled.coin', { actor: p(actor), face: n(face) });
    }
    return line('GameLog.dieRolled.single', { actor: p(actor), roll: n(roll), sides: n(params.sides) });
  }
  if (params.sides === 2) {
    const heads = rolls.filter((r) => r === 1).length;
    const tails = rolls.filter((r) => r === 2).length;
    return line('GameLog.dieRolled.coins', { actor: p(actor), count: n(rolls.length), heads: n(heads), tails: n(tails) });
  }
  return line('GameLog.dieRolled.multiple', {
    actor: p(actor),
    sides: n(params.sides),
    count: n(rolls.length),
    rolls: n(rolls.join(', ')),
  });

}

function renderPlayerJoined(params: LogParamsByKind['playerJoined'], context: LogContext): FormattedLog | null {
  const { playerName, line } = context;
  return line('GameLog.playerJoined.message', { actor: p(playerName(params.actor)) });

}

function renderLeaveMessage(params: LogParamsByKind['playerLeft'], context: LogContext): FormattedLog | null {
  const { playerName, line, label } = context;
  const reasonText = label(`leaveReason.${params.reason >= 1 && params.reason <= 4 ? params.reason : 1}`);
  return line('GameLog.leaveMessage.message', { actor: p(playerName(params.actor)), reasonText });

}

function renderArrowCreated(params: LogParamsByKind['arrowCreated'], context: LogContext): FormattedLog | null {
  const { playerName, c, line } = context;
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
      return line('GameLog.arrowCreated.selfPlayer', { actor: p(actor), sourceCard: sourceCardSeg });
    }
    if (actorIsSource) {
      return line('GameLog.arrowCreated.ownPlayer', { actor: p(actor), sourceCard: sourceCardSeg, target: p(targetPlayerName) });
    }
    if (actorIsTarget) {
      return line('GameLog.arrowCreated.otherSelf', { actor: p(actor), source: p(sourcePlayerName), sourceCard: sourceCardSeg });
    }
    return line('GameLog.arrowCreated.otherPlayer', {
      actor: p(actor),
      source: p(sourcePlayerName),
      sourceCard: sourceCardSeg,
      target: p(targetPlayerName),
    });
  }

  const targetCardSeg = c(
    params.targetCardName,
  );
  if (actorIsSource && actorIsTarget) {
    return line('GameLog.arrowCreated.selfCard', { actor: p(actor), sourceCard: sourceCardSeg, targetCard: targetCardSeg });
  }
  if (actorIsSource) {
    return line('GameLog.arrowCreated.ownCard', {
      actor: p(actor),
      sourceCard: sourceCardSeg,
      target: p(targetPlayerName),
      targetCard: targetCardSeg,
    });
  }
  if (actorIsTarget) {
    return line('GameLog.arrowCreated.otherOwnCard', {
      actor: p(actor),
      source: p(sourcePlayerName),
      sourceCard: sourceCardSeg,
      targetCard: targetCardSeg,
    });
  }
  return line('GameLog.arrowCreated.otherCard', {
    actor: p(actor),
    source: p(sourcePlayerName),
    sourceCard: sourceCardSeg,
    target: p(targetPlayerName),
    targetCard: targetCardSeg,
  });

}

export function formatLogDescriptor(entry: LogDescriptor, t: TFunction): FormattedLog {
  const context = createLogContext(t);
  const { line, playerName } = context;
  switch (entry.kind) {
    case 'cardMoved': return renderCardMoved(entry.params, context)!;
    case 'cardFlipped': return renderCardFlipped(entry.params, context)!;
    case 'cardDestroyed': return renderCardDestroyed(entry.params, context)!;
    case 'cardAttached': return renderCardAttached(entry.params, context)!;
    case 'tokenCreated': return renderTokenCreated(entry.params, context)!;
    case 'cardAttrChanged': return renderCardAttrChanged(entry.params, context)!;
    case 'cardAttrChangedBulk': return renderCardAttrChangedBulk(entry.params, context)!;
    case 'cardCounterChanged': return renderCardCounterChanged(entry.params, context)!;
    case 'counterSet': return renderCounterSet(entry.params, context)!;
    case 'cardsDrawn': return renderCardsDrawn(entry.params, context)!;
    case 'cardUndoneDraw': return renderCardUndoneDraw(entry.params, context)!;
    case 'undoDrawFailed': return renderUndoDrawFailed(entry.params, context)!;
    case 'zoneShuffled': return renderZoneShuffled(entry.params, context)!;
    case 'cardPeeked': return renderCardPeeked(entry.params, context)!;
    case 'cardsRevealed': return renderCardsRevealed(entry.params, context)!;
    case 'zoneDumped': return renderZoneDumped(entry.params, context)!;
    case 'zonePropertiesChanged': return renderZonePropertiesChanged(entry.params, context)!;
    case 'activePhaseSet': return renderActivePhaseSet(entry.params, context)!;
    case 'activePlayerSet': return renderActivePlayerSet(entry.params, context)!;
    case 'turnReversed': return renderTurnReversed(entry.params, context)!;
    case 'dieRolled': return renderDieRolled(entry.params, context)!;
    case 'playerJoined': return renderPlayerJoined(entry.params, context)!;
    case 'playerLeft': return renderLeaveMessage(entry.params, context)!;
    case 'gameStarted': return line('GameLog.gameStarted.message');
    case 'gameClosed': return line('GameLog.gameClosed.message');
    case 'replayStarted': return line('GameLog.replayStarted.message', { gameId: String(entry.params.gameId) });
    case 'arrowCreated': return renderArrowCreated(entry.params, context)!;
    case 'playerConceded': return line('GameLog.playerConceded.message', { actor: p(playerName(entry.params.actor)) });
    case 'playerUnconceded': return line('GameLog.playerUnconceded.message', { actor: p(playerName(entry.params.actor)) });
    case 'playerReady': return line('GameLog.playerReady.message', { actor: p(playerName(entry.params.actor)) });
    case 'playerUnready': return line('GameLog.playerUnready.message', { actor: p(playerName(entry.params.actor)) });
    case 'sideboardLocked': return line('GameLog.sideboardLocked.message', { actor: p(playerName(entry.params.actor)) });
    case 'sideboardUnlocked': return line('GameLog.sideboardUnlocked.message', { actor: p(playerName(entry.params.actor)) });
    case 'deckLoaded': return line('GameLog.deckLoaded.message', {
      actor: p(playerName(entry.params.actor)),
      hash: entry.params.hash,
    });
  }
}
