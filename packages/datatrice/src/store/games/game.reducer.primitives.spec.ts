import { create } from '@bufbuild/protobuf';
import { Data } from '../../types';
import { gamesReducer } from './game.reducer';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { MAX_GAME_MESSAGES } from './game.reducer.helpers';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeState,
  makeZoneEntry,
} from '../../testing/fixtures/games';

function cardsIn(state: GamesState, gameId: number, playerId: number, zoneName: string): Data.ServerInfo_Card[] {
  const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
  return zone ? zone.order.map(id => zone.byId[id]) : [];
}

describe('cardMovedBetweenZones', () => {
  it('removes from source, inserts into target, updates cardCount on both sides', () => {
    const card = makeCard({ id: 10 });
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

    const moved = makeCard({ id: 10, x: 4, y: 2 });
    const result = gamesReducer(state, Actions.cardMovedBetweenZones({
      gameId: 1,
      fromPlayerId: 1, fromZone: 'hand', fromCardId: 10,
      toPlayerId: 1, toZone: 'table', card: moved,
    }));

    expect(cardsIn(result, 1, 1, 'hand')).toHaveLength(0);
    expect(result.games[1].players[1].zones['hand'].cardCount).toBe(0);
    expect(cardsIn(result, 1, 1, 'table')[0].id).toBe(10);
    expect(result.games[1].players[1].zones['table'].cardCount).toBe(1);
  });

  it('hidden-zone path: fromCardId = -1 decrements cardCount without touching byId/order', () => {
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

    const revealed = makeCard({ id: 7, name: 'Revealed' });
    const result = gamesReducer(state, Actions.cardMovedBetweenZones({
      gameId: 1,
      fromPlayerId: 1, fromZone: 'deck', fromCardId: -1,
      toPlayerId: 1, toZone: 'hand', card: revealed,
    }));

    expect(result.games[1].players[1].zones['deck'].cardCount).toBe(4);
    expect(cardsIn(result, 1, 1, 'hand')[0].id).toBe(7);
  });

  it('clamps source cardCount at 0', () => {
    const card = makeCard({ id: 10 });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                hand: makeZoneEntry({ name: 'hand', cards: [card], cardCount: 0 }),
                table: makeZoneEntry({ name: 'table', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const result = gamesReducer(state, Actions.cardMovedBetweenZones({
      gameId: 1,
      fromPlayerId: 1, fromZone: 'hand', fromCardId: 10,
      toPlayerId: 1, toZone: 'table', card: makeCard({ id: 10 }),
    }));

    expect(result.games[1].players[1].zones['hand'].cardCount).toBe(0);
  });

  it('supports renumbering: fromCardId differs from card.id', () => {
    const original = makeCard({ id: 10, name: 'Old' });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [original], cardCount: 1 }),
              },
            }),
            2: makePlayerEntry({
              properties: makePlayerProperties({ playerId: 2 }),
              zones: {
                table: makeZoneEntry({ name: 'table', cardCount: 0 }),
              },
            }),
          },
        }),
      },
    });

    const renumbered = makeCard({ id: 99, name: 'Old' });
    const result = gamesReducer(state, Actions.cardMovedBetweenZones({
      gameId: 1,
      fromPlayerId: 1, fromZone: 'table', fromCardId: 10,
      toPlayerId: 2, toZone: 'table', card: renumbered,
    }));

    expect(cardsIn(result, 1, 1, 'table')).toHaveLength(0);
    expect(result.games[1].players[1].zones['table'].byId[10]).toBeUndefined();
    expect(cardsIn(result, 1, 2, 'table')[0].id).toBe(99);
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.cardMovedBetweenZones({
      gameId: 999,
      fromPlayerId: 1, fromZone: 'hand', fromCardId: 1,
      toPlayerId: 1, toZone: 'table', card: makeCard({ id: 1 }),
    }));
    expect(result).toBe(state);
  });

  it('no-ops when source zone is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.cardMovedBetweenZones({
      gameId: 1,
      fromPlayerId: 1, fromZone: 'nonexistent', fromCardId: 1,
      toPlayerId: 1, toZone: 'hand', card: makeCard({ id: 1 }),
    }));
    expect(result).toBe(state);
  });
});

