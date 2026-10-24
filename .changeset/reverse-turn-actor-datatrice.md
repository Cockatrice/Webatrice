---
'@cockatrice/datatrice': patch
---

"X reversed turn order" now names the player who reversed it rather than the active player. `GameResponseImpl.turnReversed` forwards the new optional `playerId` into the `turnReversed` action, and, like desktop, the message-log listener logs nothing when the event carries no actor or names no seated player.
