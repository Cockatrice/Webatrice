import { create } from '@bufbuild/protobuf';
import { configureStore, PayloadAction } from '@reduxjs/toolkit';
import {
  CardAttribute,
  Event_ChangeZonePropertiesSchema,
  Event_GameJoinedSchema,
  Event_GameStateChangedSchema,
  Event_MoveCard,
  Event_SetCardAttrSchema,
  ServerInfo_Card,
  ServerInfo_CardCounterSchema,
  ServerInfo_GameSchema,
  ServerInfo_Player,
  ServerInfo_PlayerPropertiesSchema,
  ServerInfo_PlayerSchema,
} from '@cockatrice/sockatrice/generated';
import { listenerMiddleware } from '../listenerMiddleware';
import { gamesReducer } from './game.reducer';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { registerGameListeners } from './game.listeners';
import { MAX_GAME_MESSAGES } from './game.reducer.helpers';

registerGameListeners(listenerMiddleware);
import {
  makeArrow,
  makeCard,
  makeCounter,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeState,
  makeZoneEntry,
} from '../../testing/fixtures/games';

function cardsIn(state: GamesState, gameId: number, playerId: number, zoneName: string): ServerInfo_Card[] {
  const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
  return zone ? zone.order.map(id => zone.byId[id]) : [];
}

function dispatchThroughStore<P>(
  state: GamesState,
  action: PayloadAction<P>
): GamesState {
  const store = configureStore({
    preloadedState: { games: state },
    reducer: { games: gamesReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
      .prepend(listenerMiddleware.middleware),
  });
  store.dispatch(action);
  return store.getState().games;
}

function dispatchCardMoved(
  state: GamesState,
  action: PayloadAction<{ gameId: number; playerId: number; data: Event_MoveCard }>
): GamesState {
  return dispatchThroughStore(state, action);
}


describe('2A: Initialisation & lifecycle', () => {
  it('returns initialState ({ games: {} }) when called with undefined state', () => {
    const result = gamesReducer(undefined, { type: '@@INIT' });
    expect(result).toEqual({ games: {} });
  });

  it('CLEAR_STORE → resets to initialState', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.clearStore());
    expect(result).toEqual({ games: {} });
  });

  it('GAME_JOINED → inserts gameEntry keyed by gameId', () => {
    const data = create(Event_GameJoinedSchema, {
      gameInfo: create(ServerInfo_GameSchema, { gameId: 42, roomId: 1, description: 'test' }),
      hostId: 5,
      playerId: 2,
      spectator: false,
      judge: false,
      resuming: false,
    });
    const result = gamesReducer({ games: {} }, Actions.gameJoined({ data }));
    const entry = result.games[42];
    expect(entry).toBeDefined();
    expect(entry.info.gameId).toBe(42);
    expect(entry.hostId).toBe(5);
    expect(entry.localPlayerId).toBe(2);
  });

  it('GAME_LEFT → removes game by gameId', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameLeft({ gameId: 1 }));
    expect(result.games[1]).toBeUndefined();
  });

  it('GAME_CLOSED → removes game by gameId', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameClosed({ gameId: 1 }));
    expect(result.games[1]).toBeUndefined();
  });

  it('KICKED → removes game by gameId', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.kicked({ gameId: 1 }));
    expect(result.games[1]).toBeUndefined();
  });

  it('GAME_HOST_CHANGED → updates hostId on existing game', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameHostChanged({ gameId: 1, hostId: 99 }));
    expect(result.games[1].hostId).toBe(99);
    expect(result).not.toBe(state);
  });
});


describe('2B: Game state & player management', () => {
  it('GAME_STATE_CHANGED with playerList → replaces players via normalizePlayers', () => {
    const state = makeState();
    const card = makeCard({ id: 5 });
    const counter = makeCounter({ id: 2 });
    const arrow = makeArrow({ id: 3 });
    const playerList: ServerInfo_Player[] = [
      create(ServerInfo_PlayerSchema, {
        properties: makePlayerProperties({ playerId: 7 }),
        deckList: 'some deck',
        zoneList: [
          {
            name: 'hand',
            type: 1,
            withCoords: false,
            cardCount: 1,
            cardList: [card],
            alwaysRevealTopCard: false,
            alwaysLookAtTopCard: false,
          },
        ],
        counterList: [counter],
        arrowList: [arrow],
      }),
    ];

    const result = dispatchThroughStore(state, Actions.gameStateChanged({
      gameId: 1,
      data: { playerList },
    }));

    const player = result.games[1].players[7];
    expect(player).toBeDefined();
    expect(cardsIn(result, 1, 7, 'hand')[0]).toEqual(card);
    expect(player.counters[2]).toEqual(counter);
    expect(player.arrows[3]).toEqual(arrow);
  });

  it('GAME_STATE_CHANGED with playerList lacking userInfo → preserves previously-known userInfo per player', () => {
    // Regression: Cockatrice's Server_Game::sendGameStateToPlayers always
    // emits Event_GameStateChanged with withUserInfo=false on resync (game
    // start, post-concede/unconcede). Without preservation, every name in
    // the UI would flip to "(unknown)" once the game starts.
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }),
            }),
          },
        }),
      },
    });
    const playerList: ServerInfo_Player[] = [
      create(ServerInfo_PlayerSchema, {
        properties: makePlayerProperties({ playerId: 1 }),
        deckList: 'some deck',
        zoneList: [],
        counterList: [],
        arrowList: [],
      }),
    ];

    const result = dispatchThroughStore(state, Actions.gameStateChanged({
      gameId: 1,
      data: { playerList },
    }));

    expect(result.games[1].players[1].properties.userInfo?.name).toBe('Alice');
  });

  it('GAME_STATE_CHANGED with scalar fields → updates started, activePlayerId, activePhase, secondsElapsed', () => {
    const state = makeState();
    const result = dispatchThroughStore(state, Actions.gameStateChanged({
      gameId: 1,
      data: create(Event_GameStateChangedSchema, {
        gameStarted: true,
        activePlayerId: 3,
        activePhase: 2,
        secondsElapsed: 60,
      }),
    }));

    expect(result.games[1].started).toBe(true);
    expect(result.games[1].activePlayerId).toBe(3);
    expect(result.games[1].activePhase).toBe(2);
    expect(result.games[1].secondsElapsed).toBe(60);
  });

  it('PLAYER_JOINED → adds new empty PlayerEntry keyed by playerId', () => {
    const state = makeState();
    const props = makePlayerProperties({ playerId: 5 });
    const result = dispatchThroughStore(state, Actions.playerJoined({ gameId: 1, playerProperties: props }));
    const newPlayer = result.games[1].players[5];
    expect(newPlayer).toBeDefined();
    expect(newPlayer.properties).toBe(props);
    expect(newPlayer.zones).toEqual({});
    expect(newPlayer.counters).toEqual({});
    expect(newPlayer.arrows).toEqual({});
  });

  it('PLAYER_JOINED → appends the new id to seatOrder (join order)', () => {
    // makeState seats player 1 in game 1.
    const state = makeState();
    const result = dispatchThroughStore(
      state,
      Actions.playerJoined({ gameId: 1, playerProperties: makePlayerProperties({ playerId: 5 }) }),
    );
    expect(result.games[1].seatOrder).toEqual([1, 5]);
  });

  it('PLAYER_JOINED → a re-join moves the id to the end of seatOrder (no duplicate)', () => {
    const state = makeState();
    state.games[1].seatOrder = [1, 5];
    const result = dispatchThroughStore(
      state,
      Actions.playerJoined({ gameId: 1, playerProperties: makePlayerProperties({ playerId: 1 }) }),
    );
    expect(result.games[1].seatOrder).toEqual([5, 1]);
  });

  it('PLAYER_LEFT → removes player from game.players and seatOrder', () => {
    const state = makeState();
    const result = dispatchThroughStore(
      state,
      Actions.playerLeft({ gameId: 1, playerId: 1, reason: 3, timeReceived: 1000 }),
    );
    expect(result.games[1].players[1]).toBeUndefined();
    expect(result.games[1].seatOrder).toEqual([]);
  });

  it('PLAYER_LEFT → emits a GameMessage with the formatted reason string', () => {
    const state = makeState();
    state.games[1].players[1].properties = makePlayerProperties({
      playerId: 1,
      userInfo: { name: 'Alice' },
    });
    const before = state.games[1].messages.length;

    const result = dispatchThroughStore(
      state,
      Actions.playerLeft({ gameId: 1, playerId: 1, reason: 2, timeReceived: 1234 }),
    );

    const msgs = result.games[1].messages;
    expect(msgs.length).toBe(before + 1);
    const added = msgs[msgs.length - 1];
    expect(added.playerId).toBe(1);
    // The listener stamps via `eventTimestamp()` (matching every other
    // event-log entry); the payload's `timeReceived` is informational only.
    expect(added.timeReceived).toEqual(expect.any(Number));
    expect(added.message).toBe('Alice has left the game (kicked by game host or moderator).');
  });

  it.each([
    [1, 'reason unknown'],
    [2, 'kicked by game host or moderator'],
    [3, 'player left the game'],
    [4, 'player disconnected from server'],
  ])('PLAYER_LEFT reason=%i → log text includes "%s"', (reason, fragment) => {
    const state = makeState();
    const result = dispatchThroughStore(
      state,
      Actions.playerLeft({ gameId: 1, playerId: 1, reason, timeReceived: 0 }),
    );
    const last = result.games[1].messages[result.games[1].messages.length - 1];
    expect(last.message).toContain(fragment);
  });

  it('PLAYER_PROPERTIES_CHANGED → merges set fields onto existing player properties', () => {
    const state = makeState();
    const newProps = makePlayerProperties({ playerId: 1, conceded: true });
    const result = dispatchThroughStore(state, Actions.playerPropertiesChanged({
      gameId: 1,
      playerId: 1,
      properties: newProps,
    }));
    expect(result.games[1].players[1].properties.conceded).toBe(true);
    expect(result.games[1].players[1].properties.playerId).toBe(1);
  });

  it('PLAYER_PROPERTIES_CHANGED → partial update (only pingSeconds) preserves deckHash', () => {
    // Regression: the desktop server's per-second ping tick sends
    // Event_PlayerPropertiesChanged with only ping_seconds set. A naive
    // overwrite would wipe deck_hash and disable the Ready button in the
    // deck-select dialog mid-lobby.
    const existing = makePlayerProperties({
      playerId: 1,
      deckHash: 'abc123',
      readyStart: false,
      sideboardLocked: true,
    });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: { 1: makePlayerEntry({ properties: existing }) },
        }),
      },
    });
    const pingOnly = create(ServerInfo_PlayerPropertiesSchema, { pingSeconds: 42 });
    const result = dispatchThroughStore(state, Actions.playerPropertiesChanged({
      gameId: 1,
      playerId: 1,
      properties: pingOnly,
    }));
    const merged = result.games[1].players[1].properties;
    expect(merged.pingSeconds).toBe(42);
    expect(merged.deckHash).toBe('abc123');
    expect(merged.readyStart).toBe(false);
    expect(merged.sideboardLocked).toBe(true);
  });

  it('PLAYER_PROPERTIES_CHANGED → partial update (only readyStart) preserves deckHash', () => {
    // Regression: cmdReadyStart server-side sends only ready_start set.
    // The client must not lose the deck hash when the user clicks Ready.
    const existing = makePlayerProperties({ playerId: 1, deckHash: 'abc123', readyStart: false });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: { 1: makePlayerEntry({ properties: existing }) },
        }),
      },
    });
    const readyOnly = create(ServerInfo_PlayerPropertiesSchema, { readyStart: true });
    const result = dispatchThroughStore(state, Actions.playerPropertiesChanged({
      gameId: 1,
      playerId: 1,
      properties: readyOnly,
    }));
    const merged = result.games[1].players[1].properties;
    expect(merged.readyStart).toBe(true);
    expect(merged.deckHash).toBe('abc123');
  });
});


