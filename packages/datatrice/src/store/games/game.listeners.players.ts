import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { diffPlayerProperties, formatLeaveMessage, formatPlayerJoined, formatPropertyDiff } from './messageLog';

export function registerPlayersListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: Actions.playerPropertiesChanged,
    effect: (action, api) => {
      const { gameId, playerId, properties } = action.payload;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const player = game?.players[playerId];
      if (!game || !player) {
        return;
      }

      const previous = { ...player.properties };
      api.dispatch(Actions.playerPropertiesUpdated({ gameId, playerId, properties }));

      const nextState = api.getState() as { games: GamesState };
      const nextGame = nextState.games.games[gameId];
      const nextPlayer = nextGame?.players[playerId];
      if (!nextGame || !nextPlayer) {
        return;
      }
      const diff = diffPlayerProperties(previous, nextPlayer.properties);
      for (const message of formatPropertyDiff(nextGame, playerId, diff)) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.playerJoined,
    effect: (action, api) => {
      const { gameId, playerProperties } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      const postState = api.getState() as { games: GamesState };
      const postGame = postState.games.games[gameId];
      if (!postGame) {
        return;
      }
      const message = formatPlayerJoined(postGame, playerProperties.playerId);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({
          gameId, playerId: playerProperties.playerId, message,
        }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.playerLeft,
    effect: (action, api) => {
      const { gameId, playerId, reason } = action.payload;
      // @critical Pre-mutation read; reducer deletes the player. See .github/instructions/datatrice-game.instructions.md#listener-patterns.
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      const player = preGame?.players[playerId];
      if (!player) {
        return;
      }
      const message = formatLeaveMessage({ id: playerId, name: player.properties.userInfo?.name }, reason);
      api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
    },
  });
}
