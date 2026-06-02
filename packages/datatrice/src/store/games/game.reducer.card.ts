import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { clone, isFieldSet } from '@bufbuild/protobuf';
import {
  Event_AttachCard,
  Event_ChangeZoneProperties,
  Event_ChangeZonePropertiesSchema,
  Event_CreateToken,
  Event_DestroyCard,
  Event_DrawCards,
  Event_FlipCard,
  Event_MoveCard,
  Event_RevealCards,
  Event_SetCardAttr,
  Event_SetCardCounter,
  ServerInfo_Card,
  ServerInfo_CardSchema,
} from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';
import { pushEventMessage } from './game.reducer.helpers';
import { formatZonePropertiesChanged } from './messageLog';

// Re-index a zone-view (HiddenZone/deck) snapshot so each card's id equals its
// list position, mirroring Cockatrice's ZoneViewZoneLogic::updateCardIds. Clone
// schema-aware to change the id — spreading a proto2 message drops unset optional
// fields. Only entries whose id changed are cloned.
function reindexRevealed(cards: ServerInfo_Card[]): ServerInfo_Card[] {
  return cards.map((card, i) => {
    if (card.id === i) {
      return card;
    }
    const reindexed = clone(ServerInfo_CardSchema, card);
    reindexed.id = i;
    return reindexed;
  });
}

export const cardReducers = {
  cardMoved: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Event_MoveCard }>
  >,

  cardFlipped: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const { zoneName, cardId, cardName, faceDown, cardProviderId } = data;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[zoneName];
    const card = zone?.byId[cardId];
    if (!game || !zone || !card) {
      return;
    }
    zone.byId[cardId] = {
      ...card,
      faceDown,
      name: cardName || card.name,
      providerId: cardProviderId || card.providerId,
    };
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_FlipCard }>>,

  cardDestroyed: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Event_DestroyCard }>
  >,

  cardAttached: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Event_AttachCard }>
  >,

  tokenCreated: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Event_CreateToken }>
  >,

  cardAttrChanged: (() => {}) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_SetCardAttr }>>,

  cardCounterChanged: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Event_SetCardCounter }>
  >,

  cardsDrawn: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Event_DrawCards }>
  >,

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
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_RevealCards }>>,

  zoneViewRevealed: ((state, action) => {
    const { gameId, playerId, zoneName, cards } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }
    // Store the Response_DumpZone card list verbatim (face-up, list-index ids). Do not spread the
    // protobuf messages — that would drop unset optional fields.
    zone.revealedCards = cards;
  }) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; zoneName: string; cards: ServerInfo_Card[] }>
  >,

  zoneViewCleared: ((state, action) => {
    const { gameId, playerId, zoneName } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }
    delete zone.revealedCards;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; zoneName: string }>>,

  // Prune a card from the open zone-view snapshot when it moves out, mirroring
  // Cockatrice's live view (ZoneViewZoneLogic::removeCard → updateCardIds). The
  // snapshot only ever holds a HiddenZone (deck) dump whose ids are list indices,
  // so after removing `position` we re-index the survivors to their new 0..n-1
  // slots. Empty snapshot is dropped (popup falls back to empty).
  zoneViewCardRemoved: ((state, action) => {
    const { gameId, playerId, zoneName, position } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone || !zone.revealedCards || position < 0 || position >= zone.revealedCards.length) {
      return;
    }
    const remaining = zone.revealedCards.filter((_, i) => i !== position);
    if (remaining.length === 0) {
      delete zone.revealedCards;
    } else {
      zone.revealedCards = reindexRevealed(remaining);
    }
  }) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; zoneName: string; position: number }>
  >,

  // Reorder a card within the open zone-view (deck/library) snapshot. The deck is
  // a HiddenZone whose real display is revealedCards (byId/order are empty), so a
  // same-zone drag reorders the snapshot and re-indexes it — never byId. from/to
  // are the event's `position` (pre-move index) and `x` (post-move index).
  zoneViewCardReordered: ((state, action) => {
    const { gameId, playerId, zoneName, fromPosition, toPosition } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone || !zone.revealedCards || fromPosition < 0 || fromPosition >= zone.revealedCards.length) {
      return;
    }
    const next = [...zone.revealedCards];
    const [moved] = next.splice(fromPosition, 1);
    const clampedTo = Math.max(0, Math.min(toPosition, next.length));
    next.splice(clampedTo, 0, moved);
    zone.revealedCards = reindexRevealed(next);
  }) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; zoneName: string; fromPosition: number; toPosition: number }>
  >,

  zonePropertiesChanged: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const game = state.games[gameId];
    const zone = game?.players[playerId]?.zones[data.zoneName];
    if (!game || !zone) {
      return;
    }
    if (isFieldSet(data, Event_ChangeZonePropertiesSchema.field.alwaysRevealTopCard)) {
      zone.alwaysRevealTopCard = data.alwaysRevealTopCard;
    }
    if (isFieldSet(data, Event_ChangeZonePropertiesSchema.field.alwaysLookAtTopCard)) {
      zone.alwaysLookAtTopCard = data.alwaysLookAtTopCard;
    }
    pushEventMessage(game, playerId, formatZonePropertiesChanged(game, playerId, data));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_ChangeZoneProperties }>>,
};
