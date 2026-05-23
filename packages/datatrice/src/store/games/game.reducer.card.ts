import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { isFieldSet } from '@bufbuild/protobuf';
import { Data } from '../../types';
import { GamesState } from './game.interfaces';
import { pushEventMessage } from './game.reducer.helpers';
import { formatZonePropertiesChanged } from './messageLog';

export const cardReducers = {
  cardMoved: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Data.Event_MoveCard }>
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
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_FlipCard }>>,

  cardDestroyed: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Data.Event_DestroyCard }>
  >,

  cardAttached: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Data.Event_AttachCard }>
  >,

  tokenCreated: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Data.Event_CreateToken }>
  >,

  cardAttrChanged: (() => {}) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Data.Event_SetCardAttr }>>,

  cardCounterChanged: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Data.Event_SetCardCounter }>
  >,

  cardsDrawn: (() => {}) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; data: Data.Event_DrawCards }>
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
