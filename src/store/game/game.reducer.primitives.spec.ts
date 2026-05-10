import { Data } from '@app/types';
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
} from './__mocks__/fixtures';

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