describe('cardAttachmentReparented', () => {
  function makeStateWithAttachedChildren() {
    const parent = makeCard({ id: 10, name: 'Creature' });
    const auraSamePlayer = makeCard({
      id: 11, name: 'AuraA',
      attachPlayerId: 1, attachZone: 'table', attachCardId: 10,
    });
    const unrelated = makeCard({
      id: 12, name: 'Unrelated',
      attachPlayerId: 1, attachZone: 'table', attachCardId: 999,
    });
    const auraOtherPlayer = makeCard({
      id: 20, name: 'AuraB',
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
                  name: 'table', cards: [parent, auraSamePlayer, unrelated], cardCount: 3,
                }),
              },
            }),
            2: makePlayerEntry({
              properties: makePlayerProperties({ playerId: 2 }),
              zones: {
                table: makeZoneEntry({ name: 'table', cards: [auraOtherPlayer], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });
  }

  it('rewrites attach pointers on matching children across multiple players tables', () => {
    const state = makeStateWithAttachedChildren();
    const result = gamesReducer(state, Actions.cardAttachmentReparented({
      gameId: 1,
      fromPlayerId: 1, fromCardId: 10,
      toPlayerId: 2, toCardId: 99,
    }));

    const aura11 = result.games[1].players[1].zones['table'].byId[11];
    expect(aura11.attachPlayerId).toBe(2);
    expect(aura11.attachCardId).toBe(99);

    const aura20 = result.games[1].players[2].zones['table'].byId[20];
    expect(aura20.attachPlayerId).toBe(2);
    expect(aura20.attachCardId).toBe(99);
  });

  it('leaves unrelated children alone', () => {
    const state = makeStateWithAttachedChildren();
    const result = gamesReducer(state, Actions.cardAttachmentReparented({
      gameId: 1,
      fromPlayerId: 1, fromCardId: 10,
      toPlayerId: 2, toCardId: 99,
    }));

    const unrelated = result.games[1].players[1].zones['table'].byId[12];
    expect(unrelated.attachPlayerId).toBe(1);
    expect(unrelated.attachCardId).toBe(999);
  });

  it('no-op rewrite when fromCardId === toCardId and fromPlayerId === toPlayerId', () => {
    const state = makeStateWithAttachedChildren();
    const originalAura = state.games[1].players[1].zones['table'].byId[11];
    const result = gamesReducer(state, Actions.cardAttachmentReparented({
      gameId: 1,
      fromPlayerId: 1, fromCardId: 10,
      toPlayerId: 1, toCardId: 10,
    }));

    const nextAura = result.games[1].players[1].zones['table'].byId[11];
    expect(nextAura.attachPlayerId).toBe(1);
    expect(nextAura.attachCardId).toBe(10);
    // Object reference still gets rewritten (the reducer does not gate on
    // equality), but the resulting fields match the source.
    expect(nextAura).not.toBe(originalAura);
  });

  it('safe when a player has no table zone', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: { hand: makeZoneEntry({ name: 'hand', cardCount: 0 }) },
            }),
          },
        }),
      },
    });
    const result = gamesReducer(state, Actions.cardAttachmentReparented({
      gameId: 1,
      fromPlayerId: 1, fromCardId: 10,
      toPlayerId: 2, toCardId: 99,
    }));
    expect(result).toEqual(state);
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.cardAttachmentReparented({
      gameId: 999,
      fromPlayerId: 1, fromCardId: 10,
      toPlayerId: 2, toCardId: 99,
    }));
    expect(result).toBe(state);
  });
});

