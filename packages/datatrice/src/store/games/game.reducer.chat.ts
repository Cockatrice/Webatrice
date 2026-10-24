import { withEventTime, type EventTime } from './game.actionTime';
import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import {
  Event_DumpZone,
  Event_GameLogNotice_NoticeType,
  Event_RollDie,
  Event_Shuffle,
  ServerInfo_Zone_ZoneType,
} from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';
import { MAX_GAME_MESSAGES, clearZoneKnownCards, gameSecondsNow, pushEventMessage } from './game.reducer.helpers';
import {
  formatDieRolled,
  formatUndoDrawFailed,
  formatZoneDumped,
  formatZoneShuffled,
} from './messageLog';

export const chatReducers = {
  gameSay: ((state, action) => {
    const { gameId, playerId, message, timeReceived } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    if (game.messages.length >= MAX_GAME_MESSAGES) {
      game.messages = game.messages.slice(game.messages.length - MAX_GAME_MESSAGES + 1);
    }
    const senderName = game.players[playerId]?.properties.userInfo?.name;
    game.messages.push({
      playerId,
      message,
      timeReceived,
      gameSeconds: gameSecondsNow(game, timeReceived),
      kind: 'chat',
      senderName,
    });
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; message: string; timeReceived: number }>>,

  zoneShuffled: withEventTime(((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    // A shuffle randomizes the zone, invalidating any known card positions. Cards
    // moved into a hidden library before the shuffle (e.g. a mulligan's hand→library
    // returns) were tracked in order/byId by cardMovedBetweenZones; drop that
    // identity tracking so the library doesn't render a known face-up top card or
    // leak the moved cards. Only hidden zones lose knowledge this way — a visible or
    // private zone's identities are still known to its owner, so never blank those.
    const zone = game.players[playerId]?.zones[data.zoneName];
    if (zone?.type === ServerInfo_Zone_ZoneType.HiddenZone) {
      clearZoneKnownCards(zone);
    }
    pushEventMessage(game, playerId, formatZoneShuffled(game, playerId), action.payload.timeReceived);
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_Shuffle } & EventTime>>),

  zoneDumped: withEventTime(((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    pushEventMessage(game, playerId, formatZoneDumped(game, playerId, data), action.payload.timeReceived);
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_DumpZone } & EventTime>>),

  dieRolled: withEventTime(((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    pushEventMessage(game, playerId, formatDieRolled(game, playerId, data), action.payload.timeReceived);
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_RollDie } & EventTime>>),

  gameLogNotice: withEventTime(((state, action) => {
    const { gameId, playerId, noticeType } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    switch (noticeType) {
      case Event_GameLogNotice_NoticeType.UNDO_DRAW_FAILED:
        pushEventMessage(game, playerId, formatUndoDrawFailed(game, playerId), action.payload.timeReceived);
        break;
      default:
        break;
    }
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number; playerId: number; noticeType: Event_GameLogNotice_NoticeType;
  } & EventTime>>),
};
