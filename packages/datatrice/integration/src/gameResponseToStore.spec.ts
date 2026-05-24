import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { attachResponseHandlers, createStore, games } from '../../src';
import {
  CardAttribute,
  Event_AttachCardSchema,
  Event_ChangeZonePropertiesSchema,
  Event_CreateArrowSchema,
  Event_CreateCounterSchema,
  Event_CreateTokenSchema,
  Event_DelCounterSchema,
  Event_DeleteArrowSchema,
  Event_DestroyCardSchema,
  Event_DrawCardsSchema,
  Event_DumpZoneSchema,
  Event_FlipCardSchema,
  Event_GameJoinedSchema,
  Event_GameStateChangedSchema,
  Event_MoveCardSchema,
  Event_RevealCardsSchema,
  Event_RollDieSchema,
  Event_SetCardAttrSchema,
  Event_SetCardCounterSchema,
  Event_SetCounterSchema,
  Event_ShuffleSchema,
  ServerInfo_ArrowSchema,
  ServerInfo_Card,
  ServerInfo_CardSchema,
  ServerInfo_CounterSchema,
  ServerInfo_GameSchema,
  ServerInfo_Player,
  ServerInfo_PlayerPropertiesSchema,
  ServerInfo_PlayerSchema,
} from '@cockatrice/sockatrice/generated';

// Integration: drives every GameResponseImpl handler method through the real
// store. Game lifecycle (join / playerJoined / gameStateChanged / close), all
// card events (move / flip / destroy / attach / token / attr / counter / draw
// / reveal), counter + arrow events, turn/phase/active-player events, and
// zone events. Asserts via games.selectors so the selector layer is exercised
// alongside the listeners + game.reducer.* primitives + messageLog.

type Store = ReturnType<typeof createStore>;

const GAME_ID = 42;

// --- helpers -------------------------------------------------------------

function makeJoinedData() {
  return create(Event_GameJoinedSchema, {
    gameInfo: create(ServerInfo_GameSchema, {
      gameId: GAME_ID,
      roomId: 1,
      description: 'integration game',
      started: false,
    }),
    hostId: 1,
    playerId: 1,
    spectator: false,
    judge: false,
    resuming: false,
  });
}

function playerWithZones(playerId: number, name: string): ServerInfo_Player {
  return create(ServerInfo_PlayerSchema, {
    properties: create(ServerInfo_PlayerPropertiesSchema, {
      playerId,
      userInfo: { name },
    }),
    deckList: '',
    zoneList: [
      { name: 'hand', type: 1, withCoords: false, cardCount: 0, cardList: [], alwaysRevealTopCard: false, alwaysLookAtTopCard: false },
      { name: 'deck', type: 1, withCoords: false, cardCount: 40, cardList: [], alwaysRevealTopCard: false, alwaysLookAtTopCard: false },
      { name: 'table', type: 2, withCoords: true, cardCount: 0, cardList: [], alwaysRevealTopCard: false, alwaysLookAtTopCard: false },
      { name: 'grave', type: 1, withCoords: false, cardCount: 0, cardList: [], alwaysRevealTopCard: false, alwaysLookAtTopCard: false },
    ],
    counterList: [],
    arrowList: [],
  });
}

/**
 * Seeds a started 2-player game with Alice (id 1) and Bob (id 2), each holding
 * fully-formed zones. Returns the wired store + response bridge.
 */
function seedGame(): { store: Store; response: WebsocketTypes.IWebClientResponse } {
  const store = createStore();
  const response = attachResponseHandlers(store);

  response.session.gameJoined(makeJoinedData());
  response.game.gameStateChanged(GAME_ID, create(Event_GameStateChangedSchema, {
    playerList: [playerWithZones(1, 'Alice'), playerWithZones(2, 'Bob')],
  }));
  // Starts the game (drives the wasStarted→started edge + game-start log).
  response.game.gameStateChanged(GAME_ID, create(Event_GameStateChangedSchema, {
    gameStarted: true,
    activePlayerId: 1,
    activePhase: 0,
    secondsElapsed: 0,
  }));
  return { store, response };
}

function tableCard(id: number, name: string, overrides: Partial<ServerInfo_Card> = {}): ServerInfo_Card {
  return create(ServerInfo_CardSchema, {
    id, name, x: 0, y: 0, faceDown: false, tapped: false, attacking: false,
    color: '', pt: '', annotation: '', destroyOnZoneChange: false, doesntUntap: false,
    counterList: [], attachPlayerId: -1, attachZone: '', attachCardId: -1, providerId: '',
    ...overrides,
  });
}