describe('2C: CARD_MOVED', () => {
  function stateWithCard(cardOverrides: Parameters<typeof makeCard>[0] = {}) {
    const card = makeCard({ id: 10, ...cardOverrides });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                hand: makeZoneEntry({ name: 'hand', cards: [card], cardCount: 1 }),
                table: makeZoneEntry({ name: 'table', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });
    return { state, card };
  }

  it('moves card by cardId ≥ 0 from source to target zone', () => {
    const { state } = stateWithCard();
    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10,
        cardName: '',
        startPlayerId: 1,
        startZone: 'hand',
        position: -1,
        targetPlayerId: 1,
        targetZone: 'table',
        x: 5,
        y: 7,
        newCardId: -1,
        faceDown: false,
        newCardProviderId: '',
      },
    }));

    expect(cardsIn(result, 1, 1, 'hand')).toHaveLength(0);
    expect(result.games[1].players[1].zones['hand'].cardCount).toBe(0);
    const movedCard = cardsIn(result, 1, 1, 'table')[0];
    expect(movedCard.id).toBe(10);
    expect(movedCard.x).toBe(5);
    expect(movedCard.y).toBe(7);
    expect(result.games[1].players[1].zones['table'].cardCount).toBe(1);
  });

  it('prunes the open library snapshot (revealedCards) when a card moves out of the deck', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 3 }),
                hand: makeZoneEntry({ name: 'hand', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });
    state.games[1].players[1].zones['deck'].revealedCards = [
      makeCard({ id: 0, name: 'Forest' }),
      makeCard({ id: 1, name: 'Island' }),
      makeCard({ id: 2, name: 'Mountain' }),
    ];

    // Server reports the moved card's index via `position` for a HiddenZone source.
    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 100,
        cardName: 'Island',
        startPlayerId: 1,
        startZone: 'deck',
        position: 1,
        targetPlayerId: 1,
        targetZone: 'hand',
        x: 0,
        y: 0,
        newCardId: -1,
        faceDown: false,
        newCardProviderId: '',
      },
    }));

    const revealed = result.games[1].players[1].zones['deck'].revealedCards!;
    expect(revealed.map((c) => c.name)).toEqual(['Forest', 'Mountain']);
    expect(revealed.map((c) => c.id)).toEqual([0, 1]);
  });

  it('reorders the library snapshot (does not prune) on a same-zone deck move', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: { deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 3 }) },
            }),
          },
        }),
      },
    });
    state.games[1].players[1].zones['deck'].revealedCards = [
      makeCard({ id: 0, name: 'Forest' }),
      makeCard({ id: 1, name: 'Island' }),
      makeCard({ id: 2, name: 'Mountain' }),
    ];

    // Same-zone (move-out=false) deck move with a resolvable card: routes to a
    // snapshot reorder (position=from, x=to), never a prune. Empty target_zone
    // mirrors the wire (server omits it when start === target).
    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 2, cardName: 'Mountain', startPlayerId: 1, startZone: 'deck', position: 2,
        targetPlayerId: 1, targetZone: '', x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const revealed = result.games[1].players[1].zones['deck'].revealedCards!;
    // Mountain moved to front; nothing pruned (length stays 3); ids re-indexed.
    expect(revealed.map((c) => c.name)).toEqual(['Mountain', 'Forest', 'Island']);
    expect(revealed.map((c) => c.id)).toEqual([0, 1, 2]);
  });

  it('reorders a graveyard card to the dropped index (not appended to the end)', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                grave: makeZoneEntry({
                  name: 'grave',
                  cards: [makeCard({ id: 10 }), makeCard({ id: 11 }), makeCard({ id: 12 })],
                  cardCount: 3,
                }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 12, cardName: '', startPlayerId: 1, startZone: 'grave', position: 2,
        targetPlayerId: 1, targetZone: '', x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    // id 12 reordered to the front, not pushed to the end by the cross-zone path.
    expect(result.games[1].players[1].zones['grave'].order).toEqual([12, 10, 11]);
  });

  it('moves card by position index when cardId < 0', () => {
    const card = makeCard({ id: 11 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [card], cardCount: 1 }),
                hand: makeZoneEntry({ name: 'hand', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: -1,
        cardName: '',
        startPlayerId: 1,
        startZone: 'deck',
        position: 0,
        targetPlayerId: 1,
        targetZone: 'hand',
        x: 0,
        y: 0,
        newCardId: -1,
        faceDown: false,
        newCardProviderId: '',
      },
    }));

    expect(cardsIn(result, 1, 1, 'deck')).toHaveLength(0);
    expect(cardsIn(result, 1, 1, 'hand')[0].id).toBe(11);
  });

  it('hidden-zone move: cardId < 0, position out of range → decrements source cardCount, builds empty card in target', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 5 }),
                hand: makeZoneEntry({ name: 'hand', cards: [], cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: -1,
        cardName: 'Hidden',
        startPlayerId: 1,
        startZone: 'deck',
        position: 99,
        targetPlayerId: 1,
        targetZone: 'hand',
        x: 0,
        y: 0,
        newCardId: 7,
        faceDown: true,
        newCardProviderId: 'prov',
      },
    }));

    expect(result.games[1].players[1].zones['deck'].cardCount).toBe(4);
    const movedCard = cardsIn(result, 1, 1, 'hand')[0];
    expect(movedCard.id).toBe(7);
    expect(movedCard.name).toBe('Hidden');
    expect(movedCard.faceDown).toBe(true);
  });

  it('cross-player move: card leaves source player zone and enters target player zone', () => {
    const card = makeCard({ id: 20 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                hand: makeZoneEntry({ name: 'hand', cards: [card], cardCount: 1 }),
              },
            }),
            2: makePlayerEntry({
              properties: makePlayerProperties({ playerId: 2 }),
              zones: {
                hand: makeZoneEntry({ name: 'hand', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 20,
        cardName: '',
        startPlayerId: 1,
        startZone: 'hand',
        position: -1,
        targetPlayerId: 2,
        targetZone: 'hand',
        x: 0,
        y: 0,
        newCardId: -1,
        faceDown: false,
        newCardProviderId: '',
      },
    }));

    expect(cardsIn(result, 1, 1, 'hand')).toHaveLength(0);
    expect(cardsIn(result, 1, 2, 'hand')[0].id).toBe(20);
  });

  it('assigns newCardId when newCardId ≥ 0', () => {
    const { state } = stateWithCard();
    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10,
        cardName: '',
        startPlayerId: 1,
        startZone: 'hand',
        position: -1,
        targetPlayerId: 1,
        targetZone: 'table',
        x: 0,
        y: 0,
        newCardId: 999,
        faceDown: false,
        newCardProviderId: '',
      },
    }));

    expect(cardsIn(result, 1, 1, 'table')[0].id).toBe(999);
  });

  it('applies newCardProviderId and cardName to moved card', () => {
    const { state } = stateWithCard({ name: 'Old Name', providerId: 'old-prov' });
    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10,
        cardName: 'New Name',
        startPlayerId: 1,
        startZone: 'hand',
        position: -1,
        targetPlayerId: 1,
        targetZone: 'table',
        x: 0,
        y: 0,
        newCardId: -1,
        faceDown: false,
        newCardProviderId: 'new-prov',
      },
    }));

    const moved = cardsIn(result, 1, 1, 'table')[0];
    expect(moved.name).toBe('New Name');
    expect(moved.providerId).toBe('new-prov');
  });

  it('CARD_MOVED → no-ops when targetZone does not exist on player', () => {
    const { state } = stateWithCard();
    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10,
        cardName: '',
        startPlayerId: 1,
        startZone: 'hand',
        position: -1,
        targetPlayerId: 1,
        targetZone: 'nonexistent',
        x: 0,
        y: 0,
        newCardId: -1,
        faceDown: false,
        newCardProviderId: '',
      },
    }));
    expect(cardsIn(result, 1, 1, 'hand')).toHaveLength(1);
    expect(result.games[1].players[1].zones['nonexistent']).toBeUndefined();
  });

  it('CARD_MOVED → shifts hidden zone counts when a hidden card moves cross-zone', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 5 }),
                hand: makeZoneEntry({ name: 'hand', cards: [], cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    // A hidden card (cardId -1, position unresolvable, newCardId -1) still moves
    // between zones — e.g. an opponent's hand→library return during a mulligan. We
    // can't identify it, so cardCount shifts on both ends and order stays empty.
    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: -1, cardName: '', startPlayerId: 1, startZone: 'deck',
        position: -1, targetPlayerId: 1, targetZone: 'hand',
        x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    expect(result.games[1].players[1].zones['deck'].cardCount).toBe(4);
    expect(result.games[1].players[1].zones['hand'].cardCount).toBe(1);
    expect(cardsIn(result, 1, 1, 'hand')).toHaveLength(0);
  });

  it('CARD_MOVED → deep-clones counterList so moved card is independent', () => {
    const cardCounter = create(ServerInfo_CardCounterSchema, { id: 1, value: 3 });
    const card = makeCard({ id: 10, counterList: [cardCounter] });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                hand: makeZoneEntry({ name: 'hand', cards: [card], cardCount: 1 }),
                table: makeZoneEntry({ name: 'table', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'hand',
        position: -1, targetPlayerId: 1, targetZone: 'table',
        x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const movedCard = cardsIn(result, 1, 1, 'table')[0];
    expect(movedCard.counterList).toHaveLength(1);
    expect(movedCard.counterList).not.toBe(card.counterList);
  });

  it('CARD_MOVED table → grave: counters are cleared (Cockatrice resetState parity)', () => {
    const cardCounter = create(ServerInfo_CardCounterSchema, { id: 1, value: 3 });
    const card = makeCard({ id: 10, counterList: [cardCounter] });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
                grave: makeZoneEntry({ name: 'grave', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
        position: -1, targetPlayerId: 1, targetZone: 'grave',
        x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const movedCard = cardsIn(result, 1, 1, 'grave')[0];
    expect(movedCard.counterList).toEqual([]);
  });

  it('CARD_MOVED intra-table reorder preserves counters', () => {
    const cardCounter = create(ServerInfo_CardCounterSchema, { id: 1, value: 3 });
    const card = makeCard({ id: 10, counterList: [cardCounter] });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
        position: -1, targetPlayerId: 1, targetZone: 'table',
        x: 4, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const movedCard = cardsIn(result, 1, 1, 'table')[0];
    expect(movedCard.counterList).toHaveLength(1);
    expect(movedCard.counterList[0].value).toBe(3);
  });

  it('CARD_MOVED table → grave: battlefield-only state is cleared (Cockatrice resetState parity)', () => {
    const cardCounter = create(ServerInfo_CardCounterSchema, { id: 1, value: 3 });
    const card = makeCard({
      id: 10,
      tapped: true,
      attacking: true,
      doesntUntap: true,
      pt: '5/5',
      color: 'r',
      annotation: 'note',
      counterList: [cardCounter],
    });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
                grave: makeZoneEntry({ name: 'grave', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
        position: -1, targetPlayerId: 1, targetZone: 'grave',
        x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const movedCard = cardsIn(result, 1, 1, 'grave')[0];
    expect(movedCard.tapped).toBe(false);
    expect(movedCard.attacking).toBe(false);
    expect(movedCard.doesntUntap).toBe(false);
    expect(movedCard.pt).toBe('');
    expect(movedCard.color).toBe('');
    expect(movedCard.annotation).toBe('');
    expect(movedCard.counterList).toEqual([]);
  });

  it('CARD_MOVED intra-table reorder preserves tapped (reset is gated on leaving the battlefield)', () => {
    const card = makeCard({ id: 10, tapped: true, doesntUntap: true });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
        position: -1, targetPlayerId: 1, targetZone: 'table',
        x: 4, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const movedCard = cardsIn(result, 1, 1, 'table')[0];
    expect(movedCard.tapped).toBe(true);
    expect(movedCard.doesntUntap).toBe(true);
  });

  it('intra-zone TABLE move: card stays in the zone with updated x/y', () => {
    const card = makeCard({ id: 10, x: 0, y: 0, name: 'InPlace' });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
        position: -1, targetPlayerId: 1, targetZone: 'table',
        x: 3, y: 1, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const tableCards = cardsIn(result, 1, 1, 'table');
    expect(tableCards).toHaveLength(1);
    expect(tableCards[0].id).toBe(10);
    expect(tableCards[0].x).toBe(3);
    expect(tableCards[0].y).toBe(1);
    expect(tableCards[0].name).toBe('InPlace');
    expect(result.games[1].players[1].zones['table'].cardCount).toBe(1);
  });

  it('intra-zone TABLE move produces a new zone reference so selector caches invalidate', () => {
    const card = makeCard({ id: 10, x: 0, y: 0 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });
    const originalZone = state.games[1].players[1].zones['table'];

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
        position: -1, targetPlayerId: 1, targetZone: 'table',
        x: 3, y: 1, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const nextZone = result.games[1].players[1].zones['table'];
    expect(nextZone).not.toBe(originalZone);
    expect(nextZone.byId[10]).not.toBe(originalZone.byId[10]);
  });

  it('intra-zone TABLE move with an omitted targetZone defaults to startZone', () => {
    // Protobuf strips target_zone from the wire when it equals start_zone
    // (default empty string). Desktop falls back to start_zone; this reducer
    // must too, otherwise `zones[undefined]` misses and the move silently no-ops.
    const card = makeCard({ id: 15, x: 0, y: 0, name: 'A Good Day to Pie' });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 15, cardName: '', startPlayerId: 1, startZone: 'table',
        // targetZone is stripped on the wire when source and target zones match.
        position: -1, targetPlayerId: 1, targetZone: '',
        x: 18, y: 1, newCardId: 15, faceDown: false, newCardProviderId: '',
      },
    }));

    const tableCards = cardsIn(result, 1, 1, 'table');
    expect(tableCards).toHaveLength(1);
    expect(tableCards[0].x).toBe(18);
    expect(tableCards[0].y).toBe(1);
  });

  it('intra-zone TABLE move with two cards: moved card updates, other card untouched', () => {
    const movingCard = makeCard({ id: 10, x: 0, y: 0, name: 'Mover' });
    const stillCard = makeCard({ id: 11, x: 3, y: 0, name: 'Still' });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({
                  name: 'table',
                  cards: [movingCard, stillCard],
                  cardCount: 2,
                }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
        position: -1, targetPlayerId: 1, targetZone: 'table',
        x: 6, y: 2, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const tableCards = cardsIn(result, 1, 1, 'table').sort((a, b) => a.id - b.id);
    expect(tableCards).toHaveLength(2);
    const [c10, c11] = tableCards;
    expect(c10.id).toBe(10);
    expect(c10.x).toBe(6);
    expect(c10.y).toBe(2);
    expect(c11.id).toBe(11);
    expect(c11.x).toBe(3);
    expect(c11.y).toBe(0);
    expect(result.games[1].players[1].zones['table'].cardCount).toBe(2);
  });

  describe('cross-player TABLE→TABLE move with attachments', () => {
    // Servatrice's unattach-children loop only fires when the zone *names*
    // differ (server_abstract_player.cpp:376), so a cross-player table→table
    // move (e.g. taking control of an opponent's permanent) leaves no
    // unattach events on the wire. The desktop survives this via Qt
    // pointer-linkage that reparents children's QGraphicsItems into the new
    // zone (card_zone.cpp:19 onCardAdded). Our wire-data-driven model has to
    // rewrite the children's `(attachPlayerId, attachCardId)` pointers
    // explicitly in the cardMoved reducer.
    function stateWithParentAndChildren() {
      const parent = makeCard({ id: 10, name: 'Creature', x: 0, y: 0 });
      const auraA = makeCard({
        id: 11, name: 'AuraA', x: 1, y: 0,
        attachPlayerId: 1, attachZone: 'table', attachCardId: 10,
      });
      const auraB = makeCard({
        id: 12, name: 'AuraB', x: 2, y: 0,
        attachPlayerId: 1, attachZone: 'table', attachCardId: 10,
      });
      return makeState({
        games: {
          1: makeGameEntry({
            localPlayerId: 1,
            players: {
              1: makePlayerEntry({
                zones: {
                  table: makeZoneEntry({
                    name: 'table',
                    cards: [parent, auraA, auraB],
                    cardCount: 3,
                  }),
                },
              }),
              2: makePlayerEntry({
                zones: {
                  table: makeZoneEntry({ name: 'table', cards: [], cardCount: 0 }),
                },
              }),
            },
          }),
        },
      });
    }

    it('rewrites children attach pointers to (newOwner, newId) when parent moves cross-player', () => {
      const state = stateWithParentAndChildren();
      // Servatrice reassigns the parent's id on cross-player move
      // (server_abstract_player.cpp:447-450). The wire carries cardId=old,
      // newCardId=new.
      const result = dispatchCardMoved(state, Actions.cardMoved({
        gameId: 1,
        playerId: 1,
        data: {
          cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
          position: -1, targetPlayerId: 2, targetZone: 'table',
          x: 0, y: 0, newCardId: 99, faceDown: false, newCardProviderId: '',
        },
      }));

      // Parent now lives in player 2's table at id 99.
      const p2Table = cardsIn(result, 1, 2, 'table');
      expect(p2Table.find((c) => c.id === 99)?.name).toBe('Creature');

      // Auras still live in player 1's table (Servatrice never moves them).
      const p1Table = cardsIn(result, 1, 1, 'table').sort((a, b) => a.id - b.id);
      const auraA = p1Table.find((c) => c.id === 11)!;
      const auraB = p1Table.find((c) => c.id === 12)!;
      // Their parent pointers now follow the parent into player 2's zone.
      expect(auraA.attachPlayerId).toBe(2);
      expect(auraA.attachCardId).toBe(99);
      expect(auraA.attachZone).toBe('table');
      expect(auraB.attachPlayerId).toBe(2);
      expect(auraB.attachCardId).toBe(99);
      expect(auraB.attachZone).toBe('table');
    });

    it('intra-table same-player move leaves children pointers as-is (no-op rewrite)', () => {
      const state = stateWithParentAndChildren();
      const result = dispatchCardMoved(state, Actions.cardMoved({
        gameId: 1,
        playerId: 1,
        data: {
          cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
          position: -1, targetPlayerId: 1, targetZone: 'table',
          x: 5, y: 1, newCardId: -1, faceDown: false, newCardProviderId: '',
        },
      }));

      const p1Table = cardsIn(result, 1, 1, 'table');
      const auraA = p1Table.find((c) => c.id === 11)!;
      const auraB = p1Table.find((c) => c.id === 12)!;
      expect(auraA.attachPlayerId).toBe(1);
      expect(auraA.attachCardId).toBe(10);
      expect(auraB.attachPlayerId).toBe(1);
      expect(auraB.attachCardId).toBe(10);
    });

    it('table → hand leaves children pointers untouched (Servatrice will send pre-move unattach events)', () => {
      // Cross-zone-NAME moves trigger Servatrice's unattach loop
      // (server_abstract_player.cpp:376-387). The cardAttached reducer clears
      // the children's pointers when those events arrive. The cardMoved
      // reducer must NOT preempt that path — otherwise we'd silently rewrite
      // pointers that the unattach event will then clear, churning state.
      const state = makeState({
        games: {
          1: makeGameEntry({
            localPlayerId: 1,
            players: {
              1: makePlayerEntry({
                zones: {
                  table: makeZoneEntry({
                    name: 'table',
                    cards: [
                      makeCard({ id: 10, name: 'Creature', x: 0, y: 0 }),
                      makeCard({
                        id: 11, name: 'Aura', x: 1, y: 0,
                        attachPlayerId: 1, attachZone: 'table', attachCardId: 10,
                      }),
                    ],
                    cardCount: 2,
                  }),
                  hand: makeZoneEntry({ name: 'hand', cards: [], cardCount: 0 }),
                },
              }),
            },
          }),
        },
      });

      const result = dispatchCardMoved(state, Actions.cardMoved({
        gameId: 1,
        playerId: 1,
        data: {
          cardId: 10, cardName: '', startPlayerId: 1, startZone: 'table',
          position: -1, targetPlayerId: 1, targetZone: 'hand',
          x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
        },
      }));

      const aura = cardsIn(result, 1, 1, 'table').find((c) => c.id === 11)!;
      // Pointers stay as-is — Servatrice's pre-move unattach event is what
      // clears them, and that arrives as a separate cardAttached dispatch.
      expect(aura.attachPlayerId).toBe(1);
      expect(aura.attachCardId).toBe(10);
    });
  });
});


describe('2D: Card mutations', () => {
  function stateWithCardInZone(zoneName: string) {
    const card = makeCard({ id: 5, name: 'Old', providerId: 'old', faceDown: false });
    return {
      card,
      state: makeState({
        games: {
          1: makeGameEntry({
            players: {
              1: makePlayerEntry({
                zones: {
                  [zoneName]: makeZoneEntry({ name: zoneName, cards: [card], cardCount: 1 }),
                },
              }),
            },
          }),
        },
      }),
    };
  }

  it('CARD_FLIPPED → updates faceDown, name, and providerId', () => {
    const { state } = stateWithCardInZone('hand');
    const result = dispatchThroughStore(state, Actions.cardFlipped({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'hand', cardId: 5, cardName: 'Revealed', faceDown: true, cardProviderId: 'new-prov' },
    }));

    const card = cardsIn(result, 1, 1, 'hand')[0];
    expect(card.faceDown).toBe(true);
    expect(card.name).toBe('Revealed');
    expect(card.providerId).toBe('new-prov');
  });

  it('CARD_DESTROYED → removes card from zone and decrements cardCount', () => {
    const { state } = stateWithCardInZone('hand');
    const result = dispatchThroughStore(state, Actions.cardDestroyed({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'hand', cardId: 5 },
    }));

    expect(cardsIn(result, 1, 1, 'hand')).toHaveLength(0);
    expect(result.games[1].players[1].zones['hand'].cardCount).toBe(0);
  });

  it('CARD_ATTACHED → sets attachPlayerId, attachZone, attachCardId on matched card', () => {
    const { state } = stateWithCardInZone('table');
    const result = dispatchThroughStore(state, Actions.cardAttached({
      gameId: 1,
      playerId: 1,
      data: { startZone: 'table', cardId: 5, targetPlayerId: 2, targetZone: 'table', targetCardId: 99 },
    }));

    const card = cardsIn(result, 1, 1, 'table')[0];
    expect(card.attachPlayerId).toBe(2);
    expect(card.attachZone).toBe('table');
    expect(card.attachCardId).toBe(99);
  });

  it('CARD_ATTACHED with empty target (proto3 unset target_* fields) → resets to -1 / "" / -1 (unattach)', () => {
    // Server sends Event_AttachCard with no target fields when actUnattach
    // is invoked; proto3 surfaces unset numerics as 0 and strings as ''. The
    // reducer must explicitly map that back to -1 so isAttachedChild treats
    // the card as detached and it reappears in its lane.
    const { state } = stateWithCardInZone('table');
    // First attach the card so it has positive target ids to clear.
    const attached = dispatchThroughStore(state, Actions.cardAttached({
      gameId: 1,
      playerId: 1,
      data: { startZone: 'table', cardId: 5, targetPlayerId: 2, targetZone: 'table', targetCardId: 99 },
    }));
    expect(cardsIn(attached, 1, 1, 'table')[0].attachCardId).toBe(99);

    // Now unattach (proto3-style unset target fields).
    const unattached = dispatchThroughStore(attached, Actions.cardAttached({
      gameId: 1,
      playerId: 1,
      data: { startZone: 'table', cardId: 5, targetPlayerId: 0, targetZone: '', targetCardId: 0 },
    }));
    const card = cardsIn(unattached, 1, 1, 'table')[0];
    expect(card.attachPlayerId).toBe(-1);
    expect(card.attachZone).toBe('');
    expect(card.attachCardId).toBe(-1);
  });

  it('full unattach event sequence (CARD_ATTACHED no-target → CARD_MOVED) leaves the card free at the new slot', () => {
    // Servatrice's `unattachCard` enqueues two events in a fixed order:
    //   1. Event_AttachCard with no target (clears parent pointer).
    //   2. Event_MoveCard to a free slot via `moveCard(zone, -1, y)`.
    // The webclient's reducers must compose: the attach event clears the
    // parent fields to -1/''/-1, the subsequent move keeps them cleared and
    // updates x/y. Pinning the order here so a later "clear attach fields
    // in cardMoved" change can't silently re-detach a still-attached card.
    const { state } = stateWithCardInZone('table');
    const attached = dispatchThroughStore(state, Actions.cardAttached({
      gameId: 1,
      playerId: 1,
      data: { startZone: 'table', cardId: 5, targetPlayerId: 2, targetZone: 'table', targetCardId: 99 },
    }));

    const detached = dispatchThroughStore(attached, Actions.cardAttached({
      gameId: 1,
      playerId: 1,
      data: { startZone: 'table', cardId: 5, targetPlayerId: 0, targetZone: '', targetCardId: 0 },
    }));

    const moved = dispatchCardMoved(detached, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 5, cardName: '', startPlayerId: 1, startZone: 'table', position: -1,
        targetPlayerId: 1, targetZone: 'table', x: 4, y: 1,
        newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const final = cardsIn(moved, 1, 1, 'table')[0];
    expect(final.attachPlayerId).toBe(-1);
    expect(final.attachZone).toBe('');
    expect(final.attachCardId).toBe(-1);
    expect(final.x).toBe(4);
    expect(final.y).toBe(1);
  });

  it('CARD_MOVED on an attached card preserves attach fields (Servatrice never moves a still-attached card client-bound)', () => {
    // Pin the inverse direction: the cardMoved reducer must NOT clear attach
    // fields on its own. The protocol always emits an explicit
    // Event_AttachCard before any move that detaches; if cardMoved cleared
    // attach fields unconditionally, an unrelated server-initiated reposition
    // of a still-attached card (e.g. desktop's `setCoords(-1, y)` on the
    // parent's stack column shuffle) would silently detach it.
    const { state } = stateWithCardInZone('table');
    const attached = dispatchThroughStore(state, Actions.cardAttached({
      gameId: 1,
      playerId: 1,
      data: { startZone: 'table', cardId: 5, targetPlayerId: 1, targetZone: 'table', targetCardId: 99 },
    }));

    const moved = dispatchCardMoved(attached, Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 5, cardName: '', startPlayerId: 1, startZone: 'table', position: -1,
        targetPlayerId: 1, targetZone: 'table', x: 7, y: 0,
        newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));

    const card = cardsIn(moved, 1, 1, 'table')[0];
    expect(card.attachPlayerId).toBe(1);
    expect(card.attachZone).toBe('table');
    expect(card.attachCardId).toBe(99);
    expect(card.x).toBe(7);
  });

  it('TOKEN_CREATED → builds full CardInfo, appends to zone, increments cardCount', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [], cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchThroughStore(state, Actions.tokenCreated({
      gameId: 1,
      playerId: 1,
      data: {
        zoneName: 'table',
        cardId: 77,
        cardName: 'Goblin',
        color: 'red',
        pt: '1/1',
        annotation: '',
        destroyOnZoneChange: true,
        x: 3,
        y: 4,
        cardProviderId: 'prov',
        faceDown: false,
      },
    }));

    const zone = result.games[1].players[1].zones['table'];
    expect(zone.cardCount).toBe(1);
    const tableCards = cardsIn(result, 1, 1, 'table');
    expect(tableCards[0].id).toBe(77);
    expect(tableCards[0].name).toBe('Goblin');
    expect(tableCards[0].destroyOnZoneChange).toBe(true);
  });

  describe('zone reference invariant on per-card mutations', () => {
    function stateWithTableCards(cards: ReturnType<typeof makeCard>[]) {
      return makeState({
        games: {
          1: makeGameEntry({
            players: {
              1: makePlayerEntry({
                zones: {
                  table: makeZoneEntry({ name: 'table', cards }),
                },
              }),
            },
          }),
        },
      });
    }

    it('cardAttached produces a new zone reference', () => {
      const state = stateWithTableCards([makeCard({ id: 1 }), makeCard({ id: 2 })]);
      const before = state.games[1].players[1].zones['table'];
      const result = dispatchThroughStore(state, Actions.cardAttached({
        gameId: 1, playerId: 1,
        data: { startZone: 'table', cardId: 1, targetPlayerId: 1, targetZone: 'table', targetCardId: 2 },
      }));
      expect(result.games[1].players[1].zones['table']).not.toBe(before);
    });

    it('cardFlipped produces a new zone reference', () => {
      const state = stateWithTableCards([makeCard({ id: 1, faceDown: false })]);
      const before = state.games[1].players[1].zones['table'];
      const result = dispatchThroughStore(state, Actions.cardFlipped({
        gameId: 1, playerId: 1,
        data: { zoneName: 'table', cardId: 1, cardName: '', faceDown: true, cardProviderId: '' },
      }));
      expect(result.games[1].players[1].zones['table']).not.toBe(before);
    });

    it('cardAttrChanged produces a new zone reference', () => {
      const state = stateWithTableCards([makeCard({ id: 1, tapped: false })]);
      const before = state.games[1].players[1].zones['table'];
      const result = dispatchThroughStore(state, Actions.cardAttrChanged({
        gameId: 1, playerId: 1,
        data: { zoneName: 'table', cardId: 1, attribute: CardAttribute.AttrTapped, attrValue: '1' },
      }));
      expect(result.games[1].players[1].zones['table']).not.toBe(before);
    });

    it('cardCounterChanged produces a new zone reference', () => {
      const state = stateWithTableCards([makeCard({ id: 1 })]);
      const before = state.games[1].players[1].zones['table'];
      const result = dispatchThroughStore(state, Actions.cardCounterChanged({
        gameId: 1, playerId: 1,
        data: { zoneName: 'table', cardId: 1, counterId: 0, counterValue: 1 },
      }));
      expect(result.games[1].players[1].zones['table']).not.toBe(before);
    });
  });
});


