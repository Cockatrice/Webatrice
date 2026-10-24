import { create } from '@bufbuild/protobuf';
import {
  CardAttribute,
  Event_AttachCardSchema,
  Event_CreateTokenSchema,
  Event_GameStateChangedSchema,
  ServerInfo_CardCounterSchema,
  ServerInfo_PlayerSchema,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import {
  buildTokenCard,
  cardAttachFields,
  cardAttrFields,
  carryForwardResyncState,
  gameInfoUpdateFrom,
  gameSecondsNow,
  MAX_GAME_MESSAGES,
  mergeCardCounter,
  normalizePlayers,
  pushEventMessage,
  resetCardState,
} from './game.reducer.helpers';
import { makeCard, makeGameEntry, makePlayerEntry, makePlayerProperties, makeZoneEntry } from '../../testing/fixtures/games';

describe('pushEventMessage', () => {
  it('stamps the event and its game seconds with the given time, not the wall clock', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(99_000);
    try {
      const game = makeGameEntry({ secondsElapsed: 42, secondsElapsedAt: 5_000, messages: [] });

      pushEventMessage(game, 7, 'A recorded event.', 8_900);

      expect(game.messages).toEqual([{
        playerId: 7,
        message: 'A recorded event.',
        segments: undefined,
        timeReceived: 8_900,
        gameSeconds: 45,
        kind: 'event',
      }]);
      expect(now.mock.calls).toEqual([]);
    } finally {
      now.mockRestore();
    }
  });

  it('no-ops when the message is null or empty', () => {
    const game = makeGameEntry({ messages: [] });
    pushEventMessage(game, 1, null, 1234);
    pushEventMessage(game, 1, undefined, 1234);
    pushEventMessage(game, 1, '', 1234);
    expect(game.messages).toHaveLength(0);
  });

  it('no-ops when a LogEntry with empty text is passed', () => {
    // `if (!text) return;` — accepts the LogEntry shape but bails
    // when the pre-computed text ended up empty (only whitespace-
    // stripped separator segments, or a format function that
    // returned an empty template).
    const game = makeGameEntry({ messages: [] });
    pushEventMessage(game, 1, { text: '', segments: [] }, 1234);
    expect(game.messages).toHaveLength(0);
  });

  it('appends a LogEntry with its segments preserved', () => {
    const game = makeGameEntry({ messages: [] });
    pushEventMessage(game, 2, {
      text: 'Alice plays Bolt.',
      segments: [{ text: 'Alice', kind: 'player' }, { text: ' plays Bolt.', kind: 'plain' }],
    }, 1234);
    expect(game.messages).toHaveLength(1);
    expect(game.messages[0].message).toBe('Alice plays Bolt.');
    expect(game.messages[0].segments).toEqual([
      { text: 'Alice', kind: 'player' },
      { text: ' plays Bolt.', kind: 'plain' },
    ]);
  });

  it('appends an event message with playerId, kind and a timestamp', () => {
    const game = makeGameEntry({ messages: [] });
    pushEventMessage(game, 3, 'Alice plays Bolt.', 1234);
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
    pushEventMessage(game, 1, 'overflow', 1234);
    expect(game.messages).toHaveLength(MAX_GAME_MESSAGES);
    expect(game.messages[MAX_GAME_MESSAGES - 1].message).toBe('overflow');
    expect(game.messages[0].message).not.toBe('msg-0');
  });
});

describe('gameSecondsNow', () => {
  it.each([
    { anchor: undefined, now: 8_900, expected: 42 },
    { anchor: 5_000, now: 8_900, expected: 45 },
    { anchor: 5_000, now: 4_000, expected: 42 },
    { anchor: 0, now: 1_900, expected: 43 },
  ])('returns $expected at $now with clock anchor $anchor', ({ anchor, now, expected }) => {
    const game = makeGameEntry({ secondsElapsed: 42, secondsElapsedAt: anchor });

    expect(gameSecondsNow(game, now)).toBe(expected);
  });
});

