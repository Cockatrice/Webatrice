---
'@cockatrice/datatrice': minor
---

Every game log line (`GameMessage`) now carries `gameSeconds`, the game time when it was logged, for desktop's "Use game time instead of local time in game logs". As on desktop, the game clock runs on from the server's last `seconds_elapsed`: games record when it arrived (`GameEntry.secondsElapsedAt`), and replays set it from each recorded container through `replayGameTimeSynced` (the new `games.Types.GAME_TIME_SYNCED` action).