describe('2E: CARD_ATTR_CHANGED', () => {
  function stateWithCard() {
    const card = makeCard({
      id: 3,
      tapped: false,
      attacking: false,
      faceDown: false,
      color: '',
      pt: '',
      annotation: '',
      doesntUntap: false,
    });
    return makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });
  }

  function dispatchAttr(state: ReturnType<typeof makeState>, attribute: CardAttribute, attrValue: string) {
    return dispatchThroughStore(state, Actions.cardAttrChanged({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'table', cardId: 3, attribute, attrValue },
    }));
  }

  it('AttrTapped (1) → card.tapped = true when attrValue is "1"', () => {
    const result = dispatchAttr(stateWithCard(), CardAttribute.AttrTapped, '1');
    expect(cardsIn(result, 1, 1, 'table')[0].tapped).toBe(true);
  });

  it('AttrAttacking (2) → card.attacking = true when attrValue is "1"', () => {
    const result = dispatchAttr(stateWithCard(), CardAttribute.AttrAttacking, '1');
    expect(cardsIn(result, 1, 1, 'table')[0].attacking).toBe(true);
  });

  it('AttrFaceDown (3) → card.faceDown = true when attrValue is "1"', () => {
    const result = dispatchAttr(stateWithCard(), CardAttribute.AttrFaceDown, '1');
    expect(cardsIn(result, 1, 1, 'table')[0].faceDown).toBe(true);
  });

  it('AttrColor (4) → card.color = attrValue', () => {
    const result = dispatchAttr(stateWithCard(), CardAttribute.AttrColor, 'red');
    expect(cardsIn(result, 1, 1, 'table')[0].color).toBe('red');
  });

  it('AttrPT (5) → card.pt = attrValue', () => {
    const result = dispatchAttr(stateWithCard(), CardAttribute.AttrPT, '2/3');
    expect(cardsIn(result, 1, 1, 'table')[0].pt).toBe('2/3');
  });

  it('AttrAnnotation (6) → card.annotation = attrValue', () => {
    const result = dispatchAttr(stateWithCard(), CardAttribute.AttrAnnotation, 'enchanted');
    expect(cardsIn(result, 1, 1, 'table')[0].annotation).toBe('enchanted');
  });

  it('AttrDoesntUntap (7) → card.doesntUntap = true when attrValue is "1"', () => {
    const result = dispatchAttr(stateWithCard(), CardAttribute.AttrDoesntUntap, '1');
    expect(cardsIn(result, 1, 1, 'table')[0].doesntUntap).toBe(true);
  });

  describe('bulk (card_id unset) — Cockatrice "untap all" wire format', () => {
    // Servatrice omits card_id from Event_SetCardAttr for bulk operations:
    //   if (cardId != -1) event.set_card_id(cardId);
    // The listener detects this via isFieldSet, NOT by checking cardId === -1
    // (bufbuild surfaces unset proto2 optionals as 0, never -1).

    function stateWithThreeTappedCards() {
      return makeState({
        games: {
          1: makeGameEntry({
            players: {
              1: makePlayerEntry({
                properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }),
                zones: {
                  table: makeZoneEntry({
                    name: 'table',
                    cards: [
                      makeCard({ id: 1, tapped: true }),
                      makeCard({ id: 2, tapped: true }),
                      makeCard({ id: 3, tapped: true }),
                    ],
                    cardCount: 3,
                  }),
                },
              }),
            },
          }),
        },
      });
    }

    function bulkEvent(attrValue: string) {
      return create(Event_SetCardAttrSchema, {
        zoneName: 'table',
        attribute: CardAttribute.AttrTapped,
        attrValue,
        // cardId intentionally omitted — matches the wire reality from Servatrice
      });
    }

    it('AttrTapped + "0" with cardId unset → untaps every card in the zone', () => {
      const result = dispatchThroughStore(stateWithThreeTappedCards(), Actions.cardAttrChanged({
        gameId: 1, playerId: 1,
        data: bulkEvent('0'),
      }));
      const cards = cardsIn(result, 1, 1, 'table');
      expect(cards.map(c => c.tapped)).toEqual([false, false, false]);
    });

    it('AttrTapped + "1" with cardId unset → taps every card in the zone', () => {
      const state = makeState({
        games: {
          1: makeGameEntry({
            players: {
              1: makePlayerEntry({
                properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }),
                zones: {
                  table: makeZoneEntry({
                    name: 'table',
                    cards: [makeCard({ id: 1, tapped: false }), makeCard({ id: 2, tapped: false })],
                    cardCount: 2,
                  }),
                },
              }),
            },
          }),
        },
      });
      const result = dispatchThroughStore(state, Actions.cardAttrChanged({
        gameId: 1, playerId: 1,
        data: bulkEvent('1'),
      }));
      expect(cardsIn(result, 1, 1, 'table').map(c => c.tapped)).toEqual([true, true]);
    });

    it('appends exactly one summary chat line ("untaps their permanents"), not one per card', () => {
      const result = dispatchThroughStore(stateWithThreeTappedCards(), Actions.cardAttrChanged({
        gameId: 1, playerId: 1,
        data: bulkEvent('0'),
      }));
      const messages = result.games[1].messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Alice untaps their permanents.');
    });

    it('is a no-op when the named zone does not exist on the player', () => {
      const event = create(Event_SetCardAttrSchema, {
        zoneName: 'bogus',
        attribute: CardAttribute.AttrTapped,
        attrValue: '0',
      });
      const result = dispatchThroughStore(stateWithThreeTappedCards(), Actions.cardAttrChanged({
        gameId: 1, playerId: 1,
        data: event,
      }));
      expect(cardsIn(result, 1, 1, 'table').map(c => c.tapped)).toEqual([true, true, true]);
      expect(result.games[1].messages).toHaveLength(0);
    });

    // Regression: a real card with id 0 must still be treated as a single-card update,
    // not as the bulk sentinel. (Servatrice card ids start at 0.)
    it('cardId=0 set explicitly is a single-card update, not bulk', () => {
      const state = makeState({
        games: {
          1: makeGameEntry({
            players: {
              1: makePlayerEntry({
                properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }),
                zones: {
                  table: makeZoneEntry({
                    name: 'table',
                    cards: [
                      makeCard({ id: 0, tapped: true, name: 'Bolt' }),
                      makeCard({ id: 1, tapped: true }),
                    ],
                    cardCount: 2,
                  }),
                },
              }),
            },
          }),
        },
      });
      const event = create(Event_SetCardAttrSchema, {
        zoneName: 'table',
        cardId: 0,
        attribute: CardAttribute.AttrTapped,
        attrValue: '0',
      });
      const result = dispatchThroughStore(state, Actions.cardAttrChanged({
        gameId: 1, playerId: 1, data: event,
      }));
      const cards = cardsIn(result, 1, 1, 'table');
      // Only card 0 should be untapped — card 1 stays tapped.
      expect(cards.map(c => c.tapped)).toEqual([false, true]);
      // Chat line is the single-card form, not the bulk form.
      expect(result.games[1].messages[0].message).toBe('Alice untaps Bolt.');
    });
  });
});


