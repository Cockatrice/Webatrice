import { create } from '@bufbuild/protobuf';
import { vi } from 'vitest';
import { makeGameEntry } from '../../src/testing/fixtures/games';
import * as Data from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { attachResponseHandlers, createStore, games } from '../../src';
import { Actions } from '../../src/store/games/game.actions';
import { Actions as ServerActions } from '../../src/store/server/server.actions';

function setup() {
  const store = createStore();
  const response = attachResponseHandlers(store);
  response.session.gameJoined(create(Data.Event_GameJoinedSchema, {
    gameInfo: { gameId: 42 }, playerId: 1,
  }));
  response.game.replayGameLoaded!(-1000, create(Data.ServerInfo_GameSchema, { gameId: 77, description: 'Recording' }));
  return { store, response };
}

describe('replay response bridge', () => {
  it('restores a replay without saved ping state when disconnected', () => {
    const replay = makeGameEntry({ replay: true });
    const store = createStore({ preloadedState: { games: { games: { [-1000]: replay }, pings: {} } } });
    const response = attachResponseHandlers(store);
    response.session.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'Closed');
    expect(store.getState().games).toEqual({ games: { [-1000]: replay }, pings: { [-1000]: {} }, incomingReveal: null });
  });

  it('builds a spectator replay, rewinds populated state and unloads only the replay', () => {
    const { store, response } = setup();
    const expectedGame = {
      info: create(Data.ServerInfo_GameSchema, { gameId: 77, description: 'Recording', spectatorsOmniscient: true }),
      hostId: -1, localPlayerId: -1, spectator: true, judge: false, resuming: false, started: false,
      activePlayerId: -1, activePhase: -1, secondsElapsed: 0, reversed: false,
      players: {}, seatOrder: [], messages: [],
      replay: true,
    };
    expect(store.getState().games.games[-1000]).toEqual({
      ...expectedGame, messages: [{
        playerId: -1, message: 'You are watching a replay of game #77.', timeReceived: expect.any(Number), gameSeconds: 0, kind: 'event',
        segments: [{ text: 'You are watching a replay of game #77.', kind: 'plain' }],
        descriptor: { kind: 'replayStarted', params: { gameId: 77 } },
      }],
    });
    expect(games.Selectors.getActiveGameIds(store.getState())).toEqual([42]);
    expect(games.Selectors.getActiveGames(store.getState())).toEqual([store.getState().games.games[42]]);
    response.game.playerJoined(-1000, create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 3, pingSeconds: 19 }));
    response.game.gameSay(-1000, 3, 'recorded', 123);
    expect(store.getState().games.pings[-1000]).toEqual({ 3: 19 });
    expect(Object.keys(store.getState().games.games[-1000].players)).toEqual(['3']);
    expect(store.getState().games.games[-1000].messages.map((entry) => entry.message)).toContain('recorded');
    response.game.replayGameLoaded!(-1000, create(Data.ServerInfo_GameSchema, { gameId: 77, description: 'Recording' }));
    expect(store.getState().games.games[-1000]).toEqual(expectedGame);
    expect(store.getState().games.pings[-1000]).toEqual({});
    response.game.replayGameUnloaded!(42);
    expect(store.getState().games.games[42].info.gameId).toBe(42);
    response.game.replayGameUnloaded!(-1000);
    expect(store.getState().games.games[-1000]).toBeUndefined();
    expect(store.getState().games.pings[-1000]).toBeUndefined();
    response.game.replayGameUnloaded!(-1000);
    expect(Object.keys(store.getState().games.games)).toEqual(['42']);
  });

  it('logs closure while preserving replay players and pings', () => {
    const { store, response } = setup();
    response.game.playerJoined(-1000, create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 3, pingSeconds: 19 }));
    const players = {
      3: {
        properties: create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 3, pingSeconds: 19 }),
        deckList: '', zones: {}, counters: {}, arrows: {}, drawSeq: 0, lastDrawCount: 0,
      },
    };
    expect(store.getState().games.games[-1000].players).toEqual(players);
    expect(store.getState().games.pings[-1000]).toEqual({ 3: 19 });
    response.game.gameClosed(-1000);
    expect(store.getState().games.games[-1000].players).toEqual(players);
    expect(store.getState().games.pings[-1000]).toEqual({ 3: 19 });
    expect(store.getState().games.games[-1000].messages.map((entry) => entry.message)).toEqual([
      'You are watching a replay of game #77.', 'Player 3 has joined the game.', 'The game has been closed.',
    ]);
    response.game.gameClosed(42);
    expect(store.getState().games.games[42]).toBeUndefined();
    expect(store.getState().games.pings[42]).toBeUndefined();
  });

  it.each([Actions.clearStore(), ServerActions.disconnected()])('retains local playback on $type', (action) => {
    const { store, response } = setup();
    response.game.playerJoined(-1000, create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 3, pingSeconds: 19 }));
    const game = {
      info: create(Data.ServerInfo_GameSchema, { gameId: 77, description: 'Recording', spectatorsOmniscient: true }),
      hostId: -1, localPlayerId: -1, spectator: true, judge: false, resuming: false, started: false,
      activePlayerId: -1, activePhase: -1, secondsElapsed: 0, reversed: false, replay: true,
      players: {
        3: {
          properties: create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 3, pingSeconds: 19 }),
          deckList: '', zones: {}, counters: {}, arrows: {}, drawSeq: 0, lastDrawCount: 0,
        },
      },
      seatOrder: [3],
      messages: [
        {
          playerId: -1, message: 'You are watching a replay of game #77.', timeReceived: expect.any(Number), gameSeconds: 0, kind: 'event',
          segments: [{ text: 'You are watching a replay of game #77.', kind: 'plain' }],
          descriptor: { kind: 'replayStarted', params: { gameId: 77 } },
        },
        {
          playerId: 3, message: 'Player 3 has joined the game.', timeReceived: expect.any(Number), gameSeconds: 0, kind: 'event',
          segments: [{ text: 'Player 3', kind: 'player' }, { text: ' has joined the game.', kind: 'plain' }],
          descriptor: { kind: 'playerJoined', params: { actor: { id: 3, name: undefined } } },
        },
      ],
    };
    expect(store.getState().games.games[-1000]).toEqual(game);
    expect(store.getState().games.pings[-1000]).toEqual({ 3: 19 });
    store.dispatch(Actions.incomingRevealShown({
      gameId: 42, sourceOwnerId: 1, zoneName: 'hand', cards: [], grantWriteAccess: true,
    }));
    expect(store.getState().games.incomingReveal).toEqual({
      gameId: 42, sourceOwnerId: 1, zoneName: 'hand', cards: [], grantWriteAccess: true,
    });
    store.dispatch(action);
    expect(store.getState().games).toEqual({
      games: { [-1000]: game }, pings: { [-1000]: { 3: 19 } },
      ...(action.type === ServerActions.disconnected.type ? { incomingReveal: null } : {}),
    });
  });

  it('records revealed cards while seeking without replacing the live reveal dialog', () => {
    const { store, response } = setup();
    const card = create(Data.ServerInfo_CardSchema, { id: 4, name: 'Island' });
    response.game.gameStateChanged(-1000, create(Data.Event_GameStateChangedSchema, {
      playerList: [{ properties: { playerId: 3 }, zoneList: [{ name: 'hand', cardCount: 1, cardList: [card] }] }],
    }));
    store.dispatch(Actions.incomingRevealShown({
      gameId: 42, sourceOwnerId: 1, zoneName: 'deck', cards: [], grantWriteAccess: true,
    }));
    expect(store.getState().games.incomingReveal).toEqual({
      gameId: 42, sourceOwnerId: 1, zoneName: 'deck', cards: [], grantWriteAccess: true,
    });
    response.game.cardsRevealed(-1000, 3, create(Data.Event_RevealCardsSchema, {
      zoneName: 'hand', cardId: [4], cards: [card], grantWriteAccess: false,
    }), { skipRevealWindow: true });
    expect(store.getState().games.games[-1000].players[3].zones.hand.revealedCards).toEqual([
      create(Data.ServerInfo_CardSchema, { id: 0, name: 'Island' }),
    ]);
    expect(store.getState().games.incomingReveal).toEqual({
      gameId: 42, sourceOwnerId: 1, zoneName: 'deck', cards: [], grantWriteAccess: true,
    });
  });

  it.each([undefined, WebsocketTypes.CommandFailure.Timeout])('dispatches replay list failure %s without replacing matches', (failure) => {
    const { store, response } = setup();
    const match = create(Data.ServerInfo_ReplayMatchSchema, { gameId: 77 });
    response.session.replayList([match], 'new');
    expect(store.getState().server.replays).toEqual({ 77: match });
    const dispatch = vi.spyOn(store, 'dispatch');
    try {
      response.session.replayListFailed!(7, failure, 'old');
      expect(dispatch.mock.calls).toEqual([[ServerActions.replayListFailed({ responseCode: 7, failure, requestId: 'old' })]]);
      expect(store.getState().server.replays).toEqual({ 77: match });
    } finally {
      dispatch.mockRestore();
    }
  });
});
