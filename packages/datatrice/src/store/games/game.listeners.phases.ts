import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { carryForwardResyncState, gameInfoUpdateFrom, normalizePlayers } from './game.reducer.helpers';
import {
  EVENT_PLAYER_ID_SYSTEM,
  formatActivePhaseSet,
  formatActivePlayerSet,
  formatGameStart,
  formatTurnReversed,
} from './messageLog';

export function registerPhasesListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: Actions.gameStateChanged,
    effect: (action, api) => {
      const { gameId, data } = action.payload;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      if (!game) {
        return;
      }
      const wasStarted = game.started;

      if (data.playerList?.length > 0) {
        const players = normalizePlayers(data.playerList);
        carryForwardResyncState(game.players, players);
        const order = data.playerList.map((p) => p.properties.playerId);
        api.dispatch(Actions.gamePlayersReplaced({ gameId, players, order }));
      }

      const update = gameInfoUpdateFrom(data);
      if (update) {
        api.dispatch(Actions.gameInfoUpdated({ gameId, ...update }));
      }
      const nextStarted = update?.gameStarted ?? wasStarted;

      // Pre-mutation read for the wasStarted→started log edge. See .github/instructions/datatrice-game.instructions.md#listener-patterns.
      if (!wasStarted && nextStarted) {
        api.dispatch(Actions.gameMessageAppended({
          gameId,
          playerId: EVENT_PLAYER_ID_SYSTEM,
          message: formatGameStart(),
        }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.activePlayerSet,
    effect: (action, api) => {
      const { gameId, activePlayerId } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      // Suppress the turn-change log before the game starts (the initial active-player
      // assignment moves from -1 during setup/resume) and when it didn't change —
      // matching activePhaseSet's `!preGame.started` guard.
      if (preGame.activePlayerId === activePlayerId || !preGame.started) {
        return;
      }
      const postState = api.getState() as { games: GamesState };
      const postGame = postState.games.games[gameId];
      if (!postGame) {
        return;
      }
      const message = formatActivePlayerSet(postGame, activePlayerId);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId: activePlayerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.activePhaseSet,
    effect: (action, api) => {
      const { gameId, phase } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      // Suppress the log on initial-phase replay (game not yet started) and
      // when the phase didn't actually change — matching the pre-refactor
      // reducer's `previous !== payload.phase && game.started` guard.
      if (preGame.activePhase === phase || !preGame.started) {
        return;
      }
      const message = formatActivePhaseSet(phase);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({
          gameId, playerId: EVENT_PLAYER_ID_SYSTEM, message,
        }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.turnReversed,
    effect: (action, api) => {
      const { gameId, reversed, playerId } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      if (playerId == null || !preGame.players[playerId]) {
        return;
      }
      const message = formatTurnReversed(preGame, playerId, reversed);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({
          gameId, playerId, message,
        }));
      }
    },
  });
}
