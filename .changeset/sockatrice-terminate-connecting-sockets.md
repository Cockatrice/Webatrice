---
'@cockatrice/sockatrice': patch
---

Never abort a still-`CONNECTING` WebSocket. Calling `close()` on a connecting
socket *fails* the connection — the peer sees an abnormal 1006 with no clean close
frame / FIN — and a reverse proxy that byte-tunnels or terminates the upgraded
connection then holds the half-dead upstream open until its idle read timeout
(~60s). That stranded upstream counts against Servatrice's per-IP connection cap
(`security/max_users_per_address`), so a handful of aborted connects (rapid
connection tests, superseded probes, retried logins) gets the client refused with
`TOO_MANY_CONNECTIONS` until the sockets age out.

Introduces `terminateSocket(socket)` — the mandatory safe close: it defers a clean
`close()` to `onopen` when the socket is `CONNECTING`, closes immediately when
`OPEN`, and no-ops when already closing/closed. Routed through every close site
(the main connection's `closeActiveSocket`, and `WebClient.testConnect`'s
supersede and resolve paths), with the retired CONNECTING orphan's lifecycle
handlers detached so its deferred open→close can't emit stray status/reconnect
events. The connect-timeout keeps its raw abort on purpose (it fires only for a
socket that never opened, and its `onclose` drives reconnect).

Note: this stops the client from *leaking* half-open sockets, but a proxy that
does not propagate even a clean close (holding every connection until a timeout)
is a server-side concern — set `server/web_socket_ip_header = X-Real-IP` so the
cap is per-real-client, and tune the proxy's read timeout.
