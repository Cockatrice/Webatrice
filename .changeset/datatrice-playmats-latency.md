---
'@cockatrice/datatrice': minor
---

Playmats and connection latency. `games.Selectors.getPlayerPlaymat(state, gameId, playerId)` returns the playmat a player's properties announce (Cockatrice 3.1 #7101) as a `games.Playmat` with its crop clamped to the server's ranges, or `null` when none is set; the result keeps its reference until the playmat changes. `games.playmatFromParams`, `games.clampPlaymatParams` and `games.DEFAULT_PLAYMAT_PARAMS` are exported. Round-trip stats from Sockatrice's `updateLatencyStats` are stored in `server.latency` and read with `server.Selectors.getLatency`.
