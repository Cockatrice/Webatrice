import { create } from '@bufbuild/protobuf';
import { Data } from '../../types';
import {
  formatLeaveMessage,
  MAX_GAME_MESSAGES,
  normalizePlayers,
  pushEventMessage,
} from './game.reducer.helpers';
import { makeCard, makeGameEntry, makePlayerProperties } from '../../testing/fixtures/games';

describe('formatLeaveMessage', () => {
  it('maps a known leave reason to its message', () => {
    expect(formatLeaveMessage('Alice', 2)).toBe('Alice has left the game (kicked by game host or moderator).');
    expect(formatLeaveMessage('Alice', 3)).toBe('Alice has left the game (player left the game).');
    expect(formatLeaveMessage('Alice', 4)).toBe('Alice has left the game (player disconnected from server).');
  });

  it('falls back to "reason unknown" for an unrecognized reason code', () => {
    expect(formatLeaveMessage('Bob', 999)).toBe('Bob has left the game (reason unknown).');
  });
});

describe('pushEventMessage', () => {
  it('no-ops when the message is null or empty', () => {
    const game = makeGameEntry({ messages: [] });
    pushEventMessage(game, 1, null);
    pushEventMessage(game, 1, undefined);
    pushEventMessage(game, 1, '');
    expect(game.messages).toHaveLength(0);
  });

  it('appends an event message with playerId, kind and a timestamp', () => {
    const game = makeGameEntry({ messages: [] });
    pushEventMessage(game, 3, 'Alice plays Bolt.');
    expect(game.messages).toHaveLength(1);
    expect(game.messages[0].message).toBe('Alice plays Bolt.');
    expect(game.messages[0].playerId).toBe(3);
    expect(game.messages[0].kind).toBe('event');
    expect(typeof game.messages[0].timeReceived).toBe('number');
  });

  it(`caps the log at MAX_GAME_MESSAGES (${MAX_GAME_MESSAGES})`, () => {
    const messages = Array.from({ length: MAX_GAME_MESSAGES }, (_, i) => ({
      playerId: 1,
      message: `msg-${i}`,
      timeReceived: i,
      kind: 'event' as const,
    }));
    const game = makeGameEntry({ messages });
    pushEventMessage(game, 1, 'overflow');
    expect(game.messages).toHaveLength(MAX_GAME_MESSAGES);
    expect(game.messages[MAX_GAME_MESSAGES - 1].message).toBe('overflow');
    expect(game.messages[0].message).not.toBe('msg-0');
  });
});

describe('normalizePlayers', () => {
  it('returns an empty map for an empty player list', () => {
    expect(normalizePlayers([])).toEqual({});
  });

  it('normalizes a player with empty zone/counter/arrow lists', () => {
    const player = create(Data.ServerInfo_PlayerSchema, {
      properties: makePlayerProperties({ playerId: 5 }),
      deckList: '',
      zoneList: [],
      counterList: [],
      arrowList: [],
    });
    const result = normalizePlayers([player]);
    expect(result[5]).toBeDefined();
    expect(result[5].zones).toEqual({});
    expect(result[5].counters).toEqual({});
    expect(result[5].arrows).toEqual({});
  });

  it('normalizes a populated zone with an empty card list', () => {
    const player = create(Data.ServerInfo_PlayerSchema, {
      properties: makePlayerProperties({ playerId: 2 }),
      deckList: '',
      zoneList: [
        {
          name: 'hand',
          type: 1,
          withCoords: false,
          cardCount: 0,
          cardList: [],
          alwaysRevealTopCard: false,
          alwaysLookAtTopCard: false,
        },
      ],
      counterList: [],
      arrowList: [],
    });
    const result = normalizePlayers([player]);
    expect(result[2].zones['hand'].order).toEqual([]);
    expect(result[2].zones['hand'].byId).toEqual({});
  });

  it('normalizes a zone with cards into order + byId maps', () => {
    const player = create(Data.ServerInfo_PlayerSchema, {
      properties: makePlayerProperties({ playerId: 1 }),
      deckList: '',
      zoneList: [
        {
          name: 'table',
          type: 2,
          withCoords: true,
          cardCount: 2,
          cardList: [makeCard({ id: 10, name: 'Bolt' }), makeCard({ id: 11, name: 'Bear' })],
          alwaysRevealTopCard: false,
          alwaysLookAtTopCard: false,
        },
      ],
      counterList: [],
      arrowList: [],
    });
    const result = normalizePlayers([player]);
    expect(result[1].zones['table'].order).toEqual([10, 11]);
    expect(result[1].zones['table'].byId[10].name).toBe('Bolt');
  });
});
