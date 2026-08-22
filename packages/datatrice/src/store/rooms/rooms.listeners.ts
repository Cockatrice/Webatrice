import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';
import { clone } from '@bufbuild/protobuf';

import { Enriched } from '../../types';
import { ServerInfo_GameSchema, ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';
import { cloneWith, mergeSetFields, normalizeGameObject, normalizeGametypeMap } from '../../common';

import { Actions } from './rooms.actions';
import { RoomsState } from './rooms.interfaces';

export function registerRoomsListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: Actions.updateRooms,
    effect: (action, api) => {
      const { rooms } = action.payload;
      const state = api.getState() as { rooms: RoomsState };

      rooms.forEach((rawRoom, order) => {
        const { roomId } = rawRoom;
        const existing = state.rooms.rooms[roomId];
        const rawGametypeList = rawRoom.gametypeList ?? [];

        if (existing) {
          // Sparse merge onto a fresh clone (clone preserves unset proto2 fields a spread
          // would drop). See .github/instructions/datatrice-store.instructions.md#reducer-author-hazards.
          const nextInfo = clone(ServerInfo_RoomSchema, existing.info);
          mergeSetFields(ServerInfo_RoomSchema, nextInfo, rawRoom);
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

  mw.startListening({
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

      // One dispatch per frame, not per game: a busy server's join snapshot
      // carries thousands of games, and per-game dispatches invalidated the
      // room selectors N times per frame (dev invariant walks went O(games²)).
      const changes: { gameId: number; game: Enriched.Game | null }[] = [];
      for (const rawGame of games) {
        if (rawGame.closed) {
          changes.push({ gameId: rawGame.gameId, game: null });
          continue;
        }

        const existing = room.games[rawGame.gameId];
        if (existing) {
          // clone base preserves existing's unset proto2 fields; rawGame's set fields win.
          const merged = cloneWith(ServerInfo_GameSchema, existing.info, rawGame);
          changes.push({
            gameId: rawGame.gameId,
            game: {
              info: merged,
              gameType: merged.gameTypes?.length
                ? (gametypeMap[merged.gameTypes[0]] ?? '')
                : existing.gameType,
            },
          });
        } else {
          changes.push({
            gameId: rawGame.gameId,
            game: normalizeGameObject(rawGame, gametypeMap),
          });
        }
      }

      api.dispatch(Actions.roomGamesBatchApplied({ roomId, changes }));
    },
  });
}