describe('2F: CARD_COUNTER_CHANGED', () => {
  function stateWithCard(existingCounters: any[] = []) {
    const card = makeCard({ id: 4, counterList: existingCounters });
    return makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [card], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });
  }

  it('adds new counter to counterList when counterId not present and counterValue > 0', () => {
    const state = stateWithCard([]);
    const result = dispatchThroughStore(state, Actions.cardCounterChanged({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'table', cardId: 4, counterId: 1, counterValue: 3 },
    }));
    expect(cardsIn(result, 1, 1, 'table')[0].counterList).toEqual([expect.objectContaining({ id: 1, value: 3 })]);
  });

  it('updates existing counter value when counterId matches', () => {
    const state = stateWithCard([{ id: 1, value: 3 }]);
    const result = dispatchThroughStore(state, Actions.cardCounterChanged({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'table', cardId: 4, counterId: 1, counterValue: 7 },
    }));
    expect(cardsIn(result, 1, 1, 'table')[0].counterList).toEqual([expect.objectContaining({ id: 1, value: 7 })]);
  });

  it('removes counter from counterList when counterValue ≤ 0', () => {
    const state = stateWithCard([{ id: 1, value: 3 }]);
    const result = dispatchThroughStore(state, Actions.cardCounterChanged({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'table', cardId: 4, counterId: 1, counterValue: 0 },
    }));
    expect(cardsIn(result, 1, 1, 'table')[0].counterList).toEqual([]);
  });
});


