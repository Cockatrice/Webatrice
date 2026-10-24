---
'@cockatrice/datatrice': minor
---

Replay games in the games slice.

`games.Actions.replayGameLoaded({ gameId, gameInfo })` creates (or, for a rewind, resets) a local game a replay is played back into: no local player, an omniscient spectator, flagged `replay: true`, with desktop's "You are watching a replay of game #N." log line, logged when the replay opens; a rewind clears the log without repeating it. `replayGameUnloaded({ gameId })` removes it. `GameResponseImpl` dispatches both from Sockatrice's `WebClient.loadReplayGame` / `unloadReplayGame`. Replay games survive `clearStore` and disconnects, stay on the board with "The game has been closed." when the recorded `Event_GameClosed` arrives, never raise the incoming-reveal dialog, and are left out of `getActiveGameIds` / `getActiveGames` so they get no game tab.

New `server.Actions.replayListFailed({ responseCode, failure })` signal (`server.Types.REPLAY_LIST_FAILED`), dispatched when the replay list request is rejected or never answered.
