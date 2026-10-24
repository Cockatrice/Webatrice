---
'@cockatrice/sockatrice': minor
---

Staff commands report failures through `commandFailed` with the transport reason.

The Cockatrice 3.1 staff lookups (`reportUserInfo`, `getUserAlts`, `getUserSessions`, `getModeratorLastLogins`, `removeUserAvatar`, `listCardArtRules`) and `getServerStats` now pass the transport reason as `commandFailed`'s fourth argument when the server never answered, and `IDeveloperResponse.commandFailed` gains that optional `failure` argument. `updateServerMessage`, `shutdownServer` and `reloadConfig` report a failure through `IAdminResponse.commandFailed`. `resetUserPassword`'s `onFailure` also receives the transport reason.
