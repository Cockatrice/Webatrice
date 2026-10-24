---
'@cockatrice/sockatrice': minor
---

Moderator and admin commands now report failures. `IModeratorResponse` and `IAdminResponse` gain an optional `commandFailed(command, responseCode, target)` callback, fired when ban/warn history, the warn list, admin notes, the log search, replay-access grants, forced activation or `adjustMod` come back with a non-OK code. `forceActivateUser` now reports success on `RespActivationAccepted`, the code Servatrice actually answers with. `ISessionResponse` gains an optional `getUserInfoFailed(userName, responseCode)`, so a failed `getUserInfo` is reported instead of going silent.
