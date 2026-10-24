---
'@cockatrice/datatrice': minor
---

`server.info.supportsPasswordHash` (selector `getSupportsPasswordHash`) holds whether the connected
server advertised password hashing, from the new optional third `updateInfo` argument. It is
`undefined` until reported (not yet known), like a host's `supportsHashedPassword`; the field and
argument are additive. `accountEditChanged` no longer blanks profile fields the edit did not carry. `accountActivationFailed`
optionally carries the transport `CommandFailure` on `ACCOUNT_ACTIVATION_FAILED`.
