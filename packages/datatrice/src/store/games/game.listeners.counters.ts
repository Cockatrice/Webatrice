import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { mergeCardCounter } from './game.reducer.helpers';
import { formatCardCounterChanged, formatCounterSet } from './messageLog';

export function registerCountersListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: Actions.cardCounterChanged,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId, counterId, counterValue } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const card = game?.players[playerId]?.zones[zoneName]?.byId[cardId];
      if (!game || !card) {
        return;
      }
      const cardName = card.name;
      const previousValue = card.counterList.find(c => c.id === counterId)?.value ?? 0;

      const nextCounterList = mergeCardCounter(card.counterList, counterId, counterValue);
      api.dispatch(Actions.cardFieldsUpdated({
        gameId, playerId, zoneName, cardId, fields: { counterList: nextCounterList },
      }));

      const message = formatCardCounterChanged(game, playerId, data, cardName, previousValue);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.counterSet,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      const preCounter = preGame?.players[playerId]?.counters[data.counterId];
      if (!preGame || !preCounter) {
        return;
      }
      const previousValue = preCounter.count;
      const message = formatCounterSet(preGame, playerId, data, preCounter.name, previousValue);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });
}
