import { create } from '@bufbuild/protobuf';
import { ZoneName } from '@cockatrice/sockatrice';
import {
  configureStore,
  createListenerMiddleware,
  type ListenerMiddlewareInstance,
  type Middleware,
  type UnknownAction,
} from '@reduxjs/toolkit';
import {
  CardAttribute,
  Event_AttachCardSchema,
  Event_CreateArrowSchema,
  Event_CreateTokenSchema,
  Event_DestroyCardSchema,
  Event_DrawCardsSchema,
  Event_FlipCardSchema,
  Event_GameStateChangedSchema,
  Event_MoveCardSchema,
  Event_RevealCardsSchema,
  Event_SetCardAttrSchema,
  Event_SetCardCounterSchema,
  Event_SetCounterSchema,
  ServerInfo_ArrowSchema,
  ServerInfo_CardSchema,
  ServerInfo_PlayerSchema,
  ServerInfo_UserSchema,
  ServerInfo_ZoneSchema,
  type ServerInfo_Card,
} from '@cockatrice/sockatrice/generated';
import type { MessageInitShape } from '@bufbuild/protobuf';

import { gamesReducer } from './game.reducer';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { registerGameListeners } from './game.listeners';
import { beginOptimistic, consumeOptimistic, moveOpKey } from './optimistic';
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

const ALICE = 1;
const BOB = 2;

function user(name: string) {
  return create(ServerInfo_UserSchema, { name });
}

function props(playerId: number, name: string) {
  return makePlayerProperties({ playerId, userInfo: user(name) });
}

function table(cards: ServerInfo_Card[]) {
  return makeZoneEntry({ name: 'table', type: 1, withCoords: true, cards, cardCount: cards.length });
}

function publicZone(name: string, cards: ServerInfo_Card[] = []) {
  return makeZoneEntry({ name, type: 1, cards, cardCount: cards.length });
}

function hiddenZone(name: string, cardCount: number) {
  return makeZoneEntry({ name, type: 2, cardCount });
}

function scriptedState(): GamesState {
  const alice = makePlayerEntry({
    properties: props(ALICE, 'Alice'),
    zones: {
      table: table([
        makeCard({ id: 10, name: 'Grizzly Bears', x: 0 }),
        makeCard({ id: 11, name: 'Bonesplitter', x: 3, attachPlayerId: ALICE, attachZone: 'table', attachCardId: 10 }),
      ]),
      hand: publicZone('hand', [
        makeCard({ id: 20, name: 'Lightning Bolt' }),
        makeCard({ id: 21, name: 'Island' }),
        makeCard({ id: 22, name: 'Forest' }),
      ]),
      deck: hiddenZone('deck', 30),
      grave: publicZone('grave'),
      stack: publicZone('stack'),
      exile: publicZone('exile'),
    },
    counters: { 1: makeCounter({ id: 1, name: 'Life', count: 20 }) },
    arrows: {
      1: makeArrow({
        id: 1, startPlayerId: ALICE, startZone: 'table', startCardId: 10,
        targetPlayerId: BOB, targetZone: 'table', targetCardId: 30,
      }),
    },
  });
  const bob = makePlayerEntry({
    properties: props(BOB, 'Bob'),
    zones: {
      table: table([makeCard({ id: 30, name: 'Gray Ogre', x: 0 })]),
      hand: hiddenZone('hand', 7),
      deck: hiddenZone('deck', 40),
      grave: publicZone('grave'),
    },
    counters: { 1: makeCounter({ id: 1, name: 'Life', count: 20 }) },
    arrows: {
      2: makeArrow({
        id: 2, startPlayerId: BOB, startZone: 'table', startCardId: 30,
        targetPlayerId: ALICE, targetZone: 'table', targetCardId: 10,
      }),
    },
  });
  return makeState({
    games: {
      1: makeGameEntry({
        started: true,
        activePlayerId: ALICE,
        activePhase: 2,
        localPlayerId: ALICE,
        players: { [ALICE]: alice, [BOB]: bob },
      }),
    },
  });
}

type Recorded = Record<string, unknown> | string;

const CARD_DEFAULTS = create(ServerInfo_CardSchema) as unknown as Record<string, unknown>;

