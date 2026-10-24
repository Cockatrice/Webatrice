import { create } from '@bufbuild/protobuf';
import { configureStore } from '@reduxjs/toolkit';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import {
  Event_RevealCardsSchema,
  ServerInfo_CardSchema,
  ServerInfo_GameSchema,
} from '@cockatrice/sockatrice/generated';

import { Actions as ServerActions } from '../server/server.actions';
import { listenerMiddleware } from '../listenerMiddleware';
import { Actions } from './game.actions';
import { registerGameListeners } from './game.listeners';
import { gamesReducer } from './game.reducer';
import { GamesState } from './game.interfaces';
import { Selectors } from './game.selectors';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeState, makeZoneEntry } from '../../testing/fixtures/games';

registerGameListeners(listenerMiddleware);

const REPLAY_ID = -1000;

function replayInfo(gameId = 77) {
  return create(ServerInfo_GameSchema, { gameId, description: 'Recorded game', started: false });
}

function withReplay(state: GamesState = makeState()): GamesState {
  return gamesReducer(state, Actions.replayGameLoaded({ gameId: REPLAY_ID, gameInfo: replayInfo() }));
}

describe('replay game lifecycle', () => {
  it.each([Actions.clearStore(), ServerActions.disconnected()])(
    'retains replay pings and initializes missing replay pings on $type', (action) => {
      const replay = makeGameEntry({ replay: true });
      const state = makeState({
        games: { 1: makeGameEntry(), [-1000]: replay, [-1001]: replay },
        pings: { 1: { 2: 9 }, [-1000]: { 3: 17 } },
        incomingReveal: { gameId: 1, sourceOwnerId: 2, zoneName: 'hand', cards: [], grantWriteAccess: true },
      });
      expect(state.pings).toEqual({ 1: { 2: 9 }, [-1000]: { 3: 17 } });
      expect(state.incomingReveal).toEqual({
        gameId: 1, sourceOwnerId: 2, zoneName: 'hand', cards: [], grantWriteAccess: true,
      });
      expect(gamesReducer(state, action)).toEqual({
        games: { [-1000]: replay, [-1001]: replay },
        pings: { [-1000]: { 3: 17 }, [-1001]: {} },
        ...(action.type === ServerActions.disconnected.type ? { incomingReveal: null } : {}),
      });
    },
  );

  it('replayGameLoaded creates an omniscient, player-less spectator game flagged as a replay', () => {
    const game = withReplay().games[REPLAY_ID];

    expect(game.replay).toBe(true);
    expect(game.localPlayerId).toBe(-1);
    expect(game.spectator).toBe(true);
    expect(game.judge).toBe(false);
    expect(game.started).toBe(false);
    expect(game.activePhase).toBe(-1);
    expect(game.players).toEqual({});
    expect(game.info.gameId).toBe(77);
    expect(game.info.spectatorsOmniscient).toBe(true);
    expect(game.messages.map((m) => m.message)).toEqual(['You are watching a replay of game #77.']);
  });

  it('replayGameLoaded on an existing replay resets it for a rewind without repeating the start notice', () => {
    let state = withReplay();
    state = gamesReducer(state, Actions.gameSay({ gameId: REPLAY_ID, playerId: 0, message: 'gg', timeReceived: 1 }));
    expect(state.games[REPLAY_ID].messages).toHaveLength(2);
    state = { ...state, pings: { ...state.pings, [REPLAY_ID]: { 3: 19 } } };
    expect(state.pings[REPLAY_ID]).toEqual({ 3: 19 });

    state = withReplay(state);
    expect(state.games[REPLAY_ID].messages).toEqual([]);
    expect(state.pings[REPLAY_ID]).toEqual({});
  });

  it('gameClosed keeps a replay on the board and logs the close', () => {
    const state = gamesReducer(withReplay(), Actions.gameClosed({ gameId: REPLAY_ID }));

    expect(state.games[REPLAY_ID]).toBeDefined();
    expect(state.games[REPLAY_ID].messages.at(-1)?.message).toBe('The game has been closed.');
  });

  it('gameClosed still removes a server game', () => {
    const state = gamesReducer(withReplay(), Actions.gameClosed({ gameId: 1 }));
    expect(state.games[1]).toBeUndefined();
  });

  it('replayGameUnloaded removes only replay games', () => {
    let state = withReplay();
    state = gamesReducer(state, Actions.replayGameUnloaded({ gameId: 1 }));
    expect(state.games[1]).toBeDefined();

    state = gamesReducer(state, Actions.replayGameUnloaded({ gameId: REPLAY_ID }));
    expect(state.games[REPLAY_ID]).toBeUndefined();
    expect(state.pings[REPLAY_ID]).toBeUndefined();
  });
});

