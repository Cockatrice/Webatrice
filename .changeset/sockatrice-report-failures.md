---
'@cockatrice/sockatrice': minor
---

Report views can now tell a failure from a slow server. The moderation-queue builders `reportList`, `reportAssign`, `reportResolve`, `reportStats` and `replayDownloadByGameId` report a failure through the moderator scope's optional `commandFailed` like the other staff commands (`ModeratorCommandName` gains those five names; `RespInvalidData` on an assign or resolve means another moderator took or closed the report first). The session-scope report reads `reportMyList` and `reportDetails` do the same through a new optional `ISessionResponse.commandFailed` (`SessionCommandName`). `replayDownloadByGameId` first calls the new optional `IModeratorResponse.replayDownloadByGameIdPending(gameId)`, so a stored replay of the same game can't stand in for the answer.
