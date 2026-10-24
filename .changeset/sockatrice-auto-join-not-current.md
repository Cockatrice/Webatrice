---
'@cockatrice/sockatrice': patch
---

`IRoomResponse.joinRoom` receives a second, optional `userInitiated` argument: `false` for a server auto-join, `true` when the user asked for the room (including a pending auto-join the user asked for). This lets a client open an auto-joined room without switching to it, as desktop does (`setCurrent = false`).