describe('replay games and the active-game selectors', () => {
  it('excludes replay games from the active game ids and entries', () => {
    const state = { games: makeState({ games: { 1: makeGameEntry(), [REPLAY_ID]: makeGameEntry({ replay: true }) } }) };

    expect(Selectors.getActiveGameIds(state)).toEqual([1]);
    expect(Selectors.getActiveGames(state)).toHaveLength(1);
  });
});

describe('replay games and incoming reveals', () => {
  const playerId = 1;
  const cardId = 4;
  const liveGameId = 55;
  const liveCardId = 9;
  const firstPosition = 0;
  const liveReveal = {
    gameId: liveGameId,
    sourceOwnerId: playerId,
    zoneName: 'deck',
    cards: [create(ServerInfo_CardSchema, { id: liveCardId, name: 'Mountain' })],
    grantWriteAccess: true,
  };
  const playbackReveal = {
    gameId: REPLAY_ID,
    sourceOwnerId: playerId,
    zoneName: 'hand',
    cards: [create(ServerInfo_CardSchema, { id: cardId, name: 'Island' })],
    grantWriteAccess: false,
  };

  function revealInto(
    replay: boolean,
    replayOptions?: WebsocketTypes.ReplayEventOptions,
    initialReveal: typeof liveReveal | null = liveReveal,
  ) {
    const card = create(ServerInfo_CardSchema, { id: cardId });
    const game = makeGameEntry({
      replay,
      players: {
        [playerId]: makePlayerEntry({
          properties: makePlayerProperties({ playerId, userInfo: { name: 'Alice' } }),
          zones: { hand: makeZoneEntry({ name: 'hand', cards: [card], cardCount: 1 }) },
        }),
      },
    });
    const store = configureStore({
      preloadedState: { games: makeState({ games: { [REPLAY_ID]: game }, incomingReveal: initialReveal }) },
      reducer: { games: gamesReducer },
      middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
        .prepend(listenerMiddleware.middleware),
    });
    expect(store.getState().games.incomingReveal).toEqual(initialReveal);
    expect(store.getState().games.games[REPLAY_ID].players[playerId].zones.hand.byId).toEqual({
      [cardId]: create(ServerInfo_CardSchema, { id: cardId }),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      store.dispatch(Actions.cardsRevealed({
        gameId: REPLAY_ID,
        playerId,
        data: create(Event_RevealCardsSchema, {
          zoneName: 'hand', cards: [{ id: cardId, name: 'Island' }],
        }),
        replayOptions,
      }));
      expect(errorSpy.mock.calls).toEqual([]);
      return store.getState().games;
    } finally {
      errorSpy.mockRestore();
    }
  }

  it.each([undefined, {}, { skipRevealWindow: false }])('shows a replay reveal with options %j', (options) => {
    expect(revealInto(true, options).incomingReveal).toEqual(playbackReveal);
  });

  it.each([
    { options: undefined, expected: playbackReveal },
    { options: { skipRevealWindow: true }, expected: null },
  ])('starting without a dialog, options $options leave $expected', ({ options, expected }) => {
    expect(revealInto(true, options, null).incomingReveal).toEqual(expected);
  });

  it('skips the replay reveal window when requested and preserves the live dialog', () => {
    expect(revealInto(true, { skipRevealWindow: true }).incomingReveal).toEqual(liveReveal);
  });

  it.each([undefined, { skipRevealWindow: true }])('keeps live reveal windows unchanged with options %j', (options) => {
    expect(revealInto(false, options).incomingReveal).toEqual(playbackReveal);
  });

  it.each([false, true])('keeps reveal logging and zone seeding when skipRevealWindow=%s', (skipRevealWindow) => {
    const state = revealInto(true, { skipRevealWindow });
    const game = state.games[REPLAY_ID];
    expect(game.messages.map(({ message }) => message)).toEqual(['Alice reveals their hand.']);
    const zone = game.players[playerId].zones.hand;
    expect(zone.byId).toEqual({ [cardId]: create(ServerInfo_CardSchema, { id: cardId, name: 'Island' }) });
    expect(zone.revealedCards).toEqual([create(ServerInfo_CardSchema, { id: firstPosition, name: 'Island' })]);
    expect(zone.revealedIsReversed).toBe(false);
  });
});
