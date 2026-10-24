import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { Actions } from './game.actions';
import { gamesReducer } from './game.reducer';
import { registerZonesListeners } from './game.listeners.zones';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makeState,
  makeZoneEntry,
} from '../../testing/fixtures/games';

const target = { gameId: 1, playerId: 1, zoneName: 'hand' };

function reorder(order: number[], scope = target) {
  return Actions.zoneOrderReplacedLocally({ ...scope, order });
}

function initialState() {
  const player = makePlayerEntry({
    zones: {
      hand: makeZoneEntry({
        cards: [makeCard({ id: 1 }), makeCard({ id: 2 }), makeCard({ id: 3 })],
        cardCount: 3,
      }),
      deck: makeZoneEntry({ name: 'deck', cardCount: 40 }),
    },
  });
  return makeState({
    games: {
      1: makeGameEntry({ players: { 1: player, 2: makePlayerEntry() } }),
      2: makeGameEntry(),
    },
  });
}

function eventStore() {
  const middleware = createListenerMiddleware();
  registerZonesListeners(middleware);
  return configureStore({
    reducer: { games: gamesReducer },
    preloadedState: { games: initialState() },
    middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
      .prepend(middleware.middleware),
  });
}

describe('zoneOrderReplacedLocally', () => {
  it('reorders only the requested zone and preserves card data, counts and messages', () => {
    const state = initialState();
    const result = gamesReducer(state, reorder([3, 1, 2]));
    const before = state.games[1].players[1].zones.hand;
    const after = result.games[1].players[1].zones.hand;

    expect(after.order).toEqual([3, 1, 2]);
    expect(before.order).toEqual([1, 2, 3]);
    expect(after.byId).toBe(before.byId);
    expect(after.cardCount).toBe(3);
    expect(result.games[1].players[1].zones.deck).toBe(state.games[1].players[1].zones.deck);
    expect(result.games[1].players[2]).toBe(state.games[1].players[2]);
    expect(result.games[2]).toBe(state.games[2]);
    expect(result.games[1].messages).toBe(state.games[1].messages);
  });

  it.each([
    { label: 'missing card', order: [3, 1] },
    { label: 'extra card', order: [3, 1, 2, 4] },
    { label: 'duplicate card', order: [3, 1, 1] },
    { label: 'substituted card', order: [3, 1, 4] },
    { label: 'empty order', order: [] },
  ])('rejects $label without changing state', ({ order }) => {
    const state = initialState();
    expect(gamesReducer(state, reorder(order))).toBe(state);
  });

  it.each([
    { ...target, gameId: 99 },
    { ...target, playerId: 99 },
    { ...target, zoneName: 'missing' },
  ])('ignores a missing target: %j', (scope) => {
    const state = initialState();
    expect(gamesReducer(state, reorder([3, 1, 2], scope))).toBe(state);
  });

  it('does not invalidate an already ordered zone', () => {
    const state = initialState();
    expect(gamesReducer(state, reorder([1, 2, 3]))).toBe(state);
  });

  it('appends a server draw to the locally sorted hand and rejects the stale sort', () => {
    const store = eventStore();
    store.dispatch(reorder([3, 1, 2]));
    store.dispatch(Actions.cardsDrawn({
      gameId: 1, playerId: 1, data: { number: 1, cards: [makeCard({ id: 4 })] },
    }));
    const afterDraw = store.getState();
    expect(afterDraw.games.games[1].players[1].zones.hand.order).toEqual([3, 1, 2, 4]);
    expect(afterDraw.games.games[1].players[1].zones.hand.cardCount).toBe(4);
    expect(afterDraw.games.games[1].players[1].zones.deck.cardCount).toBe(39);
    store.dispatch(reorder([3, 1, 2]));
    expect(store.getState()).toBe(afterDraw);
  });

  it('applies a later server move index to the locally sorted list', () => {
    const store = eventStore();
    store.dispatch(reorder([3, 1, 2]));
    store.dispatch(Actions.cardMoved({
      gameId: 1,
      playerId: 1,
      data: {
        cardId: 2, cardName: '', startPlayerId: 1, startZone: 'hand',
        position: -1, targetPlayerId: 1, targetZone: 'hand',
        x: 1, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
      },
    }));
    expect(store.getState().games.games[1].players[1].zones.hand.order).toEqual([3, 2, 1]);
  });

  it('rejects a stale sort after a card leaves the hand', () => {
    const state = gamesReducer(initialState(), Actions.cardRemovedFromZone({ ...target, cardId: 2 }));
    expect(gamesReducer(state, reorder([3, 1, 2]))).toBe(state);
  });
});