// --- lifecycle -----------------------------------------------------------

describe('integration: game lifecycle', () => {
  it('gameJoined seeds a GameEntry the selectors can read', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.gameJoined(makeJoinedData());

    const state = store.getState();
    const game = games.Selectors.getGame(state, GAME_ID);
    expect(game).toBeDefined();
    expect(games.Selectors.getHostId(state, GAME_ID)).toBe(1);
    expect(games.Selectors.getLocalPlayerId(state, GAME_ID)).toBe(1);
    expect(games.Selectors.isStarted(state, GAME_ID)).toBe(false);
    expect(games.Selectors.getActiveGameIds(state)).toContain(GAME_ID);
  });

  it('gameStateChanged populates players, zones and the started edge logs a system message', () => {
    const { store } = seedGame();
    const state = store.getState();

    const players = games.Selectors.getPlayers(state, GAME_ID);
    expect(Object.keys(players ?? {})).toEqual(['1', '2']);
    expect(games.Selectors.getLocalPlayer(state, GAME_ID)?.properties.userInfo?.name).toBe('Alice');
    expect(games.Selectors.isStarted(state, GAME_ID)).toBe(true);
    expect(games.Selectors.getActivePhase(state, GAME_ID)).toBe(0);

    const deck = games.Selectors.getZone(state, GAME_ID, 1, 'deck');
    expect(deck?.cardCount).toBe(40);

    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'The game has started.')).toBe(true);
  });

  it('playerJoined adds a new player and logs the join', () => {
    const { store, response } = seedGame();
    response.game.playerJoined(GAME_ID, create(ServerInfo_PlayerPropertiesSchema, {
      playerId: 3,
      userInfo: { name: 'Carol' },
    }));

    const state = store.getState();
    expect(games.Selectors.getPlayer(state, GAME_ID, 3)).toBeDefined();
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Carol has joined the game.')).toBe(true);
  });

  it('playerLeft removes the player and logs a leave reason', () => {
    const { store, response } = seedGame();
    response.game.playerLeft(GAME_ID, 2, 3);

    const state = store.getState();
    expect(games.Selectors.getPlayer(state, GAME_ID, 2)).toBeUndefined();
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Bob has left the game (player left the game).')).toBe(true);
  });

  it('playerPropertiesChanged merges set fields and logs the diff', () => {
    const { store, response } = seedGame();
    response.game.playerPropertiesChanged(GAME_ID, 1, create(ServerInfo_PlayerPropertiesSchema, {
      playerId: 1,
      conceded: true,
    }));

    const state = store.getState();
    expect(games.Selectors.getPlayer(state, GAME_ID, 1)?.properties.conceded).toBe(true);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice has conceded the game.')).toBe(true);
  });

  it('gameHostChanged updates hostId', () => {
    const { store, response } = seedGame();
    response.game.gameHostChanged(GAME_ID, 2);
    expect(games.Selectors.getHostId(store.getState(), GAME_ID)).toBe(2);
  });

  it('gameClosed removes the game from the slice', () => {
    const { store, response } = seedGame();
    response.game.gameClosed(GAME_ID);
    expect(games.Selectors.getGame(store.getState(), GAME_ID)).toBeUndefined();
  });

  it('kicked removes the game from the slice', () => {
    const { store, response } = seedGame();
    response.game.kicked(GAME_ID);
    expect(games.Selectors.getGame(store.getState(), GAME_ID)).toBeUndefined();
  });

  it('clearStore wipes all games', () => {
    const { store, response } = seedGame();
    response.game.clearStore();
    expect(games.Selectors.getActiveGames(store.getState())).toHaveLength(0);
  });
});

// --- chat / dice / shuffle ----------------------------------------------