describe('normalizePlayers', () => {
  it('returns an empty map for an empty player list', () => {
    expect(normalizePlayers([])).toEqual({});
  });

  it('normalizes a player with empty zone/counter/arrow lists', () => {
    const player = create(ServerInfo_PlayerSchema, {
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
    const player = create(ServerInfo_PlayerSchema, {
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
    const player = create(ServerInfo_PlayerSchema, {
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

describe('resetCardState', () => {
  it('wipes every battlefield-only attribute (CardItem::resetState parity)', () => {
    const card = makeCard({
      id: 10,
      tapped: true,
      attacking: true,
      doesntUntap: true,
      pt: '5/5',
      color: 'r',
      annotation: 'note',
      counterList: [create(ServerInfo_CardCounterSchema, { id: 1, value: 3 })],
    });

    const result = resetCardState(card);

    expect(result.tapped).toBe(false);
    expect(result.attacking).toBe(false);
    expect(result.doesntUntap).toBe(false);
    expect(result.pt).toBe('');
    expect(result.color).toBe('');
    expect(result.annotation).toBe('');
    expect(result.counterList).toEqual([]);
  });

  it('preserves identity/location fields and returns a fresh object', () => {
    const card = makeCard({
      id: 10,
      name: 'Grizzly Bears',
      x: 3,
      y: 2,
      faceDown: true,
      providerId: 'abc',
      tapped: true,
    });

    const result = resetCardState(card);

    expect(result).not.toBe(card);
    expect(result.id).toBe(10);
    expect(result.name).toBe('Grizzly Bears');
    expect(result.x).toBe(3);
    expect(result.y).toBe(2);
    expect(result.faceDown).toBe(true);
    expect(result.providerId).toBe('abc');
  });
});

describe('cardAttrFields', () => {
  it.each([
    [CardAttribute.AttrTapped, '1', { tapped: true }],
    [CardAttribute.AttrTapped, '0', { tapped: false }],
    [CardAttribute.AttrAttacking, '1', { attacking: true }],
    [CardAttribute.AttrFaceDown, '1', { faceDown: true }],
    [CardAttribute.AttrColor, 'r', { color: 'r' }],
    [CardAttribute.AttrPT, '3/3', { pt: '3/3' }],
    [CardAttribute.AttrAnnotation, 'note', { annotation: 'note' }],
    [CardAttribute.AttrDoesntUntap, '1', { doesntUntap: true }],
    [CardAttribute.AttrNone, '1', undefined],
  ])('maps attribute %s = %j to %o', (attribute, value, fields) => {
    expect(cardAttrFields(attribute, value)).toEqual(fields);
  });
});

describe('mergeCardCounter', () => {
  const counter = (id: number, value: number) => create(ServerInfo_CardCounterSchema, { id, value });
  const list = [counter(1, 2), counter(3, 1)];

  it.each([
    ['updates an existing counter in place', 1, 5, [[1, 5], [3, 1]]],
    ['appends a new counter', 2, 4, [[1, 2], [3, 1], [2, 4]]],
    ['removes a counter set to zero', 1, 0, [[3, 1]]],
    ['removes a counter set below zero', 3, -1, [[1, 2]]],
    ['ignores the removal of an absent counter', 2, 0, [[1, 2], [3, 1]]],
  ])('%s', (_label, counterId, value, expected) => {
    expect(mergeCardCounter(list, counterId, value).map((c) => [c.id, c.value])).toEqual(expected);
  });

  it('leaves the input list untouched', () => {
    mergeCardCounter(list, 1, 9);
    expect(list.map((c) => c.value)).toEqual([2, 1]);
  });
});

describe('cardAttachFields', () => {
  it.each([
    ['an attach', { targetPlayerId: 2, targetZone: 'table', targetCardId: 30 },
      { attachPlayerId: 2, attachZone: 'table', attachCardId: 30 }],
    ['an unattach (empty target zone)', { targetPlayerId: 0, targetCardId: 0 },
      { attachPlayerId: -1, attachZone: '', attachCardId: -1 }],
  ])('writes %s', (_label, init, fields) => {
    expect(cardAttachFields(create(Event_AttachCardSchema, { startZone: 'table', cardId: 11, ...init }))).toEqual(fields);
  });
});

describe('buildTokenCard', () => {
  it('builds a detached, untapped token from the event', () => {
    const token = buildTokenCard(create(Event_CreateTokenSchema, {
      zoneName: 'table', cardId: 60, cardName: 'Soldier', color: 'w', pt: '1/1', annotation: 'note',
      destroyOnZoneChange: true, x: 9, y: 1, cardProviderId: 'soldier-1', faceDown: false,
    }));
    expect(token).toMatchObject({
      id: 60, name: 'Soldier', color: 'w', pt: '1/1', annotation: 'note', destroyOnZoneChange: true,
      x: 9, y: 1, providerId: 'soldier-1', tapped: false, attacking: false, doesntUntap: false,
      counterList: [], attachPlayerId: -1, attachZone: '', attachCardId: -1,
    });
  });
});

describe('carryForwardResyncState', () => {
  const alice = create(ServerInfo_UserSchema, { name: 'Alice' });
  const opt = makeCard({ id: 100, name: 'Opt' });

  function previous() {
    return {
      1: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 1, userInfo: alice }),
        zones: { deck: makeZoneEntry({ name: 'deck', revealedCards: [opt] }), hand: makeZoneEntry({ name: 'hand' }) },
      }),
    };
  }

  it('keeps the known userInfo and open zone views of a resynced player', () => {
    const next = { 1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1 }) }) };
    carryForwardResyncState(previous(), next);
    expect(next[1].properties.userInfo).toBe(alice);
    expect(next[1].zones.deck.revealedCards).toEqual([opt]);
    expect(next[1].zones.hand.revealedCards).toBeUndefined();
  });

  it('keeps userInfo the resync does carry', () => {
    const bob = create(ServerInfo_UserSchema, { name: 'Bob' });
    const next = { 1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, userInfo: bob }) }) };
    carryForwardResyncState(previous(), next);
    expect(next[1].properties.userInfo).toBe(bob);
  });

  it('leaves a newly seen player as the wire sent it', () => {
    const next = { 2: makePlayerEntry({ properties: makePlayerProperties({ playerId: 2 }) }) };
    carryForwardResyncState(previous(), next);
    expect(next[2].properties.userInfo).toBeUndefined();
    expect(next[2].zones.deck.revealedCards).toBeUndefined();
  });
});

describe('gameInfoUpdateFrom', () => {
  it.each([
    ['nothing set', {}, null],
    ['a game start', { gameStarted: true }, { gameStarted: true }],
    ['a game stop (false is set, not default)', { gameStarted: false }, { gameStarted: false }],
    ['player 0 becoming active', { activePlayerId: 0 }, { activePlayerId: 0 }],
    ['every field', { gameStarted: true, activePlayerId: 2, activePhase: 3, secondsElapsed: 90 },
      { gameStarted: true, activePlayerId: 2, activePhase: 3, secondsElapsed: 90 }],
  ])('reads %s', (_label, init, update) => {
    expect(gameInfoUpdateFrom(create(Event_GameStateChangedSchema, init))).toEqual(update);
  });
});
