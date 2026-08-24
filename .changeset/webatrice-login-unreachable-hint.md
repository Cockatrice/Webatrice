---
'@cockatrice/webatrice': patch
---

Show a distinct, cautiously-worded hint on the login screen when a connection
attempt can't reach the server, instead of the same generic "Connection
Closed"/"Connection Failed" text used for every disconnect. `useLogin` reads the
`getConnectUnreachable` selector and, only while disconnected, substitutes
*"Trouble reaching the server. Wait a minute and try again."* for the generic
status string (the wait matches how a per-IP rate-limit self-heals after a quiet
window). It appears both when the login connect fails and when the known-hosts
"refresh test connection" probe can't reach the host.

Detection and display only — no reconnect/backoff change, login screen only, and
the wording does not claim rate-limiting (a failed connect can equally be the
user's own network).
