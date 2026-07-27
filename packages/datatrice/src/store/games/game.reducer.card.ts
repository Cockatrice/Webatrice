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
import { cloneWith } from '../../common';
import { GamesState, IncomingReveal } from './game.interfaces';
import { pushEventMessage } from './game.reducer.helpers';
import { formatZonePropertiesChanged } from './messageLog';

// Re-index a zone-view (HiddenZone/deck) snapshot so each card's id equals its
// actual deck position, mirroring Cockatrice's ZoneViewZoneLogic::updateCardIds
// (view_zone_logic.cpp:92-124). For a top-N view startId is 0 (ids 0..N-1);
// for a bottom-N view of a `deckCount`-sized deck, startId is
// `deckCount - cards.length` (ids run deckCount-N..deckCount-1). Clone
// schema-aware to change the id — spreading a proto2 message drops unset
// optional fields. Only entries whose id changed are cloned.
function reindexRevealed(cards: ServerInfo_Card[], startId: number): ServerInfo_Card[] {
  return cards.map((card, i) => {
    const wantId = startId + i;
    if (card.id === wantId) {
      return card;
    }
    const reindexed = clone(ServerInfo_CardSchema, card);
    reindexed.id = wantId;
    return reindexed;
  });
}

// Deck position → reveal-array index for the given zone. Top view: identity.
// Bottom view: subtract the reveal's startId (the deck position of the
// first revealed card). Returns -1 when the deck position is outside the
// visible reveal window.
function deckPositionToRevealIndex(
  zone: { cardCount: number; revealedCards?: ServerInfo_Card[]; revealedIsReversed?: boolean },
  deckPosition: number,
): number {
  if (!zone.revealedCards) return -1;
  const startId = zone.revealedIsReversed
    ? zone.cardCount - zone.revealedCards.length
    : 0;
  const idx = deckPosition - startId;
  if (idx < 0 || idx >= zone.revealedCards.length) return -1;
  return idx;
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
    zone.byId[cardId] = cloneWith(ServerInfo_CardSchema, card, {
      faceDown,
      name: cardName || card.name,
      providerId: cardProviderId || card.providerId,
    });
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
      zone.byId[revealedCard.id] = clone(ServerInfo_CardSchema, revealedCard);
    }

    // Detect Servatrice's auto-reveal from revealTopCardIfNeeded
    // (server_abstract_player.cpp:553-580) and populate the persistent
    // topRevealedCard slot. Both auto-reveals AND cmdRevealCards's
    // "Reveal top N=1" path emit `cards.length === 1` with
    // `card_id === [0]` — indistinguishable on the wire — so the only
    // reliable signal is the zone-property flag already being on for
    // this zone (which auto-reveals require and cmdRevealCards
    // doesn't). Order is safe because Cockatrice's server enqueues
    // Event_ChangeZoneProperties BEFORE the auto-reveal event
    // (server_player.cpp:576-583), so the flag is up-to-date by the
    // time this reducer runs.
    const isAutoTopReveal =
      cards.length === 1 &&
      (zone.alwaysRevealTopCard || zone.alwaysLookAtTopCard);
    if (isAutoTopReveal) {
      zone.topRevealedCard = clone(ServerInfo_CardSchema, cards[0]);
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_RevealCards }>>,

  zoneViewRevealed: ((state, action) => {
    const { gameId, playerId, zoneName, cards, isReversed } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }
    // Reindex ids to positional (Cockatrice's ZoneViewZoneLogic::updateCardIds,
    // view_zone_logic.cpp:92-124) so downstream code can send them straight
    // into Command_MoveCard's `card_id` (HiddenZone treats card_id as a
    // deck-position index, server_cardzone.cpp:172-184).
    //
    // Two upstream event flavors reach this reducer with different id
    // conventions:
    //   • Response_DumpZone (view top/bottom N cards) already sets ids
    //     positionally per view mode (server_abstract_player.cpp:1416-1423):
    //     0..N-1 for top, deckCount-N..deckCount-1 for bottom.
    //   • Event_RevealCards (Reveal / Lend library) sets ids to the SERVER'S
    //     INTERNAL card ids (server_abstract_player.cpp:1535
    //     `cardInfo->set_id(card->getId())`) — which are NOT positions.
    //     Cockatrice desktop rewrites these to positional immediately
    //     via updateCardIds; we mirror that here.
    //
    // Reindex handles both: top view + DumpZone → no-op (ids already 0..N-1);
    // top view + RevealCards → OVERWRITES internal ids with 0..N-1;
    // bottom view → assigns deckCount-N..deckCount-1.
    const startId = isReversed ? zone.cardCount - cards.length : 0;
    zone.revealedCards = reindexRevealed(cards, startId);
    zone.revealedIsReversed = isReversed;
  }) as CaseReducer<
    GamesState,
    PayloadAction<{
      gameId: number;
      playerId: number;
      zoneName: string;
      cards: ServerInfo_Card[];
      isReversed: boolean;
    }>
  >,

  zoneViewCleared: ((state, action) => {
    const { gameId, playerId, zoneName } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }
    delete zone.revealedCards;
    delete zone.revealedIsReversed;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; zoneName: string }>>,

  // Prune a card from the open zone-view snapshot when it moves out, mirroring
  // Cockatrice's live view (ZoneViewZoneLogic::removeCard → updateCardIds). The
  // event's `position` is the source DECK POSITION (not a reveal-array index);
  // for a top view they coincide, for a bottom view we translate through the
  // reveal's startId. Cross-zone removal has already decremented cardCount
  // (cardMovedBetweenZones ran first), and the reveal's startId is invariant
  // across the removal (deckCount-1 - (N-1) = deckCount-N), so we can reindex
  // with the same isReversed formula.
  zoneViewCardRemoved: ((state, action) => {
    const { gameId, playerId, zoneName, position } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone || !zone.revealedCards) return;
    const revealIndex = deckPositionToRevealIndex(zone, position);
    if (revealIndex < 0) return;
    const remaining = zone.revealedCards.filter((_, i) => i !== revealIndex);
    if (remaining.length === 0) {
      delete zone.revealedCards;
      delete zone.revealedIsReversed;
    } else {
      const startId = zone.revealedIsReversed
        ? zone.cardCount - remaining.length
        : 0;
      zone.revealedCards = reindexRevealed(remaining, startId);
    }
  }) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; zoneName: string; position: number }>
  >,

  // Insert a card into the open zone-view snapshot when a cross-zone move
  // lands in the viewed zone. The event's `position` here is the destination
  // deck position (`x` on Event_MoveCard); translate to a reveal-array
  // index. If the insertion falls outside the visible window we drop it —
  // the card entered a hidden part of the deck.
  zoneViewCardInserted: ((state, action) => {
    const { gameId, playerId, zoneName, position, card } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone || !zone.revealedCards) return;
    // For inserts, cardCount already reflects the added card. Compute
    // startId from the current cardCount and the SOON-to-grow reveal
    // length so the resulting invariant still holds after splice.
    const nextLen = zone.revealedCards.length + 1;
    const startId = zone.revealedIsReversed ? zone.cardCount - nextLen : 0;
    const revealIndex = position - startId;
    if (revealIndex < 0 || revealIndex > zone.revealedCards.length) return;
    const next = [...zone.revealedCards];
    next.splice(revealIndex, 0, card);
    zone.revealedCards = reindexRevealed(next, startId);
  }) as CaseReducer<
    GamesState,
    PayloadAction<{
      gameId: number;
      playerId: number;
      zoneName: string;
      position: number;
      card: ServerInfo_Card;
    }>
  >,

  // Reorder a card within the open zone-view (deck/library) snapshot. The deck
  // is a HiddenZone whose real display is revealedCards (byId/order are empty),
  // so a same-zone drag reorders the snapshot and re-indexes it — never byId.
  // fromPosition/toPosition are the event's `position` and `x`, both deck
  // positions; translate to reveal-array indices. Same-zone reorder doesn't
  // change deck size, so startId is stable.
  zoneViewCardReordered: ((state, action) => {
    const { gameId, playerId, zoneName, fromPosition, toPosition } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone || !zone.revealedCards) return;
    const fromIdx = deckPositionToRevealIndex(zone, fromPosition);
    if (fromIdx < 0) return;
    const startId = zone.revealedIsReversed
      ? zone.cardCount - zone.revealedCards.length
      : 0;
    // Clamp toIdx to [0, length] so drops past the last slot append.
    const toIdxRaw = toPosition - startId;
    const toIdx = Math.max(0, Math.min(toIdxRaw, zone.revealedCards.length - 1));
    const next = [...zone.revealedCards];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    zone.revealedCards = reindexRevealed(next, startId);
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
    // Deliberately DON'T clear topRevealedCard on toggle-off. Cockatrice
    // desktop keeps the previously-revealed face visible on the pile
    // until the top actually changes (draw / shuffle / move-from-deck)
    // — a top-change listener elsewhere clears it. Toggling off just
    // stops FUTURE auto-reveals; what was already known stays known.
    pushEventMessage(game, playerId, formatZonePropertiesChanged(game, playerId, data));
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_ChangeZoneProperties }>>,

  // Clear the persistent top-card face on a zone when the top
  // position might have changed. Dispatched by top-change listeners
  // (cardsDrawn, cardMoved from position 0, zoneShuffled). If the
  // auto-reveal flag is still on, the server will re-emit
  // Event_RevealCards immediately after the event that triggered
  // this clear and re-populate topRevealedCard — so the visible
  // face stays fresh. If the flag is off (or the deck is empty),
  // this leaves the pile showing a card back. Matches Cockatrice
  // desktop's behavior of preserving the last-revealed face
  // through toggle-off, then clearing only when a top-changing
  // event actually happens.
  topRevealedCardCleared: ((state, action) => {
    const { gameId, playerId, zoneName } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) return;
    delete zone.topRevealedCard;
  }) as CaseReducer<
    GamesState,
    PayloadAction<{ gameId: number; playerId: number; zoneName: string }>
  >,

  // Set the transient "someone revealed their zone to us" notification.
  // Dispatched by the cardsRevealed listener when Event_RevealCards
  // arrives with a populated `cards[]` — the UI mounts an
  // IncomingRevealDialog against this state. Only one reveal at a time;
  // a fresh one replaces any pending unread reveal.
  incomingRevealShown: ((state, action) => {
    state.incomingReveal = action.payload;
  }) as CaseReducer<GamesState, PayloadAction<IncomingReveal>>,

  // Clear the incoming-reveal notification (dialog closed).
  incomingRevealDismissed: ((state) => {
    state.incomingReveal = null;
  }) as CaseReducer<GamesState, PayloadAction<void>>,
};