describe('integration: game chat and table events', () => {
  it('gameSay appends a chat message', () => {
    const { store, response } = seedGame();
    response.game.gameSay(GAME_ID, 1, 'gg', 1000);

    const messages = games.Selectors.getMessages(store.getState(), GAME_ID);
    const last = messages[messages.length - 1];
    expect(last).toMatchObject({ playerId: 1, message: 'gg', kind: 'chat' });
  });

  it('dieRolled logs the roll', () => {
    const { store, response } = seedGame();
    response.game.dieRolled(GAME_ID, 1, create(Event_RollDieSchema, {
      sides: 20, value: 17, values: [17],
    }));
    const messages = games.Selectors.getMessages(store.getState(), GAME_ID);
    expect(messages.some(m => m.message === 'Alice rolls a 17 on a 20-sided die.')).toBe(true);
  });

  it('zoneShuffled logs the shuffle', () => {
    const { store, response } = seedGame();
    response.game.zoneShuffled(GAME_ID, 1, create(Event_ShuffleSchema, { zoneName: 'deck' }));
    const messages = games.Selectors.getMessages(store.getState(), GAME_ID);
    expect(messages.some(m => m.message === 'Alice shuffles their library.')).toBe(true);
  });

  it('zoneDumped logs the dump', () => {
    const { store, response } = seedGame();
    response.game.zoneDumped(GAME_ID, 1, create(Event_DumpZoneSchema, {
      zoneOwnerId: 1, zoneName: 'deck', numberCards: 4,
    }));
    const messages = games.Selectors.getMessages(store.getState(), GAME_ID);
    expect(messages.some(m => m.message.includes('looks at 4 card(s)'))).toBe(true);
  });

  it('zonePropertiesChanged flips alwaysRevealTopCard and logs it', () => {
    const { store, response } = seedGame();
    response.game.zonePropertiesChanged(GAME_ID, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'deck', alwaysRevealTopCard: true,
    }));
    const state = store.getState();
    expect(games.Selectors.getZone(state, GAME_ID, 1, 'deck')?.alwaysRevealTopCard).toBe(true);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message.includes('revealing the top card'))).toBe(true);
  });
});

// --- card events ---------------------------------------------------------

