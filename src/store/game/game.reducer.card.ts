import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { create, isFieldSet } from '@bufbuild/protobuf';
import { App, Data, Enriched } from '@app/types';
import { GamesState } from './game.interfaces';
import { buildEmptyCard, pushEventMessage } from './game.reducer.helpers';
import {
  formatCardAttached,
  formatCardAttrChanged,
  formatCardCounterChanged,
  formatCardDestroyed,
  formatCardFlipped,
  formatCardMoved,
  formatCardsDrawn,
  formatTokenCreated,
  formatZonePropertiesChanged,
} from './messageLog';

export const cardReducers = {
  cardMoved: ((state, action) => {
    const { gameId, data } = action.payload;
    const {
      cardId, cardName, startPlayerId, startZone, position,
      targetPlayerId, targetZone, x, y, newCardId, faceDown, newCardProviderId,
    } = data;

    // Server omits target_zone when it equals start_zone (proto3 strips the
    // default empty string). Desktop's GameEventHandler applies the same
    // fallback; without it, intra-zone moves silently bail at the zone lookup.
    const effectiveTargetZone = targetZone || startZone;

    const game = state.games[gameId];
    if (!game) {
      return;
    }

    const sourcePlayer = game.players[startPlayerId];
    const sourceZone = sourcePlayer?.zones[startZone];
    if (!sourcePlayer || !sourceZone) {
      return;
    }

    const targetPlayer = game.players[targetPlayerId];
    const targetZoneEntry = targetPlayer?.zones[effectiveTargetZone];
    if (!targetPlayer || !targetZoneEntry) {
      return;
    }

    let resolvedCardId = -1;
    if (cardId >= 0) {
      resolvedCardId = cardId;
    } else if (position >= 0 && position < sourceZone.order.length) {
      resolvedCardId = sourceZone.order[position];
    }

    // If the card can't be resolved and no newCardId is provided, the event
    // is malformed — bail out to avoid creating phantom cards with id -1.
    if (resolvedCardId < 0 && newCardId < 0) {
      return;
    }

    // Remove from source zone if the card was resolved to a known entry
    let removedCard: Data.ServerInfo_Card | undefined;
    if (resolvedCardId >= 0) {
      removedCard = sourceZone.byId[resolvedCardId];
      const idx = sourceZone.order.indexOf(resolvedCardId);
      if (idx >= 0) {
        sourceZone.order.splice(idx, 1);
      }
      delete sourceZone.byId[resolvedCardId];
    }
    sourceZone.cardCount = Math.max(0, sourceZone.cardCount - 1);

    const effectiveNewId = newCardId >= 0 ? newCardId : (removedCard?.id ?? resolvedCardId);
    // Counters represent battlefield-only state in MTG; leaving the table
    // discards them. Mirrors Cockatrice's CardItem::resetState() which
    // clears `counters` on any zone transition out of play. Done client-side
    // because Servatrice does not always emit a zeroing cardCounterChanged
    // event on zone exit; this guard makes the divergence safe either way.
    const isLeavingBattlefield =
      startZone === App.ZoneName.TABLE && effectiveTargetZone !== App.ZoneName.TABLE;
    const movedCard: Data.ServerInfo_Card = removedCard
      ? {
        ...removedCard, id: effectiveNewId, name: cardName || removedCard.name,
        x, y, faceDown, providerId: newCardProviderId || removedCard.providerId,
        counterList: isLeavingBattlefield ? [] : [...removedCard.counterList],
      }
      : buildEmptyCard(effectiveNewId, cardName, x, y, faceDown, newCardProviderId ?? '');

    targetZoneEntry.order.push(movedCard.id);
    targetZoneEntry.byId[movedCard.id] = movedCard;
    targetZoneEntry.cardCount++;

    pushEventMessage(
      game,
      action.payload.playerId,
      // Pass the defaulted targetZone through so isSameZoneReorder in the
      // formatter correctly suppresses the log line for intra-zone reorders.
      formatCardMoved(
        game,
        action.payload.playerId,
        { ...data, targetZone: effectiveTargetZone },
        { resolvedCardName: removedCard?.name ?? '' },
      ),
    );
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_MoveCard }>>,

  cardFlipped: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { zoneName, cardId, cardName, faceDown, cardProviderId } = data;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[zoneName];
    const card = zone?.byId[cardId];
    if (!game || !zone || !card) {
      return;
    }
    const previousName = card.name;
    // Replace the card object so Immer's structural sharing fires — see the
    // comment on cardAttached for why mutating proto fields in place leaves
    // the zone reference unchanged and breaks re-render.
    zone.byId[cardId] = {
      ...card,
      faceDown,
      name: cardName || card.name,
      providerId: cardProviderId || card.providerId,
    };
    pushEventMessage(game, playerId, formatCardFlipped(game, playerId, data, previousName));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_FlipCard }>>,

  cardDestroyed: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { zoneName, cardId } = data;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[zoneName];
    if (!game || !zone) {
      return;
    }
    const destroyedName = zone.byId[cardId]?.name;
    const idx = zone.order.indexOf(cardId);
    if (idx >= 0) {
      zone.order.splice(idx, 1);
    }
    delete zone.byId[cardId];
    zone.cardCount = Math.max(0, zone.cardCount - 1);
    pushEventMessage(game, playerId, formatCardDestroyed(game, playerId, destroyedName));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_DestroyCard }>>,

  cardAttached: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { startZone, cardId, targetPlayerId, targetZone, targetCardId } = data;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[startZone];
    const card = zone?.byId[cardId];
    if (!game || !zone || !card) {
      return;
    }
    const sourceCardName = card.name;
    // Replace the card in byId rather than mutating it in place. Cards are
    // protobuf-es messages, which Immer does not recognise as draftable —
    // mutating `card.attachCardId` directly leaves the surrounding zone /
    // byId references unchanged, so the WeakMap-keyed selectors in
    // game.selectors.ts return stale arrays and the UI doesn't re-render
    // until something else dirties the zone. Assigning a fresh object to
    // `zone.byId[cardId]` triggers Immer's normal structural-sharing path.
    //
    // Unattach: desktop's actUnattach sends Event_AttachCard with target_*
    // fields unset. proto3 surfaces unset numerics as 0 and strings as '',
    // not -1. Detect via empty targetZone (attach always specifies a zone)
    // and write -1 / '' / -1 explicitly so downstream code (`isAttachedChild`
    // in useBattlefield, `materializeAttachmentsByParent`) recognizes the
    // card as detached.
    const isUnattach = !targetZone;
    zone.byId[cardId] = {
      ...card,
      attachPlayerId: isUnattach ? -1 : targetPlayerId,
      attachZone: isUnattach ? '' : targetZone,
      attachCardId: isUnattach ? -1 : targetCardId,
    };
    pushEventMessage(game, playerId, formatCardAttached(game, playerId, data, sourceCardName));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_AttachCard }>>,

  tokenCreated: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { zoneName, cardId, cardName, color, pt, annotation, destroyOnZoneChange, x, y, cardProviderId, faceDown } = data;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[zoneName];
    if (!game || !zone) {
      return;
    }
    const newCard = create(Data.ServerInfo_CardSchema, {
      id: cardId, name: cardName, x, y, faceDown,
      tapped: false, attacking: false, color, pt, annotation, destroyOnZoneChange,
      doesntUntap: false, counterList: [],
      attachPlayerId: -1, attachZone: '', attachCardId: -1, providerId: cardProviderId,
    });
    zone.order.push(newCard.id);
    zone.byId[newCard.id] = newCard;
    zone.cardCount++;
    pushEventMessage(game, playerId, formatTokenCreated(game, playerId, data));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_CreateToken }>>,

  cardAttrChanged: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { zoneName, cardId, attribute, attrValue } = data;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[zoneName];
    const card = zone?.byId[cardId];
    if (!game || !zone || !card) {
      return;
    }
    const cardName = card.name;
    // Build a new card object with the changed attribute, then assign it
    // back to byId. See cardAttached for why in-place field mutation on a
    // protobuf message would leave the zone reference untouched and the UI
    // frozen until another action dirties the zone.
    let updated: Data.ServerInfo_Card = card;
    switch (attribute as Data.CardAttribute) {
      case Data.CardAttribute.AttrTapped:
        updated = { ...card, tapped: attrValue === '1' }; break;
      case Data.CardAttribute.AttrAttacking:
        updated = { ...card, attacking: attrValue === '1' }; break;
      case Data.CardAttribute.AttrFaceDown:
        updated = { ...card, faceDown: attrValue === '1' }; break;
      case Data.CardAttribute.AttrColor:
        updated = { ...card, color: attrValue }; break;
      case Data.CardAttribute.AttrPT:
        updated = { ...card, pt: attrValue }; break;
      case Data.CardAttribute.AttrAnnotation:
        updated = { ...card, annotation: attrValue }; break;
      case Data.CardAttribute.AttrDoesntUntap:
        updated = { ...card, doesntUntap: attrValue === '1' }; break;
    }
    zone.byId[cardId] = updated;
    pushEventMessage(game, playerId, formatCardAttrChanged(game, playerId, data, cardName));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_SetCardAttr }>>,

  cardCounterChanged: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { zoneName, cardId, counterId, counterValue } = data;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[zoneName];
    const card = zone?.byId[cardId];
    if (!game || !zone || !card) {
      return;
    }
    const cardName = card.name;
    const previousValue = card.counterList.find(c => c.id === counterId)?.value ?? 0;
    // Build a fresh counterList, then assign a new card object — see
    // cardAttached for why in-place mutation on the proto card leaves the
    // surrounding zone reference unchanged and stops the UI from updating.
    let nextCounterList: Data.ServerInfo_CardCounter[];
    if (counterValue <= 0) {
      nextCounterList = card.counterList.filter(c => c.id !== counterId);
    } else {
      const idx = card.counterList.findIndex(c => c.id === counterId);
      if (idx >= 0) {
        nextCounterList = card.counterList.map((c, i) =>
          i === idx ? { ...c, value: counterValue } : c,
        );
      } else {
        nextCounterList = [
          ...card.counterList,
          create(Data.ServerInfo_CardCounterSchema, { id: counterId, value: counterValue }),
        ];
      }
    }
    zone.byId[cardId] = { ...card, counterList: nextCounterList };
    pushEventMessage(
      game,
      playerId,
      formatCardCounterChanged(game, playerId, data, cardName, previousValue),
    );
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_SetCardCounter }>>,

  cardsDrawn: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { number: drawCount, cards } = data;
    const game = state.games[gameId];
    const player = game?.players[playerId];
    if (!game || !player) {
      return;
    }

    const deckZone = player.zones[Enriched.ZoneName.DECK];
    const handZone = player.zones[Enriched.ZoneName.HAND];
    if (!handZone) {
      return;
    }

    if (deckZone) {
      deckZone.cardCount = Math.max(0, deckZone.cardCount - drawCount);
    }

    for (const card of cards) {
      handZone.order.push(card.id);
      handZone.byId[card.id] = card;
    }
    handZone.cardCount += drawCount;

    pushEventMessage(game, playerId, formatCardsDrawn(game, playerId, drawCount));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_DrawCards }>>,

  cardsRevealed: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { zoneName, cards } = data;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }

    for (const revealedCard of cards) {
      if (!zone.byId[revealedCard.id]) {
        zone.order.push(revealedCard.id);
      }
      zone.byId[revealedCard.id] = { ...revealedCard, counterList: [...revealedCard.counterList] };
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_RevealCards }>>,

  zonePropertiesChanged: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[data.zoneName];
    if (!game || !zone) {
      return;
    }
    if (isFieldSet(data, Data.Event_ChangeZonePropertiesSchema.field.alwaysRevealTopCard)) {
      zone.alwaysRevealTopCard = data.alwaysRevealTopCard;
    }
    if (isFieldSet(data, Data.Event_ChangeZonePropertiesSchema.field.alwaysLookAtTopCard)) {
      zone.alwaysLookAtTopCard = data.alwaysLookAtTopCard;
    }
    pushEventMessage(game, playerId, formatZonePropertiesChanged(game, playerId, data));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_ChangeZoneProperties }>>,
};
