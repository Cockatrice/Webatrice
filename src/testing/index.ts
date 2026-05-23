// Public testing surface. Re-exports redux state-shape fixture builders for
// consumers who need to seed Datatrice state directly in their tests.
// NOT for proto message builders — those live in @cockatrice/sockatrice/testing.
//
// `makeUser` and `makeGame` exist in both `rooms` and `server` fixture files
// for historical reasons; the rooms-flavoured versions carry richer defaults
// (gameId/roomId/description) so they're the canonical re-exports at this
// barrel. Specs that need the leaner server-flavoured `makeGame` can still
// import directly from `./fixtures/server`.
export * from './fixtures/games';
export * from './fixtures/rooms';
export {
  makeLogItem,
  makeBanHistoryItem,
  makeWarnHistoryItem,
  makeWarnListItem,
  makeDeckTreeItem,
  makeDeckList,
  makeReplayMatch,
  makeLoginSuccessContext,
  makePendingActivationContext,
  makeServerState,
} from './fixtures/server';