describe('gamePlayersReplaced', () => {
  it('assigns the players map wholesale', () => {
    const state = makeState();
    const replacement = {
      7: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 7, userInfo: { name: 'Alice' } }),
      }),
      8: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 8, userInfo: { name: 'Bob' } }),
      }),
    };
    const result = gamesReducer(state, Actions.gamePlayersReplaced({
      gameId: 1, players: replacement,
    }));
    expect(Object.keys(result.games[1].players)).toEqual(['7', '8']);
    expect(result.games[1].players[7].properties.userInfo?.name).toBe('Alice');
    expect(result.games[1].players[8].properties.userInfo?.name).toBe('Bob');
  });

  it('drops players not in the replacement map', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1 }) }),
            2: makePlayerEntry({ properties: makePlayerProperties({ playerId: 2 }) }),
          },
        }),
      },
    });
    const replacement = {
      1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1 }) }),
    };
    const result = gamesReducer(state, Actions.gamePlayersReplaced({
      gameId: 1, players: replacement,
    }));
    expect(result.games[1].players[2]).toBeUndefined();
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gamePlayersReplaced({
      gameId: 999, players: {},
    }));
    expect(result).toBe(state);
  });
});

describe('gameInfoUpdated', () => {
  it('sets every provided scalar field', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameInfoUpdated({
      gameId: 1, gameStarted: true, activePlayerId: 3, activePhase: 2, secondsElapsed: 60,
    }));
    expect(result.games[1].started).toBe(true);
    expect(result.games[1].activePlayerId).toBe(3);
    expect(result.games[1].activePhase).toBe(2);
    expect(result.games[1].secondsElapsed).toBe(60);
  });

  it('partial update leaves untouched fields alone', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          started: true, activePlayerId: 5, activePhase: 3, secondsElapsed: 99,
        }),
      },
    });
    const result = gamesReducer(state, Actions.gameInfoUpdated({
      gameId: 1, activePhase: 7,
    }));
    expect(result.games[1].started).toBe(true);
    expect(result.games[1].activePlayerId).toBe(5);
    expect(result.games[1].activePhase).toBe(7);
    expect(result.games[1].secondsElapsed).toBe(99);
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameInfoUpdated({
      gameId: 999, gameStarted: true,
    }));
    expect(result).toBe(state);
  });
});

describe('cardFieldsUpdated', () => {
  function stateWithCard(card: Data.ServerInfo_Card) {
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

  it('merges multiple fields onto the existing card and writes a fresh byId object', () => {
    const card = makeCard({ id: 5, tapped: false, color: '', pt: '' });
    const state = stateWithCard(card);
    const before = state.games[1].players[1].zones['table'].byId[5];
    const result = gamesReducer(state, Actions.cardFieldsUpdated({
      gameId: 1, playerId: 1, zoneName: 'table', cardId: 5,
      fields: { tapped: true, color: 'red', pt: '2/2' },
    }));
    const after = result.games[1].players[1].zones['table'].byId[5];
    expect(after.tapped).toBe(true);
    expect(after.color).toBe('red');
    expect(after.pt).toBe('2/2');
    // Structural sharing: byId[cardId] is a new object reference.
    expect(after).not.toBe(before);
  });

  it('produces a new zone reference (structural sharing flows up to the zone)', () => {
    const card = makeCard({ id: 5, tapped: false });
    const state = stateWithCard(card);
    const beforeZone = state.games[1].players[1].zones['table'];
    const result = gamesReducer(state, Actions.cardFieldsUpdated({
      gameId: 1, playerId: 1, zoneName: 'table', cardId: 5,
      fields: { tapped: true },
    }));
    expect(result.games[1].players[1].zones['table']).not.toBe(beforeZone);
  });

  it('no-ops when card is missing (preserves state identity)', () => {
    const state = stateWithCard(makeCard({ id: 5 }));
    const result = gamesReducer(state, Actions.cardFieldsUpdated({
      gameId: 1, playerId: 1, zoneName: 'table', cardId: 9999,
      fields: { tapped: true },
    }));
    expect(result).toBe(state);
  });

  it('no-ops when zone is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.cardFieldsUpdated({
      gameId: 1, playerId: 1, zoneName: 'nonexistent', cardId: 5,
      fields: { tapped: true },
    }));
    expect(result).toBe(state);
  });
});

