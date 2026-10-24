import type { Store } from '@reduxjs/toolkit';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { GameResponseImpl } from './GameResponseImpl';
import { Actions } from '../store/games/game.actions';
import { gamesReducer } from '../store/games/game.reducer';
import { makeGameEntry, makePlayerEntry, makeState } from '../testing/fixtures/games';

function setup() {
  const dispatch = vi.fn();
  return { dispatch, game: new GameResponseImpl({ dispatch } as unknown as Store) };
}

function gameState() {
  return makeState({
    games: { 7: makeGameEntry({ localPlayerId: 1, players: { 1: makePlayerEntry() } }) },
  });
}

describe('deck-select outcome identity', () => {
  it('carries each success identity on its action without storing it', () => {
    const { dispatch, game } = setup();
    game.deckSelected(7, 'new', 'second');
    game.deckSelected(7, 'old', 'first');
    expect(dispatch).toHaveBeenNthCalledWith(1, Actions.deckSelected({ gameId: 7, deckList: 'new', requestId: 'second' }));
    expect(dispatch).toHaveBeenNthCalledWith(2, Actions.deckSelected({ gameId: 7, deckList: 'old', requestId: 'first' }));
    const state = gameState();
    for (const [action] of dispatch.mock.calls) {
      expect(gamesReducer(state, action)).toEqual(
        gamesReducer(state, Actions.deckSelected({ gameId: 7, deckList: action.payload.deckList })),
      );
    }
  });

  it.each([undefined, ...Object.values(WebsocketTypes.CommandFailure)])(
    'carries a late failure %s identity without changing the selected deck', (failure) => {
      const { dispatch, game } = setup();
      game.deckSelected(7, 'new', 'second');
      const state = gamesReducer(gameState(), dispatch.mock.calls[0][0]);
      game.deckSelectFailed(7, 3, failure, 'first');
      const action = Actions.deckSelectFailed({ gameId: 7, responseCode: 3, failure, requestId: 'first' });
      expect(dispatch).toHaveBeenLastCalledWith(action);
      expect(gamesReducer(state, action)).toBe(state);
      expect(state.games[7].players[1].deckList).toBe('new');
    },
  );

  it('keeps legacy response calls valid', () => {
    const { dispatch, game } = setup();
    game.deckSelected(7, 'legacy');
    expect(dispatch).toHaveBeenLastCalledWith(Actions.deckSelected({ gameId: 7, deckList: 'legacy' }));
    game.deckSelectFailed(7, 3);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.deckSelectFailed({ gameId: 7, responseCode: 3, failure: undefined }));
  });
});

describe('next-turn outcome identity', () => {
  it('carries out-of-order success identities as signals without changing game state', () => {
    const { dispatch, game } = setup();
    game.nextTurnAnswered(7, 'second');
    game.nextTurnAnswered(7, 'first');
    expect(dispatch).toHaveBeenNthCalledWith(1, Actions.nextTurnAnswered({ gameId: 7, requestId: 'second' }));
    expect(dispatch).toHaveBeenNthCalledWith(2, Actions.nextTurnAnswered({ gameId: 7, requestId: 'first' }));
    const state = gameState();
    for (const [action] of dispatch.mock.calls) {
      expect(gamesReducer(state, action)).toBe(state);
    }
  });

  it.each([undefined, ...Object.values(WebsocketTypes.CommandFailure)])(
    'carries a late failure %s identity without changing game state', (failure) => {
      const { dispatch, game } = setup();
      game.nextTurnAnswered(7, 'second');
      game.nextTurnFailed(7, 3, failure, 'first');
      expect(dispatch).toHaveBeenLastCalledWith(
        Actions.nextTurnFailed({ gameId: 7, responseCode: 3, failure, requestId: 'first' }),
      );
      const state = gameState();
      for (const [action] of dispatch.mock.calls) {
        expect(gamesReducer(state, action)).toBe(state);
      }
    },
  );

  it('keeps response calls without correlation valid', () => {
    const { dispatch, game } = setup();
    game.nextTurnAnswered(7);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.nextTurnAnswered({ gameId: 7 }));
    game.nextTurnFailed(7, 3);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.nextTurnFailed({ gameId: 7, responseCode: 3, failure: undefined }));
  });
});
