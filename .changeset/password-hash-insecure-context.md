---
'@cockatrice/sockatrice': patch
---

Log in, register, activate an account, reset or change a password from a page that is not a secure context (served over plain http://, e.g. on a LAN). `crypto.subtle` is missing there, so the client cannot hash the password. It now sends the plain password, as it does for a server without password hashing, instead of throwing. `passwordHashAvailable()` is exported for callers that need to know.
