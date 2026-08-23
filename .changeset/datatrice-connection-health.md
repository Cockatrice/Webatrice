---
'@cockatrice/datatrice': minor
---

New `server.connectionHealth` state surfacing the transport's keepalive health signal.

`SessionResponseImpl` implements the new optional `updateConnectionHealth` response method, dispatching `connectionHealthChanged({ missedPongs, silentForMs })` into a new `server.connectionHealth` field (`missedPongs > 0` = the server is not answering pings while the socket stays open; `0` = healthy). Any `updateStatus` transition resets the field so stale degraded state from a previous socket cannot survive a reconnect. New selectors: `getConnectionHealth` (with a stable healthy fallback for preloaded/partial states that predate the field) and `getIsServerUnresponsive`. The healthy-connection baseline is a single shared constant.
