import { createAction } from '@reduxjs/toolkit';

import { Enriched } from '../../types';
import { roomsSlice } from './rooms.reducer';
import type { RoomCommandFailedPayload } from './rooms.interfaces';

const SignalActions = {
  gameCreated: createAction<{ roomId: number }>('rooms/gameCreated'),
  createGameFailed: createAction<RoomCommandFailedPayload>('rooms/createGameFailed'),
  roomSayReceived: createAction<{ roomId: number; message: Enriched.Message }>('rooms/roomSayReceived'),
};

export const Actions = { ...roomsSlice.actions, ...SignalActions };

export type RoomsAction = ReturnType<typeof Actions[keyof typeof Actions]>;
