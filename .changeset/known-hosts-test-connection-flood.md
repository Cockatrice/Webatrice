---
'@cockatrice/datatrice': patch
---

Carry `testConnectionStatus` through the `disconnected()` / `clearStore()` reset
reducers (like `status` and `locale`) so a transient game-socket drop no longer
nulls the login screen's connection-probe result. Previously these resets
rebuilt server state from scratch and wiped `testConnectionStatus` to `null`,
which disabled the login button (LoginForm gates on `'success'`) and fired a
known-hosts recovery effect that opened a fresh probe WebSocket on every
disconnect. Repeated disconnects produced a burst of probe sockets that, behind
the same public IP as the game socket and other tabs, exceeded Servatrice's
per-IP connection cap (`security/max_users_per_address`, default 4) and got
refused with `TOO_MANY_CONNECTIONS` (self-healing only once idle sockets aged
out ~60–120s later). The probe result now survives a transient drop, so the
login button stays enabled and there is nothing for a recovery effect to
recover.
