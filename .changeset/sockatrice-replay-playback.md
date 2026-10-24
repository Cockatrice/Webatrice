---
'@cockatrice/sockatrice': minor
---

Replay playback and replay-command error reporting.

`WebClient.replayGameEventContainer(container, gameId)` feeds one recorded `GameReplay` event container through the live game-event pipeline, addressed to a local game id (Servatrice stores replay containers with `game_id` cleared). Replays therefore rebuild state with the same handlers, reducers and log lines as a live game, and nothing is sent to the server. `WebClient.loadReplayGame(gameId, gameInfo)` and `unloadReplayGame(gameId)` create (or rewind) and remove that local game through the new optional `IGameResponse.replayGameLoaded` / `replayGameUnloaded` members, so a client never has to write the replay game into its store itself.

`replayDownload` takes optional `onDownloaded(replayData)` and `onFailure(responseCode, failure?)` callbacks, and `replayDeleteMatch`, `replayModifyMatch` and `replayGetCode` take an optional `onFailure(responseCode, failure?)`, so a caller can tell watching from saving a download (with `onDownloaded` the bytes go only to the caller and `replayDownloaded` is not raised) and surface rejections such as `RespFunctionNotAllowed`. `failure` is the `CommandFailure` transport reason (set when the server never answered), and `replaySubmitCode`'s `onFailure` now receives it too. A failed `replayList` reports through the new optional `ISessionResponse.replayListFailed(responseCode, failure?)`. `Event_ReplayAdded` without match info (a moderator grant or a redeemed share code) now refreshes the replay list, as desktop does, instead of passing `undefined` to the store.
