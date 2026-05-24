import type { Store } from '@reduxjs/toolkit';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { AdminResponseImpl } from './AdminResponseImpl';
import { GameResponseImpl } from './GameResponseImpl';
import { ModeratorResponseImpl } from './ModeratorResponseImpl';
import { RoomResponseImpl } from './RoomResponseImpl';
import { SessionResponseImpl } from './SessionResponseImpl';

// Returns a WebsocketTypes.IWebClientResponse closed over `store`. Pass the
// result to `new WebClient(..., CLIENT_CONFIG, CLIENT_OPTIONS)` and Sockatrice
// events will dispatch directly into the given store, no singletons.
export function attachResponseHandlers(store: Store): WebsocketTypes.IWebClientResponse {
  return {
    session: new SessionResponseImpl(store),
    room: new RoomResponseImpl(store),
    game: new GameResponseImpl(store),
    admin: new AdminResponseImpl(store),
    moderator: new ModeratorResponseImpl(store),
  };
}