describe('2G: Arrows', () => {
  it('ARROW_CREATED → inserts arrowInfo into player.arrows keyed by id', () => {
    const state = makeState();
    const arrow = makeArrow({ id: 9 });
    const result = dispatchThroughStore(state, Actions.arrowCreated({
      gameId: 1,
      playerId: 1,
      data: { arrowInfo: arrow },
    }));
    expect(result.games[1].players[1].arrows[9]).toEqual(arrow);
  });

  it('ARROW_DELETED → removes arrow from player.arrows by arrowId', () => {
    const arrow = makeArrow({ id: 9 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({ arrows: { 9: arrow } }),
          },
        }),
      },
    });
    const result = gamesReducer(state, Actions.arrowDeleted({
      gameId: 1,
      playerId: 1,
      data: { arrowId: 9 },
    }));
    expect(result.games[1].players[1].arrows[9]).toBeUndefined();
  });
});


describe('2H: Player counters', () => {
  it('COUNTER_CREATED → inserts counterInfo into player.counters keyed by id', () => {
    const state = makeState();
    const counter = makeCounter({ id: 5, name: 'Poison' });
    const result = gamesReducer(state, Actions.counterCreated({
      gameId: 1,
      playerId: 1,
      data: { counterInfo: counter },
    }));
    expect(result.games[1].players[1].counters[5]).toEqual(counter);
  });

  it('COUNTER_CREATED → clones counterInfo to prevent shared references', () => {
    const state = makeState();
    const counter = makeCounter({ id: 5, name: 'Life', count: 20 });
    const result = gamesReducer(state, Actions.counterCreated({
      gameId: 1,
      playerId: 1,
      data: { counterInfo: counter },
    }));
    expect(result.games[1].players[1].counters[5]).not.toBe(counter);
  });

  it('COUNTER_SET → updates counter.count to new value', () => {
    const counter = makeCounter({ id: 5, count: 20 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({ counters: { 5: counter } }),
          },
        }),
      },
    });
    const result = dispatchThroughStore(state, Actions.counterSet({
      gameId: 1,
      playerId: 1,
      data: { counterId: 5, value: 14 },
    }));
    expect(result.games[1].players[1].counters[5].count).toBe(14);
  });

  it('COUNTER_DELETED → removes counter from player.counters by counterId', () => {
    const counter = makeCounter({ id: 5 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({ counters: { 5: counter } }),
          },
        }),
      },
    });
    const result = gamesReducer(state, Actions.counterDeleted({
      gameId: 1,
      playerId: 1,
      data: { counterId: 5 },
    }));
    expect(result.games[1].players[1].counters[5]).toBeUndefined();
  });
});


