---
"@cockatrice/sockatrice": minor
---

Add an optional trailing request ID to joinGame and echo it on success, rejection, transport failure, and pending callbacks. Existing callers keep their callback arity, and the identity stays off the wire. Suppress disconnected join outcomes after the session ends using the shared session-lifetime guard.