describe('integration: card events', () => {
  it('cardsDrawn moves cards from deck into hand and logs the draw', () => {
    const { store, response } = seedGame();
    response.game.cardsDrawn(GAME_ID, 1, create(Event_DrawCardsSchema, {
      number: 2,
      cards: [tableCard(100, 'Island'), tableCard(101, 'Forest')],
    }));

    const state = store.getState();
    const hand = games.Selectors.getCards(state, GAME_ID, 1, 'hand');
    expect(hand.map(c => c.id)).toEqual([100, 101]);
    expect(games.Selectors.getZone(state, GAME_ID, 1, 'deck')?.cardCount).toBe(38);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice draws 2 cards.')).toBe(true);
  });

  it('cardsRevealed inserts revealed cards into the target zone', () => {
    const { store, response } = seedGame();
    response.game.cardsRevealed(GAME_ID, 1, create(Event_RevealCardsSchema, {
      zoneName: 'hand',
      cards: [tableCard(200, 'Mountain')],
    }));
    const cards = games.Selectors.getCards(store.getState(), GAME_ID, 1, 'hand');
    expect(cards.map(c => c.name)).toContain('Mountain');
  });

  it('cardMoved relocates a card between zones and logs the play', () => {
    const { store, response } = seedGame();
    // Put a card in hand first.
    response.game.cardsDrawn(GAME_ID, 1, create(Event_DrawCardsSchema, {
      number: 1, cards: [tableCard(300, 'Llanowar Elves')],
    }));
    response.game.cardMoved(GAME_ID, 1, create(Event_MoveCardSchema, {
      cardId: 300, cardName: 'Llanowar Elves',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'table',
      position: -1, x: 1, y: 2, newCardId: -1, faceDown: false, newCardProviderId: '',
    }));

    const state = store.getState();
    const table = games.Selectors.getCards(state, GAME_ID, 1, 'table');
    expect(table.map(c => c.id)).toContain(300);
    expect(games.Selectors.getCards(state, GAME_ID, 1, 'hand')).toHaveLength(0);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice plays Llanowar Elves.')).toBe(true);
  });

  it('cardMoved cross-player table-to-table reparents attachments', () => {
    const { store, response } = seedGame();
    // Parent on Alice's table, child attached to parent.
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 400, cardName: 'Bear', color: 'g', pt: '2/2',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 401, cardName: 'Aura', color: '', pt: '',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.cardAttached(GAME_ID, 1, create(Event_AttachCardSchema, {
      startZone: 'table', cardId: 401,
      targetPlayerId: 1, targetZone: 'table', targetCardId: 400,
    }));
    // Move the parent to Bob's table.
    response.game.cardMoved(GAME_ID, 1, create(Event_MoveCardSchema, {
      cardId: 400, cardName: 'Bear',
      startPlayerId: 1, startZone: 'table',
      targetPlayerId: 2, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: 400, faceDown: false, newCardProviderId: '',
    }));

    const state = store.getState();
    const child = games.Selectors.getZone(state, GAME_ID, 1, 'table')?.byId[401];
    expect(child?.attachPlayerId).toBe(2);
    expect(child?.attachCardId).toBe(400);
    const attachments = games.Selectors.getAttachmentsByParent(state, GAME_ID, 2);
    expect(attachments.get(400)?.[0]?.card.id).toBe(401);
  });

  it('cardFlipped updates faceDown and logs the flip', () => {
    const { store, response } = seedGame();
    response.game.cardsDrawn(GAME_ID, 1, create(Event_DrawCardsSchema, {
      number: 1, cards: [tableCard(500, 'Secret')],
    }));
    response.game.cardFlipped(GAME_ID, 1, create(Event_FlipCardSchema, {
      zoneName: 'hand', cardId: 500, cardName: 'Secret', faceDown: true, cardProviderId: '',
    }));
    const state = store.getState();
    expect(games.Selectors.getZone(state, GAME_ID, 1, 'hand')?.byId[500]?.faceDown).toBe(true);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice flips Secret face-down.')).toBe(true);
  });

  it('cardDestroyed removes the card and logs destruction', () => {
    const { store, response } = seedGame();
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 600, cardName: 'Goblin', color: 'r', pt: '1/1',
      annotation: '', destroyOnZoneChange: true, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.cardDestroyed(GAME_ID, 1, create(Event_DestroyCardSchema, {
      zoneName: 'table', cardId: 600,
    }));
    const state = store.getState();
    expect(games.Selectors.getZone(state, GAME_ID, 1, 'table')?.byId[600]).toBeUndefined();
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice destroys Goblin.')).toBe(true);
  });

  it('tokenCreated inserts a token onto the table and logs it', () => {
    const { store, response } = seedGame();
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 700, cardName: 'Soldier', color: 'w', pt: '1/1',
      annotation: '', destroyOnZoneChange: true, x: 3, y: 4, cardProviderId: '', faceDown: false,
    }));
    const state = store.getState();
    const card = games.Selectors.getZone(state, GAME_ID, 1, 'table')?.byId[700];
    expect(card?.name).toBe('Soldier');
    expect(card?.pt).toBe('1/1');
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice creates token: Soldier (1/1).')).toBe(true);
  });

  it('cardAttrChanged taps a card and logs it', () => {
    const { store, response } = seedGame();
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 800, cardName: 'Knight', color: 'w', pt: '2/2',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.cardAttrChanged(GAME_ID, 1, create(Event_SetCardAttrSchema, {
      zoneName: 'table', cardId: 800,
      attribute: CardAttribute.AttrTapped, attrValue: '1',
    }));
    const state = store.getState();
    expect(games.Selectors.getZone(state, GAME_ID, 1, 'table')?.byId[800]?.tapped).toBe(true);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice taps Knight.')).toBe(true);
  });

  it('cardCounterChanged adds counters to a card and logs the delta', () => {
    const { store, response } = seedGame();
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 900, cardName: 'Hydra', color: 'g', pt: '0/0',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.cardCounterChanged(GAME_ID, 1, create(Event_SetCardCounterSchema, {
      zoneName: 'table', cardId: 900, counterId: 1, counterValue: 3,
    }));
    const state = store.getState();
    const card = games.Selectors.getZone(state, GAME_ID, 1, 'table')?.byId[900];
    expect(card?.counterList.find(c => c.id === 1)?.value).toBe(3);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message.includes('counter(s) on Hydra'))).toBe(true);
  });

  it('cardAttached then unattach updates attach fields and logs both', () => {
    const { store, response } = seedGame();
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 1000, cardName: 'Creature', color: 'g', pt: '3/3',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 1001, cardName: 'Equipment', color: '', pt: '',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.cardAttached(GAME_ID, 1, create(Event_AttachCardSchema, {
      startZone: 'table', cardId: 1001,
      targetPlayerId: 1, targetZone: 'table', targetCardId: 1000,
    }));
    let card = games.Selectors.getZone(store.getState(), GAME_ID, 1, 'table')?.byId[1001];
    expect(card?.attachCardId).toBe(1000);

    response.game.cardAttached(GAME_ID, 1, create(Event_AttachCardSchema, {
      startZone: 'table', cardId: 1001,
      targetPlayerId: -1, targetZone: '', targetCardId: -1,
    }));
    card = games.Selectors.getZone(store.getState(), GAME_ID, 1, 'table')?.byId[1001];
    expect(card?.attachCardId).toBe(-1);
    expect(card?.attachZone).toBe('');
  });
});

