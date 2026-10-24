---
'@cockatrice/sockatrice': patch
---

`IGameResponse.turnReversed` gains an optional third `playerId` argument: the player who sent `Command_ReverseTurn`, taken from the event's `GameEvent.player_id`. The `Event_ReverseTurn` handler now passes it, so a response layer can name the actor instead of guessing.