describe('cardInsertedIntoZone', () => {
  function stateWithEmptyHand() {
    return makeState({
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
  }

  it('pushes card.id onto zone.order, assigns byId, increments cardCount', () => {
    const state = stateWithEmptyHand();
    const card = makeCard({ id: 42, name: 'Drawn' });
    const result = gamesReducer(state, Actions.cardInsertedIntoZone({
      gameId: 1, playerId: 1, zoneName: 'hand', card,
    }));
    const zone = result.games[1].players[1].zones['hand'];
    expect(zone.order).toEqual([42]);
    expect(zone.byId[42]).toEqual(card);
    expect(zone.cardCount).toBe(1);
  });

  it('appends to an existing zone without disturbing prior cards', () => {
    const existing = makeCard({ id: 7, name: 'Prior' });
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                hand: makeZoneEntry({ name: 'hand', cards: [existing], cardCount: 1 }),
              },
            }),
          },
        }),
      },
    });
    const inserted = makeCard({ id: 9, name: 'Next' });
    const result = gamesReducer(state, Actions.cardInsertedIntoZone({
      gameId: 1, playerId: 1, zoneName: 'hand', card: inserted,
    }));
    const zone = result.games[1].players[1].zones['hand'];
    expect(zone.order).toEqual([7, 9]);
    expect(zone.byId[7]).toEqual(existing);
    expect(zone.byId[9]).toEqual(inserted);
    expect(zone.cardCount).toBe(2);
  });

  it('no-ops when zone is missing (preserves state identity)', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.cardInsertedIntoZone({
      gameId: 1, playerId: 1, zoneName: 'nonexistent', card: makeCard({ id: 1 }),
    }));
    expect(result).toBe(state);
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.cardInsertedIntoZone({
      gameId: 999, playerId: 1, zoneName: 'hand', card: makeCard({ id: 1 }),
    }));
    expect(result).toBe(state);
  });
});

describe('cardRemovedFromZone', () => {
  function stateWithHand(cards: ReturnType<typeof makeCard>[], cardCount?: number) {
    return makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                hand: makeZoneEntry({
                  name: 'hand',
                  cards,
                  cardCount: cardCount ?? cards.length,
                }),
              },
            }),
          },
        }),
      },
    });
  }

  it('splices cardId out of order, deletes byId, decrements cardCount', () => {
    const a = makeCard({ id: 10, name: 'A' });
    const b = makeCard({ id: 20, name: 'B' });
    const state = stateWithHand([a, b]);
    const result = gamesReducer(state, Actions.cardRemovedFromZone({
      gameId: 1, playerId: 1, zoneName: 'hand', cardId: 10,
    }));
    const zone = result.games[1].players[1].zones['hand'];
    expect(zone.order).toEqual([20]);
    expect(zone.byId[10]).toBeUndefined();
    expect(zone.byId[20]).toEqual(b);
    expect(zone.cardCount).toBe(1);
  });

  it('no-ops when zone is missing (preserves state identity)', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.cardRemovedFromZone({
      gameId: 1, playerId: 1, zoneName: 'nonexistent', cardId: 1,
    }));
    expect(result).toBe(state);
  });

  it('clamps cardCount at 0 when already 0', () => {
    const state = stateWithHand([], 0);
    const result = gamesReducer(state, Actions.cardRemovedFromZone({
      gameId: 1, playerId: 1, zoneName: 'hand', cardId: 42,
    }));
    const zone = result.games[1].players[1].zones['hand'];
    expect(zone.order).toEqual([]);
    expect(zone.cardCount).toBe(0);
  });
});

