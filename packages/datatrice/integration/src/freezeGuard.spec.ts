import { create, isMessage } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { attachResponseHandlers, createStore, games } from '../../src';
import {
  CardAttribute,
  Event_ChangeZonePropertiesSchema,
  Event_CreateCounterSchema,
  Event_DrawCardsSchema,
  Event_GameJoinedSchema,
  Event_GameStateChangedSchema,
  Event_MoveCardSchema,
  Event_RevealCardsSchema,
  Event_SetCardAttrSchema,
  Event_SetCounterSchema,
  ServerInfo_CardSchema,
  ServerInfo_CounterSchema,
  ServerInfo_GameSchema,
  ServerInfo_Player,
  ServerInfo_PlayerPropertiesSchema,
  ServerInfo_PlayerSchema,
  ServerInfo_RoomSchema,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';

// Integration: positive control for the dev-only freezeMessagesMiddleware.
// Drives the response bridge (the same handler methods the wire path calls)
// and asserts protobuf messages land FROZEN in state — so an in-place
// mutation of stored state throws instead of failing as silent staleness —
// across the game reducers' clone-and-reassign hot paths, the optimistic
// echo, and the rooms/server ingestion paths.
//
// This suite validates datatrice's own contract, independent of any consumer.
// Accepted gap: the Vite dev/prod bundle branch (`process.env.NODE_ENV`
// static replacement — the guard is compiled out of production) is
// intentionally not covered; see the expression-site comment in
// src/store/freezeMessagesMiddleware.ts.

type Store = ReturnType<typeof createStore>;

const GAME_ID = 42;

function expectWriteThrows(fn: () => void): void {
  // Frozen writes throw in strict mode, which all ESM specs are.
  expect(fn).toThrow(TypeError);
}

// Recursively collect paths of reachable protobuf messages that are NOT
// frozen — mirrors the middleware's own walk. Empty result = guard held.
function findUnfrozenMessages(
  value: unknown,
  path: string,
  visited = new Set<object>(),
  out: string[] = [],
): string[] {
  if (value === null || typeof value !== 'object' || visited.has(value as object)) {
    return out;
  }
  visited.add(value as object);
  if (value instanceof Uint8Array) {
    return out;
  }
  if (isMessage(value) && !Object.isFrozen(value)) {
    out.push(path);
  }
  for (const [key, nested] of Object.entries(value)) {
    findUnfrozenMessages(nested, `${path}.${key}`, visited, out);
  }
  return out;
}

// --- fixtures ------------------------------------------------------------

function playerWithCards(playerId: number, name: string): ServerInfo_Player {
  return create(ServerInfo_PlayerSchema, {
    properties: create(ServerInfo_PlayerPropertiesSchema, {
      playerId,
      userInfo: { name },
    }),
    deckList: '',
    zoneList: [
      {
        name: 'deck', type: 2, withCoords: false, cardCount: 1,
        cardList: [create(ServerInfo_CardSchema, { id: 100, name: 'Forest' })],
      },
      {
        name: 'hand', type: 0, withCoords: false, cardCount: 1,
        cardList: [create(ServerInfo_CardSchema, { id: 101, name: 'Lightning Bolt' })],
      },
      { name: 'table', type: 1, withCoords: true, cardCount: 0, cardList: [] },
    ],
    counterList: [],
    arrowList: [],
  });
}

/** Seeds a started game for Alice (player 1) holding deck card 100 ('Forest')
 *  and hand card 101 ('Lightning Bolt'). */
function seedGame(): { store: Store; response: WebsocketTypes.IWebClientResponse } {
  const store = createStore();
  const response = attachResponseHandlers(store);

  response.session.gameJoined(create(Event_GameJoinedSchema, {
    gameInfo: create(ServerInfo_GameSchema, {
      gameId: GAME_ID, roomId: 1, description: 'freeze-guard game', started: false,
    }),
    hostId: 1, playerId: 1, spectator: false, judge: false, resuming: false,
  }));
  response.game.gameStateChanged(GAME_ID, create(Event_GameStateChangedSchema, {
    playerList: [playerWithCards(1, 'Alice')],
    gameStarted: true,
    activePlayerId: 1,
    activePhase: 0,
  }));
  return { store, response };
}

function moveCard(
  response: WebsocketTypes.IWebClientResponse,
  params: { cardId: number; fromZone: string; toZone?: string; x?: number; y?: number; newCardId?: number },
): void {
  response.game.cardMoved(GAME_ID, 1, create(Event_MoveCardSchema, {
    cardId: params.cardId,
    startPlayerId: 1,
    startZone: params.fromZone,
    targetPlayerId: 1,
    targetZone: params.toZone ?? 'table',
    x: params.x ?? 0,
    y: params.y ?? 0,
    faceDown: false,
    newCardId: params.newCardId ?? params.cardId,
  }));
}

// Omitting cardId leaves the proto2 field unset — Cockatrice's bulk sentinel
// (untap-all) that routes to cardFieldsUpdatedBulk.
function setCardAttr(
  response: WebsocketTypes.IWebClientResponse,
  params: { cardId?: number; zoneName: string; attribute: CardAttribute; attrValue: string },
): void {
  response.game.cardAttrChanged(GAME_ID, 1, create(Event_SetCardAttrSchema, {
    ...(params.cardId !== undefined ? { cardId: params.cardId } : {}),
    zoneName: params.zoneName,
    attribute: params.attribute,
    attrValue: params.attrValue,
  }));
}

function player1(store: Store) {
  return store.getState().games.games[GAME_ID].players[1];
}

// --- game flows ----------------------------------------------------------

describe('freeze guard (bridge → store seam)', () => {
  it('freezes the full game graph landed by the join snapshot', () => {
    const { store } = seedGame();

    const game = store.getState().games.games[GAME_ID];
    expect(Object.isFrozen(game.info)).toBe(true);

    const player = player1(store);
    expect(Object.isFrozen(player.properties)).toBe(true);
    expect(Object.isFrozen(player.properties.userInfo)).toBe(true);

    const deckCard = player.zones.deck.byId[100];
    const handCard = player.zones.hand.byId[101];
    expect(Object.isFrozen(deckCard)).toBe(true);
    expect(Object.isFrozen(handCard)).toBe(true);
    const xBefore = handCard.x;
    expectWriteThrows(() => {
      handCard.x = 99;
    });
    expect(handCard.x).toBe(xBefore);
  });

  it('freezes a drawn card on cardsDrawn', () => {
    const { store, response } = seedGame();

    response.game.cardsDrawn(GAME_ID, 1, create(Event_DrawCardsSchema, {
      number: 1,
      cards: [create(ServerInfo_CardSchema, { id: 200, name: 'Mountain' })],
    }));

    const drawn = player1(store).zones.hand.byId[200];
    expect(Object.isFrozen(drawn)).toBe(true);
    expectWriteThrows(() => {
      drawn.name = 'Island';
    });
  });

  it('freezes the card landed in the target zone on cardMoved', () => {
    const { store, response } = seedGame();

    moveCard(response, { cardId: 101, fromZone: 'hand', x: 100, y: 200 });

    const moved = player1(store).zones.table.byId[101];
    expect(moved.x).toBe(100);
    expect(Object.isFrozen(moved)).toBe(true);
    expectWriteThrows(() => {
      moved.tapped = true;
    });
  });

  it('reassigns a fresh frozen card on cardAttrChanged (cardFieldsUpdated cloneWith site)', () => {
    const { store, response } = seedGame();

    moveCard(response, { cardId: 101, fromZone: 'hand' });
    const before = player1(store).zones.table.byId[101];

    setCardAttr(response, { cardId: 101, zoneName: 'table', attribute: CardAttribute.AttrTapped, attrValue: '1' });

    const after = player1(store).zones.table.byId[101];
    expect(after.tapped).toBe(true);
    expect(after).not.toBe(before);
    expect(Object.isFrozen(after)).toBe(true);
    // The clone-and-reassign convention left the prior message untouched.
    expect(before.tapped).toBe(false);
  });

  it('reassigns fresh frozen cards on bulk untap (cardAttrChanged with card_id unset)', () => {
    const { store, response } = seedGame();

    moveCard(response, { cardId: 100, fromZone: 'deck' });
    moveCard(response, { cardId: 101, fromZone: 'hand', x: 3 });
    setCardAttr(response, { cardId: 100, zoneName: 'table', attribute: CardAttribute.AttrTapped, attrValue: '1' });
    setCardAttr(response, { cardId: 101, zoneName: 'table', attribute: CardAttribute.AttrTapped, attrValue: '1' });

    const table = player1(store).zones.table;
    const tappedForest = table.byId[100];
    const tappedBolt = table.byId[101];
    expect(tappedForest.tapped).toBe(true);
    expect(tappedBolt.tapped).toBe(true);

    setCardAttr(response, { zoneName: 'table', attribute: CardAttribute.AttrTapped, attrValue: '0' });

    const after = player1(store).zones.table;
    for (const cardId of [100, 101]) {
      expect(after.byId[cardId].tapped).toBe(false);
      expect(Object.isFrozen(after.byId[cardId])).toBe(true);
    }
    expect(after.byId[100]).not.toBe(tappedForest);
    expect(after.byId[101]).not.toBe(tappedBolt);
    expect(tappedForest.tapped).toBe(true);
    expect(tappedBolt.tapped).toBe(true);
  });

  it('freezes revealed-card clones and the auto-reveal topRevealedCard slot', () => {
    const { store, response } = seedGame();

    // Flag the deck as always-reveal-top BEFORE the reveal, mirroring
    // Cockatrice's server event order — this routes the single-card reveal
    // into the persistent topRevealedCard slot as well.
    response.game.zonePropertiesChanged(GAME_ID, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'deck',
      alwaysRevealTopCard: true,
    }));
    response.game.cardsRevealed(GAME_ID, 1, create(Event_RevealCardsSchema, {
      zoneName: 'deck',
      cards: [create(ServerInfo_CardSchema, { id: 100, name: 'Forest' })],
    }));

    const deck = player1(store).zones.deck;
    expect(Object.isFrozen(deck.byId[100])).toBe(true);
    expect(deck.topRevealedCard?.name).toBe('Forest');
    expect(Object.isFrozen(deck.topRevealedCard)).toBe(true);
  });

  it('freezes counters through counterCreated and counterSet', () => {
    const { store, response } = seedGame();

    response.game.counterCreated(GAME_ID, 1, create(Event_CreateCounterSchema, {
      counterInfo: create(ServerInfo_CounterSchema, { id: 1, name: 'Life', count: 20, radius: 1 }),
    }));
    expect(Object.isFrozen(player1(store).counters[1])).toBe(true);

    response.game.counterSet(GAME_ID, 1, create(Event_SetCounterSchema, { counterId: 1, value: 17 }));

    const counter = player1(store).counters[1];
    expect(counter.count).toBe(17);
    expect(Object.isFrozen(counter)).toBe(true);
    expectWriteThrows(() => {
      counter.count = 0;
    });
  });

  it('freezes reassigned player properties on playerPropertiesChanged', () => {
    const { store, response } = seedGame();

    response.game.playerPropertiesChanged(GAME_ID, 1, create(ServerInfo_PlayerPropertiesSchema, {
      playerId: 1,
      conceded: true,
      userInfo: create(ServerInfo_UserSchema, { name: 'Alice' }),
    }));

    const properties = player1(store).properties;
    expect(properties.conceded).toBe(true);
    expect(Object.isFrozen(properties)).toBe(true);
    expect(Object.isFrozen(properties.userInfo)).toBe(true);
  });

  // --- optimistic echo ---------------------------------------------------

  it('freezes the migrated card when a server echo re-keys an optimistic move', () => {
    const { store, response } = seedGame();

    // Mimic the client's optimistic drag (webatrice GameBoardCell):
    // plain-spread card into the target zone, then the pending marker.
    const sourceCard = player1(store).zones.hand.byId[101];
    store.dispatch(games.Actions.cardMovedBetweenZones({
      gameId: GAME_ID,
      fromPlayerId: 1,
      fromZone: 'hand',
      fromCardId: 101,
      toPlayerId: 1,
      toZone: 'table',
      card: { ...sourceCard, x: 50, y: 60 },
    }));
    games.beginOptimistic(games.moveOpKey(1, 101), () => {});

    // Server echo re-keys the card: the listener migrates the frozen
    // optimistic entry to the new id via cloneWith — remove-then-insert.
    moveCard(response, { cardId: 101, fromZone: 'hand', x: 50, y: 60, newCardId: 505 });

    const table = player1(store).zones.table;
    expect(table.byId[101]).toBeUndefined();
    expect(table.byId[505]).toBeDefined();
    expect(table.byId[505].name).toBe('Lightning Bolt');
    expect(Object.isFrozen(table.byId[505])).toBe(true);
    expect(games.isOptimisticPending(games.moveOpKey(1, 101))).toBe(false);
  });

  it('freezes the position patch when a server echo corrects an optimistic move in place', () => {
    const { store, response } = seedGame();

    const sourceCard = player1(store).zones.hand.byId[101];
    store.dispatch(games.Actions.cardMovedBetweenZones({
      gameId: GAME_ID,
      fromPlayerId: 1,
      fromZone: 'hand',
      fromCardId: 101,
      toPlayerId: 1,
      toZone: 'table',
      card: { ...sourceCard, x: 10, y: 20 },
    }));
    games.beginOptimistic(games.moveOpKey(1, 101), () => {});
    const optimistic = player1(store).zones.table.byId[101];

    // Same id, corrected position → cardFieldsUpdated patch over the
    // optimistic entry (Servatrice stack sub-slot bump).
    moveCard(response, { cardId: 101, fromZone: 'hand', x: 13, y: 20 });

    const patched = player1(store).zones.table.byId[101];
    expect(patched.x).toBe(13);
    expect(patched).not.toBe(optimistic);
    expect(Object.isFrozen(patched)).toBe(true);
    expect(games.isOptimisticPending(games.moveOpKey(1, 101))).toBe(false);
  });

  // --- rooms + server ingestion -------------------------------------------

  it('freezes merged room-game info through the updateGames batch path', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.updateRooms([create(ServerInfo_RoomSchema, {
      roomId: 1, name: 'Lobby', gameList: [], userList: [], gametypeList: [],
    })]);

    response.room.updateGames(1, [
      create(ServerInfo_GameSchema, { gameId: 7, description: 'First', playerCount: 1 }),
    ]);
    const first = store.getState().rooms.rooms[1].games[7].info;
    expect(Object.isFrozen(first)).toBe(true);

    // Sparse follow-up: set fields win, unset fields survive via the
    // cloneWith merge (rooms.listeners upsert path).
    response.room.updateGames(1, [
      create(ServerInfo_GameSchema, { gameId: 7, playerCount: 2 }),
    ]);

    const merged = store.getState().rooms.rooms[1].games[7].info;
    expect(merged).not.toBe(first);
    expect(merged.playerCount).toBe(2);
    expect(merged.description).toBe('First');
    expect(Object.isFrozen(merged)).toBe(true);
  });

  it('freezes the merged room info on a sparse UPDATE_ROOMS re-broadcast', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.updateRooms([create(ServerInfo_RoomSchema, {
      roomId: 1, name: 'Lobby', description: 'Main', gameList: [], userList: [], gametypeList: [],
    })]);
    const before = store.getState().rooms.rooms[1].info;

    // Cockatrice's addClient/removeClient broadcast: only roomId +
    // playerCount populated. mergeSetFields onto a fresh clone.
    response.room.updateRooms([create(ServerInfo_RoomSchema, { roomId: 1, playerCount: 5 })]);

    const after = store.getState().rooms.rooms[1].info;
    expect(after).not.toBe(before);
    expect(after.playerCount).toBe(5);
    expect(after.name).toBe('Lobby');
    expect(Object.isFrozen(after)).toBe(true);
  });

  it('freezes room info including nested repeated userList', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.room.updateRooms([create(ServerInfo_RoomSchema, {
      roomId: 1,
      name: 'Lobby',
      gameList: [],
      userList: [create(ServerInfo_UserSchema, { name: 'alice' })],
      gametypeList: [],
    })]);

    const info = store.getState().rooms.rooms[1].info;
    expect(Object.isFrozen(info)).toBe(true);
    expect(Object.isFrozen(info.userList)).toBe(true);
    expectWriteThrows(() => {
      info.userList.push(create(ServerInfo_UserSchema, { name: 'eve' }));
    });
    expect(Object.isFrozen(info.userList[0])).toBe(true);
    expectWriteThrows(() => {
      info.userList[0].name = 'mallory';
    });
  });

  it('freezes session users on userJoined', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.userJoined(create(ServerInfo_UserSchema, { name: 'bob' }));

    const bob = store.getState().server.users['bob'];
    expect(Object.isFrozen(bob)).toBe(true);
    expectWriteThrows(() => {
      bob.name = 'mallory';
    });
  });

  // --- full-graph sweep ----------------------------------------------------

  it('leaves no unfrozen message reachable in the whole store after a combined flow', () => {
    const { store, response } = seedGame();

    response.game.cardsDrawn(GAME_ID, 1, create(Event_DrawCardsSchema, {
      number: 1,
      cards: [create(ServerInfo_CardSchema, { id: 200, name: 'Mountain' })],
    }));
    moveCard(response, { cardId: 101, fromZone: 'hand' });
    moveCard(response, { cardId: 100, fromZone: 'deck', x: 3 });
    setCardAttr(response, { cardId: 101, zoneName: 'table', attribute: CardAttribute.AttrTapped, attrValue: '1' });
    setCardAttr(response, { zoneName: 'table', attribute: CardAttribute.AttrTapped, attrValue: '0' });
    response.game.cardsRevealed(GAME_ID, 1, create(Event_RevealCardsSchema, {
      zoneName: 'hand',
      cards: [create(ServerInfo_CardSchema, { id: 200, name: 'Mountain' })],
    }));
    response.game.counterCreated(GAME_ID, 1, create(Event_CreateCounterSchema, {
      counterInfo: create(ServerInfo_CounterSchema, { id: 1, name: 'Life', count: 20, radius: 1 }),
    }));
    response.room.updateRooms([create(ServerInfo_RoomSchema, {
      roomId: 1, name: 'Lobby', gameList: [], userList: [], gametypeList: [],
    })]);
    response.session.userJoined(create(ServerInfo_UserSchema, { name: 'bob' }));

    expect(findUnfrozenMessages(store.getState(), 'state')).toEqual([]);
  });
});
