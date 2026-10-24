export { createStore, storeMiddlewareOptions, type CreateStoreOptions } from './createStore';
export { rootReducer, rootReducerMap, type RootState } from './rootReducer';
export { isSerializable } from './isSerializable';
export { sanitizeDiagnostics } from './sanitizeDiagnostics';
export { listenerMiddleware } from './listenerMiddleware';

// Per-slice namespace re-exports. Consumers use these as:
//   import { server } from 'datatrice';
//   server.Actions.userJoined({ user })
//   server.Selectors.selectBuddyList(state)
//   server.registerServerListeners(mw)
export * as server from './server';
export * as rooms from './rooms';
export * as games from './games';

// Flat type re-exports — sidestep tsup's namespace-of-types limitation.
// See .github/instructions/datatrice-store.instructions.md#slice-authoring.
export type { GamesState } from './games/game.interfaces';
export type { RoomsState, GameFilters, JoinGameError } from './rooms/rooms.interfaces';
export type { JoinRoomError } from './rooms/rooms.interfaces';
export type { PrivateChatNotice, PrivateChatNoticeKind, PrivateConversationEntry } from './server/server.interfaces';
export type { GamesOfUserStatus } from './server/server.interfaces';
export type {
  ServerState,
  ServerStateStatus,
  ServerStateInfo,
  ServerStateLogs,
  ServerStateStaff,
  UserInvestigation,
  ServerConnectionHealth,
  ServerStateReports,
  TestConnectionStatus,
} from './server/server.interfaces';
export type { CommandFailedPayload, SessionCommandFailedPayload } from './server/server.interfaces';
export type { JoinRoomFailedPayload, RoomCommandFailedPayload } from './rooms/rooms.interfaces';
export type { GameCommandFailedPayload } from './games/game.interfaces';
export type { ReportStatusCounts } from './server/server.reports';
export { ServerCapability } from './server/server.capabilities';
export { ReportStatus } from './server/server.reports';

// Flat re-exports for utilities consumers reach for without going
// through a slice namespace. `classifyLogTone` + `LogTone` are used
// by the chat-log renderer to color-code event messages by kind;
// the segment types describe the per-token log message shape.
export { classifyLogTone } from './games/messageLog';
export type { LogTone, LogSegment, LogSegmentKind, LogEntry } from './games/messageLog';