// --- counters / arrows / turns ------------------------------------------

describe('integration: counters, arrows, turn state', () => {
  it('counterCreated / counterSet / counterDeleted manage player counters', () => {
    const { store, response } = seedGame();
    response.game.counterCreated(GAME_ID, 1, create(Event_CreateCounterSchema, {
      counterInfo: create(ServerInfo_CounterSchema, { id: 1, name: 'Life', count: 20, radius: 1 }),
    }));
    expect(games.Selectors.getCounters(store.getState(), GAME_ID, 1)[1]?.count).toBe(20);

    response.game.counterSet(GAME_ID, 1, create(Event_SetCounterSchema, {
      counterId: 1, value: 17,
    }));
    const state = store.getState();
    expect(games.Selectors.getCounters(state, GAME_ID, 1)[1]?.count).toBe(17);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice decreases their Life to 17.')).toBe(true);

    response.game.counterDeleted(GAME_ID, 1, create(Event_DelCounterSchema, { counterId: 1 }));
    expect(games.Selectors.getCounters(store.getState(), GAME_ID, 1)[1]).toBeUndefined();
  });

  it('arrowCreated / arrowDeleted manage player arrows and log creation', () => {
    const { store, response } = seedGame();
    // Two table cards to point between.
    response.game.tokenCreated(GAME_ID, 1, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 10, cardName: 'Attacker', color: 'r', pt: '2/2',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.tokenCreated(GAME_ID, 2, create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 20, cardName: 'Blocker', color: 'w', pt: '0/4',
      annotation: '', destroyOnZoneChange: false, x: 0, y: 0, cardProviderId: '', faceDown: false,
    }));
    response.game.arrowCreated(GAME_ID, 1, create(Event_CreateArrowSchema, {
      arrowInfo: create(ServerInfo_ArrowSchema, {
        id: 1, startPlayerId: 1, startZone: 'table', startCardId: 10,
        targetPlayerId: 2, targetZone: 'table', targetCardId: 20,
      }),
    }));
    const state = store.getState();
    expect(games.Selectors.getArrows(state, GAME_ID, 1)[1]).toBeDefined();
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'Alice points from Attacker to Blocker.')).toBe(true);

    response.game.arrowDeleted(GAME_ID, 1, create(Event_DeleteArrowSchema, { arrowId: 1 }));
    expect(games.Selectors.getArrows(store.getState(), GAME_ID, 1)[1]).toBeUndefined();
  });

  it('activePlayerSet updates active player and logs the turn change', () => {
    const { store, response } = seedGame();
    response.game.activePlayerSet(GAME_ID, 2);
    const state = store.getState();
    expect(games.Selectors.getActivePlayerId(state, GAME_ID)).toBe(2);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'It is now Bob\'s turn.')).toBe(true);
  });

  it('activePhaseSet updates the phase and logs it on a started game', () => {
    const { store, response } = seedGame();
    response.game.activePhaseSet(GAME_ID, 3);
    const state = store.getState();
    expect(games.Selectors.getActivePhase(state, GAME_ID)).toBe(3);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message === 'It is now the first main phase.')).toBe(true);
  });

  it('turnReversed flips the reversed flag and logs it', () => {
    const { store, response } = seedGame();
    response.game.turnReversed(GAME_ID, true);
    const state = store.getState();
    expect(games.Selectors.isReversed(state, GAME_ID)).toBe(true);
    const messages = games.Selectors.getMessages(state, GAME_ID);
    expect(messages.some(m => m.message.includes('reverses the turn order'))).toBe(true);
  });

  it('ignores events for unknown games without throwing', () => {
    const { response } = seedGame();
    expect(() => response.game.activePlayerSet(9999, 1)).not.toThrow();
    expect(() => response.game.cardMoved(9999, 1, create(Event_MoveCardSchema, {
      cardId: 1, cardName: '', startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'table', position: -1, x: 0, y: 0,
      newCardId: -1, faceDown: false, newCardProviderId: '',
    }))).not.toThrow();
  });
});
