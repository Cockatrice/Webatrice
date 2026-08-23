---
'@cockatrice/sockatrice': minor
---

Keepalive no longer closes the connection — missed pongs report degraded connection health instead, fixing the silent 5-10-minute disconnects.

**Why connections were dropping.** The old keepalive tolerated exactly one missed pong per 5s tick and tore the socket down itself (`'Connection timeout'`), with the teardown flagged as intentional so the reconnect logic never engaged — one slow pong or main-thread stall became a permanent, unlogged bounce to the login page. Worse, worker ticks that queued up behind a stalled main thread drained back-to-back afterward, so the tick right after a ping was armed would declare it missed 1-2 milliseconds after it was sent (observed repeatedly in field captures).

**New policy: the keepalive never self-disconnects.** Without credential retention a self-inflicted disconnect is strictly destructive — a lagged server that recovers resumes the session intact, while a forced close guarantees a manual re-login. The client keeps pinging indefinitely (which both feeds the server's inactivity timer and forces TCP to discover a genuinely dead connection); real death arrives via the socket's own `close`/`error` events, where the existing reconnect handling applies. A tick only counts a miss if the pending ping is at least ~one interval old, neutralizing the burst-drain false positives.

**Connection health signal.** After two consecutive genuine misses (~10s of silence) the transport reports degraded health through a new optional `onConnectionHealth(missedPongs, silentForMs)` config callback, forwarded to the response layer via the new optional `ISessionResponse.updateConnectionHealth` (backward-compatible — existing consumers are unaffected). Any pong reports recovery.

**Honest reconnect dead-end.** After a transport-level reconnect the server's fresh identification finds no pending connect options (they are single-use and the app retains no credentials), so the session cannot resume; that path now reads "Connection lost — please log in again" instead of the internal 'Missing connection options'.

**Code-review refinements.** A main-thread stall queues one worker tick per interval; on drain they fired back-to-back and each armed a ping, so a long stall emitted a burst of `Command_Ping` frames that could trip the server's per-interval flood counter. `tick()` now returns early for a burst-drained tick (a pending ping younger than ~one interval), so only the first drained tick sends — genuine silence still pings every interval as the never-self-disconnect policy intends. The derivable `reportedDegraded` flag and its unreachable reset branch are gone (recovery is derived from the pre-reset miss count). `buildWebSocketUrl` no longer lists a bare `::1` as a local host, since only the bracketed `[::1]` form produces a valid `ws://` URL.