function describeCard(card: ServerInfo_Card): string {
  const parts = [`#${card.id} ${card.name}`.trim()];
  for (const [key, value] of Object.entries(card)) {
    const isPosition = key === 'x' || key === 'y';
    if (key === '$typeName' || key === 'id' || key === 'name' || (!isPosition && value === CARD_DEFAULTS[key])) {
      continue;
    }
    if (key === 'counterList') {
      const counters = (value as ServerInfo_Card['counterList']).map((c) => `${c.id}:${c.value}`);
      if (counters.length) {
        parts.push(`counters=${counters.join(',')}`);
      }
    } else if (value === true) {
      parts.push(key);
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.join(' ');
}

function isCard(value: unknown): value is ServerInfo_Card {
  return !!value && typeof value === 'object' && (value as { $typeName?: string }).$typeName === 'ServerInfo_Card';
}

function compact(value: unknown): unknown {
  if (isCard(value)) {
    return describeCard(value);
  }
  if (Array.isArray(value)) {
    return value.map(compact);
  }
  if (value && typeof value === 'object') {
    if ('segments' in value && 'text' in value) {
      return (value as { text: string }).text;
    }
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
      if (key === '$typeName' || key === 'gameId' || key === 'timeReceived' || field === undefined) {
        continue;
      }
      out[key] = compact(field);
    }
    return out;
  }
  return value;
}

function describeAction(action: UnknownAction): Recorded {
  const type = action.type.replace(/^games\//, '');
  const payload = compact(action.payload ?? {}) as Record<string, unknown>;
  return Object.keys(payload).length ? { [type]: payload } : type;
}

function makeRecordingStore(state: GamesState) {
  const mw = createListenerMiddleware();
  registerGameListeners(mw);
  const recorded: Recorded[] = [];
  const recorder: Middleware = () => (next) => (action) => {
    recorded.push(describeAction(action as UnknownAction));
    return next(action);
  };
  const store = configureStore({
    preloadedState: { games: state },
    reducer: { games: gamesReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
      .prepend(recorder, mw.middleware),
  });
  return {
    store,
    play(action: UnknownAction): Recorded[] {
      recorded.length = 0;
      store.dispatch(action);
      return [action.type.replace(/^games\//, ''), ...recorded.slice(1)];
    },
    games(): GamesState {
      return store.getState().games;
    },
  };
}

function move(init: MessageInitShape<typeof Event_MoveCardSchema>) {
  return create(Event_MoveCardSchema, {
    cardId: -1, cardName: '', startPlayerId: ALICE, startZone: 'hand', position: -1,
    targetPlayerId: ALICE, targetZone: '', x: 0, y: 0, newCardId: -1, faceDown: false,
    ...init,
  });
}

describe('game listeners: recorder', () => {
  it.each([
    ['untap', { tapped: false }],
    ['clear annotation', { annotation: '' }],
    ['remove counters', { counterList: [] }],
  ])('distinguishes %s from an omitted patch field', (_label, fields) => {
    const payload = { gameId: 1, playerId: ALICE, zoneName: 'table', cardId: 10 };
    const recorded = describeAction(Actions.cardFieldsUpdated({ ...payload, fields }));

    expect(recorded).toEqual({
      cardFieldsUpdated: { playerId: ALICE, zoneName: 'table', cardId: 10, fields },
    });
    expect(recorded).not.toEqual(describeAction(Actions.cardFieldsUpdated({ ...payload, fields: {} })));
  });
});

describe('game listeners: registration', () => {
  it('registers exactly one listener for each inbound game event', () => {
    const types: string[] = [];
    const mw = {
      startListening: ({ actionCreator }: { actionCreator: { type: string } }) => {
        types.push(actionCreator.type);
        return () => {};
      },
    } as unknown as ListenerMiddlewareInstance<unknown>;

    registerGameListeners(mw);

    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual([
      'games/activePhaseSet',
      'games/activePlayerSet',
      'games/arrowCreated',
      'games/cardAttached',
      'games/cardAttrChanged',
      'games/cardCounterChanged',
      'games/cardDestroyed',
      'games/cardFlipped',
      'games/cardMoved',
      'games/cardsDrawn',
      'games/cardsRevealed',
      'games/counterSet',
      'games/gameStateChanged',
      'games/playerJoined',
      'games/playerLeft',
      'games/playerPropertiesChanged',
      'games/tokenCreated',
      'games/turnReversed',
    ]);
  });
});

describe('game listeners: scripted event stream', () => {
  it('records the dispatched action sequence for every listener, in stream order', () => {
    const state = scriptedState();
    state.games[1].players[BOB].arrows[4] = makeArrow({
      id: 4, startPlayerId: BOB, startZone: 'table', startCardId: 30,
      targetPlayerId: ALICE, targetZone: 'table', targetCardId: 11,
    });
    const { play } = makeRecordingStore(state);
    const stream: Array<[string, UnknownAction]> = [
      ['hand → stack', Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 20, startZone: 'hand', targetZone: 'stack', x: 0 }),
      })],
      ['table → grave sweeps arrows and resets state', Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 10, startZone: 'table', targetZone: 'grave', x: 0 }),
      })],
      ['hidden opponent hand → deck', Actions.cardMoved({
        gameId: 1, playerId: BOB,
        data: move({ startPlayerId: BOB, startZone: 'hand', targetPlayerId: BOB, targetZone: 'deck' }),
      })],
      ['same-zone hand reorder', Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 21, startZone: 'hand', targetZone: 'hand', x: 1 }),
      })],
      ['cross-player table → table with a new id', Actions.cardMoved({
        gameId: 1, playerId: BOB,
        data: move({
          cardId: 30, startPlayerId: BOB, startZone: 'table',
          targetPlayerId: ALICE, targetZone: 'table', x: 6, newCardId: 40,
        }),
      })],
      ['undo draw of a known card', Actions.cardMoved({
        gameId: 1, playerId: ALICE, isUndoDraw: true,
        data: move({ cardId: 22, startZone: 'hand', targetZone: 'deck', x: 0 }),
      })],
      ['game state changed', Actions.gameStateChanged({
        gameId: 1,
        data: create(Event_GameStateChangedSchema, { activePhase: 4, secondsElapsed: 90 }),
      })],
      ['tap one card', Actions.cardAttrChanged({
        gameId: 1, playerId: ALICE,
        data: create(Event_SetCardAttrSchema, {
          zoneName: 'table', cardId: 40, attribute: CardAttribute.AttrTapped, attrValue: '1',
        }),
      })],
      ['untap the zone (no card id)', Actions.cardAttrChanged({
        gameId: 1, playerId: ALICE,
        data: create(Event_SetCardAttrSchema, {
          zoneName: 'table', attribute: CardAttribute.AttrTapped, attrValue: '0',
        }),
      })],
      ['add a card counter', Actions.cardCounterChanged({
        gameId: 1, playerId: ALICE,
        data: create(Event_SetCardCounterSchema, { zoneName: 'table', cardId: 40, counterId: 1, counterValue: 2 }),
      })],
      ['remove a card counter', Actions.cardCounterChanged({
        gameId: 1, playerId: ALICE,
        data: create(Event_SetCardCounterSchema, { zoneName: 'table', cardId: 40, counterId: 1, counterValue: 0 }),
      })],
      ['opponent reveals their hand to us', Actions.cardsRevealed({
        gameId: 1, playerId: BOB,
        data: create(Event_RevealCardsSchema, {
          zoneName: 'hand', cardId: [-1], otherPlayerId: ALICE,
          cards: [{ id: 5, name: 'Shock' }],
        }),
      })],
      ['attach', Actions.cardAttached({
        gameId: 1, playerId: ALICE,
        data: create(Event_AttachCardSchema, {
          startZone: 'table', cardId: 11, targetPlayerId: ALICE, targetZone: 'table', targetCardId: 40,
        }),
      })],
      ['unattach', Actions.cardAttached({
        gameId: 1, playerId: ALICE,
        data: create(Event_AttachCardSchema, { startZone: 'table', cardId: 11 }),
      })],
      ['own draw', Actions.cardsDrawn({
        gameId: 1, playerId: ALICE,
        data: create(Event_DrawCardsSchema, { number: 2, cards: [{ id: 50, name: 'Swamp' }, { id: 51, name: 'Plains' }] }),
      })],
      ['opponent draw', Actions.cardsDrawn({
        gameId: 1, playerId: BOB,
        data: create(Event_DrawCardsSchema, { number: 1 }),
      })],
      ['player concedes', Actions.playerPropertiesChanged({
        gameId: 1, playerId: BOB,
        properties: makePlayerProperties({ playerId: BOB, conceded: true }),
      })],
      ['token created', Actions.tokenCreated({
        gameId: 1, playerId: ALICE,
        data: create(Event_CreateTokenSchema, {
          zoneName: 'table', cardId: 60, cardName: 'Soldier', color: 'w', pt: '1/1', x: 9, y: 0,
        }),
      })],
      ['card destroyed', Actions.cardDestroyed({
        gameId: 1, playerId: ALICE,
        data: create(Event_DestroyCardSchema, { zoneName: 'table', cardId: 60 }),
      })],
      ['card flipped face down', Actions.cardFlipped({
        gameId: 1, playerId: ALICE,
        data: create(Event_FlipCardSchema, { zoneName: 'table', cardId: 40, faceDown: true }),
      })],
      ['life counter set', Actions.counterSet({
        gameId: 1, playerId: ALICE,
        data: create(Event_SetCounterSchema, { counterId: 1, value: 17 }),
      })],
      ['arrow created', Actions.arrowCreated({
        gameId: 1, playerId: ALICE,
        data: create(Event_CreateArrowSchema, {
          arrowInfo: create(ServerInfo_ArrowSchema, {
            id: 3, startPlayerId: ALICE, startZone: 'table', startCardId: 40,
            targetPlayerId: BOB, targetZone: '', targetCardId: -1,
          }),
        }),
      })],
      ['active player set', Actions.activePlayerSet({ gameId: 1, activePlayerId: BOB })],
      ['active phase set', Actions.activePhaseSet({ gameId: 1, phase: 5 })],
      ['turn reversed', Actions.turnReversed({ gameId: 1, reversed: true, playerId: 2 })],
      ['spectator joins', Actions.playerJoined({
        gameId: 1, playerProperties: makePlayerProperties({ playerId: 3, spectator: true, userInfo: user('Carol') }),
      })],
      ['spectator leaves', Actions.playerLeft({ gameId: 1, playerId: 3, reason: 1, timeReceived: 0 })],
    ];

    const recording = stream.map(([label, action]) => [label, play(action)]);

    expect(recording).toMatchInlineSnapshot(`
      [
        [
          "hand → stack",
          [
            "cardMoved",
            {
              "cardMovedBetweenZones": {
                "card": "#20 Lightning Bolt x=0 y=0",
                "fromCardId": 20,
                "fromPlayerId": 1,
                "fromZone": "hand",
                "toPlayerId": 1,
                "toZone": "stack",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice plays Lightning Bolt from their hand.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "table → grave sweeps arrows and resets state",
          [
            "cardMoved",
            {
              "cardMovedBetweenZones": {
                "card": "#10 Grizzly Bears x=0 y=0",
                "fromCardId": 10,
                "fromPlayerId": 1,
                "fromZone": "table",
                "toPlayerId": 1,
                "toZone": "grave",
              },
            },
            {
              "arrowDeleted": {
                "data": {
                  "arrowId": 1,
                },
                "playerId": 1,
              },
            },
            {
              "arrowDeleted": {
                "data": {
                  "arrowId": 2,
                },
                "playerId": 2,
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice puts Grizzly Bears from play into their graveyard.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "hidden opponent hand → deck",
          [
            "cardMoved",
            {
              "zoneCardCountAdjusted": {
                "delta": -1,
                "playerId": 2,
                "zoneName": "hand",
              },
            },
            {
              "zoneCardCountAdjusted": {
                "delta": 1,
                "playerId": 2,
                "zoneName": "deck",
              },
            },
          ],
        ],
        [
          "same-zone hand reorder",
          [
            "cardMoved",
            {
              "cardMovedInSameZone": {
                "card": "#21 Island x=1 y=0",
                "cardId": 21,
                "playerId": 1,
                "toIndex": 1,
                "zoneName": "hand",
              },
            },
          ],
        ],
        [
          "cross-player table → table with a new id",
          [
            "cardMoved",
            {
              "cardMovedBetweenZones": {
                "card": "#40 Gray Ogre x=6 y=0",
                "fromCardId": 30,
                "fromPlayerId": 2,
                "fromZone": "table",
                "toPlayerId": 1,
                "toZone": "table",
              },
            },
            {
              "arrowDeleted": {
                "data": {
                  "arrowId": 4,
                },
                "playerId": 2,
              },
            },
            {
              "cardAttachmentReparented": {
                "fromCardId": 30,
                "fromPlayerId": 2,
                "toCardId": 40,
                "toPlayerId": 1,
              },
            },
            {
              "gameMessageAppended": {
                "message": "Bob gives Alice control over Gray Ogre.",
                "playerId": 2,
              },
            },
          ],
        ],
        [
          "undo draw of a known card",
          [
            "cardMoved",
            {
              "cardMovedBetweenZones": {
                "card": "#22 Forest x=0 y=0",
                "fromCardId": 22,
                "fromPlayerId": 1,
                "fromZone": "hand",
                "toPlayerId": 1,
                "toZone": "deck",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice undoes their last draw (Forest).",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "game state changed",
          [
            "gameStateChanged",
            {
              "gameInfoUpdated": {
                "activePhase": 4,
                "secondsElapsed": 90,
              },
            },
          ],
        ],
        [
          "tap one card",
          [
            "cardAttrChanged",
            {
              "cardFieldsUpdated": {
                "cardId": 40,
                "fields": {
                  "tapped": true,
                },
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice taps Gray Ogre.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "untap the zone (no card id)",
          [
            "cardAttrChanged",
            {
              "cardFieldsUpdatedBulk": {
                "fields": {
                  "tapped": false,
                },
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice untaps their permanents.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "add a card counter",
          [
            "cardCounterChanged",
            {
              "cardFieldsUpdated": {
                "cardId": 40,
                "fields": {
                  "counterList": [
                    {
                      "id": 1,
                      "value": 2,
                    },
                  ],
                },
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice places 2 counter(s) on Gray Ogre (now 2).",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "remove a card counter",
          [
            "cardCounterChanged",
            {
              "cardFieldsUpdated": {
                "cardId": 40,
                "fields": {
                  "counterList": [],
                },
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice removes 2 counter(s) from Gray Ogre (now 0).",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "opponent reveals their hand to us",
          [
            "cardsRevealed",
            {
              "zoneViewRevealed": {
                "cards": [
                  "#5 Shock",
                ],
                "isReversed": false,
                "playerId": 2,
                "zoneName": "hand",
              },
            },
            {
              "incomingRevealShown": {
                "cards": [
                  "#5 Shock",
                ],
                "grantWriteAccess": false,
                "sourceOwnerId": 2,
                "zoneName": "hand",
              },
            },
          ],
        ],
        [
          "attach",
          [
            "cardAttached",
            {
              "cardFieldsUpdated": {
                "cardId": 11,
                "fields": {
                  "attachCardId": 40,
                  "attachPlayerId": 1,
                  "attachZone": "table",
                },
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice attaches Bonesplitter to Alice's Gray Ogre.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "unattach",
          [
            "cardAttached",
            {
              "cardFieldsUpdated": {
                "cardId": 11,
                "fields": {
                  "attachCardId": -1,
                  "attachPlayerId": -1,
                  "attachZone": "",
                },
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice unattaches Bonesplitter.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "own draw",
          [
            "cardsDrawn",
            {
              "zoneCardCountAdjusted": {
                "delta": -2,
                "playerId": 1,
                "zoneName": "deck",
              },
            },
            {
              "topRevealedCardCleared": {
                "playerId": 1,
                "zoneName": "deck",
              },
            },
            {
              "cardInsertedIntoZone": {
                "card": "#50 Swamp",
                "playerId": 1,
                "zoneName": "hand",
              },
            },
            {
              "cardInsertedIntoZone": {
                "card": "#51 Plains",
                "playerId": 1,
                "zoneName": "hand",
              },
            },
            {
              "drawBeaconBumped": {
                "count": 2,
                "playerId": 1,
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice draws 2 cards.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "opponent draw",
          [
            "cardsDrawn",
            {
              "zoneCardCountAdjusted": {
                "delta": -1,
                "playerId": 2,
                "zoneName": "deck",
              },
            },
            {
              "topRevealedCardCleared": {
                "playerId": 2,
                "zoneName": "deck",
              },
            },
            {
              "zoneCardCountAdjusted": {
                "delta": 1,
                "playerId": 2,
                "zoneName": "hand",
              },
            },
            {
              "drawBeaconBumped": {
                "count": 1,
                "playerId": 2,
              },
            },
            {
              "gameMessageAppended": {
                "message": "Bob draws 1 card.",
                "playerId": 2,
              },
            },
          ],
        ],
        [
          "player concedes",
          [
            "playerPropertiesChanged",
            {
              "playerPropertiesUpdated": {
                "playerId": 2,
                "properties": {
                  "conceded": true,
                  "deckHash": "",
                  "judge": false,
                  "pingSeconds": 0,
                  "playerId": 2,
                  "readyStart": false,
                  "sideboardLocked": false,
                  "spectator": false,
                },
              },
            },
            {
              "gameMessageAppended": {
                "message": "Bob has conceded the game.",
                "playerId": 2,
              },
            },
          ],
        ],
        [
          "token created",
          [
            "tokenCreated",
            {
              "cardInsertedIntoZone": {
                "card": "#60 Soldier x=9 y=0 color=w pt=1/1",
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice creates token: Soldier (1/1).",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "card destroyed",
          [
            "cardDestroyed",
            {
              "cardRemovedFromZone": {
                "cardId": 60,
                "playerId": 1,
                "zoneName": "table",
              },
            },
            {
              "gameMessageAppended": {
                "message": "Alice destroys Soldier.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "card flipped face down",
          [
            "cardFlipped",
            {
              "gameMessageAppended": {
                "message": "Alice turns Gray Ogre face-down.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "life counter set",
          [
            "counterSet",
            {
              "gameMessageAppended": {
                "message": "Alice sets counter Life to 17 (-3).",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "arrow created",
          [
            "arrowCreated",
            {
              "gameMessageAppended": {
                "message": "Alice points from their Gray Ogre to Bob.",
                "playerId": 1,
              },
            },
          ],
        ],
        [
          "active player set",
          [
            "activePlayerSet",
            {
              "gameMessageAppended": {
                "message": "Bob's turn.",
                "playerId": 2,
              },
            },
          ],
        ],
        [
          "active phase set",
          [
            "activePhaseSet",
            {
              "gameMessageAppended": {
                "message": "It is now the declare attackers step.",
                "playerId": -1,
              },
            },
          ],
        ],
        [
          "turn reversed",
          [
            "turnReversed",
            {
              "gameMessageAppended": {
                "message": "Bob reversed turn order, now it's reversed.",
                "playerId": 2,
              },
            },
          ],
        ],
        [
          "spectator joins",
          [
            "playerJoined",
            {
              "gameMessageAppended": {
                "message": "Carol has joined the game.",
                "playerId": 3,
              },
            },
          ],
        ],
        [
          "spectator leaves",
          [
            "playerLeft",
            {
              "gameMessageAppended": {
                "message": "Carol has left the game (reason unknown).",
                "playerId": 3,
              },
            },
          ],
        ],
      ]
    `);
  });
});