describe('2I: Zone operations', () => {
  it('CARDS_DRAWN → decrements deck.cardCount, appends cards to hand, increments hand.cardCount', () => {
    const drawnCard = makeCard({ id: 9 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cardCount: 40 }),
                hand: makeZoneEntry({ name: 'hand', cards: [], cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchThroughStore(state, Actions.cardsDrawn({
      gameId: 1,
      playerId: 1,
      data: { number: 2, cards: [drawnCard] },
    }));

    expect(result.games[1].players[1].zones['deck'].cardCount).toBe(38);
    expect(cardsIn(result, 1, 1, 'hand')).toContainEqual(drawnCard);
    expect(result.games[1].players[1].zones['hand'].cardCount).toBe(2);
  });

  it('CARDS_DRAWN → works when no deck zone exists (only updates hand)', () => {
    const drawnCard = makeCard({ id: 9 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                hand: makeZoneEntry({ name: 'hand', cards: [], cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = dispatchThroughStore(state, Actions.cardsDrawn({
      gameId: 1,
      playerId: 1,
      data: { number: 1, cards: [drawnCard] },
    }));

    expect(result.games[1].players[1].zones['hand'].cardCount).toBe(1);
    expect(cardsIn(result, 1, 1, 'hand')).toContainEqual(drawnCard);
  });

  it('CARDS_REVEALED (update path) → merges revealed cards into existing zone cards', () => {
    const existing = makeCard({ id: 2, name: 'Old Name' });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [existing], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });

    const result = gamesReducer(state, Actions.cardsRevealed({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'deck', cards: [{ ...existing, name: 'Revealed Name' }] },
    }));

    expect(cardsIn(result, 1, 1, 'deck')[0].name).toBe('Revealed Name');
    expect(cardsIn(result, 1, 1, 'deck')).toHaveLength(1);
  });

  it('CARDS_REVEALED (append path) → appends new cards whose ids are not already in the zone', () => {
    const existing = makeCard({ id: 1 });
    const newCard = makeCard({ id: 2 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [existing], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });

    const result = gamesReducer(state, Actions.cardsRevealed({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'deck', cards: [newCard] },
    }));

    expect(cardsIn(result, 1, 1, 'deck')).toHaveLength(2);
    expect(cardsIn(result, 1, 1, 'deck')[1]).toEqual(newCard);
  });

  it('CARDS_REVEALED → clones counterList to prevent shared references', () => {
    const cardCounter = create(ServerInfo_CardCounterSchema, { id: 1, value: 5 });
    const revealedCard = makeCard({ id: 3, counterList: [cardCounter] });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = gamesReducer(state, Actions.cardsRevealed({
      gameId: 1,
      playerId: 1,
      data: { zoneName: 'deck', cards: [revealedCard] },
    }));

    const stored = cardsIn(result, 1, 1, 'deck')[0];
    expect(stored.counterList).toEqual(revealedCard.counterList);
    expect(stored.counterList).not.toBe(revealedCard.counterList);
  });

  it('ZONE_VIEW_REVEALED → stores the dump card list on zone.revealedCards', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: { deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 3 }) },
            }),
          },
        }),
      },
    });

    const cards = [makeCard({ id: 0, name: 'Forest' }), makeCard({ id: 1, name: 'Island' })];
    const result = gamesReducer(state, Actions.zoneViewRevealed({
      gameId: 1, playerId: 1, zoneName: 'deck', cards,
    }));

    expect(result.games[1].players[1].zones['deck'].revealedCards).toBe(cards);
  });

  it('ZONE_VIEW_CLEARED → removes zone.revealedCards', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: { deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 3 }) },
            }),
          },
        }),
      },
    });
    state.games[1].players[1].zones['deck'].revealedCards = [makeCard({ id: 0 })];

    const result = gamesReducer(state, Actions.zoneViewCleared({ gameId: 1, playerId: 1, zoneName: 'deck' }));

    expect(result.games[1].players[1].zones['deck'].revealedCards).toBeUndefined();
  });

  it('ZONE_VIEW_REVEALED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.zoneViewRevealed({
      gameId: 1, playerId: 1, zoneName: 'nonexistent', cards: [],
    }))).toBe(state);
  });

  function deckViewState(revealed: ReturnType<typeof makeCard>[]) {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: { deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: revealed.length }) },
            }),
          },
        }),
      },
    });
    state.games[1].players[1].zones['deck'].revealedCards = revealed;
    return state;
  }

  it('ZONE_VIEW_CARD_REMOVED → drops the card at position and re-indexes survivors', () => {
    const state = deckViewState([
      makeCard({ id: 0, name: 'Forest' }),
      makeCard({ id: 1, name: 'Island' }),
      makeCard({ id: 2, name: 'Mountain' }),
      makeCard({ id: 3, name: 'Plains' }),
    ]);

    const result = gamesReducer(state, Actions.zoneViewCardRemoved({
      gameId: 1, playerId: 1, zoneName: 'deck', position: 1,
    }));

    const revealed = result.games[1].players[1].zones['deck'].revealedCards!;
    // Island (pos 1) removed; remaining cards re-indexed to 0..n-1, names preserved.
    expect(revealed.map((c) => c.id)).toEqual([0, 1, 2]);
    expect(revealed.map((c) => c.name)).toEqual(['Forest', 'Mountain', 'Plains']);
  });

  it('ZONE_VIEW_CARD_REMOVED → drops the snapshot when the last card leaves', () => {
    const state = deckViewState([makeCard({ id: 0, name: 'Forest' })]);

    const result = gamesReducer(state, Actions.zoneViewCardRemoved({
      gameId: 1, playerId: 1, zoneName: 'deck', position: 0,
    }));

    expect(result.games[1].players[1].zones['deck'].revealedCards).toBeUndefined();
  });

  it('ZONE_VIEW_CARD_REMOVED → no-op for out-of-range position', () => {
    const state = deckViewState([makeCard({ id: 0, name: 'Forest' })]);

    const result = gamesReducer(state, Actions.zoneViewCardRemoved({
      gameId: 1, playerId: 1, zoneName: 'deck', position: 5,
    }));

    expect(result.games[1].players[1].zones['deck'].revealedCards?.map((c) => c.name)).toEqual(['Forest']);
  });

  it('ZONE_VIEW_CARD_REORDERED → moves the entry and re-indexes survivors', () => {
    const state = deckViewState([
      makeCard({ id: 0, name: 'Forest' }),
      makeCard({ id: 1, name: 'Island' }),
      makeCard({ id: 2, name: 'Mountain' }),
    ]);

    const result = gamesReducer(state, Actions.zoneViewCardReordered({
      gameId: 1, playerId: 1, zoneName: 'deck', fromPosition: 0, toPosition: 2,
    }));

    const revealed = result.games[1].players[1].zones['deck'].revealedCards!;
    expect(revealed.map((c) => c.name)).toEqual(['Island', 'Mountain', 'Forest']);
    expect(revealed.map((c) => c.id)).toEqual([0, 1, 2]);
  });

  it('ZONE_VIEW_CARD_REORDERED → no-op for out-of-range fromPosition', () => {
    const state = deckViewState([makeCard({ id: 0, name: 'Forest' })]);
    expect(gamesReducer(state, Actions.zoneViewCardReordered({
      gameId: 1, playerId: 1, zoneName: 'deck', fromPosition: 5, toPosition: 0,
    }))).toBe(state);
  });

  it('ZONE_VIEW_CARD_REMOVED → no-op when the zone has no revealed snapshot', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: { deck: makeZoneEntry({ name: 'deck', cards: [], cardCount: 3 }) },
            }),
          },
        }),
      },
    });
    expect(gamesReducer(state, Actions.zoneViewCardRemoved({
      gameId: 1, playerId: 1, zoneName: 'deck', position: 0,
    }))).toBe(state);
  });

  it('ZONE_PROPERTIES_CHANGED → sets alwaysRevealTopCard and alwaysLookAtTopCard', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.zonePropertiesChanged({
      gameId: 1,
      playerId: 1,
      data: create(Event_ChangeZonePropertiesSchema, {
        zoneName: 'hand', alwaysRevealTopCard: true, alwaysLookAtTopCard: true,
      }),
    }));

    const zone = result.games[1].players[1].zones['hand'];
    expect(zone.alwaysRevealTopCard).toBe(true);
    expect(zone.alwaysLookAtTopCard).toBe(true);
  });

  it('ZONE_PROPERTIES_CHANGED → updates only alwaysRevealTopCard when alwaysLookAtTopCard is unset', () => {
    const state = makeState();
    const baselineLookAt = state.games[1].players[1].zones['hand'].alwaysLookAtTopCard;
    const result = gamesReducer(state, Actions.zonePropertiesChanged({
      gameId: 1,
      playerId: 1,
      data: create(Event_ChangeZonePropertiesSchema, {
        zoneName: 'hand', alwaysRevealTopCard: true,
      }),
    }));

    const zone = result.games[1].players[1].zones['hand'];
    expect(zone.alwaysRevealTopCard).toBe(true);
    expect(zone.alwaysLookAtTopCard).toBe(baselineLookAt);
  });

  it('ZONE_PROPERTIES_CHANGED → updates only alwaysLookAtTopCard when alwaysRevealTopCard is unset', () => {
    const state = makeState();
    const baselineReveal = state.games[1].players[1].zones['hand'].alwaysRevealTopCard;
    const result = gamesReducer(state, Actions.zonePropertiesChanged({
      gameId: 1,
      playerId: 1,
      data: create(Event_ChangeZonePropertiesSchema, {
        zoneName: 'hand', alwaysLookAtTopCard: true,
      }),
    }));

    const zone = result.games[1].players[1].zones['hand'];
    expect(zone.alwaysLookAtTopCard).toBe(true);
    expect(zone.alwaysRevealTopCard).toBe(baselineReveal);
  });
});


