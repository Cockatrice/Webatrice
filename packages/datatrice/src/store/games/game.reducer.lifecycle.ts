import { withEventTime, type EventTime } from './game.actionTime';
import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Event_GameJoined, ServerInfo_Game, ServerInfo_GameSchema } from '@cockatrice/sockatrice/generated';
import { cloneWith } from '../../common';
import { Enriched } from '../../types';
import { GamesState } from './game.interfaces';
import { pushEventMessage } from './game.reducer.helpers';
import { EVENT_PLAYER_ID_SYSTEM, formatGameClosed, formatReplayStarted } from './messageLog';

const initialState: GamesState = { games: {}, pings: {} };

export function retainReplayGames(state: GamesState): GamesState {
  const games: GamesState['games'] = {};
  const pings: GamesState['pings'] = {};
  for (const [id, game] of Object.entries(state.games)) {
    if (game.replay) {
      games[Number(id)] = game;
      pings[Number(id)] = state.pings[Number(id)] ?? {};
    }
  }
  return { ...initialState, games, pings };
}

function buildReplayGame(gameInfo: ServerInfo_Game, logStart: boolean, timeReceived: number): Enriched.GameEntry {
  const game: Enriched.GameEntry = {
    info: cloneWith(ServerInfo_GameSchema, gameInfo, { spectatorsOmniscient: true }),
    hostId: -1,
    localPlayerId: -1,
    spectator: true,
    judge: false,
    resuming: false,
    started: false,
    activePlayerId: -1,
    activePhase: -1,
    secondsElapsed: 0,
    reversed: false,
    players: {},
    seatOrder: [],
    messages: [],
    replay: true,
  };
  if (logStart) {
    pushEventMessage(game, EVENT_PLAYER_ID_SYSTEM, formatReplayStarted(gameInfo.gameId), timeReceived);
  }
  return game;
}

export const lifecycleReducers = {
  clearStore: ((state) => retainReplayGames(state)) as CaseReducer<GamesState>,

  gameJoined: ((state, action) => {
    const { data } = action.payload;
    const gameInfo = data.gameInfo;
    if (!gameInfo) {
      return;
    }
    state.games[gameInfo.gameId] = {
      info: gameInfo,
      hostId: data.hostId,
      localPlayerId: data.playerId,
      spectator: data.spectator,
      judge: data.judge,
      resuming: data.resuming,
      started: gameInfo.started,
      activePlayerId: -1,
      activePhase: -1,
      secondsElapsed: 0,
      reversed: false,
      players: {},
      seatOrder: [],
      messages: [],
    };
    state.pings[gameInfo.gameId] = {};
  }) as CaseReducer<GamesState, PayloadAction<{ data: Event_GameJoined }>>,

  gameLeft: ((state, action) => {
    delete state.games[action.payload.gameId];
    delete state.pings[action.payload.gameId];
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number }>>,

  gameClosed: withEventTime(((state, action) => {
    const game = state.games[action.payload.gameId];
    if (game?.replay) {
      pushEventMessage(game, EVENT_PLAYER_ID_SYSTEM, formatGameClosed(), action.payload.timeReceived);
      return;
    }
    delete state.games[action.payload.gameId];
    delete state.pings[action.payload.gameId];
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number } & EventTime>>),

  kicked: ((state, action) => {
    delete state.games[action.payload.gameId];
    delete state.pings[action.payload.gameId];
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number }>>,

  replayGameLoaded: withEventTime(((state, action) => {
    const { gameId, gameInfo } = action.payload;
    state.games[gameId] = buildReplayGame(gameInfo, !state.games[gameId]?.replay, action.payload.timeReceived);
    state.pings[gameId] = {};
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; gameInfo: ServerInfo_Game } & EventTime>>),

  replayGameUnloaded: ((state, action) => {
    if (!state.games[action.payload.gameId]?.replay) {
      return;
    }
    delete state.games[action.payload.gameId];
    delete state.pings[action.payload.gameId];
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number }>>,
};