describe('game listeners: branch recordings', () => {
  function game(state: GamesState) {
    return state.games[1];
  }

  describe('cardMoved', () => {
    afterEach(() => {
      consumeOptimistic(moveOpKey(ALICE, 10));
      consumeOptimistic(moveOpKey(ALICE, 20));
      consumeOptimistic(moveOpKey(ALICE, 21));
    });

    it('migrates an optimistic cross-player move to the server id, keeping client-only fields', () => {
      const state = scriptedState();
      const bears = game(state).players[ALICE].zones.table.byId[10];
      game(state).players[ALICE].zones.table = table([]);
      game(state).players[BOB].zones.table = table([
        makeCard({ id: 30, name: 'Gray Ogre', x: 0 }),
        makeCard({ ...bears, x: 3, annotation: 'Owner: Alice' }),
      ]);
      beginOptimistic(moveOpKey(ALICE, 10), () => {});
      const { play, games } = makeRecordingStore(state);

      const recorded = play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({
          cardId: 10, startZone: 'table', targetPlayerId: BOB, targetZone: 'table', x: 4, newCardId: 70,
        }),
      }));

      expect(recorded).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "cardRemovedFromZone": {
              "cardId": 10,
              "playerId": 2,
              "zoneName": "table",
            },
          },
          {
            "cardInsertedIntoZone": {
              "card": "#70 Grizzly Bears x=4 y=0 annotation=Owner: Alice",
              "playerId": 2,
              "zoneName": "table",
            },
          },
          {
            "arrowDeleted": {
              "data": {
                "arrowId": 1,
              },
              "playerId": 1,
            },
          },
          {
            "arrowDeleted": {
              "data": {
                "arrowId": 2,
              },
              "playerId": 2,
            },
          },
          {
            "cardAttachmentReparented": {
              "fromCardId": 10,
              "fromPlayerId": 1,
              "toCardId": 70,
              "toPlayerId": 2,
            },
          },
          {
            "gameMessageAppended": {
              "message": "Alice gives Bob control over a card.",
              "playerId": 1,
            },
          },
        ]
      `);
      const migrated = games().games[1].players[BOB].zones.table.byId[70];
      expect(migrated.annotation).toBe('Owner: Alice');
      expect(games().games[1].players[BOB].zones.table.byId[10]).toBeUndefined();
    });

    it('patches the server-corrected position of an optimistic move in place', () => {
      const state = scriptedState();
      game(state).players[ALICE].zones.hand = publicZone('hand', [makeCard({ id: 21, name: 'Island' })]);
      game(state).players[ALICE].zones.table = table([
        makeCard({ id: 10, name: 'Grizzly Bears', x: 0 }),
        makeCard({ id: 20, name: 'Lightning Bolt', x: 0 }),
      ]);
      beginOptimistic(moveOpKey(ALICE, 20), () => {});
      const { play } = makeRecordingStore(state);

      expect(play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 20, startZone: 'hand', targetZone: 'table', x: 1 }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "cardFieldsUpdated": {
              "cardId": 20,
              "fields": {
                "faceDown": false,
                "x": 1,
                "y": 0,
              },
              "playerId": 1,
              "zoneName": "table",
            },
          },
          {
            "gameMessageAppended": {
              "message": "Alice puts a card into play from their hand.",
              "playerId": 1,
            },
          },
        ]
      `);
    });

    it('consumes the optimistic marker of a same-zone reorder and still re-applies it', () => {
      beginOptimistic(moveOpKey(ALICE, 21), () => {});
      const { play } = makeRecordingStore(scriptedState());

      expect(play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 21, startZone: 'hand', targetZone: 'hand', x: 0 }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "cardMovedInSameZone": {
              "card": "#21 Island x=0 y=0",
              "cardId": 21,
              "playerId": 1,
              "toIndex": 0,
              "zoneName": "hand",
            },
          },
        ]
      `);
      expect(consumeOptimistic(moveOpKey(ALICE, 21))).toBe(false);
    });

    it.each([ZoneName.HAND, ZoneName.STACK, ZoneName.GRAVE, ZoneName.EXILE])('reorders %s in place', (zoneName) => {
      const state = scriptedState();
      game(state).players[ALICE].zones[zoneName] = publicZone(zoneName, [
        makeCard({ id: 20, name: 'Lightning Bolt' }),
        makeCard({ id: 21, name: 'Island' }),
      ]);
      beginOptimistic(moveOpKey(ALICE, 21), () => {});
      const { play, games } = makeRecordingStore(state);

      const recorded = play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 21, startZone: zoneName, targetZone: zoneName, x: 0 }),
      }));

      expect(recorded[1]).toEqual({
        cardMovedInSameZone: { card: '#21 Island x=0 y=0', cardId: 21, playerId: ALICE, toIndex: 0, zoneName },
      });
      expect(recorded).not.toContainEqual(expect.objectContaining({ cardMovedBetweenZones: expect.anything() }));
      expect(consumeOptimistic(moveOpKey(ALICE, 21))).toBe(false);
      expect(games().games[1].players[ALICE].zones[zoneName].order).toEqual([21, 20]);
    });

    it('logs an undo draw of a hidden card before returning', () => {
      const { play } = makeRecordingStore(scriptedState());

      expect(play(Actions.cardMoved({
        gameId: 1, playerId: BOB, isUndoDraw: true,
        data: move({ startPlayerId: BOB, startZone: 'hand', targetPlayerId: BOB, targetZone: 'deck' }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "zoneCardCountAdjusted": {
              "delta": -1,
              "playerId": 2,
              "zoneName": "hand",
            },
          },
          {
            "zoneCardCountAdjusted": {
              "delta": 1,
              "playerId": 2,
              "zoneName": "deck",
            },
          },
          {
            "gameMessageAppended": {
              "message": "Bob undoes their last draw.",
              "playerId": 2,
            },
          },
        ]
      `);
    });

    it('splices a hidden card inside an open library view without logging', () => {
      const state = scriptedState();
      game(state).players[ALICE].zones.deck = makeZoneEntry({
        name: 'deck', type: 2, cardCount: 30,
        revealedCards: [makeCard({ id: 100, name: 'Opt' }), makeCard({ id: 101, name: 'Ponder' })],
      });
      const { play } = makeRecordingStore(state);

      expect(play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ startZone: 'deck', targetZone: 'deck', position: 5, x: 0 }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "zoneViewCardReordered": {
              "fromPosition": 5,
              "playerId": 1,
              "toPosition": 0,
              "zoneName": "deck",
            },
          },
        ]
      `);
    });

    it('keeps an open library view in sync when its top card leaves and another arrives', () => {
      const state = scriptedState();
      game(state).players[ALICE].zones.deck = makeZoneEntry({
        name: 'deck', type: 2, cardCount: 30,
        revealedCards: [makeCard({ id: 100, name: 'Opt' }), makeCard({ id: 101, name: 'Ponder' })],
      });
      const { play } = makeRecordingStore(state);

      expect(play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 100, cardName: 'Opt', startZone: 'deck', position: 0, targetZone: 'hand', x: -1 }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "cardMovedBetweenZones": {
              "card": "#100 Opt x=-1 y=0",
              "fromCardId": 100,
              "fromPlayerId": 1,
              "fromZone": "deck",
              "toPlayerId": 1,
              "toZone": "hand",
            },
          },
          {
            "zoneViewCardRemoved": {
              "playerId": 1,
              "position": 0,
              "zoneName": "deck",
            },
          },
          {
            "topRevealedCardCleared": {
              "playerId": 1,
              "zoneName": "deck",
            },
          },
          {
            "gameMessageAppended": {
              "message": "Alice moves Opt from the top of their library to their hand.",
              "playerId": 1,
            },
          },
        ]
      `);
      expect(play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 21, startZone: 'hand', targetZone: 'deck', x: 1 }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "cardMovedBetweenZones": {
              "card": "#21 Island x=1 y=0",
              "fromCardId": 21,
              "fromPlayerId": 1,
              "fromZone": "hand",
              "toPlayerId": 1,
              "toZone": "deck",
            },
          },
          {
            "zoneViewCardInserted": {
              "card": "#21 Island x=1 y=0",
              "playerId": 1,
              "position": 1,
              "zoneName": "deck",
            },
          },
          {
            "gameMessageAppended": {
              "message": "Alice puts Island from their hand into their library 2 cards from the top.",
              "playerId": 1,
            },
          },
        ]
      `);
      expect(play(Actions.cardMoved({
        gameId: 1, playerId: ALICE,
        data: move({ cardId: 101, startZone: 'deck', position: 1, targetZone: 'deck', x: 0 }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
          {
            "zoneViewCardReordered": {
              "fromPosition": 1,
              "playerId": 1,
              "toPosition": 0,
              "zoneName": "deck",
            },
          },
          {
            "gameMessageAppended": {
              "message": "Alice puts a card from their library on top of their library.",
              "playerId": 1,
            },
          },
        ]
      `);
    });

    it('ignores a move whose source or target zone is unknown', () => {
      const { play } = makeRecordingStore(scriptedState());

      expect(play(Actions.cardMoved({
        gameId: 1, playerId: BOB,
        data: move({ cardId: 30, startPlayerId: BOB, startZone: 'table', targetPlayerId: BOB, targetZone: 'exile' }),
      }))).toMatchInlineSnapshot(`
        [
          "cardMoved",
        ]
      `);
    });
  });

  describe('gameStateChanged', () => {
    it('carries userInfo and open library views across a resync and logs the game start', () => {
      const state = scriptedState();
      game(state).started = false;
      game(state).players[ALICE].zones.deck = makeZoneEntry({
        name: 'deck', type: 2, cardCount: 30, revealedCards: [makeCard({ id: 100, name: 'Opt' })],
      });
      const { play, games } = makeRecordingStore(state);

      const recorded = play(Actions.gameStateChanged({
        gameId: 1,
        data: create(Event_GameStateChangedSchema, {
          gameStarted: true,
          activePlayerId: BOB,
          playerList: [
            create(ServerInfo_PlayerSchema, {
              properties: makePlayerProperties({ playerId: BOB }),
              zoneList: [create(ServerInfo_ZoneSchema, { name: 'deck', type: 2, cardCount: 40 })],
            }),
            create(ServerInfo_PlayerSchema, {
              properties: makePlayerProperties({ playerId: ALICE }),
              zoneList: [create(ServerInfo_ZoneSchema, { name: 'deck', type: 2, cardCount: 30 })],
            }),
          ],
        }),
      }));

      expect(recorded.map((entry) => (typeof entry === 'string' ? entry : Object.keys(entry)[0]))).toEqual([
        'gameStateChanged', 'gamePlayersReplaced', 'gameInfoUpdated', 'gameMessageAppended',
      ]);
      expect(recorded.slice(2)).toMatchInlineSnapshot(`
        [
          {
            "gameInfoUpdated": {
              "activePlayerId": 2,
              "gameStarted": true,
            },
          },
          {
            "gameMessageAppended": {
              "message": "The game has started.",
              "playerId": -1,
            },
          },
        ]
      `);
      const players = games().games[1].players;
      expect(players[ALICE].properties.userInfo?.name).toBe('Alice');
      expect(players[BOB].properties.userInfo?.name).toBe('Bob');
      expect(players[ALICE].zones.deck.revealedCards?.map((c) => c.name)).toEqual(['Opt']);
      expect(games().games[1].seatOrder).toEqual([BOB, ALICE]);
    });

    it('dispatches nothing for an empty state change', () => {
      const { play } = makeRecordingStore(scriptedState());

      expect(play(Actions.gameStateChanged({
        gameId: 1, data: create(Event_GameStateChangedSchema, {}),
      }))).toHaveLength(1);
    });
  });

  describe('cardsRevealed', () => {
    it('stays silent for an auto top-card reveal', () => {
      const state = scriptedState();
      game(state).players[ALICE].zones.deck = makeZoneEntry({
        name: 'deck', type: 2, cardCount: 30, alwaysRevealTopCard: true,
      });
      const { play } = makeRecordingStore(state);

      expect(play(Actions.cardsRevealed({
        gameId: 1, playerId: ALICE,
        data: create(Event_RevealCardsSchema, { zoneName: 'deck', cardId: [0], cards: [{ id: 0, name: 'Opt' }] }),
      }))).toMatchInlineSnapshot(`
        [
          "cardsRevealed",
        ]
      `);
    });

    it('logs each peeked card and opens no dialog', () => {
      const { play } = makeRecordingStore(scriptedState());

      expect(play(Actions.cardsRevealed({
        gameId: 1, playerId: ALICE,
        data: create(Event_RevealCardsSchema, {
          zoneName: 'table', cardId: [40], otherPlayerId: ALICE,
          cards: [{ id: 40, name: 'Morph Target', faceDown: true }],
        }),
      }))).toMatchInlineSnapshot(`
        [
          "cardsRevealed",
          {
            "gameMessageAppended": {
              "message": "Alice peeks at face down card #40: Morph Target.",
              "playerId": 1,
            },
          },
        ]
      `);
    });

    it('logs a spectator-side reveal without seeding a view', () => {
      const { play } = makeRecordingStore(scriptedState());

      expect(play(Actions.cardsRevealed({
        gameId: 1, playerId: BOB,
        data: create(Event_RevealCardsSchema, { zoneName: 'hand', cardId: [-1], otherPlayerId: ALICE }),
      }))).toMatchInlineSnapshot(`
        [
          "cardsRevealed",
          {
            "gameMessageAppended": {
              "message": "Bob reveals 1 card(s) from the hand to Alice.",
              "playerId": 2,
            },
          },
        ]
      `);
    });

    it('seeds the zone view but skips the replay dialog only when requested', () => {
      const state = scriptedState();
      game(state).replay = true;
      const { play } = makeRecordingStore(state);

      expect(play(Actions.cardsRevealed({
        gameId: 1, playerId: BOB,
        replayOptions: { skipRevealWindow: true },
        data: create(Event_RevealCardsSchema, {
          zoneName: 'hand', cardId: [-1], otherPlayerId: ALICE, cards: [{ id: 5, name: 'Shock' }],
        }),
      }))).toMatchInlineSnapshot(`
        [
          "cardsRevealed",
          {
            "zoneViewRevealed": {
              "cards": [
                "#5 Shock",
              ],
              "isReversed": false,
              "playerId": 2,
              "zoneName": "hand",
            },
          },
        ]
      `);
    });

    it('seeds the zone view and opens the dialog during replay playback', () => {
      const state = scriptedState();
      game(state).replay = true;
      const { play } = makeRecordingStore(state);

      expect(play(Actions.cardsRevealed({
        gameId: 1, playerId: BOB,
        data: create(Event_RevealCardsSchema, {
          zoneName: 'hand', cardId: [-1], otherPlayerId: ALICE, cards: [{ id: 5, name: 'Shock' }],
        }),
      }))).toMatchInlineSnapshot(`
        [
          "cardsRevealed",
          {
            "zoneViewRevealed": {
              "cards": [
                "#5 Shock",
              ],
              "isReversed": false,
              "playerId": 2,
              "zoneName": "hand",
            },
          },
          {
            "incomingRevealShown": {
              "cards": [
                "#5 Shock",
              ],
              "grantWriteAccess": false,
              "sourceOwnerId": 2,
              "zoneName": "hand",
            },
          },
        ]
      `);
    });
  });

  describe('turn structure', () => {
    it('logs no turn or phase change before the game starts or when nothing changed', () => {
      const state = scriptedState();
      const { play } = makeRecordingStore(state);
      expect(play(Actions.activePlayerSet({ gameId: 1, activePlayerId: ALICE }))).toHaveLength(1);
      expect(play(Actions.activePhaseSet({ gameId: 1, phase: 2 }))).toHaveLength(1);

      const notStarted = scriptedState();
      game(notStarted).started = false;
      const pre = makeRecordingStore(notStarted);
      expect(pre.play(Actions.activePlayerSet({ gameId: 1, activePlayerId: BOB }))).toHaveLength(1);
      expect(pre.play(Actions.activePhaseSet({ gameId: 1, phase: 3 }))).toHaveLength(1);
    });
  });

  describe('players', () => {
    it('ignores a departure for an unknown player without changing state or logging', () => {
      const recording = makeRecordingStore(scriptedState());
      const before = recording.games();

      expect(recording.play(Actions.playerLeft({ gameId: 1, playerId: 9, reason: 3, timeReceived: 0 })))
        .toEqual(['playerLeft']);
      expect(recording.games()).toBe(before);
    });

    it.each([undefined, '', '  ', 'Alice'])('captures the stored departure name before deletion: %j', (name) => {
      const state = scriptedState();
      game(state).players[ALICE].properties.userInfo = name === undefined ? undefined : user(name);
      const recording = makeRecordingStore(state);
      const leave = Actions.playerLeft({ gameId: 1, playerId: ALICE, reason: 3, timeReceived: 0 });

      expect(recording.play(leave)).toEqual([
        'playerLeft',
        { gameMessageAppended: { playerId: ALICE, message: `${name ?? ''} has left the game (player left the game).` } },
      ]);
      expect(game(recording.games()).players[ALICE]).toBeUndefined();
      const after = recording.games();
      expect(recording.play(leave)).toEqual(['playerLeft']);
      expect(recording.games()).toBe(after);
    });
  });

  it('ignores every event for an unknown game', () => {
    const { play } = makeRecordingStore(scriptedState());
    const events: UnknownAction[] = [
      Actions.cardMoved({ gameId: 9, playerId: ALICE, data: move({ cardId: 20, targetZone: 'grave' }) }),
      Actions.gameStateChanged({ gameId: 9, data: create(Event_GameStateChangedSchema, { activePhase: 3 }) }),
      Actions.cardsDrawn({ gameId: 9, playerId: ALICE, data: create(Event_DrawCardsSchema, { number: 1 }) }),
      Actions.counterSet({ gameId: 9, playerId: ALICE, data: create(Event_SetCounterSchema, { counterId: 1, value: 3 }) }),
      Actions.playerLeft({ gameId: 9, playerId: ALICE, reason: 1, timeReceived: 0 }),
    ];

    for (const event of events) {
      expect(play(event)).toHaveLength(1);
    }
  });
});
