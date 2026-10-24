import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { formatArrowCreated } from './messageLog';

export function registerArrowsListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: Actions.arrowCreated,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      if (!data.arrowInfo) {
        return;
      }
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      const prePlayer = preGame?.players[playerId];
      if (!preGame || !prePlayer) {
        return;
      }
      const message = formatArrowCreated(preGame, playerId, data.arrowInfo);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });
}
