---
'@cockatrice/datatrice': minor
---

New `server/moderatorCommandFailed` and `server/adminCommandFailed` signal actions carry failed moderator/admin commands to the UI, `server/getUserInfoFailed` does the same for a failed user-info lookup, and `server.Selectors.getWarnListForUser` returns the official warning reasons Servatrice offered for a user. `adjustMod` now also refreshes the user's profile snapshot, so an open profile shows the new role. `ServerCapability` is now also exported from the package root, because the `server` namespace's type bundle kept only its type.
