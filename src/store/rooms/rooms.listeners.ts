import { Data, Enriched } from '@app/types';

import { listenerMiddleware } from '../listenerMiddleware';
import { mergeSetFields, normalizeGameObject, normalizeGametypeMap } from '../common';

import { Actions } from './rooms.actions';
import { RoomsState } from './rooms.interfaces';

listenerMiddleware.startListening({
  actionCreator: Actions.updateRooms,
  effect: (action, api) => {
    const { rooms } = action.payload;
    const state = api.getState() as { rooms: RoomsState };

    rooms.forEach((rawRoom, order) => {
      const { roomId } = rawRoom;
      const existing = state.rooms.rooms[roomId];
      const rawGametypeList = rawRoom.gametypeList ?? [];

      if (existing) {
        // @critical Partial merge — UPDATE_ROOMS sets only changed fields.
        // See .github/instructions/store.instructions.md#reducer-author-hazards.
        //
        // Cockatrice's server_room.cpp addClient/removeClient (called on
        // every user join/leave) emits Event_ListRooms with only
        // room_id/player_count/game_count populated. A wholesale info
        // replacement would blank out name/description/permissionlevel until
        // the next full room listing. mergeSetFields uses bufbuild's
        // isFieldSet on each field of the raw proto so only server-populated
        // fields propagate; the rest of the existing info is preserved.
        //
        // mergeSetFields runs HERE rather than inside the primitive because
        // Immer drafts redux state but does NOT understand protobuf-es
        // message shapes (see MEMORY: "Immer doesn't draft protobuf-es
        // messages") — we build the next info object outside the reducer and
        // hand it in fully-formed.
        const nextInfo = { ...existing.info } as Data.ServerInfo_Room;
        mergeSetFields(Data.ServerInfo_RoomSchema, nextInfo, rawRoom);
        const nextGametypeMap = rawGametypeList.length > 0
          ? normalizeGametypeMap(rawGametypeList)
          : existing.gametypeMap;
        api.dispatch(Actions.roomUpserted({
          roomId,
          info: nextInfo,
          gametypeMap: nextGametypeMap,
          order,
          preserveGamesAndUsers: true,
        }));
      } else {
        api.dispatch(Actions.roomUpserted({
          roomId,
          info: rawRoom,
          gametypeMap: normalizeGametypeMap(rawGametypeList),
          order,
          preserveGamesAndUsers: false,
        }));
      }
    });
  },
});

listenerMiddleware.startListening({
  actionCreator: Actions.updateGames,
  effect: (action, api) => {
    const { roomId, games } = action.payload;
    if (!games?.length) {
      return;
    }

    const state = api.getState() as { rooms: RoomsState };
    const room = state.rooms.rooms[roomId];
    if (!room) {
      return;
    }

    const gametypeMap = room.gametypeMap ?? {};

    for (const rawGame of games) {
      if (rawGame.closed) {
        api.dispatch(Actions.roomGameRemoved({ roomId, gameId: rawGame.gameId }));
        continue;
      }

      const existing = room.games[rawGame.gameId];
      if (existing) {
        const merged: Data.ServerInfo_Game = { ...existing.info, ...rawGame };
        const game: Enriched.Game = {
          info: merged,
          gameType: merged.gameTypes?.length
            ? (gametypeMap[merged.gameTypes[0]] ?? '')
            : existing.gameType,
        };
        api.dispatch(Actions.roomGameUpserted({ roomId, gameId: rawGame.gameId, game }));
      } else {
        api.dispatch(Actions.roomGameUpserted({
          roomId,
          gameId: rawGame.gameId,
          game: normalizeGameObject(rawGame, gametypeMap),
        }));
      }
    }
  },
});

export {};
