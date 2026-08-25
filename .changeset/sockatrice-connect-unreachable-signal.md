---
'@cockatrice/sockatrice': patch
---

Signal when a connection attempt never reaches the server, so the UI can tell a
reachability problem apart from a server refusal. Both connect paths now raise it:

- **Main game socket** (`WebSocketService`): a new optional `onConnectionUnreachable`
  fires from `onclose` whenever the socket closes without ever having opened
  (`!hasEverOpened`) — covering offline, DNS failure, refused, TLS reset, and the
  slow ≥5s hang uniformly, since `onclose` is the one terminal event
  (`onerror` always precedes it, and the connect-timer's close lands there too).
  It is suppressed for intentional disconnects, retired/superseded sockets,
  in-flight reconnects, and post-open drops.
- **Test-connection probe** (`WebClient.testConnect`): its transport-failure
  resolutions (`onerror`, `onclose` before identification, keepalive timeout) also
  raise it via `session.connectionUnreachable()`; a protocol-version mismatch or
  decode failure does not (the server was reached, just incompatible).

Adds `connectionUnreachable()` to the session response interface
(`ISessionResponse`).
