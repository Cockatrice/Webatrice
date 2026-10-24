---
'@cockatrice/datatrice': patch
---

The `rooms/joinRoom` action payload carries an optional `userInitiated` flag from Sockatrice, `false` for a server auto-join, so the UI can tell an auto-join from a room the user asked for.