describe('zoneCardCountAdjusted', () => {
  function stateWithDeck(cardCount: number) {
    return makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: {
                deck: makeZoneEntry({ name: 'deck', cards: [], cardCount }),
              },
            }),
          },
        }),
      },
    });
  }

  it('applies positive delta', () => {
    const state = stateWithDeck(5);
    const result = gamesReducer(state, Actions.zoneCardCountAdjusted({
      gameId: 1, playerId: 1, zoneName: 'deck', delta: 3,
    }));
    expect(result.games[1].players[1].zones['deck'].cardCount).toBe(8);
  });

  it('applies negative delta', () => {
    const state = stateWithDeck(10);
    const result = gamesReducer(state, Actions.zoneCardCountAdjusted({
      gameId: 1, playerId: 1, zoneName: 'deck', delta: -4,
    }));
    expect(result.games[1].players[1].zones['deck'].cardCount).toBe(6);
  });

  it('clamps at 0 when delta would drive cardCount negative', () => {
    const state = stateWithDeck(2);
    const result = gamesReducer(state, Actions.zoneCardCountAdjusted({
      gameId: 1, playerId: 1, zoneName: 'deck', delta: -10,
    }));
    expect(result.games[1].players[1].zones['deck'].cardCount).toBe(0);
  });

  it('no-ops when zone is missing (preserves state identity)', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.zoneCardCountAdjusted({
      gameId: 1, playerId: 1, zoneName: 'nonexistent', delta: 1,
    }));
    expect(result).toBe(state);
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.zoneCardCountAdjusted({
      gameId: 999, playerId: 1, zoneName: 'deck', delta: 1,
    }));
    expect(result).toBe(state);
  });
});

describe('playerPropertiesUpdated', () => {
  it('sparse merge: only set fields on the wire payload overwrite existing values', () => {
    // Regression mirror for the per-second ping tick — the desktop server
    // sends Event_PlayerPropertiesChanged with only ping_seconds populated;
    // mergeSetFields uses isFieldSet tracking bits to leave the deck hash,
    // ready flag, and sideboard lock untouched.
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
    const pingOnly = create(Data.ServerInfo_PlayerPropertiesSchema, { pingSeconds: 42 });
    const result = gamesReducer(state, Actions.playerPropertiesUpdated({
      gameId: 1, playerId: 1, properties: pingOnly,
    }));
    const merged = result.games[1].players[1].properties;
    expect(merged.pingSeconds).toBe(42);
    expect(merged.deckHash).toBe('abc123');
    expect(merged.readyStart).toBe(false);
    expect(merged.sideboardLocked).toBe(true);
  });

  it('no-ops when player is missing', () => {
    const state = makeState();
    const props = makePlayerProperties({ playerId: 999 });
    const result = gamesReducer(state, Actions.playerPropertiesUpdated({
      gameId: 1, playerId: 999, properties: props,
    }));
    expect(result).toBe(state);
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const props = makePlayerProperties({ playerId: 1 });
    const result = gamesReducer(state, Actions.playerPropertiesUpdated({
      gameId: 999, playerId: 1, properties: props,
    }));
    expect(result).toBe(state);
  });
});

describe('gameMessageAppended', () => {
  it('appends a message to game.messages', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameMessageAppended({
      gameId: 1, playerId: 1, message: 'Hello',
    }));
    const messages = result.games[1].messages;
    expect(messages[messages.length - 1].message).toBe('Hello');
    expect(messages[messages.length - 1].kind).toBe('event');
    expect(messages[messages.length - 1].playerId).toBe(1);
  });

  it('truncates the message log at MAX_GAME_MESSAGES', () => {
    const baseGame = makeGameEntry();
    const filledMessages = Array.from({ length: MAX_GAME_MESSAGES }, (_, i) => ({
      playerId: 1, message: `m${i}`, timeReceived: i, kind: 'event' as const,
    }));
    const state = makeState({
      games: { 1: { ...baseGame, messages: filledMessages } },
    });
    const result = gamesReducer(state, Actions.gameMessageAppended({
      gameId: 1, playerId: 1, message: 'overflow',
    }));
    expect(result.games[1].messages).toHaveLength(MAX_GAME_MESSAGES);
    expect(result.games[1].messages[MAX_GAME_MESSAGES - 1].message).toBe('overflow');
  });

  it('no-ops on empty message string', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameMessageAppended({
      gameId: 1, playerId: 1, message: '',
    }));
    expect(result.games[1].messages).toEqual(state.games[1].messages);
  });

  it('no-ops when game is missing', () => {
    const state = makeState();
    const result = gamesReducer(state, Actions.gameMessageAppended({
      gameId: 999, playerId: 1, message: 'hi',
    }));
    expect(result).toBe(state);
  });
});

