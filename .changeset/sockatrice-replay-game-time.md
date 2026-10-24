---
'@cockatrice/sockatrice': minor
---

`WebClient.replayGameEventContainer` now reports each recorded container's game time through the new optional `IGameResponse.replayGameTimeSynced(gameId, secondsElapsed)` before playing its events, when the container carries one. Servatrice stamps `seconds_elapsed` only on the containers it records, so this is how a client logs a replay's lines at the game time they were played, however fast the replay runs.
