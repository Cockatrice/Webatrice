---
'@cockatrice/datatrice': patch
---

Track whether the most recent connection attempt never reached the server, for
the login screen's reachability hint. `SessionResponseImpl.connectionUnreachable()`
dispatches a new `connectUnreachable` action; a `connectUnreachable` boolean on
`ServerState` is set by its reducer and exposed via the `getConnectUnreachable`
selector.

The flag reflects only the latest attempt: it is cleared at the start of every
attempt — both `connectionAttempted` (login/reconnect) and `testConnectionStarted`
(the known-hosts probe) — and carried through the `disconnected()` rebuild that
accompanies the failure. That carry is load-bearing: the failure's own DISCONNECTED
triggers the listener-dispatched `disconnected()` rebuild in the same tick, which
would otherwise reset the freshly-set flag before any component reads it.
`clearStore`/`initialized` deliberately reset it to `false`.
