---
"@cockatrice/datatrice": patch
---

Track server seat/join order in the games slice.

`GameEntry` gains a `seatOrder: number[]` maintained by the reducers (`gameJoined` inits it,
`playerJoined` appends, `playerLeft` removes, `gamePlayersReplaced` accepts an optional `order`),
populated from the server's ordered `playerList` in the full-sync listener. A new pure helper
`games.seatedPlayersOf(game)` and selector `games.Selectors.getSeatedPlayers(state, gameId)` return
the active (non-spectator, non-conceded) players in that seat order — the single authority consumed
by the board layout and the reveal-target list, replacing per-consumer numeric-key ordering.