describe('2J: Turn, phase, and chat', () => {
  it('ACTIVE_PLAYER_SET → sets game.activePlayerId', () => {
    const state = makeState();
    const result = dispatchThroughStore(state, Actions.activePlayerSet({ gameId: 1, activePlayerId: 3 }));
    expect(result.games[1].activePlayerId).toBe(3);
  });

  it('ACTIVE_PHASE_SET → sets game.activePhase', () => {
    const state = makeState();
    const result = dispatchThroughStore(state, Actions.activePhaseSet({ gameId: 1, phase: 5 }));
    expect(result.games[1].activePhase).toBe(5);
  });

  it('TURN_REVERSED → sets game.reversed', () => {
    const state = makeState();
    const result = dispatchThroughStore(state, Actions.turnReversed({ gameId: 1, reversed: true }));
    expect(result.games[1].reversed).toBe(true);
  });

  it('GAME_SAY → appends message with timeReceived from payload', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameSay({
      gameId: 1,
      playerId: 2,
      message: 'gg',
      timeReceived: 123456789,
    }));

    expect(result.games[1].messages).toHaveLength(1);
    expect(result.games[1].messages[0]).toEqual({
      playerId: 2, message: 'gg', timeReceived: 123456789, kind: 'chat',
    });
  });

  it(`GAME_SAY → caps messages at MAX_GAME_MESSAGES (${MAX_GAME_MESSAGES}) and evicts oldest`, () => {
    const oldMessages = Array.from({ length: MAX_GAME_MESSAGES }, (_, i) => ({
      playerId: 2, message: `msg-${i}`, timeReceived: i, kind: 'chat' as const,
    }));
    const state = makeState({ games: { 1: makeGameEntry({ messages: oldMessages }) } });
    const result = gamesReducer(state, Actions.gameSay({
      gameId: 1, playerId: 2, message: 'overflow', timeReceived: 9999,
    }));

    expect(result.games[1].messages).toHaveLength(MAX_GAME_MESSAGES);
    expect(result.games[1].messages[MAX_GAME_MESSAGES - 1].message).toBe('overflow');
    expect(result.games[1].messages[0].message).not.toBe('msg-0');
  });
});


describe('2K: Log-only actions', () => {
  it('ZONE_SHUFFLED → appends an event-log message', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.zoneShuffled({ gameId: 1, playerId: 1, data: {} }));
    const msgs = result.games[1].messages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].kind).toBe('event');
    expect(msgs[0].message).toContain('shuffles');
  });

  it('ZONE_DUMPED → appends an event-log message', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.zoneDumped({
      gameId: 1, playerId: 1,
      data: { zoneOwnerId: 1, zoneName: 'deck', numberCards: 3, isReversed: false },
    }));
    const msgs = result.games[1].messages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].kind).toBe('event');
    expect(msgs[0].message).toContain('3');
  });

  it('DIE_ROLLED → appends an event-log message', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.dieRolled({
      gameId: 1, playerId: 1,
      data: { sides: 20, value: 17, values: [17] },
    }));
    const msgs = result.games[1].messages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].kind).toBe('event');
    expect(msgs[0].message).toContain('17');
    expect(msgs[0].message).toContain('20');
  });

  it('ZONE_SHUFFLED with unknown gameId → state unchanged', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.zoneShuffled({ gameId: 999, playerId: 1, data: {} }));
    expect(result).toBe(state);
  });

  it('unknown action type → returns state unchanged (identity)', () => {
    const state = makeState();
    const result = gamesReducer(state, { type: 'UNKNOWN_ACTION_COMPLETELY' });
    expect(result).toBe(state);
  });
});

describe('2L: Null-guard / missing entity early-returns', () => {
  const UNKNOWN_GAME = 999;
  const UNKNOWN_PLAYER = 999;

  it('updateGame guard: GAME_HOST_CHANGED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.gameHostChanged({ gameId: UNKNOWN_GAME, hostId: 1 }))).toBe(state);
  });

  it('GAME_STATE_CHANGED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.gameStateChanged({ gameId: UNKNOWN_GAME, data: {} }))).toBe(state);
  });

  it('PLAYER_JOINED with unknown gameId → state unchanged', () => {
    const state = makeState();
    const props = makePlayerProperties({ playerId: 5 });
    expect(gamesReducer(state, Actions.playerJoined({ gameId: UNKNOWN_GAME, playerProperties: props }))).toBe(state);
  });

  it('PLAYER_LEFT with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(
      gamesReducer(state, Actions.playerLeft({ gameId: UNKNOWN_GAME, playerId: 1, reason: 3, timeReceived: 0 })),
    ).toBe(state);
  });

  it('updatePlayer guard: PLAYER_PROPERTIES_CHANGED with unknown gameId → state unchanged', () => {
    const state = makeState();
    const props = makePlayerProperties({ playerId: 1 });
    expect(gamesReducer(state, Actions.playerPropertiesChanged({
      gameId: UNKNOWN_GAME, playerId: 1, properties: props,
    }))).toBe(state);
  });

  it('updatePlayer guard: PLAYER_PROPERTIES_CHANGED with unknown playerId → state unchanged', () => {
    const state = makeState();
    const props = makePlayerProperties({ playerId: UNKNOWN_PLAYER });
    expect(gamesReducer(state, Actions.playerPropertiesChanged({
      gameId: 1, playerId: UNKNOWN_PLAYER, properties: props,
    }))).toBe(state);
  });

  it('CARD_MOVED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(dispatchCardMoved(state, Actions.cardMoved({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: {
        cardId: 1, cardName: '', startPlayerId: 1, startZone: 'hand', position: -1,
        targetPlayerId: 1, targetZone: 'hand', x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }))).toBe(state);
  });

  it('CARD_MOVED with unknown sourcePlayer → state unchanged', () => {
    const state = makeState();
    expect(dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1, playerId: 1,
      data: {
        cardId: 1, cardName: '', startPlayerId: UNKNOWN_PLAYER, startZone: 'hand', position: -1,
        targetPlayerId: 1, targetZone: 'hand', x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }))).toBe(state);
  });

  it('CARD_MOVED with unknown sourceZone → state unchanged', () => {
    const state = makeState();
    expect(dispatchCardMoved(state, Actions.cardMoved({
      gameId: 1, playerId: 1,
      data: {
        cardId: 1, cardName: '', startPlayerId: 1, startZone: 'nonexistent', position: -1,
        targetPlayerId: 1, targetZone: 'hand', x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }))).toBe(state);
  });

  it('CARD_FLIPPED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardFlipped({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: { zoneName: 'hand', cardId: 1, cardName: '', faceDown: false, cardProviderId: '' },
    }))).toBe(state);
  });

  it('CARD_FLIPPED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardFlipped({
      gameId: 1, playerId: UNKNOWN_PLAYER,
      data: { zoneName: 'hand', cardId: 1, cardName: '', faceDown: false, cardProviderId: '' },
    }))).toBe(state);
  });

  it('CARD_FLIPPED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardFlipped({
      gameId: 1, playerId: 1,
      data: { zoneName: 'nonexistent', cardId: 1, cardName: '', faceDown: false, cardProviderId: '' },
    }))).toBe(state);
  });

  it('CARD_FLIPPED with unknown cardId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardFlipped({
      gameId: 1, playerId: 1,
      data: { zoneName: 'hand', cardId: 9999, cardName: '', faceDown: false, cardProviderId: '' },
    }))).toBe(state);
  });

  it('CARD_DESTROYED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardDestroyed({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: { zoneName: 'hand', cardId: 1 },
    }))).toBe(state);
  });

  it('CARD_DESTROYED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardDestroyed({
      gameId: 1, playerId: UNKNOWN_PLAYER,
      data: { zoneName: 'hand', cardId: 1 },
    }))).toBe(state);
  });

  it('CARD_DESTROYED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardDestroyed({
      gameId: 1, playerId: 1,
      data: { zoneName: 'nonexistent', cardId: 1 },
    }))).toBe(state);
  });

  it('CARD_ATTACHED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttached({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: { startZone: 'hand', cardId: 1, targetPlayerId: 1, targetZone: 'hand', targetCardId: 1 },
    }))).toBe(state);
  });

  it('CARD_ATTACHED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttached({
      gameId: 1, playerId: UNKNOWN_PLAYER,
      data: { startZone: 'hand', cardId: 1, targetPlayerId: 1, targetZone: 'hand', targetCardId: 1 },
    }))).toBe(state);
  });

  it('CARD_ATTACHED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttached({
      gameId: 1, playerId: 1,
      data: { startZone: 'nonexistent', cardId: 1, targetPlayerId: 1, targetZone: 'hand', targetCardId: 1 },
    }))).toBe(state);
  });

  it('CARD_ATTACHED with unknown cardId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttached({
      gameId: 1, playerId: 1,
      data: { startZone: 'hand', cardId: 9999, targetPlayerId: 1, targetZone: 'hand', targetCardId: 1 },
    }))).toBe(state);
  });

  it('TOKEN_CREATED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.tokenCreated({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: {
        zoneName: 'hand', cardId: 1, cardName: 'T', color: '', pt: '', annotation: '',
        destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
      },
    }))).toBe(state);
  });

  it('TOKEN_CREATED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.tokenCreated({
      gameId: 1, playerId: UNKNOWN_PLAYER,
      data: {
        zoneName: 'hand', cardId: 1, cardName: 'T', color: '', pt: '', annotation: '',
        destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
      },
    }))).toBe(state);
  });

  it('TOKEN_CREATED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.tokenCreated({
      gameId: 1, playerId: 1,
      data: {
        zoneName: 'nonexistent', cardId: 1, cardName: 'T', color: '', pt: '', annotation: '',
        destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
      },
    }))).toBe(state);
  });

  it('CARD_ATTR_CHANGED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttrChanged({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: { zoneName: 'hand', cardId: 1, attribute: 1, attrValue: '1' },
    }))).toBe(state);
  });

  it('CARD_ATTR_CHANGED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttrChanged({
      gameId: 1, playerId: UNKNOWN_PLAYER,
      data: { zoneName: 'hand', cardId: 1, attribute: 1, attrValue: '1' },
    }))).toBe(state);
  });

  it('CARD_ATTR_CHANGED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttrChanged({
      gameId: 1, playerId: 1,
      data: { zoneName: 'nonexistent', cardId: 1, attribute: 1, attrValue: '1' },
    }))).toBe(state);
  });

  it('CARD_ATTR_CHANGED with unknown cardId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardAttrChanged({
      gameId: 1, playerId: 1,
      data: { zoneName: 'hand', cardId: 9999, attribute: 1, attrValue: '1' },
    }))).toBe(state);
  });

  it('CARD_COUNTER_CHANGED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardCounterChanged({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: { zoneName: 'hand', cardId: 1, counterId: 1, counterValue: 1 },
    }))).toBe(state);
  });

  it('CARD_COUNTER_CHANGED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardCounterChanged({
      gameId: 1, playerId: UNKNOWN_PLAYER,
      data: { zoneName: 'hand', cardId: 1, counterId: 1, counterValue: 1 },
    }))).toBe(state);
  });

  it('CARD_COUNTER_CHANGED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardCounterChanged({
      gameId: 1, playerId: 1,
      data: { zoneName: 'nonexistent', cardId: 1, counterId: 1, counterValue: 1 },
    }))).toBe(state);
  });

  it('CARD_COUNTER_CHANGED with unknown cardId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardCounterChanged({
      gameId: 1, playerId: 1,
      data: { zoneName: 'hand', cardId: 9999, counterId: 1, counterValue: 1 },
    }))).toBe(state);
  });

  it('ARROW_CREATED with unknown gameId → state unchanged', () => {
    const state = makeState();
    const arrow = makeArrow({ id: 1 });
    expect(gamesReducer(state, Actions.arrowCreated({ gameId: UNKNOWN_GAME, playerId: 1, data: { arrowInfo: arrow } }))).toBe(state);
  });

  it('ARROW_CREATED with unknown playerId → state unchanged', () => {
    const state = makeState();
    const arrow = makeArrow({ id: 1 });
    expect(gamesReducer(state, Actions.arrowCreated({ gameId: 1, playerId: UNKNOWN_PLAYER, data: { arrowInfo: arrow } }))).toBe(state);
  });

  it('ARROW_DELETED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.arrowDeleted({ gameId: UNKNOWN_GAME, playerId: 1, data: { arrowId: 1 } }))).toBe(state);
  });

  it('ARROW_DELETED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.arrowDeleted({ gameId: 1, playerId: UNKNOWN_PLAYER, data: { arrowId: 1 } }))).toBe(state);
  });

  it('COUNTER_CREATED with unknown gameId → state unchanged', () => {
    const state = makeState();
    const counter = makeCounter({ id: 1 });
    expect(gamesReducer(state, Actions.counterCreated({
      gameId: UNKNOWN_GAME, playerId: 1, data: { counterInfo: counter },
    }))).toBe(state);
  });

  it('COUNTER_CREATED with unknown playerId → state unchanged', () => {
    const state = makeState();
    const counter = makeCounter({ id: 1 });
    expect(gamesReducer(state, Actions.counterCreated({
      gameId: 1, playerId: UNKNOWN_PLAYER, data: { counterInfo: counter },
    }))).toBe(state);
  });

  it('COUNTER_SET with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.counterSet({
      gameId: UNKNOWN_GAME, playerId: 1, data: { counterId: 1, value: 5 },
    }))).toBe(state);
  });

  it('COUNTER_SET with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.counterSet({
      gameId: 1, playerId: UNKNOWN_PLAYER, data: { counterId: 1, value: 5 },
    }))).toBe(state);
  });

  it('COUNTER_SET with unknown counterId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.counterSet({ gameId: 1, playerId: 1, data: { counterId: 9999, value: 5 } }))).toBe(state);
  });

  it('COUNTER_DELETED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.counterDeleted({ gameId: UNKNOWN_GAME, playerId: 1, data: { counterId: 1 } }))).toBe(state);
  });

  it('COUNTER_DELETED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.counterDeleted({ gameId: 1, playerId: UNKNOWN_PLAYER, data: { counterId: 1 } }))).toBe(state);
  });

  it('CARDS_DRAWN with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardsDrawn({
      gameId: UNKNOWN_GAME, playerId: 1, data: { number: 1, cards: [] },
    }))).toBe(state);
  });

  it('CARDS_DRAWN with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardsDrawn({
      gameId: 1, playerId: UNKNOWN_PLAYER, data: { number: 1, cards: [] }
    }))).toBe(state);
  });

  it('CARDS_DRAWN with no hand zone → state unchanged', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({ zones: { deck: makeZoneEntry({ name: 'deck', cardCount: 10 }) } }),
          },
        }),
      },
    });
    expect(gamesReducer(state, Actions.cardsDrawn({ gameId: 1, playerId: 1, data: { number: 1, cards: [] } }))).toBe(state);
  });

  it('CARDS_REVEALED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardsRevealed({
      gameId: UNKNOWN_GAME, playerId: 1, data: { zoneName: 'hand', cards: [] },
    }))).toBe(state);
  });

  it('CARDS_REVEALED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardsRevealed({
      gameId: 1, playerId: UNKNOWN_PLAYER, data: { zoneName: 'hand', cards: [] },
    }))).toBe(state);
  });

  it('CARDS_REVEALED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.cardsRevealed({
      gameId: 1, playerId: 1, data: { zoneName: 'nonexistent', cards: [] },
    }))).toBe(state);
  });

  it('updateZone guard: ZONE_PROPERTIES_CHANGED with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.zonePropertiesChanged({
      gameId: UNKNOWN_GAME, playerId: 1,
      data: { zoneName: 'hand', alwaysRevealTopCard: true, alwaysLookAtTopCard: true },
    }))).toBe(state);
  });

  it('updateZone guard: ZONE_PROPERTIES_CHANGED with unknown playerId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.zonePropertiesChanged({
      gameId: 1, playerId: UNKNOWN_PLAYER,
      data: { zoneName: 'hand', alwaysRevealTopCard: true, alwaysLookAtTopCard: true },
    }))).toBe(state);
  });

  it('updateZone guard: ZONE_PROPERTIES_CHANGED with unknown zone → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.zonePropertiesChanged({
      gameId: 1, playerId: 1,
      data: { zoneName: 'nonexistent', alwaysRevealTopCard: true, alwaysLookAtTopCard: true },
    }))).toBe(state);
  });

  it('GAME_SAY with unknown gameId → state unchanged', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.gameSay({ gameId: UNKNOWN_GAME, playerId: 1, message: 'hi', timeReceived: 0 }))).toBe(state);
  });
});


describe('malformed input', () => {
  it('CARDS_REVEALED with empty cards array → leaves zone unchanged', () => {
    const baseCard = makeCard({ id: 7 });
    const state = makeState({
      games: { 1: makeGameEntry({
        players: { 1: makePlayerEntry({ zones: { hand: makeZoneEntry({ cards: [baseCard] }) } }) },
      }) },
    });
    const result = gamesReducer(state, Actions.cardsRevealed({
      gameId: 1, playerId: 1, data: { zoneName: 'hand', cards: [] },
    }));
    expect(cardsIn(result, 1, 1, 'hand')).toEqual([baseCard]);
  });

  it('CARD_FLIPPED with unknown cardId → state unchanged', () => {
    const state = makeState({
      games: { 1: makeGameEntry({
        players: { 1: makePlayerEntry({ zones: { hand: makeZoneEntry({ cards: [makeCard({ id: 1 })] }) } }) },
      }) },
    });
    expect(gamesReducer(state, Actions.cardFlipped({
      gameId: 1, playerId: 1,
      data: { zoneName: 'hand', cardId: 9999, cardName: '', faceDown: true, cardProviderId: '' },
    }))).toBe(state);
  });

  it('GAME_SAY with negative timeReceived → message still appended verbatim', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameSay({
      gameId: 1, playerId: 1, message: '', timeReceived: -1,
    }));
    expect(result.games[1].messages).toHaveLength(1);
    expect(result.games[1].messages[0].timeReceived).toBe(-1);
  });

  it('ZONE_DUMPED with unknown gameId → state unchanged (does not push log)', () => {
    const state = makeState();
    expect(gamesReducer(state, Actions.zoneDumped({
      gameId: 999, playerId: 1,
      data: { zoneOwnerId: 1, zoneName: 'deck', numberCards: 3, isReversed: false },
    }))).toBe(state);
  });

  it('reducer with an unrecognized action type → identical state reference', () => {
    const state = makeState();
    expect(gamesReducer(state, { type: '@@unknown-action', payload: {} } as never)).toBe(state);
  });
});
